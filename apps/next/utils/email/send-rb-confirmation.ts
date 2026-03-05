import { sendEmail } from './sesClient'
import { generateSecureToken } from '../tokens'

interface SendRBConfirmationParams {
  recipientEmail: string
  recipientName: string
  ecclesiaName: string
  emailPreference: 'personal' | 'ecclesia'
  rbEcclesiaEmail?: string
  nominatorName?: string
  nominationId?: string
  personId: string
}

interface RBConfirmationTokenData {
  token: string
  expiresAt: string
}

/**
 * Generate a secure token for RB confirmation and send the confirmation email.
 *
 * The token is stored in DynamoDB (simple key-value) and verified when the
 * nominee clicks the confirmation link.
 *
 * Token payload encodes: { personId, ecclesiaName, emailPreference, rbEcclesiaEmail, nominationId }
 * 24h expiry.
 */
export async function sendRBConfirmationEmail(
  params: SendRBConfirmationParams
): Promise<RBConfirmationTokenData> {
  const {
    recipientEmail,
    recipientName,
    ecclesiaName,
    emailPreference,
    rbEcclesiaEmail,
    nominatorName,
    nominationId,
    personId,
  } = params

  const token = generateSecureToken()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h

  // Store the token data in DynamoDB for later verification
  const { DynamoDB } = await import('@aws-sdk/client-dynamodb')
  const { DynamoDBDocument } = await import('@aws-sdk/lib-dynamodb')
  const { getAwsDbConfig } = await import('./sesClient')

  const dbClientConfig = getAwsDbConfig()
  const client = DynamoDBDocument.from(new DynamoDB(dbClientConfig), {
    marshallOptions: {
      convertEmptyValues: true,
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    },
  })

  await client.put({
    TableName: 'tee-admin',
    Item: {
      pkey: `RB_CONFIRM#${token}`,
      skey: 'TOKEN',
      token,
      personId,
      ecclesiaName,
      emailPreference,
      rbEcclesiaEmail: rbEcclesiaEmail || null,
      nominationId: nominationId || null,
      expiresAt,
      createdAt: new Date().toISOString(),
      used: false,
    },
  })

  // Build confirmation URL
  const baseUrl = process.env.NEXT_PUBLIC_AUTH_URL || 'https://tee-admin.com'
  const confirmUrl = `${baseUrl}/api/rb/confirm?token=${token}`

  const emailPrefText = emailPreference === 'ecclesia'
    ? `an ecclesia email address (${rbEcclesiaEmail})`
    : 'your personal email address'

  const nominatedByText = nominatorName
    ? ` Nominated by ${nominatorName}.`
    : ''

  const subject = `Recording Brother Confirmation — ${ecclesiaName}`

  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Recording Brother Confirmation</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #333; margin-bottom: 20px;">Recording Brother Confirmation</h2>

          <p style="color: #666; line-height: 1.6;">
            Hello <strong>${recipientName}</strong>,
          </p>

          <p style="color: #666; line-height: 1.6;">
            You have been nominated as Recording Brother for <strong>${ecclesiaName}</strong>.${nominatedByText}
          </p>

          <div style="background-color: #e8f4fd; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #333; line-height: 1.6; margin: 0 0 8px 0;">
              <strong>Email preference:</strong>
            </p>
            <p style="color: #555; line-height: 1.6; margin: 0;">
              Inter-ecclesia communications will be sent to ${emailPrefText}.
            </p>
          </div>

          <p style="color: #666; line-height: 1.6;">
            Please click the button below to confirm your acceptance as Recording Brother:
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${confirmUrl}"
               style="background-color: #2563eb; color: white; padding: 14px 36px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
              Confirm as Recording Brother
            </a>
          </div>

          <p style="color: #999; line-height: 1.6; font-size: 13px;">
            This link expires in 24 hours. If you did not expect this nomination, you can safely ignore this email.
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; text-align: center;">
            TEE Admin ${new Date().getFullYear()}<br>
            This message was sent via TEE Admin on behalf of ${ecclesiaName}.
          </p>
        </div>
      </body>
    </html>
  `

  const textBody = `
Recording Brother Confirmation

Hello ${recipientName},

You have been nominated as Recording Brother for ${ecclesiaName}.${nominatedByText}

Email preference: Inter-ecclesia communications will be sent to ${emailPrefText}.

Please visit the following link to confirm your acceptance:
${confirmUrl}

This link expires in 24 hours. If you did not expect this nomination, you can safely ignore this email.

TEE Admin ${new Date().getFullYear()}
This message was sent via TEE Admin on behalf of ${ecclesiaName}.
  `.trim()

  await sendEmail({
    to: recipientEmail,
    subject,
    body: htmlBody,
    textBody,
  })

  return { token, expiresAt }
}
