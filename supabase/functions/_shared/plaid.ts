const plaidBaseUrls = {
  sandbox: 'https://sandbox.plaid.com',
  production: 'https://production.plaid.com',
} as const;

type PlaidEnv = keyof typeof plaidBaseUrls;

function getPlaidEnv(): PlaidEnv {
  const value = (Deno.env.get('PLAID_ENV') ?? 'sandbox').trim().toLowerCase();
  if (value === 'production' || value === 'sandbox') {
    return value;
  }

  // A typo must not quietly send real users to the sandbox.
  throw new Error(`PLAID_ENV must be "sandbox" or "production", not "${value}".`);
}

/** Plaid's error, with its code kept so callers can tell a re-login from an outage. */
export class PlaidError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
    readonly type: string | null
  ) {
    super(message);
  }
}

/** Errors that only the user can fix, by signing in to their bank again. */
export const RELOGIN_ERROR_CODES = new Set([
  'ITEM_LOGIN_REQUIRED',
  'PENDING_EXPIRATION',
  'PENDING_DISCONNECT',
  'ACCESS_NOT_GRANTED',
  'NO_ACCOUNTS',
  'INVALID_UPDATED_USERNAME',
]);

/** Plaid has already forgotten this item, so removing it again is a success. */
export const ITEM_GONE_ERROR_CODES = new Set(['ITEM_NOT_FOUND', 'INVALID_ACCESS_TOKEN']);

function getPlaidCredentials() {
  const clientId = Deno.env.get('PLAID_CLIENT_ID');
  const secret = Deno.env.get('PLAID_SECRET');

  if (!clientId || !secret) {
    throw new Error('Plaid secrets are not configured.');
  }

  return { client_id: clientId, secret };
}

export async function plaidFetch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const env = getPlaidEnv();
  const response = await fetch(`${plaidBaseUrls[env]}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...getPlaidCredentials(), ...body }),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new PlaidError(
      payload.display_message ?? payload.error_message ?? 'Plaid request failed.',
      payload.error_code ?? null,
      payload.error_type ?? null
    );
  }

  return payload as T;
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

async function getTokenKey() {
  const rawKey = Deno.env.get('PLAID_TOKEN_ENCRYPTION_KEY');
  if (!rawKey) {
    throw new Error('PLAID_TOKEN_ENCRYPTION_KEY is not configured.');
  }

  return crypto.subtle.importKey('raw', base64ToBytes(rawKey), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptAccessToken(accessToken: string) {
  const key = await getTokenKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(accessToken)
    )
  );

  return `${bytesToBase64(iv)}.${bytesToBase64(ciphertext)}`;
}

export async function decryptAccessToken(value: string) {
  const [ivBase64, ciphertextBase64] = value.split('.');
  if (!ivBase64 || !ciphertextBase64) {
    throw new Error('Stored Plaid token is not encrypted correctly.');
  }

  const key = await getTokenKey();
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(ivBase64) },
    key,
    base64ToBytes(ciphertextBase64)
  );

  return new TextDecoder().decode(plaintext);
}

/** Revokes an item at Plaid. Throws if Plaid still holds it, so callers never drop a live token. */
export async function removePlaidItem(accessTokenCiphertext: string) {
  const accessToken = await decryptAccessToken(accessTokenCiphertext);
  // Two tries: the second covers a passing timeout.
  for (let attempt = 1; ; attempt += 1) {
    try {
      await plaidFetch('/item/remove', { access_token: accessToken });
      return;
    } catch (error) {
      if (error instanceof PlaidError && error.code && ITEM_GONE_ERROR_CODES.has(error.code)) return;
      if (attempt >= 2) throw error;
    }
  }
}

export function accountKind(type?: string, subtype?: string) {
  if (type === 'depository' && subtype === 'savings') return 'savings';
  if (type === 'depository') return 'checking';
  if (type === 'credit') return 'credit';
  if (type === 'loan') return 'loan';
  if (type === 'investment') return 'investment';

  return 'other';
}

export function normalizeMerchant(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
