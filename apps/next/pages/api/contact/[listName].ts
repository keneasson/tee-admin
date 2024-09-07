import { NextApiRequest, NextApiResponse } from 'next'

/**
 * Main API Endpoint for sending an Email for a Specific Reason
 * reasons include: Newsletter, Memorial, Sunday School and Bible Class
 *
 * takes a query param ?reason=
 * @param req NextApiRequest
 * @param res NextApiResponse
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  try {
    if (req.method !== 'GET' && !req.query.listName) {
      return res.status(404).json({ failed: 'Json Data Not Found' })
    }
    // const listName = req.query.listName as string
  } catch (e) {}
}
