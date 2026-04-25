/**
 * Mock data factories for the Email Tester tool.
 * Each function returns the data needed to render a specific email type.
 * All tokens/URLs are obviously-fake values that won't trigger real actions.
 */

import { ProgramsTypes } from '@my/app/types'
import type {
  MemorialServiceType,
  SundaySchoolType,
  BibleClassType,
  SundayEvents,
} from '@my/app/types'
import type { Event } from '@my/app/types/events'

// Helpers
function nextSunday(offset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7) + offset * 7)
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function nextWednesday(offset = 0): string {
  const d = new Date()
  const daysUntilWed = (3 - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + daysUntilWed + offset * 7)
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

// ──────────────────────────────────────────────
// React Email template mocks
// ──────────────────────────────────────────────

function mockMemorials(): MemorialServiceType[] {
  return [0, 1].map((i) => ({
    Key: ProgramsTypes.memorial,
    Date: nextSunday(i),
    Preside: i === 0 ? 'Bro. John Smith' : 'Bro. David Brown',
    Exhort: i === 0 ? 'Bro. Michael Johnson' : 'Bro. Robert Wilson',
    Organist: 'Sis. Sarah Davis',
    Steward: 'Bro. James Taylor',
    Doorkeeper: 'Bro. William Anderson',
    Collection: 'Bro. Thomas Martinez',
    Lunch: i === 0 ? 'a lunch will be served' : '',
    Reading1: i === 0 ? 'Isaiah 40' : 'Psalm 23',
    Reading2: i === 0 ? 'John 6' : 'Romans 8',
    'Hymn-opening': i === 0 ? '101' : '203',
    'Hymn-exhortation': i === 0 ? '204' : '156',
    'Hymn-memorial': i === 0 ? '310' : '287',
    'Hymn-closing': i === 0 ? '412' : '350',
    YouTube: 'https://youtube.com/live/test-preview-only',
  }))
}

function mockSundaySchools(): SundaySchoolType[] {
  return [0, 1].map((i) => ({
    Key: ProgramsTypes.sundaySchool,
    Date: nextSunday(i),
    Refreshments: i === 0 ? 'Smith Family' : 'Johnson Family',
    'Holidays and Special Events': i === 0 ? undefined : 'Guest Speaker Visit',
  }))
}

function mockBibleClasses(): BibleClassType[] {
  return [0, 1].map((i) => ({
    Key: ProgramsTypes.bibleClass,
    Date: nextWednesday(i),
    Presider: i === 0 ? 'Bro. Mark Wilson' : 'Bro. Peter Clark',
    Speaker: i === 0 ? 'Bro. Andrew Thompson' : 'Bro. Daniel Lee',
    Topic: i === 0 ? 'The Parables of Jesus — The Sower' : 'Romans 12 — Living Sacrifices',
  }))
}

function mockSundayEvents(): SundayEvents[] {
  const memorials = mockMemorials()
  const schools = mockSundaySchools()
  return memorials.map((m, i) => ({
    ...m,
    Refreshments: schools[i]?.Refreshments ?? '',
    'Holidays and Special Events': schools[i]?.['Holidays and Special Events'] ?? '',
  }))
}

function mockUpcomingEvents(): Event[] {
  const now = new Date()
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  return [
    {
      id: 'test-event-1',
      type: 'general',
      title: 'Ecclesial Picnic at Rouge Park',
      description: 'Annual summer picnic for all members and families. Bring a dish to share!',
      active: true,
      createdAt: now,
      updatedAt: now,
      createdBy: 'test@example.com',
      eventDate: nextWeek,
      documents: [],
    } as unknown as Event,
    {
      id: 'test-event-2',
      type: 'study-weekend',
      title: 'Spring Bible Study Weekend',
      description: 'A weekend of study and fellowship. Theme: "The Kingdom of God"',
      active: true,
      createdAt: now,
      updatedAt: now,
      createdBy: 'test@example.com',
      eventDate: twoWeeks,
      location: { name: 'Camp Trillium', city: 'Waterford', province: 'Ontario' },
      documents: [],
    } as unknown as Event,
  ]
}

function mockReadings(): any[] {
  const today = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    return {
      date: d,
      reading1: ['1 Kings 8', 'Psalm 119:1-32', 'Isaiah 41', 'Jeremiah 31', 'Ezekiel 37', 'Daniel 9', 'Hosea 6'][i],
      reading2: ['Mark 4', 'Luke 15', 'John 10', 'Acts 2', 'Romans 5', '1 Cor 13', 'Hebrews 11'][i],
      reading3: ['Proverbs 3', 'Psalm 23', 'Psalm 46', 'Psalm 91', 'Psalm 103', 'Psalm 139', 'Psalm 145'][i],
    }
  })
}

export type EmailTestType =
  | 'newsletter'
  | 'recap'
  | 'bible-class'
  | 'sunday-school'
  | 'business-meeting'
  | 'custom'
  | 'verification'
  | 'password-reset'
  | 'otp'
  | 'rb-direct-assignment'
  | 'rb-nomination-received'
  | 'rb-role-activated'

export interface EmailTypeInfo {
  key: EmailTestType
  label: string
  category: 'template' | 'system'
  description: string
}

export const EMAIL_TYPE_CATALOG: EmailTypeInfo[] = [
  // React Email templates
  { key: 'newsletter', label: 'Newsletter', category: 'template', description: 'Weekly newsletter with schedules, events, and daily readings' },
  { key: 'recap', label: 'Memorial Service', category: 'template', description: 'Sunday service recap with memorial + sunday school details' },
  { key: 'bible-class', label: 'Bible Class', category: 'template', description: 'Upcoming bible class schedule with speakers and topics' },
  { key: 'sunday-school', label: 'Sunday School', category: 'template', description: 'Sunday school schedule with refreshments roster' },
  { key: 'business-meeting', label: 'Business Meeting', category: 'template', description: 'Business meeting notice with agenda notes' },
  { key: 'custom', label: 'Custom Email', category: 'template', description: 'Custom HTML content wrapped in ecclesia template' },
  // System emails (inline HTML)
  { key: 'verification', label: 'Email Verification', category: 'system', description: 'Account verification link sent to new users' },
  { key: 'password-reset', label: 'Password Reset', category: 'system', description: 'Password reset link for existing users' },
  { key: 'otp', label: 'OTP / Magic Link', category: 'system', description: '6-digit code and magic link for passwordless sign-in' },
  { key: 'rb-direct-assignment', label: 'RB Direct Assignment', category: 'system', description: 'Admin/Owner assigns Recording Brother — nominee confirms or denies' },
  { key: 'rb-nomination-received', label: 'RB Nomination Received', category: 'system', description: 'Nominee notified of nomination — explains that two members must second before the role takes effect' },
  { key: 'rb-role-activated', label: 'RB Role Activated', category: 'system', description: 'Two members have seconded — nominee is now the Recording Brother and can manage ecclesia info' },
]

/**
 * Returns the subject line for a given email test type.
 */
export function getEmailTestSubject(emailType: EmailTestType): string {
  switch (emailType) {
    case 'newsletter': return 'Toronto East Christadelphian Ecclesia Newsletter'
    case 'recap': return 'Memorial Service — This Week'
    case 'bible-class': return 'Bible Class This Week'
    case 'sunday-school': return 'Sunday School Tomorrow'
    case 'business-meeting': return 'Business Meeting Reminder'
    case 'custom': return 'Custom Email — Preview'
    case 'verification': return 'Verify your TEE Admin account'
    case 'password-reset': return 'Reset your TEE Admin password'
    case 'otp': return 'Your TEE Admin verification code'
    case 'rb-direct-assignment': return 'Recording Brother Verification — Toronto East'
    case 'rb-nomination-received': return 'Recording Brother Nomination — Toronto East'
    case 'rb-role-activated': return 'You are now the Recording Brother — Toronto East'
    default: return 'Test Email'
  }
}

// ──────────────────────────────────────────────
// React Email template data getters
// (returns props for getEmailContent)
// ──────────────────────────────────────────────

export interface TemplateMockData {
  scheduleEvents?: (MemorialServiceType | BibleClassType | SundaySchoolType)[]
  sundayEvents?: SundayEvents[]
  bibleClassEvents?: BibleClassType[]
  sundaySchoolEvents?: SundaySchoolType[]
  upcomingEvents?: Event[]
  readings?: any[]
  note?: string
  customHtmlContent?: string
  customSubject?: string
}

export function getTemplateMockData(emailType: EmailTestType): TemplateMockData {
  switch (emailType) {
    case 'newsletter':
      return {
        scheduleEvents: [
          ...mockMemorials(),
          ...mockSundaySchools(),
          ...mockBibleClasses(),
        ],
        upcomingEvents: mockUpcomingEvents(),
        readings: mockReadings(),
      }
    case 'recap':
      return {
        sundayEvents: mockSundayEvents(),
      }
    case 'bible-class':
      return {
        bibleClassEvents: mockBibleClasses(),
      }
    case 'sunday-school':
      return {
        sundaySchoolEvents: mockSundaySchools(),
      }
    case 'business-meeting':
      return {
        note: 'Agenda:\n1. Opening prayer\n2. Minutes from last meeting\n3. Financial report\n4. Sunday School update\n5. Upcoming events planning\n6. Any other business\n7. Closing prayer',
      }
    case 'custom':
      return {
        customHtmlContent: `
          <h2 style="color: #333;">Sample Announcement</h2>
          <p>This is a <strong>preview</strong> of the custom email template.</p>
          <p>It supports basic HTML formatting including:</p>
          <ul>
            <li>Bold and <em>italic</em> text</li>
            <li>Lists</li>
            <li>Links: <a href="https://tee-admin.com">TEE Admin</a></li>
          </ul>
          <p style="color: #666;">This sample content is for preview purposes only.</p>
        `,
        customSubject: 'Custom Email — Preview',
      }
    default:
      return {}
  }
}

// ──────────────────────────────────────────────
// System email HTML generators
// (produces final HTML directly)
// ──────────────────────────────────────────────

const FAKE_BASE_URL = 'https://tee-admin.com'
const FAKE_TOKEN = 'test-token-preview-only-000000'

export function getSystemEmailHtml(emailType: EmailTestType): string {
  switch (emailType) {
    case 'verification':
      return buildVerificationHtml()
    case 'password-reset':
      return buildPasswordResetHtml()
    case 'otp':
      return buildOtpHtml()
    case 'rb-direct-assignment':
      return buildRbDirectAssignmentHtml()
    case 'rb-nomination-received':
      return buildRbNominationReceivedHtml()
    case 'rb-role-activated':
      return buildRbRoleActivatedHtml()
    default:
      return '<p>Unknown system email type</p>'
  }
}

function buildVerificationHtml(): string {
  const verificationUrl = `${FAKE_BASE_URL}/auth/verify-email?token=${FAKE_TOKEN}`
  return `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><title>Verify your account</title></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #333; margin-bottom: 20px;">Welcome to TEE Admin, John Smith!</h2>
          <p style="color: #666; line-height: 1.6;">
            Thank you for registering with TEE Admin. To complete your registration and access your account,
            please verify your email address by clicking the button below.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}"
               style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Verify Email Address
            </a>
          </div>
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            If the button doesn't work, you can also copy and paste this link into your browser:<br>
            <a href="${verificationUrl}" style="color: #007bff; word-break: break-all;">${verificationUrl}</a>
          </p>
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            This verification link will expire in 7 days. If you didn't create an account with TEE Admin,
            you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            Toronto East Christadelphian Ecclesia<br>
            This is an automated message, please do not reply to this email.
          </p>
        </div>
      </body>
    </html>
  `
}

function buildPasswordResetHtml(): string {
  const resetUrl = `${FAKE_BASE_URL}/auth/reset-password?token=${FAKE_TOKEN}`
  return `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><title>Reset your password</title></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #333; margin-bottom: 20px;">Password Reset Request</h2>
          <p style="color: #666; line-height: 1.6;">Hello John Smith,</p>
          <p style="color: #666; line-height: 1.6;">
            We received a request to reset your password for your TEE Admin account.
            Click the button below to set a new password.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}"
               style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Reset Password
            </a>
          </div>
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            If the button doesn't work, you can also copy and paste this link into your browser:<br>
            <a href="${resetUrl}" style="color: #dc3545; word-break: break-all;">${resetUrl}</a>
          </p>
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            This password reset link will expire in 7 days. If you didn't request a password reset,
            you can safely ignore this email. Your password will remain unchanged.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            Toronto East Christadelphian Ecclesia<br>
            This is an automated message, please do not reply to this email.
          </p>
        </div>
      </body>
    </html>
  `
}

function buildOtpHtml(): string {
  const magicLinkUrl = `${FAKE_BASE_URL}/auth/otp-callback?token=${FAKE_TOKEN}`
  return `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><title>Your verification code</title></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #333; margin-bottom: 20px;">Your Verification Code</h2>
          <p style="color: #666; line-height: 1.6;">
            Enter this code to verify your email address and sign in to TEE Admin:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="display: inline-block; background-color: #ffffff; border: 2px solid #007bff; border-radius: 8px; padding: 16px 32px;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">
                123456
              </span>
            </div>
          </div>
          <p style="color: #666; line-height: 1.6; text-align: center;">
            Or click this link to verify automatically:
          </p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${magicLinkUrl}"
               style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Verify Email Address
            </a>
          </div>
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${magicLinkUrl}" style="color: #007bff; word-break: break-all;">${magicLinkUrl}</a>
          </p>
          <p style="color: #999; line-height: 1.6; font-size: 13px;">
            This code expires in 10 minutes. If you didn't request this code, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            Toronto East Christadelphian Ecclesia<br>
            This is an automated message, please do not reply to this email.
          </p>
        </div>
      </body>
    </html>
  `
}

function rbShell(contextHtml: string, nextStepsHtml: string): string {
  const confirmUrl = `${FAKE_BASE_URL}/api/rb/confirm?token=${FAKE_TOKEN}`
  const denyUrl = `${FAKE_BASE_URL}/api/rb/confirm?token=${FAKE_TOKEN}&action=deny`
  const year = new Date().getFullYear()
  return `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><title>Recording Brother Verification</title></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #333; margin-bottom: 20px;">Recording Brother Verification</h2>
          <p style="color: #666; line-height: 1.6;">
            Hello <strong>Brother Smith</strong>,
          </p>
${contextHtml}
${nextStepsHtml}
          <div style="text-align: center; margin: 30px 0;">
            <a href="${confirmUrl}"
               style="background-color: #16a34a; color: white; padding: 14px 36px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px; margin-right: 12px;">
              Confirm
            </a>
            <a href="${denyUrl}"
               style="background-color: #6b7280; color: white; padding: 14px 36px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
              Deny
            </a>
          </div>
          <p style="color: #999; line-height: 1.6; font-size: 13px;">
            This link expires in 24 hours.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            Christadelphian Directory ${year}<br>
            This message was sent via TEE Admin on behalf of Toronto East.
          </p>
        </div>
      </body>
    </html>
  `
}

function buildRbDirectAssignmentHtml(): string {
  return rbShell(
    `          <p style="color: #666; line-height: 1.6;">
            You have been assigned as the Recording Brother of <strong>Toronto East</strong> by Admin User.
          </p>`,
    `          <p style="color: #666; line-height: 1.6;">
            By confirming, you will be registered as the Recording Brother and can manage how the Christadelphian Directory displays your ecclesia's information.
          </p>
          <p style="color: #666; line-height: 1.6;">
            Please click <strong>Confirm</strong> to accept, or <strong>Deny</strong> if this is not correct.
          </p>`,
  )
}

function buildRbNominationReceivedHtml(): string {
  const denyUrl = `${FAKE_BASE_URL}/api/rb/confirm?token=${FAKE_TOKEN}&action=deny`
  const year = new Date().getFullYear()
  return `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><title>Recording Brother Nomination</title></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #333; margin-bottom: 20px;">Recording Brother Nomination</h2>
          <p style="color: #666; line-height: 1.6;">
            Hello <strong>Brother Smith</strong>,
          </p>
          <p style="color: #666; line-height: 1.6;">
            You have been nominated as the Recording Brother of <strong>Toronto East</strong> by Bro. David Brown.
          </p>
          <p style="color: #666; line-height: 1.6;">
            Before the role can take effect, <strong>two other members</strong> of Toronto East need to second this nomination. Please ask two brothers or sisters in your ecclesia to log in to the Christadelphian Directory and second your nomination.
          </p>
          <p style="color: #666; line-height: 1.6;">
            Once two members have seconded, you will receive a follow-up email to confirm and activate the role.
          </p>
          <p style="color: #666; line-height: 1.6;">
            If this nomination is not correct, please click <strong>Deny</strong> below.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${denyUrl}"
               style="background-color: #6b7280; color: white; padding: 14px 36px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
              Deny Nomination
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            Christadelphian Directory ${year}<br>
            This message was sent via TEE Admin on behalf of Toronto East.
          </p>
        </div>
      </body>
    </html>
  `
}

function buildRbRoleActivatedHtml(): string {
  const baseUrl = FAKE_BASE_URL
  const year = new Date().getFullYear()
  return `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><title>Recording Brother — Role Activated</title></head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #333; margin-bottom: 20px;">You are now the Recording Brother</h2>
          <p style="color: #666; line-height: 1.6;">
            Hello <strong>Brother Smith</strong>,
          </p>
          <p style="color: #666; line-height: 1.6;">
            Your nomination as Recording Brother of <strong>Toronto East</strong> has been seconded by two members of your ecclesia. The role is now active.
          </p>
          <p style="color: #666; line-height: 1.6;">
            As Recording Brother, you can manage how your ecclesia appears in the Christadelphian Directory. To get started, sign in and visit your ecclesia's page to review and update your ecclesia's contact details, meeting times, and address.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/directory/ecclesias"
               style="background-color: #16a34a; color: white; padding: 14px 36px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
              Go to Ecclesial Directory
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            Christadelphian Directory ${year}<br>
            This message was sent via TEE Admin on behalf of Toronto East.
          </p>
        </div>
      </body>
    </html>
  `
}
