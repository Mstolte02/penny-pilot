import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, PennyBadge, PillButton } from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { formatMoney, reviewTransactions } from '@/data/sample-finance';
import { useTheme } from '@/hooks/use-theme';

export default function TransactionsScreen() {
  const theme = useTheme();
  const current = reviewTransactions[0];

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <ThemedText type="smallBold" themeColor="primary">
                Transaction review
              </ThemedText>
              <ThemedText type="subtitle" style={styles.title}>
                Sort it like flashcards
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                Approve Penny&apos;s guess, change it, or teach a new merchant rule.
              </ThemedText>
            </View>
            <PennyBadge expression="thinking" />
          </View>

          <Card style={styles.reviewCard}>
            <View style={styles.reviewTop}>
              <View>
                <ThemedText type="small" themeColor="textSecondary">
                  {current.date}
                </ThemedText>
                <ThemedText type="subtitle" style={styles.merchant}>
                  {current.merchant}
                </ThemedText>
              </View>
              <ThemedText type="subtitle">{formatMoney(current.amount)}</ThemedText>
            </View>

            <View style={[styles.guessBox, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="small" themeColor="textSecondary">
                Penny&apos;s guess
              </ThemedText>
              <ThemedText type="smallBold">{current.guess}</ThemedText>
              <ThemedText type="small" themeColor="success">
                {current.confidence.toUpperCase()} confidence
              </ThemedText>
            </View>

            <View style={styles.actions}>
              <PillButton tone="primary">Correct</PillButton>
              <PillButton>Change</PillButton>
              <PillButton>New category</PillButton>
            </View>
          </Card>

          <Card>
            <ThemedText type="smallBold">Up next</ThemedText>
            {reviewTransactions.slice(1).map((transaction) => (
              <View key={transaction.id} style={styles.queueRow}>
                <View style={styles.queueCopy}>
                  <ThemedText type="smallBold">{transaction.merchant}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {transaction.guess}
                  </ThemedText>
                </View>
                <ThemedText type="smallBold">{formatMoney(transaction.amount)}</ThemedText>
              </View>
            ))}
          </Card>

          <Card>
            <ThemedText type="smallBold">How Penny learns</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              First Penny checks your merchant rules, then Plaid hints, then your personal
              categories. AI only helps when a transaction is ambiguous.
            </ThemedText>
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
  reviewCard: {
    gap: Spacing.three,
  },
  reviewTop: {
    gap: Spacing.two,
  },
  merchant: {
    fontSize: 30,
    lineHeight: 35,
  },
  guessBox: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  queueCopy: {
    flex: 1,
  },
});
