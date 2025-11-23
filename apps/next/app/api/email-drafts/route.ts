import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { EmailDraft, CreateEmailDraftInput } from '@my/app/types/email-draft'

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

const docClient = DynamoDBDocumentClient.from(client)
const TABLE_NAME = 'tee-admin'

// GET - List all drafts for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userEmail = session.user.email

    // Query all drafts for this user
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pkey = :pkey AND begins_with(skey, :skeyPrefix)',
      ExpressionAttributeValues: {
        ':pkey': `USER#${userEmail}`,
        ':skeyPrefix': 'EMAIL_DRAFT#',
      },
    })

    const response = await docClient.send(command)
    const drafts: EmailDraft[] = (response.Items || []).map((item) => ({
      id: item.skey.replace('EMAIL_DRAFT#', ''),
      subject: item.subject,
      htmlContent: item.htmlContent,
      selectedList: item.selectedList,
      note: item.note,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      createdBy: item.createdBy,
      lastTestedAt: item.lastTestedAt,
      sentAt: item.sentAt,
      status: item.status || 'draft',
    }))

    // Sort by updatedAt descending (most recent first)
    drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

    return NextResponse.json({ drafts })
  } catch (error) {
    console.error('Error fetching drafts:', error)
    return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 })
  }
}

// POST - Create a new draft
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userEmail = session.user.email
    const body: CreateEmailDraftInput = await request.json()

    if (!body.subject || !body.htmlContent || !body.selectedList) {
      return NextResponse.json(
        { error: 'Missing required fields: subject, htmlContent, selectedList' },
        { status: 400 }
      )
    }

    // Generate a unique ID
    const draftId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const now = new Date().toISOString()

    const draft: EmailDraft = {
      id: draftId,
      subject: body.subject,
      htmlContent: body.htmlContent,
      selectedList: body.selectedList,
      note: body.note,
      createdAt: now,
      updatedAt: now,
      createdBy: userEmail,
      status: 'draft',
    }

    // Save to DynamoDB
    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pkey: `USER#${userEmail}`,
        skey: `EMAIL_DRAFT#${draftId}`,
        ...draft,
      },
    })

    await docClient.send(command)

    return NextResponse.json({ draft })
  } catch (error) {
    console.error('Error creating draft:', error)
    return NextResponse.json({ error: 'Failed to create draft' }, { status: 500 })
  }
}

// DELETE - Delete a draft
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userEmail = session.user.email
    const { searchParams } = new URL(request.url)
    const draftId = searchParams.get('id')

    if (!draftId) {
      return NextResponse.json({ error: 'Draft ID is required' }, { status: 400 })
    }

    const command = new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        pkey: `USER#${userEmail}`,
        skey: `EMAIL_DRAFT#${draftId}`,
      },
    })

    await docClient.send(command)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting draft:', error)
    return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 })
  }
}
