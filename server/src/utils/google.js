import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const VALID_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

export const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
export const googleEnabled = Boolean(googleClientId);

// Google rotates its signing keys, so the key set is fetched and cached for as
// long as Google says it is good for. A miss on the key id forces a refetch,
// which is what makes a rotation self-healing rather than an outage.
let cache = { keys: null, expiresAt: 0 };

async function fetchKeys(force = false) {
  if (!force && cache.keys && Date.now() < cache.expiresAt) return cache.keys;
  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new Error(`Could not fetch Google signing keys (${res.status})`);
  const body = await res.json();
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') || '')?.[1] ?? 3600);
  cache = { keys: body.keys, expiresAt: Date.now() + maxAge * 1000 };
  return cache.keys;
}

async function keyFor(kid) {
  let keys = await fetchKeys();
  let jwk = keys.find((k) => k.kid === kid);
  if (!jwk) {
    keys = await fetchKeys(true); // unknown kid: Google may have just rotated
    jwk = keys.find((k) => k.kid === kid);
  }
  if (!jwk) throw new Error('Unrecognised Google signing key');
  return crypto.createPublicKey({ key: jwk, format: 'jwk' });
}

/**
 * Verify a Google ID token and return the identity it asserts.
 * Throws if the signature, audience, issuer or expiry do not check out — the
 * token is attacker-supplied, so every claim has to be proven, not read.
 */
export async function verifyGoogleIdToken(credential) {
  if (!googleEnabled) throw new Error('Google sign-in is not configured on this server');
  if (!credential || typeof credential !== 'string') throw new Error('Missing Google credential');

  const decoded = jwt.decode(credential, { complete: true });
  if (!decoded?.header?.kid) throw new Error('Malformed Google credential');

  const payload = jwt.verify(credential, await keyFor(decoded.header.kid), {
    algorithms: ['RS256'],
    audience: googleClientId,
    issuer: VALID_ISSUERS,
  });

  // An unverified address must never match an existing account by email.
  if (payload.email_verified !== true && payload.email_verified !== 'true') {
    throw new Error('That Google account has no verified email address');
  }
  if (!payload.email || !payload.sub) throw new Error('Google credential is missing email or subject');

  return {
    sub: payload.sub,
    email: String(payload.email).trim().toLowerCase(),
    name: payload.name || payload.given_name || String(payload.email).split('@')[0],
    picture: payload.picture || null,
  };
}
