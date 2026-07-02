import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Card,
  PageHead,
  PennyBadge,
  SectionTotalBar,
  Stat,
} from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { mobileBudgetPlan, mobileTransactions } from '@/data/personal-finance-template';
import { formatMoney, summarizeBudget } from '@/domain/mobile-finance';
import { useTheme } from '@/hooks/use-theme';

// 26 biweekly paychecks a year -> monthly amount per paycheck.
const PER_PAYCHECK = 12 / 26;
const perPaycheck = (monthly: number) => monthly * PER_PAYCHECK;

// A line is a car / transport cost (paid from personal, not joint) if its name looks like one.
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

export default function TodoScreen() {
  const theme = useTheme();
  const budget = useMemo(
    () => summarizeBudget(mobileBudgetPlan, mobileTransactions),
    []
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

  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
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
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SafeAreaView style={styles.safeArea}>
          <PageHead
            eyebrow="To-Do"
            title="Transfer checklist"
            subtitle="Pick which budget lines belong in joint checking, then split the total by income share."
            mascot={<PennyBadge expression="onTrack" />}
          />

          <View style={styles.kpiGrid}>
            <Stat
              label="Joint checking / mo"
              value={formatMoney(jointBase)}
              delta="selected budget lines"
              trend="flat"
              style={styles.kpiTile}
            />
            <Stat
              label="Savings / mo"
              value={formatMoney(savingsContribution)}
              delta="leftover after budget"
              trend={overBudget ? 'down' : 'up'}
              style={styles.kpiTile}
            />
            <Stat
              label="Income split"
              value={earners.map((earner) => `${(earner.pct * 100).toFixed(0)}%`).join(' / ')}
              delta={earners.map((earner) => earner.name).join(' / ')}
              trend="flat"
              style={styles.kpiTile}
            />
          </View>

          {overBudget && (
            <Card style={StyleSheet.flatten([styles.warnCard, { borderColor: theme.danger }])}>
              <ThemedText type="smallBold" themeColor="danger">
                Over income by {formatMoney(-budget.monthlySavingsTarget)}/mo — nothing left to move
                to savings.
              </ThemedText>
            </Card>
          )}

          {earners.map((earner) => (
            <Card key={earner.name} style={styles.personCard}>
              <View style={styles.personHead}>
                <ThemedText type="smallBold" style={styles.personName}>
                  {earner.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {(earner.pct * 100).toFixed(1)}% of income
                </ThemedText>
              </View>
              <TransferRow color={theme.accent} label="Joint checking" monthly={earner.joint} />
              <TransferRow color={theme.primary} label="Savings" monthly={earner.savings} />
              <View style={[styles.personFoot, { backgroundColor: theme.ink }]}>
                <ThemedText type="small" style={styles.footLabel}>
                  Total to transfer
                </ThemedText>
                <ThemedText type="smallBold" style={styles.footValue}>
                  {formatMoney(perPaycheck(earner.total), 2)}/paycheck
                </ThemedText>
              </View>
            </Card>
          ))}

          <Card>
            <ThemedText type="smallBold">What joint checking covers</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Toggle any budget line to add or remove it from the transfer base.
            </ThemedText>
            {candidates.map((candidate) => {
              const included = isIncluded(candidate);
              return (
                <Pressable
                  key={candidate.key}
                  onPress={() => toggle(candidate)}
                  style={({ pressed }) => [styles.coverRow, { opacity: pressed ? 0.7 : 1 }]}>
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: included ? theme.primary : theme.border,
                        backgroundColor: included ? theme.primary : 'transparent',
                      },
                    ]}>
                    {included && (
                      <ThemedText type="smallBold" style={styles.checkMark}>
                        ✓
                      </ThemedText>
                    )}
                  </View>
                  <View style={styles.coverCopy}>
                    <ThemedText type="smallBold" style={!included && styles.coverOff}>
                      {candidate.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {candidate.section}
                      {candidate.isVariable ? ' · matched to actuals' : ''}
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold" style={!included && styles.coverOff}>
                    {formatMoney(candidate.amount)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </Card>

          <SectionTotalBar
            segments={[
              { label: 'Joint checking', value: formatMoney(jointBase) },
              { label: 'Savings', value: formatMoney(savingsContribution), accent: true },
              {
                label: 'Combined monthly',
                value: formatMoney(jointBase + savingsContribution),
              },
            ]}
            operators={['+', '=']}
          />
        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

function TransferRow({
  color,
  label,
  monthly,
}: {
  color: string;
  label: string;
  monthly: number;
}) {
  return (
    <View style={styles.transferRow}>
      <View style={styles.transferLabel}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <ThemedText type="small">{label}</ThemedText>
      </View>
      <View style={styles.transferAmounts}>
        <ThemedText type="smallBold">{formatMoney(perPaycheck(monthly), 2)}/paycheck</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatMoney(monthly)}/mo
        </ThemedText>
      </View>
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
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  kpiTile: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 140,
  },
  warnCard: {
    gap: Spacing.one,
  },
  personCard: {
    gap: Spacing.two,
  },
  personHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  personName: {
    fontSize: 18,
    lineHeight: 22,
  },
  transferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
    borderTopWidth: 1,
    borderTopColor: '#F1E7D3',
  },
  transferLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  transferAmounts: {
    alignItems: 'flex-end',
    gap: Spacing.half,
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
  },
  footValue: {
    color: '#FFFFFF',
  },
  coverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: '#F1E7D3',
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
    gap: Spacing.half,
  },
  coverOff: {
    opacity: 0.4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
