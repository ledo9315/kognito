import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { getDb } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { emailOTP } from 'better-auth/plugins'
import { sendOtpEmail } from '@/lib/email'
import { fixedOtpForTests } from '@/lib/test-otp'

function create() {
  const googleClientId = process.env.GOOGLE_CLIENT_ID
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

  return betterAuth({
    baseURL:
      process.env.BETTER_AUTH_URL ??
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'),

    database: drizzleAdapter(getDb(), {
      provider: 'pg',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
    },

    socialProviders:
      googleClientId && googleClientSecret
        ? {
            google: {
              clientId: googleClientId,
              clientSecret: googleClientSecret,
            },
          }
        : {},

    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google'],
      },
    },

    plugins: [
      emailOTP({
        storeOTP: 'hashed',
        // Undefined outside the end-to-end tests, which makes the plugin draw
        // a random code as usual.
        generateOTP: () => fixedOtpForTests(),
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== 'sign-in') {
            throw new Error(`OTP type "${type}" is not supported yet`)
          }
          // The tests know the code already, there is nothing to deliver.
          if (fixedOtpForTests()) return
          await sendOtpEmail({ email, otp, type: 'sign-in' })
        },
      }),
      nextCookies(),
    ],
  })
}

type Auth = ReturnType<typeof create>

let instance: Auth | null = null

export function getAuth(): Auth {
  if (!instance) instance = create()
  return instance
}
