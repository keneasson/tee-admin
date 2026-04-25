import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import {
  container,
  defaultText,
  globalCss,
  header,
  main,
} from '../styles'
import React from 'react'
import { Footer } from '../components/Footer'

export type EditRequestEmailProps = {
  targetName: string
  requesterName: string
  requesterEmail: string
  field: 'name' | 'email' | 'phone' | 'address'
  currentValue?: string
  suggestedValue: string
  message?: string
  approveUrl: string
  rejectUrl: string
  viewAllUrl: string
}

const fieldLabels: Record<string, string> = {
  name: 'Name',
  email: 'Email Address',
  phone: 'Phone Number',
  address: 'Address',
}

const EditRequestEmail: React.FC<EditRequestEmailProps> = ({
  targetName,
  requesterName,
  requesterEmail,
  field,
  currentValue,
  suggestedValue,
  message,
  approveUrl,
  rejectUrl,
  viewAllUrl,
}) => {
  const fieldLabel = fieldLabels[field] || field

  return (
    <Html lang="en">
      <Head>
        <style>{globalCss}</style>
      </Head>
      <Preview>
        {requesterName} suggested an edit to your {fieldLabel.toLowerCase()}
      </Preview>
      <Body style={main}>
        <Section style={header}>
          <Heading>Contact Information Update</Heading>
          <Text style={defaultText}>
            Toronto East Christadelphian Ecclesia
          </Text>
        </Section>

        <Container style={{ ...container, marginTop: '24px' }}>
          <Section>
            <Text style={{ ...defaultText, fontSize: '18px', fontWeight: '600' }}>
              Hi {targetName},
            </Text>

            <Text style={defaultText}>
              <strong>{requesterName}</strong> ({requesterEmail}) has suggested an update
              to your <strong>{fieldLabel.toLowerCase()}</strong> in the TEE contact directory.
            </Text>

            {/* Current vs Suggested Values */}
            <Section
              style={{
                backgroundColor: '#f5f5f5',
                padding: '16px',
                borderRadius: '8px',
                marginTop: '20px',
                marginBottom: '20px',
              }}
            >
              {currentValue ? (
                <>
                  <Text style={{ ...defaultText, margin: '0 0 8px 0' }}>
                    <strong>Current {fieldLabel}:</strong>
                  </Text>
                  <Text
                    style={{
                      ...defaultText,
                      margin: '0 0 16px 0',
                      color: '#666',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {currentValue}
                  </Text>
                </>
              ) : null}

              <Text style={{ ...defaultText, margin: '0 0 8px 0' }}>
                <strong>Suggested {fieldLabel}:</strong>
              </Text>
              <Text
                style={{
                  ...defaultText,
                  margin: '0',
                  color: '#0066cc',
                  fontWeight: '500',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {suggestedValue}
              </Text>
            </Section>

            {/* Optional Message */}
            {message ? (
              <Section
                style={{
                  backgroundColor: '#fff3cd',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  borderLeft: '4px solid #ffc107',
                }}
              >
                <Text style={{ ...defaultText, margin: '0 0 4px 0', fontWeight: '600' }}>
                  Message from {requesterName}:
                </Text>
                <Text style={{ ...defaultText, margin: '0', fontStyle: 'italic' }}>
                  &quot;{message}&quot;
                </Text>
              </Section>
            ) : null}

            {/* Email field warning */}
            {field === 'email' ? (
              <Section
                style={{
                  backgroundColor: '#f8d7da',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  borderLeft: '4px solid #dc3545',
                }}
              >
                <Text style={{ ...defaultText, margin: '0', color: '#721c24' }}>
                  <strong>Note:</strong> Changing your email address will require
                  additional verification. You&apos;ll need to sign in to complete this change.
                </Text>
              </Section>
            ) : null}

            <Hr style={{ borderColor: '#e0e0e0', margin: '24px 0' }} />

            {/* Action Buttons */}
            <Text style={{ ...defaultText, textAlign: 'center', marginBottom: '16px' }}>
              Would you like to accept this suggestion?
            </Text>

            <Section style={{ textAlign: 'center' }}>
              <Button
                href={approveUrl}
                style={{
                  backgroundColor: '#28a745',
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  fontWeight: '600',
                  textDecoration: 'none',
                  display: 'inline-block',
                  marginRight: '12px',
                }}
              >
                Approve
              </Button>
              <Button
                href={rejectUrl}
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  fontWeight: '600',
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                Reject
              </Button>
            </Section>

            <Text
              style={{
                ...defaultText,
                textAlign: 'center',
                marginTop: '24px',
                fontSize: '14px',
                color: '#666',
              }}
            >
              Or{' '}
              <a href={viewAllUrl} style={{ color: '#0066cc' }}>
                sign in to TEE Admin
              </a>{' '}
              to view and manage all edit requests.
            </Text>

            <Hr style={{ borderColor: '#e0e0e0', margin: '24px 0' }} />

            <Text style={{ ...defaultText, fontSize: '13px', color: '#666' }}>
              This link will expire in 7 days. If you didn&apos;t expect this email,
              you can safely ignore it or reject the suggestion.
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

export default EditRequestEmail
