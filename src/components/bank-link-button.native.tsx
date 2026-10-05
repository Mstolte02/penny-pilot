import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { createPlaidLinkSession, type LinkExit, type LinkSuccess } from 'react-native-plaid-link-sdk';

import { PillButton } from '@/components/penny-ui';
import { plaidConsentCopy } from '@/constants/consent';
import { useConsent } from '@/hooks/use-consent';
import { authService, bankSyncService } from '@/services';

type BankLinkButtonProps = {
  onStatusChange?: (message: string) => void;
};

/**
 * Opens Plaid Link. Every outcome is shown in a native alert as well as the status
 * line, so a tap never "does nothing": not signed in, the data-sharing notice, a
 * server or Plaid error, a cancel, and success all speak up.
 */
export function BankLinkButton({ onStatusChange }: BankLinkButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { grant } = useConsent();

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
      const syncResult = await bankSyncService.syncTransactions(institution.id);
      const message = `${institution.name} synced. ${syncResult.added} new transactions are ready for review.`;
      updateStatus(message);
      Alert.alert('Bank connected', message);
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
