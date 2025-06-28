import { SESv2Client, SESv2ClientConfig, SendEmailCommand } from '@aws-sdk/client-sesv2'
import { DynamoDBClientConfig } from '@aws-sdk/client-dynamodb'

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

export interface SendEmailProps {
  to: string
  subject: string
  body: string
  textBody?: string
}

export async function sendEmail({ to, subject, body, textBody }: SendEmailProps): Promise<void> {
  const sesClient = getSesClient()
  
  const emailCmd = new SendEmailCommand({
    FromEmailAddress: '"TEE Admin" <noreply@tee-admin.com>',
    Destination: {
      ToAddresses: [to],
    },
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
