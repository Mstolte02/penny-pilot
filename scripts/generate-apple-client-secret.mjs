#!/usr/bin/env node
/**
 * Generates the Sign in with Apple client secret (an ES256-signed JWT) that
 * Supabase's Apple provider requires. Zero dependencies — Node >= 18 only.
 *
 * Usage:
 *   node scripts/generate-apple-client-secret.mjs \
 *     --key ./AuthKey_ABC123DEFG.p8 \
 *     --key-id ABC123DEFG \
 *     --team-id YOURTEAMID \
 *     --services-id com.pennypilot.finance.web
 *
 * Paste the output into Supabase → Authentication → Providers → Apple →
 * "Secret Key (for OAuth)".
 *
 * IMPORTANT: Apple caps the secret's lifetime at 6 months (this script uses
 * the maximum). Set a reminder to re-run this and update Supabase before it
 * expires, or Apple sign-in silently starts failing.
 */
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || !process.argv[index + 1]) {
    console.error(`Missing --${name}. Run with --help for usage.`);
    process.exit(1);
  }
  return process.argv[index + 1];
}

if (process.argv.includes('--help')) {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0]);
  process.exit(0);
}

const keyPath = arg('key');
const keyId = arg('key-id');
const teamId = arg('team-id');
const servicesId = arg('services-id');

const base64url = (input) =>
  Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

const now = Math.floor(Date.now() / 1000);
const header = base64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
const payload = base64url(
  JSON.stringify({
    iss: teamId,
    iat: now,
    exp: now + 60 * 60 * 24 * 180, // 180 days — Apple's maximum allowed lifetime
    aud: 'https://appleid.apple.com',
    sub: servicesId,
  })
);

const signingInput = `${header}.${payload}`;
const privateKey = createPrivateKey(readFileSync(keyPath, 'utf8'));
// JWT ES256 requires the raw 64-byte (r||s) signature form, not ASN.1/DER.
const signature = sign('sha256', Buffer.from(signingInput), {
  key: privateKey,
  dsaEncoding: 'ieee-p1363',
});

const expiresOn = new Date((now + 60 * 60 * 24 * 180) * 1000).toISOString().slice(0, 10);
console.log(`${signingInput}.${base64url(signature)}`);
console.error(`\n(secret expires ${expiresOn} — set a reminder to regenerate it before then)`);
