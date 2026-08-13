import { expect, type Page } from '@playwright/test'

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

export async function signUp(page: Page, name: string) {
  const email = uniqueEmail('e2e')

  await page.goto('/sign-up')
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill('sehr-geheim-1234')
  await page.getByRole('button', { name: 'Konto erstellen' }).click()
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
