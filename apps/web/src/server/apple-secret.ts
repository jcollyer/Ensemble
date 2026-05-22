import crypto from 'node:crypto';

/**
 * Generates the JWT that Apple wants in place of a "client secret" for
 * Sign in with Apple. Spec: https://developer.apple.com/documentation/sign_in_with_apple/generate_and_validate_tokens
 *
 * The JWT is signed with our ES256 .p8 private key (downloaded once from
 * Apple Developer) and claims:
 *
 *   iss = Team ID            (10-char Apple Developer team identifier)
 *   sub = Services ID        (the AUTH_APPLE_ID — NOT the iOS bundle ID)
 *   aud = appleid.apple.com  (constant)
 *   iat = now
 *   exp = now + 5 months     (Apple's hard cap is 6 months; 5 leaves slack)
 *   kid = Key ID             (10-char id of the .p8 key, in the header)
 *
 * We cache the generated JWT in-process for as long as it has at least 24h
 * of life left, so every server cold-start regenerates a fresh one and
 * subsequent requests reuse it. Restart often enough (any normal deploy)
 * and you never have to rotate the secret manually.
 *
 * Required env vars (all four must be set for the result to be non-null;
 * Apple sign-in is otherwise disabled in apps/web/src/server/auth.ts):
 *
 *   AUTH_APPLE_TEAM_ID      — your Team ID, e.g. "ABCD123EFG"
 *   AUTH_APPLE_ID           — your Services ID, e.g. "com.ensemble.signin"
 *   AUTH_APPLE_KEY_ID       — your .p8 Key ID, e.g. "X4Y5Z6ABCD"
 *   AUTH_APPLE_PRIVATE_KEY  — the full contents of the .p8 file, including
 *                             the BEGIN/END lines. When set via a hosting
 *                             provider that escapes newlines (Vercel etc.)
 *                             we normalize "\\n" back to real newlines.
 *
 * No external crypto library is needed — Node's built-in `crypto` can sign
 * ES256 from a PKCS8 PEM directly. The one non-obvious bit is
 * `dsaEncoding: 'ieee-p1363'`: ES256 signatures must be raw r||s (64 bytes
 * for P-256), not DER, which is Node's default for ECDSA.
 */

interface Cached {
  secret: string;
  /** Absolute timestamp (ms) at which the JWT itself expires. */
  expiresAt: number;
}

let cached: Cached | null = null;

export function generateAppleClientSecret(): string | null {
  const teamId = process.env.AUTH_APPLE_TEAM_ID;
  const servicesId = process.env.AUTH_APPLE_ID;
  const keyId = process.env.AUTH_APPLE_KEY_ID;
  // Hosting providers that store env vars as flat strings sometimes encode
  // newlines as the literal two-char sequence `\n`. Convert those back to
  // real newlines so PEM parsing works regardless of how the value was set.
  const privateKey = process.env.AUTH_APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!teamId || !servicesId || !keyId || !privateKey) {
    return null;
  }

  // Reuse the cached JWT until it has less than 24h of life remaining. This
  // makes the function effectively free for every request after the first.
  const oneDayMs = 24 * 60 * 60 * 1000;
  if (cached && cached.expiresAt > Date.now() + oneDayMs) {
    return cached.secret;
  }

  const now = Math.floor(Date.now() / 1000);
  // 5 months — Apple allows up to 6, but leaving a month of slack means a
  // forgotten redeploy doesn't break sign-in overnight.
  const expiresInSeconds = 60 * 60 * 24 * 30 * 5;

  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + expiresInSeconds,
    aud: 'https://appleid.apple.com',
    sub: servicesId,
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  let key: crypto.KeyObject;
  try {
    key = crypto.createPrivateKey({ key: privateKey, format: 'pem' });
  } catch (err) {
    // A malformed .p8 (e.g. truncated, wrong newlines, wrong env var) is by
    // far the most common failure mode here. Log loudly so the operator
    // sees it in their server logs rather than silently disabling Apple.
    console.error('[auth/apple] Failed to parse AUTH_APPLE_PRIVATE_KEY:', err);
    return null;
  }

  const signer = crypto.createSign('SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign({
    key,
    // ES256 JWTs require the raw r||s signature format, not DER (Node's
    // default for ECDSA). Without this, Apple rejects the JWT.
    dsaEncoding: 'ieee-p1363',
  });

  const secret = `${signingInput}.${base64url(signature)}`;
  cached = { secret, expiresAt: (now + expiresInSeconds) * 1000 };
  return secret;
}

/** RFC 7515 base64url: standard base64 with -, _ in place of +, / and no padding. */
function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input;
  return buf.toString('base64').replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
