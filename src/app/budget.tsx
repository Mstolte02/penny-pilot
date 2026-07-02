import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { TrendBars } from '@/components/mini-charts';
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
import { Spacing } from '@/constants/theme';
import { mobileBudgetPlan, mobileSavingsConfig, mobileTransactions } from '@/data/personal-finance-template';
import {
  avgActualMonthlySavings,
  ewmaMonthlySavings,
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
  { label: 'Fuel', value: 'fuel' },
  { label: 'Goals', value: 'goals' },
];

const MOVE_AMOUNTS = [25, 50, 100];

type PlanLine = {
  id: string;
  section: string;
  name: string;
  type: 'fixed' | 'variable';
  amount: number;
  match?: [string, string][];
};

function shortMonth(month: string) {
  return formatMonth(month).replace(/ \d{2}(\d{2})$/, " '$1");
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

function seedLines(): PlanLine[] {
  const months = uniqueMonths(mobileTransactions);
  const recent = months.slice(-6);

  return mobileBudgetPlan.sections.flatMap((section) =>
    section.lines.map<PlanLine>((line) => {
      const base: PlanLine = {
        id: `${section.title}::${line.name}`,
        section: section.title,
        name: line.name,
        type: line.type === 'fixed' ? 'fixed' : 'variable',
        amount: line.monthly ?? 0,
        match: line.match,
      };
      if (base.amount === 0 && base.type === 'variable') {
        const totals = recent.map((month) =>
          mobileTransactions
            .filter((transaction) => monthKey(transaction.date) === month && lineMatchesTransaction(transaction, base))
            .reduce((sum, transaction) => sum + transaction.moneyOut, 0)
        );
        base.amount = totals.length
          ? Math.round(totals.reduce((sum, value) => sum + value, 0) / totals.length)
          : 0;
      }
      return base;
    })
  );
}

export default function FlightPlanScreen() {
  const theme = useTheme();
  const [active, setActive] = useState('fuel');
  const [lines, setLines] = useState<PlanLine[]>(() => seedLines());
  // Envelope reallocation lives here: moving fuel shifts capacity between
  // sections without rewriting individual lines.
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [moveMode, setMoveMode] = useState(false);
  const [moveFrom, setMoveFrom] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState<string | null>(null);

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

  const moveFuel = (amount: number) => {
    if (!moveFrom || !moveTo || moveFrom === moveTo) return;
    setAdjustments((current) => ({
      ...current,
      [moveFrom]: (current[moveFrom] ?? 0) - amount,
      [moveTo]: (current[moveTo] ?? 0) + amount,
    }));
  };

  const updateLineAmount = (id: string, amount: number) =>
    setLines((current) => current.map((line) => (line.id === id ? { ...line, amount } : line)));

  const goal = useMemo(
    () => homeGoalForecast({ transactions: mobileTransactions, savings: mobileSavingsConfig }),
    []
  );
  const savings = useMemo(() => {
    const budgetedTarget = mobileSavingsConfig.monthlySavingsTarget;
    const pace = ewmaMonthlySavings(mobileTransactions);
    const avg6 = avgActualMonthlySavings(mobileTransactions, 6);
    const projection = projectSavings({
      startBalance: mobileSavingsConfig.currentSavings,
      startDate: mobileSavingsConfig.asOfDate,
      months: 24,
      budgetedMonthly: budgetedTarget,
      actualMonthly: pace,
      plannedExpenses: mobileSavingsConfig.plannedExpenses,
      recurringExpenses: mobileSavingsConfig.recurringExpenses,
      apyMonthly: mobileSavingsConfig.savingsApy / 12,
    });
    const step = Math.max(1, Math.ceil(projection.length / 6));
    return {
      budgetedTarget,
      pace,
      avg6,
      chart: projection
        .filter((_, index) => index % step === 0)
        .map((point) => ({ label: shortMonth(point.month), value: point.actual })),
    };
  }, []);
  const onPace = savings.pace >= savings.budgetedTarget;

  return (
    <Screen
      eyebrow="Flight Plan"
      title="Flight Plan"
      subtitle="Fuel for the month, destinations beyond it"
      mascot={<PennyBadge expression={overCommitted ? 'concerned' : 'happy'} />}
      segments={SEGMENTS}
      active={active}
      onSelect={setActive}>
      {active === 'fuel' ? (
        <ScrollView
          style={styles.panel}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            <MonthTicker months={months} value={month} onChange={setMonth} formatLabel={shortMonth} />
            <PillButton
              tone={moveMode ? 'primary' : 'quiet'}
              onPress={() => {
                setMoveMode((value) => !value);
                setMoveFrom(null);
                setMoveTo(null);
              }}>
              {moveMode ? 'Done moving' : 'Move fuel'}
            </PillButton>
          </View>

          <ThemedText type="small" themeColor="textSecondary">
            {formatMoney(monthlyIncome)} income · {formatMoney(totalCapacity)} fueled ·{' '}
            {formatMoney(Math.abs(savingsTarget))} {overCommitted ? 'over-committed' : 'toward goals'}
          </ThemedText>

          {moveMode ? (
            <Card style={[styles.moveCard, { borderColor: theme.primary }]}>
              <ThemedText type="smallBold">
                {!moveFrom
                  ? 'Tap the tank to draw fuel from'
                  : !moveTo
                    ? `From ${moveFrom} — now tap the tank to fill`
                    : `${moveFrom} → ${moveTo}`}
              </ThemedText>
              {moveFrom && moveTo ? (
                <View style={styles.moveAmounts}>
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
                          <View style={styles.lineCopy}>
                            <ThemedText type="smallBold" numberOfLines={1}>
                              {line.name}
                            </ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              {line.type === 'fixed' ? 'Fixed' : 'Flexible'}
                            </ThemedText>
                          </View>
                          <TextInput
                            value={String(Math.round(line.amount))}
                            keyboardType="numeric"
                            onChangeText={(value) =>
                              updateLineAmount(line.id, Number(value.replace(/[^0-9.]/g, '')) || 0)
                            }
                            style={[styles.amountInput, { borderColor: theme.border, color: theme.text }]}
                          />
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
              ? 'Fuel moved here stays moved — the flight plan is yours to balance.'
              : 'Tap a tank to see its lines. "Move fuel" shifts budget between tanks.'}
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
                <ThemedText type="small" style={{ color: theme.accent }}>
                  DESTINATION
                </ThemedText>
                <ThemedText type="section">First home fund</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {Math.round(goal.progress * 100)}% of the way there · arrival ~{goal.targetDateLabel}
                </ThemedText>
              </View>
              <Pill label={`${Math.round(goal.progress * 100)}%`} tone="info" />
            </View>
            <ProgressBar value={goal.progress} color={theme.accent} />
            <View style={styles.destinationStats}>
              <DestinationStat label="Saved" value={formatMoney(goal.currentSavings)} />
              <DestinationStat label="Cash needed" value={formatMoney(goal.cashNeeded)} />
              <DestinationStat label="Pace" value={`${formatMoney(goal.monthlySavingsPace)}/mo`} />
            </View>
          </Card>

          <Card style={styles.gap}>
            <View style={styles.paceHead}>
              <ThemedText type="smallBold">Savings pace</ThemedText>
              <Pill
                label={onPace ? 'Ahead of plan' : 'Behind plan'}
                tone={onPace ? 'good' : 'bad'}
              />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              Flying at {formatMoney(savings.pace)}/mo against a {formatMoney(savings.budgetedTarget)}/mo
              plan (6-mo average {formatMoney(savings.avg6)}).
            </ThemedText>
            <TrendBars
              data={savings.chart}
              averageWindow={0}
              height={132}
              formatValue={(value) => formatMoney(value)}
            />
          </Card>

          <SpeechBubble expression={onPace ? 'onTrack' : 'thinking'}>
            {onPace
              ? 'Pace looks good — the destination is getting closer every month.'
              : 'A small monthly boost would move the arrival date up. Worth a look at the fuel tanks.'}
          </SpeechBubble>
        </ScrollView>
      )}
    </Screen>
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
  gap: {
    gap: Spacing.two,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  moveCard: {
    gap: Spacing.two,
  },
  moveAmounts: {
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
  },
  lineCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
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
  paceHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
