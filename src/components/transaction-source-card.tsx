import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BankLinkButton } from '@/components/bank-link-button';
import { Card, PillButton } from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TransactionSourceCardProps = {
  compact?: boolean;
};

export function TransactionSourceCard({ compact = false }: TransactionSourceCardProps) {
  const router = useRouter();
  const theme = useTheme();
  const [status, setStatus] = useState(
    'Pick the setup that fits how much convenience or privacy you want.'
  );

  return (
    <Card style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <ThemedText type="smallBold">Bring in transactions</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {status}
          </ThemedText>
        </View>
      </View>

      <View style={styles.options}>
        <View style={[styles.option, { borderColor: theme.border }]}>
          <ThemedText type="smallBold" themeColor="primary">
            Convenience mode
          </ThemedText>
          <ThemedText type="subtitle">Connect your bank</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Penny syncs transactions automatically and sends unclear ones to review.
          </ThemedText>
          <BankLinkButton onStatusChange={setStatus} />
        </View>

        <View style={[styles.option, { borderColor: theme.border }]}>
          <ThemedText type="smallBold" themeColor="primary">
            Privacy mode
          </ThemedText>
          <ThemedText type="subtitle">Use a bank export</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Download a CSV or Excel file from your bank, then upload it without linking an
            account.
          </ThemedText>
          <PillButton
            onPress={() => {
              setStatus('Private import uses a CSV or Excel export from your bank, with no live account link.');
              if (compact) {
                router.push('/transactions');
              }
            }}>
            {compact ? 'Open review' : 'Use bank export'}
          </PillButton>
        </View>
      </View>

      {!compact ? (
        <View style={[styles.instructions, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold">How private import works</ThemedText>
          <View style={styles.stepList}>
            <Step index="1" label="Open your bank or credit card website." />
            <Step index="2" label="Find transactions, activity, or statements." />
            <Step index="3" label="Download CSV, XLS, or XLSX." />
            <Step index="4" label="Upload the file and review Penny's category guesses." />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

function Step({ index, label }: { index: string; label: string }) {
  const theme = useTheme();

  return (
    <View style={styles.step}>
      <View style={[styles.stepNumber, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold" themeColor="primary">
          {index}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.stepText}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  headingCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  options: {
    gap: Spacing.two,
  },
  option: {
    borderWidth: 1,
    borderRadius: 5,
    gap: Spacing.two,
    padding: Spacing.three,
  },
  instructions: {
    borderRadius: 5,
    gap: Spacing.two,
    padding: Spacing.three,
  },
  stepList: {
    gap: Spacing.two,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
  },
});
