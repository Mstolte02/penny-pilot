import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, PennyBadge, PillButton, StepDots, ToggleChip } from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { categories } from '@/data/sample-finance';
import type { BudgetStyle, GoalKind, SetupPreferences } from '@/domain/finance';
import { authService, financeDataService } from '@/services';

const budgetStyles: { label: string; value: BudgetStyle }[] = [
  { label: 'Guided flexible', value: 'guided-flexible' },
  { label: '50/30/20', value: 'fifty-thirty-twenty' },
  { label: 'Zero-based', value: 'zero-based' },
  { label: 'Category envelopes', value: 'envelopes' },
];
const goalTemplates: { label: string; value: GoalKind }[] = [
  { label: 'Home', value: 'home' },
  { label: 'Car', value: 'car' },
  { label: 'Emergency fund', value: 'emergency-fund' },
  { label: 'Vacation', value: 'vacation' },
  { label: 'Loan payoff', value: 'loan-payoff' },
  { label: 'Custom', value: 'custom' },
];
const setupSteps = ['Welcome', 'Budget', 'Categories', 'Goals', 'Ready'];

function getSetupErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }

  return 'Setup could not be saved yet.';
}

export default function SetupScreen() {
  const [step, setStep] = useState(0);
  const [budgetStyle, setBudgetStyle] = useState<BudgetStyle>('guided-flexible');
  const [selectedCategories, setSelectedCategories] = useState(
    categories.map((category) => category.name)
  );
  const [selectedGoals, setSelectedGoals] = useState<GoalKind[]>(['home', 'emergency-fund']);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canGoBack = step > 0;
  const isLast = step === setupSteps.length - 1;
  const selectedCategoryText = useMemo(
    () => selectedCategories.join(', '),
    [selectedCategories]
  );

  const toggleCategory = (name: string) => {
    setSelectedCategories((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
    );
  };

  const toggleGoal = (name: string) => {
    setSelectedGoals((current) =>
      current.includes(name as GoalKind)
        ? current.filter((item) => item !== name)
        : [...current, name as GoalKind]
    );
  };

  const saveSetup = async () => {
    setSaving(true);
    setSaveError(null);

    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        throw new Error('Sign in before saving setup preferences to Supabase.');
      }

      const completedAt = new Date().toISOString();
      const preferences: SetupPreferences = {
        userId: user.id,
        budgetStyle,
        selectedCategoryTemplateIds: selectedCategories.map((category) =>
          category.toLowerCase().replaceAll(' ', '-')
        ),
        selectedGoalKinds: selectedGoals,
        guidanceTone: 'balanced',
        bankSyncIntent: 'later',
        completedAt,
      };

      await financeDataService.saveSetupPreferences(preferences);
      setSavedAt(completedAt);
    } catch (error) {
      setSaveError(getSetupErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <ThemedText type="smallBold" themeColor="primary">
                Setup wizard
              </ThemedText>
              <ThemedText type="subtitle" style={styles.title}>
                Make Penny Pilot yours
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                Before Penny earns the pilot goggles, a quick setup helps personalize categories,
                goals, and budget guidance.
              </ThemedText>
            </View>
            <PennyBadge mode="wizard" />
          </View>

          <Card style={styles.wizardCard}>
            <View style={styles.stepTopper}>
              <ThemedText type="smallBold">
                {setupSteps[step]} step
              </ThemedText>
              <StepDots total={setupSteps.length} active={step} />
            </View>

            {step === 0 && (
              <View style={styles.stepBody}>
                <ThemedText type="subtitle" style={styles.stepTitle}>
                  A budget should fit real life
                </ThemedText>
                <ThemedText themeColor="textSecondary">
                  Penny will suggest a route, but every category, subcategory, and goal stays
                  editable. No one-size-fits-all plan hiding in the cockpit.
                </ThemedText>
              </View>
            )}

            {step === 1 && (
              <View style={styles.stepBody}>
                <ThemedText type="subtitle" style={styles.stepTitle}>
                  Choose a starting budget style
                </ThemedText>
                <ThemedText themeColor="textSecondary">
                  This changes Penny&apos;s first recommendation. You can still override anything.
                </ThemedText>
                <View style={styles.chips}>
                  {budgetStyles.map((style) => (
                    <ToggleChip
                      key={style.value}
                      label={style.label}
                      selected={budgetStyle === style.value}
                      onPress={() => setBudgetStyle(style.value)}
                    />
                  ))}
                </View>
              </View>
            )}

            {step === 2 && (
              <View style={styles.stepBody}>
                <ThemedText type="subtitle" style={styles.stepTitle}>
                  Pick the categories you want
                </ThemedText>
                <ThemedText themeColor="textSecondary">
                  Penny starts with common categories, then predicts transactions into your plan.
                </ThemedText>
                <View style={styles.chips}>
                  {categories.map((category) => (
                    <ToggleChip
                      key={category.name}
                      label={category.name}
                      selected={selectedCategories.includes(category.name)}
                      onPress={() => toggleCategory(category.name)}
                    />
                  ))}
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  Selected: {selectedCategoryText || 'none yet'}
                </ThemedText>
              </View>
            )}

            {step === 3 && (
              <View style={styles.stepBody}>
                <ThemedText type="subtitle" style={styles.stepTitle}>
                  Set your first goal templates
                </ThemedText>
                <ThemedText themeColor="textSecondary">
                  Goals share one engine, but each template gets a friendlier setup flow.
                </ThemedText>
                <View style={styles.chips}>
                  {goalTemplates.map((goal) => (
                    <ToggleChip
                      key={goal.value}
                      label={goal.label}
                      selected={selectedGoals.includes(goal.value)}
                      onPress={() => toggleGoal(goal.value)}
                    />
                  ))}
                </View>
              </View>
            )}

            {step === 4 && (
              <View style={styles.stepBody}>
                <ThemedText type="subtitle" style={styles.stepTitle}>
                  Penny is ready for takeoff
                </ThemedText>
                <ThemedText themeColor="textSecondary">
                  Next, Penny can connect banks, build a first budget, and start the transaction
                  review queue with your preferences already in place.
                </ThemedText>
                <View style={styles.summaryList}>
                  <SummaryRow label="Budget style" value={budgetStyles.find((style) => style.value === budgetStyle)?.label ?? budgetStyle} />
                  <SummaryRow label="Categories" value={`${selectedCategories.length} selected`} />
                  <SummaryRow label="Goals" value={`${selectedGoals.length} selected`} />
                </View>
                {savedAt && (
                  <ThemedText type="small" themeColor="success">
                    Setup preferences saved.
                  </ThemedText>
                )}
                {saveError && (
                  <ThemedText type="small" themeColor="warning">
                    {saveError}
                  </ThemedText>
                )}
              </View>
            )}

            <View style={styles.controls}>
              <Pressable
                disabled={!canGoBack}
                onPress={() => setStep((current) => Math.max(current - 1, 0))}
                style={({ pressed }) => [
                  styles.backButton,
                  (!canGoBack || pressed) && styles.dimmed,
                ]}>
                <ThemedText type="smallBold">Back</ThemedText>
              </Pressable>
              <PillButton
                tone="primary"
                onPress={() => {
                  if (isLast) {
                    void saveSetup();
                    return;
                  }
                  setStep((current) => Math.min(current + 1, setupSteps.length - 1));
                }}>
                {isLast ? (saving ? 'Saving...' : 'Save setup') : 'Continue'}
              </PillButton>
            </View>
          </Card>
        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
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
  wizardCard: {
    gap: Spacing.three,
  },
  stepTopper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  stepBody: {
    gap: Spacing.three,
  },
  stepTitle: {
    fontSize: 28,
    lineHeight: 34,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  backButton: {
    minHeight: 42,
    paddingHorizontal: Spacing.three,
    borderRadius: 21,
    justifyContent: 'center',
  },
  dimmed: {
    opacity: 0.45,
  },
  summaryList: {
    gap: Spacing.two,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
