import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import {
  container,
  defaultText,
  globalCss,
  header,
  link,
  main,
} from '../styles'
import React from 'react'
import { FooterContent } from '../components/FooterContent'
import { EmailBrandLinkContent } from '../components/EmailBrandLinkContent'
import { AutoLinkText } from '../components/AutoLinkText'
import type { EmailIdentity } from '@my/app/types/brand-profile'

export type CustomEmailProps = {
  htmlContent: string
  subject?: string
  note?: string
  /** Brand identity for footer/header — passed as a prop (not the client EmailIdentityProvider) so this renders from an App Router server route. */
  identity?: EmailIdentity
}

const CustomEmail: React.FC<CustomEmailProps> = ({ htmlContent, subject, note, identity }) => {
  const todaysDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Toronto',
  })

  return (
    <Html lang="en">
      <Head>
        <style>{globalCss}</style>
        <style>{`
          .custom-content ul {
            margin: 12px 0;
            padding-left: 24px;
          }
          .custom-content li {
            margin: 6px 0;
            line-height: 1.6;
          }
          .custom-content p {
            margin: 12px 0;
            line-height: 1.6;
          }
          .custom-content strong {
            font-weight: 600;
          }
          .custom-content a {
            color: #0066cc;
            text-decoration: none;
            font-weight: 600;
          }
          .custom-content a:hover {
            text-decoration: underline;
          }
        `}</style>
      </Head>
      <Preview>{subject || 'Toronto East Communications'}</Preview>
      <Body style={main}>
        <Section style={header}>
          <Heading>Toronto East Communications</Heading>
          <Text style={defaultText}>{todaysDate}</Text>
          <Text style={defaultText}>
            This email is intended for Christadelphians and friends, whether we meet in person or on Zoom.
            <br />
            All plans are subject to God&apos;s will.
          </Text>
          <EmailBrandLinkContent identity={identity} />
        </Section>

        {/* Optional Note Section */}
        {note && note.trim() && (
          <Section style={{
            backgroundColor: '#fff3cd',
            padding: '16px',
            marginTop: '20px',
            marginBottom: '20px',
            borderRadius: '4px'
          }}>
            <Text style={{
              ...defaultText,
              margin: '0 0 8px 0',
              fontWeight: 'bold'
            }}>
              Note:
            </Text>
            <Text style={{
              ...defaultText,
              margin: '0',
              whiteSpace: 'pre-wrap'
            }}>
              <AutoLinkText text={note} />
            </Text>
          </Section>
        )}

        <Container style={{ ...container, marginTop: '24px' }} className="container">
          <Section>
            <div
              className="custom-content"
              style={defaultText}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </Section>
        </Container>

        <Container>
          <Text>&nbsp;</Text>
        </Container>
        <FooterContent identity={identity} />
      </Body>
    </Html>
  )
}

export default CustomEmail
