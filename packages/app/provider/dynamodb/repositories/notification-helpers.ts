import type { NotificationType } from '../types'

interface NotificationTemplate {
  type: NotificationType
  title: string
  body: string
  actionUrl?: string
  sourceId?: string
  sourceType?: string
  senderEmail?: string
}

/**
 * Build a notification for when an event is shared to an ecclesia.
 */
export function buildEventSharedNotification(
  eventTitle: string,
  recipientEmail: string,
  eventId: string,
  senderEmail?: string
): NotificationTemplate & { recipientEmail: string } {
  return {
    recipientEmail,
    type: 'event_shared',
    title: `Event shared: ${eventTitle}`,
    body: `A new event "${eventTitle}" has been shared with your ecclesia.`,
    actionUrl: `/events/${eventId}`,
    sourceId: eventId,
    sourceType: 'event',
    senderEmail,
  }
}

/**
 * Build a notification for a contact request.
 */
export function buildContactRequestNotification(
  requesterName: string,
  recipientEmail: string,
  requestId?: string
): NotificationTemplate & { recipientEmail: string } {
  return {
    recipientEmail,
    type: 'contact_request',
    title: `Contact request from ${requesterName}`,
    body: `${requesterName} would like to get in touch with you.`,
    actionUrl: '/profile/contact-requests',
    sourceId: requestId,
    sourceType: 'contact_request',
  }
}

/**
 * Build a notification for an edit request.
 */
export function buildEditRequestNotification(
  requesterName: string,
  recipientEmail: string,
  field: string,
  requestId?: string
): NotificationTemplate & { recipientEmail: string } {
  return {
    recipientEmail,
    type: 'edit_request',
    title: `Edit suggestion from ${requesterName}`,
    body: `${requesterName} has suggested a change to your ${field}.`,
    actionUrl: '/profile/edit-requests',
    sourceId: requestId,
    sourceType: 'edit_request',
  }
}

/**
 * Build a notification for an RB nomination.
 */
export function buildRBNominationNotification(
  nomineeEmail: string,
  ecclesia: string,
  nominationId?: string
): NotificationTemplate & { recipientEmail: string } {
  return {
    recipientEmail: nomineeEmail,
    type: 'rb_nomination',
    title: 'Recording Brother Nomination',
    body: `You have been nominated as Recording Brother for ${ecclesia}.`,
    actionUrl: '/profile',
    sourceId: nominationId,
    sourceType: 'rb_nomination',
  }
}

/**
 * Build a generic system notification.
 */
export function buildSystemNotification(
  recipientEmail: string,
  title: string,
  body: string,
  actionUrl?: string
): NotificationTemplate & { recipientEmail: string } {
  return {
    recipientEmail,
    type: 'system',
    title,
    body,
    actionUrl,
  }
}
