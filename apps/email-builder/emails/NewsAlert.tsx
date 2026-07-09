import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import React from 'react'
import {
  container,
  defaultText,
  globalCss,
  header,
  link,
  main,
} from '../styles'
import { FooterContent } from '../components/FooterContent'
import { EmailBrandLinkContent } from '../components/EmailBrandLinkContent'
import { AutoLinkText } from '../components/AutoLinkText'
import type { EmailIdentity } from '@my/app/types/brand-profile'

export type NewsAlertProps = {
  title: string
  /** The news item body — the actual information. Supports #/##, **bold**, - bullets, auto-linked URLs. */
  body?: string
  /** Absolute URL to the news details page (per-brand domain). */
  detailsUrl: string
  /** Optional poster preview (image URL or PDF page-1 thumbnail). */
  previewImageUrl?: string
  /**
   * Brand identity for the footer. Passed as a prop (not via the
   * EmailIdentityProvider context) so this template renders from an App Router
   * server route without invoking the `'use client'` provider element.
   */
  identity?: EmailIdentity
  /**
   * When true, the audience is other ecclesias' leaders — render the
   * "Please share with your ecclesia" framing instead of the standard header.
   * Driven by the selected audience, so it applies to test sends too.
   */
  interEcclesia?: boolean
  /** Sending ecclesia's display name, shown as "From {fromEcclesia}" in the inter-ecclesia header. */
  fromEcclesia?: string
}

const interEcclesiaHeaderStyle = {
  backgroundColor: '#4a5568',
  textAlign: 'center' as const,
  padding: '20px 24px',
  color: 'white',
}

const NewsAlert: React.FC<NewsAlertProps> = ({
  title,
  body,
  detailsUrl,
  previewImageUrl,
  identity,
  interEcclesia = false,
  fromEcclesia,
}) => {
  const previewText = interEcclesia ? `Please share with your ecclesia: ${title}` : title
  return (
    <Html lang="en">
      <Head>
        <style>{globalCss}</style>
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={main}>
        {interEcclesia ? (
          <Section style={interEcclesiaHeaderStyle}>
            <Text
              style={{
                fontSize: '12px',
                margin: '0 0 4px 0',
                color: '#e2e8f0',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              From {fromEcclesia ?? identity?.name ?? 'Toronto East Ecclesia'}
            </Text>
            <Heading style={{ color: 'white', margin: '0', fontSize: '24px', fontWeight: '600' }}>
              Please Share With Your Ecclesia
            </Heading>
          </Section>
        ) : (
          <Section style={header}>
            <Heading>{identity?.name ?? 'Toronto East Christadelphians'}</Heading>
            <EmailBrandLinkContent identity={identity} />
          </Section>
        )}

        <Container style={{ ...container, marginTop: '24px' }} className="container">
          <Heading as="h2" style={{ margin: '0 0 16px 0' }}>
            {title}
          </Heading>

          {previewImageUrl ? (
            <Section style={{ marginBottom: '16px' }}>
              <Link href={detailsUrl}>
                <Img
                  src={previewImageUrl}
                  alt={title}
                  style={{ width: '100%', maxWidth: '560px', height: 'auto', borderRadius: '8px' }}
                />
              </Link>
            </Section>
          ) : null}

          {body ? (
            <Section style={{ ...defaultText, marginBottom: '8px' }}>
              <AutoLinkText text={body} linkStyle={link} />
            </Section>
          ) : null}

          <Section style={{ marginTop: '28px' }}>
            <Link href={detailsUrl} style={link}>
              View this on the web →
            </Link>
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

export default NewsAlert
