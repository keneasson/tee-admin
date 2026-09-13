import {
  SESv2Client,
  GetSuppressedDestinationCommand,
  type SESv2ClientConfig,
} from '@aws-sdk/client-sesv2'

/**
 * Is this address on the SES account suppression list?
 *
 * TWO DIFFERENT MECHANISMS, and only one of them blocks a 1:1 send:
 *
 *   - **Topic opt-out** (contact-list `TopicPreferences`) is enforced only when
 *     a send passes `ListManagementOptions`, which the broadcast path does and
 *     `sendEmail()` deliberately does not. A visiting speaker does NOT need to
 *     be opted in to a mailing list to receive a personal note about his own
 *     exhortation, and requiring it would be wrong.
 *
 *   - **The account suppression list** (bounces and complaints — the "master
 *     scrub") applies to EVERY send, transactional included. SES accepts the
 *     call and drops the message. Silently. So a visiting brother with an old
 *     bounce against his address would simply never be told he is exhorting,
 *     and nobody would find out until he failed to arrive.
 *
 * This is why the check exists, and why it is surfaced BEFORE the send rather
 * than reported afterwards: the review page is the one moment where a person
 * can do something about it.
 */

const REGION = process.env.AWS_REGION || 'ca-central-1'

function client(): SESv2Client {
  const config: SESv2ClientConfig = { region: REGION }
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    config.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
  }
  return new SESv2Client(config)
}

export interface SuppressionStatus {
  suppressed: boolean
  /** BOUNCE or COMPLAINT, when SES says why. */
  reason?: string
  /** When it was added, so a stale suppression can be recognised as stale. */
  since?: string
  /** True when the check itself could not be completed — do not read as "clear". */
  unknown?: boolean
}

/**
 * Look up one address. Never throws: a failed check must not stop a send, but
 * must not masquerade as a clean result either — hence `unknown`.
 */
export async function checkSuppressed(email: string): Promise<SuppressionStatus> {
  const address = email?.trim().toLowerCase()
  if (!address) return { suppressed: false }

  try {
    const res = await client().send(
      new GetSuppressedDestinationCommand({ EmailAddress: address })
    )
    const d = res.SuppressedDestination
    return {
      suppressed: true,
      reason: d?.Reason,
      since: d?.LastUpdateTime ? new Date(d.LastUpdateTime).toISOString() : undefined,
    }
  } catch (error: any) {
    // NotFoundException is the good news: the address is not suppressed.
    if (error?.name === 'NotFoundException' || error?.$metadata?.httpStatusCode === 404) {
      return { suppressed: false }
    }
    console.error('[suppression-check] could not check %s:', address, error?.name ?? error)
    return { suppressed: false, unknown: true }
  }
}
