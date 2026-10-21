import { SESv2Client, SESv2ClientConfig, SendEmailCommand } from '@aws-sdk/client-sesv2'
import { DynamoDBClientConfig } from '@aws-sdk/client-dynamodb'
import { resolveTenantFromEnv, type TenantConfig } from '@my/app/config/tenants'

export class GlobalRef<T> {
  private readonly sym: symbol

  constructor(uniqueName: string) {
    this.sym = Symbol.for(uniqueName)
  }

  get value() {
    // @ts-ignore
    return (global as any)[this.sym] as T | undefined
  }

  set value(value: T) {
    ;(global as any)[this.sym] = value
  }
}

const CREDENTIAL = {
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
  region: 'ca-central-1',
}

export function getAwsConfig(): SESv2ClientConfig {
  return CREDENTIAL
}

export function getAwsDbConfig(): DynamoDBClientConfig {
  return CREDENTIAL
}

/**
 * Admin SES calls (contact lists, topics, suppression list) have their own
 * request limit, separate from the 14 emails/second sending rate that
 * `emailSend` paces itself to. AWS doesn't publish it; one call a second is
 * what our owner-run scripts have always run at without being throttled.
 */
export const SES_ADMIN_CALLS_PER_SECOND = 1

/**
 * For owner-run scripts only: every `getSesClient()` in this process (the
 * script's own calls and the shared helpers it uses) goes through ONE queue
 * that sends at most `callsPerSecond` requests, retries included. Scripts
 * don't sleep between calls themselves. The app's send path never calls this.
 */
export function usePacedSesClient(callsPerSecond = SES_ADMIN_CALLS_PER_SECOND): SESv2Client {
  const client = new SESv2Client(getAwsConfig())
  const gapMs = 1000 / callsPerSecond
  let next = Promise.resolve()
  let lastAt = 0
  client.middlewareStack.add(
    (send) => async (args) => {
      const turn = next.then(async () => {
        const wait = lastAt + gapMs - Date.now()
        if (wait > 0) await new Promise((r) => setTimeout(r, wait))
        lastAt = Date.now()
      })
      next = turn
      await turn
      return send(args)
    },
    // After the retry middleware, so each attempt waits its turn too.
    { step: 'finalizeRequest', priority: 'low', name: 'sesAdminPacing' }
  )
  new GlobalRef<SESv2Client>('sesConnection').value = client
  return client
}

export function getSesClient(): SESv2Client {
  const sesConnection = new GlobalRef('sesConnection')
  if (!sesConnection.value) {
    sesConnection.value = new SESv2Client(getAwsConfig())
  }
  return sesConnection.value as SESv2Client
}

// Deployment-scoped email kill switch. Set EMAILS_ENABLED=false on
// non-production deployments (e.g. echadhub pre-prod) to prevent any
// outbound mail — both bulk sends (emailSend) and transactional sends
// (sendEmail). Default behaviour is enabled.
export function emailsEnabled(): boolean {
  return process.env.EMAILS_ENABLED !== 'false'
}

export interface SendEmailProps {
  to: string
  subject: string
  body: string
  textBody?: string
  /**
   * Tenant context for the From-address. When omitted, falls back to
   * `resolveTenantFromEnv()` (DEPLOYMENT_NAME → 'tee' default).
   */
  tenant?: TenantConfig
  /**
   * Explicit From-address (e.g. the canonical `"Name" <communications@domain>`
   * newsletter sender). When omitted, defaults to the tenant's `noreply@{senderDomain}`
   * transactional sender. Pass this for content that must go from the same address as
   * its broadcast, so sender reputation stays on one address. Backward-compatible —
   * existing callers are unchanged.
   */
  from?: string
  /**
   * Optional Reply-To (e.g. the Recording Brother). When omitted, no Reply-To
   * header is set (current behaviour).
   */
  replyTo?: string
  /**
   * SES configuration set, e.g. `tee-email-tracking`.
   *
   * WITHOUT one, SES publishes no events for the send: no delivery, bounce,
   * complaint or open ever reaches `/api/ses/bounce-webhook`. Every 1:1 send on
   * this path was therefore invisible — a heads-up could bounce and nobody
   * would know a visiting speaker had not been told. Pass it for anything whose
   * arrival matters.
   *
   * Note this is NOT `ListManagementOptions`: a configuration set only enables
   * event publishing. Topic opt-out is deliberately not consulted here, because
   * a personal note about somebody's own appointment is not a broadcast.
   */
  configurationSetName?: string
  /** SES message tags, for attributing events back to a campaign. */
  emailTags?: Array<{ Name: string; Value: string }>
}

export async function sendEmail({
  to,
  subject,
  body,
  textBody,
  tenant,
  from,
  replyTo,
  configurationSetName,
  emailTags,
}: SendEmailProps): Promise<void> {
  if (!emailsEnabled()) {
    console.log(
      `[sendEmail] Skipped — EMAILS_ENABLED=false (deployment=${process.env.DEPLOYMENT_NAME ?? 'unknown'}, to=${to})`
    )
    return
  }

  const resolvedTenant = tenant ?? resolveTenantFromEnv()
  const sesClient = getSesClient()

  const emailCmd = new SendEmailCommand({
    FromEmailAddress: from ?? `"${resolvedTenant.senderDisplayName}" <noreply@${resolvedTenant.senderDomain}>`,
    Destination: {
      ToAddresses: [to],
    },
    ...(replyTo ? { ReplyToAddresses: [replyTo] } : {}),
    ...(configurationSetName ? { ConfigurationSetName: configurationSetName } : {}),
    ...(emailTags?.length ? { EmailTags: emailTags } : {}),
    Content: {
      Simple: {
        Subject: {
          Data: subject,
        },
        Body: {
          Html: {
            Data: body,
          },
          ...(textBody && {
            Text: {
              Data: textBody,
            }
          }),
        },
      },
    },
  })

  await sesClient.send(emailCmd)
}
