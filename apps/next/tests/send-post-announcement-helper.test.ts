import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// `get-data` reads the native API base URL from expo-constants, which drags the
// whole react-native (Flow-typed) module graph into a plain-node test env. The
// web path uses NEXT_PUBLIC_API_PATH, so a stub is enough here. (vi.mock is
// hoisted above the imports by vitest, so the static import below is safe.)
vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: {} } } }))

import { sendPostAnnouncement } from '@my/app/provider/get-data'

/**
 * The send call moved behind the shared data provider (ADR-0003) so the API
 * origin is decided in one place instead of by a relative-URL `fetch`. These
 * guard the safety-critical part of that move: TEST REMAINS THE DEFAULT, and a
 * live send still requires an explicit opt-out.
 *
 * The server re-checks all of this (auth, CONSOLIDATED_CMS, `ready`, tenant,
 * and the test/live flag) — the helper is transport, not the guard. That is
 * exactly why it must not quietly widen the default.
 */
describe('sendPostAnnouncement — test-by-default across the data seam', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ test: true, sentCount: 1, skippedCount: 0 }),
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const bodyOf = () => JSON.parse(fetchMock.mock.calls[0][1].body)

  it('sends test:true when `test` is omitted', async () => {
    await sendPostAnnouncement('p1', { list: 'newsletter' })
    expect(bodyOf().test).toBe(true)
  })

  it('sends test:true when `test` is explicitly true', async () => {
    await sendPostAnnouncement('p1', { test: true, list: 'newsletter' })
    expect(bodyOf().test).toBe(true)
  })

  it('only an explicit `test: false` opts into a live send', async () => {
    await sendPostAnnouncement('p1', { test: false, list: 'newsletter' })
    expect(bodyOf().test).toBe(false)
  })

  it('POSTs to the send route with the chosen audience, id encoded', async () => {
    await sendPostAnnouncement('a/b', { list: 'interEcclesia' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('api/admin/posts/a%2Fb/send')
    expect(init.method).toBe('POST')
    expect(bodyOf().list).toBe('interEcclesia')
  })

  it('surfaces the server error message rather than a bare status', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: 'Post is not ready to send (status: draft).' }),
    })
    await expect(sendPostAnnouncement('p1', { list: 'newsletter' })).rejects.toThrow(
      'Post is not ready to send (status: draft).'
    )
  })
})
