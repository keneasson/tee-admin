/**
 * A2: each admin route group's layout is a server-side role gate.
 * Signed out → sign-in with a callbackUrl; wrong role → home; right role → renders.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  path: '/admin/somewhere?x=1' as string | null,
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

vi.mock('@/utils/auth', () => ({ auth: h.auth }))
vi.mock('next/navigation', () => ({ redirect: h.redirect }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers(h.path ? { 'x-pathname': h.path } : {}),
}))

import OwnerLayout from '../app/admin/(owner)/layout'
import AdminPlusLayout from '../app/admin/(admin-plus)/layout'
import RepPlusLayout from '../app/admin/(rep-plus)/layout'

type User = { email: string; role: string; isRecordingBrother?: boolean }
const as = (user: User | null) => h.auth.mockResolvedValue(user ? { user, expires: 'x' } : null)

const signedOut = null
const guest: User = { email: 'g@example.test', role: 'guest' }
const member: User = { email: 'm@example.test', role: 'member' }
const rb: User = { email: 'rb@example.test', role: 'member', isRecordingBrother: true }
const rep: User = { email: 'rep@example.test', role: 'rep' }
const admin: User = { email: 'a@example.test', role: 'admin' }
const owner: User = { email: 'o@example.test', role: 'owner' }

const CHILD = 'page-content'

async function render(layout: (p: { children: any }) => Promise<any>): Promise<string> {
  try {
    const out = await layout({ children: CHILD })
    return out === CHILD ? 'RENDER' : `UNEXPECTED:${String(out)}`
  } catch (e) {
    return (e as Error).message
  }
}

const SIGN_IN = `REDIRECT:/auth/signin?callbackUrl=${encodeURIComponent('/admin/somewhere?x=1')}`
const HOME = 'REDIRECT:/'

const cases: Array<[string, (p: { children: any }) => Promise<any>, Array<[string, User | null, string]>]> = [
  [
    '(owner)',
    OwnerLayout,
    [
      ['signed out', signedOut, SIGN_IN],
      ['member', member, HOME],
      ['admin', admin, HOME],
      ['owner', owner, 'RENDER'],
    ],
  ],
  [
    '(admin-plus)',
    AdminPlusLayout,
    [
      ['signed out', signedOut, SIGN_IN],
      ['guest', guest, HOME],
      ['member', member, HOME],
      ['recording brother', rb, HOME],
      ['rep', rep, HOME],
      ['admin', admin, 'RENDER'],
      ['owner', owner, 'RENDER'],
    ],
  ],
  [
    '(rep-plus)',
    RepPlusLayout,
    [
      ['signed out', signedOut, SIGN_IN],
      ['guest', guest, HOME],
      ['member', member, HOME],
      ['recording brother', rb, 'RENDER'],
      ['rep', rep, 'RENDER'],
      ['admin', admin, 'RENDER'],
      ['owner', owner, 'RENDER'],
    ],
  ],
]

describe('admin route group layouts', () => {
  beforeEach(() => {
    h.auth.mockReset()
    h.redirect.mockClear()
    h.path = '/admin/somewhere?x=1'
  })

  for (const [group, layout, rows] of cases) {
    describe(group, () => {
      for (const [who, user, expected] of rows) {
        it(`${who} → ${expected === 'RENDER' ? 'renders' : expected}`, async () => {
          as(user)
          expect(await render(layout)).toBe(expected)
        })
      }
    })
  }

  it('signed out with no known path falls back to callbackUrl=/', async () => {
    h.path = null
    as(null)
    expect(await render(AdminPlusLayout)).toBe(
      `REDIRECT:/auth/signin?callbackUrl=${encodeURIComponent('/')}`
    )
  })

  for (const bad of ['https://evil.example', '//evil.example']) {
    it(`ignores a non-relative path header ${bad} (no open redirect)`, async () => {
      h.path = bad
      as(null)
      expect(await render(OwnerLayout)).toBe(
        `REDIRECT:/auth/signin?callbackUrl=${encodeURIComponent('/')}`
      )
    })
  }
})
