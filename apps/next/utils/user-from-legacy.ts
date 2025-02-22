'use server'

import { getGoogleSheet } from '@my/app/provider/get-google-sheet'
import { get_google_sheet } from './get-google-sheets'
import type { GoogleSheetDirectory, DirectoryType } from '@my/app/types'

export async function userFromLegacy({ email }: { email: string }): Promise<DirectoryType | false> {
  const { content } = (await get_google_sheet('directory')) as GoogleSheetDirectory
  const user = content.find((row) => {
    if (!row.Email) {
      return false
    }
    const rowsEmails = row.Email.trim()
      .split('\n')
      .map((e: string) => e.trim())
    console.log('emails traversed', rowsEmails)
    return rowsEmails.includes(email)
  })

  console.log('directory', user)
  return user || false
}
