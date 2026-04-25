import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import {
  container,
  defaultText,
  globalCss,
  main,
} from '../styles'
import React from 'react'
import { InterEcclesiaFooter } from '../components/InterEcclesiaFooter'

export interface InterEcclesiaWrapperProps {
  /**
   * The type of event being announced
   */
  eventType: 'funeral' | 'baptism' | 'engagement' | 'wedding' | 'study-weekend' | 'general'

  /**
   * Main title/subject of the announcement
   */
  title: string

  /**
   * Preview text for email clients
   */
  previewText?: string

  /**
   * The ecclesia originating this announcement
   */
  fromEcclesia?: string

  /**
   * React children - the preferred way to pass event content
   */
  children?: React.ReactNode

  /**
   * Legacy: The inner HTML content (for funeral/baptism backwards compatibility)
   * @deprecated Use children instead
   */
  innerHtml?: string

  /**
   * Token-based URL for updating contact info (optional)
   */
  updateContactUrl?: string
}

// Mock data for preview
const mockData = {
  title: 'Study Weekend - The Kingdom of God',
  previewText: 'Please share with your ecclesia',
}

const interEcclesiaHeader = {
  backgroundColor: '#4a5568',
  textAlign: 'center' as const,
  padding: '20px 24px',
  color: 'white',
}

const InterEcclesiaWrapper: React.FC<InterEcclesiaWrapperProps> = ({
  title = mockData.title,
  previewText = mockData.previewText,
  children,
  innerHtml,
  updateContactUrl,
}) => {
  return (
    <Html lang="en">
      <Head>
        <style>{globalCss}</style>
      </Head>
      <Preview>{previewText || `Inter-Ecclesia: ${title}`}</Preview>
      <Body style={main}>
        {/* Inter-Ecclesia Header */}
        <Section style={interEcclesiaHeader}>
          <Text style={{ fontSize: '12px', margin: '0 0 4px 0', color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Inter-Ecclesia Communication
          </Text>
          <Heading style={{ color: 'white', margin: '0', fontSize: '24px', fontWeight: '600' }}>
            Please Share With Your Ecclesia
          </Heading>
        </Section>

        {/* Inner Content - prefer children, fallback to innerHtml for legacy support */}
        {children ? (
          <Container style={container}>
            {children}
          </Container>
        ) : innerHtml ? (
          <Container style={container}>
            <div dangerouslySetInnerHTML={{ __html: innerHtml }} />
          </Container>
        ) : (
          <Container style={container}>
            <Section style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#f7fafc', borderRadius: '8px', margin: '20px 0' }}>
              <Text style={{ ...defaultText, color: '#718096', margin: '0' }}>
                [Event content will appear here]
              </Text>
              <Text style={{ ...defaultText, fontSize: '14px', color: '#a0aec0', margin: '8px 0 0 0' }}>
                This is a preview placeholder. In production, the full event announcement will be displayed.
              </Text>
            </Section>
          </Container>
        )}

        {/* Spacer before footer */}
        <Container style={{ marginTop: '24px' }}>
          <Text>&nbsp;</Text>
        </Container>

        {/* Inter-Ecclesia Footer */}
        <InterEcclesiaFooter updateContactUrl={updateContactUrl} />
      </Body>
    </Html>
  )
}

export default InterEcclesiaWrapper
