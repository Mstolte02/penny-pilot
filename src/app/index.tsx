import { Link, type Href } from 'expo-router';
import { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BankSyncCard } from '@/components/bank-sync-card';
import { Card, PennyBadge, PillButton, ProgressBar } from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  mobileBudgetPlan,
  mobileSavingsConfig,
  mobileTransactions,
} from '@/data/personal-finance-template';
import { reviewTransactions } from '@/data/sample-finance';
import {
  actualMonthlyNet,
  formatMoney,
  formatMonth,
  homeGoalForecast,
  monthlyIncome,
  monthlySpend,
  summarizeBudget,
  uniqueMonths,
} from '@/domain/mobile-finance';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const theme = useTheme();
  const model = useMemo(() => {
    const budget = summarizeBudget(mobileBudgetPlan, mobileTransactions);
    const months = uniqueMonths(mobileTransactions);
    const latestMonth = months[months.length - 1] ?? '';
    const spend = monthlySpend(mobileTransactions);
    const income = monthlyIncome(mobileTransactions);
    const net = actualMonthlyNet(mobileTransactions);
    const latestSpend = spend.find((row) => row.month === latestMonth)?.total ?? 0;
    const latestIncome = income[latestMonth] ?? 0;
    const latestNet = net[latestMonth] ?? 0;
    const goal = homeGoalForecast({
      transactions: mobileTransactions,
      savings: mobileSavingsConfig,
    });

    return {
      budget,
      latestMonth,
      latestSpend,
      latestIncome,
      latestNet,
      goal,
    };
  }, []);
  const budgetProgress =
    model.budget.totalExpenses > 0 ? model.latestSpend / model.budget.totalExpenses : 0;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <ThemedText type="smallBold" themeColor="primary">
                Penny Pilot
              </ThemedText>
              <ThemedText type="subtitle" style={styles.title}>
                Today&apos;s flight path
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                Budget, review, and goal progress in one quick pass.
              </ThemedText>
            </View>
            <PennyBadge expression={budgetProgress > 1 ? 'concerned' : 'onTrack'} />
          </View>

          <Card style={styles.heroCard}>
            <View style={styles.row}>
              <View>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatMonth(model.latestMonth)} spending
                </ThemedText>
                <ThemedText type="subtitle">{formatMoney(model.latestSpend)}</ThemedText>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="smallBold" themeColor={budgetProgress > 1 ? 'warning' : 'success'}>
                  {budgetProgress > 1 ? 'Over plan' : 'On track'}
                </ThemedText>
              </View>
            </View>
            <ProgressBar value={budgetProgress} />
            <ThemedText type="small" themeColor="textSecondary">
              {formatMoney(Math.max(0, model.budget.totalExpenses - model.latestSpend))} left
              against the current monthly plan.
            </ThemedText>
          </Card>

          <View style={styles.grid}>
            <Card style={styles.metricCard}>
              <ThemedText type="small" themeColor="textSecondary">
                Money in
              </ThemedText>
              <ThemedText type="subtitle">{formatMoney(model.latestIncome)}</ThemedText>
              <ThemedText type="small">{formatMonth(model.latestMonth)}</ThemedText>
            </Card>
            <Card style={styles.metricCard}>
              <ThemedText type="small" themeColor="textSecondary">
                Net
              </ThemedText>
              <ThemedText type="subtitle">{formatMoney(model.latestNet)}</ThemedText>
              <ThemedText type="small">Income minus spend.</ThemedText>
            </Card>
          </View>

          <Card>
            <View style={styles.actionHeader}>
              <View style={styles.actionCopy}>
                <ThemedText type="smallBold">Next best actions</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  The personal app&apos;s big sections are becoming smaller, phone-sized loops.
                </ThemedText>
              </View>
              <PennyBadge expression="thinking" animated={false} />
            </View>
            <ActionRow title="Review transactions" detail={`${reviewTransactions.length} sample items waiting`} href="/transactions" />
            <ActionRow title="Tune the budget" detail={`${formatMoney(model.budget.variableTotal)} variable forecast`} href="/budget" />
            <ActionRow title="Check home runway" detail={`Target: ${model.goal.targetDateLabel}`} href="/goals" />
          </Card>

          <Card>
            <View style={styles.setupRow}>
              <View style={styles.setupCopy}>
                <ThemedText type="smallBold">Personal setup</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Tune categories, budget style, goals, and Penny&apos;s guidance before syncing.
                </ThemedText>
              </View>
              <Link href="/setup" style={[styles.setupButton, { backgroundColor: theme.primary }]}>
                <ThemedText type="smallBold" style={styles.setupButtonText}>
                  Start
                </ThemedText>
              </Link>
            </View>
          </Card>

          <BankSyncCard />

          <Card>
            <ThemedText type="smallBold">First home</ThemedText>
            <ProgressBar value={model.goal.progress} />
            <ThemedText type="small" themeColor="textSecondary">
              {formatMoney(model.goal.currentSavings)} saved of {formatMoney(model.goal.cashNeeded)}.
              Current projection: {model.goal.targetDateLabel}.
            </ThemedText>
            <View style={styles.actions}>
              <PillButton tone="primary">Review plan</PillButton>
              <PillButton>Adjust goal</PillButton>
            </View>
          </Card>
        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

function ActionRow({ title, detail, href }: { title: string; detail: string; href: Href }) {
  return (
    <Link href={href} asChild>
      <View style={styles.actionRow}>
        <View style={styles.actionCopy}>
          <ThemedText type="smallBold">{title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {detail}
          </ThemedText>
        </View>
        <ThemedText type="smallBold">Open</ThemedText>
      </View>
    </Link>
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
    gap: Spacing.three,
    paddingTop: Platform.OS === 'web' ? Spacing.six + Spacing.three : Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
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
  heroCard: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  statusBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 999,
  },
  grid: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  metricCard: {
    flex: 1,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  actionRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  actionCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  setupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  setupCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  setupButton: {
    minHeight: 42,
    paddingHorizontal: Spacing.three,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    display: 'flex',
  },
  setupButtonText: {
    color: '#FFF8E8',
  },
});
