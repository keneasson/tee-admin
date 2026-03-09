import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { render } from '@react-email/render'
import { sendEmail } from '../../../../utils/email/sesClient'
import {
  EMAIL_TYPE_CATALOG,
  getEmailTestSubject,
  getTemplateMockData,
  getSystemEmailHtml,
  type EmailTestType,
} from '../../../../utils/email/email-test-mocks'

// Lazy-import React Email templates to avoid bundling issues
async function renderTemplate(emailType: EmailTestType): Promise<{ html: string; subject: string }> {
  const subject = getEmailTestSubject(emailType)
  const mockData = getTemplateMockData(emailType)

  switch (emailType) {
    case 'newsletter': {
      const Newsletter = (await import('email-builder/emails/Newsletter')).default
      const html = await render(
        <Newsletter
          scheduleEvents={mockData.scheduleEvents}
          upcomingEvents={mockData.upcomingEvents}
          readings={mockData.readings}
        />
      )
      return { html, subject }
    }
    case 'recap': {
      const MemorialService = (await import('email-builder/emails/Memorial')).default
      const html = await render(
        <MemorialService events={mockData.sundayEvents!} />
      )
      return { html, subject }
    }
    case 'bible-class': {
      const BibleClass = (await import('email-builder/emails/BibleClass')).default
      const html = await render(
        <BibleClass events={mockData.bibleClassEvents!} />
      )
      return { html, subject }
    }
    case 'sunday-school': {
      const SundaySchool = (await import('email-builder/emails/SundaySchool')).default
      const html = await render(
        <SundaySchool events={mockData.sundaySchoolEvents!} />
      )
      return { html, subject }
    }
    case 'business-meeting': {
      const BusinessMeeting = (await import('email-builder/emails/BusinessMeeting')).default
      const html = await render(
        <BusinessMeeting note={mockData.note} />
      )
      return { html, subject }
    }
    case 'custom': {
      const CustomEmail = (await import('email-builder/emails/CustomEmail')).default
      const html = await render(
        <CustomEmail
          htmlContent={mockData.customHtmlContent!}
          subject={mockData.customSubject}
        />
      )
      return { html, subject }
    }
    default:
      throw new Error(`Unknown template type: ${emailType}`)
  }
}

/** GET — returns the email type catalog */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const userRole = (session.user as any).role || 'guest'
    if (!['admin', 'owner'].includes(userRole)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    return NextResponse.json({ catalog: EMAIL_TYPE_CATALOG })
  } catch (error) {
    console.error('Email tester GET error:', error)
    return NextResponse.json({ error: 'Failed to load email catalog' }, { status: 500 })
  }
}

/** POST — preview or send a test email */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const userRole = (session.user as any).role || 'guest'
    if (!['admin', 'owner'].includes(userRole)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { action, emailType } = body as { action: 'preview' | 'send'; emailType: EmailTestType }

    if (!action || !emailType) {
      return NextResponse.json({ error: 'Missing action or emailType' }, { status: 400 })
    }

    const validTypes = EMAIL_TYPE_CATALOG.map((t) => t.key)
    if (!validTypes.includes(emailType)) {
      return NextResponse.json({ error: `Invalid emailType: ${emailType}` }, { status: 400 })
    }

    // Determine category
    const typeInfo = EMAIL_TYPE_CATALOG.find((t) => t.key === emailType)!
    let html: string
    let subject: string

    if (typeInfo.category === 'template') {
      const result = await renderTemplate(emailType)
      html = result.html
      subject = result.subject
    } else {
      // System emails — generate HTML directly from mocks
      html = getSystemEmailHtml(emailType)
      subject = getEmailTestSubject(emailType)
    }

    if (action === 'preview') {
      return NextResponse.json({ html, subject })
    }

    // action === 'send'
    const recipientEmail = session.user.email
    if (!recipientEmail) {
      return NextResponse.json({ error: 'No email address on session' }, { status: 400 })
    }

    await sendEmail({
      to: recipientEmail,
      subject: `[TEST] ${subject}`,
      body: html,
    })

    return NextResponse.json({ success: true, sentTo: recipientEmail, subject })
  } catch (error) {
    console.error('Email tester POST error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to process email: ${message}` }, { status: 500 })
  }
}
