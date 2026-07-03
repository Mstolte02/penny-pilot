import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { LineChart, TrendBars } from '@/components/mini-charts';
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
import { chartPalette, colorForCategory, Spacing } from '@/constants/theme';
import { mobileBudgetPlan, mobileSavingsConfig, mobileTransactions } from '@/data/personal-finance-template';
import {
  actualMonthlyNet,
  formatMoney,
  formatMonth,
  monthKey,
  monthlyIncome,
  monthlySpend,
  summarizeBudget,
  uniqueMonths,
} from '@/domain/mobile-finance';
import { useTheme } from '@/hooks/use-theme';

const SEGMENTS = [
  { label: 'Monthly report', value: 'report' },
  { label: 'Net worth', value: 'networth' },
];

const WEEKLY_OPTIONS = [25, 50, 100];
const EDUCATION_YEARS = 10;
const EDUCATION_RETURN = 0.07;

function shortMonth(month: string) {
  return formatMonth(month).replace(/ \d{2}(\d{2})$/, " '$1");
}

function dayOfMonthLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Future value of a steady weekly contribution, compounded monthly. */
function educationCurve(weekly: number) {
  const monthlyContribution = (weekly * 52) / 12;
  const monthlyRate = EDUCATION_RETURN / 12;
  const points: { label: string; value: number }[] = [];
  let balance = 0;

  for (let month = 1; month <= EDUCATION_YEARS * 12; month += 1) {
    balance = balance * (1 + monthlyRate) + monthlyContribution;
    if (month % 12 === 0) {
      points.push({ label: `Yr ${month / 12}`, value: Math.round(balance) });
    }
  }

  return points;
}

type DrillTransaction = { id: string; item: string; date: string; amount: number };
type DrillSub = { name: string; value: number; transactions: DrillTransaction[] };
type DrillCategory = { name: string; value: number; share: number; color: string; subs: DrillSub[] };

export default function LogbookScreen() {
  const theme = useTheme();
  const [active, setActive] = useState('report');
  const [weekly, setWeekly] = useState(100);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);

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
    const monthExpenses = mobileTransactions.filter(
      (transaction) => transaction.type === 'expense' && monthKey(transaction.date) === month
    );
    const spendM = monthExpenses.reduce((sum, transaction) => sum + transaction.moneyOut, 0);

    const byCategory = new Map<string, Map<string, DrillTransaction[]>>();
    for (const transaction of monthExpenses) {
      const subs = byCategory.get(transaction.category) ?? new Map<string, DrillTransaction[]>();
      const subName = transaction.subcategory ?? 'Uncategorized';
      const list = subs.get(subName) ?? [];
      list.push({
        id: transaction.id,
        item: transaction.item,
        date: transaction.date,
        amount: transaction.moneyOut,
      });
      subs.set(subName, list);
      byCategory.set(transaction.category, subs);
    }

    const categories: DrillCategory[] = Array.from(byCategory.entries())
      .map(([name, subsMap]) => {
        const subs: DrillSub[] = Array.from(subsMap.entries())
          .map(([subName, transactions]) => ({
            name: subName,
            value: transactions.reduce((sum, transaction) => sum + transaction.amount, 0),
            transactions: [...transactions].sort((a, b) => b.amount - a.amount),
          }))
          .sort((a, b) => b.value - a.value);
        const value = subs.reduce((sum, sub) => sum + sub.value, 0);
        return {
          name,
          value,
          share: spendM > 0 ? value / spendM : 0,
          color: colorForCategory(name),
          subs,
        };
      })
      .sort((a, b) => b.value - a.value);

    const series = base.months.slice(-12).map((m) => ({
      label: shortMonth(m),
      value: base.spends.find((row) => row.month === m)?.total ?? 0,
    }));

    return {
      incomeM: base.income[month] ?? 0,
      spendM,
      netM: base.net[month] ?? 0,
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
    const points = window.map((m, index) => ({
      label: shortMonth(m),
      value: Math.round(balances[offset + index]),
    }));
    const current = points[points.length - 1]?.value ?? 0;
    const yearAgo = points[0]?.value ?? 0;

    return { points, current, change: current - yearAgo };
  }, [base]);

  const education = useMemo(() => educationCurve(weekly), [weekly]);
  const educationFinal = education[education.length - 1]?.value ?? 0;
  const netUp = report.netM >= 0;

  return (
    <Screen
      eyebrow="Logbook"
      title="Logbook"
      subtitle="Reports, history, and the long game"
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
              delta={netUp ? 'saved' : 'drawn down'}
              style={styles.kpiTile}
            />
          </View>

          <Card>
            <ThemedText type="smallBold">Spending trend · last 12 months</ThemedText>
            <TrendBars
              data={report.series}
              height={140}
              formatValue={(value) => formatMoney(value)}
              targetValue={base.budget.totalExpenses}
              targetLabel="Plan"
            />
          </Card>

          <Card style={styles.drillCard}>
            <ThemedText type="smallBold">Where it went · {shortMonth(month)}</ThemedText>

            <View style={styles.compositionBar}>
              {report.categories.map((category) => (
                <View
                  key={category.name}
                  style={{
                    flex: Math.max(category.share, 0.02),
                    backgroundColor: category.color,
                  }}
                />
              ))}
            </View>

            {report.categories.map((category) => {
              const open = openCategory === category.name;
              return (
                <View key={category.name}>
                  <Pressable
                    onPress={() => {
                      setOpenCategory(open ? null : category.name);
                      setOpenSub(null);
                    }}
                    style={({ pressed }) => [styles.drillRow, { opacity: pressed ? 0.7 : 1 }]}>
                    <View style={[styles.drillDot, { backgroundColor: category.color }]} />
                    <ThemedText type="smallBold" numberOfLines={1} style={styles.drillName}>
                      {category.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.drillShare}>
                      {Math.round(category.share * 100)}%
                    </ThemedText>
                    <ThemedText type="money">{formatMoney(category.value)}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.drillChevron}>
                      {open ? '▾' : '▸'}
                    </ThemedText>
                  </Pressable>

                  {open
                    ? category.subs.map((sub) => {
                        const subKey = `${category.name}::${sub.name}`;
                        const subOpen = openSub === subKey;
                        return (
                          <View key={subKey}>
                            <Pressable
                              onPress={() => setOpenSub(subOpen ? null : subKey)}
                              style={({ pressed }) => [
                                styles.drillSubRow,
                                { opacity: pressed ? 0.7 : 1 },
                              ]}>
                              <View
                                style={[
                                  styles.drillDotSmall,
                                  { backgroundColor: category.color, opacity: 0.55 },
                                ]}
                              />
                              <ThemedText type="small" numberOfLines={1} style={styles.drillName}>
                                {sub.name}
                              </ThemedText>
                              <ThemedText type="money" style={styles.drillSubValue}>
                                {formatMoney(sub.value)}
                              </ThemedText>
                              <ThemedText
                                type="small"
                                themeColor="textSecondary"
                                style={styles.drillChevron}>
                                {subOpen ? '▾' : '▸'}
                              </ThemedText>
                            </Pressable>
                            {subOpen
                              ? sub.transactions.map((transaction) => (
                                  <View key={transaction.id} style={styles.drillTxnRow}>
                                    <ThemedText
                                      type="small"
                                      themeColor="textSecondary"
                                      numberOfLines={1}
                                      style={styles.drillName}>
                                      {transaction.item} · {dayOfMonthLabel(transaction.date)}
                                    </ThemedText>
                                    <ThemedText type="small" style={styles.txnAmount}>
                                      {formatMoney(transaction.amount)}
                                    </ThemedText>
                                  </View>
                                ))
                              : null}
                          </View>
                        );
                      })
                    : null}
                </View>
              );
            })}
            <ThemedText type="small" themeColor="textSecondary">
              Tap a category for subcategories, tap again for the transactions behind it.
            </ThemedText>
          </Card>

          <SpeechBubble expression={netUp ? 'happy' : 'thinking'}>
            {netUp
              ? `${shortMonth(month)} ended ${formatMoney(report.netM)} in the black. Logged.`
              : `${shortMonth(month)} drew down ${formatMoney(Math.abs(report.netM))}. Some months do — the log keeps it honest.`}
          </SpeechBubble>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.panel}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}>
          <View style={styles.kpiRow}>
            <Stat label="Balance now" value={formatMoney(netWorth.current)} style={styles.kpiTile} />
            <Stat
              label="12-mo change"
              value={`${netWorth.change >= 0 ? '+' : '−'}${formatMoney(Math.abs(netWorth.change))}`}
              trend={netWorth.change >= 0 ? 'up' : 'down'}
              style={styles.kpiTile}
            />
          </View>

          <Card style={styles.chartCard}>
            <ThemedText type="smallBold">Net worth · last 12 months</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Savings balance anchored to your real numbers, walked by monthly net.
            </ThemedText>
            <LineChart
              height={170}
              series={[{ points: netWorth.points, color: chartPalette.steelBlue, area: true }]}
              legend={[{ label: 'Savings balance', color: chartPalette.steelBlue }]}
            />
          </Card>

          <Card style={styles.chartCard}>
            <ThemedText type="smallBold">The compounding curve</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatMoney(weekly)}/week invested at a {Math.round(EDUCATION_RETURN * 100)}% average
              annual return ≈ {formatMoney(educationFinal)} after {EDUCATION_YEARS} years.
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
            <LineChart
              height={150}
              series={[{ points: education, color: theme.primary, area: true }]}
            />
          </Card>

          <SpeechBubble expression="default">
            Where does 7% come from? It&apos;s the long-run average of a broad stock index fund —
            for money you won&apos;t touch for 5+ years. Short-term money like your emergency and
            home funds belongs in a high-yield savings account instead: around{' '}
            {(mobileSavingsConfig.savingsApy * 100).toFixed(1)}% APY right now, with no market
            swings. Markets go down some years — time in, not timing, is what earns the average.
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
  drillCard: {
    gap: Spacing.two,
  },
  compositionBar: {
    flexDirection: 'row',
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    gap: 2,
  },
  drillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one + 2,
  },
  drillDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  drillDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  drillName: {
    flex: 1,
    minWidth: 0,
  },
  drillShare: {
    width: 38,
    textAlign: 'right',
  },
  drillChevron: {
    width: 14,
    textAlign: 'center',
  },
  drillSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
    paddingLeft: Spacing.four,
  },
  drillSubValue: {
    fontSize: 13,
  },
  drillTxnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 3,
    paddingLeft: Spacing.five + Spacing.two,
  },
  txnAmount: {
    fontVariant: ['tabular-nums'],
  },
  chartCard: {
    gap: Spacing.two,
  },
  weeklyChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
