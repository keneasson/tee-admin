import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { EmailDraft, UpdateEmailDraftInput } from '@my/app/types/email-draft'

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
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userEmail = session.user.email
    const draftId = params.id

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

    const draft: EmailDraft = {
      id: response.Item.skey.replace('EMAIL_DRAFT#', ''),
      subject: response.Item.subject,
      htmlContent: response.Item.htmlContent,
      selectedList: response.Item.selectedList,
      note: response.Item.note,
      createdAt: response.Item.createdAt,
      updatedAt: response.Item.updatedAt,
      createdBy: response.Item.createdBy,
      lastTestedAt: response.Item.lastTestedAt,
      sentAt: response.Item.sentAt,
      status: response.Item.status || 'draft',
    }

    return NextResponse.json({ draft })
  } catch (error) {
    console.error('Error fetching draft:', error)
    return NextResponse.json({ error: 'Failed to fetch draft' }, { status: 500 })
  }
}

// PUT - Update a draft
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userEmail = session.user.email
    const draftId = params.id
    const body: Partial<UpdateEmailDraftInput> = await request.json()

    const now = new Date().toISOString()

    // Build update expression
    const updates: string[] = []
    const attributeNames: Record<string, string> = {}
    const attributeValues: Record<string, any> = {
      ':updatedAt': now,
    }

    if (body.subject !== undefined) {
      updates.push('#subject = :subject')
      attributeNames['#subject'] = 'subject'
      attributeValues[':subject'] = body.subject
    }

    if (body.htmlContent !== undefined) {
      updates.push('#htmlContent = :htmlContent')
      attributeNames['#htmlContent'] = 'htmlContent'
      attributeValues[':htmlContent'] = body.htmlContent
    }

    if (body.selectedList !== undefined) {
      updates.push('#selectedList = :selectedList')
      attributeNames['#selectedList'] = 'selectedList'
      attributeValues[':selectedList'] = body.selectedList
    }

    if (body.note !== undefined) {
      updates.push('#note = :note')
      attributeNames['#note'] = 'note'
      attributeValues[':note'] = body.note
    }

    updates.push('#updatedAt = :updatedAt')
    attributeNames['#updatedAt'] = 'updatedAt'

    const command = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pkey: `USER#${userEmail}`,
        skey: `EMAIL_DRAFT#${draftId}`,
      },
      UpdateExpression: `SET ${updates.join(', ')}`,
      ExpressionAttributeNames: attributeNames,
      ExpressionAttributeValues: attributeValues,
      ReturnValues: 'ALL_NEW',
    })

    const response = await docClient.send(command)

    if (!response.Attributes) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    const draft: EmailDraft = {
      id: response.Attributes.skey.replace('EMAIL_DRAFT#', ''),
      subject: response.Attributes.subject,
      htmlContent: response.Attributes.htmlContent,
      selectedList: response.Attributes.selectedList,
      note: response.Attributes.note,
      createdAt: response.Attributes.createdAt,
      updatedAt: response.Attributes.updatedAt,
      createdBy: response.Attributes.createdBy,
      lastTestedAt: response.Attributes.lastTestedAt,
      sentAt: response.Attributes.sentAt,
      status: response.Attributes.status || 'draft',
    }

    return NextResponse.json({ draft })
  } catch (error) {
    console.error('Error updating draft:', error)
    return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 })
  }
}
