import { describe, expect, it, vi } from 'vitest'

const getSession = vi.hoisted(() => vi.fn())

vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/auth', () => ({ getAuth: () => ({ api: { getSession } }) }))

const redirect = vi.hoisted(() =>
  vi.fn((to: string) => {
    throw new Error(`REDIRECT:${to}`)
  }),
)
vi.mock('next/navigation', () => ({ redirect }))

const { requireOwnerId, requireSession } = await import('@/lib/session')

describe('requireOwnerId', () => {
  it('returns the user id of the signed in user', async () => {
    getSession.mockResolvedValueOnce({ user: { id: 'user-1' } })
    await expect(requireOwnerId()).resolves.toBe('user-1')
  })

  it('throws without a session, rather than returning nothing', async () => {
    // A caller that forgot to check would otherwise write rows with an
    // undefined owner, which is the failure this guards against.
    getSession.mockResolvedValueOnce(null)
    await expect(requireOwnerId()).rejects.toThrow('Not authenticated')
  })
})

describe('requireSession', () => {
  it('sends anonymous visitors to the sign-in page', async () => {
    getSession.mockResolvedValueOnce(null)
    await expect(requireSession()).rejects.toThrow('REDIRECT:/sign-in')
    expect(redirect).toHaveBeenCalledWith('/sign-in')
  })

  it('returns the session when there is one', async () => {
    const session = { user: { id: 'user-1' } }
    getSession.mockResolvedValueOnce(session)
    await expect(requireSession()).resolves.toBe(session)
  })
})
