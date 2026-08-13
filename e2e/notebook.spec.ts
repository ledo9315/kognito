import { expect, test } from '@playwright/test'
import { createNotebook, storedAfter } from './helpers'

test('a notebook is renamed in the header and stays renamed', async ({
  page,
}) => {
  const before = `Entwurf ${Date.now()}`
  const after = `Endfassung ${Date.now()}`
  await createNotebook(page, before)

  await page.getByRole('button', { name: 'Notizbuch bearbeiten' }).click()
  await page.getByRole('menuitem', { name: 'Umbenennen' }).click()

  const field = page.getByRole('textbox', { name: 'Titel des Notizbuchs' })
  await field.fill(after)
  await storedAfter(page, field.press('Enter'))

  await expect(page.getByRole('heading', { name: after, level: 1 })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: after, level: 1 })).toBeVisible()

  // And the overview knows the new name too.
  await page.goto('/')
  await expect(page.getByRole('link', { name: new RegExp(after) })).toBeVisible()
  await expect(page.getByRole('link', { name: new RegExp(before) })).toHaveCount(0)
})

test('escape leaves the title as it was', async ({ page }) => {
  const title = `Bleibt ${Date.now()}`
  await createNotebook(page, title)

  await page.getByRole('button', { name: 'Notizbuch bearbeiten' }).click()
  await page.getByRole('menuitem', { name: 'Umbenennen' }).click()

  const field = page.getByRole('textbox', { name: 'Titel des Notizbuchs' })
  await field.fill('Sollte nicht ankommen')
  await field.press('Escape')

  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible()
})

test('deleting asks first and can be called off', async ({ page }) => {
  const title = `Doch nicht ${Date.now()}`
  const url = await createNotebook(page, title)

  await page.getByRole('button', { name: 'Notizbuch bearbeiten' }).click()
  await page.getByRole('menuitem', { name: 'Löschen' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Notizbuch löschen?')
  await expect(dialog).toContainText(title)

  await dialog.getByRole('button', { name: 'Abbrechen' }).click()

  await expect(page).toHaveURL(url)
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible()
})

test('a deleted notebook is gone from the overview', async ({ page }) => {
  const title = `Weg damit ${Date.now()}`
  await createNotebook(page, title)

  await page.getByRole('button', { name: 'Notizbuch bearbeiten' }).click()
  await page.getByRole('menuitem', { name: 'Löschen' }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Endgültig löschen' })
    .click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('link', { name: new RegExp(title) })).toHaveCount(0)
})
