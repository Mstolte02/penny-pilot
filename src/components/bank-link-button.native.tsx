import { useState } from 'react';
import { createPlaidLinkSession, type LinkExit, type LinkSuccess } from 'react-native-plaid-link-sdk';

import { PillButton } from '@/components/penny-ui';
import { bankSyncService } from '@/services';

type BankLinkButtonProps = {
  onStatusChange?: (message: string) => void;
};

export function BankLinkButton({ onStatusChange }: BankLinkButtonProps) {
  const [busy, setBusy] = useState(false);

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
      updateStatus(error instanceof Error ? error.message : 'Bank sync could not complete.');
    } finally {
      setBusy(false);
    }
  };

  const handleExit = (exit: LinkExit) => {
    if (exit.error) {
      updateStatus(exit.error.displayMessage ?? exit.error.errorMessage);
    } else {
      updateStatus('Bank connection was cancelled.');
    }

    setBusy(false);
  };

  const startLink = async () => {
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
      updateStatus(error instanceof Error ? error.message : 'Could not open Plaid Link.');
    }
  };

  return (
    <PillButton tone="primary" disabled={busy} onPress={() => void startLink()}>
      {busy ? 'Connecting...' : 'Connect bank'}
    </PillButton>
  );
}
