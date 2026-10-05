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
  personal_finance_category?: {
    primary: string;
    detailed: string;
    confidence_level?: string;
  } | null;
};

type SyncResponse = {
  accounts: PlaidAccount[];
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: { transaction_id: string }[];
  next_cursor: string;
  has_more: boolean;
};

type Counts = { added: number; modified: number; removed: number };

// Money moving between the user's own accounts, and card payments: never spending.
const TRANSFER_PRIMARIES = new Set(['TRANSFER_IN', 'TRANSFER_OUT']);
const TRANSFER_DETAILED = new Set(['LOAN_PAYMENTS_CREDIT_CARD_PAYMENT']);

function isTransfer(transaction: PlaidTransaction) {
  const pfc = transaction.personal_finance_category;
  return Boolean(pfc && (TRANSFER_PRIMARIES.has(pfc.primary) || TRANSFER_DETAILED.has(pfc.detailed)));
}

// deno-lint-ignore no-explicit-any
async function syncItem(client: any, userId: string, plaidItem: Record<string, any>): Promise<Counts> {
  const accessToken = await decryptAccessToken(plaidItem.access_token_ciphertext);
  let cursor = plaidItem.cursor as string | null;
  let hasMore = true;
  const counts: Counts = { added: 0, modified: 0, removed: 0 };
  const accountIdByProviderId = new Map<string, string>();

  while (hasMore) {
    const sync = await plaidFetch<SyncResponse>('/transactions/sync', {
      access_token: accessToken,
      cursor,
      // Ask for Plaid's personal finance category explicitly; the phone sorts with it.
      options: { include_personal_finance_category: true },
    });
    cursor = sync.next_cursor;
    hasMore = sync.has_more;

    const accountRows = sync.accounts.map((account) => ({
      user_id: userId,
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
      if (accountError) throw accountError;
      // deno-lint-ignore no-explicit-any
      accounts?.forEach((account: any) =>
        accountIdByProviderId.set(account.provider_account_id, account.id)
      );
    }

    const transactionRows = [...sync.added, ...sync.modified]
      .map((transaction) => {
        const accountId = accountIdByProviderId.get(transaction.account_id);
        if (!accountId) return null;
        const merchant = transaction.merchant_name ?? transaction.name;
        const pfc = transaction.personal_finance_category;
        return {
          user_id: userId,
          account_id: accountId,
          provider_transaction_id: transaction.transaction_id,
          date: transaction.date,
          merchant_name: merchant,
          normalized_merchant: normalizeMerchant(merchant),
          original_description: transaction.name,
          amount: Math.abs(transaction.amount),
          // Plaid: positive = money out. Kind stays sign-based so transfers keep direction.
          kind: transaction.amount < 0 ? 'income' : 'expense',
          category_confidence: 'none',
          // The phone categorizes and reviews; nothing waits in a server-side queue.
          needs_review: false,
          pending: transaction.pending,
          excluded_from_budget: isTransfer(transaction),
          plaid_category: pfc ? [pfc.primary, pfc.detailed] : (transaction.category ?? []),
          raw_provider_payload: transaction,
          updated_at: new Date().toISOString(),
        };
      })
      .filter(Boolean);

    if (transactionRows.length > 0) {
      const { error: transactionError } = await client
        .from('transactions')
        .upsert(transactionRows, { onConflict: 'user_id,provider_transaction_id' });
      if (transactionError) throw transactionError;
    }

    if (sync.removed.length > 0) {
      const { error: removedError } = await client
        .from('transactions')
        .delete()
        .eq('user_id', userId)
        .in(
          'provider_transaction_id',
          sync.removed.map((transaction) => transaction.transaction_id)
        );
      if (removedError) throw removedError;
    }

    counts.added += sync.added.length;
    counts.modified += sync.modified.length;
    counts.removed += sync.removed.length;
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
    .eq('user_id', userId);
  if (updateError) throw updateError;

  return counts;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const { client, user } = await getAuthenticatedClient(req);
    const body = await req.json().catch(() => ({}));
    const institutionId = typeof body?.institutionId === 'string' ? body.institutionId : null;

    // One bank (right after connecting) or every bank this user has (app open / Sync now).
    let query = client.from('plaid_items').select('*').eq('user_id', user.id);
    if (institutionId) query = query.eq('id', institutionId);
    const { data: items, error: itemError } = await query;
    if (itemError) throw itemError;
    if (institutionId && (!items || items.length === 0)) {
      throw new Error('That bank connection was not found.');
    }

    const total: Counts = { added: 0, modified: 0, removed: 0 };
    const failures: string[] = [];
    for (const item of items ?? []) {
      try {
        const counts = await syncItem(client, user.id, item);
        total.added += counts.added;
        total.modified += counts.modified;
        total.removed += counts.removed;
      } catch (error) {
        // One bank needing a re-login shouldn't stop the others from syncing.
        failures.push(
          `${item.institution_name ?? 'A bank'}: ${error instanceof Error ? error.message : 'sync failed'}`
        );
        await client
          .from('plaid_items')
          .update({ status: 'error', updated_at: new Date().toISOString() })
          .eq('id', item.id)
          .eq('user_id', user.id);
      }
    }

    if (failures.length > 0 && failures.length === (items ?? []).length) {
      throw new Error(failures.join(' '));
    }

    return jsonResponse({ ...total, failures });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Could not sync Plaid transactions.' },
      400
    );
  }
});
