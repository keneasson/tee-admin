import { randomBytes } from 'crypto'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb'

// Token validity period (30 days)
const TOKEN_VALIDITY_DAYS = 30
const TOKEN_VALIDITY_MS = TOKEN_VALIDITY_DAYS * 24 * 60 * 60 * 1000

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'tee-admin'

/**
 * Get DynamoDB document client
 */
function getDocClient(): DynamoDBDocumentClient {
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || 'ca-central-1',
  })
  return DynamoDBDocumentClient.from(client)
}

/**
 * Generate a random token string
 */
function generateRandomToken(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * Create a token that maps to an email address
 * Token record: pkey=TOKEN#{token}, skey=TOKEN, email=xxx
 *
 * @param email - The email address (unique identifier)
 * @returns The generated token string
 */
export async function generateEcclesiaToken(email: string): Promise<string> {
  const token = generateRandomToken()
  const docClient = getDocClient()
  const now = Date.now()
  const expiresAt = now + TOKEN_VALIDITY_MS

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pkey: `TOKEN#${token}`,
        skey: 'TOKEN',
        email: email.toLowerCase(),
        createdAt: now,
        expiresAt,
        // TTL for automatic cleanup (DynamoDB TTL uses seconds)
        ttl: Math.floor(expiresAt / 1000),
      },
    })
  )

  return token
}

/**
 * Verify a token and return the associated email address
 * Single GetItem - O(1) lookup
 *
 * @param token - The token to verify
 * @returns Object with email and validity info
 */
export async function verifyEcclesiaToken(token: string): Promise<{
  valid: boolean
  email?: string
  expired?: boolean
  error?: string
}> {
  try {
    const docClient = getDocClient()

    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          pkey: `TOKEN#${token}`,
          skey: 'TOKEN',
        },
      })
    )

    if (!result.Item) {
      return { valid: false, error: 'Token not found' }
    }

    const { email, expiresAt } = result.Item

    // Check if token is expired
    if (Date.now() > expiresAt) {
      return { valid: false, email, expired: true, error: 'Token expired' }
    }

    return { valid: true, email, expired: false }
  } catch (error) {
    console.error('Error verifying ecclesia token:', error)
    return { valid: false, error: 'Failed to verify token' }
  }
}

/**
 * Delete a token (for cleanup or revocation)
 *
 * @param token - The token to delete
 */
export async function deleteEcclesiaToken(token: string): Promise<void> {
  try {
    const docClient = getDocClient()
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          pkey: `TOKEN#${token}`,
          skey: 'TOKEN',
        },
      })
    )
  } catch (error) {
    console.error('Error deleting ecclesia token:', error)
  }
}

/**
 * Generate a token and return the full URL for ecclesia contact updates
 *
 * @param email - The email address to create token for
 * @param baseUrl - Optional base URL (defaults to NEXT_PUBLIC_AUTH_URL)
 * @returns Full URL with token for contact updates
 */
export async function generateEcclesiaUpdateUrl(email: string, baseUrl?: string): Promise<string> {
  const token = await generateEcclesiaToken(email)
  const base = baseUrl || process.env.NEXT_PUBLIC_AUTH_URL || 'https://tee-admin.com'
  return `${base}/ecclesia-contact?token=${token}`
}

/**
 * Generate a token and return the full URL for the self-serve email-preferences
 * page (Issue #75). This is the recipient-scoped link placed in every email
 * footer: the token identifies who the email was sent to, so /email-preferences
 * can show *their* subscriptions without a sign-in. It replaces SES's hosted
 * preference page (which exposed every topic). Same TOKEN# record + 30-day TTL
 * as {@link generateEcclesiaUpdateUrl}; only the destination path differs.
 *
 * @param email - The recipient address to mint a token for
 * @param baseUrl - Optional base URL (defaults to NEXT_PUBLIC_AUTH_URL)
 * @returns Full URL with token for managing email subscriptions
 */
export async function generateEmailPreferencesUrl(email: string, baseUrl?: string): Promise<string> {
  const token = await generateEcclesiaToken(email)
  const base = baseUrl || process.env.NEXT_PUBLIC_AUTH_URL || 'https://tee-admin.com'
  return `${base}/email-preferences?token=${token}`
}

// Max items per DynamoDB BatchWriteItem request.
const BATCH_WRITE_LIMIT = 25

/**
 * Generate one sign-in token per email in a single pass, writing them with
 * DynamoDB BatchWriteItem (25 per request) instead of one PutItem per email —
 * so a 2000-recipient send costs ~80 batched writes, not 2000 serial awaits.
 *
 * Tokens share the same `TOKEN#{token}` record shape as {@link generateEcclesiaToken},
 * so {@link verifyEcclesiaToken} validates them unchanged.
 *
 * @param emails - recipient addresses (deduplicated + lowercased internally)
 * @returns Map keyed by lowercased email → token
 */
export async function generateSigninTokens(emails: string[]): Promise<Map<string, string>> {
  const docClient = getDocClient()
  const now = Date.now()
  const expiresAt = now + TOKEN_VALIDITY_MS
  const ttl = Math.floor(expiresAt / 1000)

  const tokenByEmail = new Map<string, string>()
  const requests = Array.from(new Set(emails.map((e) => e.toLowerCase()))).map((email) => {
    const token = generateRandomToken()
    tokenByEmail.set(email, token)
    return {
      PutRequest: {
        Item: { pkey: `TOKEN#${token}`, skey: 'TOKEN', email, createdAt: now, expiresAt, ttl },
      },
    }
  })

  for (let i = 0; i < requests.length; i += BATCH_WRITE_LIMIT) {
    let batch = requests.slice(i, i + BATCH_WRITE_LIMIT)
    // BatchWriteItem can return UnprocessedItems under throttling — retry with backoff.
    for (let attempt = 0; batch.length > 0 && attempt < 3; attempt++) {
      const resp = await docClient.send(
        new BatchWriteCommand({ RequestItems: { [TABLE_NAME]: batch } })
      )
      batch = (resp.UnprocessedItems?.[TABLE_NAME] as typeof batch) ?? []
      if (batch.length > 0) {
        await new Promise((r) => setTimeout(r, 100 * (attempt + 1)))
      }
    }
  }

  return tokenByEmail
}

/**
 * Build a one-click sign-in URL for a token. Points at the /auth/signin-token
 * landing page, which presents an explicit "sign in" button (never an
 * unconditional auto-login) and preserves any existing session.
 */
export function buildSigninUrl(token: string, redirectTo?: string): string {
  const base = process.env.NEXT_PUBLIC_AUTH_URL || 'https://tee-admin.com'
  const url = new URL('/auth/signin-token', base)
  url.searchParams.set('token', token)
  if (redirectTo) url.searchParams.set('redirect', redirectTo)
  return url.toString()
}
