import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { plaidFetch } from '../_shared/plaid.ts';
import { getAuthenticatedClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const { user } = await getAuthenticatedClient(req);
    const products = (Deno.env.get('PLAID_PRODUCTS') ?? 'transactions').split(',');
    const countryCodes = (Deno.env.get('PLAID_COUNTRY_CODES') ?? 'US').split(',');
    const redirectUri = Deno.env.get('PLAID_REDIRECT_URI');
    const data = await plaidFetch<{ link_token: string; expiration: string; request_id: string }>(
      '/link/token/create',
      {
        client_name: 'Penny Pilot',
        language: 'en',
        country_codes: countryCodes,
        products,
        user: {
          client_user_id: user.id,
          email_address: user.email,
        },
        ...(redirectUri ? { redirect_uri: redirectUri } : {}),
      }
    );

    return jsonResponse({
      linkToken: data.link_token,
      expiration: data.expiration,
      requestId: data.request_id,
    });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Could not create Plaid Link token.' },
      400
    );
  }
});
