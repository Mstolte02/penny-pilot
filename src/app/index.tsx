import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  AltitudeArc,
  Card,
  PANEL_BOTTOM_INSET,
  PennyBadge,
  Pill,
  ProgressBar,
  Screen,
  SpeechBubble,
} from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { SETUP_COMPLETE_KEY } from '@/constants/penny-voice';
import { mobileBudgetPlan, mobileSavingsConfig, mobileTransactions } from '@/data/personal-finance-template';
import {
  daysInMonthOf,
  formatMoney,
  homeGoalForecast,
  safeToSpendToday,
} from '@/domain/mobile-finance';
import { useTheme } from '@/hooks/use-theme';

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
function upcomingBills(dayOfMonth: number): UpcomingBill[] {
  const bills = mobileBudgetPlan.sections
    .flatMap((section) => section.lines)
    .filter((line) => line.type === 'fixed' && (line.monthly ?? 0) > 0)
    .map((line, index) => {
      const lastPosting = [...mobileTransactions]
        .reverse()
        .find((transaction) => transaction.item === line.name);
      const dueDay = lastPosting ? Number(lastPosting.date.slice(8, 10)) : ((index * 7) % 27) + 2;
      return { name: line.name, amount: line.monthly ?? 0, dueDay };
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
    const safe = safeToSpendToday(mobileBudgetPlan, mobileTransactions, now);
    const totalDays = daysInMonthOf(safe.month) || 30;
    const dayOfMonth = Math.min(totalDays, Math.max(1, now.getDate()));
    const datePosition = dayOfMonth / totalDays;
    const burn = safe.flexBudget > 0 ? safe.flexSpent / safe.flexBudget : 0;
    const bills = upcomingBills(dayOfMonth);
    const goal = homeGoalForecast({ transactions: mobileTransactions, savings: mobileSavingsConfig });
    const monthName = now.toLocaleDateString('en-US', { month: 'long' });
    const nextBill = bills[0] ?? null;
    const nextBillMonth = new Date(
      now.getFullYear(),
      now.getMonth() + (nextBill?.monthOffset ?? 0),
      1
    ).toLocaleDateString('en-US', { month: 'short' });

    const subscriptionsMonthly = mobileBudgetPlan.sections
      .find((section) => section.title === 'Subscriptions & Fun')!
      .lines.filter((line) => line.name !== 'Fun Money')
      .reduce((sum, line) => sum + (line.monthly ?? 0), 0);

    const insights = [
      burn <= datePosition
        ? `You're on plan — ${formatMoney(safe.perDay)} a day keeps it that way.`
        : `Spending is a little ahead of the calendar. A quiet week brings it back in line.`,
      `Recurring subscriptions run ${formatMoney(subscriptionsMonthly)}/mo. The full list is on the Transactions tab.`,
      `${Math.round(goal.progress * 100)}% of the way to your home fund — on track for ${goal.targetDateLabel}.`,
    ];

    return {
      safe,
      burn,
      datePosition,
      dayOfMonth,
      totalDays,
      monthName,
      goal,
      nextBill,
      nextBillMonth,
      insight: insights[now.getDate() % insights.length],
    };
  }, []);

  const { safe, burn, datePosition } = view;
  const onTrack = burn <= datePosition;
  const overBudget = safe.perDay <= 0;
  const heroColor = overBudget ? theme.danger : theme.primary;
  const mascot = overBudget ? 'concerned' : onTrack ? 'onTrack' : 'thinking';
  const burnPct = Math.round(Math.min(burn, 1) * 100);
  const datePct = Math.round(datePosition * 100);

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
        <View style={styles.hero}>
          <ThemedText type="smallBold" style={[styles.heroLabel, { color: theme.secondary }]}>
            SAFE TO SPEND TODAY
          </ThemedText>
          <ThemedText
            type="hero"
            style={{ color: heroColor }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}>
            {formatMoney(Math.max(0, safe.perDay))}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            ~{formatMoney(safe.dailyTarget)}/day plan · {safe.daysLeft}{' '}
            {safe.daysLeft === 1 ? 'day' : 'days'} left in {view.monthName}
          </ThemedText>
        </View>

        <Card style={styles.gaugeCard}>
          <View style={styles.gaugeHead}>
            <ThemedText type="smallBold">Month progress</ThemedText>
            <Pill label={onTrack ? 'On track' : 'Ahead of pace'} tone={onTrack ? 'good' : 'bad'} />
          </View>
          <AltitudeArc
            burn={burn}
            datePosition={datePosition}
            centerLabel={`${burnPct}% spent`}
            centerSub={`day ${view.dayOfMonth} of ${view.totalDays}`}
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.gaugeCaption}>
            The fill is how much of {view.monthName}&apos;s flexible budget is spent ({burnPct}%).
            The dark pin marks today ({datePct}% through the month) — staying behind the pin means
            you&apos;re on track.
          </ThemedText>
        </Card>

        {view.nextBill ? (
          <Pressable onPress={() => router.push('/transactions')}>
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
          </Pressable>
        ) : null}

        <Pressable onPress={() => router.push('/budget')}>
          <Card style={styles.stackCard}>
            <View style={styles.stackRow}>
              <View style={styles.stackCopy}>
                <ThemedText type="small" themeColor="textSecondary">
                  Goal progress
                </ThemedText>
                <ThemedText type="smallBold" numberOfLines={2}>
                  First home fund · arrival by {view.goal.targetDateLabel}
                </ThemedText>
              </View>
              <Pill label={`${Math.round(view.goal.progress * 100)}%`} tone="cat" />
            </View>
            <ProgressBar value={view.goal.progress} />
          </Card>
        </Pressable>

        <SpeechBubble expression={mascot}>{view.insight}</SpeechBubble>
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
  gaugeCaption: {
    textAlign: 'center',
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
