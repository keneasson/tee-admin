import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { tokenRepository } from '@my/app/provider/dynamodb/repositories/token-repository'
import { sendOtpEmail } from '../../../../utils/email/send-otp-email'

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

    // Send OTP email
    try {
      await sendOtpEmail(normalizedEmail, token.otpCode!, token.tokenValue)
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
