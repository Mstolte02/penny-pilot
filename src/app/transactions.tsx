import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import {
  Card,
  PANEL_BOTTOM_INSET,
  PennyBadge,
  Pill,
  PillButton,
  Screen,
  SpeechBubble,
  ToggleChip,
} from '@/components/penny-ui';
import { FadeInUp } from '@/components/penny-motion';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { emptyStates } from '@/constants/penny-voice';
import type { Category, Subcategory, Transaction } from '@/domain/finance';
import { formatMoney, monthKey, uniqueMonths } from '@/domain/mobile-finance';
import { useTheme } from '@/hooks/use-theme';
import { categorizationService, financeDataService } from '@/services';
import type { CategorizationSuggestion } from '@/services/contracts';
import type { ImportPreview } from '@/services/csv-import';
import {
  lineMatchesTransaction,
  useFinance,
  type PlanLine,
  type StoredTransaction,
} from '@/services/finance-store';
import { importFailureNeedsRebuild, pickImportPreview } from '@/services/import-file';

const SEGMENTS = [
  { label: 'Transactions', value: 'feed' },
  { label: 'Subscriptions', value: 'subscriptions' },
];

type CategoryWithSubcategories = Category & { subcategories: Subcategory[] };

function formatTransactionMoney(value: number) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function dayLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Can't load transactions right now.";
}

const confidenceDisplay: Record<
  Transaction['categoryConfidence'],
  { label: string; tone: 'good' | 'info' | 'muted' }
> = {
  high: { label: 'High confidence', tone: 'good' },
  medium: { label: 'Medium confidence', tone: 'info' },
  low: { label: 'Low confidence', tone: 'muted' },
  none: { label: 'New merchant', tone: 'muted' },
};

const NOT_SUBSCRIPTION = /rent|electric|water|internet|insurance|loan|utilit|mortgage|payment/i;

type DetectedSubscription = {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  monthly: number;
  inBudget: boolean;
  firstSeen: string;
  lastSeen: string;
  activeAsOf: string;
  active: boolean;
};

type TransactionEditorDraft = {
  mode: 'manual' | 'feed';
  title: string;
  id?: string;
  sourceId?: string;
  date: string;
  merchantName: string;
  category: string;
  amount: string;
  kind: 'expense' | 'income' | 'transfer';
};

type CategoryOption = {
  category: string;
  subcategories: string[];
};

type SimilarCandidate = {
  transaction: StoredTransaction;
  score: number;
};

type SimilarReviewState = {
  base: StoredTransaction;
  category: string;
  subcategory: string | null;
  candidates: SimilarCandidate[];
} | null;

/**
 * True subscriptions only: a charge that repeats monthly at a steady amount.
 * Rent, utilities, insurance, and loan payments recur too, but they're bills —
 * they're excluded by category and by name.
 */
function detectSubscriptions(
  transactions: StoredTransaction[],
  planLines: PlanLine[]
): DetectedSubscription[] {
  const excludedCategories = new Set(['Essentials', 'Debt', 'Income', 'Health', 'Home']);
  const monthsAvailable = uniqueMonths(transactions).length;
  const sortedDates = transactions.map((transaction) => transaction.date).sort();
  const latestDate = sortedDates[sortedDates.length - 1] ?? new Date().toISOString().slice(0, 10);
  const latestTime = new Date(`${latestDate}T12:00:00`).getTime();
  const byItem = new Map<string, { amounts: number[]; months: Set<string>; dates: string[]; sample: StoredTransaction }>();

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;
    if (excludedCategories.has(transaction.category)) continue;
    if (NOT_SUBSCRIPTION.test(transaction.item)) continue;
    const entry = byItem.get(transaction.item) ?? { amounts: [], months: new Set(), dates: [], sample: transaction };
    entry.amounts.push(transaction.moneyOut);
    entry.months.add(monthKey(transaction.date));
    entry.dates.push(transaction.date);
    byItem.set(transaction.item, entry);
  }

  return Array.from(byItem.entries())
    .filter(([, entry]) => {
      if (entry.months.size < Math.min(3, monthsAvailable)) return false;
      const mean = entry.amounts.reduce((sum, value) => sum + value, 0) / entry.amounts.length;
      const spread = Math.max(...entry.amounts) - Math.min(...entry.amounts);
      return mean > 0 && spread / mean < 0.1;
    })
    .map(([name, entry]) => {
      const monthly = entry.amounts.reduce((sum, value) => sum + value, 0) / entry.amounts.length;
      const inBudget = planLines.some((line) => lineMatchesTransaction(entry.sample, line));
      const dates = [...entry.dates].sort();
      const lastSeen = dates[dates.length - 1];
      const daysSinceSeen = (latestTime - new Date(`${lastSeen}T12:00:00`).getTime()) / 86400000;
      return {
        id: name,
        name,
        category: entry.sample.category,
        subcategory: entry.sample.subcategory,
        monthly,
        inBudget,
        firstSeen: dates[0],
        lastSeen,
        activeAsOf: latestDate,
        active: daysSinceSeen <= 45,
      };
    })
    .sort((a, b) => b.monthly - a.monthly);
}

const REVIEW_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'at',
  'bill',
  'card',
  'checkcard',
  'co',
  'com',
  'company',
  'corp',
  'debit',
  'from',
  'inc',
  'llc',
  'online',
  'pay',
  'payment',
  'pos',
  'purchase',
  'store',
  'the',
  'to',
  'transaction',
  'web',
  'www',
]);

const REVIEW_WEAK_TOKENS = new Set(['apple', 'cash', 'card', 'pay', 'paypal', 'venmo', 'zelle']);

function reviewTokens(item: string) {
  return item
    .toLowerCase()
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, ' ')
    .replace(/\b\d{4,}\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1 && !REVIEW_STOP_WORDS.has(token));
}

function merchantKey(item: string) {
  return item
    .toLowerCase()
    .replace(/\b\d{1,2}\/\d{1,2}\b/g, ' ')
    .replace(/\b\d{4,}\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(inc|llc|store|payment|online|transfer|to|from|the|bill|com)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fuzzyReviewScore(base: StoredTransaction, candidate: StoredTransaction) {
  const exactish = merchantKey(base.item) === merchantKey(candidate.item) && merchantKey(base.item).length > 0;
  const baseTokens = new Set(reviewTokens(base.item));
  const candidateTokens = new Set(reviewTokens(candidate.item));
  if (baseTokens.size === 0 || candidateTokens.size === 0) return exactish ? 1 : 0;

  const shared = Array.from(baseTokens).filter((token) => candidateTokens.has(token));
  const unionSize = new Set([...baseTokens, ...candidateTokens]).size;
  const sharedStrong = shared.some((token) => !REVIEW_WEAK_TOKENS.has(token));
  const jaccard = shared.length / Math.max(unionSize, 1);
  const subset = shared.length / Math.max(Math.min(baseTokens.size, candidateTokens.size), 1);
  const amountDiff = Math.abs(Math.abs(base.amount) - Math.abs(candidate.amount));
  const amountScale = Math.max(Math.abs(base.amount), Math.abs(candidate.amount), 1);
  const amountCloseness = Math.max(0, 1 - amountDiff / amountScale);
  if (shared.length > 0 && !sharedStrong) {
    return amountCloseness >= 0.9 ? amountCloseness * 0.95 : 0;
  }
  return Math.max(
    exactish ? 0.92 : 0,
    jaccard * 0.45 + subset * 0.35 + amountCloseness * 0.2
  );
}

function isLocalReviewNeeded(transaction: StoredTransaction) {
  return (
    transaction.source !== 'sample' &&
    transaction.type === 'expense' &&
    (!transaction.category || transaction.category === 'Uncategorized')
  );
}

function buildCategoryOptions(planLines: PlanLine[], transactions: StoredTransaction[]): CategoryOption[] {
  const groups = new Map<string, Set<string>>();
  const add = (category: string, subcategory?: string | null) => {
    if (!category || category === 'Uncategorized') return;
    const entry = groups.get(category) ?? new Set<string>();
    if (subcategory) entry.add(subcategory);
    groups.set(category, entry);
  };

  for (const line of planLines) add(line.section, line.name);
  for (const transaction of transactions) add(transaction.category, transaction.subcategory);
  add('Income');
  add('Transfers', 'Transfers');

  return Array.from(groups.entries())
    .map(([category, subcategories]) => ({
      category,
      subcategories: Array.from(subcategories).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

export default function TransactionsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const {
    transactions: storeTransactions,
    planLines,
    setPlanLines,
    addTransactions,
    updateTransaction,
    deleteTransaction,
    cancelFlags,
    setCancelFlags,
    setTransactionEdits,
    resolvedReviewIds,
    markReviewResolved,
    guessCategory,
  } = useFinance();
  const [active, setActive] = useState('feed');
  const [reviewItems, setReviewItems] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<CategoryWithSubcategories[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, CategorizationSuggestion>>({});
  const [reviewOpen, setReviewOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<TransactionEditorDraft | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [lastImport, setLastImport] = useState<string | null>(null);
  const [transferReviewQueue, setTransferReviewQueue] = useState<StoredTransaction[]>([]);
  const [localReviewOpen, setLocalReviewOpen] = useState(false);
  const [similarReview, setSimilarReview] = useState<SimilarReviewState>(null);
  const [showHistoricalSubscriptions, setShowHistoricalSubscriptions] = useState(false);
  const [showFormatHelp, setShowFormatHelp] = useState(false);
  const [showRecent, setShowRecent] = useState(false);

  const subscriptions = useMemo(
    () => detectSubscriptions(storeTransactions, planLines),
    [storeTransactions, planLines]
  );
  const activeSubscriptions = subscriptions.filter((subscription) => subscription.active);
  const historicalSubscriptions = subscriptions.filter((subscription) => !subscription.active);
  const visibleSubscriptions = showHistoricalSubscriptions ? historicalSubscriptions : activeSubscriptions;
  const monthlyBurn = activeSubscriptions.reduce((sum, subscription) => sum + subscription.monthly, 0);
  const categoryOptions = useMemo(
    () => buildCategoryOptions(planLines, storeTransactions),
    [planLines, storeTransactions]
  );

  // Review decisions persist: anything already resolved stays off the radar.
  const pendingReview = useMemo(() => {
    const resolved = new Set(resolvedReviewIds);
    return reviewItems.filter((transaction) => !resolved.has(transaction.id));
  }, [reviewItems, resolvedReviewIds]);

  const userEntries = useMemo(
    () =>
      storeTransactions
        .filter((transaction) => transaction.source !== 'sample')
        .sort((a, b) => b.date.localeCompare(a.date)),
    [storeTransactions]
  );

  const localReviewItems = useMemo(
    () =>
      storeTransactions
        .filter(isLocalReviewNeeded)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [storeTransactions]
  );
  const radarCount = pendingReview.length + localReviewItems.length;
  const sortedCount = resolvedReviewIds.length + userEntries.length - localReviewItems.length;

  const loadFeed = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [loadedCategories, loadedTransactions] = await Promise.all([
        financeDataService.listCategories(),
        financeDataService.listTransactionsNeedingReview(),
      ]);
      const loadedSuggestions = await Promise.all(
        loadedTransactions.map(async (transaction) => {
          try {
            return await categorizationService.suggestCategory(transaction);
          } catch {
            return null;
          }
        })
      );

      setCategories(loadedCategories);
      setReviewItems(loadedTransactions);
      setSuggestions(
        Object.fromEntries(
          loadedSuggestions
            .filter((suggestion): suggestion is CategorizationSuggestion => suggestion !== null)
            .map((suggestion) => [suggestion.transactionId, suggestion])
        )
      );
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => void loadFeed(), 0);
    return () => clearTimeout(timeout);
  }, [loadFeed]);

  const openManualEditor = (transaction?: StoredTransaction) => {
    setEditor({
      mode: 'manual',
      title: transaction ? 'Edit entry' : 'Add manual transaction',
      id: transaction?.id,
      date: transaction?.date ?? new Date().toISOString().slice(0, 10),
      merchantName: transaction?.item ?? '',
      category: transaction?.category ?? 'Uncategorized',
      amount: transaction ? String(Math.abs(transaction.amount)) : '',
      kind:
        transaction?.type === 'income'
          ? 'income'
          : transaction?.type === 'transfer'
            ? 'transfer'
            : 'expense',
    });
  };

  const saveEditor = () => {
    if (!editor) return;
    const amount = Math.abs(Number(editor.amount.replace(/[^0-9.]/g, '')) || 0);
    const merchantName = editor.merchantName.trim() || 'Untitled transaction';
    const category = editor.category.trim() || 'Uncategorized';

    if (editor.mode === 'manual') {
      const isExpense = editor.kind === 'expense';
      const isTransfer = editor.kind === 'transfer';
      const next: StoredTransaction = {
        id: editor.id ?? `manual-${Date.now()}`,
        date: editor.date || new Date().toISOString().slice(0, 10),
        item: merchantName,
        moneyIn: isExpense || isTransfer ? 0 : amount,
        moneyOut: isExpense || isTransfer ? amount : 0,
        amount: isExpense || isTransfer ? -amount : amount,
        category: isTransfer ? 'Transfers' : isExpense ? category : 'Income',
        subcategory: isTransfer ? 'Transfers' : null,
        type: isTransfer ? 'transfer' : isExpense ? 'expense' : 'income',
        source: 'manual',
      };
      if (editor.id) {
        updateTransaction(editor.id, next);
      } else {
        addTransactions([next]);
      }
    } else if (editor.sourceId) {
      setTransactionEdits((current) => ({
        ...current,
        [editor.sourceId!]: { merchantName, category, amount: Number(editor.amount.replace(/[^0-9.-]/g, '')) || 0 },
      }));
    }

    setEditor(null);
  };

  const deleteManual = () => {
    if (!editor?.id) return;
    deleteTransaction(editor.id);
    setEditor(null);
  };

  const importCsv = async () => {
    setImportError(null);
    try {
      const preview = await pickImportPreview(storeTransactions, guessCategory);
      if (!preview) return;
      if ('error' in preview) {
        setImportError(preview.error);
        return;
      }
      if (preview.total === 0) {
        setImportError(
          preview.duplicates > 0
            ? 'Every row in that file is already imported.'
            : "Penny couldn't find any transactions in that file."
        );
        return;
      }
      setImportPreview(preview);
    } catch (importFailure) {
      if (importFailureNeedsRebuild(importFailure)) {
        setImportError(
          'This app build is missing the file picker and needs one rebuild (eas build --profile development-device). Until then, imports work on the web version, but each device keeps its own local data for now.'
        );
        return;
      }
      setImportError("Couldn't read that file. Check that it's a CSV or Excel export from your bank.");
    }
  };

  const confirmImport = () => {
    if (!importPreview) return;
    addTransactions(importPreview.transactions);
    const importedTransfers = importPreview.transactions.filter(
      (transaction) => transaction.type === 'transfer'
    );
    setTransferReviewQueue(importedTransfers);
    setLastImport(
      `${importPreview.total} transactions imported` +
        (importPreview.duplicates > 0 ? ` · ${importPreview.duplicates} duplicates skipped` : '') +
        (importPreview.uncategorized > 0
          ? ` · ${importPreview.uncategorized} need a category (tap them below to fix)`
          : '')
    );
    setImportPreview(null);
  };

  const addReviewCategory = (categoryName: string, subcategoryName: string | null) => {
    const category = categoryName.trim();
    const subcategory = subcategoryName?.trim() || 'General';
    if (!category) return;

    setPlanLines((current) => {
      const exists = current.some(
        (line) =>
          line.section.toLowerCase() === category.toLowerCase() &&
          line.name.toLowerCase() === subcategory.toLowerCase()
      );
      if (exists) return current;
      return [
        ...current,
        {
          id: `${category}::${subcategory}-${Date.now()}`,
          section: category,
          name: subcategory,
          type: 'fixed',
          amount: 0,
          method: 'avg6',
        },
      ];
    });
  };

  const closeLocalReview = () => {
    Keyboard.dismiss();
    setTimeout(() => setLocalReviewOpen(false), Platform.OS === 'ios' ? 80 : 0);
  };

  const applyLocalCategory = (
    transaction: StoredTransaction,
    category: string,
    subcategory: string | null,
    allowSimilar = true
  ) => {
    const candidates = allowSimilar
      ? localReviewItems
          .filter((candidate) => candidate.id !== transaction.id)
          .map((candidate) => ({
            transaction: candidate,
            score: fuzzyReviewScore(transaction, candidate),
          }))
          .filter((candidate) => candidate.score >= 0.34)
          .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return (
              Math.abs(Math.abs(a.transaction.amount) - Math.abs(transaction.amount)) -
              Math.abs(Math.abs(b.transaction.amount) - Math.abs(transaction.amount))
            );
          })
          .slice(0, 75)
      : [];

    updateTransaction(transaction.id, {
      category,
      subcategory,
      type: category === 'Transfers' ? 'transfer' : transaction.type,
    });

    if (candidates.length > 0) {
      const nextSimilarReview = { base: transaction, category, subcategory, candidates };
      Keyboard.dismiss();
      setLocalReviewOpen(false);
      setTimeout(() => setSimilarReview(nextSimilarReview), Platform.OS === 'ios' ? 350 : 120);
    }
  };

  const applySimilarCategories = (ids: string[]) => {
    if (!similarReview) return;
    const reviewed = similarReview;
    for (const id of ids) {
      updateTransaction(id, {
        category: reviewed.category,
        subcategory: reviewed.subcategory,
        type: reviewed.category === 'Transfers' ? 'transfer' : 'expense',
      });
    }
    setSimilarReview(null);
    setTimeout(() => setLocalReviewOpen(true), Platform.OS === 'ios' ? 300 : 120);
  };

  const closeSimilarReview = () => {
    setSimilarReview(null);
    setTimeout(() => setLocalReviewOpen(true), Platform.OS === 'ios' ? 300 : 120);
  };

  return (
    <Screen
      eyebrow="Activity"
      title="Transactions"
      subtitle="Synced activity and recurring charges"
      mascot={<PennyBadge expression={radarCount === 0 ? 'celebrating' : 'thinking'} />}
      segments={SEGMENTS}
      active={active}
      onSelect={setActive}>
      {active === 'feed' ? (
        <ScrollView
          style={styles.panel}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadFeed('refresh')}
              tintColor={theme.primary}
            />
          }>
          <FadeInUp>
            <Card style={[styles.radarCard, radarCount > 0 && { borderColor: theme.primary }]}>
              <View style={styles.radarHead}>
                <PennyBadge
                  expression={radarCount === 0 ? 'celebrating' : 'thinking'}
                  size={54}
                  animated={false}
                />
                <View style={styles.manualCopy}>
                  <ThemedText type="section">
                    {radarCount === 0
                      ? 'Radar is clear'
                      : `${radarCount} ${radarCount === 1 ? 'transaction' : 'transactions'} on radar`}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {radarCount === 0
                      ? `${Math.max(0, sortedCount)} sorted. New imports land here when they need a category.`
                      : 'Sort them here. Penny remembers every fix you make.'}
                  </ThemedText>
                </View>
              </View>
              {radarCount > 0 ? (
                <PillButton
                  tone="primary"
                  onPress={() =>
                    localReviewItems.length > 0 ? setLocalReviewOpen(true) : setReviewOpen(true)
                  }>
                  Start reviewing
                </PillButton>
              ) : (
                <View style={styles.statusRow}>
                  <Pill label={`${Math.max(0, sortedCount)} sorted`} tone="good" />
                  <Pill label={`${userEntries.length} entries in reports`} tone="muted" />
                </View>
              )}
            </Card>
          </FadeInUp>

          <FadeInUp delay={80}>
            <Card style={styles.manualCard}>
              <View style={styles.manualTop}>
                <View style={styles.manualCopy}>
                  <ThemedText type="smallBold">Manual & imported</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Import a CSV or Excel export from your bank, or add cash and Venmo by hand.
                    Everything goes into your reports and the Logbook. This tab is for reviewing.
                  </ThemedText>
                </View>
              </View>
              <View style={styles.importActions}>
                <PillButton tone="primary" onPress={() => void importCsv()}>
                  Import bank file
                </PillButton>
                <PillButton onPress={() => openManualEditor()}>Add by hand</PillButton>
              </View>
              {importError ? (
                <ThemedText type="small" style={{ color: theme.danger }}>
                  {importError}
                </ThemedText>
              ) : null}
              {lastImport ? (
                <ThemedText type="small" style={{ color: theme.success }}>
                  {lastImport}
                </ThemedText>
              ) : null}

              <Pressable
                onPress={() => setShowFormatHelp((value) => !value)}
                style={styles.disclosureRow}>
                <ThemedText type="smallBold" style={{ color: theme.secondary }}>
                  What does the file need?
                </ThemedText>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {showFormatHelp ? '⌃' : '⌄'}
                </ThemedText>
              </Pressable>
              {showFormatHelp ? (
                <View style={[styles.formatHelp, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText type="small">
                    A CSV, XLS, or XLSX export with a header row and these columns. Most bank
                    exports already match.
                  </ThemedText>
                  <ThemedText type="small">
                    <ThemedText type="smallBold">1. Date:</ThemedText> called Date, Transaction
                    Date, Posted Date, or Posting Date.
                  </ThemedText>
                  <ThemedText type="small">
                    <ThemedText type="smallBold">2. Description:</ThemedText> called Description,
                    Merchant, Name, Payee, or Memo.
                  </ThemedText>
                  <ThemedText type="small">
                    <ThemedText type="smallBold">3. Amount:</ThemedText> either one signed Amount
                    column (negative = spent), or two columns like Debit/Credit, Money Out/Money
                    In, or Withdrawal/Deposit.
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Penny ignores extra columns and skips duplicates. The file never leaves this
                    device.
                  </ThemedText>
                </View>
              ) : null}

              {userEntries.length > 0 ? (
                <>
                  <Pressable
                    onPress={() => setShowRecent((value) => !value)}
                    style={styles.disclosureRow}>
                    <ThemedText type="smallBold" style={{ color: theme.secondary }}>
                      Recent entries ({userEntries.length})
                    </ThemedText>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      {showRecent ? '⌃' : '⌄'}
                    </ThemedText>
                  </Pressable>
                  {showRecent
                    ? userEntries.slice(0, 8).map((transaction) => (
                        <Pressable
                          key={transaction.id}
                          onPress={() => openManualEditor(transaction)}
                          style={({ pressed }) => [
                            styles.manualRow,
                            { borderTopColor: theme.border, opacity: pressed ? 0.72 : 1 },
                          ]}>
                          <View style={styles.feedCopy}>
                            <ThemedText type="smallBold" numberOfLines={1}>
                              {transaction.item}
                            </ThemedText>
                            <ThemedText
                              type="small"
                              themeColor={
                                transaction.category === 'Uncategorized' ? 'warning' : 'textSecondary'
                              }
                              numberOfLines={1}>
                              {dayLabel(transaction.date)} · {transaction.category}
                              {transaction.source === 'import' ? ' · imported' : ''}
                            </ThemedText>
                          </View>
                          <ThemedText type="money" style={styles.feedAmount}>
                            {formatTransactionMoney(transaction.amount)}
                          </ThemedText>
                        </Pressable>
                      ))
                    : null}
                  {showRecent ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      Tap an entry to fix it. The full history is in the Logbook.
                    </ThemedText>
                  ) : null}
                </>
              ) : null}
            </Card>
          </FadeInUp>

          {error ? (
            <Card style={styles.gap}>
              <SpeechBubble expression="concerned">{emptyStates.syncFailed}</SpeechBubble>
              <ThemedText type="small" themeColor="textSecondary">
                {error}
              </ThemedText>
              <PillButton onPress={() => void loadFeed('refresh')}>Try again</PillButton>
            </Card>
          ) : null}

          {loading ? (
            <Card style={styles.loadingCard}>
              <ActivityIndicator color={theme.primary} />
              <ThemedText type="smallBold">Loading transactions…</ThemedText>
            </Card>
          ) : null}

          {!loading && radarCount === 0 && !error ? (
            <SpeechBubble expression="celebrating">{emptyStates.allReviewed}</SpeechBubble>
          ) : null}
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.panel}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}>
          <Card style={[styles.burnCard, { borderColor: theme.primary }]}>
            <ThemedText type="small" themeColor="textSecondary">
              Active subscriptions · monthly total
            </ThemedText>
            <ThemedText type="hero" style={[styles.burnValue, { color: theme.primary }]}>
              {formatMoney(monthlyBurn)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {activeSubscriptions.length} active {activeSubscriptions.length === 1 ? 'charge' : 'charges'} ·{' '}
              {formatMoney(monthlyBurn * 12)}/yr
            </ThemedText>
            <View style={styles.importActions}>
              <ToggleChip
                label="Active"
                selected={!showHistoricalSubscriptions}
                onPress={() => setShowHistoricalSubscriptions(false)}
              />
              <ToggleChip
                label={`Historical (${historicalSubscriptions.length})`}
                selected={showHistoricalSubscriptions}
                onPress={() => setShowHistoricalSubscriptions(true)}
              />
            </View>
          </Card>

          {visibleSubscriptions.length === 0 ? (
            <SpeechBubble expression="thinking">
              {showHistoricalSubscriptions ? 'No historical subscriptions yet.' : emptyStates.noSubscriptions}
            </SpeechBubble>
          ) : (
            visibleSubscriptions.map((subscription) => (
              <Card key={subscription.id} style={styles.subscriptionCard}>
                <View style={styles.subscriptionTop}>
                  <View style={styles.subscriptionCopy}>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {subscription.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {subscription.category}
                      {subscription.subcategory ? ` · ${subscription.subcategory}` : ''}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {subscription.active
                        ? `Active as of ${dayLabel(subscription.activeAsOf)}`
                        : `${dayLabel(subscription.firstSeen)} to ${dayLabel(subscription.lastSeen)}`}
                    </ThemedText>
                  </View>
                  <ThemedText type="money" style={{ fontSize: 17 }}>
                    {formatMoney(subscription.monthly)}/mo
                  </ThemedText>
                </View>
                {subscription.active ? (
                  <View style={styles.subscriptionActions}>
                    <ToggleChip
                      label={
                        cancelFlags[subscription.id] ? 'Cancel reminder set ✓' : 'Remind me to cancel'
                      }
                      selected={!!cancelFlags[subscription.id]}
                      onPress={() =>
                        setCancelFlags((current) => ({
                          ...current,
                          [subscription.id]: !current[subscription.id],
                        }))
                      }
                    />
                    {!subscription.inBudget ? (
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: '/budget',
                            params: {
                              addName: subscription.name,
                              addAmount: String(Math.round(subscription.monthly * 100) / 100),
                            },
                          })
                        }
                        style={({ pressed }) => [
                          styles.budgetFlag,
                          { borderColor: theme.warning, opacity: pressed ? 0.7 : 1 },
                        ]}>
                        <ThemedText type="small" style={{ color: theme.warning }} numberOfLines={1}>
                          Not in current budget · Add to Plan →
                        </ThemedText>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </Card>
            ))
          )}

          <SpeechBubble expression="default">
            Subscriptions you forgot about add up fast. Flag anything you don&apos;t
            recognize.
          </SpeechBubble>
        </ScrollView>
      )}

      <ReviewModal
        visible={reviewOpen}
        onClose={() => setReviewOpen(false)}
        transactions={pendingReview}
        categories={categories}
        suggestions={suggestions}
        sortedCount={resolvedReviewIds.length}
        onResolved={(id) => markReviewResolved(id)}
        onSkip={(id) => {
          setReviewItems((current) => {
            const index = current.findIndex((transaction) => transaction.id === id);
            if (index === -1) return current;
            return [...current.slice(0, index), ...current.slice(index + 1), current[index]];
          });
        }}
        onError={setError}
      />
      <LocalReviewModal
        visible={localReviewOpen}
        transactions={localReviewItems}
        categoryOptions={categoryOptions}
        onClose={() => setLocalReviewOpen(false)}
        onSave={(transaction, category, subcategory) =>
          applyLocalCategory(transaction, category, subcategory)
        }
        onAddCategory={addReviewCategory}
        onSkip={closeLocalReview}
      />
      <SimilarReviewModal
        state={similarReview}
        onClose={closeSimilarReview}
        onApply={applySimilarCategories}
      />
      <TransactionEditorModal
        draft={editor}
        onChange={setEditor}
        onClose={() => setEditor(null)}
        onSave={saveEditor}
        onDelete={editor?.mode === 'manual' && editor.id ? deleteManual : undefined}
      />
      <TransferReviewModal
        queue={transferReviewQueue}
        onAdvance={() => setTransferReviewQueue((current) => current.slice(1))}
        onConvert={(transaction, kind) => {
          const amount = Math.abs(transaction.amount);
          updateTransaction(transaction.id, {
            type: kind,
            category: kind === 'income' ? 'Income' : 'Uncategorized',
            subcategory: null,
            moneyIn: kind === 'income' ? amount : 0,
            moneyOut: kind === 'expense' ? amount : 0,
            amount: kind === 'income' ? amount : -amount,
          });
          setTransferReviewQueue((current) => current.slice(1));
        }}
        onAddRelated={(transaction) => {
          openManualEditor();
          setEditor((current) =>
            current
              ? {
                  ...current,
                  title: 'Add related transaction',
                  date: transaction.date,
                  amount: String(Math.abs(transaction.amount)),
                }
              : current
          );
          setTransferReviewQueue((current) => current.slice(1));
        }}
      />
      <Modal
        visible={importPreview !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setImportPreview(null)}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.reviewSheet,
              { backgroundColor: theme.backgroundElement, borderColor: theme.borderStrong },
            ]}>
            <ThemedText type="section">Ready to import</ThemedText>
            {importPreview ? (
              <>
                <ThemedText type="smallBold">
                  {importPreview.total} transactions
                  {importPreview.dateRange
                    ? ` · ${dayLabel(importPreview.dateRange.from)} → ${dayLabel(importPreview.dateRange.to)}`
                    : ''}
                </ThemedText>
                {importPreview.duplicates > 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {importPreview.duplicates} already imported, so Penny will skip them.
                  </ThemedText>
                ) : null}
                {importPreview.uncategorized > 0 ? (
                  <ThemedText type="small" themeColor="warning">
                    {importPreview.uncategorized} new merchants Penny couldn&apos;t categorize yet.
                    They&apos;ll come in as Uncategorized for you to fix.
                  </ThemedText>
                ) : null}
                {importPreview.warnings.map((warning) => (
                  <ThemedText key={warning} type="small" themeColor="textSecondary">
                    {warning}
                  </ThemedText>
                ))}
                <SpeechBubble expression="happy">
                  Penny reads this file right on your device. It never gets uploaded.
                </SpeechBubble>
                <View style={styles.importActions}>
                  <PillButton tone="primary" onPress={confirmImport}>
                    Import {importPreview.total}
                  </PillButton>
                  <PillButton onPress={() => setImportPreview(null)}>Cancel</PillButton>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

/**
 * Quizlet-style review: one card at a time, full-intent buttons. Nothing in the
 * feed can be confirmed by a stray tap — approving always happens here.
 */
function ReviewModal({
  visible,
  onClose,
  transactions,
  categories,
  suggestions,
  sortedCount,
  onResolved,
  onSkip,
  onError,
}: {
  visible: boolean;
  onClose: () => void;
  transactions: Transaction[];
  categories: CategoryWithSubcategories[];
  suggestions: Record<string, CategorizationSuggestion>;
  sortedCount: number;
  onResolved: (transactionId: string) => void;
  onSkip: (transactionId: string) => void;
  onError: (message: string) => void;
}) {
  const theme = useTheme();
  const current = transactions[0] ?? null;
  const total = transactions.length + sortedCount;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.reviewSheet,
            { backgroundColor: theme.backgroundElement, borderColor: theme.borderStrong },
          ]}>
          <View style={styles.reviewHeader}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {current ? `Reviewing ${sortedCount + 1} of ${total}` : 'All sorted'}
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={10}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.closeGlyph}>
                ✕
              </ThemedText>
            </Pressable>
          </View>

          {current ? (
            // Keyed by transaction so each card starts fresh from Penny's suggestion.
            <ReviewCard
              key={current.id}
              transaction={current}
              suggestion={suggestions[current.id]}
              categories={categories}
              canSkip={transactions.length > 1}
              onSkip={() => onSkip(current.id)}
              onResolved={() => onResolved(current.id)}
              onError={onError}
            />
          ) : (
            <>
              <View style={styles.doneBody}>
                <PennyBadge expression="celebrating" animated={false} />
                <ThemedText type="section" style={styles.doneTitle}>
                  Every transaction sorted
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.doneTitle}>
                  {sortedCount} reviewed this session. Penny remembers your corrections.
                </ThemedText>
              </View>
              <View style={styles.reviewControls}>
                <PillButton tone="primary" onPress={onClose}>
                  Done
                </PillButton>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function ReviewCard({
  transaction,
  suggestion,
  categories,
  canSkip,
  onSkip,
  onResolved,
  onError,
}: {
  transaction: Transaction;
  suggestion: CategorizationSuggestion | undefined;
  categories: CategoryWithSubcategories[];
  canSkip: boolean;
  onSkip: () => void;
  onResolved: () => void;
  onError: (message: string) => void;
}) {
  const theme = useTheme();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    suggestion?.categoryId ?? null
  );
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(
    suggestion?.subcategoryId ?? null
  );
  const [rememberMerchant, setRememberMerchant] = useState(true);
  const [saving, setSaving] = useState(false);

  const current = transaction;
  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ?? null;
  const confidence = confidenceDisplay[suggestion?.confidence ?? 'none'];

  const approve = async () => {
    if (!selectedCategoryId) return;
    setSaving(true);

    try {
      if (
        suggestion &&
        suggestion.categoryId === selectedCategoryId &&
        suggestion.subcategoryId === selectedSubcategoryId
      ) {
        await categorizationService.confirmCategory({
          ...suggestion,
          confidence: suggestion.confidence === 'none' ? 'medium' : suggestion.confidence,
        });
      } else {
        await categorizationService.overrideCategory({
          transactionId: current.id,
          categoryId: selectedCategoryId,
          subcategoryId: selectedSubcategoryId,
          rememberMerchant,
        });
      }
      onResolved();
    } catch (saveError) {
      onError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ScrollView style={styles.reviewScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.reviewBody}>
          <View style={styles.reviewTop}>
            <View style={styles.reviewCopy}>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {dayLabel(current.date)}
              </ThemedText>
              <ThemedText type="section" numberOfLines={2}>
                {current.merchantName}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {current.originalDescription}
              </ThemedText>
            </View>
            <ThemedText type="money" style={styles.reviewAmount}>
              {formatTransactionMoney(current.amount)}
            </ThemedText>
          </View>

          <View style={[styles.guessBox, { backgroundColor: theme.backgroundSelected }]}>
            <View style={styles.guessTop}>
              <ThemedText type="small" themeColor="textSecondary">
                Penny&apos;s guess
              </ThemedText>
              <Pill label={confidence.label} tone={confidence.tone} />
            </View>
            <ThemedText type="smallBold" numberOfLines={2}>
              {selectedCategory
                ? `${selectedCategory.name}${
                    selectedCategory.subcategories.find(
                      (entry) => entry.id === selectedSubcategoryId
                    )?.name
                      ? ` › ${
                          selectedCategory.subcategories.find(
                            (entry) => entry.id === selectedSubcategoryId
                          )?.name
                        }`
                      : ''
                  }`
                : 'Choose a category below'}
            </ThemedText>
          </View>

          <CategorySelector
            label="Category"
            options={categories.map((category) => category.name)}
            value={selectedCategory?.name ?? ''}
            onChange={(value) => {
              const next = categories.find((category) => category.name === value);
              setSelectedCategoryId(next?.id ?? null);
              setSelectedSubcategoryId(next?.subcategories[0]?.id ?? null);
            }}
          />

          {selectedCategory && selectedCategory.subcategories.length > 0 ? (
            <CategorySelector
              label="Subcategory"
              options={selectedCategory.subcategories.map((subcategory) => subcategory.name)}
              value={
                selectedCategory.subcategories.find((entry) => entry.id === selectedSubcategoryId)
                  ?.name ?? ''
              }
              onChange={(value) => {
                const next = selectedCategory.subcategories.find(
                  (subcategory) => subcategory.name === value
                );
                setSelectedSubcategoryId(next?.id ?? null);
              }}
            />
          ) : null}

          <View style={styles.rememberRow}>
            <View style={styles.rememberCopy}>
              <ThemedText type="smallBold">Remember this merchant</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Use this category automatically next time.
              </ThemedText>
            </View>
            <ToggleChip
              label={rememberMerchant ? 'On' : 'Off'}
              selected={rememberMerchant}
              onPress={() => setRememberMerchant((value) => !value)}
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.reviewControls}>
        <PillButton
          tone="primary"
          disabled={saving || !selectedCategoryId}
          onPress={() => void approve()}>
          {saving ? 'Saving…' : 'Looks right'}
        </PillButton>
        <PillButton disabled={saving || !canSkip} onPress={onSkip}>
          Skip
        </PillButton>
      </View>
    </>
  );
}

function TransferReviewModal({
  queue,
  onAdvance,
  onConvert,
  onAddRelated,
}: {
  queue: StoredTransaction[];
  onAdvance: () => void;
  onConvert: (transaction: StoredTransaction, kind: 'expense' | 'income') => void;
  onAddRelated: (transaction: StoredTransaction) => void;
}) {
  const theme = useTheme();
  const current = queue[0] ?? null;

  return (
    <Modal visible={current !== null} transparent animationType="fade" onRequestClose={onAdvance}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.editorSheet,
            { backgroundColor: theme.backgroundElement, borderColor: theme.borderStrong },
          ]}>
          <View style={styles.editorHead}>
            <PennyBadge expression="thinking" size={54} animated={false} />
            <View style={styles.manualCopy}>
              <ThemedText type="section">Review transfer</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Transfers move money between accounts, so Penny keeps them out of spending unless
                you say otherwise.
              </ThemedText>
            </View>
          </View>

          {current ? (
            <View style={[styles.transferBox, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold" numberOfLines={2}>
                {current.item}
              </ThemedText>
              <ThemedText type="money">{formatTransactionMoney(current.amount)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {dayLabel(current.date)} · possible transfer {queue.length > 1 ? `· ${queue.length} left` : ''}
              </ThemedText>
            </View>
          ) : null}

          {current ? (
            <View style={styles.editorActions}>
              <PillButton tone="primary" onPress={onAdvance}>
                Keep as transfer
              </PillButton>
              <PillButton onPress={() => onConvert(current, 'expense')}>Make expense</PillButton>
              <PillButton onPress={() => onConvert(current, 'income')}>Make income</PillButton>
              <PillButton onPress={() => onAddRelated(current)}>Add related transaction</PillButton>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function LocalReviewModal({
  visible,
  transactions,
  categoryOptions,
  onClose,
  onSave,
  onAddCategory,
  onSkip,
}: {
  visible: boolean;
  transactions: StoredTransaction[];
  categoryOptions: CategoryOption[];
  onClose: () => void;
  onSave: (transaction: StoredTransaction, category: string, subcategory: string | null) => void;
  onAddCategory: (category: string, subcategory: string | null) => void;
  onSkip: () => void;
}) {
  const theme = useTheme();
  const current = transactions[0] ?? null;
  const closeReview = () => {
    Keyboard.dismiss();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closeReview}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalKeyboard}>
        <View style={styles.modalOverlay}>
        <View
          style={[
            styles.reviewSheet,
            { backgroundColor: theme.backgroundElement, borderColor: theme.borderStrong },
          ]}>
          <View style={styles.reviewHeader}>
            <ThemedText type="section">Review imported transaction</ThemedText>
            <Pressable onPress={closeReview} hitSlop={10}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.closeGlyph}>
                ✕
              </ThemedText>
            </Pressable>
          </View>
          {current ? (
            <LocalReviewBody
              key={current.id}
              transaction={current}
              count={transactions.length}
              categoryOptions={categoryOptions}
              onSave={onSave}
              onAddCategory={onAddCategory}
              onSkip={onSkip}
            />
          ) : (
            <>
              <SpeechBubble expression="celebrating">Radar is clear. Every import has a category.</SpeechBubble>
              <PillButton tone="primary" onPress={onClose}>Done</PillButton>
            </>
          )}
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function LocalReviewBody({
  transaction,
  count,
  categoryOptions,
  onSave,
  onAddCategory,
  onSkip,
}: {
  transaction: StoredTransaction;
  count: number;
  categoryOptions: CategoryOption[];
  onSave: (transaction: StoredTransaction, category: string, subcategory: string | null) => void;
  onAddCategory: (category: string, subcategory: string | null) => void;
  onSkip: () => void;
}) {
  const theme = useTheme();
  const first = categoryOptions.find((option) => option.category !== 'Income');
  const [category, setCategory] = useState(first?.category ?? '');
  const [subcategory, setSubcategory] = useState<string | null>(first?.subcategories[0] ?? null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newSubcategory, setNewSubcategory] = useState('');
  const selectedOption = categoryOptions.find((option) => option.category === category);

  const saveNewCategory = () => {
    const cleanCategory = newCategory.trim();
    const cleanSubcategory = newSubcategory.trim();
    if (!cleanCategory) return;
    onAddCategory(cleanCategory, cleanSubcategory || null);
    setCategory(cleanCategory);
    setSubcategory(cleanSubcategory || 'General');
    setNewCategory('');
    setNewSubcategory('');
    setAddingCategory(false);
  };
  const pauseReview = () => {
    Keyboard.dismiss();
    onSkip();
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.reviewScroll}
      contentContainerStyle={styles.reviewBody}>
      <View style={[styles.transferBox, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="small" themeColor="textSecondary">
          {count} left on radar
        </ThemedText>
        <ThemedText type="smallBold" numberOfLines={2}>
          {transaction.item}
        </ThemedText>
        <ThemedText type="money">{formatTransactionMoney(transaction.amount)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {dayLabel(transaction.date)}
        </ThemedText>
      </View>

      <CategorySelector
        label="Category"
        options={categoryOptions.map((option) => option.category)}
        value={category}
        onChange={(value) => {
          const next = categoryOptions.find((option) => option.category === value);
          setCategory(value);
          setSubcategory(next?.subcategories[0] ?? null);
        }}
      />
      {selectedOption && selectedOption.subcategories.length > 0 ? (
        <CategorySelector
          label="Subcategory"
          options={selectedOption.subcategories}
          value={subcategory ?? ''}
          onChange={setSubcategory}
        />
      ) : null}

      {addingCategory ? (
        <View style={[styles.addCategoryBox, { borderColor: theme.border }]}>
          <EditorField
            label="New category"
            value={newCategory}
            onChangeText={setNewCategory}
            placeholder="Food, Kids, Pets..."
          />
          <EditorField
            label="New subcategory"
            value={newSubcategory}
            onChangeText={setNewSubcategory}
            placeholder="Groceries, Daycare, Vet..."
          />
          <View style={styles.editorActions}>
            <PillButton tone="primary" disabled={!newCategory.trim()} onPress={saveNewCategory}>
              Add and use
            </PillButton>
            <PillButton onPress={() => setAddingCategory(false)}>Cancel</PillButton>
          </View>
        </View>
      ) : (
        <PillButton onPress={() => setAddingCategory(true)}>Add category/subcategory</PillButton>
      )}

      <View style={styles.editorActions}>
        <PillButton
          tone="primary"
          disabled={!category}
          onPress={() => onSave(transaction, category, subcategory)}>
          Save category
        </PillButton>
        <PillButton onPress={pauseReview}>Pause review</PillButton>
      </View>
    </ScrollView>
  );
}

function CategorySelector({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.editorField}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <Pressable
        onPress={() => setOpen((current) => !current)}
        style={[
          styles.dropdownButton,
          { borderColor: theme.border, backgroundColor: theme.background },
        ]}>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.dropdownValue}>
          {value || 'Choose...'}
        </ThemedText>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {open ? '⌃' : '⌄'}
        </ThemedText>
      </Pressable>
      {open ? (
        <ScrollView
          nestedScrollEnabled
          style={[styles.dropdownList, { borderColor: theme.border, backgroundColor: theme.background }]}>
          {options.map((option) => (
            <Pressable
              key={option}
              onPress={() => {
                onChange(option);
                setOpen(false);
              }}
              style={[
                styles.dropdownOption,
                option === value && { backgroundColor: theme.backgroundSelected },
              ]}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {option}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function SimilarReviewModal({
  state,
  onClose,
  onApply,
}: {
  state: SimilarReviewState;
  onClose: () => void;
  onApply: (ids: string[]) => void;
}) {
  const theme = useTheme();

  return (
    <Modal visible={state !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.reviewSheet,
            { backgroundColor: theme.backgroundElement, borderColor: theme.borderStrong },
          ]}>
          <ThemedText type="section">Apply to similar rows?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Penny found other imports that look like the same merchant. The closest amounts are
            first. Tap to uncheck anything that isn&apos;t the same kind of purchase.
          </ThemedText>
          {state ? (
            <SimilarReviewBody
              key={state.base.id}
              state={state}
              onApply={onApply}
              onClose={onClose}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function SimilarReviewBody({
  state,
  onClose,
  onApply,
}: {
  state: NonNullable<SimilarReviewState>;
  onClose: () => void;
  onApply: (ids: string[]) => void;
}) {
  const theme = useTheme();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(state.candidates.map((candidate) => candidate.transaction.id))
  );
  const toggle = (id: string) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <View style={[styles.transferBox, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="smallBold" numberOfLines={2}>{state.base.item}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Categorized as {state.category}{state.subcategory ? ` · ${state.subcategory}` : ''}
        </ThemedText>
      </View>
      <ScrollView style={styles.similarList}>
        {state.candidates.map((candidate) => (
          <Pressable
            key={candidate.transaction.id}
            onPress={() => toggle(candidate.transaction.id)}
            style={[
              styles.similarRow,
              {
                borderTopColor: theme.border,
                opacity: selectedIds.has(candidate.transaction.id) ? 1 : 0.45,
              },
            ]}>
            <View style={styles.feedCopy}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {candidate.transaction.item}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {dayLabel(candidate.transaction.date)} · {Math.round(candidate.score * 100)}% match
              </ThemedText>
            </View>
            <ThemedText type="money">{formatTransactionMoney(candidate.transaction.amount)}</ThemedText>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.editorActions}>
        <PillButton tone="primary" onPress={() => onApply(Array.from(selectedIds))}>
          Apply to {selectedIds.size}
        </PillButton>
        <PillButton
          onPress={() =>
            setSelectedIds(new Set(state.candidates.map((candidate) => candidate.transaction.id)))
          }>
          Select all
        </PillButton>
        <PillButton onPress={() => setSelectedIds(new Set())}>Select none</PillButton>
        <PillButton onPress={onClose}>Skip</PillButton>
      </View>
    </>
  );
}

function TransactionEditorModal({
  draft,
  onChange,
  onClose,
  onSave,
  onDelete,
}: {
  draft: TransactionEditorDraft | null;
  onChange: (draft: TransactionEditorDraft | null) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
}) {
  const theme = useTheme();
  const update = (patch: Partial<TransactionEditorDraft>) => {
    if (!draft) return;
    onChange({ ...draft, ...patch });
  };

  return (
    <Modal visible={draft !== null} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalKeyboard}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.editorSheet,
              { backgroundColor: theme.backgroundElement, borderColor: theme.borderStrong },
            ]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.editorScrollBody}>
              <View style={styles.editorHead}>
                <PennyBadge expression="thinking" size={54} animated={false} />
                <View style={styles.manualCopy}>
                  <ThemedText type="section">{draft?.title ?? 'Transaction'}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Fix anything that looks off. You can edit this again any time.
                  </ThemedText>
                </View>
              </View>

              <EditorField
                label="Merchant"
                value={draft?.merchantName ?? ''}
                onChangeText={(value) => update({ merchantName: value })}
              />
              <EditorField
                label="Date"
                value={draft?.date ?? ''}
                onChangeText={(value) => update({ date: value })}
                placeholder="YYYY-MM-DD"
              />
              <EditorField
                label="Category"
                value={draft?.category ?? ''}
                onChangeText={(value) => update({ category: value })}
              />
              <EditorField
                label="Amount"
                value={draft?.amount ?? ''}
                onChangeText={(value) => update({ amount: value })}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
              {draft?.mode === 'manual' ? (
                <View style={styles.importActions}>
                  <ToggleChip
                    label="Expense"
                    selected={draft.kind === 'expense'}
                    onPress={() => update({ kind: 'expense' })}
                  />
                  <ToggleChip
                    label="Income"
                    selected={draft.kind === 'income'}
                    onPress={() => update({ kind: 'income' })}
                  />
                  <ToggleChip
                    label="Transfer"
                    selected={draft.kind === 'transfer'}
                    onPress={() => update({ kind: 'transfer', category: 'Transfers' })}
                  />
                </View>
              ) : null}

              <View style={styles.editorActions}>
                <PillButton tone="primary" onPress={onSave}>
                  Save
                </PillButton>
                <PillButton onPress={onClose}>Cancel</PillButton>
                {onDelete ? <PillButton onPress={onDelete}>Delete</PillButton> : null}
              </View>
            </ScrollView>
            </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function EditorField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad';
}) {
  const theme = useTheme();

  return (
    <View style={styles.editorField}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        keyboardType={keyboardType}
        style={[
          styles.editorInput,
          { borderColor: theme.border, color: theme.text, backgroundColor: theme.background },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
  },
  body: {
    flexGrow: 1,
    gap: Spacing.three,
    paddingBottom: PANEL_BOTTOM_INSET,
  },
  gap: {
    gap: Spacing.three,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  radarCard: {
    gap: Spacing.two,
  },
  radarHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  disclosureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: 2,
  },
  formatHelp: {
    borderRadius: Radius.control,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  importActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  manualCard: {
    gap: Spacing.two,
  },
  manualTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  manualCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderTopWidth: 1,
    paddingTop: Spacing.two,
  },
  loadingCard: {
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  dayGroup: {
    gap: Spacing.two,
  },
  dayHeader: {
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  dayCard: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  feedCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    alignItems: 'flex-start',
  },
  feedAmount: {
    flexShrink: 0,
  },
  feedTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.one,
  },
  burnCard: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  burnValue: {
    fontSize: 40,
    lineHeight: 46,
  },
  subscriptionCard: {
    gap: Spacing.two,
  },
  subscriptionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  subscriptionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  subscriptionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  budgetFlag: {
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(30, 24, 18, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  modalKeyboard: {
    flex: 1,
  },
  reviewSheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '88%',
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  editorSheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '88%',
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  editorScrollBody: {
    gap: Spacing.three,
  },
  editorHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  editorField: {
    gap: Spacing.one,
  },
  addCategoryBox: {
    borderWidth: 1,
    borderRadius: Radius.control,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  editorInput: {
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
  },
  dropdownButton: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  dropdownValue: {
    flex: 1,
    minWidth: 0,
  },
  dropdownList: {
    maxHeight: 180,
    borderWidth: 1,
    borderRadius: Radius.control,
  },
  dropdownOption: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  editorActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  transferBox: {
    borderRadius: Radius.control,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  similarList: {
    maxHeight: 280,
  },
  similarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderTopWidth: 1,
    paddingVertical: Spacing.two,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  closeGlyph: {
    fontSize: 17,
  },
  reviewScroll: {
    flexGrow: 0,
  },
  reviewBody: {
    gap: Spacing.three,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  reviewCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  reviewAmount: {
    fontSize: 18,
    flexShrink: 0,
  },
  guessBox: {
    borderRadius: Radius.control,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  guessTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rememberCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  doneBody: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  doneTitle: {
    textAlign: 'center',
  },
  reviewControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
