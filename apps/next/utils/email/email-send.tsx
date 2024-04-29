import SESTransport from 'nodemailer/lib/ses-transport'

import nodemailer from 'nodemailer'
import * as aws from '@aws-sdk/client-sesv2'
import { defaultProvider } from '@aws-sdk/credential-provider-node'

const adminMailDomain = '@tee-admin.com'

const date = new Date()
export type emailReasons = 'sunday-school' | 'newsletter' | 'bible-class' | 'recap'

const senders = {
  'sunday-school': {
    name: 'Toronto East Sunday School',
    email: 'sunday.school',
    subject: 'Sunday School Tomorrow',
  },
  newsletter: {
    name: 'Toronto East Ecclesia',
    email: 'newsletter',
    subject: 'Toronto East Christadelphian Ecclesia Newsletter',
  },
  'bible-class': {
    name: 'Toronto East Ecclesia',
    email: 'bible.class',
    subject: 'Bible Class Tonight!',
  },
  recap: {
    name: 'Toronto East Ecclesia',
    email: 'newsletter',
    subject: 'Memorial Service Tomorrow',
  },
}

export type emailSendProps = {
  reason: emailReasons
  emailHtml: string
  emailText: string
}

export const emailSend = async function ({ reason, emailHtml, emailText }: emailSendProps) {
  const ses = new aws.SESv2Client({
    apiVersion: '2010-12-01',
    region: 'ca-central-1',
    ...defaultProvider,
  })
  const transporter = nodemailer.createTransport({
    SES: { ses, aws },
  })

  transporter.sendMail(
    {
      from: `"${senders[reason].name}" <${senders[reason].email}${adminMailDomain}>`,
      to: 'connect@tee-admin.com',
      subject: senders[reason].subject,
      text: emailText,
      html: emailHtml,
    },
    (err: Error | null, info: SESTransport.SentMessageInfo) => {
      if (err) {
        throw err
      }
      return Promise.resolve(info)
    }
  )
}
