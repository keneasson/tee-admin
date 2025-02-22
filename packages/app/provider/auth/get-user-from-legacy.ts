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

  console.log('directory', user)
  return user
}

export async function getRoleFromLegacyUser({ user }: { user: DirectoryType }) {
  return user.ecclesia === 'TEE' || user.ecclesia === 'Peterborough' ? ROLES.MEMBER : ROLES.GUEST
}
