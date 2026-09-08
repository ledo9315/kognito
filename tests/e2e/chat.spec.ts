import { expect, test, type Page } from '@playwright/test'
import { createNotebook } from './helpers'

/**
 * The route itself is covered by unit tests against a mock model. Here the
 * model is replaced at the network boundary instead, so the browser gets a
 * real streamed response without the run needing a gateway key or costing
 * anything.
 */
async function answerWith(
  page: Page,
  words: string[],
  // Gets the source ids the browser asked with, because a citation has to
  // point at the source that is really in the notebook.
  citationsFor: (sourceIds: string[]) => unknown[] = () => [],
) {
  await page.route('**/api/chat', async (route) => {
    const sent = JSON.parse(route.request().postData() ?? '{}')
    const chunks = [
      { type: 'start', messageMetadata: { citations: citationsFor(sent.sourceIds ?? []) } },
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
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()
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

test('a citation becomes a chip, an invented number stays text', async ({
  page,
}) => {
  await createNotebook(page, `Beleg ${Date.now()}`)
  await addTextSource(page, 'Der nächste Termin ist der 17. März.')
  await answerWith(
    page,
    ['Der Termin steht [1], der Rest nicht [9].'],
    ([sourceId]) => [
      {
        index: 1,
        chunkId: 'chunk-1',
        sourceId,
        quote: 'Der nächste Termin ist der 17. März.',
        charStart: 0,
        charEnd: 3,
      },
    ],
  )

  await page.getByRole('textbox', { name: 'Frage eingeben' }).fill('Wann?')
  await page.getByRole('button', { name: 'Frage senden' }).click()

  const chat = page.getByRole('main')
  await expect(chat.getByRole('button', { name: 'Beleg 1 anzeigen' })).toBeVisible({
    timeout: 15_000,
  })
  // Nothing to point at, so it is left where the model put it.
  await expect(chat.getByText('[9]')).toBeVisible()
  await expect(chat.getByRole('button', { name: 'Beleg 9 anzeigen' })).toHaveCount(0)
})

test('clicking a citation opens the source at the cited passage', async ({
  page,
}) => {
  const sourceText =
    'Erster Satz, nur zum Auffuellen. Der Termin ist der 17. Maerz. Und ein dritter Satz zum Schluss.'
  const cited = 'Der Termin ist der 17. Maerz.'
  const charStart = sourceText.indexOf(cited)

  await createNotebook(page, `Sprung ${Date.now()}`)
  await addTextSource(page, sourceText)
  await answerWith(
    page,
    ['Der Termin steht fest [1].'],
    ([sourceId]) => [
      {
        index: 1,
        chunkId: 'chunk-1',
        sourceId,
        quote: cited,
        charStart,
        charEnd: charStart + cited.length,
      },
    ],
  )

  await page.getByRole('textbox', { name: 'Frage eingeben' }).fill('Wann?')
  await page.getByRole('button', { name: 'Frage senden' }).click()

  const chat = page.getByRole('main')
  await chat.getByRole('button', { name: 'Beleg 1 anzeigen' }).click({
    timeout: 15_000,
  })

  // The reader is open on the right, and the marked text is exactly the
  // passage the citation points at, not the whole source.
  const marked = page.locator('[data-slot="cited-passage"]').first()
  await expect(marked).toBeVisible()
  await expect(marked).toHaveText(cited)

  // Back to the chat, with the answer still there.
  await page.getByRole('button', { name: 'Quelle schließen' }).first().click()
  await expect(page.locator('[data-slot="cited-passage"]')).toHaveCount(0)
  await expect(chat.getByRole('button', { name: 'Beleg 1 anzeigen' })).toBeVisible()
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

test('a rate limit says so, instead of the general failure', async ({ page }) => {
  await createNotebook(page, `Limit ${Date.now()}`)
  await addTextSource(page, 'Eine Quelle mit Inhalt.')

  // The shape the route really sends: the reason as json, so the interface
  // reads a refusal and a failed stream the same way.
  const reason = JSON.stringify({
    error:
      'Das Modell ist gerade ausgelastet oder das Limit ist erreicht. Bitte versuche es in ein paar Minuten noch einmal.',
  })

  await page.route('**/api/chat', (route) =>
    route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'x-vercel-ai-ui-message-stream': 'v1',
      },
      body:
        'data: {"type":"start"}\n\n' +
        `data: ${JSON.stringify({ type: 'error', errorText: reason })}\n\n` +
        'data: [DONE]\n\n',
    }),
  )

  await page.getByRole('textbox', { name: 'Frage eingeben' }).fill('Und jetzt?')
  await page.getByRole('button', { name: 'Frage senden' }).click()

  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'in ein paar Minuten',
  )
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
