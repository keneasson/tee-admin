import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  // Minimum 12 characters
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long')
  }

  // Encourage spaces but don't require them
  if (!password.includes(' ')) {
    // This is a warning, not an error - we encourage but don't require spaces
    // Could be shown as a helpful tip in the UI
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

export function getPasswordStrengthTip(): string {
  return 'For stronger security, consider using a passphrase with spaces (e.g. "correct horse battery staple")'
}
