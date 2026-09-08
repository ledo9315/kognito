import { expect, type Page } from '@playwright/test'

/**
 * The sign-in code the server hands out under test. playwright.config.ts sets
 * the same variable for the server it starts, so both sides agree.
 */
export const otpCode = process.env.E2E_OTP_CODE ?? '424242'

/** A six digit code that is certainly not the one the server expects. */
export const wrongOtpCode = otpCode === '000000' ? '111111' : '000000'

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@kognito.test`
}

export async function storedAfter(page: Page, click: Promise<void>) {
  const stored = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes('/notebook/'),
  )
  await click
  await stored
}

/** Types the code on /sign-in/verify and waits for the signed-in shell. */
export async function confirmCode(page: Page, code = otpCode) {
  await expect(page).toHaveURL(/\/sign-in\/verify\?/)
  await page.getByLabel(/Bestätigungscode/).fill(code)
  await page.getByRole('button', { name: 'Code bestätigen' }).click()
}

export async function signUp(page: Page, name: string) {
  const email = uniqueEmail('e2e')

  await page.goto('/sign-up')
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('E-Mail').fill(email)
  await page.getByRole('button', { name: 'Konto erstellen' }).click()

  await confirmCode(page)
  await expect(page.getByRole('button', { name: 'Kontomenü' })).toBeVisible()

  return email
}

export async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Kontomenü' }).click()
  await page.getByRole('menuitem', { name: 'Abmelden' }).click()
  await expect(page).toHaveURL(/\/sign-in/)
}

export async function createNotebook(page: Page, title: string) {
  await page.goto('/')
  await page.getByRole('button', { name: /Neues Notizbuch/ }).first().click()
  await page.getByLabel('Titel').fill(title)
  await page.getByRole('button', { name: 'Erstellen' }).click()

  await expect(page).toHaveURL(/\/notebook\/[0-9a-f-]{36}$/)
  // The title appears twice on an empty notebook: in the header and above the
  // suggested questions.
  await expect(page.getByRole('heading', { name: title }).first()).toBeVisible()

  return page.url()
}
