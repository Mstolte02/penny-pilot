import { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MiniBarChart } from '@/components/mini-charts';
import { Card, PageHead, PennyBadge, SegmentedToggle, Stat } from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { mobileSavingsConfig, mobileTransactions } from '@/data/personal-finance-template';
import {
  avgActualMonthlySavings,
  ewmaMonthlySavings,
  formatMoney,
  formatMonth,
  projectSavings,
} from '@/domain/mobile-finance';

type Pace = number | 'ewma';

const PACE_WINDOWS: { label: string; value: Pace }[] = [
  { label: '3-mo', value: 3 },
  { label: '6-mo', value: 6 },
  { label: '9-mo', value: 9 },
  { label: '12-mo', value: 12 },
  { label: 'EWMA', value: 'ewma' },
];

const HORIZONS: { label: string; value: number }[] = [
  { label: '1 year', value: 12 },
  { label: '2 years', value: 24 },
  { label: '3 years', value: 36 },
];

export default function SavingsScreen() {
  const [pace, setPace] = useState<Pace>('ewma');
  const [horizon, setHorizon] = useState(24);

  const model = useMemo(() => {
    const budgetedTarget = mobileSavingsConfig.monthlySavingsTarget;
    const avgSave =
      pace === 'ewma'
        ? ewmaMonthlySavings(mobileTransactions)
        : avgActualMonthlySavings(mobileTransactions, pace);

    const projection = projectSavings({
      startBalance: mobileSavingsConfig.currentSavings,
      startDate: mobileSavingsConfig.asOfDate,
      months: horizon,
      budgetedMonthly: budgetedTarget,
      actualMonthly: avgSave,
      plannedExpenses: mobileSavingsConfig.plannedExpenses,
      recurringExpenses: mobileSavingsConfig.recurringExpenses,
      apyMonthly: mobileSavingsConfig.savingsApy / 12,
    });

    const horizonPoint = projection[projection.length - 1];
    const step = Math.max(1, Math.ceil(projection.length / 6));
    const chart = projection.filter((_, index) => index % step === 0);

    return { budgetedTarget, avgSave, projection, horizonPoint, chart };
  }, [pace, horizon]);

  const gap = model.avgSave - model.budgetedTarget;
  const onTrack = gap >= 0;
  const paceLabel = PACE_WINDOWS.find((option) => option.value === pace)!.label;
  const horizonLabel = HORIZONS.find((option) => option.value === horizon)!.label;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SafeAreaView style={styles.safeArea}>
          <PageHead
            eyebrow="Savings"
            title="Savings tracker"
            subtitle="Your real saving pace vs the budget plan. EWMA weights recent months most."
            mascot={<PennyBadge expression={onTrack ? 'onTrack' : 'concerned'} />}
          />

          <View style={styles.kpiGrid}>
            <Stat
              label="Actual saving pace"
              value={`${formatMoney(model.avgSave)}/mo`}
              delta={pace === 'ewma' ? 'EWMA weighted' : `${paceLabel} average`}
              trend={onTrack ? 'up' : 'down'}
              style={styles.kpiTile}
            />
            <Stat
              label="Budgeted target"
              value={`${formatMoney(model.budgetedTarget)}/mo`}
              delta="from budget plan"
              trend="flat"
              style={styles.kpiTile}
            />
            <Stat
              label="Pace vs budget"
              value={`${gap >= 0 ? '+' : '−'}${formatMoney(Math.abs(gap))}/mo`}
              delta={onTrack ? 'ahead of plan' : 'behind plan'}
              trend={onTrack ? 'up' : 'down'}
              style={styles.kpiTile}
            />
            <Stat
              label={`Projected in ${horizonLabel}`}
              value={formatMoney(model.horizonPoint.actual)}
              delta={`budget says ${formatMoney(model.horizonPoint.budgeted)}`}
              trend={model.horizonPoint.actual >= model.horizonPoint.budgeted ? 'up' : 'down'}
              style={styles.kpiTile}
            />
          </View>

          <Card style={styles.controlsCard}>
            <ThemedText type="smallBold">Saving pace</ThemedText>
            <SegmentedToggle options={PACE_WINDOWS} value={pace} onChange={setPace} />
            <ThemedText type="smallBold">Horizon</ThemedText>
            <SegmentedToggle options={HORIZONS} value={horizon} onChange={setHorizon} />
          </Card>

          <Card style={styles.chartCard}>
            <ThemedText type="smallBold">Projected balance</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Actual-pace forecast (bars) vs the budget plan backdrop. Compounds at{' '}
              {(mobileSavingsConfig.savingsApy * 100).toFixed(1)}% APY.
            </ThemedText>
            <MiniBarChart
              data={model.chart.map((point) => ({
                label: formatMonth(point.month).replace(/ \d{2}(\d{2})$/, " '$1"),
                value: point.actual,
                comparison: point.budgeted,
              }))}
              valueLabel={(value) => formatMoney(value / 1000, 0) + 'k'}
              height={150}
            />
          </Card>

          <Card>
            <ThemedText type="smallBold">Planned big expenses</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              These bend the savings curve when they land.
            </ThemedText>
            {mobileSavingsConfig.plannedExpenses.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                None yet.
              </ThemedText>
            ) : (
              mobileSavingsConfig.plannedExpenses.map((expense) => (
                <View key={`${expense.date}-${expense.description}`} style={styles.listRow}>
                  <View style={styles.rowCopy}>
                    <ThemedText type="smallBold">{expense.description}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {expense.date}
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold">{formatMoney(expense.amount)}</ThemedText>
                </View>
              ))
            )}
          </Card>

          <Card>
            <ThemedText type="smallBold">Recurring monthly expenses</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              New ongoing costs reduce future savings.
            </ThemedText>
            {mobileSavingsConfig.recurringExpenses.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                None yet — e.g. a future car payment, gym, or new subscription.
              </ThemedText>
            ) : (
              mobileSavingsConfig.recurringExpenses.map((recurring) => (
                <View key={`${recurring.startDate}-${recurring.description}`} style={styles.listRow}>
                  <View style={styles.rowCopy}>
                    <ThemedText type="smallBold">{recurring.description}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {recurring.startDate} – {recurring.endDate ?? 'ongoing'}
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold">{formatMoney(recurring.amount)}/mo</ThemedText>
                </View>
              ))
            )}
          </Card>

          <Card>
            <ThemedText type="smallBold">Allocation plan</ThemedText>
            {mobileSavingsConfig.allocation.map((allocation) => (
              <View key={allocation.account} style={styles.listRow}>
                <View style={styles.rowCopy}>
                  <ThemedText type="smallBold">{allocation.account}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {(allocation.pct * 100).toFixed(0)}% of contributions
                  </ThemedText>
                </View>
                <ThemedText type="smallBold">{formatMoney(allocation.monthly)}/mo</ThemedText>
              </View>
            ))}
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
  controlsCard: {
    gap: Spacing.two,
  },
  chartCard: {
    gap: Spacing.two,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  rowCopy: {
    flex: 1,
    gap: Spacing.half,
  },
});
