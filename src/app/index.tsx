import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BankSyncCard } from '@/components/bank-sync-card';
import { RankedBars, TrendBars } from '@/components/mini-charts';
import {
  Card,
  MonthTicker,
  PANEL_BOTTOM_INSET,
  PennyBadge,
  Pill,
  ProgressBar,
  Screen,
  TrendStat,
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

function signedMoney(value: number) {
  return `${value >= 0 ? '+' : '−'}${formatMoney(Math.abs(value))}`;
}

function pctVs(actual: number, target: number) {
  return target > 0 ? ((actual - target) / target) * 100 : undefined;
}

export default function TodayScreen() {
  const theme = useTheme();
  const [active, setActive] = useState('overview');

  const base = useMemo(() => {
    const budget = summarizeBudget(mobileBudgetPlan, mobileTransactions);
    const months = uniqueMonths(mobileTransactions);
    const spends = monthlySpend(mobileTransactions);
    const income = monthlyIncome(mobileTransactions);
    const net = actualMonthlyNet(mobileTransactions);
    const safe = safeToSpendToday(mobileBudgetPlan, mobileTransactions);
    const series = months.slice(-12);
    return { budget, months, spends, income, net, safe, series };
  }, []);

  const [month, setMonth] = useState(() => base.months[base.months.length - 1] ?? '');

  const view = useMemo(() => {
    const { budget, months, spends, income, net } = base;
    const spendRow = spends.find((row) => row.month === month);
    const incomeM = income[month] ?? 0;
    const spendM = spendRow?.total ?? 0;
    const netM = net[month] ?? 0;

    const endIndex = months.indexOf(month);
    const windowMonths = months.slice(Math.max(0, endIndex - 2), endIndex + 1);
    const categories = Object.entries(spendRow?.byCategory ?? {})
      .map(([category, value]) => {
        const avg = mean(
          windowMonths.map((m) => spends.find((row) => row.month === m)?.byCategory[category] ?? 0)
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

    return {
      incomeM,
      spendM,
      netM,
      categories,
      spendSeries: base.series.map((m) => ({
        label: shortMonth(m),
        value: spends.find((row) => row.month === m)?.total ?? 0,
      })),
      netSeries: base.series.map((m) => ({ label: shortMonth(m), value: net[m] ?? 0 })),
      budget,
    };
  }, [base, month]);

  const { safe } = base;
  const status = safe.perDay <= 0 ? 'over' : safe.perDay < safe.dailyTarget ? 'tight' : 'good';
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
              {formatMoney(Math.max(0, safe.remaining))} left of {formatMoney(safe.flexBudget)} flexible ·{' '}
              {safe.daysLeft} {safe.daysLeft === 1 ? 'day' : 'days'} to go.
            </ThemedText>
          </Card>

          <View style={styles.rowBetween}>
            <ThemedText type="smallBold">Actuals vs budget</ThemedText>
            <MonthTicker
              months={base.months}
              value={month}
              onChange={setMonth}
              formatLabel={shortMonth}
            />
          </View>

          <View style={styles.kpiRow}>
            <TrendStat
              label="Money in"
              value={formatMoney(view.incomeM)}
              deltaPct={pctVs(view.incomeM, view.budget.monthlyIncome)}
              deltaAbs={signedMoney(view.incomeM - view.budget.monthlyIncome)}
              note="vs plan"
              style={styles.kpiTile}
            />
            <TrendStat
              label="Money out"
              value={formatMoney(view.spendM)}
              deltaPct={pctVs(view.spendM, view.budget.totalExpenses)}
              deltaAbs={signedMoney(view.spendM - view.budget.totalExpenses)}
              note="vs plan"
              goodWhenUp={false}
              style={styles.kpiTile}
            />
          </View>
          <TrendStat
            label="Net saved"
            value={formatMoney(view.netM)}
            deltaPct={pctVs(view.netM, view.budget.monthlySavingsTarget)}
            deltaAbs={signedMoney(view.netM - view.budget.monthlySavingsTarget)}
            note="vs plan"
          />

          <Card>
            <ThemedText type="smallBold">Net saved per month</ThemedText>
            <TrendBars data={view.netSeries} signed />
          </Card>

          <BankSyncCard />
        </ScrollView>
      ) : (
        <ScrollView style={styles.panel} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.rowBetween}>
            <ThemedText type="smallBold">Monthly spend · dotted = 3-mo avg</ThemedText>
            <MonthTicker
              months={base.months}
              value={month}
              onChange={setMonth}
              formatLabel={shortMonth}
            />
          </View>

          <Card>
            <TrendBars data={view.spendSeries} height={140} />
          </Card>

          <Card>
            <View style={styles.rowBetween}>
              <ThemedText type="smallBold">Top categories · {shortMonth(month)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                vs 3-mo avg
              </ThemedText>
            </View>
            <RankedBars data={view.categories} valueLabel={(value) => formatMoney(value)} />
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
  kpiRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  kpiTile: {
    flex: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
