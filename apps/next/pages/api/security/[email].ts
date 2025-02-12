import { NextApiRequest, NextApiResponse } from 'next'
import { setUserRole } from 'next-app/utils/dynamodb/set-user-role'

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  try {
    if (req.method !== 'GET' && !req.query.email) {
      return res.status(404).json({ failed: 'Json Data Not Found' })
    }
    const email = req.query.email
    if (typeof email !== 'string') {
      return res.status(400).json({ failed: 'Invalid argument (invalid request payload).' })
    }
    console.log('email', email)
    const response = setUserRole({ email })
    console.log(response)

    return res.status(200).json(response)
  } catch (e) {}
}
