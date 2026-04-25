import { NextApiRequest, NextApiResponse } from 'next'

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

    // Placeholder: security check not yet implemented
    return res.status(200).json({ email, status: 'ok' })
  } catch (e) {
    return res.status(500).json({ failed: 'Internal server error' })
  }
}
