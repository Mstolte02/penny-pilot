import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BankLinkButton } from '@/components/bank-link-button';
import { PanelHead } from '@/components/flight-deck';
import { Card, Pill, PillButton } from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useFinance } from '@/services/finance-store';

function timeAgo(iso: string | null) {
  if (!iso) return null;
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** Connected banks: connect another, sync now, and what the last sync brought in. */
export function BankSyncCard() {
  const { transactions, bankSync, refreshBank } = useFinance();
  const [linkStatus, setLinkStatus] = useState<string | null>(null);

  const stats = useMemo(() => {
    const bank = transactions.filter((transaction) => transaction.source === 'bank');
    const spending = bank.filter((transaction) => transaction.type === 'expense');
    return {
      total: bank.length,
      auto: spending.filter(
        (transaction) => transaction.category !== 'Uncategorized' && transaction.categorySource !== 'user'
      ).length,
      toReview: spending.filter((transaction) => transaction.category === 'Uncategorized').length,
      transfers: bank.filter((transaction) => transaction.type === 'transfer').length,
    };
  }, [transactions]);

  const syncing = bankSync.status === 'syncing';
  const statusLine =
    linkStatus ??
    (bankSync.status === 'signed-out'
      ? 'Sign in under Settings to sync your banks.'
      : bankSync.status === 'error'
        ? bankSync.message ?? 'The last sync did not finish.'
        : syncing
          ? 'Syncing with your bank…'
          : stats.total > 0
            ? `Last synced ${timeAgo(bankSync.lastSyncedAt) ?? 'recently'}. New transactions sync when you open Penny.`
            : 'Connect checking, savings, or a credit card and transactions sort themselves.');

  return (
    <Card style={styles.card}>
      <PanelHead icon="business" tone="navy" title="Bank Accounts" tagline="Synced through Plaid" />
      {stats.total > 0 ? (
        <View style={styles.stats}>
          <Pill label={`${stats.auto} auto-sorted`} tone="good" />
          {stats.toReview > 0 ? <Pill label={`${stats.toReview} to review`} tone="bad" /> : null}
          <Pill label={`${stats.transfers} transfers`} tone="muted" />
        </View>
      ) : null}
      <ThemedText type="small" themeColor={bankSync.status === 'error' ? 'danger' : 'textSecondary'}>
        {statusLine}
      </ThemedText>
      <View style={styles.actions}>
        {stats.total > 0 ? (
          <PillButton tone="primary" disabled={syncing} onPress={() => void refreshBank({ sync: true })}>
            {syncing ? 'Syncing…' : 'Sync now'}
          </PillButton>
        ) : null}
        <BankLinkButton onStatusChange={setLinkStatus} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two + 2,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
