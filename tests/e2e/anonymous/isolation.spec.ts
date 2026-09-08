import { expect, test } from '@playwright/test'
import { createNotebook, signOut, signUp } from '../helpers'

test('a notebook is invisible to another account', async ({ page }) => {
  await signUp(page, 'Nutzer A')
  const notebookUrl = await createNotebook(page, 'Vertrauliche Recherche')
  await page.goto('/')
  await expect(page.getByText('Vertrauliche Recherche')).toBeVisible()

  await signOut(page)
  await signUp(page, 'Nutzer B')

  // Not in the overview.
  await expect(page.getByText('Noch kein Notizbuch')).toBeVisible()
  await expect(page.getByText('Vertrauliche Recherche')).toHaveCount(0)

  const response = await page.goto(notebookUrl)
  expect(response?.status()).toBe(404)
  await expect(
    page.getByRole('heading', { name: 'Notizbuch nicht gefunden' }),
  ).toBeVisible()
  await expect(page.getByText('Vertrauliche Recherche')).toHaveCount(0)
})
