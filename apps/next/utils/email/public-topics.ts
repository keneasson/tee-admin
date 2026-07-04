import { GetContactCommand, SubscriptionStatus } from '@aws-sdk/client-sesv2'
import { getSesClient } from './sesClient'
import { inputTemplate } from './contact-lists'

/**
 * The PUBLIC, self-manageable subscription topics — the only ones exposed on
 * the self-serve /email-preferences page. Office / membership topics
 * (interEcclesia, members, testList) are conferred by role, never self-serve.
 *
 * Single source of truth shared by the subscribe route and the profile emails
 * API so the two never drift.
 */
export const PUBLIC_TOPICS = ['newsletter', 'memorial', 'bibleClass', 'sundaySchool'] as const

export const PUBLIC_TOPIC_LABELS: Record<string, string> = {
  newsletter: 'Newsletter',
  memorial: 'Memorial (Sunday service reminder)',
  bibleClass: 'Bible Class',
  sundaySchool: 'Sunday School',
}

/**
 * How many public topics this address is opted into. Returns 0 when the contact
 * doesn't exist yet, or `undefined` when the lookup fails (so callers can hide
 * the count rather than show a misleading zero).
 */
export async function getPublicOptInCount(email: string): Promise<number | undefined> {
  try {
    const contact = await getSesClient().send(
      new GetContactCommand({ ...inputTemplate, EmailAddress: email })
    )
    const prefs = new Map(
      (contact.TopicPreferences ?? []).map((p) => [p.TopicName, p.SubscriptionStatus])
    )
    return PUBLIC_TOPICS.filter((t) => prefs.get(t) === SubscriptionStatus.OPT_IN).length
  } catch (error: any) {
    if (error?.name === 'NotFoundException') return 0
    console.error('getPublicOptInCount failed for', email, error?.name || error)
    return undefined
  }
}
