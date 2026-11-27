import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import { getDraftOwnerKeys, findOwnedDraft } from '@/utils/email-draft-owner'
import type { EmailDraft } from '@my/app/types/email-draft'

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ca-central-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

const docClient = DynamoDBDocumentClient.from(client)
const TABLE_NAME = 'tee-admin'

// POST - Copy one of the caller's drafts into a NEW draft.
//
// This is how a sent email is reused: the sent one stays as the record of what
// went out, and the copy starts fresh — status 'draft', never tested or sent,
// empty note, and `copiedFrom` pointing back at the source.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userEmail = session.user.email
    const { id: sourceId } = await params

    // The source may sit under any of this person's addresses; the copy lands
    // with their other drafts (primary address).
    const owner = await getDraftOwnerKeys(session.user)
    const found = await findOwnedDraft(docClient, TABLE_NAME, owner, sourceId)
    if (!found) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }
    const source = { Item: found.item }

    // Same id format as POST /api/email-drafts.
    const draftId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const now = new Date().toISOString()

    const draft: EmailDraft = {
      id: draftId,
      subject: source.Item.subject,
      htmlContent: source.Item.htmlContent,
      selectedList: source.Item.selectedList,
      note: '',
      createdAt: now,
      updatedAt: now,
      createdBy: userEmail,
      copiedFrom: sourceId,
      status: 'draft',
    }

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pkey: owner.writeKey,
          skey: `EMAIL_DRAFT#${draftId}`,
          ...draft,
        },
        // A fresh id never collides; refuse rather than overwrite if it ever does.
        ConditionExpression: 'attribute_not_exists(skey)',
      })
    )

    return NextResponse.json({ draft })
  } catch (error) {
    console.error('Error copying draft:', error)
    return NextResponse.json({ error: 'Failed to copy draft' }, { status: 500 })
  }
}
