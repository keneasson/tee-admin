import { MemorialServiceType } from '@my/app/types'
import React from 'react'
import { Accordion, ExtLink, Paragraph, Separator, Square, Text, YStack } from '@my/ui'
import { XStack } from 'tamagui'
import { ChevronDown } from '@tamagui/lucide-icons/icons/ChevronDown'
import { Section } from '@my/app/features/newsletter/Section'

type NextMemorialProps = {
  event: MemorialServiceType
  isSameDay: boolean
}
export const NextMemorial: React.FC<NextMemorialProps> = ({ event, isSameDay }) => {
  if (!event.Exhort && event.Activities) {
    return (
      <Section>
        <Paragraph size={'$5'} fontWeight={600}>
          {event.Date.toString()}
        </Paragraph>
        <Paragraph>{event.Activities}</Paragraph>
      </Section>
    )
  }
  if (!event.Exhort as boolean) {
    return null
  }
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
      <XStack $xs={{ flexDirection: 'column' }}>
        <YStack flexGrow={1}>
          <Paragraph>
            <Text fontWeight={600}>Presiding: </Text>
            <Text>{event.Preside}</Text>
          </Paragraph>
          <Paragraph>
            <Text fontWeight={600}>Exhorting: </Text>
            <Text>{event.Exhort}</Text>
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
      {event.Lunch ? <Paragraph>Lunch will be held at the hall</Paragraph> : null}
      {event.Activities ? <Paragraph>{event.Activities}</Paragraph> : null}
      <Separator alignSelf="stretch" borderColor={'$light4grey'} />
      <Accordion overflow="hidden" type="multiple">
        <Accordion.Item value="a1">
          <Accordion.Trigger flexDirection="row" justifyContent="space-between">
            {({ open }) => (
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

        <Accordion.Item value="a2">
          <Accordion.Trigger flexDirection="row" justifyContent="space-between">
            {({ open }) => (
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
              <ExtLink href={event.YouTube}>{event.YouTube}</ExtLink>
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
