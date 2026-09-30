import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CategoryTrendChart,
  CategoryTrendPager,
  ChartLegend,
  compactMoney,
  type CategoryTrend,
} from '@/components/category-trend-grid';
import { ChartValueTable, ExpandableChart } from '@/components/chart-expander';
import { LineChart } from '@/components/mini-charts';
import { FadeInUp } from '@/components/penny-motion';
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
import { mobileSavingsConfig } from '@/data/personal-finance-template';
import {
  actualMonthlyNet,
  formatMoney,
  formatMonth,
  monthKey,
  monthlyIncome,
  monthlySpend,
  uniqueMonths,
} from '@/domain/mobile-finance';
import { useTheme } from '@/hooks/use-theme';
import { useFinance } from '@/services/finance-store';

const SEGMENTS = [
  { label: 'Monthly report', value: 'report' },
  { label: 'Net worth', value: 'networth' },
];

const WEEKLY_OPTIONS = [25, 50, 100];
/** Months shown in every category small-multiple — uniform so cards compare cleanly. */
const CATEGORY_WINDOW = 8;
const EDUCATION_YEARS = 10;
const EDUCATION_RETURN = 0.07;

function shortMonth(month: string) {
  return formatMonth(month).replace(/ \d{2}(\d{2})$/, " '$1");
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Loose name match for plan-section ↔ transaction-category drift ("Food and dining" ↔ "Food"). Never matches on empty strings. */
function namesMatchLoosely(a: string, b: string) {
  return a === b || (a.length > 0 && b.length > 0 && (a.includes(b) || b.includes(a)));
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
  const { transactions, planLines } = useFinance();
  const [active, setActive] = useState('report');
  const [weekly, setWeekly] = useState(100);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);

  const base = useMemo(() => {
    const months = uniqueMonths(transactions);
    const spends = monthlySpend(transactions);
    const income = monthlyIncome(transactions);
    const net = actualMonthlyNet(transactions);
    return { months, spends, income, net };
  }, [transactions]);

  // Budget targets come straight from the plan-line amounts the user sets in
  // the Plan tab. summarizeBudget is deliberately NOT used here: it re-forecasts
  // flexible lines from matched actuals (ignoring the configured amount), which
  // makes every budget line shadow recent averages instead of the actual plan.
  const planTargets = useMemo(() => {
    const bySection = new Map<string, number>();
    let total = 0;
    for (const line of planLines) {
      bySection.set(line.section, (bySection.get(line.section) ?? 0) + line.amount);
      total += line.amount;
    }
    return { bySection, total };
  }, [planLines]);

  const [month, setMonth] = useState(() => base.months[base.months.length - 1] ?? '');

  const report = useMemo(() => {
    const monthExpenses = transactions.filter(
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
  }, [base, month, transactions]);

  // Total-spend trend in the same visual language as the category cards: heat
  // bars plus a trailing 3-month average, with the plan total as the target.
  const spendTrend = useMemo(() => {
    const values = report.series.map((point) => point.value);
    const avg = values.map((_, index) => {
      const slice = values.slice(Math.max(0, index - 2), index + 1);
      if (slice.every((value) => value === 0)) return null;
      return slice.reduce((sum, value) => sum + value, 0) / slice.length;
    });
    const dataMax = Math.max(
      ...values,
      ...avg.filter((value): value is number => value !== null),
      1
    );
    const target = planTargets.total;
    return { points: report.series, avg, target, showTarget: target > 0 && target <= dataMax * 1.3 };
  }, [report.series, planTargets.total]);

  // One small-multiple per category over a shared month window: monthly totals,
  // a trailing 3-month average (missing months count as $0 so the line decays
  // honestly), and the plan section's total as the budget target when one matches.
  const categoryTrends = useMemo<CategoryTrend[]>(() => {
    const window = base.months.slice(-CATEGORY_WINDOW);
    if (window.length === 0) return [];
    const indexByMonth = new Map(window.map((m, index) => [m, index]));
    const sums = new Map<string, number[]>();
    for (const transaction of transactions) {
      if (transaction.type !== 'expense') continue;
      const index = indexByMonth.get(monthKey(transaction.date));
      if (index === undefined) continue;
      const row = sums.get(transaction.category) ?? new Array<number>(window.length).fill(0);
      row[index] += transaction.moneyOut;
      sums.set(transaction.category, row);
    }
    const labels = window.map(shortMonth);
    return Array.from(sums.entries())
      .map(([name, values]) => ({
        name,
        points: values.map((value, index) => ({ label: labels[index], value })),
        avg: values.map((_, index) => {
          const slice = values.slice(Math.max(0, index - 2), index + 1);
          if (slice.every((value) => value === 0)) return null;
          return slice.reduce((sum, value) => sum + value, 0) / slice.length;
        }),
        target: targetForCategory(name),
        total: values.reduce((sum, value) => sum + value, 0),
      }))
      .sort((a, b) => b.total - a.total);

    function targetForCategory(name: string) {
      const exact = planTargets.bySection.get(name);
      if (exact !== undefined) return exact;
      const key = normalizeName(name);
      for (const [section, total] of planTargets.bySection) {
        if (namesMatchLoosely(normalizeName(section), key)) return total;
      }
      return undefined;
    }
  }, [base, transactions, planTargets]);

  const drillTrend = openCategory
    ? (categoryTrends.find((trend) => trend.name === openCategory) ?? null)
    : null;
  const drillDetail = openCategory
    ? (report.categories.find((category) => category.name === openCategory) ?? null)
    : null;

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

  // Full amounts, never abbreviated: size the row off its longest value so all
  // three tiles match and nothing clips.
  const kpiValues = [
    formatMoney(report.incomeM),
    formatMoney(report.spendM),
    formatMoney(report.netM),
  ];
  const kpiLongest = Math.max(...kpiValues.map((value) => value.length));
  const kpiSize = kpiLongest <= 6 ? 18 : kpiLongest <= 8 ? 15.5 : 13.5;

  return (
    <Screen
      eyebrow="Logbook"
      title="Logbook"
      subtitle="Monthly reports and net worth"
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
            <Stat
              label="In"
              value={kpiValues[0]}
              centered
              valueSize={kpiSize}
              style={styles.kpiTile}
            />
            <Stat
              label="Out"
              value={kpiValues[1]}
              centered
              valueSize={kpiSize}
              style={styles.kpiTile}
            />
            <Stat
              label="Net"
              value={kpiValues[2]}
              trend={netUp ? 'up' : 'down'}
              centered
              valueSize={kpiSize}
              style={styles.kpiTile}
            />
          </View>

          <FadeInUp delay={60}>
            <Card>
              <ThemedText type="smallBold">Spending trend · last 12 months</ThemedText>
              <ExpandableChart
                title="Spending trend"
                subtitle="Monthly spending vs your plan"
                renderExpanded={() => (
                  <>
                    <CategoryTrendChart
                      points={spendTrend.points}
                      avg={spendTrend.avg}
                      target={spendTrend.target}
                      height={300}
                    />
                    <ChartLegend showTarget={spendTrend.showTarget} />
                    <ChartValueTable
                      columns={['Month', 'Spent', 'vs plan']}
                      highlightLast
                      rows={report.series.map((point) => [
                        point.label,
                        formatMoney(point.value),
                        `${point.value <= planTargets.total ? '−' : '+'}${formatMoney(
                          Math.abs(point.value - planTargets.total)
                        )}`,
                      ])}
                    />
                  </>
                )}>
                <CategoryTrendChart
                  points={spendTrend.points}
                  avg={spendTrend.avg}
                  target={spendTrend.target}
                  height={150}
                />
                <ChartLegend showTarget={spendTrend.showTarget} />
              </ExpandableChart>
            </Card>
          </FadeInUp>

          <FadeInUp delay={130} style={styles.categorySection}>
            <View style={styles.sectionHead}>
              <ThemedText type="smallBold">Spending by category</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Bars = actual · Blue dots = 3-mo avg · Gold dashes = budget target
              </ThemedText>
            </View>
            <CategoryTrendPager
              categories={categoryTrends}
              formatValue={compactMoney}
              onPressCategory={(name) => {
                setOpenCategory(name);
                setOpenSub(null);
              }}
            />
          </FadeInUp>

          <Modal
            visible={openCategory !== null}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setOpenCategory(null)}>
            <View style={[styles.drillSheet, { backgroundColor: theme.background }]}>
              <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.drillSheetSafe}>
                <View style={styles.drillSheetHead}>
                  <View style={styles.drillSheetCopy}>
                    <ThemedText type="section">{openCategory}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Monthly spend and 3-mo average
                      {drillTrend?.target ? ` · budget ${formatMoney(drillTrend.target)}/mo` : ''}
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => setOpenCategory(null)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Close category details"
                    style={[
                      styles.drillClose,
                      { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                    ]}>
                    <Ionicons name="close" size={20} color={theme.text} />
                  </Pressable>
                </View>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.drillSheetBody}>
                  {drillTrend ? (
                    <>
                      <CategoryTrendChart
                        points={drillTrend.points}
                        avg={drillTrend.avg}
                        target={drillTrend.target}
                        height={240}
                      />
                      <ChartValueTable
                        columns={['Month', 'Spent', '3-mo avg']}
                        highlightLast
                        rows={drillTrend.points.map((point, index) => {
                          const avgValue = drillTrend.avg[index];
                          return [
                            point.label,
                            formatMoney(point.value),
                            avgValue === null ? '—' : formatMoney(avgValue),
                          ];
                        })}
                      />
                    </>
                  ) : null}

                  <ThemedText type="smallBold">
                    Where {shortMonth(month)}&apos;s spending went
                  </ThemedText>
                  {drillDetail ? (
                    drillDetail.subs.map((sub) => {
                      const subKey = `${drillDetail.name}::${sub.name}`;
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
                                { backgroundColor: drillDetail.color, opacity: 0.55 },
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
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      No {openCategory} spending in {shortMonth(month)}.
                    </ThemedText>
                  )}
                  {drillDetail ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      Tap a subcategory to see its transactions.
                    </ThemedText>
                  ) : null}
                </ScrollView>
              </SafeAreaView>
            </View>
          </Modal>

          <SpeechBubble expression={netUp ? 'happy' : 'thinking'}>
            {netUp
              ? `${shortMonth(month)} ended ${formatMoney(report.netM)} in the black. Nice flying.`
              : `${shortMonth(month)} drew down ${formatMoney(Math.abs(report.netM))}. Some months do, and that's okay.`}
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

          <FadeInUp delay={60}>
            <Card style={styles.chartCard}>
              <ThemedText type="smallBold">Net worth · last 12 months</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Starts from your real savings balance and moves by each month&apos;s net.
              </ThemedText>
              <ExpandableChart
                title="Net worth"
                subtitle="Savings balance, month by month"
                renderExpanded={() => (
                  <>
                    <LineChart
                      height={320}
                      series={[{ points: netWorth.points, color: chartPalette.steelBlue, area: true }]}
                      legend={[{ label: 'Savings balance', color: chartPalette.steelBlue }]}
                    />
                    <ChartValueTable
                      columns={['Month', 'Balance', 'Change']}
                      highlightLast
                      rows={netWorth.points.map((point, index) => {
                        const previous = netWorth.points[index - 1]?.value ?? point.value;
                        const change = point.value - previous;
                        return [
                          point.label,
                          formatMoney(point.value),
                          `${change >= 0 ? '+' : '−'}${formatMoney(Math.abs(change))}`,
                        ];
                      })}
                    />
                  </>
                )}>
                <LineChart
                  height={170}
                  series={[{ points: netWorth.points, color: chartPalette.steelBlue, area: true }]}
                  legend={[{ label: 'Savings balance', color: chartPalette.steelBlue }]}
                />
              </ExpandableChart>
            </Card>
          </FadeInUp>

          <FadeInUp delay={130}>
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
              <ExpandableChart
                title="The compounding curve"
                subtitle={`${formatMoney(weekly)}/week at ${Math.round(EDUCATION_RETURN * 100)}% average annual return`}
                renderExpanded={() => (
                  <>
                    <LineChart
                      height={320}
                      series={[{ points: education, color: theme.primary, area: true }]}
                    />
                    <ChartValueTable
                      columns={['Year', 'Balance', 'Contributed']}
                      highlightLast
                      rows={education.map((point, index) => [
                        point.label,
                        formatMoney(point.value),
                        formatMoney(weekly * 52 * (index + 1)),
                      ])}
                    />
                  </>
                )}>
                <LineChart
                  height={150}
                  series={[{ points: education, color: theme.primary, area: true }]}
                />
              </ExpandableChart>
            </Card>
          </FadeInUp>

          <SpeechBubble expression="default">
            Why 7%? It&apos;s the long-run average of a broad stock index fund, for money you
            won&apos;t touch for 5+ years. Keep short-term money, like your emergency and home
            funds, in a high-yield savings account: around{' '}
            {(mobileSavingsConfig.savingsApy * 100).toFixed(1)}% APY right now, with no market
            swings. Markets drop some years. Staying invested is what earns the average.
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
  categorySection: {
    gap: Spacing.two,
  },
  sectionHead: {
    gap: Spacing.half,
  },
  drillSheet: {
    flex: 1,
  },
  drillSheetSafe: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  drillSheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  drillSheetCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  drillClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drillSheetBody: {
    gap: Spacing.three,
    paddingBottom: Spacing.six,
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
  drillChevron: {
    width: 14,
    textAlign: 'center',
  },
  drillSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one + 2,
  },
  drillSubValue: {
    fontSize: 13,
  },
  drillTxnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 3,
    paddingLeft: Spacing.four,
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
