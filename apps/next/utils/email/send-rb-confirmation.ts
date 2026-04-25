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

  // Build confirmation and deny URLs
  const baseUrl = process.env.NEXT_PUBLIC_AUTH_URL || 'https://tee-admin.com'
  const confirmUrl = `${baseUrl}/api/rb/confirm?token=${token}`
  const denyUrl = `${baseUrl}/api/rb/confirm?token=${token}&action=deny`

  // Direct assignment (Admin/Owner set) vs nomination (2 seconds collected)
  const isDirectAssignment = !!nominatorName

  const subject = `Recording Brother Verification — ${ecclesiaName}`

  // Build flow-specific body paragraphs
  let contextHtml: string
  let nextStepsHtml: string
  let contextText: string
  let nextStepsText: string

  if (isDirectAssignment) {
    // Flow 1: Admin/Owner directly assigned this person
    contextHtml = `
          <p style="color: #666; line-height: 1.6;">
            You have been assigned as the Recording Brother of <strong>${ecclesiaName}</strong> by ${nominatorName}.
          </p>`
    nextStepsHtml = `
          <p style="color: #666; line-height: 1.6;">
            By confirming, you will be registered as the Recording Brother and can manage how the Christadelphian Directory displays your ecclesia's information.
          </p>
          <p style="color: #666; line-height: 1.6;">
            Please click <strong>Confirm</strong> to accept, or <strong>Deny</strong> if this is not correct.
          </p>`
    contextText = `You have been assigned as the Recording Brother of ${ecclesiaName} by ${nominatorName}.`
    nextStepsText = `By confirming, you will be registered as the Recording Brother and can manage how the Christadelphian Directory displays your ecclesia's information.`
  } else {
    // Flow 2: Nomination confirmed after 2 members seconded
    contextHtml = `
          <p style="color: #666; line-height: 1.6;">
            Your nomination as Recording Brother of <strong>${ecclesiaName}</strong> has been seconded by two members of your ecclesia.
          </p>`
    nextStepsHtml = `
          <p style="color: #666; line-height: 1.6;">
            This is the final step. By confirming, you will be registered as the Recording Brother and can manage how the Christadelphian Directory displays your ecclesia's information.
          </p>
          <p style="color: #666; line-height: 1.6;">
            Please click <strong>Confirm</strong> to accept, or <strong>Deny</strong> if this is not correct.
          </p>`
    contextText = `Your nomination as Recording Brother of ${ecclesiaName} has been seconded by two members of your ecclesia.`
    nextStepsText = `This is the final step. By confirming, you will be registered as the Recording Brother and can manage how the Christadelphian Directory displays your ecclesia's information.`
  }

  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Recording Brother Verification</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #333; margin-bottom: 20px;">Recording Brother Verification</h2>

          <p style="color: #666; line-height: 1.6;">
            Hello <strong>${recipientName}</strong>,
          </p>
${contextHtml}
${nextStepsHtml}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${confirmUrl}"
               style="background-color: #16a34a; color: white; padding: 14px 36px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px; margin-right: 12px;">
              Confirm
            </a>
            <a href="${denyUrl}"
               style="background-color: #6b7280; color: white; padding: 14px 36px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
              Deny
            </a>
          </div>

          <p style="color: #999; line-height: 1.6; font-size: 13px;">
            This link expires in 24 hours.
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; text-align: center;">
            Christadelphian Directory ${new Date().getFullYear()}<br>
            This message was sent via TEE Admin on behalf of ${ecclesiaName}.
          </p>
        </div>
      </body>
    </html>
  `

  const textBody = `
Recording Brother Verification

Hello ${recipientName},

${contextText}

${nextStepsText}

To confirm, visit:
${confirmUrl}

To deny, visit:
${denyUrl}

This link expires in 24 hours.

Christadelphian Directory ${new Date().getFullYear()}
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

// ──────────────────────────────────────────────
// Nomination received — sent immediately when someone is nominated.
// Only a Deny button (no Confirm — role can't activate until 2 seconds).
// ──────────────────────────────────────────────

interface SendRBNominationReceivedParams {
  recipientEmail: string
  recipientName: string
  ecclesiaName: string
  nominatorName: string
  nominationId: string
}

export async function sendRBNominationReceivedEmail(
  params: SendRBNominationReceivedParams
): Promise<void> {
  const { recipientEmail, recipientName, ecclesiaName, nominatorName, nominationId } = params

  // Generate a deny-only token (no confirm action needed at this stage)
  const token = generateSecureToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days

  const { DynamoDB } = await import('@aws-sdk/client-dynamodb')
  const { DynamoDBDocument } = await import('@aws-sdk/lib-dynamodb')
  const { getAwsDbConfig } = await import('./sesClient')

  const dbClientConfig = getAwsDbConfig()
  const client = DynamoDBDocument.from(new DynamoDB(dbClientConfig), {
    marshallOptions: { convertEmptyValues: true, removeUndefinedValues: true, convertClassInstanceToMap: true },
  })

  await client.put({
    TableName: 'tee-admin',
    Item: {
      pkey: `RB_CONFIRM#${token}`,
      skey: 'TOKEN',
      token,
      personId: 'deny-only',
      ecclesiaName,
      nominationId,
      expiresAt,
      createdAt: new Date().toISOString(),
      used: false,
    },
  })

  const baseUrl = process.env.NEXT_PUBLIC_AUTH_URL || 'https://tee-admin.com'
  const denyUrl = `${baseUrl}/api/rb/confirm?token=${token}&action=deny`

  const subject = `Recording Brother Nomination — ${ecclesiaName}`

  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Recording Brother Nomination</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #333; margin-bottom: 20px;">Recording Brother Nomination</h2>

          <p style="color: #666; line-height: 1.6;">
            Hello <strong>${recipientName}</strong>,
          </p>

          <p style="color: #666; line-height: 1.6;">
            You have been nominated as the Recording Brother of <strong>${ecclesiaName}</strong> by ${nominatorName}.
          </p>

          <p style="color: #666; line-height: 1.6;">
            Before the role can take effect, <strong>two other members</strong> of ${ecclesiaName} need to second this nomination. Please ask two brothers or sisters in your ecclesia to log in to the Christadelphian Directory and second your nomination.
          </p>

          <p style="color: #666; line-height: 1.6;">
            Once two members have seconded, you will receive a follow-up email to confirm and activate the role.
          </p>

          <p style="color: #666; line-height: 1.6;">
            If this nomination is not correct, please click <strong>Deny</strong> below.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${denyUrl}"
               style="background-color: #6b7280; color: white; padding: 14px 36px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
              Deny Nomination
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; text-align: center;">
            Christadelphian Directory ${new Date().getFullYear()}<br>
            This message was sent via TEE Admin on behalf of ${ecclesiaName}.
          </p>
        </div>
      </body>
    </html>
  `

  const textBody = `
Recording Brother Nomination

Hello ${recipientName},

You have been nominated as the Recording Brother of ${ecclesiaName} by ${nominatorName}.

Before the role can take effect, two other members of ${ecclesiaName} need to second this nomination. Please ask two brothers or sisters in your ecclesia to log in to the Christadelphian Directory and second your nomination.

Once two members have seconded, you will receive a follow-up email to confirm and activate the role.

If this nomination is not correct, visit this link to deny:
${denyUrl}

Christadelphian Directory ${new Date().getFullYear()}
This message was sent via TEE Admin on behalf of ${ecclesiaName}.
  `.trim()

  await sendEmail({ to: recipientEmail, subject, body: htmlBody, textBody })
}

// ──────────────────────────────────────────────
// Role activated — sent after the nominee clicks Confirm (role is now live).
// Informational only, with a link to the directory.
// ──────────────────────────────────────────────

interface SendRBRoleActivatedParams {
  recipientEmail: string
  recipientName: string
  ecclesiaName: string
}

export async function sendRBRoleActivatedEmail(
  params: SendRBRoleActivatedParams
): Promise<void> {
  const { recipientEmail, recipientName, ecclesiaName } = params

  const baseUrl = process.env.NEXT_PUBLIC_AUTH_URL || 'https://tee-admin.com'
  const directoryUrl = `${baseUrl}/directory/ecclesias`

  const subject = `You are now the Recording Brother — ${ecclesiaName}`

  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Recording Brother — Role Activated</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #333; margin-bottom: 20px;">You are now the Recording Brother</h2>

          <p style="color: #666; line-height: 1.6;">
            Hello <strong>${recipientName}</strong>,
          </p>

          <p style="color: #666; line-height: 1.6;">
            Your nomination as Recording Brother of <strong>${ecclesiaName}</strong> has been seconded by two members of your ecclesia. The role is now active.
          </p>

          <p style="color: #666; line-height: 1.6;">
            As Recording Brother, you can manage how your ecclesia appears in the Christadelphian Directory. To get started, sign in and visit your ecclesia's page to review and update your ecclesia's contact details, meeting times, and address.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${directoryUrl}"
               style="background-color: #16a34a; color: white; padding: 14px 36px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
              Go to Ecclesial Directory
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; text-align: center;">
            Christadelphian Directory ${new Date().getFullYear()}<br>
            This message was sent via TEE Admin on behalf of ${ecclesiaName}.
          </p>
        </div>
      </body>
    </html>
  `

  const textBody = `
You are now the Recording Brother

Hello ${recipientName},

Your nomination as Recording Brother of ${ecclesiaName} has been seconded by two members of your ecclesia. The role is now active.

As Recording Brother, you can manage how your ecclesia appears in the Christadelphian Directory. To get started, sign in and visit your ecclesia's page to review and update your ecclesia's contact details, meeting times, and address.

Visit the Ecclesial Directory: ${directoryUrl}

Christadelphian Directory ${new Date().getFullYear()}
This message was sent via TEE Admin on behalf of ${ecclesiaName}.
  `.trim()

  await sendEmail({ to: recipientEmail, subject, body: htmlBody, textBody })
}
