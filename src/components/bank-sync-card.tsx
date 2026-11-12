import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { BankLinkButton, ReconnectBankButton } from '@/components/bank-link-button';
import { PanelHead } from '@/components/flight-deck';
import { Card, Pill, PillButton } from '@/components/penny-ui';
import { ThemedText } from '@/components/themed-text';
import { env } from '@/config/env';
import { Spacing } from '@/constants/theme';
import type { BankInstitution } from '@/domain/finance';
import { useTheme } from '@/hooks/use-theme';
import { bankSyncService } from '@/services';
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

const STATUS_TEXT: Record<BankInstitution['status'], string> = {
  healthy: 'Syncing normally',
  syncing: 'Syncing now',
  'needs-reconnect': 'Needs you to sign in to your bank again',
  error: 'The last sync did not finish',
};

/** Connected banks: each bank's health, reconnect or disconnect it, connect another, sync now. */
export function BankSyncCard() {
  const theme = useTheme();
  const { transactions, bankSync, refreshBank } = useFinance();
  const [linkStatus, setLinkStatus] = useState<string | null>(null);
  const [banks, setBanks] = useState<BankInstitution[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadBanks = useCallback(() => {
    if (env.dataSource !== 'supabase') return;
    bankSyncService
      .listInstitutions()
      .then(setBanks)
      .catch(() => setBanks([]));
  }, []);

  // Reload after every sync, so a bank that just failed shows its Reconnect button.
  useEffect(() => {
    if (bankSync.status !== 'syncing') loadBanks();
  }, [bankSync.status, loadBanks]);

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

  const confirmDisconnect = (bank: BankInstitution) => {
    Alert.alert(
      `Disconnect ${bank.name}?`,
      'Penny stops syncing this bank and removes its transactions from your phone and from Penny Pilot’s servers. Your plan and goals stay.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            setRemovingId(bank.id);
            bankSyncService
              .removeInstitution(bank.id)
              .then(async () => {
                setLinkStatus(`${bank.name} is disconnected.`);
                await refreshBank();
              })
              .catch((error) => {
                const message = error instanceof Error ? error.message : 'Could not disconnect that bank.';
                setLinkStatus(message);
                Alert.alert("Couldn't disconnect", message);
              })
              .finally(() => {
                setRemovingId(null);
                loadBanks();
              });
          },
        },
      ]
    );
  };

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
      {banks.map((bank) => {
        const broken = bank.status === 'needs-reconnect' || bank.status === 'error';
        return (
          <View key={bank.id} style={[styles.bankRow, { borderTopColor: theme.border }]}>
            <View style={styles.bankText}>
              <ThemedText type="smallBold">{bank.name}</ThemedText>
              <ThemedText type="small" themeColor={broken ? 'danger' : 'textSecondary'}>
                {STATUS_TEXT[bank.status] ?? 'Connected'}
              </ThemedText>
            </View>
            <View style={styles.actions}>
              {broken ? (
                <ReconnectBankButton
                  institutionId={bank.id}
                  institutionName={bank.name}
                  onStatusChange={setLinkStatus}
                  onDone={loadBanks}
                />
              ) : null}
              <PillButton disabled={removingId === bank.id} onPress={() => confirmDisconnect(bank)}>
                {removingId === bank.id ? 'Disconnecting…' : 'Disconnect'}
              </PillButton>
            </View>
          </View>
        );
      })}
      <ThemedText type="small" themeColor={bankSync.status === 'error' ? 'danger' : 'textSecondary'}>
        {statusLine}
      </ThemedText>
      <View style={styles.actions}>
        {stats.total > 0 ? (
          <PillButton tone="primary" disabled={syncing} onPress={() => void refreshBank({ sync: true })}>
            {syncing ? 'Syncing…' : 'Sync now'}
          </PillButton>
        ) : null}
        <BankLinkButton onStatusChange={setLinkStatus} onConnected={loadBanks} />
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
  bankRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  bankText: {
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
