import { NextApiRequest, NextApiResponse } from 'next'
import { setAwkwardTimeStuff } from '../../../utils/date'

const DEFAULT_TIME = '20:00'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!req.query.name) {
    return res.status(404).json({ failed: 'Json Data Not Found' })
  }
  get_json(req.query.name as string)
    .then((result) => {
      res.status(200).json(result)
    })
    .catch((error) => {
      console.log('error', error)
      res.status(500).json({ failed: error })
    })
}

type JsonRow = {
  Date: string
  time?: string
  location?: string
  speaker?: string
  topic?: string
  event?: string
}

type CycRegular = {
  type: 'regular'
  location: string
  speaker: string
  topic: string
}

type CycSpecial = {
  type: 'special'
  event: string
}

type JsonTypes = {
  Date: Date
} & (CycRegular | CycSpecial)

/**
 * main function here is to make the date clean in the data but a Valid Javascript date
 * @param name the filename to be imported.
 */
async function get_json(name: string) {
  const json = await import('../../../data/cyc-2024.json')
  return json.default.map((row: JsonRow) => {
    const gmtOffset = setAwkwardTimeStuff(row.Date)
    const dateTimeString = `${row.Date} ${row.time || DEFAULT_TIME}:00.000 ${gmtOffset}`
    const dateTime = new Date(dateTimeString)
    if (row.Date && row.event) {
      return {
        type: 'special',
        Date: dateTime,
        event: row.event,
      } as CycSpecial
    }
    return {
      type: 'regular',
      Date: dateTime,
      location: row.location,
      speaker: row.speaker,
      topic: row.topic,
    } as CycRegular
  })
}
