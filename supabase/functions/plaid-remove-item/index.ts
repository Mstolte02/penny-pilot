import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { removePlaidItem } from '../_shared/plaid.ts';
import { getAuthenticatedClient } from '../_shared/supabase.ts';

// Disconnects one bank. The item is revoked at Plaid first; only then is the row deleted,
// which cascades to its accounts and transactions. If Plaid cannot be reached, nothing is
// deleted, so the token is never lost while Plaid still holds the connection.

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const { client, user } = await getAuthenticatedClient(req);
    const body = await req.json().catch(() => ({}));
    const itemId = typeof body?.itemId === 'string' ? body.itemId : null;
    if (!itemId) throw new Error('Missing bank connection id.');

    const { data: item, error } = await client
      .from('plaid_items')
      .select('id, access_token_ciphertext')
      .eq('id', itemId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (!item) throw new Error('That bank connection was not found.');

    await removePlaidItem(item.access_token_ciphertext);

    const { error: deleteError } = await client
      .from('plaid_items')
      .delete()
      .eq('id', item.id)
      .eq('user_id', user.id);
    if (deleteError) throw deleteError;

    return jsonResponse({ removed: true });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Could not disconnect that bank.' },
      400
    );
  }
});
