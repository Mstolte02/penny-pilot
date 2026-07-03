import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { LineChart } from '@/components/mini-charts';
import {
  Card,
  FuelGauge,
  MonthTicker,
  PANEL_BOTTOM_INSET,
  PennyBadge,
  PillButton,
  ProgressBar,
  Screen,
  SpeechBubble,
  ToggleChip,
} from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { chartPalette, colorForCategory, Radius, Spacing } from '@/constants/theme';
import { mobileBudgetPlan, mobileSavingsConfig, mobileTransactions } from '@/data/personal-finance-template';
import {
  avgForecast,
  ewmaForecast,
  EWMA_ALPHA,
  formatMoney,
  formatMonth,
  homeGoalForecast,
  monthKey,
  projectSavings,
  uniqueMonths,
  type MobileTransaction,
} from '@/domain/mobile-finance';
import { useTheme } from '@/hooks/use-theme';

const SEGMENTS = [
  { label: 'Budget', value: 'budget' },
  { label: 'Goals', value: 'goals' },
];

const MOVE_AMOUNTS = [25, 50, 100];

type ForecastMethod = 'avg3' | 'avg6' | 'avg9' | 'avg12' | 'ewma';

const METHOD_OPTIONS: { label: string; value: ForecastMethod }[] = [
  { label: '3-mo avg', value: 'avg3' },
  { label: '6-mo avg', value: 'avg6' },
  { label: '9-mo avg', value: 'avg9' },
  { label: '12-mo avg', value: 'avg12' },
  { label: 'EWMA', value: 'ewma' },
];

const HORIZON_OPTIONS = [
  { label: '1 year', value: 12 },
  { label: '2 years', value: 24 },
  { label: '3 years', value: 36 },
];

type PlanLine = {
  id: string;
  section: string;
  name: string;
  type: 'fixed' | 'flexible';
  amount: number;
  method: ForecastMethod;
  match?: [string, string][];
};

type GoalMode = 'track' | 'deadline';

type GoalPlan = {
  id: string;
  name: string;
  target: number;
  current: number;
  monthlyTarget: number;
  mode: GoalMode;
  targetDate: string;
};

type PlannedExpensePlan = {
  id: string;
  name: string;
  date: string;
  amount: number;
};

type GoalEditorDraft = {
  id?: string;
  name: string;
  target: string;
  current: string;
  monthlyTarget: string;
  targetDate: string;
  mode: GoalMode;
};

type PlannedExpenseDraft = {
  id?: string;
  name: string;
  date: string;
  amount: string;
};

function shortMonth(month: string) {
  return formatMonth(month).replace(/ \d{2}(\d{2})$/, " '$1");
}

function monthInputAfter(startDate: string, count: number) {
  const [year, monthNumber] = startDate.split('-').map(Number);
  const date = new Date(year, monthNumber - 1 + count, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthsBetween(startMonth: string, endMonth: string) {
  const [startYear, startNumber] = startMonth.split('-').map(Number);
  const [endYear, endNumber] = endMonth.split('-').map(Number);
  return (endYear - startYear) * 12 + (endNumber - startNumber);
}

function chooseSavingsProjectionPace(values: number[]) {
  if (values.length < 4) return avgForecast(values, Math.max(values.length, 1));
  if (values.length < 9) return avgForecast(values, 6);
  const avg6 = avgForecast(values, 6);
  const avg12 = avgForecast(values, 12);
  return Math.abs(avg6 - avg12) / Math.max(Math.abs(avg12), 1) > 0.18 ? avg6 : avg12;
}

function methodLabel(method: ForecastMethod) {
  return method === 'ewma' ? `EWMA α ${EWMA_ALPHA}` : `${method.replace('avg', '')}-mo average`;
}

function lineMatchesTransaction(transaction: MobileTransaction, line: PlanLine) {
  if (transaction.type !== 'expense') return false;

  if (line.match?.length) {
    return line.match.some(
      ([category, subcategory]) =>
        transaction.category === category &&
        ((transaction.subcategory ?? 'Uncategorized') === subcategory ||
          (transaction.subcategory ?? '').startsWith(`${subcategory}:`))
    );
  }

  return transaction.category === line.section && transaction.subcategory === line.name;
}

function lineActuals(line: PlanLine, months: string[]) {
  return months.map((month) =>
    mobileTransactions
      .filter((transaction) => monthKey(transaction.date) === month && lineMatchesTransaction(transaction, line))
      .reduce((sum, transaction) => sum + transaction.moneyOut, 0)
  );
}

function forecastFor(line: PlanLine, method: ForecastMethod) {
  const values = lineActuals(line, uniqueMonths(mobileTransactions));
  const amount =
    method === 'ewma' ? ewmaForecast(values) : avgForecast(values, Number(method.replace('avg', '')));
  return Math.round(amount);
}

function seedLines(): PlanLine[] {
  return mobileBudgetPlan.sections.flatMap((section) =>
    section.lines.map<PlanLine>((line) => {
      const base: PlanLine = {
        id: `${section.title}::${line.name}`,
        section: section.title,
        name: line.name,
        type: line.type === 'fixed' ? 'fixed' : 'flexible',
        amount: line.monthly ?? 0,
        method: 'avg6',
        match: line.match,
      };
      if (base.type === 'flexible') {
        base.amount = forecastFor(base, base.method);
      }
      return base;
    })
  );
}

export default function PlanScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ addName?: string; addAmount?: string }>();
  const [active, setActive] = useState('budget');
  const [lines, setLines] = useState<PlanLine[]>(() => seedLines());
  // Reallocation shifts capacity between sections without rewriting individual lines.
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [moveMode, setMoveMode] = useState(false);
  const [moveFrom, setMoveFrom] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const [moveAmountText, setMoveAmountText] = useState('');
  const [pendingMoveAmount, setPendingMoveAmount] = useState<number | null>(null);
  const [methodLineId, setMethodLineId] = useState<string | null>(null);
  const [addSection, setAddSection] = useState('Subscriptions & Fun');
  const [horizon, setHorizon] = useState(24);
  const [goals, setGoals] = useState<GoalPlan[]>(() => {
    const home = homeGoalForecast({ transactions: mobileTransactions, savings: mobileSavingsConfig });
    const transactionMonths = uniqueMonths(mobileTransactions);
    const startMonth = transactionMonths[transactionMonths.length - 1] ?? mobileSavingsConfig.asOfDate.slice(0, 7);
    return [
      {
        id: 'home',
        name: 'First home fund',
        target: Math.round(home.cashNeeded),
        current: Math.round(home.currentSavings),
        monthlyTarget: mobileSavingsConfig.monthlySavingsTarget,
        mode: 'track',
        targetDate:
          home.monthsToGoal === null
            ? monthInputAfter(mobileSavingsConfig.asOfDate, 24)
            : monthInputAfter(startMonth, home.monthsToGoal),
      },
    ];
  });
  const [selectedGoalId, setSelectedGoalId] = useState('home');
  const [goalEditor, setGoalEditor] = useState<GoalEditorDraft | null>(null);
  const [plannedExpenses, setPlannedExpenses] = useState<PlannedExpensePlan[]>(() =>
    mobileSavingsConfig.plannedExpenses.map((expense, index) => ({
      id: `expense-${index}`,
      name: expense.description,
      date: expense.date,
      amount: expense.amount,
    }))
  );
  const [expenseEditor, setExpenseEditor] = useState<PlannedExpenseDraft | null>(null);

  const months = useMemo(() => uniqueMonths(mobileTransactions), []);
  const [month, setMonth] = useState(() => months[months.length - 1] ?? '');

  const sections = useMemo(() => {
    const byTitle = new Map<string, { title: string; lines: PlanLine[]; capacity: number; spent: number }>();
    for (const line of lines) {
      const entry =
        byTitle.get(line.section) ?? { title: line.section, lines: [], capacity: 0, spent: 0 };
      entry.lines.push(line);
      entry.capacity += line.amount;
      entry.spent += mobileTransactions
        .filter((transaction) => monthKey(transaction.date) === month && lineMatchesTransaction(transaction, line))
        .reduce((sum, transaction) => sum + transaction.moneyOut, 0);
      byTitle.set(line.section, entry);
    }
    return Array.from(byTitle.values()).map((section) => ({
      ...section,
      capacity: Math.max(0, section.capacity + (adjustments[section.title] ?? 0)),
    }));
  }, [lines, month, adjustments]);

  const monthlyIncome = mobileBudgetPlan.income.reduce((sum, income) => sum + income.monthly, 0);
  const totalCapacity = sections.reduce((sum, section) => sum + section.capacity, 0);
  const savingsTarget = monthlyIncome - totalCapacity;
  const overCommitted = savingsTarget < 0;
  const methodLine = lines.find((line) => line.id === methodLineId) ?? null;

  const pendingAdd =
    params.addName && params.addAmount
      ? { name: String(params.addName), amount: Number(params.addAmount) || 0 }
      : null;

  const moveFuel = (amount: number) => {
    if (!moveFrom || !moveTo || moveFrom === moveTo) return;
    setAdjustments((current) => ({
      ...current,
      [moveFrom]: (current[moveFrom] ?? 0) - amount,
      [moveTo]: (current[moveTo] ?? 0) + amount,
    }));
    setMoveAmountText('');
    setPendingMoveAmount(null);
  };

  const requestMoveFuel = (amount: number) => {
    if (!moveFrom || !moveTo || moveFrom === moveTo || amount <= 0) return;
    setPendingMoveAmount(Math.round(amount));
  };

  const requestCustomMoveFuel = () => {
    const amount = Number(moveAmountText.replace(/[^0-9.]/g, '')) || 0;
    requestMoveFuel(amount);
  };

  const updateLine = (id: string, patch: Partial<PlanLine>) =>
    setLines((current) =>
      current.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, ...patch };
        if (next.type === 'flexible' && (patch.type === 'flexible' || patch.method)) {
          next.amount = forecastFor(next, next.method);
        }
        return next;
      })
    );

  const addPendingToPlan = () => {
    if (!pendingAdd) return;
    setLines((current) => [
      ...current,
      {
        id: `${addSection}::${pendingAdd.name}`,
        section: addSection,
        name: pendingAdd.name,
        type: 'fixed',
        amount: Math.round(pendingAdd.amount),
        method: 'avg6',
      },
    ]);
    setOpenSection(addSection);
    router.setParams({ addName: '', addAmount: '' });
  };

  const openGoalEditor = (goalToEdit?: GoalPlan) => {
    setGoalEditor({
      id: goalToEdit?.id,
      name: goalToEdit?.name ?? '',
      target: goalToEdit ? String(goalToEdit.target) : '',
      current: goalToEdit ? String(goalToEdit.current) : '',
      monthlyTarget: goalToEdit ? String(goalToEdit.monthlyTarget) : String(mobileSavingsConfig.monthlySavingsTarget),
      targetDate: goalToEdit?.targetDate ?? monthInputAfter(mobileSavingsConfig.asOfDate, 18),
      mode: goalToEdit?.mode ?? 'track',
    });
  };

  const saveGoalEditor = () => {
    if (!goalEditor) return;
    const id = goalEditor.id ?? `goal-${Date.now()}`;
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
      current.some((goalItem) => goalItem.id === id)
        ? current.map((goalItem) => (goalItem.id === id ? next : goalItem))
        : [...current, next]
    );
    setSelectedGoalId(id);
    setGoalEditor(null);
  };

  const openExpenseEditor = (expense?: PlannedExpensePlan) => {
    setExpenseEditor({
      id: expense?.id,
      name: expense?.name ?? '',
      date: expense?.date ?? monthInputAfter(mobileSavingsConfig.asOfDate, 6),
      amount: expense ? String(expense.amount) : '',
    });
  };

  const saveExpenseEditor = () => {
    if (!expenseEditor) return;
    const id = expenseEditor.id ?? `expense-${Date.now()}`;
    const next: PlannedExpensePlan = {
      id,
      name: expenseEditor.name.trim() || 'Planned expense',
      date: expenseEditor.date,
      amount: Number(expenseEditor.amount.replace(/[^0-9.]/g, '')) || 0,
    };
    setPlannedExpenses((current) =>
      current.some((expense) => expense.id === id)
        ? current.map((expense) => (expense.id === id ? next : expense))
        : [...current, next].sort((a, b) => a.date.localeCompare(b.date))
    );
    setExpenseEditor(null);
  };

  const selectedGoal = goals.find((entry) => entry.id === selectedGoalId) ?? goals[0];

  const projection = useMemo(() => {
    const values = uniqueMonths(mobileTransactions).map((m) =>
      mobileTransactions
        .filter((transaction) => monthKey(transaction.date) === m)
        .reduce(
          (sum, transaction) =>
            sum + (transaction.type === 'income' ? transaction.moneyIn : -transaction.moneyOut),
          0
        )
    );
    const actualPace = chooseSavingsProjectionPace(values);
    const savingsGoal = selectedGoal ?? goals[0];
    const plannedForProjection = plannedExpenses.map((expense) => ({
      date: expense.date,
      description: expense.name,
      amount: expense.amount,
    }));
    const points = projectSavings({
      startBalance: savingsGoal?.current ?? mobileSavingsConfig.currentSavings,
      startDate: mobileSavingsConfig.asOfDate,
      months: horizon,
      budgetedMonthly: savingsGoal?.monthlyTarget ?? mobileSavingsConfig.monthlySavingsTarget,
      actualMonthly: actualPace,
      plannedExpenses: plannedForProjection,
      recurringExpenses: mobileSavingsConfig.recurringExpenses,
      apyMonthly: mobileSavingsConfig.savingsApy / 12,
    });
    const expenseMonths = new Set(
      plannedExpenses.map((expense) => expense.date.slice(0, 7))
    );
    const markerIndexes = points
      .map((point, index) => (expenseMonths.has(point.month) ? index : -1))
      .filter((index) => index >= 0);

    return { points, actualPace, markerIndexes };
  }, [goals, horizon, plannedExpenses, selectedGoal]);

  const goalSummary = useMemo(() => {
    const target = selectedGoal?.target ?? 0;
    const current = selectedGoal?.current ?? 0;
    const progress = target > 0 ? Math.min(current / target, 1) : 0;
    const actualIndex = projection.points.findIndex((point) => point.actual >= target);
    const budgetedIndex = projection.points.findIndex((point) => point.budgeted >= target);
    const startMonth = projection.points[0]?.month ?? mobileSavingsConfig.asOfDate.slice(0, 7);
    const actualMonth = actualIndex >= 0 ? projection.points[actualIndex]?.month : null;
    const budgetedMonth = budgetedIndex >= 0 ? projection.points[budgetedIndex]?.month : null;
    const deadlineIndex = selectedGoal?.targetDate
      ? monthsBetween(startMonth, selectedGoal.targetDate.slice(0, 7))
      : null;
    const earlyBy =
      deadlineIndex !== null && actualIndex >= 0 ? Math.max(0, deadlineIndex - actualIndex) : 0;
    const lateBy =
      deadlineIndex !== null && actualIndex >= 0 ? Math.max(0, actualIndex - deadlineIndex) : 0;

    return {
      progress,
      actualMonth,
      budgetedMonth,
      actualIndex,
      deadlineIndex,
      earlyBy,
      lateBy,
      label:
        selectedGoal?.mode === 'deadline'
          ? actualIndex < 0
            ? `Need by ${formatMonth(selectedGoal.targetDate)} · not on track yet`
            : actualIndex <= (deadlineIndex ?? -1)
              ? `Need by ${formatMonth(selectedGoal.targetDate)} · on track${earlyBy > 0 ? ` and early by ${earlyBy} mo` : ''}`
              : `Need by ${formatMonth(selectedGoal.targetDate)} · behind by ${lateBy} mo`
          : actualMonth
            ? `Expected by ${formatMonth(actualMonth)} · ${Math.round(progress * 100)}% of the way there`
            : `${Math.round(progress * 100)}% there · arrival beyond this projection`,
    };
  }, [projection.points, selectedGoal]);

  return (
    <Screen
      eyebrow="Plan"
      title="Plan"
      subtitle="This month's budget and the goals beyond it"
      mascot={<PennyBadge expression={overCommitted ? 'concerned' : 'happy'} />}
      segments={SEGMENTS}
      active={active}
      onSelect={setActive}>
      {active === 'budget' ? (
        <ScrollView
          style={styles.panel}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}>
          {pendingAdd ? (
            <Card style={[styles.addCard, { borderColor: theme.primary }]}>
              <ThemedText type="smallBold">
                Add {pendingAdd.name} ({formatMoney(pendingAdd.amount)}/mo) to your budget?
              </ThemedText>
              <View style={styles.chips}>
                {sections.map((section) => (
                  <ToggleChip
                    key={section.title}
                    label={section.title}
                    selected={addSection === section.title}
                    onPress={() => setAddSection(section.title)}
                  />
                ))}
              </View>
              <View style={styles.addActions}>
                <PillButton tone="primary" onPress={addPendingToPlan}>
                  Add to {addSection}
                </PillButton>
                <PillButton onPress={() => router.setParams({ addName: '', addAmount: '' })}>
                  Not now
                </PillButton>
              </View>
            </Card>
          ) : null}

          <View style={styles.topRow}>
            <MonthTicker months={months} value={month} onChange={setMonth} formatLabel={shortMonth} />
            <PillButton
              tone={moveMode ? 'primary' : 'quiet'}
              onPress={() => {
                setMoveMode((value) => !value);
                setMoveFrom(null);
                setMoveTo(null);
              }}>
              {moveMode ? 'Done moving' : 'Move money'}
            </PillButton>
          </View>

          <ThemedText type="small" themeColor="textSecondary">
            {formatMoney(monthlyIncome)} income · {formatMoney(totalCapacity)} budgeted ·{' '}
            {formatMoney(Math.abs(savingsTarget))} {overCommitted ? 'over-committed' : 'toward goals'}
          </ThemedText>

          {moveMode ? (
            <Card style={[styles.moveCard, { borderColor: theme.primary }]}>
              <ThemedText type="smallBold">
                {!moveFrom
                  ? 'Tap the category to take money from'
                  : !moveTo
                    ? `From ${moveFrom} — now tap the category to add to`
                    : `${moveFrom} → ${moveTo}`}
              </ThemedText>
              {moveFrom && moveTo ? (
                <>
                  <View style={styles.chips}>
                    {MOVE_AMOUNTS.map((amount) => (
                      <ToggleChip
                        key={amount}
                        label={`Move ${formatMoney(amount)}`}
                        onPress={() => requestMoveFuel(amount)}
                      />
                    ))}
                  </View>
                  <View style={styles.customMoveRow}>
                    <TextInput
                      value={moveAmountText}
                      onChangeText={setMoveAmountText}
                      keyboardType="numeric"
                      placeholder="Custom amount"
                      placeholderTextColor={theme.textSecondary}
                      style={[
                        styles.customMoveInput,
                        { borderColor: theme.border, color: theme.text, backgroundColor: theme.backgroundElement },
                      ]}
                    />
                    <PillButton tone="primary" onPress={requestCustomMoveFuel}>
                      Review move
                    </PillButton>
                  </View>
                </>
              ) : null}
            </Card>
          ) : null}

          {sections.map((section) => {
            const selected = moveMode && (moveFrom === section.title || moveTo === section.title);
            return (
              <Pressable
                key={section.title}
                onPress={() => {
                  if (moveMode) {
                    if (!moveFrom) setMoveFrom(section.title);
                    else if (!moveTo && section.title !== moveFrom) setMoveTo(section.title);
                    else if (section.title === moveFrom) setMoveFrom(null);
                    else if (section.title === moveTo) setMoveTo(null);
                    return;
                  }
                  setOpenSection((current) => (current === section.title ? null : section.title));
                }}>
                <Card
                  style={StyleSheet.flatten([
                    styles.gaugeCard,
                    selected && { borderColor: theme.primary, borderWidth: 2 },
                  ])}>
                  <FuelGauge
                    label={section.title}
                    spent={section.spent}
                    capacity={section.capacity}
                    color={colorForCategory(section.title)}
                    formatValue={(value) => formatMoney(value)}
                  />
                  {openSection === section.title && !moveMode ? (
                    <View style={styles.lineList}>
                      {section.lines.map((line) => (
                        <View key={line.id} style={[styles.lineRow, { borderTopColor: theme.border }]}>
                          <View style={styles.lineTop}>
                            <View style={styles.lineCopy}>
                              <ThemedText type="smallBold" numberOfLines={1}>
                                {line.name}
                              </ThemedText>
                              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                                {line.type === 'fixed' ? 'Fixed amount' : methodLabel(line.method)}
                              </ThemedText>
                            </View>
                            {line.type === 'fixed' ? (
                              <TextInput
                                value={String(Math.round(line.amount))}
                                keyboardType="numeric"
                                onChangeText={(value) =>
                                  updateLine(line.id, { amount: Number(value.replace(/[^0-9.]/g, '')) || 0 })
                                }
                                style={[styles.amountInput, { borderColor: theme.border, color: theme.text }]}
                              />
                            ) : (
                              <ThemedText type="money">{formatMoney(line.amount)}</ThemedText>
                            )}
                          </View>
                          <View style={styles.lineControls}>
                            <ToggleChip
                              label="Fixed"
                              selected={line.type === 'fixed'}
                              onPress={() => updateLine(line.id, { type: 'fixed' })}
                            />
                            <ToggleChip
                              label="Flexible"
                              selected={line.type === 'flexible'}
                              onPress={() => {
                                updateLine(line.id, { type: 'flexible' });
                                setMethodLineId(line.id);
                              }}
                            />
                            {line.type === 'flexible' ? (
                              <PillButton onPress={() => setMethodLineId(line.id)}>
                                Change method
                              </PillButton>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </Card>
              </Pressable>
            );
          })}

          <SpeechBubble expression={overCommitted ? 'concerned' : 'default'}>
            {moveMode
              ? 'Moved amounts stay moved — the plan is yours to balance.'
              : 'Tap a category to edit its lines. Fixed = you set the number; Flexible = Penny sets it from your history.'}
          </SpeechBubble>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.panel}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}>
          <Card style={[styles.destinationCard, { borderColor: theme.info }]}>
            <View style={styles.destinationHead}>
              <View style={styles.destinationCopy}>
                <ThemedText type="small" style={{ color: theme.secondary }}>
                  DESTINATION
                </ThemedText>
                <ThemedText type="section">{selectedGoal?.name ?? 'Goal'}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                  {goalSummary.label}
                </ThemedText>
              </View>
            </View>
            <ProgressBar value={goalSummary.progress} color={theme.info} />
            {goals.length > 1 ? (
              <View style={styles.chips}>
                {goals.map((goalItem) => (
                  <ToggleChip
                    key={goalItem.id}
                    label={goalItem.name}
                    selected={goalItem.id === selectedGoal?.id}
                    onPress={() => setSelectedGoalId(goalItem.id)}
                  />
                ))}
              </View>
            ) : null}
            <View style={styles.chips}>
              <ToggleChip
                label="Track arrival"
                selected={selectedGoal?.mode === 'track'}
                onPress={() =>
                  selectedGoal &&
                  setGoals((current) =>
                    current.map((goalItem) =>
                      goalItem.id === selectedGoal.id ? { ...goalItem, mode: 'track' } : goalItem
                    )
                  )
                }
              />
              <ToggleChip
                label="Need by date"
                selected={selectedGoal?.mode === 'deadline'}
                onPress={() =>
                  selectedGoal &&
                  setGoals((current) =>
                    current.map((goalItem) =>
                      goalItem.id === selectedGoal.id ? { ...goalItem, mode: 'deadline' } : goalItem
                    )
                  )
                }
              />
            </View>
            <View style={styles.destinationStats}>
              <DestinationStat label="Saved" value={formatMoney(selectedGoal?.current ?? 0)} />
              <DestinationStat label="Goal" value={formatMoney(selectedGoal?.target ?? 0)} />
              <DestinationStat label="Plan" value={`${formatMoney(selectedGoal?.monthlyTarget ?? 0)}/mo`} />
            </View>
            <View style={styles.addActions}>
              <PillButton tone="primary" onPress={() => openGoalEditor()}>
                Add goal
              </PillButton>
              {selectedGoal ? (
                <PillButton onPress={() => openGoalEditor(selectedGoal)}>Edit goal</PillButton>
              ) : null}
            </View>
          </Card>

          <Card style={styles.projectionCard}>
            <ThemedText type="smallBold">Savings projection</ThemedText>
            <View style={styles.chips}>
              {HORIZON_OPTIONS.map((option) => (
                <ToggleChip
                  key={option.value}
                  label={option.label}
                  selected={horizon === option.value}
                  onPress={() => setHorizon(option.value)}
                />
              ))}
            </View>
            <LineChart
              height={180}
              formatValue={(value) => formatMoney(value)}
              series={[
                {
                  points: projection.points.map((point) => ({
                    label: shortMonth(point.month),
                    value: point.actual,
                  })),
                  color: chartPalette.steelBlue,
                  area: true,
                },
                {
                  points: projection.points.map((point) => ({
                    label: shortMonth(point.month),
                    value: point.budgeted,
                  })),
                  color: theme.textSecondary,
                  dashed: true,
                },
              ]}
              markers={projection.markerIndexes.map((pointIndex) => ({
                seriesIndex: 0,
                pointIndex,
              }))}
              legend={[
                { label: 'Actual pace', color: chartPalette.steelBlue },
                { label: 'Budgeted plan', color: theme.textSecondary, dashed: true },
              ]}
            />
            <ThemedText type="small" themeColor="textSecondary">
              Tap the graph to inspect actual and budgeted balances. Penny chooses the projection
              model behind the scenes as history grows · current pace {formatMoney(projection.actualPace)}/mo.
            </ThemedText>
          </Card>

          <Card style={styles.projectionCard}>
            <View style={styles.destinationHead}>
              <View style={styles.destinationCopy}>
                <ThemedText type="smallBold">Planned expenses</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  One-time expenses that should bend the savings curve before they happen.
                </ThemedText>
              </View>
              <PillButton tone="primary" onPress={() => openExpenseEditor()}>
                Add
              </PillButton>
            </View>
            {plannedExpenses.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                No planned expenses yet.
              </ThemedText>
            ) : (
              plannedExpenses.map((expense) => (
                <Pressable
                  key={expense.id}
                  onPress={() => openExpenseEditor(expense)}
                  style={({ pressed }) => [
                    styles.expenseRow,
                    { borderTopColor: theme.border, opacity: pressed ? 0.72 : 1 },
                  ]}>
                  <View style={styles.destinationCopy}>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {expense.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatMonth(expense.date.slice(0, 7))}
                    </ThemedText>
                  </View>
                  <ThemedText type="money">{formatMoney(expense.amount)}</ThemedText>
                </Pressable>
              ))
            )}
          </Card>

          <SpeechBubble
            expression={projection.actualPace >= (selectedGoal?.monthlyTarget ?? 0) ? 'onTrack' : 'thinking'}>
            {projection.actualPace >= (selectedGoal?.monthlyTarget ?? 0)
              ? 'Actual pace is running ahead of the plan — the arrival date is safe.'
              : 'Pace is a touch behind plan. Moving a little budget toward savings pulls the arrival date closer.'}
          </SpeechBubble>
        </ScrollView>
      )}

      <MethodModal
        key={methodLineId ?? 'closed'}
        line={methodLine}
        onClose={() => setMethodLineId(null)}
        onPick={(method) => {
          if (methodLine) updateLine(methodLine.id, { method });
          setMethodLineId(null);
        }}
        preview={(method) => (methodLine ? forecastFor(methodLine, method) : 0)}
      />
      <MoveConfirmModal
        amount={pendingMoveAmount}
        from={moveFrom}
        to={moveTo}
        onClose={() => setPendingMoveAmount(null)}
        onConfirm={() => {
          if (pendingMoveAmount) moveFuel(pendingMoveAmount);
        }}
      />
      <GoalEditorModal
        draft={goalEditor}
        onChange={setGoalEditor}
        onClose={() => setGoalEditor(null)}
        onSave={saveGoalEditor}
      />
      <PlannedExpenseModal
        draft={expenseEditor}
        onChange={setExpenseEditor}
        onClose={() => setExpenseEditor(null)}
        onSave={saveExpenseEditor}
      />
    </Screen>
  );
}

function MoveConfirmModal({
  amount,
  from,
  to,
  onClose,
  onConfirm,
}: {
  amount: number | null;
  from: string | null;
  to: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const theme = useTheme();

  return (
    <Modal visible={amount !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.methodSheet,
            { backgroundColor: theme.backgroundElement, borderColor: theme.borderStrong },
          ]}>
          <View style={styles.confirmHead}>
            <PennyBadge expression="thinking" size={58} animated={false} />
            <View style={styles.destinationCopy}>
              <ThemedText type="section">Move {formatMoney(amount ?? 0)}?</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {from} → {to}
              </ThemedText>
            </View>
          </View>
          <SpeechBubble expression="thinking">
            I support your autonomy, but want to check in and make sure this is the right move. Are you sure?
          </SpeechBubble>
          <View style={styles.addActions}>
            <PillButton tone="primary" onPress={onConfirm}>
              Confirm move
            </PillButton>
            <PillButton onPress={onClose}>Cancel</PillButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function GoalEditorModal({
  draft,
  onChange,
  onClose,
  onSave,
}: {
  draft: GoalEditorDraft | null;
  onChange: (draft: GoalEditorDraft | null) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const theme = useTheme();
  const update = (patch: Partial<GoalEditorDraft>) => {
    if (!draft) return;
    onChange({ ...draft, ...patch });
  };

  return (
    <Modal visible={draft !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.methodSheet,
            { backgroundColor: theme.backgroundElement, borderColor: theme.borderStrong },
          ]}>
          <ThemedText type="section">{draft?.id ? 'Edit goal' : 'Add goal'}</ThemedText>
          <BudgetEditorField label="Name" value={draft?.name ?? ''} onChangeText={(value) => update({ name: value })} />
          <BudgetEditorField
            label="Current saved"
            value={draft?.current ?? ''}
            onChangeText={(value) => update({ current: value })}
            keyboardType="numeric"
          />
          <BudgetEditorField
            label="Goal amount"
            value={draft?.target ?? ''}
            onChangeText={(value) => update({ target: value })}
            keyboardType="numeric"
          />
          <BudgetEditorField
            label="Monthly plan"
            value={draft?.monthlyTarget ?? ''}
            onChangeText={(value) => update({ monthlyTarget: value })}
            keyboardType="numeric"
          />
          <BudgetEditorField
            label="Need-by month"
            value={draft?.targetDate ?? ''}
            onChangeText={(value) => update({ targetDate: value })}
            placeholder="YYYY-MM"
          />
          <View style={styles.chips}>
            <ToggleChip
              label="Track arrival"
              selected={draft?.mode === 'track'}
              onPress={() => update({ mode: 'track' })}
            />
            <ToggleChip
              label="Need by date"
              selected={draft?.mode === 'deadline'}
              onPress={() => update({ mode: 'deadline' })}
            />
          </View>
          <View style={styles.addActions}>
            <PillButton tone="primary" onPress={onSave}>Save goal</PillButton>
            <PillButton onPress={onClose}>Cancel</PillButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function PlannedExpenseModal({
  draft,
  onChange,
  onClose,
  onSave,
}: {
  draft: PlannedExpenseDraft | null;
  onChange: (draft: PlannedExpenseDraft | null) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const theme = useTheme();
  const update = (patch: Partial<PlannedExpenseDraft>) => {
    if (!draft) return;
    onChange({ ...draft, ...patch });
  };

  return (
    <Modal visible={draft !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.methodSheet,
            { backgroundColor: theme.backgroundElement, borderColor: theme.borderStrong },
          ]}>
          <ThemedText type="section">{draft?.id ? 'Edit planned expense' : 'Add planned expense'}</ThemedText>
          <BudgetEditorField label="Name" value={draft?.name ?? ''} onChangeText={(value) => update({ name: value })} />
          <BudgetEditorField
            label="Date"
            value={draft?.date ?? ''}
            onChangeText={(value) => update({ date: value })}
            placeholder="YYYY-MM-DD"
          />
          <BudgetEditorField
            label="Amount"
            value={draft?.amount ?? ''}
            onChangeText={(value) => update({ amount: value })}
            keyboardType="numeric"
          />
          <View style={styles.addActions}>
            <PillButton tone="primary" onPress={onSave}>Save expense</PillButton>
            <PillButton onPress={onClose}>Cancel</PillButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function BudgetEditorField({
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
  const theme = useTheme();

  return (
    <View style={styles.editorField}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        keyboardType={keyboardType}
        style={[
          styles.editorInput,
          { borderColor: theme.border, color: theme.text, backgroundColor: theme.background },
        ]}
      />
    </View>
  );
}

/**
 * The flexible-amount explainer: plain-language choice between n-month averages
 * and EWMA. This stays visible for budget category tuning; savings projections
 * choose their model behind the scenes.
 */
function MethodModal({
  line,
  onClose,
  onPick,
  preview,
}: {
  line: PlanLine | null;
  onClose: () => void;
  onPick: (method: ForecastMethod) => void;
  preview: (method: ForecastMethod) => number;
}) {
  const theme = useTheme();
  // The modal is keyed by line id, so initial state resets per line.
  const [selected, setSelected] = useState<ForecastMethod>(line?.method ?? 'avg6');

  return (
    <Modal visible={line !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.methodSheet,
            { backgroundColor: theme.backgroundElement, borderColor: theme.borderStrong },
          ]}>
          <ThemedText type="section">How should Penny set “{line?.name}”?</ThemedText>

          <View style={[styles.methodExplainer, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold">N-month average</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Your typical spend over the last N months, weighted equally. Steady and predictable —
              good for stable categories like groceries.
            </ThemedText>
          </View>
          <View style={[styles.methodExplainer, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold">EWMA (recent months count more)</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              An exponentially weighted average (α {EWMA_ALPHA}): last month matters most, older
              months fade out. Reacts faster when your habits change.
            </ThemedText>
          </View>

          <View style={styles.chips}>
            {METHOD_OPTIONS.map((option) => (
              <ToggleChip
                key={option.value}
                label={option.label}
                selected={selected === option.value}
                onPress={() => setSelected(option.value)}
              />
            ))}
          </View>

          <ThemedText type="small" themeColor="textSecondary">
            {methodLabel(selected)} would budget {formatMoney(preview(selected))}/mo here.
          </ThemedText>

          <View style={styles.addActions}>
            <PillButton tone="primary" onPress={() => onPick(selected)}>
              Use {methodLabel(selected)}
            </PillButton>
            <PillButton onPress={onClose}>Cancel</PillButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DestinationStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.destinationStat}>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText type="money" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value}
      </ThemedText>
    </View>
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  addCard: {
    gap: Spacing.two,
  },
  addActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  moveCard: {
    gap: Spacing.two,
  },
  customMoveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  customMoveInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontWeight: '700',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  gaugeCard: {
    gap: Spacing.two,
  },
  lineList: {
    gap: Spacing.one,
  },
  lineRow: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
  },
  lineTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  lineCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  lineControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  amountInput: {
    width: 84,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    textAlign: 'right',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  destinationCard: {
    gap: Spacing.two,
  },
  destinationHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  destinationCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  destinationStats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  destinationStat: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  projectionCard: {
    gap: Spacing.two,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderTopWidth: 1,
    paddingTop: Spacing.two,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(30, 24, 18, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  methodSheet: {
    width: '100%',
    maxWidth: 520,
    borderWidth: 1,
    borderRadius: Radius.card + 6,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  confirmHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  editorField: {
    gap: Spacing.one,
  },
  editorInput: {
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
  },
  methodExplainer: {
    borderRadius: Radius.control,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
