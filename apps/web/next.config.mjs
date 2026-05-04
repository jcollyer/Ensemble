/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages are TypeScript source — let Next compile them.
  transpilePackages: ['@ensemble/api', '@ensemble/db', '@ensemble/types'],
  // tRPC + superjson on RSC works best with this enabled.
  serverExternalPackages: ['@prisma/client'],
};

export default nextConfig;
