import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const range = !(req.query.start && req.query.end)
      ? setDefaultRange()
      : setGivenRange(req.query.start as string, req.query.end as string)

    const result = await get_json(range)

    return res.status(200).json(result)
  } catch (error) {
    console.log('error', error)
    return res.status(500).json({ failed: error })
  }
}

type ReadingsType = {
  [key: string]: string[]
}

/**
 * main function here is to make the date clean in the data with a UTC date that matches the Localized Date in the data file
 * @param range the date range to return data
 */
async function get_json(range: Date[]) {
  const json = await import('../../../../data/daily-readings.json')
  const [start, end] = range
  const readings = json.default as unknown as ReadingsType[]

  // Handle year rollover (Dec → Jan)
  // If end is in a different year than start, we need to check both years for each date
  const startYear = start.getUTCFullYear()
  const endYear = end.getUTCFullYear()

  // Filter and collect matching readings with their actual dates for sorting
  const matchedReadings: Array<{ reading: ReadingsType; sortDate: Date }> = []

  for (const row of readings) {
    const date = Object.keys(row)[0]

    // Try the date with start year first
    let dateObj = new Date(`${date}, ${startYear}`)
    let dateOnly = stripTime(dateObj)

    if (dateOnly >= start && dateOnly <= end) {
      matchedReadings.push({ reading: row, sortDate: dateOnly })
      continue
    }

    // If years differ and date didn't match, try with end year (for Jan dates when crossing year boundary)
    if (startYear !== endYear) {
      dateObj = new Date(`${date}, ${endYear}`)
      dateOnly = stripTime(dateObj)
      if (dateOnly >= start && dateOnly <= end) {
        matchedReadings.push({ reading: row, sortDate: dateOnly })
      }
    }
  }

  // Sort by date chronologically
  matchedReadings.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())

  return matchedReadings.map(m => m.reading)
}

function setDefaultRange() {
  const startRange = new Date()
  const endRange = new Date()
  // Vital Step! Strip time part. Create UTC midnight dateObj according to local timezone.
  const startMidnight = stripTime(startRange)
  endRange.setDate(endRange.getDate() + 7)
  const endMidnight = stripTime(endRange)
  return [startMidnight, endMidnight]
}

function setGivenRange(start: string, end: string) {
  const startRange = new Date(start)
  const endRange = new Date(end)
  const startMidnight = stripTime(startRange)
  const endMidnight = stripTime(endRange)
  return [startMidnight, endMidnight]
}

function stripTime(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}
