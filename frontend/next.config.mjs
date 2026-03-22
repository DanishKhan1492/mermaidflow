/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  /**
   * Server-side rewrite: browser calls /api/* → Next.js server proxies to
   * the backend container. API_URL is a private server-side env var so the
   * backend URL is never exposed to the client bundle.
   */
  async rewrites() {
    const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
