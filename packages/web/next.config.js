/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  async rewrites() {
    const defaultUrl = process.env.NODE_ENV === 'production' ? 'http://api:3001' : 'http://localhost:3001';
    const apiUrl = process.env.API_INTERNAL_URL || defaultUrl;
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
