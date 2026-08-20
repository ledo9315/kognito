import { withSentryConfig } from '@sentry/nextjs'

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

export default withSentryConfig(nextConfig, {
  org: 'leonid-at',
  project: 'javascript-nextjs',

  // Source map upload runs only where SENTRY_AUTH_TOKEN is set (CI, Vercel).
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload a wider set of client source files for readable stack traces
  widenClientFileUpload: true,

  // Same-origin proxy route for client events. The CSP above only allows
  // connect-src 'self', and this also gets past ad blockers.
  tunnelRoute: '/monitoring',

  silent: !process.env.CI,
})
