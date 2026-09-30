import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, View } from 'react-native';

import { FadeInUp } from '@/components/penny-motion';
import {
  Card,
  PANEL_BOTTOM_INSET,
  PennyBadge,
  Pill,
  PillButton,
  ProgressBar,
  Screen,
  SpeechBubble,
} from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatMoney, monthKey, safeToSpendToday, uniqueMonths } from '@/domain/mobile-finance';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useTheme } from '@/hooks/use-theme';
import { planFromLines, useFinance } from '@/services/finance-store';

const STREAK_KEY = 'penny.hangar.streak.v1';

type Wing = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  requirement: string;
  unlocked: boolean;
};

type Rank = { name: string; minXp: number };

/** Pilot ranks. Thresholds are tuned so a real month of use reaches First Officer. */
const RANKS: Rank[] = [
  { name: 'Cadet', minXp: 0 },
  { name: 'First Officer', minXp: 150 },
  { name: 'Captain', minXp: 400 },
  { name: 'Squadron Leader', minXp: 800 },
  { name: 'Ace', minXp: 1400 },
];

function rankFor(xp: number) {
  const current = [...RANKS].reverse().find((rank) => xp >= rank.minXp) ?? RANKS[0];
  const next = RANKS[RANKS.indexOf(current) + 1] ?? null;
  const progress = next
    ? (xp - current.minXp) / (next.minXp - current.minXp)
    : 1;
  return { current, next, progress };
}

async function bumpDailyStreak(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = await AsyncStorage.getItem(STREAK_KEY);
    const stored = raw ? (JSON.parse(raw) as { lastDay: string; count: number }) : null;
    if (stored?.lastDay === today) return stored.count;

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const count = stored?.lastDay === yesterday ? stored.count + 1 : 1;
    await AsyncStorage.setItem(STREAK_KEY, JSON.stringify({ lastDay: today, count }));
    return count;
  } catch {
    return 1;
  }
}

/** Penny taxis across the hangar once on mount — a flourish, not a loop. */
function TaxiingPenny({ expression }: { expression: 'celebrating' | 'onTrack' }) {
  const reducedMotion = useReducedMotion();
  const [taxi] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));

  useEffect(() => {
    if (reducedMotion) {
      taxi.setValue(1);
      return;
    }
    const animation = Animated.timing(taxi, {
      toValue: 1,
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [taxi, reducedMotion]);

  return (
    <Animated.View
      style={{
        alignSelf: 'center',
        opacity: taxi,
        transform: [
          { translateX: taxi.interpolate({ inputRange: [0, 1], outputRange: [-120, 0] }) },
        ],
      }}>
      <PennyBadge expression={expression} size={96} />
    </Animated.View>
  );
}

export default function HangarScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { transactions, planLines, goals, cancelFlags, resolvedReviewIds } = useFinance();
  const [streak, setStreak] = useState(1);

  useEffect(() => {
    bumpDailyStreak().then(setStreak).catch(() => {});
  }, []);

  const view = useMemo(() => {
    const now = new Date();
    const safe = safeToSpendToday(planFromLines(planLines), transactions, now);
    const ownTransactions = transactions.filter((transaction) => transaction.source !== 'sample');
    const categorized = ownTransactions.filter(
      (transaction) => transaction.category && transaction.category !== 'Uncategorized'
    );
    const monthsOfHistory = uniqueMonths(transactions).length;
    const reviewsResolved = resolvedReviewIds.length;
    const sections = new Set(planLines.map((line) => line.section)).size;
    const cancelsFlagged = Object.values(cancelFlags).filter(Boolean).length;

    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const daysWithSpend = new Set(
      transactions
        .filter(
          (transaction) => transaction.type === 'expense' && monthKey(transaction.date) === month
        )
        .map((transaction) => transaction.date.slice(8, 10))
    );
    const noSpendDays = Math.max(0, now.getDate() - daysWithSpend.size);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const onPace =
      safe.flexBudget > 0 && safe.flexSpent / safe.flexBudget <= now.getDate() / daysInMonth;

    // XP: earned by using the app on your own money, not by tapping around.
    const xp =
      Math.min(categorized.length, 60) * 5 +
      monthsOfHistory * 25 +
      goals.length * 40 +
      Math.min(reviewsResolved, 30) * 10 +
      (sections >= 3 ? 50 : 0) +
      cancelsFlagged * 20 +
      (onPace ? 35 : 0);

    const wings: Wing[] = [
      {
        id: 'first-flight',
        icon: 'airplane',
        title: 'First Flight',
        requirement: 'Finish setup with a budget on board',
        unlocked: planLines.length > 0,
      },
      {
        id: 'paper-trail',
        icon: 'document-text',
        title: 'Paper Trail',
        requirement: 'Import your first bank file',
        unlocked: ownTransactions.some((transaction) => transaction.source === 'import'),
      },
      {
        id: 'sorter',
        icon: 'funnel',
        title: 'Sorter',
        requirement: 'Categorize 10 of your own transactions',
        unlocked: categorized.length >= 10,
      },
      {
        id: 'subscription-slayer',
        icon: 'cut',
        title: 'Subscription Slayer',
        requirement: 'Flag a subscription to cancel',
        unlocked: cancelsFlagged > 0,
      },
      {
        id: 'destination-set',
        icon: 'flag',
        title: 'Destination Set',
        requirement: 'Create a savings goal',
        unlocked: goals.length > 0,
      },
      {
        id: 'smooth-air',
        icon: 'speedometer',
        title: 'Smooth Air',
        requirement: 'Stay at or under pace for the month',
        unlocked: onPace,
      },
      {
        id: 'no-spend-trio',
        icon: 'leaf',
        title: 'No-Spend Trio',
        requirement: 'Three no-spend days in one month',
        unlocked: noSpendDays >= 3,
      },
      {
        id: 'long-haul',
        icon: 'calendar',
        title: 'Long Haul',
        requirement: 'Six months of history on record',
        unlocked: monthsOfHistory >= 6,
      },
    ];

    return { xp, wings, safe, onPace, noSpendDays };
  }, [transactions, planLines, goals, cancelFlags, resolvedReviewIds]);

  const { current, next, progress } = rankFor(view.xp);
  const unlockedCount = view.wings.filter((wing) => wing.unlocked).length;

  return (
    <Screen
      eyebrow="Flight school"
      title="The Hangar"
      subtitle="Good money habits earn you wings"
      mascot={<PennyBadge expression="celebrating" />}>
      <ScrollView
        style={styles.panel}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>
        <TaxiingPenny expression={view.onPace ? 'celebrating' : 'onTrack'} />

        <FadeInUp delay={60}>
          <Card style={styles.rankCard}>
            <View style={styles.rankHead}>
              <View style={styles.rankCopy}>
                <ThemedText type="small" themeColor="textSecondary">
                  Pilot rank
                </ThemedText>
                <ThemedText type="section">{current.name}</ThemedText>
              </View>
              <Pill label={`${view.xp} XP`} tone="cat" />
            </View>
            <ProgressBar value={progress} />
            <ThemedText type="small" themeColor="textSecondary">
              {next
                ? `${next.minXp - view.xp} XP to ${next.name}. You earn XP by categorizing, importing, setting goals, and staying on pace.`
                : 'Top of the ladder. Penny salutes you.'}
            </ThemedText>
          </Card>
        </FadeInUp>

        <FadeInUp delay={120}>
          <Card style={styles.streakCard}>
            <View style={styles.streakRow}>
              <View style={[styles.streakBadge, { backgroundColor: theme.backgroundSelected }]}>
                <Ionicons name="flame" size={22} color={theme.primary} />
              </View>
              <View style={styles.rankCopy}>
                <ThemedText type="smallBold">
                  {streak}-day check-in streak
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Checking in often makes every other money habit easier.
                </ThemedText>
              </View>
            </View>
          </Card>
        </FadeInUp>

        <FadeInUp delay={180}>
          <Card style={styles.wingsCard}>
            <View style={styles.rankHead}>
              <ThemedText type="smallBold">Wings</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {unlockedCount} of {view.wings.length} earned
              </ThemedText>
            </View>
            <View style={styles.wingsGrid}>
              {view.wings.map((wing) => (
                <View
                  key={wing.id}
                  style={[
                    styles.wing,
                    {
                      borderColor: wing.unlocked ? theme.primary : theme.border,
                      backgroundColor: wing.unlocked
                        ? theme.backgroundSelected
                        : theme.background,
                      opacity: wing.unlocked ? 1 : 0.55,
                    },
                  ]}>
                  <Ionicons
                    name={wing.unlocked ? wing.icon : 'lock-closed'}
                    size={20}
                    color={wing.unlocked ? theme.primary : theme.textSecondary}
                  />
                  <ThemedText type="smallBold" numberOfLines={1} style={styles.wingTitle}>
                    {wing.title}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                    numberOfLines={2}
                    style={styles.wingRequirement}>
                    {wing.requirement}
                  </ThemedText>
                </View>
              ))}
            </View>
          </Card>
        </FadeInUp>

        <FadeInUp delay={240}>
          <SpeechBubble expression={view.onPace ? 'celebrating' : 'thinking'}>
            {view.onPace
              ? `Smooth flying this month. You still have ${formatMoney(Math.max(0, view.safe.flexBudget - view.safe.flexSpent))} in the tank.`
              : 'Wings come from real habits. One good week could earn you the next one.'}
          </SpeechBubble>
        </FadeInUp>

        <PillButton onPress={() => router.back()}>Back to the cockpit</PillButton>
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
  rankCard: {
    gap: Spacing.two,
  },
  rankHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  rankCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  streakCard: {
    gap: Spacing.two,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  streakBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wingsCard: {
    gap: Spacing.two,
  },
  wingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  wing: {
    width: '47.5%',
    borderWidth: 1,
    borderRadius: 5,
    padding: Spacing.two,
    gap: 4,
  },
  wingTitle: {
    fontSize: 13,
  },
  wingRequirement: {
    fontSize: 11.5,
    lineHeight: 15,
  },
});
