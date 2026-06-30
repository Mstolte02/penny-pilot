import { Link } from 'expo-router';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BankSyncCard } from '@/components/bank-sync-card';
import { Card, PennyBadge, PillButton, ProgressBar } from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { budgetLines, formatMoney, goals, progress, reviewTransactions } from '@/data/sample-finance';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const theme = useTheme();
  const planned = budgetLines.reduce((sum, line) => sum + line.planned, 0);
  const spent = budgetLines.reduce((sum, line) => sum + line.spent, 0);
  const goal = goals[0];

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
                Looks like we hit a little dining turbulence, but your home fund is still climbing.
              </ThemedText>
            </View>
            <PennyBadge expression="concerned" />
          </View>

          <Card style={styles.heroCard}>
            <View style={styles.row}>
              <View>
                <ThemedText type="small" themeColor="textSecondary">
                  Monthly spending
                </ThemedText>
                <ThemedText type="subtitle">{formatMoney(spent)}</ThemedText>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="smallBold" themeColor="warning">
                  On watch
                </ThemedText>
              </View>
            </View>
            <ProgressBar value={spent / planned} />
            <ThemedText type="small" themeColor="textSecondary">
              {formatMoney(planned - spent)} left in your current budget plan.
            </ThemedText>
          </Card>

          <View style={styles.grid}>
            <Card style={styles.metricCard}>
              <ThemedText type="small" themeColor="textSecondary">
                To review
              </ThemedText>
              <ThemedText type="subtitle">{reviewTransactions.length}</ThemedText>
              <ThemedText type="small">Penny has guesses ready.</ThemedText>
            </Card>
            <Card style={styles.metricCard}>
              <ThemedText type="small" themeColor="textSecondary">
                Goal pace
              </ThemedText>
              <ThemedText type="subtitle">{formatMoney(goal.monthlyPace)}</ThemedText>
              <ThemedText type="small">Projected monthly progress.</ThemedText>
            </Card>
          </View>

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
            <ProgressBar value={progress(goal.saved, goal.target)} />
            <ThemedText type="small" themeColor="textSecondary">
              {formatMoney(goal.saved)} saved of {formatMoney(goal.target)}. Current projection:
              {' '}
              {goal.eta}.
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
