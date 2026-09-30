import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { decryptAccessToken, plaidFetch } from '../_shared/plaid.ts';
import { getAuthenticatedClient, getServiceRoleClient } from '../_shared/supabase.ts';

// Permanent account deletion (privacy/data-deletion right + Plaid remediation:
// "data deletion and retention policy"). Steps, in order:
//   1. Authenticate the caller (only a user can delete their own account).
//   2. Revoke every Plaid Item at Plaid so no further data is pulled after deletion.
//   3. Delete the auth.users row with the service role, which cascades to the
//      profile and every dependent table (transactions, accounts, budgets, goals,
//      consents, plaid_items) via the ON DELETE CASCADE foreign keys.

type StoredItem = {
  plaid_item_id: string;
  access_token_ciphertext: string;
};

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const { client, user } = await getAuthenticatedClient(req);

    // Best-effort: revoke each Plaid Item so the access token is dead at Plaid's
    // side even if the row is about to be cascade-deleted anyway.
    const { data: items } = await client
      .from('plaid_items')
      .select('plaid_item_id, access_token_ciphertext')
      .eq('user_id', user.id);

    for (const item of (items ?? []) as StoredItem[]) {
      try {
        const accessToken = await decryptAccessToken(item.access_token_ciphertext);
        await plaidFetch('/item/remove', { access_token: accessToken });
      } catch (revokeError) {
        // Don't let a single failed revoke block the deletion the user asked for;
        // the token is scoped to this app and the row is removed regardless.
        console.error('Plaid item revoke failed during account deletion', revokeError);
      }
    }

    // Delete the auth user; cascades through public.profiles to all owned data.
    const admin = getServiceRoleClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      throw error;
    }

    return jsonResponse({ deleted: true });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Could not delete your account.' },
      400
    );
  }
});
