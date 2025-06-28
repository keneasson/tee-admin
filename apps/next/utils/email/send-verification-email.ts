import { sendEmail } from './sesClient'

export async function sendVerificationEmail(
  email: string,
  token: string,
  userName: string
): Promise<void> {
  const verificationUrl = `${process.env.NEXTAUTH_URL}/auth/verify-email?token=${token}`

  const subject = 'Verify your TEE Admin account'

  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Verify your account</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #333; margin-bottom: 20px;">Welcome to TEE Admin, ${userName}!</h2>
          
          <p style="color: #666; line-height: 1.6;">
            Thank you for registering with TEE Admin. To complete your registration and access your account, 
            please verify your email address by clicking the button below.
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
            This verification link will expire in 7 days. If you didn't create an account with TEE Admin, 
            you can safely ignore this email.
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
    Welcome to TEE Admin, ${userName}!
    
    Thank you for registering with TEE Admin. To complete your registration and access your account, 
    please verify your email address by visiting this link:
    
    ${verificationUrl}
    
    This verification link will expire in 7 days. If you didn't create an account with TEE Admin, 
    you can safely ignore this email.
    
    Toronto East Christadelphian Ecclesia
  `

  await sendEmail({
    to: email,
    subject,
    body: htmlBody,
    textBody,
  })
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  userName: string
): Promise<void> {
  console.log('Sending password reset email to:', email, 'for user:', userName)
  const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`

  const subject = 'Reset your TEE Admin password'

  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Reset your password</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #333; margin-bottom: 20px;">Password Reset Request</h2>
          
          <p style="color: #666; line-height: 1.6;">
            Hello ${userName},
          </p>
          
          <p style="color: #666; line-height: 1.6;">
            We received a request to reset your password for your TEE Admin account. 
            Click the button below to set a new password.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            If the button doesn't work, you can also copy and paste this link into your browser:
            <br>
            <a href="${resetUrl}" style="color: #dc3545; word-break: break-all;">${resetUrl}</a>
          </p>
          
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            This password reset link will expire in 7 days. If you didn't request a password reset, 
            you can safely ignore this email. Your password will remain unchanged.
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
    Password Reset Request
    
    Hello ${userName},
    
    We received a request to reset your password for your TEE Admin account. 
    Visit this link to set a new password:
    
    ${resetUrl}
    
    This password reset link will expire in 7 days. If you didn't request a password reset, 
    you can safely ignore this email. Your password will remain unchanged.
    
    Toronto East Christadelphian Ecclesia
  `

  try {
    await sendEmail({
      to: email,
      subject,
      body: htmlBody,
      textBody,
    })
  } catch (error) {
    console.error('Failed to send verification email:', error)
  }
}
