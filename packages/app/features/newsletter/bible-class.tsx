import React from 'react'
import { ChevronDown, MapPin } from '@tamagui/lucide-icons'
import { Accordion, Anchor, ExtLink, Paragraph, Separator, Square, Text, YStack, XStack, useThemeName } from '@my/ui'
import { brandColors, type ColorMode } from '@my/ui/src/branding/brand-colors'

import { BibleClassType } from '@my/app/types'
import { Section } from '@my/app/features/newsletter/Section'

type NextBibleClassProps = {
  event: BibleClassType
}
export const NextBibleClass: React.FC<NextBibleClassProps> = ({ event }) => {
  const themeName = useThemeName()
  const colorMode: ColorMode = themeName?.includes('dark') ? 'dark' : 'light'
  const colors = brandColors[colorMode]

  const isJoint = !!event.Host
  const hasInPerson = !!event.InPerson
  const hasCustomZoom = !!(event.ZoomURL || event.MeetingID)

  if (!event.Speaker) {
    return (
      <Section>
        <Paragraph size={'$5'} fontWeight={600}>
          {event.Date.toString()}
        </Paragraph>
        <Paragraph>{event.Topic}</Paragraph>
      </Section>
    )
  }

  return (
    <Section>
      {/* Joint Bible Class — prominent banner */}
      {isJoint ? (
        <YStack
          backgroundColor="$blue2"
          padding="$3"
          borderRadius="$3"
          marginBottom="$3"
          borderLeftWidth={4}
          borderLeftColor="$blue9"
        >
          <Text color={colors.primary} fontSize="$2" fontWeight={700} textTransform="uppercase" letterSpacing={1}>
            Special Notice
          </Text>
          <Text color={colors.primary} fontSize="$7" fontWeight={800}>
            {event.MetaData || `Joint Bible Class with ${event.Host}`}
          </Text>
          <Text color={colors.textSecondary} fontSize="$5" fontWeight={600}>
            {event.Date.toString()} at 7:30pm{hasInPerson ? ' — In Person & Zoom' : ' — on Zoom'}
          </Text>
        </YStack>
      ) : (
        <>
          <Paragraph size={'$5'} fontWeight={600}>
            {event.Date.toString()}
          </Paragraph>
          <Paragraph size={'$5'} fontWeight={600}>
            Bible Class at 7:30pm
          </Paragraph>
        </>
      )}

      <Paragraph>
        <Text fontWeight={600}>Presiding:</Text> {event.Presider}
      </Paragraph>
      <Paragraph>
        <Text fontWeight={600}>Leader:</Text> {event.Speaker}
      </Paragraph>
      {event.Topic ? <Paragraph fontWeight={600}>{event.Topic}</Paragraph> : null}

      {/* In-person location card for joint classes */}
      {isJoint && hasInPerson ? (
        <YStack
          backgroundColor="$green3"
          padding="$3"
          borderRadius="$2"
          borderLeftWidth={4}
          borderLeftColor="$green9"
          marginTop="$2"
        >
          <XStack gap="$2" alignItems="center">
            <MapPin size={16} />
            <Paragraph fontWeight={700}>
              In Person at {event.Host}
              {event.resolvedVenue ? ` — ${event.resolvedVenue}` : ''}
            </Paragraph>
          </XStack>
          {event.resolvedAddress ? (
            <Paragraph paddingLeft="$4">{event.resolvedAddress}</Paragraph>
          ) : null}
          {event.resolvedMapUrl ? (
            <Anchor href={event.resolvedMapUrl} target="_blank" paddingLeft="$4" paddingTop="$1">
              <XStack gap="$1" alignItems="center">
                <MapPin size={14} color="$blue10" />
                <Text fontWeight={600} color="$blue10">View on Google Maps</Text>
              </XStack>
            </Anchor>
          ) : null}
        </YStack>
      ) : null}

      {/* Zoom details accordion */}
      <Accordion overflow="hidden" type="multiple">
        <Accordion.Item value="a1">
          <Accordion.Trigger flexDirection="row" justifyContent="space-between">
            {({ open }: { open: boolean }) => (
              <>
                <Paragraph>
                  {isJoint && hasCustomZoom
                    ? `${event.Host}'s Zoom - Click to open`
                    : 'Zoom Info - Click to open'}
                </Paragraph>
                <Square animation="quick" rotate={open ? '180deg' : '0deg'}>
                  <ChevronDown size="$1" />
                </Square>
              </>
            )}
          </Accordion.Trigger>
          <Accordion.Content>
            <Paragraph fontWeight={600}>Join Zoom Meeting</Paragraph>
            {/* Use host Zoom if available, otherwise default Toronto East */}
            {hasCustomZoom ? (
              <>
                {event.ZoomURL ? (
                  <ExtLink href={event.ZoomURL}>Click to Join Zoom</ExtLink>
                ) : null}
                {event.MeetingID ? (
                  <Paragraph>Meeting ID: {event.MeetingID}</Paragraph>
                ) : null}
                {event.MeetingPwd ? (
                  <Paragraph>Password: {event.MeetingPwd}</Paragraph>
                ) : null}
              </>
            ) : (
              <>
                <ExtLink href="https://us02web.zoom.us/j/932385033?pwd=R1VOR3NDOTk1cXN2ZzFOdW14SnhxZz09">
                  Click to Join Zoom
                </ExtLink>
                <Paragraph>Meeting ID: 932 385 033</Paragraph>
                <Paragraph>Passcode: 456345</Paragraph>
                <Separator alignSelf="stretch" borderColor={'$borderColor'} />
                <Paragraph>One tap mobile</Paragraph>
                <Paragraph>
                  <ExtLink href="tel:+14388097799,,932385033#,,,,*456345#">
                    +14388097799,,932385033#,,,,*456345#
                  </ExtLink>{' '}
                  Canada
                </Paragraph>
                <Paragraph>
                  <ExtLink href="tel:+15873281099,,932385033#,,,,*456345#">
                    +15873281099,,932385033#,,,,*456345#
                  </ExtLink>{' '}
                  Canada
                </Paragraph>
                <Separator alignSelf="stretch" borderColor={'$borderColor'} />
                <Paragraph>
                  Find your local number:{' '}
                  <ExtLink href="https://us02web.zoom.us/u/kbHWW6VEKW">
                    https://us02web.zoom.us/u/kbHWW6VEKW
                  </ExtLink>
                </Paragraph>
              </>
            )}
          </Accordion.Content>
        </Accordion.Item>
      </Accordion>
    </Section>
  )
}
