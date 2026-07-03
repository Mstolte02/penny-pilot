import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
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
import { mobileBudgetPlan, mobileTransactions } from '@/data/personal-finance-template';
import type { Category, Subcategory, Transaction } from '@/domain/finance';
import { formatMoney, monthKey, uniqueMonths } from '@/domain/mobile-finance';
import { useTheme } from '@/hooks/use-theme';
import { categorizationService, financeDataService } from '@/services';
import type { CategorizationSuggestion } from '@/services/contracts';

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

/**
 * True subscriptions only: a charge that repeats monthly at a steady amount.
 * Rent, utilities, insurance, and loan payments recur too, but they're bills —
 * they're excluded by category and by name.
 */
function detectSubscriptions(): DetectedSubscription[] {
  const excludedCategories = new Set(['Essentials', 'Debt', 'Income', 'Health', 'Home']);
  const monthsAvailable = uniqueMonths(mobileTransactions).length;
  const byItem = new Map<string, { amounts: number[]; months: Set<string>; sample: (typeof mobileTransactions)[number] }>();

  for (const transaction of mobileTransactions) {
    if (transaction.type !== 'expense') continue;
    if (excludedCategories.has(transaction.category)) continue;
    if (NOT_SUBSCRIPTION.test(transaction.item)) continue;
    const entry = byItem.get(transaction.item) ?? { amounts: [], months: new Set(), sample: transaction };
    entry.amounts.push(transaction.moneyOut);
    entry.months.add(monthKey(transaction.date));
    byItem.set(transaction.item, entry);
  }

  const budgetLines = mobileBudgetPlan.sections.flatMap((section) =>
    section.lines.map((line) => ({ section: section.title, line }))
  );

  return Array.from(byItem.entries())
    .filter(([, entry]) => {
      if (entry.months.size < Math.min(3, monthsAvailable)) return false;
      const mean = entry.amounts.reduce((sum, value) => sum + value, 0) / entry.amounts.length;
      const spread = Math.max(...entry.amounts) - Math.min(...entry.amounts);
      return mean > 0 && spread / mean < 0.1;
    })
    .map(([name, entry]) => {
      const monthly = entry.amounts.reduce((sum, value) => sum + value, 0) / entry.amounts.length;
      const inBudget = budgetLines.some(({ section, line }) => {
        if (line.match?.length) {
          return line.match.some(
            ([category, subcategory]) =>
              entry.sample.category === category &&
              (entry.sample.subcategory ?? 'Uncategorized') === subcategory
          );
        }
        return entry.sample.category === section && entry.sample.subcategory === line.name;
      });
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
  const [active, setActive] = useState('feed');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<CategoryWithSubcategories[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, CategorizationSuggestion>>({});
  const [sortedCount, setSortedCount] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelFlags, setCancelFlags] = useState<Record<string, boolean>>({});

  const subscriptions = useMemo(() => detectSubscriptions(), []);
  const monthlyBurn = subscriptions.reduce((sum, subscription) => sum + subscription.monthly, 0);

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
      setTransactions(loadedTransactions);
      setSuggestions(
        Object.fromEntries(
          loadedSuggestions
            .filter((suggestion): suggestion is CategorizationSuggestion => suggestion !== null)
            .map((suggestion) => [suggestion.transactionId, suggestion])
        )
      );
      setSortedCount(0);
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
    for (const transaction of transactions) {
      const day = byDay.get(transaction.date) ?? [];
      day.push(transaction);
      byDay.set(transaction.date, day);
    }
    return Array.from(byDay.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [transactions]);

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

  return (
    <Screen
      eyebrow="Activity"
      title="Transactions"
      subtitle="Synced activity and recurring charges"
      mascot={<PennyBadge expression={transactions.length === 0 ? 'celebrating' : 'thinking'} />}
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
            <Pill label={`${transactions.length} on radar`} tone="info" />
            <Pill label={`${sortedCount} sorted`} tone="good" />
          </View>

          {transactions.length > 0 ? (
            <PillButton tone="primary" onPress={() => setReviewOpen(true)}>
              Review transactions ({transactions.length})
            </PillButton>
          ) : null}

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

          {!loading && transactions.length === 0 && !error ? (
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
                  return (
                    <View
                      key={transaction.id}
                      style={[
                        styles.feedRow,
                        index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                      ]}>
                      <View style={styles.feedCopy}>
                        <ThemedText type="smallBold" numberOfLines={1}>
                          {transaction.merchantName}
                        </ThemedText>
                        <ThemedText type="small" style={{ color: theme.primary }} numberOfLines={1}>
                          {guessFor(transaction)}
                        </ThemedText>
                        <Pill label={confidence.label} tone={confidence.tone} />
                      </View>
                      <ThemedText type="money" style={styles.feedAmount}>
                        {formatTransactionMoney(transaction.amount)}
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
        transactions={transactions}
        categories={categories}
        suggestions={suggestions}
        sortedCount={sortedCount}
        onResolved={(id) => {
          setTransactions((current) => current.filter((transaction) => transaction.id !== id));
          setSortedCount((count) => count + 1);
        }}
        onSkip={(id) => {
          setTransactions((current) => {
            const index = current.findIndex((transaction) => transaction.id === id);
            if (index === -1) return current;
            return [...current.slice(0, index), ...current.slice(index + 1), current[index]];
          });
        }}
        onError={setError}
      />
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
