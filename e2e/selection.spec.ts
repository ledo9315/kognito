import { expect, test, type Page } from '@playwright/test'
import { createNotebook, storedAfter } from './helpers'

async function addTextSource(page: Page, text: string, expectCount: string) {
  await page.locator('[data-slot="dialog-trigger"]').first().click()
  await page.getByRole('tab', { name: 'Text' }).click()
  await page.getByLabel('Text einfügen').fill(text)
  await page.getByRole('button', { name: 'Text hinzufügen' }).click()

  await expect(page.getByText(expectCount).first()).toBeVisible({
    timeout: 20_000,
  })
}

test('a deselected source stays deselected after a reload', async ({ page }) => {
  await createNotebook(page, `Auswahl ${Date.now()}`)
  await addTextSource(page, 'Die erste Quelle mit Inhalt.', '1/1')
  await addTextSource(page, 'Die zweite Quelle mit Inhalt.', '2/2')

  const first = page
    .getByRole('checkbox', { name: /Die erste Quelle.*als Kontext verwenden/ })
    .first()
  await expect(first).toBeChecked()

  await storedAfter(page, first.uncheck())
  await expect(page.getByText('1/2').first()).toBeVisible()

  await page.reload()

  // The browser state is gone after a reload, so what shows up now comes
  // from the database.
  await expect(page.getByText('1/2').first()).toBeVisible()
  await expect(
    page
      .getByRole('checkbox', { name: /Die erste Quelle.*als Kontext verwenden/ })
      .first(),
  ).not.toBeChecked()
})

test('without a selected source the chat does not even ask', async ({ page }) => {
  await createNotebook(page, `Leer ${Date.now()}`)
  await addTextSource(page, 'Die einzige Quelle.', '1/1')

  let asked = false
  await page.route('**/api/chat', (route) => {
    asked = true
    return route.abort()
  })

  await page
    .getByRole('checkbox', { name: 'Alle Quellen auswählen' })
    .first()
    .uncheck()
  await expect(page.getByText('0/1').first()).toBeVisible()

  const field = page.getByRole('textbox', { name: 'Frage eingeben' }).first()
  await expect(field).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Frage senden' }).first(),
  ).toBeDisabled()

  // The suggested questions are the other way into the chat.
  await expect(
    page.getByRole('button', { name: /Fasse die Kernaussagen/ }).first(),
  ).toBeDisabled()

  expect(asked).toBe(false)
})

test('selecting all sources again is stored as well', async ({ page }) => {
  await createNotebook(page, `Alle ${Date.now()}`)
  await addTextSource(page, 'Die erste Quelle mit Inhalt.', '1/1')
  await addTextSource(page, 'Die zweite Quelle mit Inhalt.', '2/2')

  const all = page.getByRole('checkbox', { name: 'Alle Quellen auswählen' }).first()
  await storedAfter(page, all.uncheck())
  await expect(page.getByText('0/2').first()).toBeVisible()

  await page.reload()
  await expect(page.getByText('0/2').first()).toBeVisible()

  await storedAfter(
    page,
    page.getByRole('checkbox', { name: 'Alle Quellen auswählen' }).first().check(),
  )
  await expect(page.getByText('2/2').first()).toBeVisible()

  await page.reload()
  await expect(page.getByText('2/2').first()).toBeVisible()
})
