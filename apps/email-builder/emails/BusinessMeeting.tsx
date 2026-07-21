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

export type BusinessMeetingProps = {
  note?: string
  /** Brand identity for footer/header — passed as a prop (not the client EmailIdentityProvider) so this renders from an App Router server route. */
  identity?: EmailIdentity
}

const BusinessMeeting: React.FC<BusinessMeetingProps> = ({ note, identity }) => {
  return (
    <Html lang="en">
      <Head>
        <style>{globalCss}</style>
      </Head>
      <Preview>Business Meeting Details</Preview>
      <Body style={main}>
        <Section style={header}>
          <Heading>Toronto East Christadelphians</Heading>
          <Text style={defaultText}>Business Meeting</Text>
          <Text style={defaultText}>All arrangements are subject to God&apos;s will.</Text>
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
            <Text style={defaultText}>
              Here are the details and documents for tonight&apos;s Business Meeting at 7:30pm
            </Text>
          </Section>

          <Section>
            <Heading style={{ ...defaultText, fontSize: '18px', marginTop: '20px' }}>
              Join the Meeting
            </Heading>
            <Text style={defaultText}>
              <strong>Zoom Link:</strong>
              <br />
              <Link
                href="https://us02web.zoom.us/j/87350549728?pwd=svWOvuIa1imkazZBF6nweavnjGwnyO.1"
                style={link}
              >
                Click to join Zoom
              </Link>
            </Text>
            <Text style={defaultText}>
              <strong>Meeting ID:</strong> 87350549728
              <br />
              <strong>Password:</strong> 238401
              <br />
              <strong>Dial-in:</strong> 1 647 374 4685
            </Text>
          </Section>

          <hr />

          <Section>
            <Heading style={{ ...defaultText, fontSize: '18px', marginTop: '20px' }}>
              Meeting Documents
            </Heading>
            <Text style={defaultText}>
              <Link
                href="https://docs.google.com/document/d/1HwEj5Xnll6iZ5SDk5HEvIP8xG5e7M0VnE8Na3uPiLm0/edit?usp=drive_link"
                style={link}
              >
                2025-10-29 Semi Annual Business Meeting Agenda
              </Link>
              <br />
              <br />
              <Link
                href="https://docs.google.com/document/d/1qR0NiW2JLzJ3dpfLFkaiwUEcpC0ezdjOrWyXLhFvJ2E/edit?usp=drive_link"
                style={link}
              >
                2025-04-16 Semi Annual Business Meeting Minutes
              </Link>
              <br />
              <br />
              <Link
                href="https://docs.google.com/document/d/1z1YFVQxddaOL5LOpsn5tttGiN2BmMiuFsO7l0Fmgk4I/edit?usp=drive_link"
                style={link}
              >
                2025-10-14 AB Meeting Minutes (Not Approved by AB&apos;s)
              </Link>
              <br />
              <br />
              <Link
                href="https://docs.google.com/document/d/15DBRTfVllsrqsiKBu48ylX2sB4XPLqfo8X44EGS65i0/edit?usp=drive_link"
                style={link}
              >
                2025-09-02 AB Meeting Minutes
              </Link>
              <br />
              <br />
              <Link
                href="https://docs.google.com/document/d/109D5RjlNG6k9IUxJxNjqYxMM25yszexgMV1DE7zI67A/edit?usp=drive_link"
                style={link}
              >
                2025-05-20 AB Meeting Minutes
              </Link>
            </Text>
          </Section>

          <hr />

          <Section>
            <Heading style={{ ...defaultText, fontSize: '18px', marginTop: '20px' }}>
              Constitution and Proposed Amendment
            </Heading>
            <Text style={defaultText}>
              <Link
                href="https://docs.google.com/document/d/1iDOfn815oHmrOBtSvmQUthuyfBAAGMPWmPe2t-8_cHE/edit?usp=drive_link"
                style={link}
              >
                TEE Constitution
              </Link>
              <br />
              <br />
              <Link
                href="https://docs.google.com/document/d/1iIEr66zHcGGjiA15H7Xff45DUXUb9utmzGSX8hVaJ6c/edit?usp=drive_link"
                style={link}
              >
                Ecclesial Constitution Amendments
              </Link>
            </Text>
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

export default BusinessMeeting
