'use client'

import React, { useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  Button,
  Checkbox,
  Heading,
  Paragraph,
  Text,
  XStack,
  YStack,
  Card,
  Separator
} from '@my/ui'
import { Wrapper } from '@my/app/provider/wrapper'
import { Section } from '@my/app/features/newsletter/Section'
import { LogInUser } from '@my/app/provider/auth/log-in-user'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { emailReasons } from 'next-app/utils/email/email-send'
import { Check, Send, Mail, AlertCircle } from '@tamagui/lucide-icons'
import { sendEmail } from '../../provider/get-data'

export const EmailSender: React.FC = () => {
  const { data: session } = useSession()
  const [email, setEmail] = useState<any>(null)
  const [reason, setReason] = useState<string | null>(null)
  const [test, setTest] = useState<boolean>(true) // Default to test mode for safety
  const [sending, setSending] = useState<boolean>(false)

  // Define all hooks before conditional returns
  if (!(session && session.user)) {
    return (
      <Wrapper>
        <Section space={'$4'}>
          <Heading size={5}>Email Sender</Heading>
          <Paragraph>To access this section of our site, please sign in.</Paragraph>
          <LogInUser />
        </Section>
      </Wrapper>
    )
  }

  // Check if user has admin or owner role
  const userRole = session.user.role
  if (userRole !== ROLES.ADMIN && userRole !== ROLES.OWNER) {
    return (
      <Wrapper>
        <Section space={'$4'}>
          <Heading size={5}>Access Denied</Heading>
          <Paragraph>You need admin or owner permissions to access the Email Sender.</Paragraph>
          <Paragraph>Current role: {userRole || 'None'}</Paragraph>
        </Section>
      </Wrapper>
    )
  }

  const getEmail = async (reason: emailReasons) => {
    setSending(true)
    setReason(reason)
    try {
      const response = await sendEmail(reason, test)
      setEmail(response)
    } catch (error) {
      console.error('Error sending email:', error)
      setEmail({ error: 'Failed to send email', details: error })
    } finally {
      setSending(false)
      setReason(null)
    }
  }

  const emailTypes = [
    {
      id: 'newsletter',
      label: 'Newsletter',
      description: 'Weekly newsletter with events and schedule',
      icon: Mail,
      color: '$blue10'
    },
    {
      id: 'recap',
      label: 'Memorial Info',
      description: 'Memorial service information and reminders',
      icon: Mail,
      color: '$green10'
    },
    {
      id: 'bible-class',
      label: 'Bible Class Info',
      description: 'Bible class schedule and topics',
      icon: Mail,
      color: '$purple10'
    },
    {
      id: 'sunday-school',
      label: 'Sunday School Info',
      description: 'Sunday school announcements',
      icon: Mail,
      color: '$orange10'
    }
  ]

  return (
    <Wrapper subHheader="Email Sender">
      <Section gap={'$4'}>
        <YStack gap="$4">
          {/* Test Mode Toggle */}
          <Card elevate bordered padding="$4" backgroundColor={test ? '$orange2' : '$red2'}>
            <XStack gap="$3" alignItems="center">
              {test ? (
                <AlertCircle size={20} color="$orange10" />
              ) : (
                <AlertCircle size={20} color="$red10" />
              )}
              <Text fontWeight="600" fontSize="$5">
                {test ? 'TEST MODE' : 'LIVE MODE'}
              </Text>
              <XStack flex={1} />
              <XStack gap="$2" alignItems="center">
                <Text>Send to test list:</Text>
                <Checkbox
                  onCheckedChange={(checked) => setTest(!!checked)}
                  checked={test}
                  aria-label={'Toggle Test Mode'}
                  size="$4"
                >
                  <Checkbox.Indicator>
                    <Check />
                  </Checkbox.Indicator>
                </Checkbox>
              </XStack>
            </XStack>
{!test ? (
              <Text fontSize="$3" color="$red10" marginTop="$2">
                ⚠️ WARNING: Emails will be sent to ALL subscribers (100+ recipients)
              </Text>
            ) : null}
          </Card>

          <Separator />

          {/* Email Type Selection */}
          <YStack gap="$3">
            <Heading size={4}>Select Email Type to Send</Heading>

            {sending ? (
              <Card
                elevate
                bordered
                padding="$6"
                backgroundColor="$background"
                animation="quick"
                animateOnly={['opacity']}
                opacity={0.8}
              >
                <YStack gap="$3" alignItems="center">
                  <Send size={32} color="$blue10" />
                  <Text fontSize="$5" textAlign="center">
                    Sending {reason}...
                  </Text>
                  <Text fontSize="$3" color="$gray11" textAlign="center">
                    Please wait, this may take a moment
                  </Text>
                </YStack>
              </Card>
            ) : (
              <XStack gap="$3" flexWrap="wrap">
                {emailTypes.map((type) => {
                  const Icon = type.icon
                  return (
                    <Card
                      key={type.id}
                      elevate
                      bordered
                      padding="$4"
                      pressStyle={{ scale: 0.98 }}
                      hoverStyle={{ scale: 1.02 }}
                      animation="quick"
                      width="calc(50% - $1.5)"
                      minWidth={250}
                      cursor="pointer"
                      onPress={() => getEmail(type.id as emailReasons)}
                    >
                      <YStack gap="$2">
                        <XStack gap="$2" alignItems="center">
                          <Icon size={24} color={type.color} />
                          <Text fontSize="$5" fontWeight="600">
                            {type.label}
                          </Text>
                        </XStack>
                        <Text fontSize="$3" color="$gray11">
                          {type.description}
                        </Text>
                      </YStack>
                    </Card>
                  )
                })}
              </XStack>
            )}
          </YStack>

          {/* Response Display */}
          {email ? (
            <Card elevate bordered padding="$4" backgroundColor="$background">
              <YStack gap="$3">
                <XStack justifyContent="space-between" alignItems="center">
                  <Heading size={4}>Email Send Response</Heading>
                  <Button size="$3" onPress={() => setEmail(null)}>
                    Clear Response
                  </Button>
                </XStack>

                <Card padding="$3" backgroundColor="$gray2">
                  {email.error ? (
                    <YStack gap="$2">
                      <Text color="$red10" fontWeight="600">Error: {email.error}</Text>
                      {email.details ? (
                        <Text fontSize="$3" color="$gray11">
                          {JSON.stringify(email.details, null, 2)}
                        </Text>
                      ) : null}
                    </YStack>
                  ) : (
                    <YStack gap="$2">
                      {email.sends ? (
                        <Text color="$green10">
                          ✅ Successfully sent to {email.sends.length} recipients
                        </Text>
                      ) : null}
                      {email.skips && email.skips.length > 0 ? (
                        <Text color="$orange10">
                          ⚠️ Skipped {email.skips.length} recipients
                        </Text>
                      ) : null}
                      <Separator marginVertical="$2" />
                      <Text fontSize="$2" fontFamily="$mono" color="$gray11">
                        {JSON.stringify(email, null, 2)}
                      </Text>
                    </YStack>
                  )}
                </Card>
              </YStack>
            </Card>
          ) : null}
        </YStack>
      </Section>
    </Wrapper>
  )
}