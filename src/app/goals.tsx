import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { TrendBars } from '@/components/mini-charts';
import {
  Card,
  PANEL_BOTTOM_INSET,
  PennyBadge,
  Pill,
  ProgressBar,
  Screen,
  SegmentedToggle,
  Stat,
  StatRow,
} from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { mobileSavingsConfig, mobileTransactions } from '@/data/personal-finance-template';
import {
  avgActualMonthlySavings,
  ewmaMonthlySavings,
  formatMoney,
  formatMonth,
  homeGoalForecast,
  projectSavings,
} from '@/domain/mobile-finance';

const SEGMENTS = [
  { label: 'Goal', value: 'goal' },
  { label: 'Savings', value: 'savings' },
];

type Pace = number | 'ewma';

const PACE_WINDOWS: { label: string; value: Pace }[] = [
  { label: '3-mo', value: 3 },
  { label: '6-mo', value: 6 },
  { label: '12-mo', value: 12 },
  { label: 'EWMA', value: 'ewma' },
];

const HORIZON = 24;

function shortMonth(month: string) {
  return formatMonth(month).replace(/ \d{2}(\d{2})$/, " '$1");
}

export default function GoalsScreen() {
  const [active, setActive] = useState('goal');
  const [pace, setPace] = useState<Pace>('ewma');

  const homeGoal = useMemo(
    () => homeGoalForecast({ transactions: mobileTransactions, savings: mobileSavingsConfig }),
    []
  );

  const savings = useMemo(() => {
    const budgetedTarget = mobileSavingsConfig.monthlySavingsTarget;
    const avgSave =
      pace === 'ewma'
        ? ewmaMonthlySavings(mobileTransactions)
        : avgActualMonthlySavings(mobileTransactions, pace);
    const projection = projectSavings({
      startBalance: mobileSavingsConfig.currentSavings,
      startDate: mobileSavingsConfig.asOfDate,
      months: HORIZON,
      budgetedMonthly: budgetedTarget,
      actualMonthly: avgSave,
      plannedExpenses: mobileSavingsConfig.plannedExpenses,
      recurringExpenses: mobileSavingsConfig.recurringExpenses,
      apyMonthly: mobileSavingsConfig.savingsApy / 12,
    });
    const horizonPoint = projection[projection.length - 1];
    const step = Math.max(1, Math.ceil(projection.length / 6));
    const chart = projection
      .filter((_, index) => index % step === 0)
      .map((point) => ({ label: shortMonth(point.month), value: point.actual }));

    return { budgetedTarget, avgSave, horizonPoint, chart };
  }, [pace]);

  const gap = savings.avgSave - savings.budgetedTarget;
  const onTrack = gap >= 0;

  return (
    <Screen
      eyebrow="Goals"
      title="Goals"
      mascot={<PennyBadge expression={onTrack ? 'onTrack' : 'concerned'} />}
      segments={SEGMENTS}
      active={active}
      onSelect={setActive}>
      {active === 'goal' ? (
        <ScrollView style={styles.panel} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Card>
            <View style={styles.rowBetween}>
              <ThemedText type="smallBold">First home fund</ThemedText>
              <Pill label={`${Math.round(homeGoal.progress * 100)}%`} tone="cat" />
            </View>
            <ProgressBar value={homeGoal.progress} />
            <StatRow
              label="Saved so far"
              value={formatMoney(homeGoal.currentSavings)}
              divider={false}
            />
            <StatRow label="Cash needed" value={formatMoney(homeGoal.cashNeeded)} />
            <StatRow label="Target date" value={homeGoal.targetDateLabel} />
            <StatRow
              label="Savings pace"
              value={`${formatMoney(homeGoal.monthlySavingsPace)}/mo`}
            />
            <StatRow
              label="Est. payment"
              value={`${formatMoney(homeGoal.monthlyPayment)}/mo`}
            />
          </Card>

          <Card>
            <ThemedText type="smallBold">What the cash covers</ThemedText>
            <StatRow label="Down payment" value={formatMoney(homeGoal.downPayment)} divider={false} />
            <StatRow label="Closing costs" value={formatMoney(homeGoal.closingCosts)} />
          </Card>
        </ScrollView>
      ) : (
        <ScrollView style={styles.panel} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.kpiGrid}>
            <Stat
              label="Actual pace"
              value={`${formatMoney(savings.avgSave)}/mo`}
              delta={onTrack ? 'ahead of plan' : 'behind plan'}
              trend={onTrack ? 'up' : 'down'}
              style={styles.kpiTile}
            />
            <Stat
              label="Budget target"
              value={`${formatMoney(savings.budgetedTarget)}/mo`}
              delta={`${gap >= 0 ? '+' : '−'}${formatMoney(Math.abs(gap))} gap`}
              trend={onTrack ? 'up' : 'down'}
              style={styles.kpiTile}
            />
          </View>

          <Card>
            <ThemedText type="smallBold">Saving pace model</ThemedText>
            <SegmentedToggle options={PACE_WINDOWS} value={pace} onChange={setPace} />
            <ThemedText type="small" themeColor="textSecondary">
              Projected balance in 2 years: {formatMoney(savings.horizonPoint.actual)} (budget says{' '}
              {formatMoney(savings.horizonPoint.budgeted)}).
            </ThemedText>
            <TrendBars data={savings.chart} averageWindow={0} height={140} />
          </Card>

          <Card>
            <ThemedText type="smallBold">Planned big expenses</ThemedText>
            {mobileSavingsConfig.plannedExpenses.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                None yet.
              </ThemedText>
            ) : (
              mobileSavingsConfig.plannedExpenses.map((expense, index) => (
                <StatRow
                  key={`${expense.date}-${expense.description}`}
                  label={expense.description}
                  sublabel={expense.date}
                  value={formatMoney(expense.amount)}
                  divider={index > 0}
                />
              ))
            )}
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
