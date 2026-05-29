/**
 * Cross-ecclesia News sharing resolution.
 *
 * Mirrors event-sharing-resolver.ts but for NewsItem. Default scope for News
 * is 'own' (ecclesia-local) — broader scopes ('region', 'global') are used
 * for major news that should reach nearby or all ecclesias.
 */

import type { NewsItem } from '@my/app/types/news'
import { isNewsActive } from '@my/app/types/news'
import type { SharingEcclesiaData } from '@my/app/services/event-sharing-resolver'
import { haversineDistance, DEFAULT_SHARING_RADIUS_KM } from '@my/app/utils/geo'

function canReceiveFrom(
  receiver: SharingEcclesiaData,
  sender: SharingEcclesiaData
): boolean {
  if (sender.sharingPreference === 'private') return false
  if (sender.excludedEcclesias?.includes(receiver.name)) return false
  if (receiver.excludedEcclesias?.includes(sender.name)) return false
  return true
}

function isWithinRadius(
  receiver: SharingEcclesiaData,
  sender: SharingEcclesiaData
): boolean {
  if (!receiver.latitude || !receiver.longitude) return true
  if (!sender.latitude || !sender.longitude) return true
  if (receiver.country && sender.country && receiver.country !== sender.country) return false
  const radius = receiver.sharingRadiusKm || DEFAULT_SHARING_RADIUS_KM
  const distance = haversineDistance(
    receiver.latitude,
    receiver.longitude,
    sender.latitude,
    sender.longitude
  )
  return distance <= radius
}

export interface NewsSharingInput {
  ecclesia: SharingEcclesiaData
  subscribedEcclesias: string[]
  allEcclesias: SharingEcclesiaData[]
  news: NewsItem[]
}

export interface ResolvedNewsFeed {
  ownNews: NewsItem[]
  subscribedNews: NewsItem[]
  nearbyNews: NewsItem[]
  globalNews: NewsItem[]
  allNews: NewsItem[]
}

export function resolveNewsFeed(input: NewsSharingInput): ResolvedNewsFeed {
  const { ecclesia, subscribedEcclesias, allEcclesias, news } = input

  const ecclesiaMap = new Map<string, SharingEcclesiaData>()
  for (const e of allEcclesias) ecclesiaMap.set(e.name, e)

  const nearbySet = new Set(ecclesia.nearbyEcclesias || [])
  const subscribedSet = new Set(subscribedEcclesias)
  const seen = new Set<string>()

  const ownNews: NewsItem[] = []
  const subscribedNews: NewsItem[] = []
  const nearbyNews: NewsItem[] = []
  const globalNews: NewsItem[] = []

  for (const item of news) {
    if (!isNewsActive(item)) continue
    if (!item.id || seen.has(item.id)) continue

    const senderName = item.ecclesiaId
    const scope = item.sharingScope

    if (senderName === ecclesia.name) {
      ownNews.push(item)
      seen.add(item.id)
      continue
    }

    if (subscribedSet.has(senderName) && scope !== 'own') {
      subscribedNews.push(item)
      seen.add(item.id)
      continue
    }

    if (nearbySet.has(senderName) && (scope === 'region' || scope === 'global')) {
      const sender = ecclesiaMap.get(senderName)
      if (
        sender &&
        sender.sharingPreference !== 'subscribers-only' &&
        canReceiveFrom(ecclesia, sender) &&
        isWithinRadius(ecclesia, sender)
      ) {
        nearbyNews.push(item)
        seen.add(item.id)
        continue
      }
    }

    if (scope === 'global') {
      const sender = ecclesiaMap.get(senderName)
      if (!sender || canReceiveFrom(ecclesia, sender)) {
        globalNews.push(item)
        seen.add(item.id)
        continue
      }
    }
  }

  const allResolved = [...ownNews, ...subscribedNews, ...nearbyNews, ...globalNews]
  allResolved.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )

  return { ownNews, subscribedNews, nearbyNews, globalNews, allNews: allResolved }
}
