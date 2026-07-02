import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BankSyncCard } from '@/components/bank-sync-card';
import { RankedBars, TrendBars } from '@/components/mini-charts';
import {
  Card,
  PANEL_BOTTOM_INSET,
  PennyBadge,
  Pill,
  ProgressBar,
  Screen,
  Stat,
} from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { colorForCategory, Spacing } from '@/constants/theme';
import { mobileBudgetPlan, mobileTransactions } from '@/data/personal-finance-template';
import {
  actualMonthlyNet,
  formatMoney,
  formatMonth,
  mean,
  monthlyIncome,
  monthlySpend,
  summarizeBudget,
  uniqueMonths,
} from '@/domain/mobile-finance';

const SEGMENTS = [
  { label: 'Overview', value: 'overview' },
  { label: 'Spending', value: 'spending' },
];

function shortMonth(month: string) {
  return formatMonth(month).replace(/ \d{2}(\d{2})$/, " '$1");
}

function moneyK(value: number) {
  return formatMoney(value / 1000, 1) + 'k';
}

export default function TodayScreen() {
  const [active, setActive] = useState('overview');

  const model = useMemo(() => {
    const budget = summarizeBudget(mobileBudgetPlan, mobileTransactions);
    const months = uniqueMonths(mobileTransactions);
    const latest = months[months.length - 1] ?? '';
    const spends = monthlySpend(mobileTransactions);
    const income = monthlyIncome(mobileTransactions);
    const net = actualMonthlyNet(mobileTransactions);

    const latestSpendRow = spends.find((row) => row.month === latest);
    const latestSpend = latestSpendRow?.total ?? 0;
    const latestIncome = income[latest] ?? 0;
    const latestNet = net[latest] ?? 0;

    const spendSeries = months.slice(-6).map((month) => ({
      label: shortMonth(month),
      value: spends.find((row) => row.month === month)?.total ?? 0,
    }));
    const netSeries = months.slice(-6).map((month) => ({
      label: shortMonth(month),
      value: net[month] ?? 0,
    }));

    const windowMonths = months.slice(-3);
    const categories = Object.entries(latestSpendRow?.byCategory ?? {})
      .map(([category, value]) => {
        const avg = mean(
          windowMonths.map((month) => spends.find((row) => row.month === month)?.byCategory[category] ?? 0)
        );
        const pct = avg > 0 ? ((value - avg) / avg) * 100 : 0;
        return {
          label: category,
          value,
          color: colorForCategory(category),
          delta: `${value >= avg ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}%`,
          deltaUp: value > avg,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return { budget, latest, latestSpend, latestIncome, latestNet, spendSeries, netSeries, categories };
  }, []);

  const budgetProgress =
    model.budget.totalExpenses > 0 ? model.latestSpend / model.budget.totalExpenses : 0;
  const overPlan = budgetProgress > 1;
  const left = Math.max(0, model.budget.totalExpenses - model.latestSpend);

  return (
    <Screen
      eyebrow="Penny Pilot"
      title="Today"
      mascot={<PennyBadge expression={overPlan ? 'concerned' : 'onTrack'} />}
      segments={SEGMENTS}
      active={active}
      onSelect={setActive}>
      {active === 'overview' ? (
        <ScrollView style={styles.panel} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.kpiGrid}>
            <Stat
              label="Take-home (plan)"
              value={formatMoney(model.budget.monthlyIncome)}
              delta="planned income"
              style={styles.kpiTile}
            />
            <Stat
              label={`Money in · ${shortMonth(model.latest)}`}
              value={formatMoney(model.latestIncome)}
              delta={model.latestIncome >= model.budget.monthlyIncome ? 'at/above plan' : 'below plan'}
              trend={model.latestIncome >= model.budget.monthlyIncome ? 'up' : 'down'}
              style={styles.kpiTile}
            />
            <Stat
              label={`Money out · ${shortMonth(model.latest)}`}
              value={formatMoney(model.latestSpend)}
              delta="total spending"
              style={styles.kpiTile}
            />
            <Stat
              label={`Net · ${shortMonth(model.latest)}`}
              value={formatMoney(model.latestNet)}
              delta={model.latestNet >= 0 ? 'left over' : 'overspent'}
              trend={model.latestNet >= 0 ? 'up' : 'down'}
              style={styles.kpiTile}
            />
          </View>

          <Card>
            <View style={styles.rowBetween}>
              <ThemedText type="smallBold">Budget used · {shortMonth(model.latest)}</ThemedText>
              <Pill label={overPlan ? 'Over plan' : 'On track'} tone={overPlan ? 'bad' : 'good'} />
            </View>
            <ProgressBar value={budgetProgress} />
            <ThemedText type="small" themeColor="textSecondary">
              {formatMoney(left)} left of {formatMoney(model.budget.totalExpenses)} planned expenses.
            </ThemedText>
          </Card>

          <Card>
            <ThemedText type="smallBold">Net saved per month</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Income minus spending, last 6 months.
            </ThemedText>
            <TrendBars data={model.netSeries} valueLabel={moneyK} />
          </Card>

          <BankSyncCard />
        </ScrollView>
      ) : (
        <ScrollView style={styles.panel} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Card>
            <ThemedText type="smallBold">Total monthly spend</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Last 6 months · latest highlighted.
            </ThemedText>
            <TrendBars data={model.spendSeries} valueLabel={moneyK} />
          </Card>

          <Card>
            <View style={styles.rowBetween}>
              <ThemedText type="smallBold">Top categories</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {shortMonth(model.latest)} vs 3-mo avg
              </ThemedText>
            </View>
            <RankedBars data={model.categories} valueLabel={(value) => formatMoney(value)} />
          </Card>
        </ScrollView>
      )}
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
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  kpiTile: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 140,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
