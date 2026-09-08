/**
 * A fixed sign-in code for the end-to-end tests, which have no inbox to read a
 * real one from. Playwright sets E2E_OTP_CODE for the server it starts; while
 * the variable is set, that code is handed out and nothing is sent.
 *
 * Refused on a production deployment, so it cannot be left on there by
 * mistake: a known code would let anyone in as anyone.
 */
export function fixedOtpForTests(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const code = env.E2E_OTP_CODE
  if (!code) return undefined

  if (env.VERCEL_ENV === 'production') {
    throw new Error('E2E_OTP_CODE must not be set on a production deployment')
  }
  if (!/^\d{6}$/.test(code)) {
    throw new Error('E2E_OTP_CODE must be exactly six digits')
  }
  return code
}
