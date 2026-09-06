import { randomUUID } from 'crypto'
import { ListContactsResponse, SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2'
// import { getSesClient, SendEmailCommand } from './MockSesSendEmail'
import { emailsEnabled, getSesClient } from './sesClient'
import { getContacts } from './contact'
import { chunkArray } from '../chunkArray'
import {
  generateEcclesiaUpdateUrl,
  generateEmailPreferencesUrl,
  generateSigninTokens,
  buildSigninUrl,
} from './ecclesia-token'
import { addUtmParameters } from './utm-links'
import { sendRecordRepository } from '@my/app/provider/dynamodb/repositories/send-record-repository'
import { sendRecipientRepository } from '@my/app/provider/dynamodb/repositories/send-recipient-repository'
import { resolveTenantFromEnv, type TenantConfig } from '@my/app/config/tenants'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'

const SES_RATE_LIMIT = 14

// Re-export EmailReasonType from shared types for backward compatibility
export { type EmailReasonType as emailReasons } from '@my/app/types'
import { type EmailReasonType, type EmailSubReason } from '@my/app/types'
type emailReasons = EmailReasonType // Local alias for use in this file

// Each tenant has ONE local-part for bulk mail (concentrates sender
// reputation per brand-domain — see feedback_multi_brand_email_senders.md).
// The domain part comes from the resolved tenant.
const SENDER_LOCAL_PART = 'communications'
const REPLY_TO = 'teerecbro@gmail.com'

// Per-reason display-name overrides per tenant. Anything not listed
// falls back to the tenant's default senderDisplayName.
function senderDisplayName(reason: emailReasons, tenant: TenantConfig): string {
  if (tenant.id === 'tee' && reason === 'sunday-school') {
    return 'Toronto East Sunday School'
  }
  return tenant.senderDisplayName
}

// Subject line per reason, branded from the resolved tenant so it carries no
// hardcoded ecclesia name. Reasons not listed use the static `senders` subject.
function subjectFor(reason: emailReasons, tenant: TenantConfig): string {
  switch (reason) {
    case 'newsletter':
      return `${tenant.publicName} Newsletter`
    case 'custom':
      return `${tenant.senderDisplayName} Communications`
    default:
      return senders[reason].subject
  }
}

// Reason-specific config — sender name and domain come from the
// resolved tenant, so this no longer carries `name` or `email`.
const senders = {
  'sunday-school': {
    subject: 'Sunday School Tomorrow',
    contactList: 'sundaySchool',
    replyTo: REPLY_TO,
  },
  newsletter: {
    subject: 'Newsletter', // branded per-tenant via subjectFor()
    contactList: 'newsletter',
    replyTo: REPLY_TO,
  },
  'bible-class': {
    subject: 'Bible Class Tonight!',
    contactList: 'bibleClass',
    replyTo: REPLY_TO,
  },
  recap: {
    subject: 'Memorial Service Tomorrow',
    contactList: 'memorial',
    replyTo: REPLY_TO,
  },
  'business-meeting': {
    subject: 'Business Meeting Details',
    contactList: 'members',
    replyTo: REPLY_TO,
  },
  custom: {
    subject: 'Communications', // branded per-tenant via subjectFor()
    contactList: 'testList', // Safe default - will be overridden by customList parameter
    replyTo: REPLY_TO,
  },
  'event-announcement': {
    subject: 'Event Announcement',
    contactList: 'newsletter', // Default - will be overridden by customList parameter
    replyTo: REPLY_TO,
  },
  'inter-ecclesia': {
    subject: 'Inter-Ecclesia Announcement',
    contactList: 'interEcclesia',
    replyTo: REPLY_TO,
  },
  'news-alert': {
    subject: 'Important News',
    contactList: 'newsletter',
    replyTo: REPLY_TO,
  },
  // Consolidated CMS send bridge (epic #131 §4-C). One occasion-agnostic reason
  // for sending ANY Post as an announcement — funeral/baptism/wedding/general all
  // flow through here. Subject is always the post title (passed as customSubject);
  // this static value is only the fallback. The audience is caller-chosen
  // (customList); 'newsletter' is a safe default, and test mode still hard-routes
  // to testList in emailSend.
  'post-announcement': {
    subject: 'Announcement',
    contactList: 'newsletter',
    replyTo: REPLY_TO,
  },
}

/**
 * The From / Reply-To / Subject envelope for a reason, branded per tenant.
 *
 * Exported so a 1:1 send (e.g. the direct-recipient send that honours a specific
 * request) produces the SAME envelope as the broadcast — same canonical
 * `communications@` sender, same branded subject + Toronto-dated suffix — so a
 * one-off never sends from a different address (sender reputation is per-address).
 * Mirrors the inline construction in `emailSend` below (lines ~226–231); keep in
 * sync.
 */
export function buildEmailEnvelope(
  reason: emailReasons,
  tenant: TenantConfig,
  opts: { test?: boolean } = {}
): { from: string; replyTo: string; subject: string } {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
  return {
    from: `"${senderDisplayName(reason, tenant)}" <${SENDER_LOCAL_PART}@${tenant.senderDomain}>`,
    replyTo: senders[reason]?.replyTo ?? REPLY_TO,
    subject: `${opts.test ? '[TEST] ' : ''}${subjectFor(reason, tenant)} ${today}`,
  }
}

export type emailSendProps = {
  reason: emailReasons
  emailHtml: string
  emailText: string
  test?: boolean
  customList?: string // For custom emails to specify which list to send to
  customSubject?: string // For custom emails to specify subject
  subReason?: EmailSubReason // Categorization for per-send tracking
  description?: string // Free-text description for the send record
  sentBy?: string // Email of the user who triggered the send
  /**
   * Tenant context for the From-address. When omitted, falls back to
   * `resolveTenantFromEnv()` which reads `DEPLOYMENT_NAME` (defaulting
   * to 'tee'). Pass explicitly from API routes that have request
   * headers — e.g. `getTenantFromHeaders(req.headers) ?? resolveTenantFromEnv()`.
   */
  tenant?: TenantConfig
}

type Sends = { sends: string[]; skips: string[] }
type SendResult = Sends & { campaignId: string }

async function getAllContacts({
  listTopic,
  nextPageToken,
}: {
  listTopic: string
  nextPageToken?: string
}): Promise<ListContactsResponse['Contacts']> {
  const contacts = await getContacts({ listTopic, nextPageToken })
  if (!contacts.Contacts) {
    return []
  }
  if (contacts.NextToken) {
    const next = await getAllContacts({ listTopic, nextPageToken: contacts.NextToken })
    return next ? [...contacts.Contacts, ...next] : contacts.Contacts
  }
  return contacts.Contacts
}

// Per-recipient one-click sign-in footer. The {{loginUrl}} placeholder is
// substituted per recipient in chunkSend; any unsubstituted token is swept
// before send so literal {{...}} can never ship.
const LOGIN_FOOTER_HTML = `
<table role="presentation" width="100%" style="margin-top:24px;border-top:1px solid #e5e7eb"><tr><td align="center" style="font-family:Arial,Helvetica,sans-serif;padding:16px 8px 4px">
<a href="{{loginUrl}}" style="color:#2563eb;font-size:14px;text-decoration:underline">Open this in the app, already signed in →</a>
</td></tr><tr><td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9ca3af;padding:0 8px 12px">
This one-click link signs in only you. Forwarded emails will ask the new reader to request their own login.
</td></tr></table>`
const LOGIN_FOOTER_TEXT =
  '\n\n— — —\nOpen this in the app, already signed in: {{loginUrl}}\n(This one-click link signs in only you. Forwarded emails will ask the new reader to request their own login.)'

/** Insert the login footer just inside </body> (HTML) and at the end (text). */
function withLoginFooter(html: string, text: string): { html: string; text: string } {
  const idx = html.toLowerCase().lastIndexOf('</body>')
  const nextHtml = idx >= 0 ? html.slice(0, idx) + LOGIN_FOOTER_HTML + html.slice(idx) : html + LOGIN_FOOTER_HTML
  return { html: nextHtml, text: text + LOGIN_FOOTER_TEXT }
}

export const emailSend = async function ({
  reason,
  emailHtml,
  emailText,
  test = false,
  customList,
  customSubject,
  subReason = 'general',
  description,
  sentBy,
  tenant,
}: emailSendProps): Promise<SendResult | Error> {
  if (Object.keys(senders).findIndex((r) => r === reason) === -1) {
    throw new Error(`${reason} is not a valid email type`)
  }

  const resolvedTenant = tenant ?? resolveTenantFromEnv()
  const campaignId = randomUUID()

  if (!emailsEnabled()) {
    console.log(
      `[emailSend] Skipped — EMAILS_ENABLED=false (deployment=${process.env.DEPLOYMENT_NAME ?? 'unknown'}, reason=${reason}, test=${test})`
    )
    return { sends: [], skips: [], campaignId }
  }

  try {
    // For custom emails, use the provided list, otherwise use the default for that reason
    const listTopic = test === true ? 'testList' : (customList || senders[reason].contactList)
    const sesClient = getSesClient()

    console.log('why test=false sends test', { test, listTopic })
    const contacts = await getAllContacts({ listTopic, nextPageToken: undefined })
    if (!contacts) {
      return { sends: [], skips: [], campaignId }
    }

    const senderEmails = contacts
      .filter((contact) => contact.EmailAddress !== undefined && contact.UnsubscribeAll === false)
      .map((contact) => contact.EmailAddress as string)

    // Universal one-click login (feature-flagged). Read globally with a null
    // session, so it is active only when the flag is set to 'everyone'. When
    // off, html/text are untouched and no tokens are generated — byte-for-byte
    // identical to before.
    let baseHtml = emailHtml
    let baseText = emailText
    let loginUrls: Map<string, string> | undefined
    if (await checkFeatureFlagFromDB(FEATURE_FLAGS.UNIVERSAL_EMAIL_LOGIN, null)) {
      const withFooter = withLoginFooter(emailHtml, emailText)
      baseHtml = withFooter.html
      baseText = withFooter.text
      // One batched pass for all recipients (BatchWriteItem), then a synchronous
      // map lookup per recipient in the send loop — no per-email await.
      const tokens = await generateSigninTokens(senderEmails)
      loginUrls = new Map<string, string>()
      for (const [email, token] of tokens) {
        loginUrls.set(email, buildSigninUrl(token))
      }
    }

    // Format date in Toronto timezone to avoid UTC date issues when sending in evening EST
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })

    const from = `"${senderDisplayName(reason, resolvedTenant)}" <${SENDER_LOCAL_PART}@${resolvedTenant.senderDomain}>`
    // For custom emails, use the provided subject, otherwise use the default
    const defaultSubject = customSubject || subjectFor(reason, resolvedTenant)
    const subject = `${test ? '[TEST] ' : ''}${defaultSubject} ${today}`

    const sendChunks = chunkArray(senderEmails, SES_RATE_LIMIT)
    const replyTo = senders[reason].replyTo

    // Create the send record BEFORE the send loop. SES Delivery/Bounce events fire
    // within seconds of each send — i.e. before the loop finishes — so the record
    // must exist for the webhook to increment against. createSendRecord is a
    // non-destructive upsert that never writes the engagement counters, so an event
    // that still races ahead survives. Final sent/failed tallies are written after
    // the loop via finalizeSendCounts. Best-effort; never fail the send.
    try {
      await sendRecordRepository.createSendRecord({
        campaignId,
        reason,
        subReason,
        subject,
        description,
        recipientCount: senderEmails.length,
        sentCount: 0,
        failedCount: 0,
        sentBy,
      })
    } catch (recordError) {
      console.error('Failed to create send record (non-fatal):', recordError)
    }

    let allSent: Sends = { sends: [], skips: [] }
    for (let i = 0; i < sendChunks.length; i++) {
      const sends = await sendDeferred({
        toArray: sendChunks[i],
        from,
        subject,
        listTopic,
        emailText: baseText,
        emailHtml: baseHtml,
        reason,
        sesClient,
        replyTo,
        campaignId,
        loginUrls,
      })
      allSent = {
        sends: [...allSent.sends, ...sends.sends],
        skips: [...allSent.skips, ...sends.skips],
      }
    }

    console.log('total sent', allSent.sends.length)

    // Finalize the sent/failed tallies now the loop is done. Targeted update of
    // those two counts only — never touches the webhook-owned engagement counters.
    try {
      await sendRecordRepository.finalizeSendCounts(campaignId, {
        sentCount: allSent.sends.length,
        failedCount: allSent.skips.length,
      })
    } catch (recordError) {
      console.error('Failed to finalize send counts (non-fatal):', recordError)
    }

    // Per-recipient roster snapshot — the send-time record of exactly who this
    // campaign went to. SES delivery/open/click/bounce events fill in the rest
    // per recipient (see the SES webhook). Best-effort; killable per-deployment
    // with RECIPIENT_TRACKING_ENABLED=false (newsletter = thousands of writes).
    if (process.env.RECIPIENT_TRACKING_ENABLED !== 'false') {
      try {
        await sendRecipientRepository.snapshotRoster(campaignId, [
          ...allSent.sends.map((email) => ({ email, status: 'sent' as const })),
          ...allSent.skips.map((email) => ({ email, status: 'failed' as const })),
        ])
      } catch (rosterError) {
        console.error('Failed to snapshot recipient roster (non-fatal):', rosterError)
      }
    }

    return { ...allSent, campaignId }
  } catch (error) {
    console.error('SES Sending Email command', error)
    throw error
  }
}

type SingleSendProps = {
  from: string
  toArray: string[]
  subject: string
  listTopic: string
  emailText: string
  emailHtml: string
  reason: string
  sesClient: SESv2Client
  replyTo?: string
  campaignId: string
  /** Per-recipient one-click login URLs (lowercased email → URL). */
  loginUrls?: Map<string, string>
}

/**
 *
 * @param sendToChunk up to Rate Limit emails for one batch of sends.
 * @return Promise<Sent>
 */
async function sendDeferred(sendToChunk: SingleSendProps): Promise<Sends> {
  const [_, sent] = await Promise.all([
    setTimeoutAsync(1000), // SES Rate Limits sending per RATE_LIMIT/Second.
    chunkSend(sendToChunk),
  ])
  const failed = sendToChunk.toArray.filter((ok) => !sent.includes(ok))
  return { sends: sent, skips: failed }
}

/**
 * Returns when all the emails in toArray are sent
 * @param toArray Email[]
 * @param from Email
 * @param subject string
 * @param listTopic SES List Topic
 * @param emailText
 * @param emailHtml
 * @param reason - selects audience and template to send
 * @param sesClient
 */
async function chunkSend({
  toArray,
  from,
  subject,
  listTopic,
  emailText,
  emailHtml,
  reason,
  sesClient,
  replyTo,
  campaignId,
  loginUrls,
}: SingleSendProps): Promise<string[]> {
  const sent = []
  try {
    for (let i = 0; i < toArray.length; i++) {
      const recipientEmail = toArray[i]

      // Per-recipient tokenized links. Each placeholder is substituted only when
      // the template actually contains it, so a token is minted lazily and
      // templates without the placeholder are byte-for-byte unchanged. Applies to
      // EVERY reason (not just inter-ecclesia) — this is what lets the shared
      // footer's "manage preferences" link work on the newsletter, alerts, etc.
      let personalizedHtml = emailHtml
      let personalizedText = emailText

      // {{ecclesiaUpdateUrl}} → /ecclesia-contact (inter-ecclesia contact update).
      // Runs for EVERY reason now (was inter-ecclesia only) so the shared footer
      // link resolves wherever the placeholder appears; a token is minted only
      // when the placeholder is present.
      if (personalizedHtml.includes('{{ecclesiaUpdateUrl}}') || personalizedText.includes('{{ecclesiaUpdateUrl}}')) {
        try {
          const updateUrl = await generateEcclesiaUpdateUrl(recipientEmail)
          personalizedHtml = personalizedHtml.replace(/\{\{ecclesiaUpdateUrl\}\}/g, updateUrl)
          personalizedText = personalizedText.replace(/\{\{ecclesiaUpdateUrl\}\}/g, updateUrl)
        } catch (err) {
          console.error('emailSend: failed to mint ecclesiaUpdateUrl for', recipientEmail, err)
        }
      }

      // Universal one-click login link (when the flag is on, loginUrls is set).
      // Scoped to this path so output is unchanged when the flag is off.
      if (loginUrls) {
        const loginUrl = loginUrls.get(recipientEmail.toLowerCase())
        if (loginUrl) {
          personalizedHtml = personalizedHtml.replace(/\{\{loginUrl\}\}/g, loginUrl)
          personalizedText = personalizedText.replace(/\{\{loginUrl\}\}/g, loginUrl)
        }
      }

      // {{emailPreferencesUrl}} → /email-preferences (self-serve subscriptions, #75).
      if (personalizedHtml.includes('{{emailPreferencesUrl}}') || personalizedText.includes('{{emailPreferencesUrl}}')) {
        try {
          const prefsUrl = await generateEmailPreferencesUrl(recipientEmail)
          personalizedHtml = personalizedHtml.replace(/\{\{emailPreferencesUrl\}\}/g, prefsUrl)
          personalizedText = personalizedText.replace(/\{\{emailPreferencesUrl\}\}/g, prefsUrl)
        } catch (err) {
          console.error('emailSend: failed to mint emailPreferencesUrl for', recipientEmail, err)
        }
      }

      // Safety net: never ship a literal {{…}} placeholder if minting failed or
      // the flag path left one unfilled. Preferences falls back to the tokenless
      // page (the reader can self-identify); login / ecclesia tokens strip to
      // nothing. Only our KNOWN tokens — never a blanket {{...}} sweep, which
      // could eat legitimate braces a user pasted into a custom email.
      const prefsFallback = `${process.env.NEXT_PUBLIC_AUTH_URL || 'https://tee-admin.com'}/email-preferences`
      const stripKnownTokens = (s: string) =>
        s
          .replace(/\{\{emailPreferencesUrl\}\}/g, prefsFallback)
          .replace(/\{\{(loginUrl|ecclesiaUpdateUrl)\}\}/g, '')
      personalizedHtml = stripKnownTokens(personalizedHtml)
      personalizedText = stripKnownTokens(personalizedText)

      // Add UTM tracking parameters to all tee-admin.com links
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
      personalizedHtml = addUtmParameters(personalizedHtml, reason, today)

      const emailCmd = new SendEmailCommand({
        FromEmailAddress: from,
        ReplyToAddresses: replyTo ? [replyTo] : undefined,
        Destination: {
          ToAddresses: [recipientEmail],
        },
        ListManagementOptions: {
          ContactListName: 'TEEAdmin',
          TopicName: listTopic,
        },
        ConfigurationSetName: 'tee-email-tracking',
        EmailTags: [
          {
            Name: 'Reason',
            Value: reason,
          },
          {
            Name: 'Campaign',
            Value: campaignId,
          },
        ],
        Content: {
          Simple: {
            Subject: {
              Data: subject,
            },
            Body: {
              Text: {
                Data: personalizedText,
              },
              Html: {
                Data: personalizedHtml,
              },
            },
          },
        },
      })
      await sesClient.send(emailCmd as any)
      sent.push(recipientEmail)
    }
    return sent
  } catch (error) {
    console.log('chunkSend error sending', error)
    return sent
  }
}

async function setTimeoutAsync(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve('1')
    }, milliseconds)
  })
}
