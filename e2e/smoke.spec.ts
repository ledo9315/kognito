import { expect, test } from '@playwright/test'
import { createNotebook } from './helpers'

test('a new notebook shows up in the overview', async ({ page }) => {
  const title = `Recherche ${Date.now()}`
  await createNotebook(page, title)

  await page.goto('/')
  await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible()
})

test('source dialog opens, closes and returns focus', async ({ page }) => {
  await createNotebook(page, `Dialog ${Date.now()}`)

  const trigger = page.locator('[data-slot="dialog-trigger"]')
  await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')

  await trigger.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  await expect(trigger).toBeFocused()
})

test('clicking a citation opens the matching source', async ({ page }) => {
  await createNotebook(page, `Belege ${Date.now()}`)

  const sourceTitle = 'Beispieltext für den Belegtest'
  await page.locator('[data-slot="dialog-trigger"]').click()
  await page.getByRole('tab', { name: 'Text' }).click()
  await page.getByLabel('Text einfügen').fill(sourceTitle)
  await page.getByRole('button', { name: 'Text hinzufügen' }).click()

  // Wait for the stored source to reach the list. Asking earlier means asking
  // without a source, and the answer then carries no citation at all.
  await expect(page.getByText('1/1')).toBeVisible({ timeout: 20_000 })

  await page.getByRole('button', { name: /Fasse die Kernaussagen/ }).click()
  const citation = page.getByRole('button', { name: 'Beleg 1 anzeigen' })
  await expect(citation).toBeVisible({ timeout: 15_000 })

  await citation.click()
  await expect(
    page.getByRole('heading', { name: sourceTitle }),
  ).toBeVisible()
})
