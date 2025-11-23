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
import { Footer } from '../components/Footer'

export type CustomEmailProps = {
  htmlContent: string
  subject?: string
  note?: string
}

const CustomEmail: React.FC<CustomEmailProps> = ({ htmlContent, subject, note }) => {
  const todaysDate = new Date().toDateString()

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
              {note}
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
        <Footer />
      </Body>
    </Html>
  )
}

export default CustomEmail
