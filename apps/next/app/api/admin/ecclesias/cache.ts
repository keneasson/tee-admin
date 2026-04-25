/** Shared in-memory cache for ecclesia member counts */

import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'

let memberCountsCache: { counts: Record<string, number>; timestamp: number } | null = null
const COUNTS_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export async function getMemberCounts(ecclesiaNames: string[]): Promise<Record<string, number>> {
  const now = Date.now()
  if (memberCountsCache && (now - memberCountsCache.timestamp) < COUNTS_CACHE_TTL_MS) {
    return memberCountsCache.counts
  }

  // Parallel GSI2 COUNT queries — each reads only index metadata, no item data
  const entries = await Promise.all(
    ecclesiaNames.map(async (name) => {
      const count = await personRepository.countByEcclesia(name)
      return [name, count] as const
    })
  )

  const counts = Object.fromEntries(entries)
  memberCountsCache = { counts, timestamp: now }
  return counts
}

/** Invalidate the member counts cache (call after transfers or member changes) */
export function invalidateMemberCountsCache() {
  memberCountsCache = null
}
