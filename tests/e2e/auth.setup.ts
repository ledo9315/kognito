import { test as setup } from '@playwright/test'
import { signUp } from './helpers'

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
  await signUp(page, 'E2E Nutzer')
  await page.context().storageState({ path: storageStatePath })
})
