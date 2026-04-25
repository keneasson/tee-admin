import { v4 as uuidv4 } from 'uuid'
import { BaseRepository } from './base-repository'
import type { TokenRecord, TokenType, TokenQueryResult } from '../types'

// Token expiry durations (in milliseconds)
const TOKEN_EXPIRY_MS = {
  email_verification: 24 * 60 * 60 * 1000,     // 24 hours
  password_reset: 1 * 60 * 60 * 1000,          // 1 hour
  invitation: 7 * 24 * 60 * 60 * 1000,         // 7 days
  otp: 10 * 60 * 1000,                         // 10 minutes
} as const

const OTP_MAX_ATTEMPTS = 5
const OTP_RATE_LIMIT_MS = 60 * 1000 // 1 minute between OTP sends to same email

// Input types
export interface CreateTokenInput {
  personId: string
  email: string
  tokenType: TokenType
  // Invitation-specific
  invitedBy?: string
  invitedRole?: 'owner' | 'admin' | 'member' | 'guest'
  // OTP-specific
  otpCode?: string
  maxAttempts?: number
  // Custom expiry (optional)
  expiresInMs?: number
}

export interface VerifyOtpResult {
  valid: boolean
  token?: TokenRecord
  error?: 'not_found' | 'expired' | 'already_used' | 'max_attempts' | 'invalid_code' | 'rate_limited'
}

export interface VerifyTokenResult {
  valid: boolean
  token?: TokenRecord
  error?: 'not_found' | 'expired' | 'already_used' | 'type_mismatch'
}

/**
 * Repository for Token records - verification tokens, password reset, invitations
 * Uses 'tee-admin' table with lowercase keys (pkey, skey)
 * Uses GSI4 for O(1) token value lookups
 */
export class TokenRepository extends BaseRepository<TokenRecord> {
  constructor() {
    super('admin', false) // false = lowercase keys (pkey, skey)
  }

  protected buildSheetPK(_sheetId: string): string {
    throw new Error('buildSheetPK not applicable for TokenRepository')
  }

  // ===== TOKEN CREATION =====

  /**
   * Create a new token
   * Returns the token record with the generated token value
   */
  async create(input: CreateTokenInput): Promise<TokenRecord> {
    const tokenId = uuidv4()
    const tokenValue = this.generateTokenValue()
    const now = new Date()
    const expiresInMs = input.expiresInMs ?? TOKEN_EXPIRY_MS[input.tokenType]
    const expiresAt = new Date(now.getTime() + expiresInMs).toISOString()

    const record: TokenRecord = {
      pkey: `PERSON#${input.personId}`,
      skey: `TOKEN#${input.tokenType}#${tokenId}`,
      gsi4pk: `TOKEN#${tokenValue}`,
      gsi4sk: `${expiresAt}#${input.tokenType}`,

      tokenId,
      tokenValue,
      tokenType: input.tokenType,
      email: input.email.toLowerCase(),
      personId: input.personId,

      expiresAt,
      createdAt: now.toISOString(),
      lastUpdated: now.toISOString(),
      version: 0,

      // Invitation-specific fields
      invitedBy: input.invitedBy,
      invitedRole: input.invitedRole,

      // OTP-specific fields
      otpCode: input.otpCode,
      attempts: input.otpCode ? 0 : undefined,
      maxAttempts: input.maxAttempts,
    }

    await this.put(record)
    return record
  }

  /**
   * Generate a secure random token value
   * 32 character hex string (128 bits of entropy)
   */
  private generateTokenValue(): string {
    // Use UUID v4 and remove dashes for a clean token
    return uuidv4().replace(/-/g, '')
  }

  // ===== TOKEN LOOKUP =====

  /**
   * Get token by value via GSI4 - O(1) lookup
   * This is the primary way to verify tokens
   */
  async getByValue(tokenValue: string): Promise<TokenRecord | null> {
    const result = await this.query(
      'gsi4pk = :gsi4pk',
      { ':gsi4pk': `TOKEN#${tokenValue}` },
      { indexName: 'gsi4' }
    )
    return result.items[0] || null
  }

  /**
   * Get token by ID (when you know the personId and tokenType)
   */
  async getById(personId: string, tokenType: TokenType, tokenId: string): Promise<TokenRecord | null> {
    const pk = `PERSON#${personId}`
    const sk = `TOKEN#${tokenType}#${tokenId}`
    return this.get(pk, sk)
  }

  /**
   * Get all tokens for a person
   */
  async getByPerson(personId: string): Promise<TokenRecord[]> {
    const pk = `PERSON#${personId}`
    const result = await this.query(
      'pkey = :pk AND begins_with(skey, :skPrefix)',
      { ':pk': pk, ':skPrefix': 'TOKEN#' }
    )
    return result.items
  }

  /**
   * Get all tokens of a specific type for a person
   */
  async getByPersonAndType(personId: string, tokenType: TokenType): Promise<TokenRecord[]> {
    const pk = `PERSON#${personId}`
    const result = await this.query(
      'pkey = :pk AND begins_with(skey, :skPrefix)',
      { ':pk': pk, ':skPrefix': `TOKEN#${tokenType}#` }
    )
    return result.items
  }

  // ===== TOKEN VERIFICATION =====

  /**
   * Verify a token by value
   * Checks: exists, not expired, not already used, correct type
   */
  async verify(tokenValue: string, expectedType?: TokenType): Promise<VerifyTokenResult> {
    const token = await this.getByValue(tokenValue)

    if (!token) {
      return { valid: false, error: 'not_found' }
    }

    // Check type if specified
    if (expectedType && token.tokenType !== expectedType) {
      return { valid: false, token, error: 'type_mismatch' }
    }

    // Check if already used
    if (token.usedAt) {
      return { valid: false, token, error: 'already_used' }
    }

    // Check expiry
    const now = new Date()
    const expiresAt = new Date(token.expiresAt)
    if (now > expiresAt) {
      return { valid: false, token, error: 'expired' }
    }

    return { valid: true, token }
  }

  /**
   * Mark a token as used
   * Returns the updated token record
   */
  async markUsed(tokenValue: string): Promise<TokenRecord | null> {
    const token = await this.getByValue(tokenValue)
    if (!token) return null

    const now = new Date().toISOString()
    return this.update(
      token.pkey,
      token.skey,
      { usedAt: now }
    )
  }

  /**
   * Verify and consume a token in one atomic operation
   * Uses conditional update to prevent race conditions (TOCTOU)
   * Marks the token as used if valid, fails if already used or expired
   */
  async verifyAndConsume(tokenValue: string, expectedType?: TokenType): Promise<VerifyTokenResult> {
    const token = await this.getByValue(tokenValue)

    if (!token) {
      return { valid: false, error: 'not_found' }
    }

    // Check type if specified
    if (expectedType && token.tokenType !== expectedType) {
      return { valid: false, token, error: 'type_mismatch' }
    }

    // Check if already used (quick check before attempting atomic update)
    if (token.usedAt) {
      return { valid: false, token, error: 'already_used' }
    }

    // Check expiry
    const now = new Date()
    const expiresAt = new Date(token.expiresAt)
    if (now > expiresAt) {
      return { valid: false, token, error: 'expired' }
    }

    // Atomic consumption: use conditional update to ensure token hasn't been
    // used or expired since we read it (prevents race conditions)
    try {
      const usedAt = now.toISOString()
      const updatedToken = await this.update(
        token.pkey,
        token.skey,
        { usedAt } as Partial<TokenRecord>,
        {
          // Condition: token must not have usedAt set AND must not be expired
          conditionExpression: 'attribute_not_exists(usedAt) AND expiresAt > :now',
          additionalExpressionAttributeValues: {
            ':now': usedAt,
          },
        }
      )
      return { valid: true, token: updatedToken }
    } catch (error: any) {
      // ConditionalCheckFailedException means token was already consumed or expired
      if (error.name === 'ConditionalCheckFailedException') {
        // Re-fetch to determine the actual error
        const refreshedToken = await this.getByValue(tokenValue)
        if (refreshedToken?.usedAt) {
          return { valid: false, token: refreshedToken, error: 'already_used' }
        }
        return { valid: false, token, error: 'expired' }
      }
      throw error
    }
  }

  // ===== TOKEN DELETION =====

  /**
   * Delete a specific token
   */
  async deleteToken(personId: string, tokenType: TokenType, tokenId: string): Promise<void> {
    await this.delete(`PERSON#${personId}`, `TOKEN#${tokenType}#${tokenId}`)
  }

  /**
   * Delete all tokens of a type for a person
   * Useful when creating a new token (invalidate previous ones)
   */
  async deleteAllOfType(personId: string, tokenType: TokenType): Promise<number> {
    const tokens = await this.getByPersonAndType(personId, tokenType)

    for (const token of tokens) {
      await this.delete(token.pkey, token.skey)
    }

    return tokens.length
  }

  /**
   * Delete all tokens for a person
   */
  async deleteAllForPerson(personId: string): Promise<number> {
    const tokens = await this.getByPerson(personId)

    for (const token of tokens) {
      await this.delete(token.pkey, token.skey)
    }

    return tokens.length
  }

  // ===== CONVENIENCE METHODS =====

  /**
   * Create an email verification token
   * Invalidates any existing verification tokens for this person
   */
  async createEmailVerification(personId: string, email: string): Promise<TokenRecord> {
    // Delete existing verification tokens
    await this.deleteAllOfType(personId, 'email_verification')

    return this.create({
      personId,
      email,
      tokenType: 'email_verification',
    })
  }

  /**
   * Create a password reset token
   * Invalidates any existing reset tokens for this person
   */
  async createPasswordReset(personId: string, email: string): Promise<TokenRecord> {
    // Delete existing reset tokens
    await this.deleteAllOfType(personId, 'password_reset')

    return this.create({
      personId,
      email,
      tokenType: 'password_reset',
    })
  }

  /**
   * Create an invitation token
   */
  async createInvitation(
    personId: string,
    email: string,
    invitedBy: string,
    invitedRole: 'owner' | 'admin' | 'member' | 'guest' = 'member'
  ): Promise<TokenRecord> {
    return this.create({
      personId,
      email,
      tokenType: 'invitation',
      invitedBy,
      invitedRole,
    })
  }

  // ===== OTP METHODS =====

  /**
   * Generate a 6-digit numeric OTP code
   */
  private generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  /**
   * Create an OTP token for email verification during sign-up/sign-in
   * Invalidates any existing OTP tokens for this person
   * Returns both the token record (with magic link token) and the OTP code
   */
  async createOtp(personId: string, email: string): Promise<TokenRecord> {
    // Delete existing OTP tokens for this person
    await this.deleteAllOfType(personId, 'otp')

    const otpCode = this.generateOtpCode()

    return this.create({
      personId,
      email,
      tokenType: 'otp',
      otpCode,
      maxAttempts: OTP_MAX_ATTEMPTS,
    })
  }

  /**
   * Find active OTP tokens for an email address
   * Uses GSI4 scan with filter - not ideal but OTP tokens are short-lived
   */
  async findActiveOtpByEmail(email: string): Promise<TokenRecord | null> {
    const now = new Date().toISOString()
    const normalizedEmail = email.toLowerCase()

    // Scan for active OTP tokens with this email
    const result = await this.scan({
      filterExpression: 'begins_with(skey, :skPrefix) AND email = :email AND attribute_not_exists(usedAt) AND expiresAt > :now',
      expressionAttributeValues: {
        ':skPrefix': 'TOKEN#otp#',
        ':email': normalizedEmail,
        ':now': now,
      },
    })

    return result.items[0] || null
  }

  /**
   * Check if an OTP was recently sent to this email (rate limiting)
   */
  async isOtpRateLimited(email: string): Promise<boolean> {
    const activeOtp = await this.findActiveOtpByEmail(email)
    if (!activeOtp) return false

    const createdAt = new Date(activeOtp.createdAt).getTime()
    const now = Date.now()
    return (now - createdAt) < OTP_RATE_LIMIT_MS
  }

  /**
   * Verify a 6-digit OTP code entered by the user
   * Increments attempt counter and enforces max attempts
   */
  async verifyOtp(email: string, code: string): Promise<VerifyOtpResult> {
    const token = await this.findActiveOtpByEmail(email)

    if (!token) {
      return { valid: false, error: 'not_found' }
    }

    // Check if already used
    if (token.usedAt) {
      return { valid: false, token, error: 'already_used' }
    }

    // Check expiry
    const now = new Date()
    if (now > new Date(token.expiresAt)) {
      return { valid: false, token, error: 'expired' }
    }

    // Check max attempts
    const attempts = (token.attempts || 0) + 1
    if (attempts > (token.maxAttempts || OTP_MAX_ATTEMPTS)) {
      // Invalidate the token by marking it used
      await this.update(token.pkey, token.skey, {
        usedAt: now.toISOString(),
        attempts,
      } as Partial<TokenRecord>)
      return { valid: false, token, error: 'max_attempts' }
    }

    // Check code match
    if (token.otpCode !== code) {
      // Increment attempts
      await this.update(token.pkey, token.skey, {
        attempts,
      } as Partial<TokenRecord>)
      return { valid: false, token, error: 'invalid_code' }
    }

    // Code matches - mark as used atomically
    try {
      const usedAt = now.toISOString()
      const updatedToken = await this.update(
        token.pkey,
        token.skey,
        { usedAt, attempts } as Partial<TokenRecord>,
        {
          conditionExpression: 'attribute_not_exists(usedAt)',
          additionalExpressionAttributeValues: {},
        }
      )
      return { valid: true, token: updatedToken }
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        return { valid: false, token, error: 'already_used' }
      }
      throw error
    }
  }

  // ===== CLEANUP OPERATIONS =====

  /**
   * Clean up expired tokens
   * This should be run periodically via a cron job
   * Uses scan, so should not be called frequently
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date().toISOString()
    let deletedCount = 0
    let lastKey: Record<string, any> | undefined

    do {
      const result = await this.scan({
        filterExpression: 'begins_with(skey, :tokenPrefix) AND expiresAt < :now',
        expressionAttributeValues: {
          ':tokenPrefix': 'TOKEN#',
          ':now': now,
        },
        lastEvaluatedKey: lastKey,
      })

      for (const token of result.items) {
        await this.delete(token.pkey, token.skey)
        deletedCount++
      }

      lastKey = result.lastEvaluatedKey
    } while (lastKey)

    return deletedCount
  }

  /**
   * List all pending (unused, unexpired) invitations
   * Useful for admin dashboard
   */
  async listPendingInvitations(): Promise<TokenRecord[]> {
    const now = new Date().toISOString()
    const invitations: TokenRecord[] = []
    let lastKey: Record<string, any> | undefined

    do {
      const result = await this.scan({
        filterExpression: 'begins_with(skey, :skPrefix) AND attribute_not_exists(usedAt) AND expiresAt > :now',
        expressionAttributeValues: {
          ':skPrefix': 'TOKEN#invitation#',
          ':now': now,
        },
        lastEvaluatedKey: lastKey,
      })

      invitations.push(...result.items)
      lastKey = result.lastEvaluatedKey
    } while (lastKey)

    return invitations
  }
}

// Export singleton instance
export const tokenRepository = new TokenRepository()
