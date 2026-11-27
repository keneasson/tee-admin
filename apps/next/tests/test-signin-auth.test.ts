/**
 * Test sign-in (#349) through the real NextAuth config: the provider exists
 * only on preview/local, authorizes only the right key + a flagged persona,
 * writes the audit entry, and a Bearer dev token is refused on production.
 * Placeholder data only.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SignJWT } from 'jose'

const h = vi.hoisted(() => ({
  getByEmail: vi.fn(),
  getById: vi.fn(),
  headerGet: vi.fn(),
  nextAuthSession: vi.fn(async () => null),
  put: vi.fn(async (_cmd?: unknown) => {}),
}))

vi.mock('next-auth', () => ({
  default: vi.fn(() => ({ handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: h.nextAuthSession })),
}))
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  PutCommand: class {
    constructor(public input: unknown) {}
  },
  DynamoDBDocument: { from: vi.fn(() => ({})) },
}))
vi.mock('next/headers', () => ({ headers: async () => ({ get: h.headerGet }) }))
vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({
  personRepository: { getByEmail: h.getByEmail, getById: h.getById, getByEmailForAuth: vi.fn() },
}))
vi.mock('@my/app/provider/dynamodb/repositories/token-repository', () => ({ tokenRepository: {} }))
vi.mock('@my/app/provider/dynamodb/config', () => ({
  docClient: { send: h.put },
  tableNames: { admin: 'tee-admin' },
}))
vi.mock('../utils/sign-in-identity', () => ({ identityAtSignIn: vi.fn(async () => ({})), switchIdentity: vi.fn() }))
vi.mock('../utils/dynamodb/locations', () => ({ findRecordingBrotherEcclesia: vi.fn(), signInOfficeFlags: vi.fn() }))
vi.mock('../utils/dynamodb/set-user-role', () => ({ addUsersRoleToDB: vi.fn() }))
vi.mock('../utils/dynamodb/get-user', () => ({ getUserFromDynamoDB: vi.fn() }))
vi.mock('../utils/dynamodb/credentials-users', () => ({ findCredentialsUserByEmail: vi.fn() }))
vi.mock('../utils/password-signin', () => ({ verifyPasswordSignIn: vi.fn() }))
vi.mock('../utils/email/ecclesia-token', () => ({ verifyEcclesiaToken: vi.fn() }))
vi.mock('@my/app/provider/auth/get-user-from-legacy', () => ({
  getRoleFromLegacyUser: vi.fn(),
  getUserFromLegacyDirectory: vi.fn(),
}))

const KEY = 'placeholder-test-key'
const saved = { ...process.env }

async function loadAuth(env: Record<string, string | undefined>) {
  vi.resetModules()
  for (const k of ['VERCEL_ENV', 'TEST_SIGNIN_KEY', 'DEV_AUTH_SERVER_KEY', 'TEST_SIGNIN_REAL_ALLOWLIST']) delete process.env[k]
  Object.assign(process.env, env)
  return import('../utils/auth')
}

const testProvider = (mod: any) => mod.authOptions.providers.find((p: any) => p.id === 'test-signin' || p.options?.id === 'test-signin')
const authorize = (mod: any, creds: Record<string, string>) => {
  const p = testProvider(mod)
  return (p.options?.authorize ?? p.authorize)(creds)
}

beforeEach(() => {
  vi.clearAllMocks()
  h.getByEmail.mockImplementation(async (email: string) => ({
    personId: 'p-' + email,
    primaryEmail: email,
    displayName: 'Test Person',
    role: 'member',
    isTestPersona: email.endsWith('.invalid') ? true : undefined,
  }))
})
afterEach(() => {
  process.env = { ...saved }
})

describe('provider registration', () => {
  it('is registered on a preview with the key set', async () => {
    expect(testProvider(await loadAuth({ VERCEL_ENV: 'preview', TEST_SIGNIN_KEY: KEY }))).toBeTruthy()
  })
  it('does NOT exist on production, even with the key set', async () => {
    expect(testProvider(await loadAuth({ VERCEL_ENV: 'production', TEST_SIGNIN_KEY: KEY }))).toBeUndefined()
  })
  it('does not exist on a preview with no key', async () => {
    expect(testProvider(await loadAuth({ VERCEL_ENV: 'preview' }))).toBeUndefined()
  })
})

describe('authorize', () => {
  it('signs in a flagged persona with the right key, flags the session and writes the audit entry', async () => {
    const mod = await loadAuth({ VERCEL_ENV: 'preview', TEST_SIGNIN_KEY: KEY, VERCEL_URL: 'preview-abc.vercel.app' })
    const user = await authorize(mod, { email: 'owner@test-personas.invalid', key: KEY })
    expect(user).toMatchObject({ email: 'owner@test-personas.invalid', testSignin: true, assurance: 'authenticated' })
    const audit = (h.put.mock.calls[0][0] as any).input.Item
    expect(audit).toMatchObject({ pkey: 'AUDIT#TEST_SIGNIN', who: 'owner@test-personas.invalid', deployment: 'preview-abc.vercel.app' })
  })

  it('a wrong key fails and writes nothing', async () => {
    const mod = await loadAuth({ VERCEL_ENV: 'preview', TEST_SIGNIN_KEY: KEY })
    expect(await authorize(mod, { email: 'owner@test-personas.invalid', key: 'wrong' })).toBeNull()
    expect(h.put).not.toHaveBeenCalled()
  })

  it('persona-only: the right key does not open a real address unless allowlisted', async () => {
    const mod = await loadAuth({ VERCEL_ENV: 'preview', TEST_SIGNIN_KEY: KEY })
    expect(await authorize(mod, { email: 'someone@example.org', key: KEY })).toBeNull()
    const allowed = await loadAuth({ VERCEL_ENV: 'preview', TEST_SIGNIN_KEY: KEY, TEST_SIGNIN_REAL_ALLOWLIST: 'someone@example.org' })
    expect(await authorize(allowed, { email: 'someone@example.org', key: KEY })).toMatchObject({ testSignin: true })
  })

  it('refuses a persona address whose record is not flagged isTestPersona', async () => {
    h.getByEmail.mockResolvedValue({ personId: 'p', primaryEmail: 'owner@test-personas.invalid', role: 'owner' })
    const mod = await loadAuth({ VERCEL_ENV: 'preview', TEST_SIGNIN_KEY: KEY })
    expect(await authorize(mod, { email: 'owner@test-personas.invalid', key: KEY })).toBeNull()
  })

  it('refuses when the audit entry cannot be written', async () => {
    h.put.mockRejectedValueOnce(new Error('down'))
    const mod = await loadAuth({ VERCEL_ENV: 'preview', TEST_SIGNIN_KEY: KEY })
    expect(await authorize(mod, { email: 'owner@test-personas.invalid', key: KEY })).toBeNull()
  })
})

describe('session flag and Bearer dev tokens', () => {
  it('the session carries testSignin from the token', async () => {
    const mod = await loadAuth({ VERCEL_ENV: 'preview', TEST_SIGNIN_KEY: KEY })
    const session: any = await mod.authOptions.callbacks!.session!({ session: { user: { email: 'x' } }, token: { role: 'member', testSignin: true } } as any)
    expect(session.user.testSignin).toBe(true)
    const plain: any = await mod.authOptions.callbacks!.session!({ session: { user: { email: 'x' } }, token: { role: 'member' } } as any)
    expect(plain.user.testSignin).toBe(false)
  })

  it('a test session is void on production (jwt returns null)', async () => {
    const mod = await loadAuth({ VERCEL_ENV: 'production' })
    const out = await (mod.authOptions.callbacks!.jwt as any)({ token: { testSignin: true, email: 'x@test-personas.invalid' } })
    expect(out).toBeNull()
  })

  const bearer = async (key: string) => {
    const token = await new SignJWT({ email: 'dev@test-personas.invalid', name: 'Dev', role: 'owner' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(key))
    h.headerGet.mockImplementation((n: string) => (n === 'authorization' ? `Bearer ${token}` : null))
  }

  it('a valid Bearer dev token is accepted off production', async () => {
    const mod = await loadAuth({ VERCEL_ENV: 'preview', DEV_AUTH_SERVER_KEY: 'dev-key' })
    await bearer('dev-key')
    expect(await mod.auth()).toMatchObject({ user: { email: 'dev@test-personas.invalid', role: 'owner' } })
  })

  it('the same Bearer token is REFUSED on production', async () => {
    const mod = await loadAuth({ VERCEL_ENV: 'production', DEV_AUTH_SERVER_KEY: 'dev-key' })
    await bearer('dev-key')
    expect(await mod.auth()).toBeNull()
    expect(h.nextAuthSession).toHaveBeenCalled()
  })
})
