import { expect, test, type Page } from '@playwright/test'
import { createNotebook } from './helpers'

/**
 * The route itself is covered by unit tests against a mock model. Here the
 * model is replaced at the network boundary instead, so the browser gets a
 * real streamed response without the run needing a gateway key or costing
 * anything.
 */
async function answerWith(page: Page, words: string[]) {
  await page.route('**/api/chat', async (route) => {
    const chunks = [
      { type: 'start' },
      { type: 'text-start', id: '0' },
      ...words.map((delta) => ({ type: 'text-delta', id: '0', delta })),
      { type: 'text-end', id: '0' },
      { type: 'finish' },
    ]

    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'x-vercel-ai-ui-message-stream': 'v1',
      },
      body:
        chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('') +
        'data: [DONE]\n\n',
    })
  })
}

async function addTextSource(page: Page, text: string) {
  await page.locator('[data-slot="dialog-trigger"]').click()
  await page.getByRole('tab', { name: 'Text' }).click()
  await page.getByLabel('Text einfügen').fill(text)
  await page.getByRole('button', { name: 'Text hinzufügen' }).click()

  // Asking before the source is stored means asking without a source.
  await expect(page.getByText('1/1')).toBeVisible({ timeout: 20_000 })
}

test('an answer arrives and is written into the chat', async ({ page }) => {
  await createNotebook(page, `Chat ${Date.now()}`)
  await addTextSource(page, 'Der nächste Termin ist der 17. März.')
  await answerWith(page, ['Der Termin ', 'ist der 17. März.'])

  await page.getByRole('textbox', { name: 'Frage eingeben' }).fill('Wann geht es weiter?')
  await page.getByRole('button', { name: 'Frage senden' }).click()

  await expect(page.getByText('Wann geht es weiter?').first()).toBeVisible()
  await expect(page.getByText('Der Termin ist der 17. März.').first()).toBeVisible({
    timeout: 15_000,
  })
})

test('the question is sent with the selected sources', async ({ page }) => {
  await createNotebook(page, `Auswahl ${Date.now()}`)
  await addTextSource(page, 'Eine Quelle mit Inhalt.')
  await answerWith(page, ['Antwort.'])

  const request = page.waitForRequest('**/api/chat')
  await page.getByRole('button', { name: /Fasse die Kernaussagen/ }).click()

  const body = JSON.parse((await request).postData() ?? '{}')
  expect(body.sourceIds).toHaveLength(1)
  expect(body.notebookId).toMatch(/^[0-9a-f-]{36}$/)
})

test('a model that fails mid-stream says so instead of staying empty', async ({
  page,
}) => {
  await createNotebook(page, `Ausfall ${Date.now()}`)
  await addTextSource(page, 'Eine Quelle mit Inhalt.')

  await page.route('**/api/chat', (route) =>
    route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'x-vercel-ai-ui-message-stream': 'v1',
      },
      body:
        'data: {"type":"start"}\n\n' +
        'data: {"type":"error","errorText":"Das Modell hat nicht geantwortet."}\n\n' +
        'data: [DONE]\n\n',
    }),
  )

  await page.getByRole('textbox', { name: 'Frage eingeben' }).fill('Und jetzt?')
  await page.getByRole('button', { name: 'Frage senden' }).click()

  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Die Antwort konnte nicht geladen werden.',
  )
  await expect(page.getByRole('main').getByRole('button', { name: 'Kopieren' })).toHaveCount(0)
})

test('a refusal from the route is shown instead of an answer', async ({
  page,
}) => {
  await createNotebook(page, `Fehler ${Date.now()}`)
  await addTextSource(page, 'Eine Quelle mit Inhalt.')

  await page.route('**/api/chat', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Wähle mindestens eine Quelle aus.' }),
    }),
  )

  await page.getByRole('textbox', { name: 'Frage eingeben' }).fill('Und jetzt?')
  await page.getByRole('button', { name: 'Frage senden' }).click()

  // Scoped to the chat: Next's route announcer carries the same role.
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Wähle mindestens eine Quelle aus.',
  )
})
