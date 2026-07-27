import { MemorialServiceType } from '@my/app/types'
import type { Event } from '@my/app/types/events'
import React from 'react'
import { Accordion, Anchor, ExtLink, Paragraph, Separator, Square, Text, YStack } from '@my/ui'
import { XStack } from 'tamagui'
import { ChevronDown, MapPin } from '@tamagui/lucide-icons'
import { Section } from '@my/app/features/newsletter/Section'
import { resolveNoInPersonServicesMessage } from '@my/app/config/service-messages'
import { AttendOptions } from '@my/app/features/newsletter/attend-options'

/** Find an event by title (case-insensitive substring match) */
function findReplacementEvent(
  upcomingEvents: Event[],
  eventTitle: string
): Event | undefined {
  if (!eventTitle || !upcomingEvents?.length) return undefined
  const needle = eventTitle.trim().toLowerCase()
  return upcomingEvents.find((e) => e.title?.toLowerCase().includes(needle))
}

type NextMemorialProps = {
  event: MemorialServiceType
  isSameDay: boolean
  /** Upcoming events list — used to find replacement event when services are cancelled */
  upcomingEvents?: Event[]
}
export const NextMemorial: React.FC<NextMemorialProps> = ({ event, isSameDay, upcomingEvents }) => {
  // Per-occurrence override precedence:
  // - 'cancelled' forces the no-service branch (with optional custom message)
  // - 'active' forces the normal service render even if the roster is blank
  // - otherwise fall back to the synced heuristic (both Exhort AND Preside blank)
  const isCancelled = event.overrideStatus === 'cancelled'
  const isForcedActive = event.overrideStatus === 'active'
  const noServiceAtHall = isCancelled || (!isForcedActive && !event.Exhort && !event.Preside)

  if (noServiceAtHall) {
    // The Lunch field contains the event title to match (same convention as email template)
    const eventTitle = (event as any).Lunch?.trim()
    const replacementEvent = eventTitle && upcomingEvents
      ? findReplacementEvent(upcomingEvents, eventTitle)
      : undefined
    // Use Activities field as fallback explanation
    const explanation = event.Activities

    return (
      <Section>
        <Paragraph size={'$5'} fontWeight={600}>
          {event.Date.toString()}
        </Paragraph>
        <Paragraph fontWeight={600}>
          {event.overrideMessage || resolveNoInPersonServicesMessage(replacementEvent?.noInPersonServicesMessage)}
        </Paragraph>
        {event.overrideNote ? <Paragraph>{event.overrideNote}</Paragraph> : null}
        {explanation ? <Paragraph>{explanation}</Paragraph> : null}

        {/* Replacement event details */}
        {replacementEvent ? (
          <YStack gap="$2" marginTop="$3" padding="$3" backgroundColor="$backgroundHover" borderRadius="$3" borderLeftWidth={4} borderLeftColor="$blue9">
            <Anchor href={`/events/${replacementEvent.id}`} textDecorationLine="none">
              <Paragraph size="$6" fontWeight={700} color="$color">
                {replacementEvent.title}
              </Paragraph>
            </Anchor>

            {replacementEvent.hostingEcclesia?.name ? (
              <Paragraph>
                <Text fontWeight={600}>Hosted by:</Text> {replacementEvent.hostingEcclesia.name}
                {replacementEvent.hostingEcclesia.city ? `, ${replacementEvent.hostingEcclesia.city}` : ''}
              </Paragraph>
            ) : null}

            {replacementEvent.description ? (
              <Paragraph color="$gray11">{replacementEvent.description}</Paragraph>
            ) : null}

            {replacementEvent.location ? (
              <YStack gap="$1">
                {replacementEvent.location.name ? (
                  <XStack gap="$2" alignItems="center">
                    <MapPin size={14} />
                    <Paragraph fontWeight={600}>{replacementEvent.location.name}</Paragraph>
                  </XStack>
                ) : null}
                {replacementEvent.location.address ? (
                  <Paragraph paddingLeft="$4" color="$gray11">
                    {[replacementEvent.location.address, replacementEvent.location.city, replacementEvent.location.province].filter(Boolean).join(', ')}
                  </Paragraph>
                ) : null}
              </YStack>
            ) : null}

            {replacementEvent.registration?.registrationUrl ? (
              <Paragraph>
                <Text fontWeight={600}>
                  {replacementEvent.registration.required && replacementEvent.registration.required !== 'false'
                    ? 'Registration Required'
                    : 'Registration'}
                </Text>
                {' — '}
                <Text
                  color="$blue10"
                  textDecorationLine="underline"
                  cursor="pointer"
                  onPress={() => {
                    if (typeof window !== 'undefined') window.open(replacementEvent.registration!.registrationUrl, '_blank')
                  }}
                >
                  click here
                </Text>
              </Paragraph>
            ) : null}

            <Anchor href={`/events/${replacementEvent.id}`}>
              <Text color="$blue10" fontWeight={600}>View full details →</Text>
            </Anchor>
          </YStack>
        ) : null}
      </Section>
    )
  }

  // If Exhort is blank but Preside has a value, exhorter is TBD (show "--")
  const exhorterDisplay = event.Exhort || '--'
  // Per-occurrence attend-options supersede the hardcoded Zoom accordion.
  const hasAttendOptions = !!event.attendOptions && event.attendOptions.length > 0

  return (
    <Section>
      {!isSameDay ? (
        <Paragraph size={'$5'} fontWeight={600}>
          {event.Date.toString()}
        </Paragraph>
      ) : null}
      <Paragraph size={'$5'} fontWeight={600}>
        Memorial Service at 11:00am
      </Paragraph>
      {event.overrideNote ? (
        <Paragraph fontWeight={600} color="$blue11">{event.overrideNote}</Paragraph>
      ) : null}
      <XStack $xs={{ flexDirection: 'column' }}>
        <YStack flexGrow={1}>
          <Paragraph>
            <Text fontWeight={600}>Presiding: </Text>
            <Text>{event.Preside}</Text>
          </Paragraph>
          <Paragraph>
            <Text fontWeight={600}>Exhorting: </Text>
            <Text>{exhorterDisplay}</Text>
          </Paragraph>
          <Paragraph>
            <Text fontWeight={600}>Organist: </Text>
            <Text>{event.Organist}</Text>
          </Paragraph>
          <Paragraph>
            <Text fontWeight={600}>Steward: </Text>
            <Text>{event.Steward}</Text>
          </Paragraph>
          <Paragraph>
            <Text fontWeight={600}>Doorkeeper: </Text>
            <Text>{event.Doorkeeper}</Text>
          </Paragraph>
        </YStack>
        {event['Hymn-opening'] ? (
          <YStack flexGrow={1}>
            <Paragraph fontWeight={600}>Hymns:</Paragraph>
            <Paragraph>{event['Hymn-opening']}</Paragraph>
            <Paragraph>{event['Hymn-exhortation']}</Paragraph>
            <Paragraph>{event['Hymn-memorial']}</Paragraph>
            <Paragraph>{event['Hymn-closing']}</Paragraph>
          </YStack>
        ) : null}
      </XStack>
      {event.Collection ? <Paragraph>Second Collection is for {event.Collection}</Paragraph> : null}
      {event.Lunch ? <Paragraph fontWeight={600}>{event.Lunch}</Paragraph> : null}
      {event.Activities ? <Paragraph>{event.Activities}</Paragraph> : null}
      {hasAttendOptions ? <AttendOptions options={event.attendOptions} /> : null}
      <Separator alignSelf="stretch" borderColor={'$light4grey'} />
      <Accordion overflow="hidden" type="multiple">
        {!hasAttendOptions ? (
        <Accordion.Item value="a1">
          <Accordion.Trigger flexDirection="row" justifyContent="space-between">
            {({ open }: { open: boolean }) => (
              <>
                <Text>Zoom Info - Click to open</Text>
                <Square animation="quick" rotate={open ? '180deg' : '0deg'}>
                  <ChevronDown size="$1" />
                </Square>
              </>
            )}
          </Accordion.Trigger>
          <Accordion.Content>
            <Paragraph fontWeight={600}>Join Zoom Meeting</Paragraph>
            <ExtLink href="https://us02web.zoom.us/j/586952386?pwd=Z2svVG0zTmNlTWx2MTFoMlZIaDZLQT09">
              <Text>Click to Join Zoom</Text>
            </ExtLink>
            <Paragraph>Meeting ID: 586 952 386</Paragraph>
            <Paragraph>Passcode: 036110</Paragraph>
            <Separator alignSelf="stretch" borderColor={'$borderColor'} />
            <Paragraph>One tap mobile</Paragraph>
            <Paragraph>
              <ExtLink href="tel:+14388097799,,586952386#,,,,*036110# Canada">
                <Text>+14388097799,,586952386#,,,,*036110#</Text>
              </ExtLink>
              <Text> Canada</Text>
            </Paragraph>
            <Paragraph>
              <ExtLink href="tel:+15873281099,,586952386#,,,,*036110# Canada">
                <Text>+15873281099,,586952386#,,,,*036110#</Text>
              </ExtLink>
              <Text> Canada</Text>
            </Paragraph>
            <Separator alignSelf="stretch" borderColor={'$borderColor'} />
            <Paragraph>
              <Text>Find your local number: </Text>
              <ExtLink href="https://us02web.zoom.us/u/kc1iqj9IRk">
                <Text>https://us02web.zoom.us/u/kc1iqj9IRk</Text>
              </ExtLink>
            </Paragraph>
          </Accordion.Content>
        </Accordion.Item>
        ) : null}

        <Accordion.Item value="a2">
          <Accordion.Trigger flexDirection="row" justifyContent="space-between">
            {({ open }: { open: boolean }) => (
              <>
                <Text>YouTube Info - click to open</Text>
                <Square animation="quick" rotate={open ? '180deg' : '0deg'}>
                  <ChevronDown size="$1" />
                </Square>
              </>
            )}
          </Accordion.Trigger>
          <Accordion.Content>
            <Paragraph fontWeight={600}>Watch on YouTube</Paragraph>
            <Paragraph>
              <Text>YouTube: </Text>
              {event.YouTube ? (
                <ExtLink href={event.YouTube}>{event.YouTube}</ExtLink>
              ) : (
                <Text color="$gray10">(Link not yet available)</Text>
              )}
            </Paragraph>
            <Paragraph>
              <Text>Previous recordings are available on the Toronto East Christadelphians YouTube channel here: </Text>
              <ExtLink href="https://www.youtube.com/channel/UCyJamaI5mQImCF8hWE7Yp-w">
                <Text>https://www.youtube.com/channel/UCyJamaI5mQImCF8hWE7Yp-w</Text>
              </ExtLink>
              <Text> The videos can be under either Upload or Live</Text>
            </Paragraph>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion>
    </Section>
  )
}
