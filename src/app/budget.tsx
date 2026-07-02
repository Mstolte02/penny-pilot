import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { RankedBars } from '@/components/mini-charts';
import {
  Card,
  PANEL_BOTTOM_INSET,
  PennyBadge,
  Screen,
  SectionTotalBar,
  Stat,
  StatRow,
} from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { colorForCategory, Spacing } from '@/constants/theme';
import { mobileBudgetPlan, mobileTransactions } from '@/data/personal-finance-template';
import { formatMoney, summarizeBudget } from '@/domain/mobile-finance';
import { useTheme } from '@/hooks/use-theme';

const SEGMENTS = [
  { label: 'Plan', value: 'plan' },
  { label: 'To-Do', value: 'todo' },
];

// 26 biweekly paychecks a year -> monthly amount per paycheck.
const PER_PAYCHECK = 12 / 26;
const perPaycheck = (monthly: number) => monthly * PER_PAYCHECK;

const CAR_RE = /transport|gas|auto|vehicle|mainten|fuel|registration|licen[cs]e|\bcar\b/i;
const LOAN_RE = /student\s*loan/i;

function defaultInJoint(sectionTitle: string, lineName: string) {
  if (LOAN_RE.test(lineName)) return true;
  if (sectionTitle === 'Essentials') return !CAR_RE.test(lineName);
  return false;
}

const lineKey = (section: string, name: string) => `${section}::${name}`;

type Candidate = {
  key: string;
  section: string;
  name: string;
  amount: number;
  isVariable: boolean;
};

export default function BudgetScreen() {
  const theme = useTheme();
  const [active, setActive] = useState('plan');
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const budget = useMemo(
    () => summarizeBudget(mobileBudgetPlan, mobileTransactions),
    []
  );

  const sectionBars = useMemo(
    () =>
      budget.sections
        .filter((section) => section.total > 0)
        .map((section) => ({
          label: section.title,
          value: section.total,
          color: colorForCategory(section.title),
        }))
        .sort((a, b) => b.value - a.value),
    [budget]
  );

  const candidates = useMemo<Candidate[]>(() => {
    const rows: Candidate[] = [];
    for (const section of budget.sections) {
      for (const line of section.lines) {
        rows.push({
          key: lineKey(section.title, line.name),
          section: section.title,
          name: line.name,
          amount: line.amount,
          isVariable: line.type === 'variable',
        });
      }
    }
    return rows;
  }, [budget]);

  const isIncluded = (candidate: Candidate) =>
    overrides[candidate.key] ?? defaultInJoint(candidate.section, candidate.name);
  const jointBase = candidates
    .filter((candidate) => isIncluded(candidate))
    .reduce((sum, candidate) => sum + candidate.amount, 0);
  const savingsContribution = Math.max(0, budget.monthlySavingsTarget);
  const overBudget = budget.monthlySavingsTarget < 0;

  const earners = mobileBudgetPlan.income.map((income) => {
    const pct = budget.monthlyIncome > 0 ? income.monthly / budget.monthlyIncome : 0;
    return {
      name: income.name,
      pct,
      joint: jointBase * pct,
      savings: savingsContribution * pct,
      total: (jointBase + savingsContribution) * pct,
    };
  });

  const toggle = (candidate: Candidate) =>
    setOverrides((current) => ({ ...current, [candidate.key]: !isIncluded(candidate) }));

  return (
    <Screen
      eyebrow="Budget"
      title="Budget"
      mascot={<PennyBadge expression={overBudget ? 'concerned' : 'happy'} />}
      segments={SEGMENTS}
      active={active}
      onSelect={setActive}>
      {active === 'plan' ? (
        <ScrollView style={styles.panel} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Card>
            <ThemedText type="smallBold">Monthly plan</ThemedText>
            <StatRow label="Income" value={formatMoney(budget.monthlyIncome)} divider={false} />
            <StatRow label="Planned expenses" value={formatMoney(budget.totalExpenses)} />
            <StatRow
              label="Net savings"
              value={formatMoney(budget.monthlySavingsTarget)}
              valueColor={overBudget ? theme.danger : theme.success}
            />
          </Card>

          <Card>
            <ThemedText type="smallBold">Where the plan goes</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Planned monthly total by category group.
            </ThemedText>
            <RankedBars data={sectionBars} valueLabel={(value) => formatMoney(value)} />
          </Card>
        </ScrollView>
      ) : (
        <ScrollView style={styles.panel} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.kpiGrid}>
            <Stat
              label="Joint / mo"
              value={formatMoney(jointBase)}
              delta="selected lines"
              style={styles.kpiTile}
            />
            <Stat
              label="Savings / mo"
              value={formatMoney(savingsContribution)}
              delta="after budget"
              trend={overBudget ? 'down' : 'up'}
              style={styles.kpiTile}
            />
          </View>

          {earners.map((earner) => (
            <Card key={earner.name}>
              <View style={styles.rowBetween}>
                <ThemedText type="smallBold" numberOfLines={1} style={styles.personName}>
                  {earner.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {(earner.pct * 100).toFixed(0)}%
                </ThemedText>
              </View>
              <StatRow
                label="Joint checking"
                sublabel={`${formatMoney(earner.joint)}/mo`}
                value={`${formatMoney(perPaycheck(earner.joint), 2)}/pay`}
              />
              <StatRow
                label="Savings"
                sublabel={`${formatMoney(earner.savings)}/mo`}
                value={`${formatMoney(perPaycheck(earner.savings), 2)}/pay`}
              />
              <View style={[styles.personFoot, { backgroundColor: theme.ink }]}>
                <ThemedText type="small" style={styles.footLabel} numberOfLines={1}>
                  Total to transfer
                </ThemedText>
                <ThemedText type="smallBold" style={styles.footValue} numberOfLines={1}>
                  {formatMoney(perPaycheck(earner.total), 2)}/pay
                </ThemedText>
              </View>
            </Card>
          ))}

          <Card>
            <ThemedText type="smallBold">What joint checking covers</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Tap a line to add or remove it from the transfer base.
            </ThemedText>
            {candidates.map((candidate) => {
              const included = isIncluded(candidate);
              return (
                <Pressable
                  key={candidate.key}
                  onPress={() => toggle(candidate)}
                  style={({ pressed }) => [
                    styles.coverRow,
                    { borderTopColor: theme.border, opacity: pressed ? 0.7 : 1 },
                  ]}>
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: included ? theme.primary : theme.border,
                        backgroundColor: included ? theme.primary : 'transparent',
                      },
                    ]}>
                    {included ? (
                      <ThemedText type="smallBold" style={styles.checkMark}>
                        ✓
                      </ThemedText>
                    ) : null}
                  </View>
                  <View style={styles.coverCopy}>
                    <ThemedText type="smallBold" numberOfLines={1} style={!included && styles.coverOff}>
                      {candidate.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {candidate.section}
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold" numberOfLines={1} style={!included && styles.coverOff}>
                    {formatMoney(candidate.amount)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </Card>

          <SectionTotalBar
            segments={[
              { label: 'Joint', value: formatMoney(jointBase) },
              { label: 'Savings', value: formatMoney(savingsContribution), accent: true },
              { label: 'Combined', value: formatMoney(jointBase + savingsContribution) },
            ]}
            operators={['+', '=']}
          />
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
  kpiGrid: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  kpiTile: {
    flex: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  personName: {
    flex: 1,
    fontSize: 16,
  },
  personFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderRadius: 8,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.one,
  },
  footLabel: {
    color: '#FFF8E8',
    opacity: 0.72,
    flexShrink: 1,
  },
  footValue: {
    color: '#FFFFFF',
    flexShrink: 0,
  },
  coverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#FFF8E8',
    fontSize: 12,
  },
  coverCopy: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  coverOff: {
    opacity: 0.4,
  },
});
