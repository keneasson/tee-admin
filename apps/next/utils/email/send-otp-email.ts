import { sendEmail } from './sesClient'

export interface OtpEmailOptions {
  /**
   * Absolute origin the magic link should point at (e.g. https://echadhub.org,
   * a preview deployment, or http://localhost:3000). Derived from the request
   * so links resolve to the domain the user is actually on — required for
   * multi-domain, preview, and E2E. Falls back to the TEE production URL.
   */
  baseUrl?: string
  /** Brand shown in the subject/heading (e.g. "Echad Hub"). */
  brandName?: string
  /** Organisation shown in the footer. */
  orgName?: string
  /**
   * Same-site path to return to after the magic link verifies (e.g.
   * "/email-preferences"). Defaults to the otp-callback's own default (/profile).
   */
  redirectPath?: string
}

export async function sendOtpEmail(
  email: string,
  otpCode: string,
  magicLinkToken: string,
  opts: OtpEmailOptions = {}
): Promise<void> {
  const baseUrl = (
    opts.baseUrl ||
    process.env.NEXT_PUBLIC_AUTH_URL ||
    'https://tee-admin.com'
  ).replace(/\/$/, '')
  const brandName = opts.brandName || 'TEE Admin'
  const orgName = opts.orgName || 'Toronto East Christadelphian Ecclesia'
  // Only carry a safe same-site return path (no open redirects).
  const redirect =
    opts.redirectPath && opts.redirectPath.startsWith('/') && !opts.redirectPath.startsWith('//')
      ? `&redirect=${encodeURIComponent(opts.redirectPath)}`
      : ''
  // Display-only hint so the confirm page can show who the link is for. The
  // address actually used to sign in comes from server-side token
  // verification, not this param. The token is what's secret, not the email.
  const emailHint = `&email=${encodeURIComponent(email)}`
  // Lands on a "Confirm sign-in" page that only consumes the single-use token
  // on an explicit human click — so email link-scanners that pre-fetch (GET)
  // the URL can't burn it before the user clicks (the "took two tries" bug).
  const magicLinkUrl = `${baseUrl}/auth/otp-callback?token=${magicLinkToken}${redirect}${emailHint}`

  const subject = `Your ${brandName} verification code`

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
            Enter this code to verify your email address and sign in to ${brandName}:
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <div style="display: inline-block; background-color: #ffffff; border: 2px solid #007bff; border-radius: 8px; padding: 16px 32px;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">
                ${otpCode}
              </span>
            </div>
          </div>

          <p style="color: #666; line-height: 1.6; text-align: center;">
            Or use this link to sign in:
          </p>

          <div style="text-align: center; margin: 20px 0;">
            <a href="${magicLinkUrl}"
               style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Sign in
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
            ${orgName}<br>
            This is an automated message, please do not reply to this email.
          </p>
        </div>
      </body>
    </html>
  `

  const textBody = `
Your ${brandName} Verification Code

Enter this code to verify your email address:

${otpCode}

Or use this link to sign in:
${magicLinkUrl}

This code expires in 10 minutes. If you didn't request this code, you can safely ignore this email.

${orgName}
  `.trim()

  await sendEmail({
    to: email,
    subject,
    body: htmlBody,
    textBody,
  })
}
