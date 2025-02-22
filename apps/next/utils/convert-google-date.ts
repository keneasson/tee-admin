import { GoogleSheet } from '@my/app/types'
import { setAwkwardTimeStuff } from './date'

const secondsOffset = 86400000

export function convertGoogleDate(googleSheet: GoogleSheet, serialNumber: number): Date {
  const [hours, minutes] = googleSheet.startTime.split(':')
  const eventDate = new Date((serialNumber - 25569) * secondsOffset)
  const datePart = eventDate.toISOString().split('T')[0]
  const gmtOffset = setAwkwardTimeStuff(datePart)
  return new Date(datePart + 'T' + hours + ':' + minutes + ':00.000' + gmtOffset)
}
