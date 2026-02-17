/** Shared in-memory cache for the people list API */

interface MemberListItem {
  email: string
  name: string
  lastName: string
  ecclesia?: string
}

interface CachedMembers {
  members: MemberListItem[]
  ecclesias: string[]
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
