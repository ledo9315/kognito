import { expect, test } from '@playwright/test'

test('overview lists notebooks and opens one', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('Kognito').first()).toBeVisible()
  await page.getByText('Klimaneutrale Industrie 2045').click()

  await expect(page).toHaveURL(/\/notebook\/notebook-climate$/)
  await expect(page.getByRole('heading', { name: 'Quellen' })).toBeVisible()
})

test('source dialog opens, closes and returns focus', async ({ page }) => {
  await page.goto('/notebook/notebook-climate')

  // Located by CSS selector rather than by role: while the dialog is open,
  // Base UI takes the background out of the accessibility tree, so getByRole
  // no longer finds the trigger.
  const trigger = page.locator('[data-slot="dialog-trigger"]')
  await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')

  await trigger.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  // Focus has to return to the trigger, otherwise screen readers land back at
  // the top of the page after closing.
  await expect(trigger).toBeFocused()
})

test('clicking a citation opens the matching source', async ({ page }) => {
  await page.goto('/notebook/notebook-climate')

  const citation = page.getByRole('button', { name: 'Beleg 3 anzeigen' }).first()
  const readerHeading = page.getByRole('heading', {
    name: 'Interview: Energiewende in der Praxis',
  })

  // Retried on purpose: a click that lands before hydration reaches the DOM
  // node but not the handler, and nothing happens. That window is wide enough
  // to matter against the dev server, which compiles the route on first
  // request.
  await expect(async () => {
    await citation.click()
    await expect(readerHeading).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 15_000 })
})
