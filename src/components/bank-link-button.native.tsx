import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { createPlaidLinkSession, type LinkExit, type LinkSuccess } from 'react-native-plaid-link-sdk';

import { PillButton } from '@/components/penny-ui';
import { plaidConsentCopy } from '@/constants/consent';
import { useConsent } from '@/hooks/use-consent';
import { authService, bankSyncService } from '@/services';
import { useFinance } from '@/services/finance-store';

/** Delays before each first-sync attempt: right away, then over about a minute. */
const FIRST_SYNC_WAITS_MS = [0, 4000, 8000, 12000, 16000, 20000];

type BankLinkButtonProps = {
  onStatusChange?: (message: string) => void;
  /** Called after a bank is connected (or found to be connected already). */
  onConnected?: () => void;
};

/**
 * Opens Plaid Link. Every outcome is shown in a native alert as well as the status
 * line, so a tap never "does nothing": not signed in, the data-sharing notice, a
 * server or Plaid error, a cancel, and success all speak up.
 */
export function BankLinkButton({ onStatusChange, onConnected }: BankLinkButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { grant } = useConsent();
  const { refreshBank } = useFinance();

  const updateStatus = (message: string) => {
    onStatusChange?.(message);
  };

  const fail = (message: string) => {
    setBusy(false);
    updateStatus(message);
    Alert.alert("Couldn't connect your bank", message);
  };

  const handleSuccess = async (success: LinkSuccess) => {
    try {
      updateStatus('Bank connected. Pulling your first transactions...');
      const institution = await bankSyncService.exchangePublicToken(success.publicToken);
      if (institution.duplicate) {
        const message = `${institution.name} is already connected, so Penny kept the one you had. If it stopped syncing, tap Reconnect next to it under Bank Accounts.`;
        updateStatus(message);
        Alert.alert('Already connected', message);
        onConnected?.();
        return;
      }
      // A new connection often has no history ready for the first few seconds, and a sync
      // that early returns nothing. Try again for about a minute before giving up.
      let added = 0;
      for (const waitMs of FIRST_SYNC_WAITS_MS) {
        if (waitMs > 0) {
          updateStatus(`Waiting for ${institution.name} to send your history...`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
        const syncResult = await bankSyncService.syncTransactions(institution.id);
        added += syncResult.added;
        if (added > 0) break;
      }
      // Pull the new rows into the phone right away, sorted against the budget, and give
      // any $0 plan lines their amounts from the new history.
      await refreshBank({ fillEmptyLines: true });
      const message =
        added > 0
          ? `${institution.name} synced. ${added} transactions came in. Anything Penny couldn't sort is waiting on your radar.`
          : `${institution.name} is connected, but your history is still on its way. Penny will pull it in the next time you open the app.`;
      updateStatus(message);
      Alert.alert('Bank connected', message);
      onConnected?.();
    } catch (error) {
      fail(error instanceof Error ? error.message : "Bank sync didn't finish.");
    } finally {
      setBusy(false);
    }
  };

  const handleExit = (exit: LinkExit) => {
    setBusy(false);
    if (exit.error) {
      fail(exit.error.displayMessage || exit.error.errorMessage || 'Plaid closed with an error.');
    } else {
      updateStatus('Bank connection cancelled.');
    }
  };

  const startLink = async () => {
    setBusy(true);
    updateStatus('Creating a secure Plaid connection...');
    try {
      // Record the Plaid-specific consent (locally + server audit trail) before linking.
      await grant(['privacy_terms', 'plaid_data_sharing'], 'plaid_link_prompt');
      const { linkToken } = await bankSyncService.createLinkToken();
      const session = await createPlaidLinkSession({
        token: linkToken,
        onSuccess: (success) => void handleSuccess(success),
        onExit: handleExit,
        onEvent: () => undefined,
        onLoad: () => updateStatus('Plaid is ready. Choose your bank to continue.'),
      });
      await session.open(true);
    } catch (error) {
      fail(error instanceof Error ? error.message : "Couldn't open Plaid Link.");
    }
  };

  const onPress = async () => {
    if (busy) return;
    // The server only makes a Plaid link for a signed-in account, so check first and
    // send the user to sign in instead of failing quietly.
    let signedIn = false;
    try {
      signedIn = Boolean(await authService.getCurrentUser());
    } catch {
      signedIn = false;
    }
    if (!signedIn) {
      updateStatus('Sign in first, then connect your bank.');
      Alert.alert(
        'Sign in first',
        'Your bank connects to your Penny Pilot account. Sign in with Apple or Google, then come back and connect.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Go to sign in', onPress: () => router.push('/auth') },
        ]
      );
      return;
    }
    // The data-sharing notice, as a native prompt the user cannot miss.
    Alert.alert('Connect with Plaid', plaidConsentCopy.body, [
      { text: 'Cancel', style: 'cancel' },
      { text: plaidConsentCopy.agreeLabel, onPress: () => void startLink() },
    ]);
  };

  return (
    <PillButton tone="primary" disabled={busy} onPress={() => void onPress()}>
      {busy ? 'Connecting...' : 'Connect bank'}
    </PillButton>
  );
}

type ReconnectBankButtonProps = {
  institutionId: string;
  institutionName: string;
  onStatusChange?: (message: string) => void;
  onDone?: () => void;
};

/**
 * Repairs a bank that needs the user to sign in again (a changed password, an expired
 * consent). Plaid's update mode keeps the same connection, so no transaction is duplicated.
 */
export function ReconnectBankButton({
  institutionId,
  institutionName,
  onStatusChange,
  onDone,
}: ReconnectBankButtonProps) {
  const [busy, setBusy] = useState(false);
  const { refreshBank } = useFinance();

  const finish = (message: string, title?: string) => {
    setBusy(false);
    onStatusChange?.(message);
    if (title) Alert.alert(title, message);
  };

  const start = async () => {
    if (busy) return;
    setBusy(true);
    onStatusChange?.(`Opening ${institutionName}...`);
    try {
      const { linkToken } = await bankSyncService.createLinkToken({ itemId: institutionId });
      const session = await createPlaidLinkSession({
        token: linkToken,
        onSuccess: () => {
          void (async () => {
            try {
              onStatusChange?.(`${institutionName} is back. Catching up on your transactions...`);
              await bankSyncService.syncTransactions(institutionId);
              await refreshBank();
              finish(`${institutionName} is reconnected and up to date.`, 'Bank reconnected');
              onDone?.();
            } catch (error) {
              finish(error instanceof Error ? error.message : "Sync didn't finish.", "Couldn't sync");
            }
          })();
        },
        onExit: (exit) =>
          exit.error
            ? finish(
                exit.error.displayMessage || exit.error.errorMessage || 'Plaid closed with an error.',
                "Couldn't reconnect"
              )
            : finish('Reconnect cancelled.'),
        onEvent: () => undefined,
      });
      await session.open(true);
    } catch (error) {
      finish(error instanceof Error ? error.message : "Couldn't open Plaid Link.", "Couldn't reconnect");
    }
  };

  return (
    <PillButton tone="primary" disabled={busy} onPress={() => void start()}>
      {busy ? 'Reconnecting...' : 'Reconnect'}
    </PillButton>
  );
}
