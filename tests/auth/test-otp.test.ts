import { describe, expect, it } from 'vitest'
import { fixedOtpForTests } from '@/lib/test-otp'

describe('fixedOtpForTests', () => {
  it('is off while the variable is unset', () => {
    expect(fixedOtpForTests({})).toBeUndefined()
    expect(fixedOtpForTests({ E2E_OTP_CODE: '' })).toBeUndefined()
  })

  it('hands out the configured code', () => {
    expect(fixedOtpForTests({ E2E_OTP_CODE: '424242' })).toBe('424242')
  })

  it('refuses anything but six digits', () => {
    expect(() => fixedOtpForTests({ E2E_OTP_CODE: 'abc' })).toThrow(/six digits/)
    expect(() => fixedOtpForTests({ E2E_OTP_CODE: '12345' })).toThrow(/six digits/)
  })

  it('refuses to run on a production deployment', () => {
    expect(() =>
      fixedOtpForTests({ E2E_OTP_CODE: '424242', VERCEL_ENV: 'production' }),
    ).toThrow(/production/)
  })

  it('stays available on preview deployments and in CI', () => {
    expect(fixedOtpForTests({ E2E_OTP_CODE: '424242', VERCEL_ENV: 'preview' })).toBe('424242')
    expect(fixedOtpForTests({ E2E_OTP_CODE: '424242', CI: 'true' })).toBe('424242')
  })
})
