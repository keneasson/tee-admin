import { sendEmail } from './sesClient'

export async function sendOtpEmail(
  email: string,
  otpCode: string,
  magicLinkToken: string
): Promise<void> {
  const magicLinkUrl = `${process.env.NEXT_PUBLIC_AUTH_URL || 'https://tee-admin.com'}/auth/otp-callback?token=${magicLinkToken}`

  const subject = 'Your TEE Admin verification code'

  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Your verification code</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #333; margin-bottom: 20px;">Your Verification Code</h2>

          <p style="color: #666; line-height: 1.6;">
            Enter this code to verify your email address and sign in to TEE Admin:
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <div style="display: inline-block; background-color: #ffffff; border: 2px solid #007bff; border-radius: 8px; padding: 16px 32px;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">
                ${otpCode}
              </span>
            </div>
          </div>

          <p style="color: #666; line-height: 1.6; text-align: center;">
            Or click this link to verify automatically:
          </p>

          <div style="text-align: center; margin: 20px 0;">
            <a href="${magicLinkUrl}"
               style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Verify Email Address
            </a>
          </div>

          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            If the button doesn't work, copy and paste this link into your browser:
            <br>
            <a href="${magicLinkUrl}" style="color: #007bff; word-break: break-all;">${magicLinkUrl}</a>
          </p>

          <p style="color: #999; line-height: 1.6; font-size: 13px;">
            This code expires in 10 minutes. If you didn't request this code, you can safely ignore this email.
          </p>

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
Your TEE Admin Verification Code

Enter this code to verify your email address:

${otpCode}

Or visit this link to verify automatically:
${magicLinkUrl}

This code expires in 10 minutes. If you didn't request this code, you can safely ignore this email.

Toronto East Christadelphian Ecclesia
  `.trim()

  await sendEmail({
    to: email,
    subject,
    body: htmlBody,
    textBody,
  })
}
