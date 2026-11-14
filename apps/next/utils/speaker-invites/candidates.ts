import { getDefaultRegion, isValidRegion, REGION_LABELS, type Region } from '@my/app/config/regions'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'
import { isEligibleFor, isSpecificName, type InviteWhere, type InviteWho } from '@my/app/provider/dynamodb/invite-program-types'
import type { InviteCandidate } from '@my/app/features/speaker-invites/invitee-search'
import { listEcclesiasCached, type EcclesiaData } from '../dynamodb/locations'

/**
 * The composer's directory filter (docs/SPEAKER_INVITATIONS.md §3a).
 *
 *  - WHO (brethren / sisters / anyone) is a hard filter on recorded facts and
 *    never widens.
 *  - WHERE (our ecclesia / our region / anywhere) is where results come from
 *    first. When nothing inside it matches AND the typed name is specific (a
 *    first name plus the start of another word), matches from every region
 *    come back as `outside`, shown under "Outside {region}".
 */

/** The ecclesia's region: its own `region`, else the default for its country/province. */
export function regionOf(e: Pick<EcclesiaData, 'region' | 'country' | 'province'> | null | undefined): Region | undefined {
  if (!e) return undefined
  if (e.region && isValidRegion(e.region)) return e.region
  return e.country ? getDefaultRegion(e.country, e.province) : undefined
}

const norm = (name: string | undefined) => HOME_ECCLESIA.normalize(name ?? '').trim().toLowerCase()

/** ecclesia name → region, from the cached ecclesia list (one Query + BatchGet per 5 minutes). */
export async function ecclesiaRegions(): Promise<Map<string, Region>> {
  const map = new Map<string, Region>()
  const list = await listEcclesiasCached().catch(() => [] as EcclesiaData[])
  for (const e of list) {
    const r = regionOf(e)
    if (r) map.set(norm(e.name), r)
  }
  return map
}

export interface FilterContext {
  who: InviteWho
  where: InviteWhere
  /** The inviting ecclesia. */
  ecclesia: string
  /** Region per ecclesia name (normalized lowercase, see `ecclesiaRegions`). */
  regions: Map<string, Region>
}

export interface FilteredCandidates<T> {
  candidates: T[]
  outside: T[]
  /** The heading for `outside`, e.g. "Outside Canada East" / "Outside Example Ecclesia". */
  outsideLabel?: string
}

/** A directory match with the recorded facts the WHO filter needs. */
export type Facts = InviteCandidate

export function regionKey(name: string | undefined): string {
  return norm(name)
}

/**
 * Apply the program's filter to directory matches. Pure (tests).
 * `q` is the typed text: widening needs it to be a specific name.
 */
export function filterCandidates<T extends Facts>(list: T[], q: string, ctx: FilterContext): FilteredCandidates<T> {
  const eligible = list.filter((c) => isEligibleFor(ctx.who, c))
  if (ctx.where === 'anywhere') return { candidates: eligible, outside: [] }

  const home = norm(ctx.ecclesia)
  const homeRegion = ctx.regions.get(home)
  const inside = (c: T) => {
    const e = norm(c.ecclesia)
    if (ctx.where === 'ecclesia') return !!e && e === home
    return !!e && (e === home || (!!homeRegion && ctx.regions.get(e) === homeRegion))
  }
  const candidates = eligible.filter(inside)
  if (candidates.length > 0 || !isSpecificName(q)) return { candidates, outside: [] }
  const outside = eligible.filter((c) => !inside(c))
  const label = ctx.where === 'ecclesia' ? ctx.ecclesia : homeRegion ? REGION_LABELS[homeRegion] : 'our region'
  return { candidates, outside, ...(outside.length > 0 ? { outsideLabel: `Outside ${label}` } : {}) }
}
