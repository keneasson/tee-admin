export function setAwkwardTimeStuff(asOfDate: string): string {
  const tzname = 'America/New_York'
  const today = new Date(asOfDate)
  const longOffsetFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tzname,
    timeZoneName: 'longOffset',
  })
  const longOffsetString = longOffsetFormatter.format(new Date(today.toISOString())) // '2/28/2013, GMT-05:00'
  return longOffsetString.split('GMT')[1]
}

export function convertHumanReadableDate(date: Date): string {
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/New_York',
  } as Intl.DateTimeFormatOptions

  return date.toLocaleDateString('en-CA', options)
}
