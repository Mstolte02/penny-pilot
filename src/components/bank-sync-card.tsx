import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BankLinkButton } from '@/components/bank-link-button';
import { Card, PennyBadge } from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export function BankSyncCard() {
  const [status, setStatus] = useState(
    'Connect a checking, savings, or credit account when you are ready to pull transactions.'
  );

  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.copy}>
          <ThemedText type="smallBold">Bank sync</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {status}
          </ThemedText>
        </View>
        <PennyBadge expression="onTrack" animated={false} />
      </View>
      <BankLinkButton onStatusChange={setStatus} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  copy: {
    flex: 1,
    gap: Spacing.half,
  },
});
