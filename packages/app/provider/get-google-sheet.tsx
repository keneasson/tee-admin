import { GoogleSheetTypes } from '../types'

const API_PATH = process.env.API_PATH || process.env.NEXT_PUBLIC_API_PATH
export const getGoogleSheet = async (scheduleKey: GoogleSheetTypes) => {
  console.log(
    `getGoogleSheet, ${API_PATH} = ${process.env.API_PATH} || ${process.env.NEXT_PUBLIC_API_PATH}}`,
    getGoogleSheet
  )
  const url = `${API_PATH}api/google-sheets?sheet=${scheduleKey}`
  console.log('url', url)
  const rawSchedule = await fetch(url, { next: { revalidate: 3600 } })
  return await rawSchedule.json()
}
