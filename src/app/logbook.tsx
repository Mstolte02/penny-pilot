import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { RankedBars, TrendBars } from '@/components/mini-charts';
import {
  Card,
  MonthTicker,
  PANEL_BOTTOM_INSET,
  PennyBadge,
  Screen,
  SpeechBubble,
  Stat,
  ToggleChip,
} from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { colorForCategory, Spacing } from '@/constants/theme';
import { mobileBudgetPlan, mobileSavingsConfig, mobileTransactions } from '@/data/personal-finance-template';
import {
  actualMonthlyNet,
  formatMoney,
  formatMonth,
  monthlyIncome,
  monthlySpend,
  summarizeBudget,
  uniqueMonths,
} from '@/domain/mobile-finance';

const SEGMENTS = [
  { label: 'Flight report', value: 'report' },
  { label: 'Net worth', value: 'networth' },
];

const WEEKLY_OPTIONS = [25, 50, 100];
const EDUCATION_YEARS = 10;
const EDUCATION_RETURN = 0.07;

function shortMonth(month: string) {
  return formatMonth(month).replace(/ \d{2}(\d{2})$/, " '$1");
}

/** Future value of a steady weekly contribution, compounded monthly. */
function educationCurve(weekly: number) {
  const monthlyContribution = (weekly * 52) / 12;
  const monthlyRate = EDUCATION_RETURN / 12;
  const points: { label: string; value: number }[] = [];
  let balance = 0;

  for (let month = 1; month <= EDUCATION_YEARS * 12; month += 1) {
    balance = balance * (1 + monthlyRate) + monthlyContribution;
    if (month % 24 === 0) {
      points.push({ label: `Yr ${month / 12}`, value: Math.round(balance) });
    }
  }

  return points;
}

export default function LogbookScreen() {
  const [active, setActive] = useState('report');
  const [weekly, setWeekly] = useState(100);

  const base = useMemo(() => {
    const months = uniqueMonths(mobileTransactions);
    const spends = monthlySpend(mobileTransactions);
    const income = monthlyIncome(mobileTransactions);
    const net = actualMonthlyNet(mobileTransactions);
    const budget = summarizeBudget(mobileBudgetPlan, mobileTransactions);
    return { months, spends, income, net, budget };
  }, []);

  const [month, setMonth] = useState(() => base.months[base.months.length - 1] ?? '');

  const report = useMemo(() => {
    const spendRow = base.spends.find((row) => row.month === month);
    const spendM = spendRow?.total ?? 0;
    const categories = Object.entries(spendRow?.byCategory ?? {})
      .map(([category, value]) => ({ label: category, value, color: colorForCategory(category) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    const series = base.months.slice(-12).map((m) => ({
      label: shortMonth(m),
      value: base.spends.find((row) => row.month === m)?.total ?? 0,
    }));

    return {
      incomeM: base.income[month] ?? 0,
      spendM,
      netM: base.net[month] ?? 0,
      weeklyTypical: spendM / 4.33,
      categories,
      series,
    };
  }, [base, month]);

  const netWorth = useMemo(() => {
    // Anchor the trendline to the real savings balance at its as-of month, then
    // walk monthly net backward and forward from there.
    const anchorMonth = mobileSavingsConfig.asOfDate.slice(0, 7);
    const months = base.months;
    const anchorIndex = Math.max(0, months.indexOf(anchorMonth));
    const balances = new Array<number>(months.length).fill(0);
    balances[anchorIndex] = mobileSavingsConfig.currentSavings;
    for (let index = anchorIndex + 1; index < months.length; index += 1) {
      balances[index] = balances[index - 1] + (base.net[months[index]] ?? 0);
    }
    for (let index = anchorIndex - 1; index >= 0; index -= 1) {
      balances[index] = balances[index + 1] - (base.net[months[index + 1]] ?? 0);
    }
    const window = months.slice(-12);
    const offset = months.length - window.length;
    return window.map((m, index) => ({
      label: shortMonth(m),
      value: Math.round(balances[offset + index]),
    }));
  }, [base]);

  const education = useMemo(() => educationCurve(weekly), [weekly]);
  const educationFinal = education[education.length - 1]?.value ?? 0;
  const netUp = report.netM >= 0;

  return (
    <Screen
      eyebrow="Logbook"
      title="Logbook"
      subtitle="Every flight, on the record"
      mascot={<PennyBadge expression={netUp ? 'onTrack' : 'thinking'} />}
      segments={SEGMENTS}
      active={active}
      onSelect={setActive}>
      {active === 'report' ? (
        <ScrollView
          style={styles.panel}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}>
          <View style={styles.tickerRow}>
            <MonthTicker months={base.months} value={month} onChange={setMonth} formatLabel={shortMonth} />
          </View>

          <View style={styles.kpiRow}>
            <Stat label="Money in" value={formatMoney(report.incomeM)} style={styles.kpiTile} />
            <Stat label="Money out" value={formatMoney(report.spendM)} style={styles.kpiTile} />
            <Stat
              label="Net"
              value={formatMoney(report.netM)}
              trend={netUp ? 'up' : 'down'}
              delta={netUp ? 'banked' : 'drawn down'}
              style={styles.kpiTile}
            />
          </View>

          <Card>
            <ThemedText type="smallBold">Spending altitude · last 12 months</ThemedText>
            <TrendBars
              data={report.series}
              height={140}
              formatValue={(value) => formatMoney(value)}
              targetValue={base.budget.totalExpenses}
              targetLabel="Plan"
            />
            <ThemedText type="small" themeColor="textSecondary">
              A typical week in {shortMonth(month)} ran about {formatMoney(report.weeklyTypical)}.
            </ThemedText>
          </Card>

          <Card>
            <ThemedText type="smallBold">Where it went · {shortMonth(month)}</ThemedText>
            <RankedBars data={report.categories} valueLabel={(value) => formatMoney(value)} />
          </Card>

          <SpeechBubble expression={netUp ? 'happy' : 'thinking'}>
            {netUp
              ? `${shortMonth(month)} landed ${formatMoney(report.netM)} in the black. Logged.`
              : `${shortMonth(month)} drew down ${formatMoney(Math.abs(report.netM))}. Some months do — the log keeps it honest.`}
          </SpeechBubble>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.panel}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}>
          <Card>
            <ThemedText type="smallBold">Net worth trendline</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Savings balance, anchored to your real numbers and walked by monthly net.
            </ThemedText>
            <TrendBars
              data={netWorth}
              height={140}
              averageWindow={0}
              formatValue={(value) => formatMoney(value)}
            />
          </Card>

          <Card style={styles.educationCard}>
            <ThemedText type="smallBold">The compounding curve</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatMoney(weekly)}/week at {Math.round(EDUCATION_RETURN * 100)}% ≈{' '}
              {formatMoney(educationFinal)} in {EDUCATION_YEARS} years.
            </ThemedText>
            <View style={styles.weeklyChips}>
              {WEEKLY_OPTIONS.map((option) => (
                <ToggleChip
                  key={option}
                  label={`${formatMoney(option)}/wk`}
                  selected={weekly === option}
                  onPress={() => setWeekly(option)}
                />
              ))}
            </View>
            <TrendBars
              data={education}
              height={132}
              averageWindow={0}
              formatValue={(value) => formatMoney(value)}
            />
          </Card>

          <SpeechBubble expression="default">
            Time in the air beats speed. The curve bends hardest in the later years — starting is
            the whole trick.
          </SpeechBubble>
        </ScrollView>
      )}
    </Screen>
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
  tickerRow: {
    alignItems: 'center',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  kpiTile: {
    flex: 1,
  },
  educationCard: {
    gap: Spacing.two,
  },
  weeklyChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
