/**
 * Notify Recording Brothers of shared events.
 *
 * When an event is activated with a sharing scope beyond 'own',
 * the RBs of recipient ecclesias get in-app notifications.
 *
 * This is Next.js-specific (uses getEcclesiaByName, getAllEcclesia).
 */

import type { Event, EventType } from '@my/app/types/events'
import { getEffectiveSharingScope } from '@my/app/services/event-sharing-resolver'
import { notificationRepository } from '@my/app/provider/dynamodb/repositories/notification-repository'
import { buildEventSharedNotification } from '@my/app/provider/dynamodb/repositories/notification-helpers'
import { getAllEcclesia, type EcclesiaData } from '@/utils/dynamodb/locations'
import { haversineDistance, DEFAULT_SHARING_RADIUS_KM } from '@my/app/utils/geo'

/** Event types considered "major" for rbAlertPreference filtering */
const MAJOR_EVENT_TYPES: Set<EventType> = new Set([
  'baptism',
  'funeral',
  'wedding',
  'engagement',
  'study-weekend',
])

function isMajorEventType(type: EventType): boolean {
  return MAJOR_EVENT_TYPES.has(type)
}

/**
 * Should this ecclesia be notified about the given event?
 * Checks rbAlertPreference, sharing scope, distance, and exclusions.
 */
function shouldNotifyEcclesia(
  recipient: EcclesiaData,
  hostingEcclesia: EcclesiaData,
  event: Event,
  scope: 'region' | 'global'
): boolean {
  // Check RB alert preference
  const pref = recipient.rbAlertPreference || 'all'
  if (pref === 'none') return false
  if (pref === 'major' && !isMajorEventType(event.type)) return false

  // Must have an RB email to notify
  if (!recipient.recordingBrotherEmail) return false

  // Sender must not be private
  if (hostingEcclesia.sharingPreference === 'private') return false

  // Check exclusion lists
  if (hostingEcclesia.excludedEcclesias?.includes(recipient.name)) return false
  if (recipient.excludedEcclesias?.includes(hostingEcclesia.name)) return false

  // For regional scope, check distance
  if (scope === 'region') {
    // Subscribers-only senders don't auto-share regionally
    if (hostingEcclesia.sharingPreference === 'subscribers-only') return false

    if (recipient.latitude && recipient.longitude && hostingEcclesia.latitude && hostingEcclesia.longitude) {
      // Same country check
      if (recipient.country && hostingEcclesia.country && recipient.country !== hostingEcclesia.country) {
        return false
      }
      const radius = recipient.sharingRadiusKm || DEFAULT_SHARING_RADIUS_KM
      const distance = haversineDistance(
        recipient.latitude, recipient.longitude,
        hostingEcclesia.latitude, hostingEcclesia.longitude
      )
      if (distance > radius) return false
    }
  }

  // Global scope: respect private + exclusions (already checked above)
  return true
}

/**
 * Send in-app notifications to RBs of ecclesias that should see a shared event.
 * Fire-and-forget — failures are logged but never block the caller.
 */
export async function notifyRBsOfSharedEvent(event: Event): Promise<void> {
  try {
    const scope = getEffectiveSharingScope(event)
    if (scope === 'own') return

    const hostingName = typeof event.hostingEcclesia === 'string'
      ? event.hostingEcclesia
      : event.hostingEcclesia?.name
    if (!hostingName) return

    const allEcclesias = await getAllEcclesia()

    const hostingEcclesia = allEcclesias.find((e) => e.name === hostingName)
    if (!hostingEcclesia) return

    const rbEmails: string[] = []

    for (const ecclesia of allEcclesias) {
      if (ecclesia.name === hostingName) continue
      if (shouldNotifyEcclesia(ecclesia, hostingEcclesia, event, scope)) {
        rbEmails.push(ecclesia.recordingBrotherEmail!)
      }
    }

    if (rbEmails.length === 0) return

    const template = buildEventSharedNotification(
      event.title,
      '', // recipientEmail filled per-recipient by createBulkNotifications
      event.id,
      event.createdBy
    )

    await notificationRepository.createBulkNotifications(rbEmails, {
      type: template.type,
      title: template.title,
      body: template.body,
      actionUrl: template.actionUrl,
      sourceId: template.sourceId,
      sourceType: template.sourceType,
      senderEmail: template.senderEmail,
    })

    console.log(`🔔 Notified ${rbEmails.length} RBs about shared event "${event.title}" (scope: ${scope})`)
  } catch (error) {
    console.error('Failed to notify RBs of shared event (non-blocking):', error)
  }
}
