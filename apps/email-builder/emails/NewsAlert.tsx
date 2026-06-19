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
import React from 'react'
import {
  container,
  globalCss,
  header,
  link,
  main,
} from '../styles'
import { Footer } from '../components/Footer'

export type NewsAlertProps = {
  title: string
  /** Absolute URL to the news details page (per-brand domain). */
  detailsUrl: string
}

const NewsAlert: React.FC<NewsAlertProps> = ({ title, detailsUrl }) => {
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

          <Section style={{ marginTop: '8px' }}>
            <Link href={detailsUrl} style={link}>
              Click to read →
            </Link>
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

export default NewsAlert
