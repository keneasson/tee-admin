import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { UpdateEmailDraftInput } from '@my/app/types/email-draft'
import { planDraftUpdate, SENT_EMAIL_LOCKED_MESSAGE } from '@my/app/utils/email-draft-update'
import {
  toEmailDraft,
  conditionFailure,
  EXISTS_AND_NOT_SENT,
} from '@/utils/email-draft-item'

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ca-central-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

const docClient = DynamoDBDocumentClient.from(client)
const TABLE_NAME = 'tee-admin'

// GET - Fetch a specific draft
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userEmail = session.user.email
    const { id: draftId } = await params

    const command = new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        pkey: `USER#${userEmail}`,
        skey: `EMAIL_DRAFT#${draftId}`,
      },
    })

    const response = await docClient.send(command)

    if (!response.Item) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    return NextResponse.json({ draft: toEmailDraft(response.Item) })
  } catch (error) {
    console.error('Error fetching draft:', error)
    return NextResponse.json({ error: 'Failed to fetch draft' }, { status: 500 })
  }
}

// PUT - Update a draft
//
// - A SENT email is a permanent, fully frozen record of what went out: any
//   update (subject, body, list or note) is refused with 409 — copy it
//   instead. Enforced atomically by the write's condition, not only the read.
// - Changing the content of a TESTED draft puts it back to `draft` and removes
//   `lastTestedAt`, so the new content must be tested again.
// - Never creates an item: a missing draft is a 404.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userEmail = session.user.email
    const { id: draftId } = await params
    const body: Partial<UpdateEmailDraftInput> = await request.json()
    const key = {
      pkey: `USER#${userEmail}`,
      skey: `EMAIL_DRAFT#${draftId}`,
    }

    const existing = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: key }))
    if (!existing.Item) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    const plan = planDraftUpdate(
      {
        subject: existing.Item.subject,
        htmlContent: existing.Item.htmlContent,
        selectedList: existing.Item.selectedList,
        status: existing.Item.status || 'draft',
        lastTestedAt: existing.Item.lastTestedAt,
      },
      body
    )
    if (plan.locked) {
      return NextResponse.json({ error: SENT_EMAIL_LOCKED_MESSAGE }, { status: 409 })
    }

    const now = new Date().toISOString()
    const updates: string[] = ['#updatedAt = :updatedAt']
    const attributeNames: Record<string, string> = { '#updatedAt': 'updatedAt' }
    const attributeValues: Record<string, any> = { ':updatedAt': now }

    // Only content fields that actually change are written, so the reset
    // decision above matches what is stored.
    for (const field of plan.changedContentFields) {
      updates.push(`#${field} = :${field}`)
      attributeNames[`#${field}`] = field
      attributeValues[`:${field}`] = body[field]
    }

    if (body.note !== undefined) {
      updates.push('#note = :note')
      attributeNames['#note'] = 'note'
      attributeValues[':note'] = body.note
    }

    // A draft may only change while it is not sent — checked again in the
    // write itself, so a send landing between the read and the write still wins.
    attributeNames['#status'] = 'status'
    attributeValues[':sent'] = 'sent'

    let updateExpression = `SET ${updates.join(', ')}`
    if (plan.resetToDraft) {
      updates.push('#status = :draftStatus')
      attributeNames['#lastTestedAt'] = 'lastTestedAt'
      attributeValues[':draftStatus'] = 'draft'
      updateExpression = `SET ${updates.join(', ')} REMOVE #lastTestedAt`
    }

    let response
    try {
      response = await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: key,
          UpdateExpression: updateExpression,
          ConditionExpression: EXISTS_AND_NOT_SENT,
          ExpressionAttributeNames: attributeNames,
          ExpressionAttributeValues: attributeValues,
          ReturnValues: 'ALL_NEW',
          ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
        })
      )
    } catch (error) {
      const failure = conditionFailure(error)
      if (failure === 'sent') {
        return NextResponse.json({ error: SENT_EMAIL_LOCKED_MESSAGE }, { status: 409 })
      }
      if (failure === 'missing') {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
      }
      throw error
    }

    if (!response.Attributes) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    return NextResponse.json({ draft: toEmailDraft(response.Attributes) })
  } catch (error) {
    console.error('Error updating draft:', error)
    return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 })
  }
}
