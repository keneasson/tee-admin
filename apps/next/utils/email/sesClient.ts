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
   * newsletter sender). When omitted, uses the tenant's `noreply@` transactional
   * sender. Pass this for content that must go from the same address as its
   * broadcast, so sender reputation stays on one address.
   */
  from?: string
  /** Optional Reply-To (e.g. the Recording Brother). */
  replyTo?: string
}

export async function sendEmail({ to, subject, body, textBody, tenant, from, replyTo }: SendEmailProps): Promise<void> {
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
    ...(replyTo && { ReplyToAddresses: [replyTo] }),
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
