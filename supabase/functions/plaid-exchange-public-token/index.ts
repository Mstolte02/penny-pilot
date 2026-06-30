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

    return jsonResponse({
      id: data.id,
      userId: data.user_id,
      provider: 'plaid',
      providerInstitutionId: data.institution_id,
      name: data.institution_name,
      logoUrl: null,
      status: data.status,
      lastSyncedAt: data.last_synced_at,
    });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Could not exchange Plaid token.' },
      400
    );
  }
});
