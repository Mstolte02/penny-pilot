import { useState } from 'react';
import { createPlaidLinkSession, type LinkExit, type LinkSuccess } from 'react-native-plaid-link-sdk';

import { PillButton } from '@/components/penny-ui';
import { plaidConsentCopy } from '@/constants/consent';
import { useConsent } from '@/hooks/use-consent';
import { bankSyncService } from '@/services';

type BankLinkButtonProps = {
  onStatusChange?: (message: string) => void;
};

export function BankLinkButton({ onStatusChange }: BankLinkButtonProps) {
  const [busy, setBusy] = useState(false);
  // Require an explicit Plaid data-sharing acknowledgment before opening Link.
  const [acknowledging, setAcknowledging] = useState(false);
  const { grant } = useConsent();

  const updateStatus = (message: string) => {
    onStatusChange?.(message);
  };

  const handleSuccess = async (success: LinkSuccess) => {
    try {
      updateStatus('Bank connected. Pulling your first transactions...');
      const institution = await bankSyncService.exchangePublicToken(success.publicToken);
      const syncResult = await bankSyncService.syncTransactions(institution.id);
      updateStatus(
        `${institution.name} synced. ${syncResult.added} new transactions are ready for review.`
      );
    } catch (error) {
      updateStatus(error instanceof Error ? error.message : "Bank sync didn't finish.");
    } finally {
      setBusy(false);
    }
  };

  const handleExit = (exit: LinkExit) => {
    if (exit.error) {
      updateStatus(exit.error.displayMessage ?? exit.error.errorMessage);
    } else {
      updateStatus('Bank connection cancelled.');
    }

    setBusy(false);
  };

  const requestLink = () => {
    // First tap surfaces the data-sharing acknowledgment; second tap proceeds.
    setAcknowledging(true);
    updateStatus(plaidConsentCopy.body);
  };

  const startLink = async () => {
    setAcknowledging(false);
    // Record the Plaid-specific consent (locally + server audit trail) before linking.
    await grant(['privacy_terms', 'plaid_data_sharing'], 'plaid_link_prompt');
    setBusy(true);
    updateStatus('Creating a secure Plaid connection...');

    try {
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
      setBusy(false);
      updateStatus(error instanceof Error ? error.message : "Couldn't open Plaid Link.");
    }
  };

  if (acknowledging) {
    return (
      <PillButton tone="primary" disabled={busy} onPress={() => void startLink()}>
        {plaidConsentCopy.agreeLabel}
      </PillButton>
    );
  }

  return (
    <PillButton tone="primary" disabled={busy} onPress={requestLink}>
      {busy ? 'Connecting...' : 'Connect bank'}
    </PillButton>
  );
}
