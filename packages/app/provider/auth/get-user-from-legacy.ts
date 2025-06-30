import { ROLES } from '@my/app/provider/auth/auth-roles'
import type { DirectoryType, GoogleSheetDirectory } from '../../types'
import { getGoogleSheet } from '../get-google-sheet'

export async function getUserFromLegacyDirectory({ email }: { email: string }) {
  const { content } = (await getGoogleSheet('directory')) as GoogleSheetDirectory

  const user = content.find((row) => {
    if (!row.Email) {
      return false
    }
    const rowsEmails = row.Email.trim()
      .split('\n')
      .map((e) => e.trim())
    return rowsEmails.includes(email)
  })

  console.log('📂 Directory lookup for email:', email)
  console.log('📂 Found user:', user ? { ...user, Email: user.Email } : 'NOT FOUND')
  return user
}

export async function getRoleFromLegacyUser({ user }: { user: DirectoryType }) {
  // Check if user should be owner based on email
  // Owner emails can be configured via environment variable OWNER_EMAILS (comma-separated)
  const ownerEmailsEnv = process.env.OWNER_EMAILS || 'keneasson@gmail.com,ken.easson@gmail.com'
  const ownerEmails = ownerEmailsEnv.split(',').map(email => email.trim()).filter(Boolean)
  
  // Extract all emails from the user record (handles multiple emails per row)
  const userEmails = user.Email?.trim().split('\n').map(e => e.trim().toLowerCase()) || []
  
  console.log('🔐 Role assignment for user:', { 
    userEmails, 
    ownerEmails, 
    ecclesia: user.ecclesia 
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
  const finalRole = user.ecclesia === 'TEE' || user.ecclesia === 'Peterborough' ? ROLES.MEMBER : ROLES.GUEST
  console.log('🔐 Final role assigned:', finalRole)
  return finalRole
}
