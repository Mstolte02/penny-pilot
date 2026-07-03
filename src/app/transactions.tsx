import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { ThemedText } from '@/components/themed-text';
import { TransactionSourceCard } from '@/components/transaction-source-card';
import { Radius, Spacing } from '@/constants/theme';
import { emptyStates } from '@/constants/penny-voice';
import type { Category, Subcategory, Transaction } from '@/domain/finance';
import { formatMoney, monthKey, uniqueMonths } from '@/domain/mobile-finance';
import { useTheme } from '@/hooks/use-theme';
import { categorizationService, financeDataService } from '@/services';
import type { CategorizationSuggestion } from '@/services/contracts';
import { buildImportPreview, type ImportPreview } from '@/services/csv-import';
import {
  lineMatchesTransaction,
  useFinance,
  type PlanLine,
  type StoredTransaction,
} from '@/services/finance-store';

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
  return error instanceof Error ? error.message : 'Transactions are not available right now.';
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
  kind: 'expense' | 'income';
};

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
  const byItem = new Map<string, { amounts: number[]; months: Set<string>; sample: StoredTransaction }>();

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;
    if (excludedCategories.has(transaction.category)) continue;
    if (NOT_SUBSCRIPTION.test(transaction.item)) continue;
    const entry = byItem.get(transaction.item) ?? { amounts: [], months: new Set(), sample: transaction };
    entry.amounts.push(transaction.moneyOut);
    entry.months.add(monthKey(transaction.date));
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
      return {
        id: name,
        name,
        category: entry.sample.category,
        subcategory: entry.sample.subcategory,
        monthly,
        inBudget,
      };
    })
    .sort((a, b) => b.monthly - a.monthly);
}

export default function TransactionsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const {
    transactions: storeTransactions,
    planLines,
    addTransactions,
    updateTransaction,
    deleteTransaction,
    cancelFlags,
    setCancelFlags,
    transactionEdits,
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

  const subscriptions = useMemo(
    () => detectSubscriptions(storeTransactions, planLines),
    [storeTransactions, planLines]
  );
  const monthlyBurn = subscriptions.reduce((sum, subscription) => sum + subscription.monthly, 0);

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

  const groups = useMemo(() => {
    const byDay = new Map<string, Transaction[]>();
    for (const transaction of pendingReview) {
      const day = byDay.get(transaction.date) ?? [];
      day.push(transaction);
      byDay.set(transaction.date, day);
    }
    return Array.from(byDay.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [pendingReview]);

  const guessFor = (transaction: Transaction) => {
    const suggestion = suggestions[transaction.id];
    if (!suggestion) return 'Needs a category';
    const category = categories.find((entry) => entry.id === suggestion.categoryId);
    const subcategory = category?.subcategories.find(
      (entry) => entry.id === suggestion.subcategoryId
    );
    return category
      ? `${category.name}${subcategory ? ` › ${subcategory.name}` : ''}`
      : 'Needs a category';
  };

  const confidenceFor = (transaction: Transaction) =>
    confidenceDisplay[suggestions[transaction.id]?.confidence ?? 'none'];

  const openManualEditor = (transaction?: StoredTransaction) => {
    setEditor({
      mode: 'manual',
      title: transaction ? 'Edit entry' : 'Add manual transaction',
      id: transaction?.id,
      date: transaction?.date ?? new Date().toISOString().slice(0, 10),
      merchantName: transaction?.item ?? '',
      category: transaction?.category ?? 'Uncategorized',
      amount: transaction ? String(Math.abs(transaction.amount)) : '',
      kind: transaction?.type === 'income' ? 'income' : 'expense',
    });
  };

  const openFeedEditor = (transaction: Transaction) => {
    const patch = transactionEdits[transaction.id];
    setEditor({
      mode: 'feed',
      title: 'Correct transaction',
      sourceId: transaction.id,
      date: transaction.date,
      merchantName: patch?.merchantName ?? transaction.merchantName,
      category: patch?.category ?? guessFor(transaction),
      amount: String(patch?.amount ?? transaction.amount),
      kind: 'expense',
    });
  };

  const saveEditor = () => {
    if (!editor) return;
    const amount = Math.abs(Number(editor.amount.replace(/[^0-9.]/g, '')) || 0);
    const merchantName = editor.merchantName.trim() || 'Untitled transaction';
    const category = editor.category.trim() || 'Uncategorized';

    if (editor.mode === 'manual') {
      const isExpense = editor.kind === 'expense';
      const next: StoredTransaction = {
        id: editor.id ?? `manual-${Date.now()}`,
        date: editor.date || new Date().toISOString().slice(0, 10),
        item: merchantName,
        moneyIn: isExpense ? 0 : amount,
        moneyOut: isExpense ? amount : 0,
        amount: isExpense ? -amount : amount,
        category: isExpense ? category : 'Income',
        subcategory: null,
        type: isExpense ? 'expense' : 'income',
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
      // Lazy-loaded: these modules carry native code, so an app binary built
      // before they were added would crash on a static import. Loading them here
      // turns "missing module" into a friendly message instead of a dead screen.
      const DocumentPicker = await import('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/csv'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      let text: string;
      if (Platform.OS === 'web' && asset.file) {
        text = await asset.file.text();
      } else {
        const { File: FsFile } = await import('expo-file-system');
        text = await new FsFile(asset.uri).text();
      }

      const preview = buildImportPreview(text, storeTransactions, guessCategory);
      if ('error' in preview) {
        setImportError(preview.error);
        return;
      }
      if (preview.total === 0) {
        setImportError(
          preview.duplicates > 0
            ? 'Every row in that file is already imported.'
            : 'No readable transactions found in that file.'
        );
        return;
      }
      setImportPreview(preview);
    } catch (importFailure) {
      if (
        importFailure instanceof Error &&
        /native module|requireNativeModule|ExpoDocumentPicker|ExpoFileSystem/i.test(importFailure.message)
      ) {
        setImportError(
          'This app build is missing the file picker — it needs one rebuild (eas build --profile development-device). Until then, imports work on the web version (note: each device keeps its own local data for now).'
        );
        return;
      }
      setImportError('Could not read that file. Make sure it is a CSV export from your bank.');
    }
  };

  const confirmImport = () => {
    if (!importPreview) return;
    addTransactions(importPreview.transactions);
    setLastImport(
      `${importPreview.total} transactions imported` +
        (importPreview.duplicates > 0 ? ` · ${importPreview.duplicates} duplicates skipped` : '') +
        (importPreview.uncategorized > 0
          ? ` · ${importPreview.uncategorized} need a category (tap them below to fix)`
          : '')
    );
    setImportPreview(null);
  };

  return (
    <Screen
      eyebrow="Activity"
      title="Transactions"
      subtitle="Synced activity and recurring charges"
      mascot={<PennyBadge expression={pendingReview.length === 0 ? 'celebrating' : 'thinking'} />}
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
          <View style={styles.statusRow}>
            <Pill label={`${pendingReview.length} on radar`} tone="info" />
            <Pill label={`${resolvedReviewIds.length} sorted`} tone="good" />
          </View>

          {pendingReview.length > 0 ? (
            <PillButton tone="primary" onPress={() => setReviewOpen(true)}>
              Review transactions ({pendingReview.length})
            </PillButton>
          ) : null}

          <Card style={styles.manualCard}>
            <View style={styles.manualTop}>
              <View style={styles.manualCopy}>
                <ThemedText type="smallBold">Manual & imported</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Import a CSV export from your bank, or add cash and Venmo by hand. Everything
                  lands in your reports.
                </ThemedText>
              </View>
            </View>
            <View style={styles.importActions}>
              <PillButton tone="primary" onPress={() => void importCsv()}>
                Import bank CSV
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
            {userEntries.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                No entries of your own yet.
              </ThemedText>
            ) : (
              <>
                {userEntries.slice(0, 12).map((transaction) => (
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
                        themeColor={transaction.category === 'Uncategorized' ? 'warning' : 'textSecondary'}
                        numberOfLines={1}>
                        {dayLabel(transaction.date)} · {transaction.category}
                        {transaction.source === 'import' ? ' · imported' : ''}
                      </ThemedText>
                    </View>
                    <ThemedText type="money" style={styles.feedAmount}>
                      {formatTransactionMoney(transaction.amount)}
                    </ThemedText>
                  </Pressable>
                ))}
                {userEntries.length > 12 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    …and {userEntries.length - 12} more in your reports.
                  </ThemedText>
                ) : null}
              </>
            )}
          </Card>

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

          {!loading && pendingReview.length === 0 && !error ? (
            <Card style={styles.gap}>
              <SpeechBubble expression="celebrating">{emptyStates.allReviewed}</SpeechBubble>
              <PillButton onPress={() => void loadFeed('refresh')}>Check again</PillButton>
            </Card>
          ) : null}

          {groups.map(([date, dayTransactions]) => (
            <View key={date} style={styles.dayGroup}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.dayHeader}>
                {dayLabel(date)}
              </ThemedText>
              <Card style={styles.dayCard}>
                {dayTransactions.map((transaction, index) => {
                  const confidence = confidenceFor(transaction);
                  const edit = transactionEdits[transaction.id];
                  return (
                    <View
                      key={transaction.id}
                      style={[
                        styles.feedRow,
                        index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                      ]}>
                      <View style={styles.feedCopy}>
                        <ThemedText type="smallBold" numberOfLines={1}>
                          {edit?.merchantName ?? transaction.merchantName}
                        </ThemedText>
                        <ThemedText type="small" style={{ color: theme.primary }} numberOfLines={1}>
                          {edit?.category ?? guessFor(transaction)}
                        </ThemedText>
                        <View style={styles.feedTags}>
                          <Pill
                            label={edit ? 'Edited' : confidence.label}
                            tone={edit ? 'info' : confidence.tone}
                          />
                          <PillButton onPress={() => openFeedEditor(transaction)}>Edit</PillButton>
                        </View>
                      </View>
                      <ThemedText type="money" style={styles.feedAmount}>
                        {formatTransactionMoney(edit?.amount ?? transaction.amount)}
                      </ThemedText>
                    </View>
                  );
                })}
              </Card>
            </View>
          ))}

          <TransactionSourceCard />
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.panel}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}>
          <Card style={[styles.burnCard, { borderColor: theme.primary }]}>
            <ThemedText type="small" themeColor="textSecondary">
              Subscriptions · monthly total
            </ThemedText>
            <ThemedText type="hero" style={[styles.burnValue, { color: theme.primary }]}>
              {formatMoney(monthlyBurn)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {subscriptions.length} recurring {subscriptions.length === 1 ? 'charge' : 'charges'} ·{' '}
              {formatMoney(monthlyBurn * 12)}/yr
            </ThemedText>
          </Card>

          {subscriptions.length === 0 ? (
            <SpeechBubble expression="thinking">{emptyStates.noSubscriptions}</SpeechBubble>
          ) : (
            subscriptions.map((subscription) => (
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
                  </View>
                  <ThemedText type="money" style={{ fontSize: 17 }}>
                    {formatMoney(subscription.monthly)}/mo
                  </ThemedText>
                </View>
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
              </Card>
            ))
          )}

          <SpeechBubble expression="default">
            Forgotten subscriptions are the sneakiest leaks in a budget. Flag anything you
            don&apos;t recognize.
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
      <TransactionEditorModal
        draft={editor}
        onChange={setEditor}
        onClose={() => setEditor(null)}
        onSave={saveEditor}
        onDelete={editor?.mode === 'manual' && editor.id ? deleteManual : undefined}
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
                    {importPreview.duplicates} already imported — skipped automatically.
                  </ThemedText>
                ) : null}
                {importPreview.uncategorized > 0 ? (
                  <ThemedText type="small" themeColor="warning">
                    {importPreview.uncategorized} new merchants Penny couldn&apos;t categorize yet —
                    they&apos;ll import as Uncategorized for you to fix.
                  </ThemedText>
                ) : null}
                {importPreview.warnings.map((warning) => (
                  <ThemedText key={warning} type="small" themeColor="textSecondary">
                    {warning}
                  </ThemedText>
                ))}
                <SpeechBubble expression="happy">
                  Everything parses on this device — your bank file never leaves it.
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

                <View style={styles.section}>
                  <ThemedText type="smallBold">Category</ThemedText>
                  <View style={styles.chips}>
                    {categories.map((category) => (
                      <ToggleChip
                        key={category.id}
                        label={category.name}
                        selected={category.id === selectedCategoryId}
                        onPress={() => {
                          setSelectedCategoryId(category.id);
                          setSelectedSubcategoryId(category.subcategories[0]?.id ?? null);
                        }}
                      />
                    ))}
                  </View>
                </View>

                {selectedCategory && selectedCategory.subcategories.length > 0 ? (
                  <View style={styles.section}>
                    <ThemedText type="smallBold">Subcategory</ThemedText>
                    <View style={styles.chips}>
                      {selectedCategory.subcategories.map((subcategory) => (
                        <ToggleChip
                          key={subcategory.id}
                          label={subcategory.name}
                          selected={subcategory.id === selectedSubcategoryId}
                          onPress={() => setSelectedSubcategoryId(subcategory.id)}
                        />
                      ))}
                    </View>
                  </View>
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
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.editorSheet,
            { backgroundColor: theme.backgroundElement, borderColor: theme.borderStrong },
          ]}>
          <View style={styles.editorHead}>
            <PennyBadge expression="thinking" size={54} animated={false} />
            <View style={styles.manualCopy}>
              <ThemedText type="section">{draft?.title ?? 'Transaction'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                You can fix a row any time if the export, category, or amount feels off.
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
            </View>
          ) : null}

          <View style={styles.editorActions}>
            <PillButton tone="primary" onPress={onSave}>
              Save
            </PillButton>
            <PillButton onPress={onClose}>Cancel</PillButton>
            {onDelete ? <PillButton onPress={onDelete}>Delete</PillButton> : null}
          </View>
        </View>
      </View>
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
  },
  body: {
    gap: Spacing.three,
    paddingBottom: PANEL_BOTTOM_INSET,
  },
  gap: {
    gap: Spacing.three,
  },
  statusRow: {
    flexDirection: 'row',
    gap: Spacing.two,
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
    borderRadius: 999,
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
  reviewSheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '88%',
    borderWidth: 1,
    borderRadius: Radius.card + 6,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  editorSheet: {
    width: '100%',
    maxWidth: 520,
    borderWidth: 1,
    borderRadius: Radius.card + 6,
    padding: Spacing.four,
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
  editorInput: {
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
  },
  editorActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
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
