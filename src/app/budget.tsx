import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, PennyBadge, PillButton, ProgressBar } from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  mobileBudgetPlan,
  mobileTransactions,
} from '@/data/personal-finance-template';
import {
  budgetGaps,
  formatMoney,
  summarizeBudget,
} from '@/domain/mobile-finance';
import { useTheme } from '@/hooks/use-theme';

export default function BudgetScreen() {
  const theme = useTheme();
  const [openSection, setOpenSection] = useState<string | null>('Essentials');
  const model = useMemo(
    () => summarizeBudget(mobileBudgetPlan, mobileTransactions),
    []
  );
  const gaps = useMemo(
    () => budgetGaps(mobileBudgetPlan, mobileTransactions).slice(0, 3),
    []
  );
  const savingsProgress =
    model.monthlyIncome > 0 ? Math.max(0, model.monthlySavingsTarget / model.monthlyIncome) : 0;

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
                Fixed, variable, personal
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                Penny starts with a plan, then lets real spending tune the variable lines.
              </ThemedText>
            </View>
            <PennyBadge expression="happy" />
          </View>

          <Card style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View>
                <ThemedText type="small" themeColor="textSecondary">
                  Planned monthly savings
                </ThemedText>
                <ThemedText type="subtitle">
                  {formatMoney(model.monthlySavingsTarget)}
                </ThemedText>
              </View>
              <View style={[styles.modePill, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="smallBold" themeColor="primary">
                  Guided flexible
                </ThemedText>
              </View>
            </View>
            <ProgressBar value={savingsProgress} />
            <ThemedText type="small" themeColor="textSecondary">
              {formatMoney(model.monthlyIncome)} income minus {formatMoney(model.totalExpenses)} planned
              expenses.
            </ThemedText>
          </Card>

          <View style={styles.grid}>
            <Card style={styles.metricCard}>
              <ThemedText type="small" themeColor="textSecondary">
                Fixed
              </ThemedText>
              <ThemedText type="subtitle">{formatMoney(model.fixedTotal)}</ThemedText>
              <ThemedText type="small">Stable commitments.</ThemedText>
            </Card>
            <Card style={styles.metricCard}>
              <ThemedText type="small" themeColor="textSecondary">
                Variable
              </ThemedText>
              <ThemedText type="subtitle">{formatMoney(model.variableTotal)}</ThemedText>
              <ThemedText type="small">Forecast from habits.</ThemedText>
            </Card>
          </View>

          <Card>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionCopy}>
                <ThemedText type="smallBold">Budget sections</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Tap a section to see fixed lines, variable lines, and forecast methods.
                </ThemedText>
              </View>
              <PillButton>Add</PillButton>
            </View>

            {model.sections.map((section) => {
              const expanded = openSection === section.title;
              const variablePct = section.total > 0 ? section.variableTotal / section.total : 0;

              return (
                <View key={section.title} style={styles.sectionBlock}>
                  <Pressable
                    onPress={() => setOpenSection(expanded ? null : section.title)}
                    style={({ pressed }) => [
                      styles.sectionButton,
                      {
                        backgroundColor: expanded ? theme.backgroundSelected : theme.backgroundElement,
                        borderColor: theme.border,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}>
                    <View style={styles.sectionButtonCopy}>
                      <ThemedText type="smallBold">{section.title}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {formatMoney(section.fixedTotal)} fixed / {formatMoney(section.variableTotal)} variable
                      </ThemedText>
                    </View>
                    <ThemedText type="smallBold">{formatMoney(section.total)}</ThemedText>
                  </Pressable>

                  {expanded && (
                    <View style={styles.lines}>
                      <ProgressBar value={variablePct} />
                      {section.lines.map((line) => (
                        <View key={`${section.title}-${line.name}`} style={styles.budgetRow}>
                          <View style={styles.lineCopy}>
                            <ThemedText type="smallBold">{line.name}</ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              {line.type === 'fixed' ? 'Fixed expense' : `Variable forecast: ${line.method}`}
                            </ThemedText>
                          </View>
                          <ThemedText type="smallBold">{formatMoney(line.amount)}</ThemedText>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </Card>

          <Card>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionCopy}>
                <ThemedText type="smallBold">Budget gaps Penny noticed</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Spending that shows up in history but is not clearly budgeted yet.
                </ThemedText>
              </View>
              <PennyBadge expression="thinking" animated={false} />
            </View>
            {gaps.length === 0 ? (
              <ThemedText type="small" themeColor="success">
                No obvious gaps in the starter plan.
              </ThemedText>
            ) : (
              gaps.map((gap) => (
                <View key={`${gap.category}-${gap.subcategory}`} style={styles.gapRow}>
                  <View style={styles.lineCopy}>
                    <ThemedText type="smallBold">
                      {gap.category} / {gap.subcategory}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Seen across {gap.months} months.
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold">{formatMoney(gap.suggestedMonthly)}/mo</ThemedText>
                </View>
              ))
            )}
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
  heroCard: {
    gap: Spacing.three,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  modePill: {
    borderRadius: 18,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
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
  sectionCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  sectionBlock: {
    gap: Spacing.two,
  },
  sectionButton: {
    minHeight: 74,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sectionButtonCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  lines: {
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
  gapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
