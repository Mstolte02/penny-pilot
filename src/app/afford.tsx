import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import {
  Card,
  PANEL_BOTTOM_INSET,
  PennyBadge,
  PillButton,
  Screen,
  SpeechBubble,
} from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { affordVerdicts } from '@/constants/penny-voice';
import { mobileBudgetPlan, mobileTransactions } from '@/data/personal-finance-template';
import { formatMoney, safeToSpendToday } from '@/domain/mobile-finance';
import { useTheme } from '@/hooks/use-theme';

type Verdict = keyof typeof affordVerdicts;

export default function AffordScreen() {
  const theme = useTheme();
  const [amountText, setAmountText] = useState('');
  const [label, setLabel] = useState('');
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  const safe = useMemo(() => safeToSpendToday(mobileBudgetPlan, mobileTransactions), []);
  const amount = Number(amountText.replace(/[^0-9.]/g, '')) || 0;

  const runForecast = () => {
    if (amount <= 0) return;
    const remaining = Math.max(0, safe.remaining);
    if (amount > remaining) setVerdict('grounded');
    else if (amount > remaining * 0.5 || amount > safe.perDay * 7) setVerdict('caution');
    else setVerdict('clear');
  };

  const verdictColor =
    verdict === 'clear' ? theme.primary : verdict === 'caution' ? theme.warning : theme.danger;
  const verdictMascot =
    verdict === 'clear' ? 'happy' : verdict === 'caution' ? 'thinking' : 'concerned';
  const afterPerDay = (Math.max(0, safe.remaining) - amount) / safe.daysLeft;

  const reason =
    verdict === 'grounded'
      ? `You have ${formatMoney(Math.max(0, safe.remaining))} of flexible budget left this month — this is ${formatMoney(amount - Math.max(0, safe.remaining))} past it.`
      : verdict === 'caution'
        ? `It fits, but your daily number drops to ${formatMoney(Math.max(0, afterPerDay))} for the next ${safe.daysLeft} days.`
        : `Covered by flexible budget with ${formatMoney(Math.max(0, safe.remaining) - amount)} still in the tank.`;

  return (
    <Screen
      eyebrow="Forecast"
      title="Can I afford this?"
      subtitle="Penny checks it against bills, budget, and goals"
      mascot={<PennyBadge expression="thinking" />}>
      <ScrollView
        style={styles.panel}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <Card style={styles.inputCard}>
          <ThemedText type="small" themeColor="textSecondary">
            How much is it?
          </ThemedText>
          <View style={styles.amountRow}>
            <ThemedText type="hero" style={{ color: theme.primary, fontSize: 34, lineHeight: 40 }}>
              $
            </ThemedText>
            <TextInput
              value={amountText}
              onChangeText={(value) => {
                setAmountText(value);
                setVerdict(null);
              }}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
              style={[styles.amountInput, { color: theme.text }]}
            />
          </View>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="What is it? (optional)"
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.labelInput,
              { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
            ]}
          />
          <PillButton tone="primary" disabled={amount <= 0} onPress={runForecast}>
            Run the forecast
          </PillButton>
        </Card>

        {verdict ? (
          <Card style={[styles.verdictCard, { borderColor: verdictColor }]}>
            <View style={styles.verdictHead}>
              <View style={styles.verdictCopy}>
                <ThemedText type="section" style={{ color: verdictColor }}>
                  {affordVerdicts[verdict].title}
                </ThemedText>
                {label ? (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {label} · {formatMoney(amount)}
                  </ThemedText>
                ) : null}
              </View>
              <PennyBadge expression={verdictMascot} animated={false} size={56} />
            </View>
            <ThemedText type="small">{reason}</ThemedText>
            <SpeechBubble expression={verdictMascot}>{affordVerdicts[verdict].penny}</SpeechBubble>
          </Card>
        ) : (
          <View style={styles.contextRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Flexible budget left this month: {formatMoney(Math.max(0, safe.remaining))} ·{' '}
              {safe.daysLeft} {safe.daysLeft === 1 ? 'day' : 'days'} to go
            </ThemedText>
          </View>
        )}
      </ScrollView>
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
  inputCard: {
    gap: Spacing.three,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  amountInput: {
    flex: 1,
    fontSize: 44,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    paddingVertical: Spacing.one,
  },
  labelInput: {
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
  },
  verdictCard: {
    gap: Spacing.three,
    borderWidth: 2,
  },
  verdictHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  verdictCopy: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  contextRow: {
    alignItems: 'center',
  },
});
