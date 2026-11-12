import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { encryptAccessToken, plaidFetch } from '../_shared/plaid.ts';
import { getAuthenticatedClient } from '../_shared/supabase.ts';

type ExchangeResponse = {
  access_token: string;
  item_id: string;
};

type ItemResponse = {
  item: {
    institution_id?: string;
  };
};

type InstitutionResponse = {
  institution: {
    institution_id: string;
    name: string;
  };
};

type AccountsResponse = {
  accounts: { mask: string | null; name: string }[];
};

// deno-lint-ignore no-explicit-any
type StoredItem = Record<string, any>;

function toInstitution(row: StoredItem) {
  return {
    id: row.id,
    userId: row.user_id,
    provider: 'plaid',
    providerInstitutionId: row.institution_id,
    name: row.institution_name,
    logoUrl: null,
    status: row.status,
    lastSyncedAt: row.last_synced_at,
  };
}

async function findDuplicateItem(
  // deno-lint-ignore no-explicit-any
  client: any,
  userId: string,
  institutionId: string,
  newAccessToken: string
): Promise<StoredItem | null> {
  if (institutionId === 'unknown') return null;
  const { data: existing } = await client
    .from('plaid_items')
    .select('*')
    .eq('user_id', userId)
    .eq('institution_id', institutionId);
  if (!existing || existing.length === 0) return null;

  const { accounts } = await plaidFetch<AccountsResponse>('/accounts/get', {
    access_token: newAccessToken,
  });
  const newKeys = new Set(accounts.map((account) => `${account.mask ?? ''}|${account.name}`));

  for (const item of existing as StoredItem[]) {
    const { data: oldAccounts } = await client
      .from('bank_accounts')
      .select('mask, name')
      .eq('user_id', userId)
      .eq('plaid_item_id', item.id);
    // An item that never synced has no accounts yet; at the same bank, treat it as the same login.
    if (!oldAccounts || oldAccounts.length === 0) return item;
    if ((oldAccounts as { mask: string | null; name: string }[]).some((account) =>
      newKeys.has(`${account.mask ?? ''}|${account.name}`)
    )) {
      return item;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const { client, user } = await getAuthenticatedClient(req);
    const { publicToken } = await req.json();
    if (!publicToken || typeof publicToken !== 'string') {
      throw new Error('Missing Plaid public token.');
    }

    const exchanged = await plaidFetch<ExchangeResponse>('/item/public_token/exchange', {
      public_token: publicToken,
    });
    const item = await plaidFetch<ItemResponse>('/item/get', {
      access_token: exchanged.access_token,
    });
    const institutionId = item.item.institution_id ?? 'unknown';
    const institution =
      institutionId === 'unknown'
        ? { institution: { institution_id: institutionId, name: 'Connected institution' } }
        : await plaidFetch<InstitutionResponse>('/institutions/get_by_id', {
            institution_id: institutionId,
            country_codes: (Deno.env.get('PLAID_COUNTRY_CODES') ?? 'US').split(','),
          });

    // Linking a bank that is already connected made a second item with new ids, so every
    // transaction counted twice. If the new link shares an account (same mask) with an
    // existing connection at this bank, drop the new one and keep the old.
    const duplicate = await findDuplicateItem(
      client,
      user.id,
      institution.institution.institution_id,
      exchanged.access_token
    );
    if (duplicate) {
      await plaidFetch('/item/remove', { access_token: exchanged.access_token }).catch(() => undefined);
      return jsonResponse({ ...toInstitution(duplicate), duplicate: true });
    }

    const encryptedToken = await encryptAccessToken(exchanged.access_token);
    const { data, error } = await client
      .from('plaid_items')
      .upsert(
        {
          user_id: user.id,
          plaid_item_id: exchanged.item_id,
          access_token_ciphertext: encryptedToken,
          institution_id: institution.institution.institution_id,
          institution_name: institution.institution.name,
          status: 'healthy',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,plaid_item_id' }
      )
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return jsonResponse(toInstitution(data));
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Could not exchange Plaid token.' },
      400
    );
  }
});
