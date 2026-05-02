/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Next.js app does not import Prisma directly. All data flows through
  // the core API (NestJS, port 3000 by default). The CNZ_CORE_API_URL env
  // var allows the app to be pointed at a remote staging API in CI / preview
  // deploys without rebuilding.
  async rewrites() {
    const target = process.env.CNZ_CORE_API_URL ?? 'http://localhost:3000';
    return [
      { source: '/api/:path*', destination: `${target}/:path*` },
    ];
  },
  // ui/ contains TypeScript source consumed via @cnz/ui/* alias. Next 16
  // transpiles it inline with the rest of the app.
  transpilePackages: [],
  experimental: {
    // Allow imports from the workspace ui/ directory (relative to apps/chatnow-zone).
    externalDir: true,
  },
};

module.exports = nextConfig;
