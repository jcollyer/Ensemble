/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages are TypeScript source — let Next compile them.
  transpilePackages: ['@ensemble/api', '@ensemble/db', '@ensemble/types'],
  // tRPC + superjson on RSC works best with this enabled.
  serverExternalPackages: ['@prisma/client'],
  images: {
    remotePatterns: [
      {
        // Allow avatar images served from any S3 bucket/region.
        // Pattern: https://<bucket>.s3.<region>.amazonaws.com/avatars/...
        protocol: 'https',
        hostname: '**.amazonaws.com',
        pathname: '/avatars/**',
      },
    ],
  },
};

export default nextConfig;
