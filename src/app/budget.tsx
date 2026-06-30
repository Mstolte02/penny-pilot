import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, PennyBadge, PillButton, ProgressBar } from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { budgetLines, categories, formatMoney } from '@/data/sample-finance';

export default function BudgetScreen() {
  const fixed = budgetLines.filter((line) => line.kind === 'fixed');
  const variable = budgetLines.filter((line) => line.kind === 'variable');
  const fixedTotal = fixed.reduce((sum, line) => sum + line.planned, 0);
  const variableTotal = variable.reduce((sum, line) => sum + line.planned, 0);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <ThemedText type="smallBold" themeColor="primary">
                Budget
              </ThemedText>
              <ThemedText type="subtitle" style={styles.title}>
                Flexible by design
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                Penny suggests a route from your income and habits. You pick the final plan.
              </ThemedText>
            </View>
            <PennyBadge expression="happy" />
          </View>

          <View style={styles.grid}>
            <Card style={styles.metricCard}>
              <ThemedText type="small" themeColor="textSecondary">
                Fixed
              </ThemedText>
              <ThemedText type="subtitle">{formatMoney(fixedTotal)}</ThemedText>
              <ThemedText type="small">Bills that repeat.</ThemedText>
            </Card>
            <Card style={styles.metricCard}>
              <ThemedText type="small" themeColor="textSecondary">
                Variable
              </ThemedText>
              <ThemedText type="subtitle">{formatMoney(variableTotal)}</ThemedText>
              <ThemedText type="small">Categories that flex.</ThemedText>
            </Card>
          </View>

          <Card>
            <View style={styles.sectionHeader}>
              <View>
                <ThemedText type="smallBold">Fixed expenses</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Stable commitments Penny can forecast from rules.
                </ThemedText>
              </View>
              <PillButton>Add</PillButton>
            </View>
            {fixed.map((line) => (
              <View key={line.id} style={styles.budgetRow}>
                <View style={styles.lineCopy}>
                  <ThemedText type="smallBold">{line.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatMoney(line.spent)} of {formatMoney(line.planned)}
                  </ThemedText>
                </View>
                <ThemedText type="smallBold">{formatMoney(line.planned)}</ThemedText>
              </View>
            ))}
          </Card>

          <Card>
            <View style={styles.sectionHeader}>
              <View>
                <ThemedText type="smallBold">Variable expenses</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Behavior-based categories Penny will learn over time.
                </ThemedText>
              </View>
              <PillButton>Edit</PillButton>
            </View>
            {variable.map((line) => (
              <View key={line.id} style={styles.variableLine}>
                <View style={styles.budgetRow}>
                  <View style={styles.lineCopy}>
                    <ThemedText type="smallBold">{line.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatMoney(line.spent)} of {formatMoney(line.planned)}
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold">{Math.round((line.spent / line.planned) * 100)}%</ThemedText>
                </View>
                <ProgressBar value={line.spent / line.planned} />
              </View>
            ))}
          </Card>

          <Card>
            <ThemedText type="smallBold">Your category plan</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Starter templates are editable. Penny predicts into your categories, not ours.
            </ThemedText>
            {categories.map((category) => (
              <View key={category.name} style={styles.categoryBlock}>
                <ThemedText type="smallBold">{category.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {category.subcategories.join('  /  ')}
                </ThemedText>
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
  grid: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  metricCard: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  lineCopy: {
    flex: 1,
  },
  variableLine: {
    gap: Spacing.two,
  },
  categoryBlock: {
    gap: Spacing.half,
  },
});
