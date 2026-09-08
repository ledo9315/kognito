import { expect, test } from '@playwright/test'
import { createNotebook } from './helpers'

test('a notebook is renamed in the header and stays renamed', async ({
  page,
}) => {
  const before = `Entwurf ${Date.now()}`
  const after = `Endfassung ${Date.now()}`
  await createNotebook(page, before)

  await page.getByRole('button', { name: `${before} bearbeiten` }).click()
  await page.getByRole('menuitem', { name: 'Umbenennen' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Titel').fill(after)
  await dialog.getByRole('button', { name: 'Speichern' }).click()

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

  await page.getByRole('button', { name: `${title} bearbeiten` }).click()
  await page.getByRole('menuitem', { name: 'Umbenennen' }).click()

  await page.getByRole('dialog').getByLabel('Titel').fill('Sollte nicht ankommen')
  await page.keyboard.press('Escape')

  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible()
})

test('deleting asks first and can be called off', async ({ page }) => {
  const title = `Doch nicht ${Date.now()}`
  const url = await createNotebook(page, title)

  await page.getByRole('button', { name: `${title} bearbeiten` }).click()
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

  await page.getByRole('button', { name: `${title} bearbeiten` }).click()
  await page.getByRole('menuitem', { name: 'Löschen' }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Endgültig löschen' })
    .click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('link', { name: new RegExp(title) })).toHaveCount(0)
})

test('a notebook is renamed from the overview card', async ({ page }) => {
  const before = `Aus der Übersicht ${Date.now()}`
  const after = `Umbenannt ${Date.now()}`
  await createNotebook(page, before)

  await page.goto('/')
  // The symbol is its own control next to the title, changing it needs no
  // dialog. The picker itself is left out here, it loads its emoji list from
  // a cdn and that does not belong in a test of this page.
  await expect(
    page.getByRole('button', { name: `Symbol von ${before} ändern` }),
  ).toBeVisible()

  await page.getByRole('button', { name: `${before} bearbeiten` }).click()
  await page.getByRole('menuitem', { name: 'Umbenennen' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Titel').fill(after)
  await dialog.getByRole('button', { name: 'Speichern' }).click()

  const card = page.getByRole('link', { name: new RegExp(after) })
  await expect(card).toBeVisible()

  // The notebook itself carries the new title, so the write reached the
  // database and not only the card in front of it.
  await card.click()
  await expect(page.getByRole('heading', { name: after, level: 1 })).toBeVisible()
})

test('a notebook is deleted from the overview card', async ({ page }) => {
  const title = `Direkt weg ${Date.now()}`
  await createNotebook(page, title)

  await page.goto('/')
  await page.getByRole('button', { name: `${title} bearbeiten` }).click()
  await page.getByRole('menuitem', { name: 'Löschen' }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Endgültig löschen' })
    .click()

  await expect(page.getByRole('link', { name: new RegExp(title) })).toHaveCount(0)
})
