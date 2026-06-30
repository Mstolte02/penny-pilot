import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import {
  accountKind,
  decryptAccessToken,
  normalizeMerchant,
  plaidFetch,
} from '../_shared/plaid.ts';
import { getAuthenticatedClient } from '../_shared/supabase.ts';

type PlaidAccount = {
  account_id: string;
  balances: {
    available: number | null;
    current: number | null;
    iso_currency_code: string | null;
  };
  mask: string | null;
  name: string;
  official_name: string | null;
  subtype: string | null;
  type: string;
};

type PlaidTransaction = {
  account_id: string;
  amount: number;
  category: string[] | null;
  date: string;
  merchant_name: string | null;
  name: string;
  pending: boolean;
  transaction_id: string;
};

type SyncResponse = {
  accounts: PlaidAccount[];
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: { transaction_id: string }[];
  next_cursor: string;
  has_more: boolean;
};

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const { client, user } = await getAuthenticatedClient(req);
    const { institutionId } = await req.json();
    if (!institutionId || typeof institutionId !== 'string') {
      throw new Error('Missing institution id.');
    }

    const { data: plaidItem, error: itemError } = await client
      .from('plaid_items')
      .select('*')
      .eq('id', institutionId)
      .eq('user_id', user.id)
      .single();

    if (itemError) {
      throw itemError;
    }

    const accessToken = await decryptAccessToken(plaidItem.access_token_ciphertext);
    let cursor = plaidItem.cursor as string | null;
    let hasMore = true;
    let added = 0;
    let modified = 0;
    let removed = 0;
    const accountIdByProviderId = new Map<string, string>();

    while (hasMore) {
      const sync = await plaidFetch<SyncResponse>('/transactions/sync', {
        access_token: accessToken,
        cursor,
      });
      cursor = sync.next_cursor;
      hasMore = sync.has_more;

      const accountRows = sync.accounts.map((account) => ({
        user_id: user.id,
        plaid_item_id: plaidItem.id,
        provider_account_id: account.account_id,
        name: account.name,
        official_name: account.official_name,
        mask: account.mask,
        kind: accountKind(account.type, account.subtype ?? undefined),
        current_balance: account.balances.current,
        available_balance: account.balances.available,
        iso_currency_code: account.balances.iso_currency_code ?? 'USD',
        hidden: false,
        updated_at: new Date().toISOString(),
      }));

      if (accountRows.length > 0) {
        const { data: accounts, error: accountError } = await client
          .from('bank_accounts')
          .upsert(accountRows, { onConflict: 'user_id,provider_account_id' })
          .select('id, provider_account_id');

        if (accountError) {
          throw accountError;
        }

        accounts?.forEach((account) =>
          accountIdByProviderId.set(account.provider_account_id, account.id)
        );
      }

      const transactionRows = [...sync.added, ...sync.modified]
        .map((transaction) => {
          const accountId = accountIdByProviderId.get(transaction.account_id);
          if (!accountId) {
            return null;
          }

          const merchant = transaction.merchant_name ?? transaction.name;

          return {
            user_id: user.id,
            account_id: accountId,
            provider_transaction_id: transaction.transaction_id,
            date: transaction.date,
            merchant_name: merchant,
            normalized_merchant: normalizeMerchant(merchant),
            original_description: transaction.name,
            amount: Math.abs(transaction.amount),
            kind: transaction.amount < 0 ? 'income' : 'expense',
            category_confidence: 'none',
            needs_review: true,
            pending: transaction.pending,
            excluded_from_budget: false,
            plaid_category: transaction.category ?? [],
            raw_provider_payload: transaction,
            updated_at: new Date().toISOString(),
          };
        })
        .filter(Boolean);

      if (transactionRows.length > 0) {
        const { error: transactionError } = await client
          .from('transactions')
          .upsert(transactionRows, { onConflict: 'user_id,provider_transaction_id' });

        if (transactionError) {
          throw transactionError;
        }
      }

      if (sync.removed.length > 0) {
        const { error: removedError } = await client
          .from('transactions')
          .delete()
          .eq('user_id', user.id)
          .in(
            'provider_transaction_id',
            sync.removed.map((transaction) => transaction.transaction_id)
          );

        if (removedError) {
          throw removedError;
        }
      }

      added += sync.added.length;
      modified += sync.modified.length;
      removed += sync.removed.length;
    }

    const { error: updateError } = await client
      .from('plaid_items')
      .update({
        cursor,
        last_synced_at: new Date().toISOString(),
        status: 'healthy',
        updated_at: new Date().toISOString(),
      })
      .eq('id', plaidItem.id)
      .eq('user_id', user.id);

    if (updateError) {
      throw updateError;
    }

    return jsonResponse({ added, modified, removed });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Could not sync Plaid transactions.' },
      400
    );
  }
});
