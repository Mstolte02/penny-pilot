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
 * Fixed budget lines double as the bill radar. Due days come from the most recent
 * matching transaction when one exists; otherwise they get a stable spread so the
 * prototype always has a believable "next bill".
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

export default function CockpitScreen() {
  const router = useRouter();
  const theme = useTheme();

  // First run belongs to the wizard. The flag flips when the flight plan is approved.
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
        ? `Skies are clear — ${formatMoney(safe.perDay)} a day keeps this month on plan.`
        : `Spending is a little ahead of the calendar. A quiet week brings the lines back together.`,
      `Recurring subscriptions run ${formatMoney(subscriptionsMonthly)}/mo. The full list is on the Radar tab.`,
      `${Math.round(goal.progress * 100)}% of the way to your home fund — arrival around ${goal.targetDateLabel}.`,
    ];

    return {
      safe,
      burn,
      datePosition,
      monthName,
      goal,
      nextBill,
      nextBillMonth,
      insight: insights[now.getDate() % insights.length],
    };
  }, []);

  const { safe, burn, datePosition } = view;
  const cruising = burn <= datePosition;
  const grounded = safe.perDay <= 0;
  const heroColor = grounded ? theme.danger : theme.primary;
  const mascot = grounded ? 'concerned' : cruising ? 'onTrack' : 'thinking';

  return (
    <Screen
      eyebrow="Penny Pilot"
      title="Cockpit"
      subtitle={`${view.monthName} flight in progress`}
      mascot={<PennyBadge expression={mascot} />}>
      <ScrollView
        style={styles.panel}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <ThemedText type="smallBold" style={[styles.heroLabel, { color: theme.accent }]}>
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
            {safe.daysLeft === 1 ? 'day' : 'days'} left in the month
          </ThemedText>
        </View>

        <View style={styles.gaugeBlock}>
          <AltitudeArc burn={burn} datePosition={datePosition} />
          <View style={styles.gaugeLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: cruising ? theme.primary : theme.warning }]} />
              <ThemedText type="small" themeColor="textSecondary">
                Budget burn
              </ThemedText>
            </View>
            <ThemedText type="smallBold" style={{ color: cruising ? theme.primary : theme.warning }}>
              {cruising ? 'Cruising altitude' : 'Light turbulence'}
            </ThemedText>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: theme.accent }]} />
              <ThemedText type="small" themeColor="textSecondary">
                Today
              </ThemedText>
            </View>
          </View>
        </View>

        {view.nextBill ? (
          <Pressable onPress={() => router.push('/transactions')}>
            <Card style={styles.stackCard}>
              <View style={styles.stackRow}>
                <View style={styles.stackCopy}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Next bill on approach
                  </ThemedText>
                  <ThemedText type="smallBold" numberOfLines={1}>
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
                  Destination
                </ThemedText>
                <ThemedText type="smallBold" numberOfLines={1}>
                  First home fund · arrives ~{view.goal.targetDateLabel}
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
    paddingTop: Spacing.three,
  },
  heroLabel: {
    letterSpacing: 2,
    fontSize: 12,
  },
  gaugeBlock: {
    gap: Spacing.two,
  },
  gaugeLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
