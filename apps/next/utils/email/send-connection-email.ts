import { sendEmail } from './sesClient'

interface SendConnectionEmailParams {
  recipientEmail: string
  requesterName: string
  requesterEmail: string
  connectionToken: string
}

export async function sendConnectionRequestEmail({
  recipientEmail,
  requesterName,
  requesterEmail,
  connectionToken,
}: SendConnectionEmailParams): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_AUTH_URL || 'https://tee-admin.com'
  const acceptUrl = `${baseUrl}/auth/connection-callback?token=${connectionToken}&action=accept`
  const declineUrl = `${baseUrl}/auth/connection-callback?token=${connectionToken}&action=decline`

  const subject = `${requesterName} wants to connect with you on TEE Admin`

  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Connection Request</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #333; margin-bottom: 20px;">Connection Request</h2>

          <p style="color: #666; line-height: 1.6;">
            <strong>${requesterName}</strong> (${requesterEmail}) would like to connect with you on TEE Admin.
          </p>

          <div style="background-color: #e8f4fd; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #333; line-height: 1.6; margin: 0 0 8px 0;">
              <strong>What does connecting mean?</strong>
            </p>
            <ul style="color: #555; line-height: 1.8; margin: 0; padding-left: 20px;">
              <li>Accepting grants ${requesterName} access to your contact details (phone, address, etc.) that you've chosen to <strong>share with connections</strong></li>
              <li>You'll also gain access to any details ${requesterName} shares with their connections</li>
              <li>You can <strong>revoke the connection at any time</strong> from your profile</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${acceptUrl}"
               style="background-color: #22c55e; color: white; padding: 14px 36px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px; margin-right: 12px;">
              Accept
            </a>
            <a href="${declineUrl}"
               style="background-color: #6b7280; color: white; padding: 14px 36px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
              Decline
            </a>
          </div>

          <p style="color: #999; line-height: 1.6; font-size: 13px;">
            Clicking either button will sign you in automatically. If you didn't expect this request, you can safely decline or ignore this email.
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; text-align: center;">
            TEE Admin ${new Date().getFullYear()}<br>
            This message was sent on behalf of ${requesterName} via TEE Admin.
          </p>
        </div>
      </body>
    </html>
  `

  const textBody = `
Connection Request

${requesterName} (${requesterEmail}) would like to connect with you on TEE Admin.

What does connecting mean?
- Accepting grants ${requesterName} access to your contact details (phone, address, etc.) that you've chosen to share with connections
- You'll also gain access to any details ${requesterName} shares with their connections
- You can revoke the connection at any time from your profile

Accept: ${acceptUrl}
Decline: ${declineUrl}

Clicking either link will sign you in automatically. If you didn't expect this request, you can safely decline or ignore this email.

TEE Admin ${new Date().getFullYear()}
This message was sent on behalf of ${requesterName} via TEE Admin.
  `.trim()

  await sendEmail({
    to: recipientEmail,
    subject,
    body: htmlBody,
    textBody,
  })
}
