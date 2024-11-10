import { ProgramTypeKeys } from '@my/app/types'
import { setAwkwardTimeStuff } from './date'

const secondsOffset = 86400000

export function convertGoogleDate(
  teeServicesDb: any,
  serialNumber: number,
  sheetKey: ProgramTypeKeys
): Date {
  const [hours, minutes] =
    teeServicesDb.sheet_ids[sheetKey as keyof typeof teeServicesDb.sheet_ids]?.startTime.split(':')
  const eventDate = new Date((serialNumber - 25569) * secondsOffset)
  const datePart = eventDate.toISOString().split('T')[0]
  const gmtOffset = setAwkwardTimeStuff(datePart)
  return new Date(datePart + 'T' + hours + ':' + minutes + ':00.000' + gmtOffset)
}
