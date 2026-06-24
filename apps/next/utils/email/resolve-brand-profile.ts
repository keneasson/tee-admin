import { getEcclesiaByName, type EcclesiaData } from '@/utils/dynamodb/locations'
import {
  getTenantByHost,
  resolveTenantFromEnv,
  type TenantConfig,
} from '@my/app/config/tenants'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'
import type { BrandProfile } from '@my/app/types/brand-profile'

/**
 * Toronto East defaults — the no-regression fallback. These match the values
 * that were previously hardcoded in the email Footer and subjects, so any path
 * that can't resolve a richer profile still renders exactly as before.
 */
const TEE_DEFAULT: BrandProfile = {
  ecclesiaName: HOME_ECCLESIA.canonicalName, // 'Toronto East Ecclesia'
  displayName: 'Toronto East Ecclesia',
  publicName: HOME_ECCLESIA.publicName, // 'Toronto East Christadelphians'
  addressLines: ['975 Cosburn Avenue', 'Toronto, On M4C 2W8', 'Canada'],
}

function addressLinesFromEcclesia(e: EcclesiaData): string[] | undefined {
  const cityLine = [e.city, e.province, e.postalCode].filter(Boolean).join(', ')
  const lines = [e.address, cityLine, e.country].filter(Boolean) as string[]
  return lines.length ? lines : undefined
}

function brandProfileFromEcclesia(e: EcclesiaData): BrandProfile {
  const isHome = HOME_ECCLESIA.isHomeEcclesia(e.name)
  return {
    ecclesiaName: e.name,
    displayName: e.name,
    // Toronto East keeps its established public name; others use their own.
    publicName: isHome ? HOME_ECCLESIA.publicName : e.name,
    // Fall back to the known TEE address for the home ecclesia so its footer
    // never regresses if the DB record is missing address fields.
    addressLines: addressLinesFromEcclesia(e) ?? (isHome ? TEE_DEFAULT.addressLines : undefined),
    website: e.website,
    logoUrl: e.logoUrl,
  }
}

/**
 * Resolve the BrandProfile for an outbound email / newsletter.
 *
 * - `ownerEcclesiaName` — the ecclesia/org the content belongs to (e.g. a news
 *   item's `ecclesiaId`). When given, sourced from its EcclesiaData record.
 * - Otherwise the deployment domain's ecclesia is used (tee → Toronto East;
 *   the hub has none → generic Echad Hub identity).
 * - Final fallback is Toronto East so existing TEE sends never regress.
 */
export async function resolveBrandProfile(opts: {
  ownerEcclesiaName?: string | null
  tenant?: TenantConfig | null
  host?: string | null
} = {}): Promise<BrandProfile> {
  const tenant =
    opts.tenant ??
    (opts.host ? getTenantByHost(opts.host) : null) ??
    resolveTenantFromEnv()

  const ownerName =
    opts.ownerEcclesiaName?.trim() || tenant.homeEcclesiaName || null

  if (ownerName) {
    try {
      const ecclesia = await getEcclesiaByName(ownerName)
      if (ecclesia) return brandProfileFromEcclesia(ecclesia)
    } catch (e) {
      console.error('resolveBrandProfile: ecclesia lookup failed for', ownerName, e)
    }
    // Named owner but no DB record / lookup failed — minimal profile from the
    // name (home ecclesia still falls back to full TEE defaults).
    if (HOME_ECCLESIA.isHomeEcclesia(ownerName)) return TEE_DEFAULT
    return { ecclesiaName: ownerName, displayName: ownerName, publicName: ownerName }
  }

  // No owning ecclesia (the hub). Generic tenant identity, no postal address.
  return {
    ecclesiaName: tenant.publicName,
    displayName: tenant.senderDisplayName,
    publicName: tenant.publicName,
  }
}
