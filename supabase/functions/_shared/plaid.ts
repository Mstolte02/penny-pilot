const plaidBaseUrls = {
  sandbox: 'https://sandbox.plaid.com',
  development: 'https://development.plaid.com',
  production: 'https://production.plaid.com',
} as const;

type PlaidEnv = keyof typeof plaidBaseUrls;

function getPlaidEnv(): PlaidEnv {
  const value = Deno.env.get('PLAID_ENV') ?? 'sandbox';
  if (value === 'development' || value === 'production' || value === 'sandbox') {
    return value;
  }

  return 'sandbox';
}

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
    throw new Error(payload.error_message ?? payload.display_message ?? 'Plaid request failed.');
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
