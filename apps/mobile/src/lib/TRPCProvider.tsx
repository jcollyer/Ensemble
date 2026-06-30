import { useMemo } from 'react';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, TRPCClientError } from '@trpc/client';
import superjson from 'superjson';

import { API_URL } from './config';
import { trpc } from './trpc';
import { useAuth } from './AuthContext';

/**
 * True when a tRPC error is an auth rejection (the server returned 401 /
 * UNAUTHORIZED). This happens when the stored session token is expired or no
 * longer exists in the server's Session table — e.g. a token minted against a
 * different environment's database, or a session that has since expired.
 */
function isUnauthorized(error: unknown): boolean {
  return (
    error instanceof TRPCClientError &&
    (error.data?.code === 'UNAUTHORIZED' || error.data?.httpStatus === 401)
  );
}

/**
 * Provides tRPC + React Query to the app. Sits inside <AuthProvider> so it
 * can read the current session token and inject it as a bearer header on
 * every request. When the session changes, the closure captures the latest
 * value so the next request uses the new token automatically.
 */
export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const { session, signOut } = useAuth();

  const { queryClient, trpcClient } = useMemo(() => {
    const queryClient = new QueryClient({
      // If any query fails with 401, the stored token is no longer valid.
      // Clear the session so the app drops to guest mode (which always works)
      // instead of endlessly re-firing authenticated queries that all fail —
      // the cause of the infinite home-screen spinner.
      queryCache: new QueryCache({
        onError: (error) => {
          if (isUnauthorized(error)) void signOut();
        },
      }),
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          // Never retry an auth failure — retrying with the same bad token
          // just hammers the server (the 401 loop seen in the logs).
          retry: (failureCount, error) => {
            if (isUnauthorized(error)) return false;
            return failureCount < 1;
          },
        },
      },
    });

    const trpcClient = trpc.createClient({
      links: [
        httpBatchLink({
          url: `${API_URL}/api/trpc`,
          transformer: superjson,
          headers: () => (session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        }),
      ],
    });

    return { queryClient, trpcClient };
    // Re-create when the token changes so in-flight clients don't keep using a
    // stale token after sign-out.
  }, [session?.token, signOut]);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
