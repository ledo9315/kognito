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
  await page.goto('/notebook/notebook-climate')

  const citation = page.getByRole('button', { name: 'Beleg 3 anzeigen' }).first()
  const readerHeading = page.getByRole('heading', {
    name: 'Interview: Energiewende in der Praxis',
  })

  await expect(async () => {
    await citation.click()
    await expect(readerHeading).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 15_000 })
})
