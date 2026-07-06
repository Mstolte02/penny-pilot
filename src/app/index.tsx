import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PennyBriefing } from '@/components/penny-briefing';
import { CountUpMoney, FadeInUp } from '@/components/penny-motion';
import {
  Card,
  FuelGauge,
  PANEL_BOTTOM_INSET,
  PennyBadge,
  Pill,
  ProgressBar,
  Screen,
} from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { SETUP_COMPLETE_KEY } from '@/constants/penny-voice';
import { daysInMonthOf, formatMoney, formatMonth, safeToSpendToday } from '@/domain/mobile-finance';
import { pennyInsights } from '@/domain/penny-insights';
import { useTheme } from '@/hooks/use-theme';
import { planFromLines, useFinance, type PlanLine, type StoredTransaction } from '@/services/finance-store';

type UpcomingBill = {
  name: string;
  amount: number;
  dueDay: number;
  monthOffset: 0 | 1;
};

/**
 * Fixed budget lines double as the bill reminder list. Due days come from the most
 * recent matching transaction when one exists; otherwise they get a stable spread
 * so the prototype always has a believable "next bill".
 */
function upcomingBills(
  dayOfMonth: number,
  planLines: PlanLine[],
  transactions: StoredTransaction[]
): UpcomingBill[] {
  const bills = planLines
    .filter((line) => line.type === 'fixed' && line.amount > 0)
    .map((line, index) => {
      const lastPosting = [...transactions]
        .reverse()
        .find((transaction) => transaction.item === line.name);
      const dueDay = lastPosting ? Number(lastPosting.date.slice(8, 10)) : ((index * 7) % 27) + 2;
      return { name: line.name, amount: line.amount, dueDay };
    });

  return bills
    .map<UpcomingBill>((bill) => ({
      ...bill,
      monthOffset: bill.dueDay >= dayOfMonth ? 0 : 1,
    }))
    .sort((a, b) => a.monthOffset - b.monthOffset || a.dueDay - b.dueDay);
}

export default function OverviewScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { transactions, planLines, goals } = useFinance();

  // First run belongs to the setup wizard; the flag flips when setup is approved.
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(SETUP_COMPLETE_KEY)
      .then((value) => {
        if (mounted && !value) router.replace('/setup');
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [router]);

  const view = useMemo(() => {
    const now = new Date();
    const safe = safeToSpendToday(planFromLines(planLines), transactions, now);
    const totalDays = daysInMonthOf(safe.month) || 30;
    const dayOfMonth = Math.min(totalDays, Math.max(1, now.getDate()));
    const datePosition = dayOfMonth / totalDays;
    const burn = safe.flexBudget > 0 ? safe.flexSpent / safe.flexBudget : 0;
    const bills = upcomingBills(dayOfMonth, planLines, transactions);
    const goal = goals[0] ?? null;
    const goalProgress = goal && goal.target > 0 ? Math.min(goal.current / goal.target, 1) : 0;
    const goalArrival = goal ? formatMonth(goal.targetDate) : '';
    const monthName = now.toLocaleDateString('en-US', { month: 'long' });
    const nextBill = bills[0] ?? null;
    const nextBillMonth = new Date(
      now.getFullYear(),
      now.getMonth() + (nextBill?.monthOffset ?? 0),
      1
    ).toLocaleDateString('en-US', { month: 'short' });

    const insights = pennyInsights({
      transactions,
      goals,
      flexBudget: safe.flexBudget,
      flexSpent: safe.flexSpent,
      now,
    });

    return {
      safe,
      burn,
      datePosition,
      dayOfMonth,
      totalDays,
      monthName,
      goal,
      goalProgress,
      goalArrival,
      nextBill,
      nextBillMonth,
      insights,
    };
  }, [transactions, planLines, goals]);

  const { safe, burn, datePosition } = view;
  const onTrack = burn <= datePosition;
  const overBudget = safe.perDay <= 0;
  const heroColor = overBudget ? theme.danger : theme.primary;
  const mascot = overBudget ? 'concerned' : onTrack ? 'onTrack' : 'thinking';

  return (
    <Screen
      eyebrow="Penny Pilot"
      title="Overview"
      subtitle={`${view.monthName} at a glance`}
      mascot={<PennyBadge expression={mascot} />}>
      <ScrollView
        style={styles.panel}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>
        <FadeInUp style={styles.hero}>
          <ThemedText type="smallBold" style={[styles.heroLabel, { color: theme.secondary }]}>
            SAFE TO SPEND TODAY
          </ThemedText>
          <CountUpMoney
            value={Math.max(0, safe.perDay)}
            format={(value) => formatMoney(value)}
            style={{ color: heroColor }}
          />
          <ThemedText type="small" themeColor="textSecondary">
            ~{formatMoney(safe.dailyTarget)}/day plan · {safe.daysLeft}{' '}
            {safe.daysLeft === 1 ? 'day' : 'days'} left in {view.monthName}
          </ThemedText>
        </FadeInUp>

        <FadeInUp delay={80}>
          <Card style={styles.gaugeCard}>
            <View style={styles.gaugeHead}>
              <ThemedText type="smallBold">Monthly safe-to-spend tank</ThemedText>
              <Pill
                label={overBudget ? 'Empty' : onTrack ? 'Healthy' : 'Running low'}
                tone={overBudget ? 'bad' : onTrack ? 'good' : 'info'}
              />
            </View>
            <FuelGauge
              label={`${formatMoney(Math.max(0, safe.flexBudget - safe.flexSpent))} left`}
              spent={safe.flexSpent}
              capacity={safe.flexBudget}
              detail={`${formatMoney(safe.flexSpent)} spent of ${formatMoney(safe.flexBudget)}`}
              color={overBudget ? theme.danger : onTrack ? theme.primary : theme.warning}
              formatValue={(value) => formatMoney(value)}
            />
          </Card>
        </FadeInUp>

        <FadeInUp delay={140}>
          <PennyBriefing insights={view.insights} />
        </FadeInUp>

        {view.nextBill ? (
          <FadeInUp delay={200}>
            <Card style={styles.stackCard}>
              <View style={styles.stackRow}>
                <View style={styles.stackCopy}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Next bill
                  </ThemedText>
                  <ThemedText type="smallBold" numberOfLines={2}>
                    {view.nextBill.name} · {view.nextBillMonth} {view.nextBill.dueDay}
                  </ThemedText>
                </View>
                <ThemedText type="money" style={{ fontSize: 18 }}>
                  {formatMoney(view.nextBill.amount)}
                </ThemedText>
              </View>
            </Card>
          </FadeInUp>
        ) : null}

        {view.goal ? (
          <FadeInUp delay={260}>
            <Pressable onPress={() => router.push('/budget')}>
              <Card style={styles.stackCard}>
                <View style={styles.stackRow}>
                  <View style={styles.stackCopy}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Goal progress
                    </ThemedText>
                    <ThemedText type="smallBold" numberOfLines={2}>
                      {view.goal.name} · arrival by {view.goalArrival}
                    </ThemedText>
                  </View>
                  <Pill label={`${Math.round(view.goalProgress * 100)}%`} tone="cat" />
                </View>
                <ProgressBar value={view.goalProgress} />
              </Card>
            </Pressable>
          </FadeInUp>
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
  hero: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.two,
  },
  heroLabel: {
    letterSpacing: 2,
    fontSize: 12,
  },
  gaugeCard: {
    gap: Spacing.two,
  },
  gaugeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  stackCard: {
    gap: Spacing.two,
  },
  stackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  stackCopy: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
});
