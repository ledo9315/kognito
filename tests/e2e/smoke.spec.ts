import { expect, test } from '@playwright/test'
import { createNotebook } from './helpers'

test('a new notebook shows up in the overview', async ({ page }) => {
  const title = `Recherche ${Date.now()}`
  await createNotebook(page, title)

  await page.goto('/')
  await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible()
})

test('a fresh notebook explains both of its empty halves', async ({ page }) => {
  await createNotebook(page, `Leer ${Date.now()}`)

  // No sources on the left, no history in the middle. Neither may be a
  // blank area the user has to interpret.
  await expect(page.getByText('Noch keine Quellen').first()).toBeVisible()
  await expect(
    page.getByText(/Wähle mindestens eine Quelle aus/).first(),
  ).toBeVisible()
})

test('a long pasted text leaves the submit button reachable', async ({
  page,
}) => {
  await createNotebook(page, `Langer Text ${Date.now()}`)

  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()
  await page.getByRole('tab', { name: 'Text' }).click()
  await page
    .getByLabel('Text einfügen')
    .fill('Ein ganz normaler Satz aus einem Protokoll. '.repeat(120))

  // The field grows with its content. Without a ceiling it pushes the button
  // past the bottom of the window and the source cannot be added at all.
  const button = page.getByRole('button', { name: 'Text hinzufügen' })
  const box = await button.boundingBox()
  const viewport = page.viewportSize()
  expect(box?.y ?? 0).toBeLessThan(viewport?.height ?? 0)

  await button.click()
  await expect(page.getByText('1/1').first()).toBeVisible({ timeout: 20_000 })
})

test('source dialog opens, closes and returns focus', async ({ page }) => {
  await createNotebook(page, `Dialog ${Date.now()}`)

  // Not a role query: this one is read while the dialog is open, and an open
  // dialog takes the page behind it out of the accessibility tree. The header
  // trigger is the first of the two, the other sits on the empty state.
  const trigger = page.locator('[data-slot="dialog-trigger"]').first()
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
