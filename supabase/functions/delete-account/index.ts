import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { removePlaidItem } from '../_shared/plaid.ts';
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
  institution_name: string | null;
};

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const { client, user } = await getAuthenticatedClient(req);

    // Revoke every Plaid Item before anything is deleted. If a revoke fails, stop: the
    // cascade would drop the only copy of the token, and the bank connection would stay
    // live at Plaid with no way to end it. The user can try again in a moment.
    const { data: items, error: itemsError } = await client
      .from('plaid_items')
      .select('plaid_item_id, access_token_ciphertext, institution_name')
      .eq('user_id', user.id);
    if (itemsError) throw itemsError;

    for (const item of (items ?? []) as StoredItem[]) {
      try {
        await removePlaidItem(item.access_token_ciphertext);
      } catch (revokeError) {
        console.error('Plaid item revoke failed during account deletion', revokeError);
        throw new Error(
          `Could not disconnect ${item.institution_name ?? 'one of your banks'} just now, so nothing was deleted. Try again in a minute.`
        );
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
