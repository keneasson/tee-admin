import { ROLES } from '@my/app/provider/auth/auth-roles'
import type { DirectoryType, GoogleSheetDirectory } from '../../types'
import { getGoogleSheet } from '../get-google-sheet'
import { User } from '@my/app/types/auth'

export async function getUserFromLegacyDirectory({ email }: { email: string }): Promise<{ user: User; directoryUser: DirectoryType } | null> {
  const { content } = (await getGoogleSheet('directory')) as GoogleSheetDirectory

  const directoryUser = content.find((row) => {
    if (!row.Email) {
      return false
    }
    const rowsEmails = row.Email.trim()
      .split('\n')
      .map((e) => e.trim())
    return rowsEmails.includes(email)
  })

  console.log('📂 Directory lookup for email:', email)
  console.log('📂 Found user:', directoryUser ? { ...directoryUser, Email: directoryUser.Email } : 'NOT FOUND')
  
  if (!directoryUser) {
    return null
  }

  // Convert DirectoryType to User type
  const user: User = {
    email: email,
    name: `${directoryUser.FirstName} ${directoryUser.LastName}`.trim(),
    firstName: directoryUser.FirstName,
    lastName: directoryUser.LastName,
    role: 'guest' // Will be determined by getRoleFromLegacyUser
  }

  return { user, directoryUser }
}

export async function getRoleFromLegacyUser({ user, directoryUser }: { user: User; directoryUser: DirectoryType }) {
  // Check if user should be owner based on email
  // Owner emails can be configured via environment variable OWNER_EMAILS (comma-separated)
  const ownerEmailsEnv = process.env.OWNER_EMAILS || 'keneasson@gmail.com,ken.easson@gmail.com'
  const ownerEmails = ownerEmailsEnv.split(',').map(email => email.trim()).filter(Boolean)

  // Extract all emails from the directory record (handles multiple emails per row)
  const userEmails = directoryUser.Email?.trim().split('\n').map(e => e.trim().toLowerCase()) || []

  console.log('🔐 Role assignment for user:', {
    userEmails,
    ownerEmails,
    ecclesia: directoryUser.ecclesia
  })

  // Check if any of the user's emails match owner emails
  if (ownerEmails.some(ownerEmail => userEmails.includes(ownerEmail.toLowerCase()))) {
    console.log('👑 Assigning OWNER role')
    return ROLES.OWNER
  }

  // Check for admin role (you can add admin email logic here)
  // const adminEmails = ['admin@example.com']
  // if (adminEmails.some(adminEmail => userEmails.includes(adminEmail.toLowerCase()))) {
  //   return ROLES.ADMIN
  // }

  // Default role assignment based on ecclesia
  const finalRole = directoryUser.ecclesia === 'TEE' || directoryUser.ecclesia === 'Peterborough' ? ROLES.MEMBER : ROLES.GUEST
  console.log('🔐 Final role assigned:', finalRole)
  return finalRole
}
