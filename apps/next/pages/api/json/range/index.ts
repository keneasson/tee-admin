import { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const range = !(req.query.start && req.query.end)
    ? setDefaultRange()
    : setGivenRange(req.query.start as string, req.query.end as string)

  get_json(range)
    .then((result) => {
      res.status(200).json(result)
    })
    .catch((error) => {
      console.log('error', error)
      res.status(500).json({ failed: error })
    })
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
  // console.log('start & end', { start, end })
  const readings = json.default as unknown as ReadingsType[]
  return readings.filter((row, i, j) => {
    const date = Object.keys(row)[0]
    const dateObj = new Date(`${date}, ${start.getUTCFullYear()}`)
    const dateOnly = stripTime(dateObj)
    return dateOnly >= start && dateOnly <= end
  })
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
