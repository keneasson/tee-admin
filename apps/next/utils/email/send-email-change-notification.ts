import { sendEmail } from './sesClient'

const BASE_URL = process.env.NEXT_PUBLIC_AUTH_URL || 'https://tee-admin.com'
const SENDER_EMAILS = ['noreply@tee-admin.com', 'newsletter@tee-admin.com']

/**
 * Send notification to the OLD email address that their email was changed.
 * Includes a link to contact support if they didn't authorize the change.
 */
export async function sendEmailChangeNotification({
  oldEmail,
  newEmail,
  personName,
  changedByName,
}: {
  oldEmail: string
  newEmail: string
  personName: string
  changedByName: string
}): Promise<void> {
  const supportUrl = `${BASE_URL}/profile`
  const subject = 'Your Email Address Has Been Updated - TEE Admin'

  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Email Address Updated</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #333; margin-bottom: 20px;">Email Address Updated</h2>

          <p style="color: #666; line-height: 1.6;">
            Hello ${personName},
          </p>

          <p style="color: #666; line-height: 1.6;">
            A new email address has been added to your TEE Admin account by ${changedByName}:
          </p>

          <div style="background-color: #fff; border: 1px solid #dee2e6; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">
              <strong>Previous email:</strong> ${oldEmail}
            </p>
            <p style="margin: 0; color: #666; font-size: 14px;">
              <strong>New email added:</strong> ${newEmail}
            </p>
          </div>

          <p style="color: #666; line-height: 1.6;">
            If you did not authorize this change, please
            <a href="${supportUrl}" style="color: #dc3545; font-weight: bold;">click here to review your account</a>
            or contact your ecclesia's recording brother immediately.
          </p>

          <div style="background-color: #e8f4fd; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #0066cc; font-size: 14px;">
              <strong>Important:</strong> To ensure you receive all our emails, please add the following sender addresses to your contact list:
            </p>
            <ul style="color: #0066cc; font-size: 14px; margin: 8px 0 0 0; padding-left: 20px;">
              ${SENDER_EMAILS.map(e => `<li>${e}</li>`).join('\n              ')}
            </ul>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; text-align: center;">
            Toronto East Christadelphian Ecclesia<br>
            This is an automated message, please do not reply to this email.
          </p>
        </div>
      </body>
    </html>
  `

  const textBody = `
Email Address Updated

Hello ${personName},

A new email address has been added to your TEE Admin account by ${changedByName}:

Previous email: ${oldEmail}
New email added: ${newEmail}

If you did not authorize this change, please visit ${supportUrl} to review your account or contact your ecclesia's recording brother immediately.

Important: To ensure you receive all our emails, please add the following sender addresses to your contact list:
${SENDER_EMAILS.map(e => `- ${e}`).join('\n')}

Toronto East Christadelphian Ecclesia
  `.trim()

  try {
    await sendEmail({
      to: oldEmail,
      subject,
      body: htmlBody,
      textBody,
    })
    console.log(`📧 Email change notification sent to old address: ${oldEmail}`)
  } catch (error) {
    console.error(`Failed to send email change notification to ${oldEmail}:`, error)
    // Don't throw — this is a best-effort notification
  }
}

/**
 * Send verification email to the NEW email address when added by an admin.
 * The new email must be verified before it becomes active.
 */
export async function sendAdminAddedEmailVerification({
  newEmail,
  personName,
  verificationToken,
  addedByName,
}: {
  newEmail: string
  personName: string
  verificationToken: string
  addedByName: string
}): Promise<void> {
  const verificationUrl = `${BASE_URL}/api/user/emails/verify?token=${verificationToken}`
  const subject = 'Verify Your New Email Address - TEE Admin'

  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Verify your email</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #333; margin-bottom: 20px;">Verify Your New Email Address</h2>

          <p style="color: #666; line-height: 1.6;">
            Hello ${personName},
          </p>

          <p style="color: #666; line-height: 1.6;">
            ${addedByName} has added this email address to your TEE Admin account.
            Please click the button below to verify it:
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}"
               style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Verify Email Address
            </a>
          </div>

          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            If the button doesn't work, you can also copy and paste this link into your browser:
            <br>
            <a href="${verificationUrl}" style="color: #007bff; word-break: break-all;">${verificationUrl}</a>
          </p>

          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            This verification link will expire in 24 hours.
          </p>

          <div style="background-color: #e8f4fd; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #0066cc; font-size: 14px;">
              <strong>Important:</strong> To ensure you receive all our emails, please add the following sender addresses to your contact list:
            </p>
            <ul style="color: #0066cc; font-size: 14px; margin: 8px 0 0 0; padding-left: 20px;">
              ${SENDER_EMAILS.map(e => `<li>${e}</li>`).join('\n              ')}
            </ul>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; text-align: center;">
            Toronto East Christadelphian Ecclesia<br>
            This is an automated message, please do not reply to this email.
          </p>
        </div>
      </body>
    </html>
  `

  const textBody = `
Verify Your New Email Address

Hello ${personName},

${addedByName} has added this email address to your TEE Admin account. Please visit the link below to verify it:

${verificationUrl}

This verification link will expire in 24 hours.

Important: To ensure you receive all our emails, please add the following sender addresses to your contact list:
${SENDER_EMAILS.map(e => `- ${e}`).join('\n')}

Toronto East Christadelphian Ecclesia
  `.trim()

  await sendEmail({
    to: newEmail,
    subject,
    body: htmlBody,
    textBody,
  })
  console.log(`📧 Admin-added email verification sent to: ${newEmail}`)
}
