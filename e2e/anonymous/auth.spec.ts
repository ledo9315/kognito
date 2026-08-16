import { expect, test } from '@playwright/test'

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

test('sign-in rejects a wrong password without leaking whether the account exists', async ({
  page,
}) => {
  await page.goto('/sign-in')
  await page.getByLabel('E-Mail').fill('nobody@kognito.test')
  await page.getByLabel('Passwort').fill('falsches-passwort')
  await page.getByRole('button', { name: 'Anmelden' }).click()

  await expect(page.locator('form').getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/\/sign-in/)
})

test('sign-up refuses a password under eight characters', async ({ page }) => {
  await page.goto('/sign-up')
  await page.getByLabel('Name').fill('Kurz')
  await page.getByLabel('E-Mail').fill('kurz@kognito.test')
  await page.getByLabel('Passwort').evaluate((element) => {
    const input = element as HTMLInputElement
    input.removeAttribute('minlength')
    input.value = 'kurz'
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.getByRole('button', { name: 'Konto erstellen' }).click()

  await expect(page.locator('form').getByRole('alert')).toContainText('8 Zeichen')
})
