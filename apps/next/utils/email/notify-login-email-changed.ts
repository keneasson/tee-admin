import { sendEmail } from './sesClient'
import { getTenantFromHeaders, resolveTenantFromEnv } from '@my/app/config/tenants'

/**
 * Notify the OLD login address that the account's login email was just changed —
 * a paper trail + a path to raise the alarm. Brand-aware (resolves the tenant
 * from the request headers), and shows the NEW address IN FULL: we're writing to
 * the account owner about their own change, so masking the very address we just
 * moved them to helps no one (and the old address stays a valid login for the
 * 30-day grace, so they can still sign in and undo, or reply to this mail).
 *
 * Best-effort: any send failure is swallowed/logged so it can never fail the
 * caller (the identity transfer already succeeded by the time we get here).
 *
 * Extracted verbatim from the inline block in email-change/confirm/route.ts so
 * both the code-based change flow and the verified-address fast-path share one
 * implementation.
 */
export async function notifyLoginEmailChanged(params: {
  oldEmail: string
  newEmail: string
  headers: Headers
}): Promise<void> {
  const { oldEmail, newEmail, headers } = params
  try {
    const tenant = getTenantFromHeaders(headers) ?? resolveTenantFromEnv()
    const brandName = tenant.senderDisplayName || tenant.publicName
    const host = headers.get('x-forwarded-host') || headers.get('host')
    const proto =
      headers.get('x-forwarded-proto') ||
      (host && host.startsWith('localhost') ? 'http' : 'https')
    const baseUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_AUTH_URL || 'https://tee-admin.com')
    await sendEmail({
      to: oldEmail,
      subject: `Your email address on ${brandName} was just changed`,
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <p>Your email address on <strong>${brandName}</strong> has just been changed to:
             <strong>${newEmail}</strong>.</p>
          <p>If you didn't make this change, please
             <a href="${baseUrl}/profile">sign in and undo it</a>, or reply to this email with
             &ldquo;I didn't make this change&rdquo;.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
          <p style="color:#999; font-size:12px;">${brandName}</p>
        </div>
      `,
      textBody: [
        `Your email address on ${brandName} has just been changed to: ${newEmail}`,
        '',
        `If you didn't make this change, sign in and undo it (${baseUrl}/profile), or reply to this email with "I didn't make this change".`,
        '',
        brandName,
      ].join('\n'),
    })
  } catch (e) {
    console.error('notifyLoginEmailChanged failed (non-fatal):', e)
  }
}
