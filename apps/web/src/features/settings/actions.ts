'use server';

import { redirect } from 'next/navigation';

import { signOut } from '@/server/auth';

/**
 * Server action invoked from the Delete Account confirmation modal after
 * the tRPC `auth.deleteAccount` mutation has already wiped the user.
 *
 * The mutation cascades the Session row, but the browser still holds the
 * (now-invalid) session cookie. Calling NextAuth's signOut clears that
 * cookie before we send the user back to the marketing page.
 *
 * We pass `redirect: false` and use Next's `redirect()` so the navigation
 * happens server-side after the cookie is cleared — bypassing the default
 * "Are you sure you want to sign out?" page NextAuth shows on a bare GET.
 */
export async function signOutAfterAccountDelete() {
  await signOut({ redirect: false });
  redirect('/');
}
