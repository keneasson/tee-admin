/** Shared in-memory cache for the people list API */

interface MemberListItem {
  id: string
  email: string
  name: string
  lastName: string
  ecclesia?: string
}

interface GuestCountEntry {
  ecclesia: string | undefined
  count: number
}

interface CachedMembers {
  members: MemberListItem[]
  ecclesias: string[]
  /** Per-ecclesia guest counts for recorder filtering, plus a total for admin/owner */
  guestCounts: GuestCountEntry[]
  guestTotal: number
  timestamp: number
}

let membersCache: CachedMembers | null = null

export const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export function getCachedMembers(): CachedMembers | null {
  return membersCache
}

export function setCachedMembers(data: CachedMembers) {
  membersCache = data
}

/** Invalidate the people list cache (call after admin edits) */
export function invalidatePeopleCache() {
  membersCache = null
}
