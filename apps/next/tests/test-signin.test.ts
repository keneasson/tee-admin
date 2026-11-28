/**
 * Test sign-in (#349): gating by deployment, the key, who may be signed in as,
 * the audit record, and the existing dev key being locked off on production.
 * Placeholder data only.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const h = vi.hoisted(() => ({ getByEmail: vi.fn() }))
vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({
  personRepository: { getByEmail: h.getByEmail },
}))

import {
  devAuthKey,
  isPreviewOrLocal,
  isTestSigninEnabled,
  realAllowlist,
  recordTestSignin,
  resolveTestSigninTarget,
  safeEqual,
  testSigninOptions,
  verifyTestSigninKey,
} from '../utils/test-signin'
import { TEST_PERSONAS, isUndeliverableAddress } from '@my/app/utils/test-personas'
import { POST as devTokenPOST } from '../app/api/auth/dev-token/route'

const KEY = 'placeholder-test-key'

describe('gating by deployment', () => {
  it('is on for a preview build with the key set', () => {
    expect(isTestSigninEnabled({ VERCEL_ENV: 'preview', TEST_SIGNIN_KEY: KEY })).toBe(true)
  })
  it('is on for local development with the key set', () => {
    expect(isTestSigninEnabled({ NODE_ENV: 'development', TEST_SIGNIN_KEY: KEY })).toBe(true)
  })
  it('is OFF on production even when the key is set by mistake', () => {
    expect(isTestSigninEnabled({ VERCEL_ENV: 'production', TEST_SIGNIN_KEY: KEY })).toBe(false)
    expect(isPreviewOrLocal({ VERCEL_ENV: 'production', NODE_ENV: 'development' })).toBe(false)
    expect(verifyTestSigninKey(KEY, { VERCEL_ENV: 'production', TEST_SIGNIN_KEY: KEY })).toBe(false)
    expect(testSigninOptions({ VERCEL_ENV: 'production', TEST_SIGNIN_KEY: KEY })).toEqual({ enabled: false, personas: [] })
  })
  it('is OFF for a self-hosted production build with no VERCEL_ENV', () => {
    expect(isTestSigninEnabled({ NODE_ENV: 'production', TEST_SIGNIN_KEY: KEY })).toBe(false)
  })
  it('is OFF on a preview with no key set', () => {
    expect(isTestSigninEnabled({ VERCEL_ENV: 'preview' })).toBe(false)
    expect(testSigninOptions({ VERCEL_ENV: 'preview' }).enabled).toBe(false)
  })
})

describe('the key', () => {
  const env = { VERCEL_ENV: 'preview', TEST_SIGNIN_KEY: KEY }
  it('accepts the right key', () => expect(verifyTestSigninKey(KEY, env)).toBe(true))
  it('rejects a wrong, empty or missing key', () => {
    expect(verifyTestSigninKey('wrong', env)).toBe(false)
    expect(verifyTestSigninKey('', env)).toBe(false)
    expect(verifyTestSigninKey(undefined, env)).toBe(false)
    expect(verifyTestSigninKey(KEY + 'x', env)).toBe(false)
  })
  it('compares in constant time (equal-length digests, no length leak)', () => {
    expect(safeEqual('a', 'a')).toBe(true)
    expect(safeEqual('a', 'ab')).toBe(false)
  })
  it('the options the page receives never contain the key', () => {
    expect(JSON.stringify(testSigninOptions(env))).not.toContain(KEY)
    expect(testSigninOptions(env).personas).toHaveLength(TEST_PERSONAS.length)
  })
})

describe('who may be signed in as', () => {
  const env = { VERCEL_ENV: 'preview', TEST_SIGNIN_KEY: KEY }
  it('every test persona', () => {
    for (const p of TEST_PERSONAS) expect(resolveTestSigninTarget(p.email, env)).toEqual({ kind: 'persona', persona: p })
  })
  it('persona-only: a real-looking address is refused unless it is on the allowlist', () => {
    expect(resolveTestSigninTarget('someone@example.org', env)).toBeNull()
    expect(resolveTestSigninTarget('someone@example.org', { ...env, TEST_SIGNIN_REAL_ALLOWLIST: 'other@example.org' })).toBeNull()
    expect(resolveTestSigninTarget(' Someone@Example.org ', { ...env, TEST_SIGNIN_REAL_ALLOWLIST: 'a@example.org, someone@example.org' })).toEqual({
      kind: 'allowlisted',
      email: 'someone@example.org',
    })
    expect(realAllowlist({ TEST_SIGNIN_REAL_ALLOWLIST: ' A@x.org ,,b@x.org' })).toEqual(['a@x.org', 'b@x.org'])
  })
  it('every persona address is undeliverable (.invalid) and includes a test-ecclesia RB and Rep', () => {
    expect(TEST_PERSONAS.every((p) => isUndeliverableAddress(p.email))).toBe(true)
    expect(TEST_PERSONAS.filter((p) => p.office).map((p) => p.office).sort()).toEqual(['recording-brother', 'rep'])
  })
})

describe('audit record', () => {
  it('records who, when and which deployment as AUDIT#TEST_SIGNIN', async () => {
    const put = vi.fn(async (_item: Record<string, unknown>) => {})
    await recordTestSignin({ who: TEST_PERSONAS[0].email, kind: 'persona' }, { VERCEL_ENV: 'preview', VERCEL_URL: 'tee-admin-abc.vercel.app' }, put)
    const item = put.mock.calls[0][0]
    expect(item).toMatchObject({
      pkey: 'AUDIT#TEST_SIGNIN',
      who: TEST_PERSONAS[0].email,
      kind: 'persona',
      deployment: 'tee-admin-abc.vercel.app',
      vercelEnv: 'preview',
    })
    expect(String(item.skey)).toMatch(/^\d{4}-\d\d-\d\dT/)
    expect(typeof item.at).toBe('string')
  })
})

describe('the existing dev key is locked off on production', () => {
  const saved = { ...process.env }
  beforeEach(() => {
    h.getByEmail.mockResolvedValue({ primaryEmail: 'x@test-personas.invalid', displayName: 'X', role: 'member', personId: 'p1' })
  })
  afterEach(() => {
    process.env = { ...saved }
  })

  const call = (key: string) =>
    devTokenPOST({ json: async () => ({ key, email: 'x@test-personas.invalid' }) } as any)

  it('devAuthKey is undefined on production and the key elsewhere', () => {
    expect(devAuthKey({ VERCEL_ENV: 'production', DEV_AUTH_SERVER_KEY: 'k' })).toBeUndefined()
    expect(devAuthKey({ VERCEL_ENV: 'preview', DEV_AUTH_SERVER_KEY: 'k' })).toBe('k')
    expect(devAuthKey({ VERCEL_ENV: 'preview' })).toBeUndefined()
  })

  it('/api/auth/dev-token refuses on production even with the right key', async () => {
    process.env.VERCEL_ENV = 'production'
    process.env.DEV_AUTH_SERVER_KEY = 'dev-key'
    const res = await call('dev-key')
    expect(res.status).toBe(404)
    expect(h.getByEmail).not.toHaveBeenCalled()
  })

  it('/api/auth/dev-token still works off production, and a wrong key is 401', async () => {
    process.env.VERCEL_ENV = 'preview'
    process.env.DEV_AUTH_SERVER_KEY = 'dev-key'
    expect((await call('wrong')).status).toBe(401)
    const ok = await call('dev-key')
    expect(ok.status).toBe(200)
    expect((await ok.json()).access_token).toBeTruthy()
  })
})
