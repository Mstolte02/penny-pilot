import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SupabaseClient = ReturnType<typeof createClient>;

export async function getAuthenticatedClient(req: Request): Promise<{
  client: SupabaseClient;
  user: { id: string; email?: string };
}> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const authorization = req.headers.get('Authorization');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase function environment is missing SUPABASE_URL or SUPABASE_ANON_KEY.');
  }

  if (!authorization) {
    throw new Error('Sign in before connecting a bank.');
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    throw new Error(error?.message ?? 'Sign in before connecting a bank.');
  }

  return { client, user: { id: data.user.id, email: data.user.email } };
}

/**
 * A privileged client backed by the service-role key, for operations RLS
 * intentionally forbids from any user session — e.g. deleting the auth.users row
 * during account deletion. Never expose this key to the client.
 */
export function getServiceRoleClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Supabase function environment is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
