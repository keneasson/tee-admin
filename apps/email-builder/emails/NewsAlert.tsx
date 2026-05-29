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
import React from 'react'
import {
  container,
  defaultText,
  globalCss,
  header,
  main,
} from '../styles'
import { Footer } from '../components/Footer'
import { AutoLinkText } from '../components/AutoLinkText'

export type NewsAlertProps = {
  title: string
  body: string
}

const NewsAlert: React.FC<NewsAlertProps> = ({ title, body }) => {
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

          <Section>
            <Text style={{ ...defaultText, whiteSpace: 'pre-wrap' }}>
              <AutoLinkText text={body} />
            </Text>
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
