/**
 * Planning for scripts/retire-ses-topic-fields.ts (R5). Pure, unit-tested.
 *
 * Two stored topic names are retired:
 *  - `sesTopicPreferences` on PERSON# / EMAIL# items: nothing reads or writes
 *    it any more (subscriptions are SUB# rows). Removable at any time.
 *  - `sesTopic` on LIST# / DETAILS items: the legacy bridge. A send still reads
 *    it until the SES safety net is on, so it is removed ONLY after
 *    scripts/ses-safety-net-topics.ts has switched the safety net on.
 */

export interface RetireCandidate {
  pkey: string
  skey: string
  attribute: 'sesTopicPreferences' | 'sesTopic'
}

export interface RetirePlan {
  removals: RetireCandidate[]
  /** Why the list bridge fields are left in place, when they are. */
  listsSkippedReason?: string
}

const isEmailItem = (i: { pkey?: string; skey?: string }) =>
  !!i.pkey?.startsWith('PERSON#') && !!i.skey?.startsWith('EMAIL#')
const isListItem = (i: { pkey?: string; skey?: string }) => !!i.pkey?.startsWith('LIST#') && i.skey === 'DETAILS'

export function planTopicFieldRetirement(
  items: Array<Record<string, any>>,
  safetyNetEnabled: boolean
): RetirePlan {
  const removals: RetireCandidate[] = []
  let listsWithBridge = 0
  for (const item of items) {
    if (isEmailItem(item) && item.sesTopicPreferences !== undefined) {
      removals.push({ pkey: item.pkey, skey: item.skey, attribute: 'sesTopicPreferences' })
    }
    if (isListItem(item) && item.sesTopic !== undefined) {
      listsWithBridge++
      if (safetyNetEnabled) removals.push({ pkey: item.pkey, skey: item.skey, attribute: 'sesTopic' })
    }
  }
  return {
    removals,
    ...(!safetyNetEnabled && listsWithBridge > 0
      ? {
          listsSkippedReason: `${listsWithBridge} list(s) keep sesTopic: sends still read it until scripts/ses-safety-net-topics.ts has run.`,
        }
      : {}),
  }
}
