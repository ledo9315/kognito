import { expect, test as setup } from '@playwright/test'

export const storageStatePath = '.playwright/user.json'

/**
 * Registers a fresh account and stores its cookies, so the other specs start
 * signed in instead of repeating the form.
 *
 * A new email per run keeps parallel and repeated runs from colliding. The
 * accounts pile up, which is why this is meant to run against a throwaway
 * database rather than the one behind the deployment.
 */
setup('sign up and keep the session', async ({ page }) => {
  const email = `e2e-${Date.now()}-${process.env.TEST_WORKER_INDEX ?? 0}@kognito.test`

  await page.goto('/sign-up')
  await page.getByLabel('Name').fill('E2E Nutzer')
  await page.getByLabel('E-Mail').fill(email)
  await page.getByLabel('Passwort').fill('sehr-geheim-1234')
  await page.getByRole('button', { name: 'Konto erstellen' }).click()

  await expect(page.getByRole('button', { name: 'Kontomenü' })).toBeVisible()
  await page.context().storageState({ path: storageStatePath })
})
