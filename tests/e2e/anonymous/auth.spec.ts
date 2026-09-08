import { expect, test } from '@playwright/test'
import { confirmCode, uniqueEmail, wrongOtpCode } from '../helpers'

test('shows anonymous visitors the landing page', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: /Belegte Antworten/ }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Anmelden' })).toBeVisible()
})

test('remembers where an anonymous visitor wanted to go', async ({ page }) => {
  await page.goto('/notebook/notebook-climate')
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fnotebook%2Fnotebook-climate/)
})

test('sign-in asks for a code and refuses a wrong one', async ({ page }) => {
  await page.goto('/sign-in')
  await page.getByLabel('E-Mail').fill(uniqueEmail('wrong-code'))
  await page.getByRole('button', { name: 'Anmelden' }).click()

  await confirmCode(page, wrongOtpCode)

  await expect(page.locator('form').getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/\/sign-in\/verify\?/)
  await expect(page.getByRole('button', { name: 'Kontomenü' })).toHaveCount(0)
})

test('the code page without an address goes back to sign-in', async ({ page }) => {
  await page.goto('/sign-in/verify')
  await expect(page).toHaveURL(/\/sign-in$/)
})
