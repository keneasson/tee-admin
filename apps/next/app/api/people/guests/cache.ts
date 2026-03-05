/** In-memory cache for the guest users list */

interface GuestListItem {
  id: string
  email: string
  name: string
  lastName: string
  ecclesia?: string
  createdAt: string
}

interface CachedGuests {
  guests: GuestListItem[]
  timestamp: number
}

let guestCache: CachedGuests | null = null

export const GUEST_CACHE_TTL_MS = 2 * 60 * 1000 // 2 minutes

export function getCachedGuests(): CachedGuests | null {
  return guestCache
}

export function setCachedGuests(data: CachedGuests) {
  guestCache = data
}

/** Invalidate the guest list cache (call after role changes) */
export function invalidateGuestCache() {
  guestCache = null
}
