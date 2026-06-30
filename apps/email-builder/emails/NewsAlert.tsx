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
  globalCss,
  header,
  link,
  main,
} from '../styles'
import { Footer } from '../components/Footer'
import type { EmailIdentity } from '@my/app/types/brand-profile'

export type NewsAlertProps = {
  title: string
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
}

const NewsAlert: React.FC<NewsAlertProps> = ({ title, detailsUrl, previewImageUrl, identity }) => {
  return (
    <Html lang="en">
      <Head>
        <style>{globalCss}</style>
      </Head>
      <Preview>{title}</Preview>
      <Body style={main}>
        <Section style={header}>
          <Heading>Toronto East Communications</Heading>
        </Section>

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

          <Section style={{ marginTop: '8px' }}>
            <Link href={detailsUrl} style={link}>
              Click to read →
            </Link>
          </Section>
        </Container>

        <Container>
          <Text>&nbsp;</Text>
        </Container>
        <Footer identity={identity} />
      </Body>
    </Html>
  )
}

export default NewsAlert
