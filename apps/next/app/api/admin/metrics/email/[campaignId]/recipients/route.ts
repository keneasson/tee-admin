import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { sendRecipientRepository } from '@my/app/provider/dynamodb/repositories/send-recipient-repository'
import { sendRecordRepository } from '@my/app/provider/dynamodb/repositories/send-record-repository'
import { getContact } from '@/utils/email/contact'

// Cap ecclesia enrichment (one SES get-contact per recipient) to campaigns of a
// reasonable size — the inter-ecclesia audience is ~36. Large blasts (newsletter,
// thousands) skip enrichment; the per-recipient engagement data still shows.
const ECCLESIA_ENRICH_CAP = 250
const ENRICH_CHUNK = 20

/**
 * GET /api/admin/metrics/email/[campaignId]/recipients
 * Per-recipient breakdown for one campaign (Mailchimp-style drill-down):
 * exactly who it went to + delivered/opened/clicked/bounced, with ecclesia
 * enriched from SES contact attributes for reasonably-sized campaigns.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = (session.user as any).role
  if (role !== ROLES.ADMIN && role !== ROLES.OWNER) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { campaignId } = await params
    const [send, recipients] = await Promise.all([
      sendRecordRepository.getSendRecord(campaignId),
      sendRecipientRepository.getCampaignRecipients(campaignId),
    ])

    const enrichedEcclesia = recipients.length > 0 && recipients.length <= ECCLESIA_ENRICH_CAP
    if (enrichedEcclesia) {
      for (let i = 0; i < recipients.length; i += ENRICH_CHUNK) {
        const chunk = recipients.slice(i, i + ENRICH_CHUNK)
        await Promise.all(
          chunk.map(async (r) => {
            try {
              const contact = await getContact(r.email)
              if (contact?.AttributesData) {
                const attrs = JSON.parse(contact.AttributesData)
                if (attrs?.ecclesia) r.ecclesia = attrs.ecclesia
              }
            } catch {
              // best-effort — leave ecclesia undefined
            }
          })
        )
      }
    }

    // Sort: bounced/failed first (need attention), then by ecclesia, then email.
    recipients.sort((a, b) => {
      const aBad = a.bouncedAt || a.status === 'failed' ? 0 : 1
      const bBad = b.bouncedAt || b.status === 'failed' ? 0 : 1
      if (aBad !== bBad) return aBad - bBad
      return (a.ecclesia ?? '~').localeCompare(b.ecclesia ?? '~') || a.email.localeCompare(b.email)
    })

    return NextResponse.json({
      success: true,
      data: { send, recipients, enrichedEcclesia },
    })
  } catch (error) {
    console.error('Error fetching campaign recipients:', error)
    return NextResponse.json({ error: 'Failed to fetch campaign recipients' }, { status: 500 })
  }
}
