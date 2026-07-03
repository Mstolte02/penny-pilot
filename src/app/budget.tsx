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
  Pill,
  PillButton,
  ProgressBar,
  Screen,
  SpeechBubble,
  ToggleChip,
} from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { chartPalette, Radius, Spacing } from '@/constants/theme';
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

const PACE_OPTIONS: { label: string; value: number | 'ewma' }[] = [
  { label: '3-mo', value: 3 },
  { label: '6-mo', value: 6 },
  { label: '12-mo', value: 12 },
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

function shortMonth(month: string) {
  return formatMonth(month).replace(/ \d{2}(\d{2})$/, " '$1");
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
  const [methodLineId, setMethodLineId] = useState<string | null>(null);
  const [addSection, setAddSection] = useState('Subscriptions & Fun');
  const [pace, setPace] = useState<number | 'ewma'>('ewma');
  const [horizon, setHorizon] = useState(24);

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

  const goal = useMemo(
    () => homeGoalForecast({ transactions: mobileTransactions, savings: mobileSavingsConfig }),
    []
  );

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
    const actualPace = pace === 'ewma' ? ewmaForecast(values) : avgForecast(values, pace);
    const points = projectSavings({
      startBalance: mobileSavingsConfig.currentSavings,
      startDate: mobileSavingsConfig.asOfDate,
      months: horizon,
      budgetedMonthly: mobileSavingsConfig.monthlySavingsTarget,
      actualMonthly: actualPace,
      plannedExpenses: mobileSavingsConfig.plannedExpenses,
      recurringExpenses: mobileSavingsConfig.recurringExpenses,
      apyMonthly: mobileSavingsConfig.savingsApy / 12,
    });
    const expenseMonths = new Set(
      mobileSavingsConfig.plannedExpenses.map((expense) => expense.date.slice(0, 7))
    );
    const markerIndexes = points
      .map((point, index) => (expenseMonths.has(point.month) ? index : -1))
      .filter((index) => index >= 0);

    return { points, actualPace, markerIndexes };
  }, [pace, horizon]);

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
                <View style={styles.chips}>
                  {MOVE_AMOUNTS.map((amount) => (
                    <ToggleChip key={amount} label={`Move ${formatMoney(amount)}`} onPress={() => moveFuel(amount)} />
                  ))}
                </View>
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
          <Card style={[styles.destinationCard, { borderColor: theme.accent }]}>
            <View style={styles.destinationHead}>
              <View style={styles.destinationCopy}>
                <ThemedText type="small" style={{ color: theme.secondary }}>
                  DESTINATION
                </ThemedText>
                <ThemedText type="section">First home fund</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                  {Math.round(goal.progress * 100)}% of the way there · arrival by {goal.targetDateLabel}
                </ThemedText>
              </View>
              <Pill label={`${Math.round(goal.progress * 100)}%`} tone="info" />
            </View>
            <ProgressBar value={goal.progress} />
            <View style={styles.destinationStats}>
              <DestinationStat label="Saved" value={formatMoney(goal.currentSavings)} />
              <DestinationStat label="Cash needed" value={formatMoney(goal.cashNeeded)} />
              <DestinationStat label="Pace" value={`${formatMoney(goal.monthlySavingsPace)}/mo`} />
            </View>
          </Card>

          <Card style={styles.projectionCard}>
            <ThemedText type="smallBold">Savings projection</ThemedText>
            <View style={styles.chips}>
              {PACE_OPTIONS.map((option) => (
                <ToggleChip
                  key={String(option.value)}
                  label={option.label}
                  selected={pace === option.value}
                  onPress={() => setPace(option.value)}
                />
              ))}
            </View>
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
              ● Planned expense draws the balance down · balances compound at{' '}
              {(mobileSavingsConfig.savingsApy * 100).toFixed(1)}% APY · pace{' '}
              {formatMoney(projection.actualPace)}/mo
            </ThemedText>
          </Card>

          <SpeechBubble
            expression={projection.actualPace >= mobileSavingsConfig.monthlySavingsTarget ? 'onTrack' : 'thinking'}>
            {projection.actualPace >= mobileSavingsConfig.monthlySavingsTarget
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
    </Screen>
  );
}

/**
 * The flexible-amount explainer: plain-language choice between n-month averages
 * and EWMA (α 0.35 for now — a tunable candidate for paid tiers later).
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
      <ThemedText type="money" numberOfLines={1}>
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
  methodExplainer: {
    borderRadius: Radius.control,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
