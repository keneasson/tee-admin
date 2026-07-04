import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { tokenRepository } from '@my/app/provider/dynamodb/repositories/token-repository'
import { getTenantFromHeaders, resolveTenantFromEnv } from '@my/app/config/tenants'
import { sendOtpEmail } from '../../../../utils/email/send-otp-email'

/**
 * Absolute origin the request arrived on — so the magic link resolves back to
 * the same domain (tee-admin.com, echadhub.org, a preview URL, or localhost)
 * instead of a hardcoded production host. Enables multi-domain + preview + E2E.
 */
function originFromRequest(request: Request): string | undefined {
  const h = request.headers
  const host = h.get('x-forwarded-host') || h.get('host')
  if (!host) return undefined
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      // Always return success to prevent email enumeration
      return NextResponse.json({ success: true })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ success: true })
    }

    // Rate limit: check if OTP was recently sent to this email
    const existingOtp = await tokenRepository.findActiveOtpByEmail(normalizedEmail)
    if (existingOtp) {
      const createdAt = new Date(existingOtp.createdAt).getTime()
      const now = Date.now()
      if (now - createdAt < 60 * 1000) {
        // Less than 1 minute since last OTP - silently succeed to prevent abuse
        return NextResponse.json({ success: true })
      }
    }

    // Look up PersonRecord by email
    const person = await personRepository.getByEmailForAuth(normalizedEmail)
    const personId = person?.personId || uuidv4()

    // Create OTP token
    const token = await tokenRepository.createOtp(personId, normalizedEmail)

    // Send OTP email — resolve the base URL + brand from the request so the
    // magic link and branding match the domain the user is on (multi-domain,
    // preview, E2E), not a hardcoded production host.
    try {
      const tenant = getTenantFromHeaders(request.headers) ?? resolveTenantFromEnv()
      await sendOtpEmail(normalizedEmail, token.otpCode!, token.tokenValue, {
        baseUrl: originFromRequest(request),
        brandName: tenant.senderDisplayName || tenant.publicName,
        orgName: tenant.homeEcclesiaName || tenant.publicName,
      })
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError)
      // Don't expose email sending failures to the client
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Send OTP error:', error)
    // Return success even on error to prevent information leakage
    return NextResponse.json({ success: true })
  }
}
