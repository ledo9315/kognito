import { expect, test } from '@playwright/test'
import { createNotebook } from './helpers'

test('uploading a pdf stores a readable source', async ({ page }) => {
  await createNotebook(page, `Upload ${Date.now()}`)

  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()
  await page.getByLabel('Datei auswählen').setInputFiles('features/sources/fixtures/sample.pdf')
  await page.getByRole('button', { name: 'Hochladen' }).click()

  // The source is listed, and it is neither unread nor failed.
  const source = page.getByRole('button', { name: /sample/ })
  await expect(source).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('Fehlgeschlagen')).toHaveCount(0)
  await expect(page.getByText('Wird gelesen')).toHaveCount(0)

  // Its text came out of the pdf, not out of the file name.
  await source.click()
  // Twice in the document: the desktop column and the mobile tab, one of
  // them hidden by css.
  await expect(page.getByText('Kognito Testdokument').first()).toBeVisible()

  // And it survives a reload, so it really is in the database.
  await page.reload()
  await expect(page.getByRole('button', { name: /sample/ })).toBeVisible()
})

test('a pdf without a text layer is refused with a reason', async ({ page }) => {
  await createNotebook(page, `Scan ${Date.now()}`)

  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()
  await page.getByLabel('Datei auswählen').setInputFiles('features/sources/fixtures/scanned.pdf')
  await page.getByRole('button', { name: 'Hochladen' }).click()

  await expect(page.getByRole('alert')).toContainText('keinen auslesbaren Text', {
    timeout: 20_000,
  })
  await expect(page.getByText('Noch keine Quellen')).toBeVisible()
})
