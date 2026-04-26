/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages are TypeScript source — let Next compile them.
  transpilePackages: ['@flipflow/api', '@flipflow/db', '@flipflow/types'],
  // tRPC + superjson on RSC works best with this enabled.
  serverExternalPackages: ['@prisma/client'],
  // Tell Next.js's file tracer to include the Prisma query engine binary when
  // packaging serverless functions. Without this, the .node engine file is not
  // copied into the function bundle and Prisma fails at runtime on Vercel.
  // Path is relative to apps/web (this file's location).
  outputFileTracingIncludes: {
    '/**': ['../../packages/db/src/generated/client/**/*.node'],
  },
};

export default nextConfig;
