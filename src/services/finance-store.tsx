import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';

import { mobileBudgetPlan } from '@/data/personal-finance-template';
import {
  avgForecast,
  ewmaForecast,
  uniqueMonths,
  monthKey,
  type BudgetPlan,
  type MobileTransaction,
} from '@/domain/mobile-finance';
import { env } from '@/config/env';
import { authService, bankSyncService } from '@/services';
import { buildBankTransactions, type CategorySource } from '@/services/bank-feed';

/**
 * Local persistence for everything the user touches. Backed by AsyncStorage today
 * (works identically on iOS/Android/web with zero config); the collection-based
 * API is deliberately shaped like a document store so SQLite can replace the
 * internals on native — when dev builds land for Plaid — without touching screens.
 */

const DB_PREFIX = 'penny:db:';

export type TransactionSource = 'sample' | 'import' | 'manual' | 'bank';

export type StoredTransaction = MobileTransaction & {
  source: TransactionSource;
  /** Bank rows only: where the category came from ("user" survives every re-sync). */
  categorySource?: CategorySource;
};

export type BankSyncState = {
  status: 'idle' | 'syncing' | 'done' | 'error' | 'signed-out';
  lastSyncedAt: string | null;
  message: string | null;
};

const BANK_LAST_SYNC_KEY = 'penny:bankLastSync';
/** Don't hit Plaid more often than this on app open; "Sync now" ignores it. */
const AUTO_SYNC_EVERY_MS = 10 * 60 * 1000;

export type ForecastMethod = 'avg3' | 'avg6' | 'avg9' | 'avg12' | 'ewma';

export type PlanLine = {
  id: string;
  section: string;
  name: string;
  type: 'fixed' | 'flexible';
  amount: number;
  method: ForecastMethod;
  match?: [string, string][];
};

export type GoalMode = 'track' | 'deadline';

export type GoalPlan = {
  id: string;
  name: string;
  target: number;
  current: number;
  monthlyTarget: number;
  mode: GoalMode;
  targetDate: string;
};

export type PlannedExpensePlan = {
  id: string;
  name: string;
  date: string;
  amount: number;
};

export type FeedTransactionPatch = {
  merchantName: string;
  category: string;
  amount: number;
};

type Collections = {
  transactions: StoredTransaction[];
  planLines: PlanLine[];
  adjustments: Record<string, number>;
  goals: GoalPlan[];
  plannedExpenses: PlannedExpensePlan[];
  cancelFlags: Record<string, boolean>;
  transactionEdits: Record<string, FeedTransactionPatch>;
  resolvedReviewIds: string[];
};

const COLLECTION_KEYS = Object.keys({
  transactions: null,
  planLines: null,
  adjustments: null,
  goals: null,
  plannedExpenses: null,
  cancelFlags: null,
  transactionEdits: null,
  resolvedReviewIds: null,
} satisfies Record<keyof Collections, null>) as (keyof Collections)[];

async function readCollection<K extends keyof Collections>(key: K): Promise<Collections[K] | null> {
  try {
    const raw = await AsyncStorage.getItem(`${DB_PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as Collections[K]) : null;
  } catch {
    return null;
  }
}

function persistCollection<K extends keyof Collections>(key: K, value: Collections[K]) {
  AsyncStorage.setItem(`${DB_PREFIX}${key}`, JSON.stringify(value)).catch(() => {});
}

/** Wipes every stored collection (used by "start fresh" in settings). */
export async function clearFinanceData() {
  await AsyncStorage.multiRemove(COLLECTION_KEYS.map((key) => `${DB_PREFIX}${key}`)).catch(
    () => {}
  );
}

export function lineMatchesTransaction(transaction: MobileTransaction, line: PlanLine) {
  if (transaction.type !== 'expense') return false;

  if (line.match?.length) {
    return line.match.some(
      ([category, subcategory]) =>
        transaction.category === category &&
        ((transaction.subcategory ?? 'Uncategorized') === subcategory ||
          (transaction.subcategory ?? '').startsWith(`${subcategory}:`))
    );
  }

  return transaction.category === line.section && transaction.subcategory === line.name;
}

export function forecastLineAmount(
  line: PlanLine,
  method: ForecastMethod,
  transactions: MobileTransaction[]
) {
  const months = uniqueMonths(transactions);
  const values = months.map((month) =>
    transactions
      .filter(
        (transaction) =>
          monthKey(transaction.date) === month && lineMatchesTransaction(transaction, line)
      )
      .reduce((sum, transaction) => sum + transaction.moneyOut, 0)
  );
  const amount =
    method === 'ewma' ? ewmaForecast(values) : avgForecast(values, Number(method.replace('avg', '')));
  return Math.round(amount);
}

/** Rebuilds a domain BudgetPlan from the editable plan lines, for the forecast helpers. */
export function planFromLines(lines: PlanLine[]): BudgetPlan {
  const sections = new Map<string, PlanLine[]>();
  for (const line of lines) {
    sections.set(line.section, [...(sections.get(line.section) ?? []), line]);
  }

  return {
    income: mobileBudgetPlan.income,
    sections: Array.from(sections.entries()).map(([title, sectionLines]) => ({
      title,
      lines: sectionLines.map((line) => ({
        name: line.name,
        type: line.type === 'fixed' ? ('fixed' as const) : ('variable' as const),
        monthly: line.amount,
        match: line.match,
      })),
    })),
  };
}

function seedTransactions(): StoredTransaction[] {
  return [];
}

function seedPlanLines(transactions: MobileTransaction[]): PlanLine[] {
  const hasHistory = transactions.some((transaction) => transaction.type === 'expense');
  return mobileBudgetPlan.sections.flatMap((section) =>
    section.lines.map<PlanLine>((line) => {
      const base: PlanLine = {
        id: `${section.title}::${line.name}`,
        section: section.title,
        name: line.name,
        type: line.type === 'fixed' ? 'fixed' : 'flexible',
        amount: 0,
        method: 'avg6',
        match: line.match,
      };
      if (hasHistory) {
        base.amount = forecastLineAmount(base, base.method, transactions);
      }
      return base;
    })
  );
}

function seedGoals(transactions: MobileTransaction[]): GoalPlan[] {
  void transactions;
  return [];
}

function seedPlannedExpenses(): PlannedExpensePlan[] {
  return [];
}

type Updater<T> = T | ((previous: T) => T);

function resolveUpdater<T>(updater: Updater<T>, previous: T): T {
  return typeof updater === 'function' ? (updater as (value: T) => T)(previous) : updater;
}

function normalizeMerchantKey(item: string) {
  return item
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b\d{1,2}\/\d{1,2}\b/g, ' ')
    .replace(/\b\d{4,}\b/g, ' ')
    .replace(/\b(ppd id|web id|transaction#):?\s*\S+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(
      /\b(inc|llc|co|corp|company|store|market|mktpl|www|com|bill|payment|sent|money|online|transfer|to|from|the)\b/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

const categoryRules: {
  pattern: RegExp;
  category: string;
  subcategory: string | null;
}[] = [
  {
    pattern: /\b(payroll|salary|direct deposit|ach credit|deposit)\b/i,
    category: 'Income',
    subcategory: null,
  },
  {
    pattern: /\b(aldi|kroger|meijer|walmart|costco|sam'?s club|grocery)\b/i,
    category: 'Food',
    subcategory: 'Groceries',
  },
  {
    pattern: /\b(wendy|mcdonald|pizza|restaurant|pancake|texas roadhouse|china wok|tst\*)\b/i,
    category: 'Food',
    subcategory: 'Dining Out',
  },
  {
    pattern: /\b(vending|365 market|coffee|snack)\b/i,
    category: 'Food',
    subcategory: 'Snacks',
  },
  {
    pattern: /\b(shell|speedway|bp|caseys|family express|gas|fuel)\b/i,
    category: 'Essentials',
    subcategory: 'Transportation: Gas',
  },
  {
    pattern: /\b(progressive|auto insurance|insurance)\b/i,
    category: 'Essentials',
    subcategory: 'Auto Insurance',
  },
  {
    pattern: /\b(discover|student loan|loan payment|e-payment)\b/i,
    category: 'Debt',
    subcategory: 'Personal Loans',
  },
  {
    pattern: /\b(roku|netflix|hulu|spotify|apple\.com\/bill|apple com bill|fandango)\b/i,
    category: 'Subscriptions & Fun',
    subcategory: 'Streaming',
  },
  {
    pattern: /\b(openai|chatgpt|vercel|squarespace|domain|cloud storage|icloud|google storage)\b/i,
    category: 'Subscriptions & Fun',
    subcategory: 'Software',
  },
  {
    pattern: /\b(amazon|target|household)\b/i,
    category: 'Daily Living',
    subcategory: 'Household Consumables',
  },
  {
    pattern: /\b(zelle|sofi|acct xfer|online transfer|quickpay|apple cash|cash app|venmo|paypal|savings|investment)\b/i,
    category: 'Transfers',
    subcategory: 'Transfers',
  },
];

/**
 * What the user filed this merchant under before. Only human decisions count: imported,
 * manual, or bank rows the user categorized. Auto-categorized bank rows are skipped so a
 * wrong Plaid guess can't reinforce itself.
 */
function choiceForMerchant(transactions: StoredTransaction[], merchant: string) {
  const key = normalizeMerchantKey(merchant);
  if (!key) return null;
  const counts = new Map<string, { category: string; subcategory: string | null; count: number }>();
  for (const transaction of transactions) {
    if (transaction.type !== 'expense' || transaction.source === 'sample') continue;
    if (!transaction.category || transaction.category === 'Uncategorized') continue;
    if (transaction.source === 'bank' && transaction.categorySource !== 'user') continue;
    if (normalizeMerchantKey(transaction.item) !== key) continue;
    const entryKey = `${transaction.category}::${transaction.subcategory ?? ''}`;
    const entry = counts.get(entryKey) ?? {
      category: transaction.category,
      subcategory: transaction.subcategory,
      count: 0,
    };
    entry.count += 1;
    counts.set(entryKey, entry);
  }
  const best = Array.from(counts.values()).sort((a, b) => b.count - a.count)[0];
  return best ? { category: best.category, subcategory: best.subcategory } : null;
}

function guessFromRules(item: string) {
  return categoryRules.find((rule) => rule.pattern.test(item)) ?? null;
}

type FinanceStore = {
  ready: boolean;
  transactions: StoredTransaction[];
  planLines: PlanLine[];
  adjustments: Record<string, number>;
  goals: GoalPlan[];
  plannedExpenses: PlannedExpensePlan[];
  cancelFlags: Record<string, boolean>;
  transactionEdits: Record<string, FeedTransactionPatch>;
  resolvedReviewIds: string[];
  addTransactions: (rows: StoredTransaction[]) => void;
  updateTransaction: (id: string, patch: Partial<StoredTransaction>) => void;
  deleteTransaction: (id: string) => void;
  setPlanLines: (updater: Updater<PlanLine[]>) => void;
  setAdjustments: (updater: Updater<Record<string, number>>) => void;
  setGoals: (updater: Updater<GoalPlan[]>) => void;
  setPlannedExpenses: (updater: Updater<PlannedExpensePlan[]>) => void;
  setCancelFlags: (updater: Updater<Record<string, boolean>>) => void;
  setTransactionEdits: (updater: Updater<Record<string, FeedTransactionPatch>>) => void;
  markReviewResolved: (id: string) => void;
  /** Best guess for an imported/manual item based on spending history. */
  guessCategory: (item: string) => { category: string; subcategory: string | null } | null;
  /** Connected banks: sync state, and a manual "Sync now". */
  bankSync: BankSyncState;
  refreshBank: (options?: { sync?: boolean }) => Promise<void>;
  /** Wipes storage and returns the in-memory store to first-run seed data. */
  resetToSeeds: () => Promise<void>;
};

const FinanceContext = createContext<FinanceStore | null>(null);

export function FinanceProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [transactions, setTransactionsState] = useState<StoredTransaction[]>([]);
  const [planLines, setPlanLinesState] = useState<PlanLine[]>([]);
  const [adjustments, setAdjustmentsState] = useState<Record<string, number>>({});
  const [goals, setGoalsState] = useState<GoalPlan[]>([]);
  const [plannedExpenses, setPlannedExpensesState] = useState<PlannedExpensePlan[]>([]);
  const [cancelFlags, setCancelFlagsState] = useState<Record<string, boolean>>({});
  const [transactionEdits, setTransactionEditsState] = useState<Record<string, FeedTransactionPatch>>({});
  const [resolvedReviewIds, setResolvedReviewIdsState] = useState<string[]>([]);
  const [bankSync, setBankSync] = useState<BankSyncState>({
    status: 'idle',
    lastSyncedAt: null,
    message: null,
  });
  // The bank merge runs async, so it reads the latest plan from a ref, not a stale closure.
  const planLinesRef = useRef<PlanLine[]>([]);
  planLinesRef.current = planLines;
  const bankBusy = useRef(false);

  const refreshBank = useCallback(async (options: { sync?: boolean } = {}) => {
    if (env.dataSource !== 'supabase' || bankBusy.current) return;
    bankBusy.current = true;
    try {
      const user = await authService.getCurrentUser().catch(() => null);
      if (!user) {
        setBankSync((previous) => ({ ...previous, status: 'signed-out', message: null }));
        return;
      }
      setBankSync((previous) => ({ ...previous, status: 'syncing', message: null }));
      let syncNote: string | null = null;
      if (options.sync) {
        try {
          await bankSyncService.syncAll();
        } catch (error) {
          // Still show what the server already has; say why it may be stale.
          syncNote = error instanceof Error ? error.message : 'Could not reach your bank just now.';
        }
      }
      const rows = await bankSyncService.listBankFeed();
      setTransactionsState((previous) => {
        const merchantChoice = (merchant: string) => choiceForMerchant(previous, merchant);
        const bankRows = buildBankTransactions(rows, previous, planLinesRef.current, merchantChoice);
        const next = [...previous.filter((transaction) => transaction.source !== 'bank'), ...bankRows];
        persistCollection('transactions', next);
        return next;
      });
      // Review now happens on the phone; empty the old server queue so nothing shows twice.
      await bankSyncService.clearServerReviewQueue().catch(() => undefined);
      const syncedAt = new Date().toISOString();
      if (!syncNote) await AsyncStorage.setItem(BANK_LAST_SYNC_KEY, syncedAt).catch(() => undefined);
      setBankSync({
        status: syncNote ? 'error' : 'done',
        lastSyncedAt: syncNote ? null : syncedAt,
        message: syncNote,
      });
    } catch (error) {
      setBankSync((previous) => ({
        ...previous,
        status: 'error',
        message: error instanceof Error ? error.message : 'Bank sync failed.',
      }));
    } finally {
      bankBusy.current = false;
    }
  }, []);

  // Sync on launch and whenever the app comes back to the foreground, at most every 10 minutes.
  useEffect(() => {
    if (!ready || env.dataSource !== 'supabase') return;
    const maybeSync = async () => {
      const last = await AsyncStorage.getItem(BANK_LAST_SYNC_KEY).catch(() => null);
      const stale = !last || Date.now() - new Date(last).getTime() > AUTO_SYNC_EVERY_MS;
      void refreshBank({ sync: stale });
    };
    void maybeSync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void maybeSync();
    });
    return () => subscription.remove();
  }, [ready, refreshBank]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [
        storedTransactions,
        storedPlanLines,
        storedAdjustments,
        storedGoals,
        storedPlannedExpenses,
        storedCancelFlags,
        storedEdits,
        storedResolved,
      ] = await Promise.all([
        readCollection('transactions'),
        readCollection('planLines'),
        readCollection('adjustments'),
        readCollection('goals'),
        readCollection('plannedExpenses'),
        readCollection('cancelFlags'),
        readCollection('transactionEdits'),
        readCollection('resolvedReviewIds'),
      ]);
      if (!mounted) return;

      const seededTransactions = (storedTransactions ?? seedTransactions()).filter(
        (transaction) => transaction.source !== 'sample'
      );
      const storedPersonalGoals =
        storedGoals?.filter((goal) => !(goal.id === 'home' && goal.name === 'First home fund')) ??
        null;
      const storedPersonalExpenses =
        storedPlannedExpenses?.filter((expense) => !expense.id.startsWith('expense-')) ?? null;
      setTransactionsState(seededTransactions);
      setPlanLinesState(storedPlanLines ?? seedPlanLines(seededTransactions));
      setAdjustmentsState(storedAdjustments ?? {});
      setGoalsState(storedPersonalGoals ?? seedGoals(seededTransactions));
      setPlannedExpensesState(storedPersonalExpenses ?? seedPlannedExpenses());
      setCancelFlagsState(storedCancelFlags ?? {});
      setTransactionEditsState(storedEdits ?? {});
      setResolvedReviewIdsState(storedResolved ?? []);
      setReady(true);
    }

    load().catch(() => {
      if (!mounted) return;
      // Storage unavailable: run on seeds so the app still works this session.
      const seeded = seedTransactions();
      setTransactionsState(seeded);
      setPlanLinesState(seedPlanLines(seeded));
      setGoalsState(seedGoals(seeded));
      setPlannedExpensesState(seedPlannedExpenses());
      setReady(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo<FinanceStore>(() => {
    const setTransactions = (updater: Updater<StoredTransaction[]>) => {
      setTransactionsState((previous) => {
        const next = resolveUpdater(updater, previous);
        persistCollection('transactions', next);
        return next;
      });
    };

    const simpleSetter =
      <K extends keyof Collections>(
        key: K,
        set: (updater: (previous: Collections[K]) => Collections[K]) => void
      ) =>
      (updater: Updater<Collections[K]>) => {
        set((previous) => {
          const next = resolveUpdater(updater, previous);
          persistCollection(key, next);
          return next;
        });
      };

    return {
      ready,
      transactions,
      planLines,
      adjustments,
      goals,
      plannedExpenses,
      cancelFlags,
      transactionEdits,
      resolvedReviewIds,
      addTransactions: (rows) =>
        setTransactions((previous) => {
          const hasUserData = previous.some((transaction) => transaction.source !== 'sample');
          const nextBase = hasUserData ? previous : previous.filter((transaction) => transaction.source !== 'sample');
          return [...nextBase, ...rows];
        }),
      updateTransaction: (id, patch) =>
        setTransactions((previous) => {
          const target = previous.find((transaction) => transaction.id === id);
          const recategorized =
            target?.source === 'bank' && patch.category !== undefined && patch.category !== 'Uncategorized';
          const merchantKey = recategorized && target ? normalizeMerchantKey(target.item) : null;
          return previous.map((transaction) => {
            if (transaction.id === id) {
              // A bank row stays a bank row (the editor writes source "manual"), or the
              // next sync would add it a second time.
              const sourcePatch = transaction.source === 'bank' ? { source: 'bank' as const } : {};
              return recategorized
                ? { ...transaction, ...patch, ...sourcePatch, categorySource: 'user' as const }
                : { ...transaction, ...patch, ...sourcePatch };
            }
            if (
              merchantKey &&
              transaction.source === 'bank' &&
              transaction.type === 'expense' &&
              transaction.categorySource !== 'user' &&
              normalizeMerchantKey(transaction.item) === merchantKey
            ) {
              return {
                ...transaction,
                category: patch.category ?? transaction.category,
                subcategory: patch.subcategory !== undefined ? patch.subcategory : transaction.subcategory,
                categorySource: 'history' as const,
              };
            }
            return transaction;
          });
        }),
      deleteTransaction: (id) =>
        setTransactions((previous) => previous.filter((transaction) => transaction.id !== id)),
      setPlanLines: simpleSetter('planLines', setPlanLinesState),
      setAdjustments: simpleSetter('adjustments', setAdjustmentsState),
      setGoals: simpleSetter('goals', setGoalsState),
      setPlannedExpenses: simpleSetter('plannedExpenses', setPlannedExpensesState),
      setCancelFlags: simpleSetter('cancelFlags', setCancelFlagsState),
      setTransactionEdits: simpleSetter('transactionEdits', setTransactionEditsState),
      markReviewResolved: (id) => {
        setResolvedReviewIdsState((previous) => {
          if (previous.includes(id)) return previous;
          const next = [...previous, id];
          persistCollection('resolvedReviewIds', next);
          return next;
        });
      },
      resetToSeeds: async () => {
        await clearFinanceData();
        const seeded = seedTransactions();
        setTransactionsState(seeded);
        setPlanLinesState(seedPlanLines(seeded));
        setAdjustmentsState({});
        setGoalsState(seedGoals(seeded));
        setPlannedExpensesState(seedPlannedExpenses());
        setCancelFlagsState({});
        setTransactionEditsState({});
        setResolvedReviewIdsState([]);
      },
      bankSync,
      refreshBank,
      guessCategory: (item) => {
        const normalized = item.trim().toLowerCase();
        const merchantKey = normalizeMerchantKey(item);
        if (!normalized) return null;
        const counts = new Map<string, { category: string; subcategory: string | null; count: number }>();
        for (const transaction of transactions) {
          if (transaction.type !== 'expense') continue;
          const transactionKey = normalizeMerchantKey(transaction.item);
          if (
            transaction.item.trim().toLowerCase() !== normalized &&
            transactionKey !== merchantKey &&
            !transactionKey.includes(merchantKey) &&
            !merchantKey.includes(transactionKey)
          ) {
            continue;
          }
          const key = `${transaction.category}::${transaction.subcategory ?? ''}`;
          const entry =
            counts.get(key) ?? {
              category: transaction.category,
              subcategory: transaction.subcategory,
              count: 0,
            };
          entry.count += 1;
          counts.set(key, entry);
        }
        const best = Array.from(counts.values()).sort((a, b) => b.count - a.count)[0];
        if (best) return { category: best.category, subcategory: best.subcategory };

        const rule = guessFromRules(item);
        return rule ? { category: rule.category, subcategory: rule.subcategory } : null;
      },
    };
  }, [
    ready,
    transactions,
    planLines,
    adjustments,
    goals,
    plannedExpenses,
    cancelFlags,
    transactionEdits,
    resolvedReviewIds,
    bankSync,
    refreshBank,
  ]);

  if (!ready) return null;

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const store = useContext(FinanceContext);
  if (!store) {
    throw new Error('useFinance must be used inside FinanceProvider');
  }
  return store;
}
