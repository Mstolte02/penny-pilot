import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BankLinkButton } from '@/components/bank-link-button';
import { Card, PennyBadge, PillButton, StepDots, ToggleChip } from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, MaxContentWidth, Radius, Spacing, WizardColors } from '@/constants/theme';
import { BUDGET_STYLE_KEY, SETUP_COMPLETE_KEY, WIZARD_STATE_KEY, wizardScript } from '@/constants/penny-voice';
import type { BudgetStyle, GoalKind, SetupPreferences } from '@/domain/finance';
import { formatMoney, monthKey } from '@/domain/mobile-finance';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { authService, financeDataService } from '@/services';
import { useFinance, type GoalPlan, type PlanLine } from '@/services/finance-store';
import { importFailureNeedsRebuild, pickImportPreview } from '@/services/import-file';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const budgetStyles: { label: string; value: BudgetStyle; explainer: string }[] = [
  {
    label: 'Guided flexible',
    value: 'guided-flexible',
    explainer:
      'Penny suggests amounts from your history. Fixed bills stay put, and the rest moves with what you really spend. The easiest place to start.',
  },
  {
    label: '50/30/20',
    value: 'fifty-thirty-twenty',
    explainer:
      'A rule of thumb: 50% of income to needs, 30% to wants, 20% to savings. Penny grades your plan against those targets each month.',
  },
  {
    label: 'Zero-based',
    value: 'zero-based',
    explainer:
      'Every dollar gets a job before the month starts, so income minus what you assign comes to exactly zero. The most control, with a bit more upkeep.',
  },
  {
    label: 'Category envelopes',
    value: 'envelopes',
    explainer:
      'Each category is an envelope of cash. When an envelope runs empty, spending there stops (or you move money over from another envelope).',
  },
];

type CategoryTemplate = {
  name: string;
  icon: IoniconName;
  subcategories: string[];
};

type PersonaTemplate = {
  id: string;
  label: string;
  categories: string[];
};

type SetupGoalDraft = {
  kind: GoalKind;
  id?: string;
  name: string;
  current: string;
  target: string;
  monthlyTarget: string;
  targetDate: string;
  mode: 'track' | 'deadline';
};

const categoryTemplates: CategoryTemplate[] = [
  { name: 'Housing', icon: 'home-outline', subcategories: ['Rent', 'Mortgage', 'Utilities', 'Insurance', 'Repairs'] },
  { name: 'Transportation', icon: 'car-outline', subcategories: ['Gas', 'Maintenance', 'Insurance', 'Parking'] },
  { name: 'Food and dining', icon: 'restaurant-outline', subcategories: ['Groceries', 'Dining out', 'Coffee / snacks', 'Meal kits'] },
  { name: 'Shopping', icon: 'cart-outline', subcategories: ['Household', 'Clothing', 'Amazon / online', 'Personal care'] },
  { name: 'Health', icon: 'heart-outline', subcategories: ['Medical', 'Dental', 'Prescriptions', 'Fitness'] },
  { name: 'Entertainment', icon: 'tv-outline', subcategories: ['Streaming', 'Events', 'Games', 'Books'] },
  { name: 'Travel', icon: 'airplane-outline', subcategories: ['Flights', 'Hotels', 'Rental car', 'Trips'] },
  { name: 'Kids and family', icon: 'gift-outline', subcategories: ['Childcare', 'Activities', 'School', 'Family support'] },
  { name: 'Debt', icon: 'card-outline', subcategories: ['Credit cards', 'Student loans', 'Personal loans', 'Extra payoff'] },
  { name: 'Savings', icon: 'trending-up-outline', subcategories: ['Emergency fund', 'Home fund', 'Vacation', 'Investing'] },
  { name: 'Education', icon: 'school-outline', subcategories: ['Tuition', 'Books', 'Supplies', 'Courses'] },
  { name: 'Pets', icon: 'paw-outline', subcategories: ['Food', 'Vet', 'Grooming', 'Boarding'] },
  { name: 'Giving', icon: 'leaf-outline', subcategories: ['Charity', 'Church', 'Gifts', 'Mutual aid'] },
];

const personas: PersonaTemplate[] = [
  { id: 'starter', label: 'Simple starter', categories: ['Housing', 'Transportation', 'Food and dining', 'Shopping', 'Entertainment'] },
  { id: 'student', label: 'Student', categories: ['Housing', 'Food and dining', 'Transportation', 'Education', 'Entertainment'] },
  { id: 'family', label: 'Family', categories: ['Housing', 'Food and dining', 'Transportation', 'Kids and family', 'Health'] },
  { id: 'homeowner', label: 'Homeowner', categories: ['Housing', 'Transportation', 'Food and dining', 'Health', 'Savings'] },
  { id: 'debt-payoff', label: 'Debt payoff', categories: ['Housing', 'Food and dining', 'Transportation', 'Debt', 'Savings'] },
];

const goalTemplates: { label: string; value: GoalKind; defaults: Partial<GoalPlan> }[] = [
  { label: 'Emergency fund', value: 'emergency-fund', defaults: { name: 'Emergency fund', mode: 'track' } },
  { label: 'Home', value: 'home', defaults: { name: 'Home fund', mode: 'deadline' } },
  { label: 'Car', value: 'car', defaults: { name: 'Car fund', mode: 'deadline' } },
  { label: 'Vacation', value: 'vacation', defaults: { name: 'Vacation', mode: 'deadline' } },
  { label: 'Loan payoff', value: 'loan-payoff', defaults: { name: 'Loan payoff', mode: 'deadline' } },
  { label: 'Custom', value: 'custom', defaults: { name: '', mode: 'track' } },
];

// Every wizard step is a spell; the last one is the costume change.
const spells = ['Welcome', 'Summon', 'Sort', 'Flight plan', 'Takeoff'];
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

function monthInputAfter(startMonth: string, count: number) {
  const [year, monthNumber] = startMonth.split('-').map(Number);
  const date = new Date(year, monthNumber - 1 + count, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getSetupErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return "Couldn't save your preferences yet. The app still works on this device.";
}

export default function SetupScreen() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const {
    transactions: storeTransactions,
    addTransactions,
    guessCategory,
    setPlanLines,
    goals,
    setGoals,
  } = useFinance();
  const [step, setStep] = useState(0);
  const [rerun, setRerun] = useState(false);
  const [budgetStyle, setBudgetStyle] = useState<BudgetStyle>('guided-flexible');
  const [styleInfo, setStyleInfo] = useState<BudgetStyle | null>(null);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [customCategoryText, setCustomCategoryText] = useState('');
  const [persona, setPersona] = useState(personas[0].id);
  const [selectedCategories, setSelectedCategories] = useState(() => personas[0].categories);
  const [selectedSubcategories, setSelectedSubcategories] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      personas[0].categories.map((name) => [
        name,
        categoryTemplates.find((category) => category.name === name)?.subcategories.slice(0, 3) ?? [],
      ])
    )
  );
  const [customSubcategory, setCustomSubcategory] = useState<{ category: string; value: string } | null>(null);
  const [goalEditor, setGoalEditor] = useState<SetupGoalDraft | null>(null);
  const [syncIntent, setSyncIntent] = useState<'now' | 'later'>('later');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [bankLinkStatus, setBankLinkStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [transform] = useState(() => new Animated.Value(0));

  useEffect(() => {
    AsyncStorage.getItem(SETUP_COMPLETE_KEY)
      .then((value) => setRerun(!!value))
      .catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(WIZARD_STATE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<{
          step: number;
          budgetStyle: BudgetStyle;
          persona: string;
          selectedCategories: string[];
          selectedSubcategories: Record<string, string[]>;
          syncIntent: 'now' | 'later';
        }>;
        if (typeof parsed.step === 'number') setStep(Math.min(parsed.step, TRANSFORM_STEP - 1));
        if (parsed.budgetStyle) setBudgetStyle(parsed.budgetStyle);
        if (parsed.persona) setPersona(parsed.persona);
        if (parsed.selectedCategories?.length) setSelectedCategories(parsed.selectedCategories);
        if (parsed.selectedSubcategories) setSelectedSubcategories(parsed.selectedSubcategories);
        if (parsed.syncIntent) setSyncIntent(parsed.syncIntent);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (step === TRANSFORM_STEP) return;
    AsyncStorage.setItem(
      WIZARD_STATE_KEY,
      JSON.stringify({ step, budgetStyle, persona, selectedCategories, selectedSubcategories, syncIntent })
    ).catch(() => {});
  }, [budgetStyle, persona, selectedCategories, selectedSubcategories, step, syncIntent]);

  const applyPersona = (id: string) => {
    const nextPersona = personas.find((entry) => entry.id === id) ?? personas[0];
    setPersona(nextPersona.id);
    setSelectedCategories(nextPersona.categories);
    setSelectedSubcategories((current) => {
      const next: Record<string, string[]> = {};
      for (const name of nextPersona.categories) {
        next[name] =
          current[name] ??
          categoryTemplates.find((category) => category.name === name)?.subcategories.slice(0, 3) ??
          [];
      }
      return next;
    });
  };

  const toggleCategory = (name: string) =>
    setSelectedCategories((current) => {
      if (current.includes(name)) return current.filter((item) => item !== name);
      setSelectedSubcategories((subcategories) => ({
        ...subcategories,
        [name]:
          subcategories[name] ??
          categoryTemplates.find((category) => category.name === name)?.subcategories.slice(0, 3) ??
          [],
      }));
      return [...current, name];
    });

  const toggleSubcategory = (category: string, subcategory: string) =>
    setSelectedSubcategories((current) => {
      const packed = current[category] ?? [];
      return {
        ...current,
        [category]: packed.includes(subcategory)
          ? packed.filter((item) => item !== subcategory)
          : [...packed, subcategory],
      };
    });

  const addCustomCategory = () => {
    const name = customCategoryText.trim();
    if (!name) return;
    const exists = [...categoryTemplates.map((category) => category.name), ...customCategories].some(
      (item) => item.toLowerCase() === name.toLowerCase()
    );
    if (!exists) {
      setCustomCategories((current) => [...current, name]);
    }
    setSelectedCategories((current) => (current.includes(name) ? current : [...current, name]));
    setCustomCategoryText('');
  };

  const openGoalTemplate = (kind: GoalKind, existing?: GoalPlan) => {
    const template = goalTemplates.find((goal) => goal.value === kind) ?? goalTemplates[goalTemplates.length - 1];
    setGoalEditor({
      kind,
      id: existing?.id,
      name: existing?.name ?? template.defaults.name ?? '',
      current: existing ? String(existing.current) : '',
      target: existing ? String(existing.target) : '',
      monthlyTarget: existing ? String(existing.monthlyTarget) : '',
      targetDate: existing?.targetDate ?? monthInputAfter(new Date().toISOString().slice(0, 7), 12),
      mode: existing?.mode ?? template.defaults.mode ?? 'track',
    });
  };

  const saveGoalEditor = () => {
    if (!goalEditor) return;
    const id = goalEditor.id ?? `goal-${goalEditor.kind}-${Date.now()}`;
    const next: GoalPlan = {
      id,
      name: goalEditor.name.trim() || 'Untitled goal',
      target: Number(goalEditor.target.replace(/[^0-9.]/g, '')) || 0,
      current: Number(goalEditor.current.replace(/[^0-9.]/g, '')) || 0,
      monthlyTarget: Number(goalEditor.monthlyTarget.replace(/[^0-9.]/g, '')) || 0,
      targetDate: goalEditor.targetDate,
      mode: goalEditor.mode,
    };
    setGoals((current) =>
      current.some((goal) => goal.id === id)
        ? current.map((goal) => (goal.id === id ? next : goal))
        : [...current, next]
    );
    setGoalEditor(null);
  };

  const buildWizardPlanLines = (): PlanLine[] => {
    const expenses = storeTransactions.filter((transaction) => transaction.type === 'expense');
    const divisor = Math.max(new Set(expenses.map((transaction) => monthKey(transaction.date))).size, 1);
    const normalize = (value: string | null | undefined) =>
      (value ?? '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
    // Loose match for naming drift ("Fun Stuff" vs "Subscriptions & Fun"), but
    // never on an empty string — `"x".includes('')` is always true, which made
    // every uncategorized transaction match every line and gave the whole plan
    // one identical amount.
    const matchesLoosely = (a: string, b: string) =>
      a === b || (a.length > 0 && b.length > 0 && (a.includes(b) || b.includes(a)));

    return selectedCategories.flatMap((category) => {
      const subcategories = selectedSubcategories[category]?.length
        ? selectedSubcategories[category]
        : ['General'];
      const categoryKey = normalize(category);
      const subcategoryKeys = subcategories.map(normalize);
      // Uncategorized spend in this category lands on the catch-all line
      // (General/Other), or the first line when no catch-all was picked.
      const fallbackIndex = Math.max(
        0,
        subcategoryKeys.findIndex((key) => key === 'general' || key === 'other' || key === 'uncategorized')
      );

      // Each transaction is assigned to exactly one line — no double counting.
      const totals = subcategories.map(() => 0);
      for (const transaction of expenses) {
        if (!matchesLoosely(normalize(transaction.category), categoryKey)) continue;
        const subcategoryKey = normalize(transaction.subcategory);
        const matched =
          subcategoryKey.length > 0
            ? subcategoryKeys.findIndex((key) => matchesLoosely(key, subcategoryKey))
            : -1;
        totals[matched === -1 ? fallbackIndex : matched] += transaction.moneyOut;
      }

      return subcategories.map((subcategory, index) => ({
        id: `${category}::${subcategory}`,
        section: category,
        name: subcategory,
        type: category === 'Housing' || category === 'Debt' ? ('fixed' as const) : ('flexible' as const),
        amount: Math.round(totals[index] / divisor),
        method: 'avg6' as const,
        match: [[category, subcategory]] as [string, string][],
      }));
    });
  };

  const importBankFile = async () => {
    setImporting(true);
    setImportError(null);
    setImportSummary(null);
    try {
      const preview = await pickImportPreview(storeTransactions, guessCategory);
      if (!preview) return;
      if ('error' in preview) {
        setImportError(preview.error);
        return;
      }
      if (preview.total === 0) {
        setImportError(
          preview.duplicates > 0
            ? 'Every row in that file is already imported.'
            : "Penny couldn't find any transactions in that file."
        );
        return;
      }
      addTransactions(preview.transactions);
      setSyncIntent('later');
      setImportSummary(
        `${preview.total} transactions imported` +
          (preview.duplicates > 0 ? ` · ${preview.duplicates} duplicates skipped` : '') +
          (preview.uncategorized > 0 ? ` · ${preview.uncategorized} need a category later` : '')
      );
    } catch (error) {
      if (importFailureNeedsRebuild(error)) {
        setImportError('This build is missing the file picker. Install the newest development build and try again.');
      } else {
        setImportError("Couldn't read that file. Is it a CSV or Excel export from your bank?");
      }
    } finally {
      setImporting(false);
    }
  };

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
          selectedGoalKinds: goals.map(() => 'custom' as GoalKind),
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
      // The Plan tab reads this to shape the budget around the chosen style.
      await AsyncStorage.setItem(BUDGET_STYLE_KEY, budgetStyle);
      await AsyncStorage.removeItem(WIZARD_STATE_KEY);
    } catch {}

    setPlanLines(buildWizardPlanLines());

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
                  data, then the hat comes off and every number you see is real.
                </ThemedText>
              </View>
            )}

            {step === 1 && (
              <View style={styles.stepBody}>
                <ThemedText type="section" style={{ color: WizardColors.text }}>
                  {wizardScript.summon}
                </ThemedText>
                <ThemedText style={{ color: WizardColors.textSecondary }}>
                  Connect a bank and transactions show up on their own. Or stay fully private and
                  import files from your bank. Both land on the same radar.
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
                {syncIntent === 'now' ? (
                  <View style={styles.importPanel}>
                    <BankLinkButton onStatusChange={setBankLinkStatus} />
                    <ThemedText type="small" style={{ color: WizardColors.textSecondary }}>
                      {bankLinkStatus ?? 'Plaid opens a secure window to pick your bank.'}
                    </ThemedText>
                  </View>
                ) : null}
                {syncIntent === 'later' ? (
                  <View style={styles.importPanel}>
                    <PillButton tone="primary" disabled={importing} onPress={() => void importBankFile()}>
                      {importing ? 'Reading file…' : 'Import bank file'}
                    </PillButton>
                    <ThemedText type="small" style={{ color: WizardColors.textSecondary }}>
                      CSV, XLS, and XLSX exports stay on this device.
                    </ThemedText>
                    {importSummary ? (
                      <ThemedText type="smallBold" style={{ color: WizardColors.primary }}>
                        {importSummary}
                      </ThemedText>
                    ) : null}
                    {importError ? (
                      <ThemedText type="small" style={{ color: WizardColors.warning }}>
                        {importError}
                      </ThemedText>
                    ) : null}
                  </View>
                ) : null}
              </View>
            )}

            {step === 2 && (
              <View style={styles.stepBody}>
                <ThemedText type="section" style={{ color: WizardColors.text }}>
                  {wizardScript.sort}
                </ThemedText>
                <ThemedText style={{ color: WizardColors.textSecondary }}>
                  Pick a preset, then pack the categories and subcategories you want in your
                  budget. Your picks save as you go.
                </ThemedText>
                <View style={styles.chips}>
                  {personas.map((preset) => (
                    <ToggleChip
                      key={preset.id}
                      label={preset.label}
                      selected={persona === preset.id}
                      onPress={() => applyPersona(preset.id)}
                    />
                  ))}
                </View>
                <View style={styles.categoryGrid}>
                  {[...categoryTemplates, ...customCategories.map((name) => ({ name, icon: 'add-circle-outline' as IoniconName, subcategories: ['General'] }))].map((category) => (
                    <CategoryPackCard
                      key={category.name}
                      category={category}
                      selected={selectedCategories.includes(category.name)}
                      selectedSubcategories={selectedSubcategories[category.name] ?? []}
                      onToggle={() => toggleCategory(category.name)}
                      onToggleSubcategory={(subcategory) => toggleSubcategory(category.name, subcategory)}
                      onAddCustom={() => setCustomSubcategory({ category: category.name, value: '' })}
                    />
                  ))}
                </View>
                <View style={styles.customRow}>
                  <TextInput
                    value={customCategoryText}
                    onChangeText={setCustomCategoryText}
                    placeholder="Add your own (e.g. Golf, Side hustle)"
                    placeholderTextColor={WizardColors.textSecondary}
                    onSubmitEditing={addCustomCategory}
                    style={[
                      styles.customInput,
                      {
                        borderColor: WizardColors.border,
                        color: WizardColors.text,
                        backgroundColor: WizardColors.background,
                      },
                    ]}
                  />
                  <PillButton tone="primary" onPress={addCustomCategory}>
                    Add
                  </PillButton>
                </View>
                <ThemedText type="small" style={{ color: WizardColors.textSecondary }}>
                  {selectedCategories.length} categories packed ·{' '}
                  {Object.values(selectedSubcategories).reduce((sum, items) => sum + items.length, 0)} subcategories.
                </ThemedText>
              </View>
            )}

            {step === 3 && (
              <View style={styles.stepBody}>
                <ThemedText type="section" style={{ color: WizardColors.text }}>
                  {wizardScript.flightPlan}
                </ThemedText>
                <ThemedText style={{ color: WizardColors.textSecondary }}>
                  Pick a budget style to start with and the goals you&apos;re flying toward. Penny
                  suggests, you decide.
                </ThemedText>
                <View style={styles.styleList}>
                  {budgetStyles.map((style) => (
                    <View key={style.value}>
                      <View style={styles.styleRow}>
                        <ToggleChip
                          label={style.label}
                          selected={budgetStyle === style.value}
                          onPress={() => setBudgetStyle(style.value)}
                        />
                        <Pressable
                          accessibilityLabel={`About ${style.label}`}
                          hitSlop={8}
                          onPress={() =>
                            setStyleInfo((current) => (current === style.value ? null : style.value))
                          }
                          style={[styles.infoDot, { borderColor: WizardColors.accent }]}>
                          <ThemedText type="small" style={{ color: WizardColors.accent }}>
                            i
                          </ThemedText>
                        </Pressable>
                      </View>
                      {styleInfo === style.value ? (
                        <View style={styles.styleExplainer}>
                          <ThemedText type="small" style={{ color: WizardColors.textSecondary }}>
                            {style.explainer}
                          </ThemedText>
                          <BudgetStylePreview styleValue={style.value} />
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
                <ThemedText type="smallBold" style={{ color: WizardColors.text }}>
                  Destinations (your goals)
                </ThemedText>
                <ThemedText type="small" style={{ color: WizardColors.textSecondary }}>
                  Tap one to set the goal amount, what you have now, a monthly plan, and a need-by date.
                </ThemedText>
                <View style={styles.chips}>
                  {goalTemplates.map((goal) => (
                    <ToggleChip
                      key={goal.value}
                      label={goal.label}
                      selected={goals.some((entry) => entry.name.toLowerCase().includes(goal.label.toLowerCase().split(' ')[0]))}
                      onPress={() => openGoalTemplate(goal.value)}
                    />
                  ))}
                </View>
                {goals.length > 0 ? (
                  <View style={styles.goalList}>
                    {goals.map((goal) => (
                      <Pressable
                        key={goal.id}
                        onPress={() => openGoalTemplate('custom', goal)}
                        style={[styles.goalRow, { borderColor: WizardColors.border }]}>
                        <View style={styles.goalCopy}>
                          <ThemedText type="smallBold" style={{ color: WizardColors.text }} numberOfLines={1}>
                            {goal.name}
                          </ThemedText>
                          <ThemedText type="small" style={{ color: WizardColors.textSecondary }} numberOfLines={1}>
                            {formatMoney(goal.current)} of {formatMoney(goal.target)} · {formatMoney(goal.monthlyTarget)}/mo
                          </ThemedText>
                        </View>
                        <ThemedText type="smallBold" style={{ color: WizardColors.accent }}>
                          Edit
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
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
                  The wand&apos;s a headset now, and your flight plan is approved.
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
          <GoalSetupModal
            draft={goalEditor}
            onChange={setGoalEditor}
            onClose={() => setGoalEditor(null)}
            onSave={saveGoalEditor}
          />
          <Modal
            visible={customSubcategory !== null}
            transparent
            animationType="fade"
            onRequestClose={() => setCustomSubcategory(null)}>
            <View style={styles.modalOverlay}>
              <View style={[styles.goalSheet, { backgroundColor: WizardColors.backgroundElement, borderColor: WizardColors.borderStrong }]}>
                <ThemedText type="section" style={{ color: WizardColors.text }}>
                  Add subcategory
                </ThemedText>
                <WizardField
                  label={customSubcategory?.category ?? 'Category'}
                  value={customSubcategory?.value ?? ''}
                  onChangeText={(value) =>
                    setCustomSubcategory((current) => (current ? { ...current, value } : current))
                  }
                  placeholder="e.g. Golf"
                />
                <View style={styles.controls}>
                  <PillButton
                    tone="primary"
                    onPress={() => {
                      if (!customSubcategory?.value.trim()) return;
                      toggleSubcategory(customSubcategory.category, customSubcategory.value.trim());
                      setCustomSubcategory(null);
                    }}>
                    Add
                  </PillButton>
                  <PillButton onPress={() => setCustomSubcategory(null)}>Cancel</PillButton>
                </View>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

function CategoryPackCard({
  category,
  selected,
  selectedSubcategories,
  onToggle,
  onToggleSubcategory,
  onAddCustom,
}: {
  category: CategoryTemplate;
  selected: boolean;
  selectedSubcategories: string[];
  onToggle: () => void;
  onToggleSubcategory: (subcategory: string) => void;
  onAddCustom: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.categoryCard,
        {
          borderColor: selected ? WizardColors.primary : WizardColors.border,
          backgroundColor: selected ? WizardColors.backgroundSelected : WizardColors.backgroundElement,
          opacity: pressed ? 0.78 : 1,
        },
      ]}>
      <View style={styles.categoryTop}>
        <Ionicons name={category.icon} size={24} color={WizardColors.textSecondary} />
        <ThemedText type="smallBold" style={[styles.categoryTitle, { color: WizardColors.text }]} numberOfLines={1}>
          {category.name}
        </ThemedText>
      </View>
      {selected ? (
        <View style={styles.subcategoryRow}>
          {category.subcategories.slice(0, 4).map((subcategory) => (
            <Pressable
              key={subcategory}
              onPress={(event) => {
                event.stopPropagation();
                onToggleSubcategory(subcategory);
              }}
              style={[
                styles.subcategoryChip,
                {
                  borderColor: selectedSubcategories.includes(subcategory)
                    ? WizardColors.primary
                    : WizardColors.border,
                },
              ]}>
              <ThemedText type="small" style={{ color: WizardColors.text }} numberOfLines={1}>
                {subcategory}
              </ThemedText>
            </Pressable>
          ))}
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onAddCustom();
            }}
            style={[styles.subcategoryChip, { borderColor: WizardColors.accent }]}>
            <ThemedText type="small" style={{ color: WizardColors.accent }} numberOfLines={1}>
              + custom
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
}

function BudgetStylePreview({ styleValue }: { styleValue: BudgetStyle }) {
  if (styleValue === 'fifty-thirty-twenty') {
    return (
      <View style={styles.previewStack}>
        {[
          ['Needs · 50%', 'housing, transportation, groceries'],
          ['Wants · 30%', 'dining out, shopping, entertainment'],
          ['Savings and debt · 20%', 'emergency fund, payoff'],
        ].map(([title, detail]) => (
          <View key={title} style={styles.previewBlock}>
            <ThemedText type="smallBold" style={{ color: WizardColors.text }}>{title}</ThemedText>
            <ThemedText type="small" style={{ color: WizardColors.textSecondary }}>{detail}</ThemedText>
          </View>
        ))}
      </View>
    );
  }

  if (styleValue === 'zero-based') {
    return (
      <View style={styles.previewStack}>
        <View style={[styles.previewBlock, { borderColor: WizardColors.accent }]}>
          <ThemedText type="smallBold" style={{ color: WizardColors.accent }}>To be assigned</ThemedText>
        </View>
        {['housing', 'groceries', 'transportation', 'fun money'].map((name) => (
          <View key={name} style={styles.previewRow}>
            <ThemedText type="smallBold" style={{ color: WizardColors.text }}>{name}</ThemedText>
            <ThemedText type="small" style={{ color: WizardColors.textSecondary }}>$0</ThemedText>
          </View>
        ))}
      </View>
    );
  }

  if (styleValue === 'envelopes') {
    return (
      <View style={styles.previewEnvelopeGrid}>
        {['groceries', 'dining out', 'gas', 'fun money'].map((name) => (
          <View key={name} style={styles.previewEnvelope}>
            <ThemedText type="smallBold" style={{ color: WizardColors.text }}>{name}</ThemedText>
            <ThemedText type="small" style={{ color: WizardColors.textSecondary }}>left this month</ThemedText>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.previewBlock}>
      <ThemedText type="smallBold" style={{ color: WizardColors.text }}>Flexible lines follow your history</ThemedText>
      <ThemedText type="small" style={{ color: WizardColors.textSecondary }}>Fixed bills stay fixed. The rest adjusts over time.</ThemedText>
    </View>
  );
}

function GoalSetupModal({
  draft,
  onChange,
  onClose,
  onSave,
}: {
  draft: SetupGoalDraft | null;
  onChange: (draft: SetupGoalDraft | null) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const update = (patch: Partial<NonNullable<typeof draft>>) => {
    if (!draft) return;
    onChange({ ...draft, ...patch });
  };

  return (
    <Modal visible={draft !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.goalSheet, { backgroundColor: WizardColors.backgroundElement, borderColor: WizardColors.borderStrong }]}>
          <ThemedText type="section" style={{ color: WizardColors.text }}>
            Set up your goal
          </ThemedText>
          <WizardField label="Name" value={draft?.name ?? ''} onChangeText={(value) => update({ name: value })} />
          <WizardField label="Saved so far" value={draft?.current ?? ''} onChangeText={(value) => update({ current: value })} keyboardType="numeric" />
          <WizardField label="Goal amount" value={draft?.target ?? ''} onChangeText={(value) => update({ target: value })} keyboardType="numeric" />
          <WizardField label="Monthly plan" value={draft?.monthlyTarget ?? ''} onChangeText={(value) => update({ monthlyTarget: value })} keyboardType="numeric" />
          <WizardField label="Need-by month" value={draft?.targetDate ?? ''} onChangeText={(value) => update({ targetDate: value })} placeholder="YYYY-MM" />
          <View style={styles.chips}>
            <ToggleChip label="Track arrival" selected={draft?.mode === 'track'} onPress={() => update({ mode: 'track' })} />
            <ToggleChip label="Need by date" selected={draft?.mode === 'deadline'} onPress={() => update({ mode: 'deadline' })} />
          </View>
          <View style={styles.controls}>
            <PillButton tone="primary" onPress={onSave}>Save goal</PillButton>
            <PillButton onPress={onClose}>Cancel</PillButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function WizardField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={styles.editorField}>
      <ThemedText type="smallBold" style={{ color: WizardColors.text }}>{label}</ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={WizardColors.textSecondary}
        keyboardType={keyboardType}
        style={[
          styles.customInput,
          {
            borderColor: WizardColors.border,
            color: WizardColors.text,
            backgroundColor: WizardColors.background,
          },
        ]}
      />
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
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  customInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  categoryCard: {
    width: '48%',
    minHeight: 118,
    borderWidth: 1.5,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  categoryTop: {
    gap: Spacing.one,
  },
  categoryTitle: {
    fontSize: 15,
  },
  subcategoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  subcategoryChip: {
    maxWidth: '100%',
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
  importPanel: {
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  styleList: {
    gap: Spacing.two,
  },
  styleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  infoDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleExplainer: {
    paddingTop: Spacing.one,
    paddingLeft: Spacing.two,
    gap: Spacing.two,
  },
  previewStack: {
    gap: Spacing.two,
  },
  previewBlock: {
    borderWidth: 1,
    borderColor: WizardColors.border,
    borderRadius: Radius.control,
    padding: Spacing.two,
    gap: 2,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: WizardColors.border,
    paddingTop: Spacing.one,
  },
  previewEnvelopeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  previewEnvelope: {
    width: '47%',
    borderWidth: 1,
    borderColor: WizardColors.border,
    borderRadius: Radius.control,
    padding: Spacing.two,
    gap: 2,
  },
  emptyReveal: {
    borderWidth: 1,
    borderRadius: Radius.control,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  goalList: {
    gap: Spacing.two,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.control,
    padding: Spacing.two,
  },
  goalCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 13, 28, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  goalSheet: {
    width: '100%',
    maxWidth: 520,
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  editorField: {
    gap: Spacing.one,
  },
  backButton: {
    minHeight: 42,
    paddingHorizontal: Spacing.three,
    borderRadius: 4,
    justifyContent: 'center',
  },
  dimmed: {
    opacity: 0.45,
  },
});
