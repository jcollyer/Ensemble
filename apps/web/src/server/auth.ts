import NextAuth, { type DefaultSession, type NextAuthResult } from 'next-auth';
import type { Provider } from 'next-auth/providers';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Apple from 'next-auth/providers/apple';
import Google from 'next-auth/providers/google';
import Resend from 'next-auth/providers/resend';

import { prisma } from '@ensemble/db';

import { generateAppleClientSecret } from './apple-secret';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}

const providers: Provider[] = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  );
}

// Sign in with Apple. Required by App Store guideline 4.8 since we offer
// Google sign-in: any app that uses a third-party login service must also
// offer a privacy-preserving equivalent, and Apple explicitly names Sign
// in with Apple as one that satisfies all the requirements.
//
// Setup (one-time, in Apple Developer Portal):
//   1. Create an App ID with the "Sign In with Apple" capability.
//   2. Create a Services ID for web auth — this becomes AUTH_APPLE_ID,
//      e.g. "com.ensemble.signin". Configure it with:
//        - Domain: your-domain.com
//        - Return URL: https://your-domain.com/api/auth/callback/apple
//   3. Create a "Sign in with Apple" Key in the Keys section and download
//      the .p8 file. Note the Key ID (10 chars) and your Team ID.
//   4. Set the four AUTH_APPLE_* env vars below. The client-secret JWT is
//      generated in-process from the .p8 key on every cold start and
//      cached for ~5 months — see ./apple-secret.ts for details. No cron
//      or manual rotation is required as long as the server boots at
//      least once every 5 months (which any normal deploy does).
const appleClientSecret = generateAppleClientSecret();
if (process.env.AUTH_APPLE_ID && appleClientSecret) {
  providers.push(
    Apple({
      clientId: process.env.AUTH_APPLE_ID,
      clientSecret: appleClientSecret,
    }),
  );
}

if (process.env.AUTH_RESEND_KEY) {
  providers.push(
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.EMAIL_FROM ?? 'ensemble <onboarding@resend.dev>',
    }),
  );
}

// We use the secure cookie names whenever we're on HTTPS (which is required
// for Apple sign-in anyway). AUTH_URL drives this so that ngrok dev tunnels
// — which serve https:// — get the same cookie treatment as production.
const useSecureCookies = process.env.AUTH_URL?.startsWith('https://') ?? true;
const cookiePrefix = useSecureCookies ? '__Secure-' : '';

export const { handlers, signIn, signOut, auth }: NextAuthResult = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers,
  session: {
    strategy: 'database',
    // 90 days. Each request within updateAge (24h, default) slides the
    // expiry back out to 90d, so active users effectively never sign out.
    // The mobile bridge in app/auth/mobile/route.ts reads this expires
    // value straight off the DB session row, so this single setting
    // controls both web and mobile session lifetime.
    maxAge: 60 * 60 * 24 * 90,
  },
  pages: {
    signIn: '/signin',
    verifyRequest: '/signin/check-email',
  },
  // Sign in with Apple uses `response_mode=form_post`, so Apple's callback
  // arrives at /api/auth/callback/apple as a cross-site POST from
  // appleid.apple.com. Auth.js's default `sameSite: 'lax'` cookies are NOT
  // sent on cross-site POSTs, which means the `callbackUrl` cookie holding
  // `redirectTo` goes missing, Auth.js falls back to its default
  // post-signin destination, and the mobile bridge at /auth/mobile never
  // gets to deep-link back into the app. Setting these specific cookies
  // to `sameSite: 'none'` (with Secure) keeps the Apple flow intact.
  // The session cookie itself stays at the Auth.js default — only the
  // short-lived OAuth-dance cookies are widened.
  cookies: {
    pkceCodeVerifier: {
      name: `${cookiePrefix}authjs.pkce.code_verifier`,
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: useSecureCookies,
        maxAge: 60 * 15,
      },
    },
    state: {
      name: `${cookiePrefix}authjs.state`,
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: useSecureCookies,
        maxAge: 60 * 15,
      },
    },
    nonce: {
      name: `${cookiePrefix}authjs.nonce`,
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: useSecureCookies,
      },
    },
    callbackUrl: {
      name: `${cookiePrefix}authjs.callback-url`,
      options: {
        sameSite: 'none',
        path: '/',
        secure: useSecureCookies,
      },
    },
  },
  callbacks: {
    session({ session, user }) {
      // Expose the DB user id on the session so server components and tRPC
      // procedures can authorize without a second lookup.
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});
