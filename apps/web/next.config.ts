import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['@fightclub/shared'],
  output: 'standalone',
  poweredByHeader: false,
  async rewrites() {
    // Protected test APIs are called through the server-side route handler.
    if (process.env.API_PROTECTION_BYPASS) return [];
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_ORIGIN || 'http://127.0.0.1:4100'}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};
export default config;
