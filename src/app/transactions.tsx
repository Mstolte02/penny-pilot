import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
  PillButton,
  Screen,
  ToggleChip,
} from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Category, Subcategory, Transaction } from '@/domain/finance';
import { useTheme } from '@/hooks/use-theme';
import { categorizationService, financeDataService } from '@/services';
import type { CategorizationSuggestion } from '@/services/contracts';

type CategoryWithSubcategories = Category & { subcategories: Subcategory[] };

function formatTransactionMoney(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

function categoryKindLabel(kind: Category['kind']) {
  const labels: Record<Category['kind'], string> = {
    debt: 'Debt',
    fixed: 'Fixed',
    income: 'Income',
    savings: 'Savings',
    transfer: 'Transfer',
    variable: 'Variable',
  };

  return labels[kind];
}

function confidenceLabel(confidence: Transaction['categoryConfidence']) {
  if (confidence === 'none') {
    return 'Needs a first read';
  }

  return `${confidence.charAt(0).toUpperCase()}${confidence.slice(1)} confidence`;
}

function pickFallbackCategory(categories: CategoryWithSubcategories[]) {
  return (
    categories.find((category) => category.kind === 'variable') ??
    categories.find((category) => category.kind !== 'income' && category.kind !== 'transfer') ??
    categories[0] ??
    null
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Transaction review is not available right now.';
}

export default function TransactionsScreen() {
  const theme = useTheme();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<CategoryWithSubcategories[]>([]);
  const [suggestion, setSuggestion] = useState<CategorizationSuggestion | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);
  const [rememberMerchant, setRememberMerchant] = useState(true);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = transactions[0] ?? null;
  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId]
  );
  const selectedSubcategory = useMemo(
    () =>
      selectedCategory?.subcategories.find(
        (subcategory) => subcategory.id === selectedSubcategoryId
      ) ?? null,
    [selectedCategory, selectedSubcategoryId]
  );

  const loadReviewData = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [loadedCategories, loadedTransactions] = await Promise.all([
        financeDataService.listCategories(),
        financeDataService.listTransactionsNeedingReview(),
      ]);

      setCategories(loadedCategories);
      setTransactions(loadedTransactions);
      setCompletedCount(0);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadReviewData();
    }, 0);

    return () => clearTimeout(timeout);
  }, [loadReviewData]);

  useEffect(() => {
    let cancelled = false;

    async function loadSuggestion() {
      setSuggestion(null);

      if (!current) {
        setSelectedCategoryId(null);
        setSelectedSubcategoryId(null);
        return;
      }

      try {
        const nextSuggestion = await categorizationService.suggestCategory(current);
        if (cancelled) {
          return;
        }

        setSuggestion(nextSuggestion);
        setSelectedCategoryId(nextSuggestion.categoryId);
        setSelectedSubcategoryId(nextSuggestion.subcategoryId);
      } catch {
        if (cancelled) {
          return;
        }

        const fallback = pickFallbackCategory(categories);
        setSelectedCategoryId(current.categoryId ?? fallback?.id ?? null);
        setSelectedSubcategoryId(
          current.subcategoryId ?? fallback?.subcategories[0]?.id ?? null
        );
      }
    }

    void loadSuggestion();

    return () => {
      cancelled = true;
    };
  }, [categories, current]);

  const chooseCategory = (category: CategoryWithSubcategories) => {
    setSelectedCategoryId(category.id);
    setSelectedSubcategoryId(category.subcategories[0]?.id ?? null);
  };

  const finishCurrentTransaction = () => {
    setTransactions((currentTransactions) => currentTransactions.slice(1));
    setCompletedCount((count) => count + 1);
    setRememberMerchant(true);
  };

  const approveSelection = async () => {
    if (!current || !selectedCategoryId) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (
        rememberMerchant &&
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

      finishCurrentTransaction();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const skipCurrent = () => {
    if (transactions.length <= 1) {
      return;
    }

    setTransactions((currentTransactions) => [
      ...currentTransactions.slice(1),
      currentTransactions[0],
    ]);
    setRememberMerchant(true);
  };

  const queuePreview = transactions.slice(1, 5);
  const remainingCount = transactions.length;

  return (
    <Screen
      eyebrow="Review"
      title="Review"
      mascot={<PennyBadge expression={remainingCount === 0 ? 'celebrating' : 'thinking'} />}>
      <ScrollView
        style={styles.panel}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadReviewData('refresh')}
            tintColor={theme.primary}
          />
        }>
        <View style={styles.statusRow}>
          <View style={[styles.statusPill, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {remainingCount} to review
            </ThemedText>
          </View>
          <View style={[styles.statusPill, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold" themeColor="success" numberOfLines={1}>
              {completedCount} sorted
            </ThemedText>
          </View>
        </View>

        {error ? (
          <Card style={styles.gap}>
            <ThemedText type="smallBold" themeColor="warning">
              Review needs attention
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {error}
            </ThemedText>
            <PillButton onPress={() => void loadReviewData('refresh')}>Try again</PillButton>
          </Card>
        ) : null}

        {loading ? (
          <Card style={styles.loadingCard}>
            <ActivityIndicator color={theme.primary} />
            <ThemedText type="smallBold">Loading transactions...</ThemedText>
          </Card>
        ) : null}

        {!loading && !current ? (
          <Card style={styles.gap}>
            <View style={styles.emptyRow}>
              <View style={styles.emptyCopy}>
                <ThemedText type="subtitle">All caught up</ThemedText>
                <ThemedText themeColor="textSecondary">
                  When new bank transactions sync in, Penny will queue them here for review.
                </ThemedText>
              </View>
              <PennyBadge expression="celebrating" animated={false} />
            </View>
            <PillButton onPress={() => void loadReviewData('refresh')}>Refresh</PillButton>
          </Card>
        ) : null}

        {!loading && current ? (
          <Card style={styles.gap}>
            <View style={styles.reviewTop}>
              <View style={styles.reviewCopy}>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {current.date}
                </ThemedText>
                <ThemedText type="subtitle" style={styles.merchant} numberOfLines={1}>
                  {current.merchantName}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {current.originalDescription}
                </ThemedText>
              </View>
              <View style={[styles.amountBadge, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText
                  type="subtitle"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}>
                  {formatTransactionMoney(current.amount)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {current.kind}
                </ThemedText>
              </View>
            </View>

            <View style={[styles.guessBox, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="small" themeColor="textSecondary">
                Penny&apos;s current read
              </ThemedText>
              <ThemedText type="smallBold" numberOfLines={1}>
                {selectedCategory
                  ? `${selectedCategory.name}${selectedSubcategory ? ` › ${selectedSubcategory.name}` : ''}`
                  : 'Choose a category'}
              </ThemedText>
              <ThemedText type="small" themeColor="success">
                {suggestion ? suggestion.rationale : confidenceLabel(current.categoryConfidence)}
              </ThemedText>
            </View>

            <View style={styles.section}>
              <ThemedText type="smallBold">Category</ThemedText>
              <View style={styles.categoryGrid}>
                {categories.map((category) => {
                  const selected = category.id === selectedCategoryId;

                  return (
                    <Pressable
                      key={category.id}
                      onPress={() => chooseCategory(category)}
                      style={({ pressed }) => [
                        styles.categoryButton,
                        {
                          backgroundColor: selected ? theme.primary : theme.backgroundElement,
                          borderColor: selected ? theme.primary : theme.border,
                          opacity: pressed ? 0.75 : 1,
                        },
                      ]}>
                      <ThemedText
                        type="smallBold"
                        numberOfLines={1}
                        style={{ color: selected ? '#FFF8E8' : theme.text }}>
                        {category.name}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={{ color: selected ? '#FFF8E8' : theme.textSecondary }}>
                        {categoryKindLabel(category.kind)}
                      </ThemedText>
                    </Pressable>
                  );
                })}
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
                  Reuse this category next time Penny sees a similar merchant.
                </ThemedText>
              </View>
              <ToggleChip
                label={rememberMerchant ? 'On' : 'Off'}
                selected={rememberMerchant}
                onPress={() => setRememberMerchant((value) => !value)}
              />
            </View>

            <View style={styles.actions}>
              <PillButton
                tone="primary"
                disabled={saving || !selectedCategoryId}
                onPress={() => void approveSelection()}>
                {saving ? 'Saving...' : 'Approve'}
              </PillButton>
              <PillButton disabled={saving || transactions.length <= 1} onPress={skipCurrent}>
                Skip
              </PillButton>
            </View>
          </Card>
        ) : null}

        {queuePreview.length > 0 ? (
          <Card>
            <ThemedText type="smallBold">Up next</ThemedText>
            {queuePreview.map((transaction) => (
              <View key={transaction.id} style={styles.queueRow}>
                <View style={styles.queueCopy}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {transaction.merchantName}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {transaction.date}
                  </ThemedText>
                </View>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {formatTransactionMoney(transaction.amount)}
                </ThemedText>
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
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
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  statusPill: {
    minHeight: 36,
    borderRadius: 18,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
  },
  loadingCard: {
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  emptyCopy: {
    flex: 1,
    gap: Spacing.one,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  reviewCopy: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.one,
  },
  merchant: {
    fontSize: 26,
    lineHeight: 30,
  },
  amountBadge: {
    width: 112,
    borderRadius: 16,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'flex-end',
  },
  guessBox: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  section: {
    gap: Spacing.two,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  categoryButton: {
    minHeight: 72,
    flexBasis: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    justifyContent: 'space-between',
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
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  queueCopy: {
    flex: 1,
    minWidth: 0,
  },
});
