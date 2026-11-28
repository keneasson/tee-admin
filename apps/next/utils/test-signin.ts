/**
 * Test sign-in (#349): sign in as a made-up test person on a preview build.
 *
 * ON only when the deployment is a Vercel PREVIEW, or local development
 * (no VERCEL_ENV and NODE_ENV is not production), AND `TEST_SIGNIN_KEY` is
 * set. On production (`VERCEL_ENV === 'production'`) every function here says
 * "off" whatever else is set, so setting the key there by mistake does nothing.
 *
 * The key is only ever compared on the server and never sent to the client.
 */
import { TEST_PERSONAS, findTestPersonaByEmail, type TestPersona } from '@my/app/utils/test-personas'

type Env = Record<string, string | undefined>

/** Production deployment (tee-admin.com, echadhub.org). */
export function isProductionDeployment(env: Env = process.env): boolean {
  return env.VERCEL_ENV === 'production'
}

/** A preview build, or local development. Never production. */
export function isPreviewOrLocal(env: Env = process.env): boolean {
  if (isProductionDeployment(env)) return false
  if (env.VERCEL_ENV === 'preview') return true
  return !env.VERCEL_ENV && env.NODE_ENV !== 'production'
}

/** Is the "Test sign-in" box (and its provider) available here? */
export function isTestSigninEnabled(env: Env = process.env): boolean {
  return isPreviewOrLocal(env) && !!env.TEST_SIGNIN_KEY
}

/**
 * Dev key (`DEV_AUTH_SERVER_KEY`: /api/auth/dev-token and Bearer tokens).
 * Returns the key, or undefined when it must not work: unset, or production.
 */
export function devAuthKey(env: Env = process.env): string | undefined {
  if (isProductionDeployment(env)) return undefined
  return env.DEV_AUTH_SERVER_KEY || undefined
}

/**
 * Constant-time string comparison. Plain JS, no `node:crypto`: auth.ts (which
 * imports this) is also bundled where Node built-ins aren't available. Walks
 * the longer length every time and folds the length difference in, so neither
 * content nor length short-circuits.
 */
export function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length)
  let diff = a.length ^ b.length
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return diff === 0
}

export function verifyTestSigninKey(given: unknown, env: Env = process.env): boolean {
  if (!isTestSigninEnabled(env)) return false
  if (typeof given !== 'string' || given.length === 0) return false
  return safeEqual(given, env.TEST_SIGNIN_KEY as string)
}

/** Real addresses the owner may use as himself on a preview (`TEST_SIGNIN_REAL_ALLOWLIST`, comma separated). */
export function realAllowlist(env: Env = process.env): string[] {
  return (env.TEST_SIGNIN_REAL_ALLOWLIST || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export type TestSigninTarget =
  | { kind: 'persona'; persona: TestPersona }
  | { kind: 'allowlisted'; email: string }

/**
 * Who may be signed in as: a listed test persona, or (only when allowlisted)
 * a real address. Anything else is refused: the key alone never opens a real
 * person's account.
 */
export function resolveTestSigninTarget(email: unknown, env: Env = process.env): TestSigninTarget | null {
  if (typeof email !== 'string') return null
  const e = email.trim().toLowerCase()
  const persona = findTestPersonaByEmail(e)
  if (persona) return { kind: 'persona', persona }
  if (e && realAllowlist(env).includes(e)) return { kind: 'allowlisted', email: e }
  return null
}

/** What the sign-in page may show: names only, never the key. */
export function testSigninOptions(env: Env = process.env): { enabled: boolean; personas: Array<{ email: string; label: string }> } {
  if (!isTestSigninEnabled(env)) return { enabled: false, personas: [] }
  return { enabled: true, personas: TEST_PERSONAS.map((p) => ({ email: p.email, label: p.label })) }
}

/** The deployment this sign-in happened on (for the audit record). */
export function deploymentLabel(env: Env = process.env): string {
  return env.VERCEL_URL || env.VERCEL_ENV || 'local'
}

/**
 * Record one test sign-in as an `AUDIT#TEST_SIGNIN` item (no existing audit
 * log pattern in this codebase). Who (persona or allowlisted address), when,
 * which deployment. Written by the sign-in provider; if the write fails the
 * sign-in is refused.
 */
export async function recordTestSignin(
  entry: { who: string; kind: TestSigninTarget['kind'] },
  env: Env = process.env,
  put?: (item: Record<string, unknown>) => Promise<void>
): Promise<void> {
  const at = new Date().toISOString()
  const item = {
    pkey: 'AUDIT#TEST_SIGNIN',
    skey: `${at}#${Math.random().toString(36).slice(2, 8)}`,
    type: 'AUDIT_TEST_SIGNIN',
    who: entry.who,
    kind: entry.kind,
    at,
    deployment: deploymentLabel(env),
    vercelEnv: env.VERCEL_ENV || 'local',
    gitRef: env.VERCEL_GIT_COMMIT_REF || undefined,
  }
  if (put) return put(item)
  const [{ PutCommand }, { docClient, tableNames }] = await Promise.all([
    import('@aws-sdk/lib-dynamodb'),
    import('@my/app/provider/dynamodb/config'),
  ])
  await docClient.send(new PutCommand({ TableName: tableNames.admin, Item: item }))
}
