import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, PennyBadge, PillButton, ProgressBar } from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { formatMoney, goals, progress } from '@/data/sample-finance';

export default function GoalsScreen() {
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
                Start simple. Penny can upgrade the forecast model as your history grows.
              </ThemedText>
            </View>
            <PennyBadge expression="onTrack" />
          </View>

          {goals.map((goal) => (
            <Card key={goal.id} style={styles.goalCard}>
              <View style={styles.goalHeader}>
                <View style={styles.goalCopy}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {goal.type}
                  </ThemedText>
                  <ThemedText type="smallBold">{goal.name}</ThemedText>
                </View>
                <ThemedText type="smallBold">
                  {Math.round(progress(goal.saved, goal.target) * 100)}%
                </ThemedText>
              </View>
              <ProgressBar value={progress(goal.saved, goal.target)} />
              <ThemedText type="small" themeColor="textSecondary">
                {formatMoney(goal.saved)} saved of {formatMoney(goal.target)}. Current pace:
                {' '}
                {formatMoney(goal.monthlyPace)} per month.
              </ThemedText>
              <View style={styles.goalFooter}>
                <ThemedText type="smallBold">Projected: {goal.eta}</ThemedText>
                <PillButton>Details</PillButton>
              </View>
            </Card>
          ))}

          <Card>
            <ThemedText type="smallBold">Goal templates</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Home, car, emergency fund, vacation, wedding, moving, loan payoff, credit card
              payoff, or custom.
            </ThemedText>
            <PillButton tone="primary">Create goal</PillButton>
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
  },
  goalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
