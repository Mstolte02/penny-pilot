import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
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
import { Spacing } from '@/constants/theme';
import { emptyStates } from '@/constants/penny-voice';
import { mobileBudgetPlan, mobileTransactions } from '@/data/personal-finance-template';
import type { Category, Subcategory, Transaction } from '@/domain/finance';
import { formatMoney } from '@/domain/mobile-finance';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
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
  return error instanceof Error ? error.message : 'The radar is not available right now.';
}

/**
 * Recurring charges, revealed. Fixed budget lines are the prototype's stand-in for
 * detected subscriptions; due days come from the latest matching transaction when
 * one exists, with a stable spread otherwise.
 */
function detectSubscriptions() {
  return mobileBudgetPlan.sections
    .flatMap((section) => section.lines.map((line) => ({ section: section.title, line })))
    .filter(({ line }) => line.type === 'fixed' && (line.monthly ?? 0) > 0 && line.name !== 'Fun Money')
    .map(({ section, line }, index) => {
      const lastPosting = [...mobileTransactions]
        .reverse()
        .find((transaction) => transaction.item === line.name);
      return {
        id: `${section}::${line.name}`,
        name: line.name,
        section,
        monthly: line.monthly ?? 0,
        dueDay: lastPosting ? Number(lastPosting.date.slice(8, 10)) : ((index * 7) % 27) + 2,
      };
    })
    .sort((a, b) => a.dueDay - b.dueDay);
}

export default function RadarScreen() {
  const theme = useTheme();
  const [active, setActive] = useState('feed');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<CategoryWithSubcategories[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, CategorizationSuggestion>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortedCount, setSortedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelFlags, setCancelFlags] = useState<Record<string, boolean>>({});

  const subscriptions = useMemo(() => detectSubscriptions(), []);
  const monthlyBurn = subscriptions.reduce((sum, subscription) => sum + subscription.monthly, 0);

  const loadRadar = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
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
      setExpandedId(null);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => void loadRadar(), 0);
    return () => clearTimeout(timeout);
  }, [loadRadar]);

  const removeTransaction = (id: string) => {
    setTransactions((current) => current.filter((transaction) => transaction.id !== id));
    setSortedCount((count) => count + 1);
    setExpandedId((current) => (current === id ? null : current));
  };

  const confirmTransaction = async (transaction: Transaction) => {
    const suggestion = suggestions[transaction.id];
    if (!suggestion) return;

    try {
      await categorizationService.confirmCategory({
        ...suggestion,
        confidence: suggestion.confidence === 'none' ? 'medium' : suggestion.confidence,
      });
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    }
  };

  const overrideTransaction = async (
    transaction: Transaction,
    categoryId: string,
    subcategoryId: string | null
  ) => {
    try {
      await categorizationService.overrideCategory({
        transactionId: transaction.id,
        categoryId,
        subcategoryId,
        rememberMerchant: true,
      });
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    }
  };

  const groups = useMemo(() => {
    const byDay = new Map<string, Transaction[]>();
    for (const transaction of transactions) {
      const day = byDay.get(transaction.date) ?? [];
      day.push(transaction);
      byDay.set(transaction.date, day);
    }
    return Array.from(byDay.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [transactions]);

  const categoryNameFor = (suggestion: CategorizationSuggestion | undefined) => {
    if (!suggestion) return 'Needs a read';
    const category = categories.find((entry) => entry.id === suggestion.categoryId);
    const subcategory = category?.subcategories.find(
      (entry) => entry.id === suggestion.subcategoryId
    );
    return category ? `${category.name}${subcategory ? ` › ${subcategory.name}` : ''}` : 'Needs a read';
  };

  return (
    <Screen
      eyebrow="Radar"
      title="Radar"
      subtitle="Every transaction on the scope"
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
              onRefresh={() => void loadRadar('refresh')}
              tintColor={theme.primary}
            />
          }>
          <View style={styles.statusRow}>
            <Pill label={`${transactions.length} on radar`} tone="info" />
            <Pill label={`${sortedCount} sorted`} tone="good" />
          </View>

          {error ? (
            <Card style={styles.gap}>
              <SpeechBubble expression="concerned">{emptyStates.syncFailed}</SpeechBubble>
              <ThemedText type="small" themeColor="textSecondary">
                {error}
              </ThemedText>
              <PillButton onPress={() => void loadRadar('refresh')}>Try again</PillButton>
            </Card>
          ) : null}

          {loading ? (
            <Card style={styles.loadingCard}>
              <ActivityIndicator color={theme.primary} />
              <ThemedText type="smallBold">Scanning…</ThemedText>
            </Card>
          ) : null}

          {!loading && transactions.length === 0 && !error ? (
            <Card style={styles.gap}>
              <SpeechBubble expression="celebrating">{emptyStates.allReviewed}</SpeechBubble>
              <PillButton onPress={() => void loadRadar('refresh')}>Scan again</PillButton>
            </Card>
          ) : null}

          {groups.map(([date, dayTransactions]) => (
            <View key={date} style={styles.dayGroup}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.dayHeader}>
                {dayLabel(date)}
              </ThemedText>
              {dayTransactions.map((transaction) => (
                <RadarRow
                  key={transaction.id}
                  transaction={transaction}
                  guess={categoryNameFor(suggestions[transaction.id])}
                  rationale={suggestions[transaction.id]?.rationale}
                  expanded={expandedId === transaction.id}
                  categories={categories}
                  onConfirm={() => {
                    void confirmTransaction(transaction);
                    removeTransaction(transaction.id);
                  }}
                  onToggleExpand={() =>
                    setExpandedId((current) => (current === transaction.id ? null : transaction.id))
                  }
                  onRecategorize={(categoryId, subcategoryId) => {
                    void overrideTransaction(transaction, categoryId, subcategoryId);
                    removeTransaction(transaction.id);
                  }}
                />
              ))}
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
              Recurring charges · monthly burn
            </ThemedText>
            <ThemedText type="hero" style={[styles.burnValue, { color: theme.primary }]}>
              {formatMoney(monthlyBurn)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {subscriptions.length} enchantments on the calendar · {formatMoney(monthlyBurn * 12)}
              /yr
            </ThemedText>
          </Card>

          {subscriptions.length === 0 ? (
            <SpeechBubble expression="thinking">{emptyStates.noSubscriptions}</SpeechBubble>
          ) : (
            <Card style={styles.gap}>
              {subscriptions.map((subscription, index) => (
                <View
                  key={subscription.id}
                  style={[styles.subscriptionRow, index > 0 && { borderTopColor: theme.border, borderTopWidth: 1 }]}>
                  <View style={[styles.dueBadge, { backgroundColor: theme.backgroundSelected }]}>
                    <ThemedText type="smallBold" style={{ color: theme.accent }}>
                      {subscription.dueDay}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.dueBadgeLabel}>
                      of mo
                    </ThemedText>
                  </View>
                  <View style={styles.subscriptionCopy}>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {subscription.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {subscription.section}
                    </ThemedText>
                  </View>
                  <View style={styles.subscriptionEnd}>
                    <ThemedText type="money">{formatMoney(subscription.monthly)}</ThemedText>
                    <Pressable
                      onPress={() =>
                        setCancelFlags((current) => ({
                          ...current,
                          [subscription.id]: !current[subscription.id],
                        }))
                      }>
                      <ThemedText
                        type="small"
                        style={{
                          color: cancelFlags[subscription.id] ? theme.danger : theme.textSecondary,
                        }}>
                        {cancelFlags[subscription.id] ? 'Cancel reminder set' : 'Remind me to cancel'}
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
              ))}
            </Card>
          )}

          <SpeechBubble expression="default">
            Forgotten subscriptions are the sneakiest leaks in a budget. Flag anything you
            don&apos;t recognize.
          </SpeechBubble>
        </ScrollView>
      )}
    </Screen>
  );
}

/**
 * One transaction on the scope. Confirming fires the contrail flick — the one
 * recurring chore in the app should feel fast and satisfying.
 */
function RadarRow({
  transaction,
  guess,
  rationale,
  expanded,
  categories,
  onConfirm,
  onToggleExpand,
  onRecategorize,
}: {
  transaction: Transaction;
  guess: string;
  rationale?: string;
  expanded: boolean;
  categories: CategoryWithSubcategories[];
  onConfirm: () => void;
  onToggleExpand: () => void;
  onRecategorize: (categoryId: string, subcategoryId: string | null) => void;
}) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const [slide] = useState(() => new Animated.Value(0));
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? null;

  const confirmWithContrail = () => {
    if (reducedMotion) {
      onConfirm();
      return;
    }
    Animated.timing(slide, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => onConfirm());
  };

  return (
    <Animated.View
      style={{
        opacity: slide.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, 96] }) }],
      }}>
      <Card style={styles.rowCard}>
        <View style={styles.rowMain}>
          <Pressable style={styles.rowCopy} onPress={onToggleExpand}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {transaction.merchantName}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.primary }} numberOfLines={1}>
              {guess}
            </ThemedText>
            {rationale ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {rationale}
              </ThemedText>
            ) : null}
          </Pressable>
          <ThemedText type="money" style={styles.rowAmount}>
            {formatTransactionMoney(transaction.amount)}
          </ThemedText>
          <Pressable
            accessibilityLabel={`Confirm category for ${transaction.merchantName}`}
            onPress={confirmWithContrail}
            style={({ pressed }) => [
              styles.confirmButton,
              { backgroundColor: theme.primary, opacity: pressed ? 0.75 : 1 },
            ]}>
            <ThemedText type="smallBold" style={{ color: theme.onPrimary, fontSize: 17 }}>
              ✓
            </ThemedText>
          </Pressable>
        </View>

        {expanded ? (
          <View style={styles.recategorize}>
            <ThemedText type="small" themeColor="textSecondary">
              File it somewhere else:
            </ThemedText>
            <View style={styles.chips}>
              {categories.map((category) => (
                <ToggleChip
                  key={category.id}
                  label={category.name}
                  selected={category.id === selectedCategoryId}
                  onPress={() =>
                    selectedCategoryId === category.id && category.subcategories.length === 0
                      ? onRecategorize(category.id, null)
                      : setSelectedCategoryId(category.id)
                  }
                />
              ))}
            </View>
            {selectedCategory ? (
              <View style={styles.chips}>
                {selectedCategory.subcategories.length === 0 ? (
                  <PillButton tone="primary" onPress={() => onRecategorize(selectedCategory.id, null)}>
                    File under {selectedCategory.name}
                  </PillButton>
                ) : (
                  selectedCategory.subcategories.map((subcategory) => (
                    <ToggleChip
                      key={subcategory.id}
                      label={subcategory.name}
                      onPress={() => onRecategorize(selectedCategory.id, subcategory.id)}
                    />
                  ))
                )}
              </View>
            ) : null}
          </View>
        ) : null}
      </Card>
    </Animated.View>
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
  rowCard: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  rowAmount: {
    flexShrink: 0,
  },
  confirmButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recategorize: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  burnCard: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  burnValue: {
    fontSize: 40,
    lineHeight: 46,
  },
  subscriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  dueBadge: {
    width: 46,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  dueBadgeLabel: {
    fontSize: 10,
    lineHeight: 12,
  },
  subscriptionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  subscriptionEnd: {
    alignItems: 'flex-end',
    gap: 2,
  },
});
