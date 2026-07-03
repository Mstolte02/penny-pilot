import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { mobileBudgetPlan, mobileSavingsConfig, mobileTransactions } from '@/data/personal-finance-template';
import {
  avgForecast,
  ewmaForecast,
  homeGoalForecast,
  uniqueMonths,
  monthKey,
  type BudgetPlan,
  type MobileTransaction,
} from '@/domain/mobile-finance';

/**
 * Local persistence for everything the user touches. Backed by AsyncStorage today
 * (works identically on iOS/Android/web with zero config); the collection-based
 * API is deliberately shaped like a document store so SQLite can replace the
 * internals on native — when dev builds land for Plaid — without touching screens.
 */

const DB_PREFIX = 'penny:db:';

export type TransactionSource = 'sample' | 'import' | 'manual';

export type StoredTransaction = MobileTransaction & {
  source: TransactionSource;
};

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
  return mobileTransactions.map((transaction) => ({ ...transaction, source: 'sample' }));
}

function seedPlanLines(transactions: MobileTransaction[]): PlanLine[] {
  return mobileBudgetPlan.sections.flatMap((section) =>
    section.lines.map<PlanLine>((line) => {
      const base: PlanLine = {
        id: `${section.title}::${line.name}`,
        section: section.title,
        name: line.name,
        type: line.type === 'fixed' ? 'fixed' : 'flexible',
        amount: line.monthly ?? 0,
        method: 'avg6',
        match: line.match,
      };
      if (base.type === 'flexible') {
        base.amount = forecastLineAmount(base, base.method, transactions);
      }
      return base;
    })
  );
}

function monthInputAfter(startDate: string, count: number) {
  const [year, monthNumber] = startDate.split('-').map(Number);
  const date = new Date(year, monthNumber - 1 + count, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function seedGoals(transactions: MobileTransaction[]): GoalPlan[] {
  const home = homeGoalForecast({ transactions, savings: mobileSavingsConfig });
  const transactionMonths = uniqueMonths(transactions);
  const startMonth =
    transactionMonths[transactionMonths.length - 1] ?? mobileSavingsConfig.asOfDate.slice(0, 7);

  return [
    {
      id: 'home',
      name: 'First home fund',
      target: Math.round(home.cashNeeded),
      current: Math.round(home.currentSavings),
      monthlyTarget: mobileSavingsConfig.monthlySavingsTarget,
      mode: 'track',
      targetDate:
        home.monthsToGoal === null
          ? monthInputAfter(mobileSavingsConfig.asOfDate, 24)
          : monthInputAfter(startMonth, home.monthsToGoal),
    },
  ];
}

function seedPlannedExpenses(): PlannedExpensePlan[] {
  return mobileSavingsConfig.plannedExpenses.map((expense, index) => ({
    id: `expense-${index}`,
    name: expense.description,
    date: expense.date,
    amount: expense.amount,
  }));
}

type Updater<T> = T | ((previous: T) => T);

function resolveUpdater<T>(updater: Updater<T>, previous: T): T {
  return typeof updater === 'function' ? (updater as (value: T) => T)(previous) : updater;
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

      const seededTransactions = storedTransactions ?? seedTransactions();
      setTransactionsState(seededTransactions);
      setPlanLinesState(storedPlanLines ?? seedPlanLines(seededTransactions));
      setAdjustmentsState(storedAdjustments ?? {});
      setGoalsState(storedGoals ?? seedGoals(seededTransactions));
      setPlannedExpensesState(storedPlannedExpenses ?? seedPlannedExpenses());
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
      addTransactions: (rows) => setTransactions((previous) => [...previous, ...rows]),
      updateTransaction: (id, patch) =>
        setTransactions((previous) =>
          previous.map((transaction) =>
            transaction.id === id ? { ...transaction, ...patch } : transaction
          )
        ),
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
      guessCategory: (item) => {
        const normalized = item.trim().toLowerCase();
        if (!normalized) return null;
        const counts = new Map<string, { category: string; subcategory: string | null; count: number }>();
        for (const transaction of transactions) {
          if (transaction.type !== 'expense') continue;
          if (transaction.item.trim().toLowerCase() !== normalized) continue;
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
        return best ? { category: best.category, subcategory: best.subcategory } : null;
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
