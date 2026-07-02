import { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, PennyBadge, PillButton, ProgressBar } from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  mobileSavingsConfig,
  mobileTransactions,
} from '@/data/personal-finance-template';
import {
  avgActualMonthlySavings,
  ewmaMonthlySavings,
  formatMoney,
  homeGoalForecast,
} from '@/domain/mobile-finance';

export default function GoalsScreen() {
  const homeGoal = useMemo(
    () =>
      homeGoalForecast({
        transactions: mobileTransactions,
        savings: mobileSavingsConfig,
      }),
    []
  );
  const avgSix = useMemo(() => avgActualMonthlySavings(mobileTransactions, 6), []);
  const ewma = useMemo(() => ewmaMonthlySavings(mobileTransactions), []);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <ThemedText type="smallBold" themeColor="primary">
                Goals
              </ThemedText>
              <ThemedText type="subtitle" style={styles.title}>
                Big purchases, clear runway
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                Penny starts with a simple savings pace, then compares models as history grows.
              </ThemedText>
            </View>
            <PennyBadge expression="onTrack" />
          </View>

          <Card style={styles.goalCard}>
            <View style={styles.goalHeader}>
              <View style={styles.goalCopy}>
                <ThemedText type="small" themeColor="textSecondary">
                  Home buying
                </ThemedText>
                <ThemedText type="subtitle">First home fund</ThemedText>
              </View>
              <ThemedText type="smallBold">{Math.round(homeGoal.progress * 100)}%</ThemedText>
            </View>
            <ProgressBar value={homeGoal.progress} />
            <ThemedText type="small" themeColor="textSecondary">
              {formatMoney(homeGoal.currentSavings)} saved toward {formatMoney(homeGoal.cashNeeded)} cash
              needed.
            </ThemedText>
            <View style={styles.metricGrid}>
              <Metric label="Target date" value={homeGoal.targetDateLabel} />
              <Metric label="Savings pace" value={`${formatMoney(homeGoal.monthlySavingsPace)}/mo`} />
              <Metric label="Cash needed" value={formatMoney(homeGoal.cashNeeded)} />
              <Metric label="Est. payment" value={`${formatMoney(homeGoal.monthlyPayment)}/mo`} />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              Cash needed includes {formatMoney(homeGoal.downPayment)} down payment and{' '}
              {formatMoney(homeGoal.closingCosts)} estimated closing costs.
            </ThemedText>
          </Card>

          <Card>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionCopy}>
                <ThemedText type="smallBold">Savings model</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  The app can keep the methodology quiet, but Penny still compares the signals.
                </ThemedText>
              </View>
              <PennyBadge expression="thinking" animated={false} />
            </View>
            <View style={styles.modelRow}>
              <Metric label="6-mo average" value={`${formatMoney(avgSix)}/mo`} />
              <Metric label="EWMA pace" value={`${formatMoney(ewma)}/mo`} />
            </View>
            <ThemedText type="small" themeColor="success">
              Current default: EWMA, because it reacts faster to recent saving behavior.
            </ThemedText>
          </Card>

          <Card>
            <ThemedText type="smallBold">Planned expenses</ThemedText>
            {mobileSavingsConfig.plannedExpenses.map((expense) => (
              <View key={`${expense.date}-${expense.description}`} style={styles.listRow}>
                <View style={styles.rowCopy}>
                  <ThemedText type="smallBold">{expense.description}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {expense.date}
                  </ThemedText>
                </View>
                <ThemedText type="smallBold">{formatMoney(expense.amount)}</ThemedText>
              </View>
            ))}
          </Card>

          <Card>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionCopy}>
                <ThemedText type="smallBold">Allocation plan</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  The same contribution logic can support retirement, house fund, savings, or any custom goal.
                </ThemedText>
              </View>
              <PillButton>Add</PillButton>
            </View>
            {mobileSavingsConfig.allocation.map((allocation) => (
              <View key={allocation.account} style={styles.listRow}>
                <View style={styles.rowCopy}>
                  <ThemedText type="smallBold">{allocation.account}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {(allocation.pct * 100).toFixed(0)}% of planned contributions
                  </ThemedText>
                </View>
                <ThemedText type="smallBold">{formatMoney(allocation.monthly)}/mo</ThemedText>
              </View>
            ))}
          </Card>

          <Card>
            <ThemedText type="smallBold">More goal templates</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Car, emergency fund, vacation, wedding, moving, loan payoff, credit card payoff, or
              custom.
            </ThemedText>
            <PillButton tone="primary">Create goal</PillButton>
          </Card>
        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  headerCopy: {
    flex: 1,
    gap: Spacing.one,
  },
  title: {
    fontSize: 34,
    lineHeight: 38,
  },
  goalCard: {
    gap: Spacing.three,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  goalCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  metric: {
    flexGrow: 1,
    flexBasis: '45%',
    gap: Spacing.half,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sectionCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  modelRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  rowCopy: {
    flex: 1,
    gap: Spacing.half,
  },
});
