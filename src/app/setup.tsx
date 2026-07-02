import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, PennyBadge, PillButton, StepDots, ToggleChip } from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Radius, Spacing, WizardColors } from '@/constants/theme';
import { SETUP_COMPLETE_KEY, wizardScript } from '@/constants/penny-voice';
import { categories } from '@/data/sample-finance';
import { mobileBudgetPlan } from '@/data/personal-finance-template';
import type { BudgetStyle, GoalKind, SetupPreferences } from '@/domain/finance';
import { formatMoney } from '@/domain/mobile-finance';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
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

// Every wizard step is a spell; the last one is the costume change.
const spells = ['Welcome', 'Summon', 'Sort', 'Reveal', 'Flight plan', 'Takeoff'];
const TRANSFORM_STEP = spells.length - 1;

const STAR_COUNT = 42;

/** Deterministic starfield — cheap, static, and identical every render. */
function Starfield() {
  const stars = useMemo(
    () =>
      Array.from({ length: STAR_COUNT }).map((_, index) => ({
        left: ((index * 61) % 97) / 97,
        top: ((index * 37) % 89) / 89,
        size: index % 7 === 0 ? 3 : 2,
        opacity: 0.25 + ((index * 13) % 50) / 100,
      })),
    []
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {stars.map((star, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            left: `${star.left * 100}%`,
            top: `${star.top * 100}%`,
            width: star.size,
            height: star.size,
            borderRadius: star.size / 2,
            backgroundColor: '#F4F0FF',
            opacity: star.opacity,
          }}
        />
      ))}
    </View>
  );
}

function detectedEnchantments() {
  return mobileBudgetPlan.sections
    .flatMap((section) => section.lines)
    .filter((line) => line.type === 'fixed' && (line.monthly ?? 0) > 0 && line.name !== 'Fun Money')
    .map((line) => ({ name: line.name, monthly: line.monthly ?? 0 }))
    .sort((a, b) => b.monthly - a.monthly);
}

function getSetupErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return 'Preferences could not be saved yet — the app still works locally.';
}

export default function SetupScreen() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [rerun, setRerun] = useState(false);
  const [budgetStyle, setBudgetStyle] = useState<BudgetStyle>('guided-flexible');
  const [selectedCategories, setSelectedCategories] = useState(
    categories.map((category) => category.name)
  );
  const [selectedGoals, setSelectedGoals] = useState<GoalKind[]>(['home', 'emergency-fund']);
  const [syncIntent, setSyncIntent] = useState<'now' | 'later'>('later');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [transform] = useState(() => new Animated.Value(0));

  const enchantments = useMemo(() => detectedEnchantments(), []);
  const enchantmentBurn = enchantments.reduce((sum, item) => sum + item.monthly, 0);

  useEffect(() => {
    AsyncStorage.getItem(SETUP_COMPLETE_KEY)
      .then((value) => setRerun(!!value))
      .catch(() => {});
  }, []);

  const toggleCategory = (name: string) =>
    setSelectedCategories((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
    );

  const toggleGoal = (name: GoalKind) =>
    setSelectedGoals((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
    );

  const approveFlightPlan = async () => {
    setSaving(true);
    setSaveError(null);

    try {
      const user = await authService.getCurrentUser();
      if (user) {
        const preferences: SetupPreferences = {
          userId: user.id,
          budgetStyle,
          selectedCategoryTemplateIds: selectedCategories.map((category) =>
            category.toLowerCase().replaceAll(' ', '-')
          ),
          selectedGoalKinds: selectedGoals,
          guidanceTone: 'balanced',
          bankSyncIntent: syncIntent,
          completedAt: new Date().toISOString(),
        };
        await financeDataService.saveSetupPreferences(preferences);
      }
    } catch (error) {
      setSaveError(getSetupErrorMessage(error));
    }

    try {
      await AsyncStorage.setItem(SETUP_COMPLETE_KEY, new Date().toISOString());
    } catch {}

    setSaving(false);
    setStep(TRANSFORM_STEP);

    // The one big animation in the budget: the hat swaps for a pilot cap.
    if (reducedMotion) {
      transform.setValue(1);
    } else {
      transform.setValue(0);
      Animated.timing(transform, {
        toValue: 1,
        duration: 1600,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  };

  const isTransform = step === TRANSFORM_STEP;
  const canGoBack = step > 0 && !isTransform;

  return (
    <View style={[styles.container, { backgroundColor: WizardColors.background }]}>
      <Starfield />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <ThemedText type="smallBold" style={{ color: WizardColors.accent }}>
                Setup wizard
              </ThemedText>
              <ThemedText type="subtitle" style={[styles.title, { color: WizardColors.text }]}>
                {isTransform ? 'Takeoff' : 'Penny the Wizard'}
              </ThemedText>
              <ThemedText style={{ color: WizardColors.textSecondary }}>
                {rerun && step === 0 ? wizardScript.rerun : 'A few spells and the cockpit is yours.'}
              </ThemedText>
            </View>
            {!isTransform ? <PennyBadge mode="wizard" /> : null}
          </View>

          <Card
            style={StyleSheet.flatten([
              styles.wizardCard,
              {
                backgroundColor: WizardColors.backgroundElement,
                borderColor: WizardColors.borderStrong,
              },
            ])}>
            <View style={styles.stepTopper}>
              <ThemedText type="smallBold" style={{ color: WizardColors.text }}>
                {isTransform ? 'Transformation' : `Spell ${step + 1}: ${spells[step]}`}
              </ThemedText>
              <StepDots total={spells.length} active={step} />
            </View>

            {step === 0 && (
              <View style={styles.stepBody}>
                <ThemedText type="section" style={{ color: WizardColors.text }}>
                  “{wizardScript.welcome}”
                </ThemedText>
                <ThemedText style={{ color: WizardColors.textSecondary }}>
                  Setup is the only magic show in this app. Penny casts a few spells on your own
                  data — then the hat comes off and every number you see is real.
                </ThemedText>
              </View>
            )}

            {step === 1 && (
              <View style={styles.stepBody}>
                <ThemedText type="section" style={{ color: WizardColors.text }}>
                  {wizardScript.summon}
                </ThemedText>
                <ThemedText style={{ color: WizardColors.textSecondary }}>
                  Connect a bank and transactions appear on their own — or keep things fully
                  private with bank-export files. Both feed the same radar.
                </ThemedText>
                <View style={styles.chips}>
                  <ToggleChip
                    label="Connect my bank"
                    selected={syncIntent === 'now'}
                    onPress={() => setSyncIntent('now')}
                  />
                  <ToggleChip
                    label="Private import for now"
                    selected={syncIntent === 'later'}
                    onPress={() => setSyncIntent('later')}
                  />
                </View>
              </View>
            )}

            {step === 2 && (
              <View style={styles.stepBody}>
                <ThemedText type="section" style={{ color: WizardColors.text }}>
                  {wizardScript.sort}
                </ThemedText>
                <ThemedText style={{ color: WizardColors.textSecondary }}>
                  Penny waves the wand over the imported pile and sorts it into these. Keep the
                  ones that fit your life — everything stays editable later.
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
              </View>
            )}

            {step === 3 && (
              <View style={styles.stepBody}>
                <ThemedText type="section" style={{ color: WizardColors.text }}>
                  {wizardScript.reveal}
                </ThemedText>
                <ThemedText style={{ color: WizardColors.textSecondary }}>
                  Recurring charges hiding in your transactions — the subscriptions people forget
                  they have. Penny found these:
                </ThemedText>
                <View style={styles.enchantList}>
                  {enchantments.slice(0, 5).map((item) => (
                    <View key={item.name} style={styles.enchantRow}>
                      <ThemedText type="smallBold" style={{ color: WizardColors.accent }}>
                        ✦
                      </ThemedText>
                      <ThemedText
                        type="smallBold"
                        numberOfLines={1}
                        style={[styles.enchantName, { color: WizardColors.text }]}>
                        {item.name}
                      </ThemedText>
                      <ThemedText type="money" style={{ color: WizardColors.text }}>
                        {formatMoney(item.monthly)}/mo
                      </ThemedText>
                    </View>
                  ))}
                </View>
                <ThemedText type="smallBold" style={{ color: WizardColors.primary }}>
                  {formatMoney(enchantmentBurn)}/mo of enchantments, all watched on the Radar tab.
                </ThemedText>
              </View>
            )}

            {step === 4 && (
              <View style={styles.stepBody}>
                <ThemedText type="section" style={{ color: WizardColors.text }}>
                  {wizardScript.flightPlan}
                </ThemedText>
                <ThemedText style={{ color: WizardColors.textSecondary }}>
                  A starting budget style and the destinations worth flying toward. Penny suggests;
                  you have final say.
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
                <ThemedText type="smallBold" style={{ color: WizardColors.text }}>
                  Destinations
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
                {saveError ? (
                  <ThemedText type="small" style={{ color: WizardColors.warning }}>
                    {saveError}
                  </ThemedText>
                ) : null}
              </View>
            )}

            {isTransform && (
              <View style={styles.transformBody}>
                <View style={styles.transformStage}>
                  <Animated.View
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFill, styles.contrails, { opacity: transform }]}>
                    {[0, 1, 2].map((index) => (
                      <Animated.View
                        key={index}
                        style={[
                          styles.contrail,
                          {
                            top: 24 + index * 34,
                            backgroundColor:
                              index === 1 ? WizardColors.primary : WizardColors.accent,
                            transform: [
                              {
                                translateX: transform.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [-140 - index * 40, 200],
                                }),
                              },
                            ],
                          },
                        ]}
                      />
                    ))}
                  </Animated.View>
                  <Animated.View style={{ opacity: transform.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] }), position: 'absolute' }}>
                    <PennyBadge mode="wizard" animated={false} size={104} />
                  </Animated.View>
                  <Animated.View style={{ opacity: transform.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }) }}>
                    <PennyBadge expression="celebrating" animated={false} size={104} />
                  </Animated.View>
                </View>
                <ThemedText type="section" style={{ color: WizardColors.text, textAlign: 'center' }}>
                  “{wizardScript.transform}”
                </ThemedText>
                <ThemedText style={{ color: WizardColors.textSecondary, textAlign: 'center' }}>
                  The wand is a headset now. Flight plan approved.
                </ThemedText>
              </View>
            )}

            <View style={styles.controls}>
              {isTransform ? (
                <PillButton tone="primary" onPress={() => router.replace('/')}>
                  Start flying
                </PillButton>
              ) : (
                <>
                  <Pressable
                    disabled={!canGoBack}
                    onPress={() => setStep((current) => Math.max(current - 1, 0))}
                    style={({ pressed }) => [styles.backButton, (!canGoBack || pressed) && styles.dimmed]}>
                    <ThemedText type="smallBold" style={{ color: WizardColors.text }}>
                      Back
                    </ThemedText>
                  </Pressable>
                  <PillButton
                    tone="primary"
                    disabled={saving}
                    onPress={() => {
                      if (step === TRANSFORM_STEP - 1) {
                        void approveFlightPlan();
                        return;
                      }
                      setStep((current) => current + 1);
                    }}>
                    {step === TRANSFORM_STEP - 1
                      ? saving
                        ? 'Casting…'
                        : 'Approve flight plan'
                      : 'Next spell'}
                  </PillButton>
                </>
              )}
            </View>
          </Card>
        </SafeAreaView>
      </ScrollView>
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  enchantList: {
    gap: Spacing.two,
  },
  enchantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  enchantName: {
    flex: 1,
    minWidth: 0,
  },
  transformBody: {
    gap: Spacing.three,
    alignItems: 'center',
  },
  transformStage: {
    height: 150,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  contrails: {
    justifyContent: 'center',
  },
  contrail: {
    position: 'absolute',
    width: 120,
    height: 4,
    borderRadius: 2,
    opacity: 0.8,
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
});
