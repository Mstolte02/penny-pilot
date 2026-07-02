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
  safeToSpendToday,
  summarizeBudget,
  uniqueMonths,
} from '@/domain/mobile-finance';
import { useTheme } from '@/hooks/use-theme';

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
  const theme = useTheme();
  const [active, setActive] = useState('overview');

  const model = useMemo(() => {
    const budget = summarizeBudget(mobileBudgetPlan, mobileTransactions);
    const months = uniqueMonths(mobileTransactions);
    const latest = months[months.length - 1] ?? '';
    const spends = monthlySpend(mobileTransactions);
    const income = monthlyIncome(mobileTransactions);
    const net = actualMonthlyNet(mobileTransactions);
    const safe = safeToSpendToday(mobileBudgetPlan, mobileTransactions);

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

    return { budget, latest, latestIncome, latestSpend, latestNet, safe, spendSeries, netSeries, categories };
  }, []);

  const { safe } = model;
  const status =
    safe.perDay <= 0 ? 'over' : safe.perDay < safe.dailyTarget ? 'tight' : 'good';
  const statusColor =
    status === 'over' ? theme.danger : status === 'tight' ? theme.warning : theme.success;
  const statusMascot =
    status === 'over' ? 'concerned' : status === 'tight' ? 'thinking' : 'onTrack';
  const statusNote =
    status === 'over'
      ? 'Over your flexible plan for this month.'
      : status === 'tight'
        ? 'A little tight — spend intentionally.'
        : 'You have room to spend today.';
  const flexUsed = safe.flexBudget > 0 ? safe.flexSpent / safe.flexBudget : 0;

  return (
    <Screen
      eyebrow="Penny Pilot"
      title="Today"
      mascot={<PennyBadge expression={statusMascot} />}
      segments={SEGMENTS}
      active={active}
      onSelect={setActive}>
      {active === 'overview' ? (
        <ScrollView style={styles.panel} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Card style={styles.heroCard}>
            <View style={styles.rowBetween}>
              <ThemedText type="smallBold" themeColor="accent">
                Safe to spend today
              </ThemedText>
              <Pill label={`~${formatMoney(safe.dailyTarget)}/day plan`} tone="info" />
            </View>
            <ThemedText
              style={[styles.heroValue, { color: statusColor }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}>
              {formatMoney(Math.max(0, safe.perDay))}
            </ThemedText>
            <ThemedText type="smallBold" style={{ color: statusColor }}>
              {statusNote}
            </ThemedText>
            <ProgressBar value={flexUsed} />
            <ThemedText type="small" themeColor="textSecondary">
              {formatMoney(Math.max(0, safe.remaining))} left of your {formatMoney(safe.flexBudget)}{' '}
              flexible budget · {safe.daysLeft} {safe.daysLeft === 1 ? 'day' : 'days'} left in{' '}
              {shortMonth(safe.month)}.
            </ThemedText>
          </Card>

          <View style={styles.kpiGrid}>
            <Stat
              label={`Money in · ${shortMonth(model.latest)}`}
              value={formatMoney(model.latestIncome)}
              delta={model.latestIncome >= model.budget.monthlyIncome ? 'at/above plan' : 'below plan'}
              trend={model.latestIncome >= model.budget.monthlyIncome ? 'up' : 'down'}
              style={styles.kpiTile}
            />
            <Stat
              label={`Net · ${shortMonth(model.latest)}`}
              value={formatMoney(model.latestNet)}
              delta={model.latestNet >= 0 ? 'saved' : 'overspent'}
              trend={model.latestNet >= 0 ? 'up' : 'down'}
              style={styles.kpiTile}
            />
          </View>

          <Card>
            <ThemedText type="smallBold">Net saved per month</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Green months you saved, red months you dipped in.
            </ThemedText>
            <TrendBars data={model.netSeries} valueLabel={moneyK} signed />
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
  heroCard: {
    borderColor: '#5DA9E9',
    backgroundColor: '#EAF4FD',
    gap: Spacing.two,
  },
  heroValue: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: 800,
    letterSpacing: -1,
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
