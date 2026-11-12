import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { decryptAccessToken, plaidFetch } from '../_shared/plaid.ts';
import { getAuthenticatedClient } from '../_shared/supabase.ts';

/** A year of history makes the first plan's averages much steadier than Plaid's 90-day default. */
const DAYS_REQUESTED = 365;

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const { client, user } = await getAuthenticatedClient(req);
    const body = await req.json().catch(() => ({}));
    const itemId = typeof body?.itemId === 'string' ? body.itemId : null;
    const platform = body?.platform === 'android' ? 'android' : 'ios';
    const products = (Deno.env.get('PLAID_PRODUCTS') ?? 'transactions').split(',');
    const countryCodes = (Deno.env.get('PLAID_COUNTRY_CODES') ?? 'US').split(',');
    const redirectUri = Deno.env.get('PLAID_REDIRECT_URI');
    const androidPackageName = Deno.env.get('PLAID_ANDROID_PACKAGE_NAME') ?? 'com.pennypilot.finance';

    // Update mode: the bank needs the user to sign in again. Plaid repairs the same
    // connection, so no new item and no duplicate transactions.
    let accessToken: string | null = null;
    if (itemId) {
      const { data: item, error } = await client
        .from('plaid_items')
        .select('access_token_ciphertext')
        .eq('id', itemId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (!item) throw new Error('That bank connection was not found.');
      accessToken = await decryptAccessToken(item.access_token_ciphertext);
    }

    // OAuth banks return to the app differently per platform: iOS through the universal
    // link in redirect_uri, Android through the package name. Plaid rejects both at once.
    const oauthReturn =
      platform === 'android'
        ? { android_package_name: androidPackageName }
        : redirectUri
          ? { redirect_uri: redirectUri }
          : {};

    const data = await plaidFetch<{ link_token: string; expiration: string; request_id: string }>(
      '/link/token/create',
      {
        client_name: 'Penny Pilot',
        language: 'en',
        country_codes: countryCodes,
        user: {
          client_user_id: user.id,
          email_address: user.email,
        },
        ...(accessToken
          ? { access_token: accessToken }
          : { products, transactions: { days_requested: DAYS_REQUESTED } }),
        ...oauthReturn,
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
