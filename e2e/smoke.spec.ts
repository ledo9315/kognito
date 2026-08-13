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
