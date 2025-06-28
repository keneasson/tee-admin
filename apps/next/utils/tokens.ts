import { randomBytes } from 'crypto'

export function generateSecureToken(): string {
  return randomBytes(32).toString('hex')
}

export function generateInvitationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function isTokenExpired(createdAt: Date, validityDays: number = 7): boolean {
  const expirationTime = new Date(createdAt)
  expirationTime.setDate(expirationTime.getDate() + validityDays)
  return new Date() > expirationTime
}