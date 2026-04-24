import { NextResponse } from 'next/server';

import { prisma } from '@flipflow/db';
import { auth } from '@/server/auth';

/**
 * Mobile auth bridge.
 *
 * Flow:
 *   1. Expo app opens WebBrowser.openAuthSessionAsync() at `/auth/mobile?scheme=flipflow`
 *   2. If no Auth.js session cookie, we redirect into the normal sign-in flow
 *      with this URL as the callback so we end up back here after sign-in.
 *   3. Once signed in, we look up an active Session row for this user and hand
 *      the session token back to the app via the `flipflow://auth?token=...`
 *      custom URL scheme. Expo's auth session resolves and gives the app the
 *      token, which it then stores in SecureStore.
 *
 * No changes to `@flipflow/api` — this bridge lives entirely in the Next app.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const scheme = url.searchParams.get('scheme') ?? 'flipflow';
  const errorRedirect = `${scheme}://auth?error=sign_in_failed`;

  const session = await auth();

  if (!session?.user?.id) {
    // Kick into Auth.js sign-in, then loop back here.
    const signInUrl = new URL('/signin', url.origin);
    signInUrl.searchParams.set('callbackUrl', `/auth/mobile?scheme=${encodeURIComponent(scheme)}`);
    return NextResponse.redirect(signInUrl);
  }

  // Find (or mint) a DB session row for the signed-in user. With
  // `session.strategy = 'database'` this row already exists from the browser
  // sign-in — grab the newest one so the mobile app uses the freshest token.
  const dbSession = await prisma.session.findFirst({
    where: { userId: session.user.id, expires: { gt: new Date() } },
    orderBy: { expires: 'desc' },
    select: { sessionToken: true, expires: true },
  });

  if (!dbSession) {
    return NextResponse.redirect(errorRedirect);
  }

  const deepLink = new URL(`${scheme}://auth`);
  deepLink.searchParams.set('token', dbSession.sessionToken);
  deepLink.searchParams.set('expires', dbSession.expires.toISOString());

  return NextResponse.redirect(deepLink.toString());
}
