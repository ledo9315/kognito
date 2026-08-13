/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Uploads go through a server action, and those are capped at 1 MB by
    // default. The action itself refuses anything above 10 MB.
    serverActions: { bodySizeLimit: '11mb' },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy-Report-Only',
            value:
              "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' https://va.vercel-scripts.com; script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
          },
        ],
      },
    ]
  },
}

export default nextConfig
