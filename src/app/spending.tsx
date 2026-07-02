import { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MiniBarChart } from '@/components/mini-charts';
import { Card, PageHead, PennyBadge, SegmentedToggle, ToggleChip } from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  BottomTabInset,
  MaxContentWidth,
  Spacing,
  colorForCategory,
} from '@/constants/theme';
import { mobileTransactions } from '@/data/personal-finance-template';
import {
  formatMoney,
  formatMonth,
  mean,
  monthKey,
  monthlySpend,
  uniqueMonths,
  type MobileTransaction,
} from '@/domain/mobile-finance';
import { useTheme } from '@/hooks/use-theme';

const WINDOWS: { label: string; value: number }[] = [
  { label: '3-mo', value: 3 },
  { label: '6-mo', value: 6 },
  { label: '9-mo', value: 9 },
  { label: '1-yr', value: 12 },
];

type CompareRow = {
  name: string;
  cur: number;
  avg: number;
  delta: number;
  pct: number;
  color: string;
};

function buildRows(
  keyed: { key: string; color: string }[],
  seriesByKey: Record<string, Record<string, number>>,
  months: string[],
  latest: string,
  window: number
): CompareRow[] {
  const windowMonths = months.slice(-window);

  return keyed
    .map(({ key, color }) => {
      const byMonth = seriesByKey[key] ?? {};
      const cur = byMonth[latest] ?? 0;
      const avg = mean(windowMonths.map((month) => byMonth[month] ?? 0));
      const delta = cur - avg;
      const pct = avg > 0 ? (delta / avg) * 100 : 0;

      return { name: key, cur, avg, delta, pct, color };
    })
    .filter((row) => row.cur > 0 || row.avg > 0)
    .sort((a, b) => b.cur - a.cur);
}

export default function SpendingScreen() {
  const theme = useTheme();
  const [window, setWindow] = useState(3);
  const [category, setCategory] = useState<string>('All');

  const model = useMemo(() => {
    const spends = monthlySpend(mobileTransactions);
    const months = uniqueMonths(mobileTransactions);
    const latest = spends[spends.length - 1]?.month ?? months[months.length - 1] ?? '';

    // Total spend per month + per-category series.
    const totalByMonth: Record<string, number> = {};
    const categorySeries: Record<string, Record<string, number>> = {};
    for (const row of spends) {
      totalByMonth[row.month] = row.total;
      for (const [cat, value] of Object.entries(row.byCategory)) {
        categorySeries[cat] = categorySeries[cat] ?? {};
        categorySeries[cat][row.month] = value;
      }
    }

    const categoryKeys = Object.keys(categorySeries)
      .map((key) => ({ key, color: colorForCategory(key) }))
      .filter((entry) => (categorySeries[entry.key][latest] ?? 0) > 0);
    const categoryRows = buildRows(categoryKeys, categorySeries, months, latest, window);

    // Subcategory series for the selected category.
    const subSeries: Record<string, Record<string, number>> = {};
    if (category !== 'All') {
      for (const transaction of mobileTransactions as MobileTransaction[]) {
        if (transaction.type !== 'expense' || transaction.category !== category) continue;
        const sub = transaction.subcategory ?? 'Uncategorized';
        const month = monthKey(transaction.date);
        subSeries[sub] = subSeries[sub] ?? {};
        subSeries[sub][month] = (subSeries[sub][month] ?? 0) + transaction.moneyOut;
      }
    }
    const subKeys = Object.keys(subSeries).map((key) => ({
      key,
      color: colorForCategory(category),
    }));
    const subRows = buildRows(subKeys, subSeries, months, latest, window);

    // Chart series: last 6 months of total spend, or the selected category.
    const chartMonths = months.slice(-6);
    const chartSource = category === 'All' ? totalByMonth : categorySeries[category] ?? {};
    const chartData = chartMonths.map((month) => ({
      label: formatMonth(month).replace(/ \d{4}$/, ''),
      value: chartSource[month] ?? 0,
    }));

    return { latest, categoryRows, subRows, chartData };
  }, [window, category]);

  const windowLabel = WINDOWS.find((option) => option.value === window)!.label;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SafeAreaView style={styles.safeArea}>
          <PageHead
            eyebrow="Spending"
            title="Spending over time"
            subtitle="Track categories and drill into subcategories against your recent averages."
            mascot={<PennyBadge expression="thinking" />}
          />

          <Card style={styles.controlsCard}>
            <ThemedText type="smallBold">Average window</ThemedText>
            <SegmentedToggle options={WINDOWS} value={window} onChange={setWindow} />
            <ThemedText type="smallBold">Category</ThemedText>
            <View style={styles.chips}>
              <ToggleChip
                label="All"
                selected={category === 'All'}
                onPress={() => setCategory('All')}
              />
              {model.categoryRows.map((row) => (
                <ToggleChip
                  key={row.name}
                  label={row.name}
                  selected={category === row.name}
                  onPress={() => setCategory(row.name)}
                />
              ))}
            </View>
          </Card>

          <Card style={styles.chartCard}>
            <ThemedText type="smallBold">
              {category === 'All' ? 'Total monthly spend' : `${category} monthly spend`}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Latest month highlighted; compared against the {windowLabel} average below.
            </ThemedText>
            <MiniBarChart
              data={model.chartData}
              valueLabel={(value) => formatMoney(value / 1000, 1) + 'k'}
              height={150}
            />
          </Card>

          <Card>
            <View style={styles.tableHeader}>
              <ThemedText type="smallBold">
                {category === 'All' ? 'By category' : `${category} subcategories`}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatMonth(model.latest)} vs {windowLabel} avg
              </ThemedText>
            </View>
            {(category === 'All' ? model.categoryRows : model.subRows).map((row) => {
              const over = row.delta > 0;
              return (
                <View key={row.name} style={styles.compareRow}>
                  <View style={styles.compareName}>
                    <View style={[styles.dot, { backgroundColor: row.color }]} />
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {row.name}
                    </ThemedText>
                  </View>
                  <View style={styles.compareNums}>
                    <ThemedText type="smallBold">{formatMoney(row.cur)}</ThemedText>
                    <ThemedText
                      type="small"
                      style={{ color: over ? theme.danger : theme.success }}>
                      {over ? '▲' : '▼'} {Math.abs(row.pct).toFixed(0)}% vs {formatMoney(row.avg)}
                    </ThemedText>
                  </View>
                </View>
              );
            })}
            {category !== 'All' && model.subRows.length === 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                No subcategory spending for {category} yet.
              </ThemedText>
            )}
          </Card>
        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    width: '100%',
  },
  safeArea: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Platform.OS === 'web' ? Spacing.six + Spacing.three : Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.three,
  },
  controlsCard: {
    gap: Spacing.two,
  },
  chartCard: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: '#E8DCC7',
  },
  compareName: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minWidth: 0,
  },
  compareNums: {
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
});
