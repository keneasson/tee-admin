// Tenant identity per request. Resolves the incoming Host header to
// a TenantConfig that downstream code uses to decide outbound-mail
// sender, brand, etc. Must stay Edge-safe (no Node imports) so the
// Next.js middleware can import it.

export type TenantId = 'tee' | 'echadhub'

export interface TenantConfig {
  id: TenantId
  /** Bare-domain part of the canonical sender address (no `@`) */
  senderDomain: string
  /** Display name used as the From-name on outbound mail */
  senderDisplayName: string
  /** Public-facing name used in email subjects / newsletter chrome. */
  publicName: string
  /**
   * The ecclesia this domain represents, used to scope newsletter/email
   * content. `null` for the hub (echadhub.org), which has no single ecclesia.
   */
  homeEcclesiaName: string | null
}

const TENANTS: Record<TenantId, TenantConfig> = {
  tee: {
    id: 'tee',
    senderDomain: 'tee-admin.com',
    senderDisplayName: 'Toronto East Ecclesia',
    publicName: 'Toronto East Christadelphians',
    homeEcclesiaName: 'Toronto East Ecclesia',
  },
  echadhub: {
    id: 'echadhub',
    senderDomain: 'echadhub.org',
    senderDisplayName: 'Echad Hub',
    publicName: 'Echad Hub',
    homeEcclesiaName: null,
  },
}

const HOST_TO_TENANT: Record<string, TenantId> = {
  'tee-admin.com': 'tee',
  'www.tee-admin.com': 'tee',
  'echadhub.org': 'echadhub',
  'www.echadhub.org': 'echadhub',
  'echadhub.com': 'echadhub',
  'www.echadhub.com': 'echadhub',
}

/**
 * Resolve a Host header value to a TenantConfig. Returns null when
 * the host is unknown — callers decide whether to fall back to a
 * deployment-scoped default or refuse to proceed (e.g. email send
 * should refuse rather than silently default to TEE).
 *
 * Handles port suffixes (`localhost:3000`) and casing.
 */
export function getTenantByHost(host: string | null | undefined): TenantConfig | null {
  if (!host) return null
  const cleanHost = host.split(':')[0]?.toLowerCase()
  if (!cleanHost) return null
  const tenantId = HOST_TO_TENANT[cleanHost]
  return tenantId ? TENANTS[tenantId] : null
}

/**
 * Look up a TenantConfig by its TenantId. Used when the deployment
 * is identified by env var (e.g. cron jobs without a request context)
 * rather than by Host header.
 */
export function getTenantById(id: TenantId): TenantConfig {
  return TENANTS[id]
}

/**
 * Resolve the tenant for the current deployment from server-side env
 * vars. Used as a fallback when no request context is available
 * (e.g. background jobs entered without an HTTP request frame).
 * Reads DEPLOYMENT_NAME — set per-Vercel-project. Defaults to 'tee'
 * when unset, matching the legacy single-tenant behavior of
 * tee-admin deploys that pre-date this env var.
 */
export function resolveTenantFromEnv(): TenantConfig {
  const id = process.env.DEPLOYMENT_NAME as TenantId | undefined
  if (id === 'echadhub') return TENANTS.echadhub
  return TENANTS.tee
}

/**
 * Resolve a TenantConfig from headers (request or response Headers,
 * Pages-Router-style plain object, or anything with a `.get()` /
 * indexable shape). Reads `x-tenant-id` first (set by middleware),
 * falls back to host-based resolution.
 */
export function getTenantFromHeaders(
  headers: { get(name: string): string | null } | Record<string, string | string[] | undefined>
): TenantConfig | null {
  const get = (name: string): string | null => {
    if (typeof (headers as { get?: unknown }).get === 'function') {
      return (headers as { get(n: string): string | null }).get(name)
    }
    const v = (headers as Record<string, string | string[] | undefined>)[name]
    if (Array.isArray(v)) return v[0] ?? null
    return v ?? null
  }

  const tenantId = get('x-tenant-id')
  if (tenantId && (tenantId === 'tee' || tenantId === 'echadhub')) {
    return TENANTS[tenantId]
  }
  return getTenantByHost(get('host'))
}
