import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@flipflow/api';

export const trpc: ReturnType<typeof createTRPCReact<AppRouter>> = createTRPCReact<AppRouter>();
