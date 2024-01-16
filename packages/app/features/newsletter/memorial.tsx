import { MemorialServiceType } from 'app/types'
import React from 'react'
import { Accordion, Anchor, Paragraph, Separator, Square, Text, YStack } from '@my/ui'
import { XStack } from 'tamagui'
import { ChevronDown } from '@tamagui/lucide-icons'

type NextMemorialProps = {
  event: MemorialServiceType
}
export const NextMemorial: React.FC<NextMemorialProps> = ({ event }) => {
  console.log('event', event)
  if (!event.Exhort && event.Activities) {
    return (
      <YStack
        borderTopColor={'$grey8Dark'}
        borderWidth={1}
        borderBottomColor={'$grey1Dark'}
        borderBottomWidth={2}
        marginBottom={'2rem'}
        padding={'1rem'}
      >
        <Paragraph size={'$5'} fontWeight={600}>
          {event.Date.toString()}
        </Paragraph>
        <Paragraph>{event.Activities}</Paragraph>
      </YStack>
    )
  }
  if (!event.Exhort as boolean) {
    return null
  }
  return (
    <YStack
      borderTopColor={'$grey8Dark'}
      borderWidth={1}
      borderBottomColor={'$grey1Dark'}
      borderBottomWidth={2}
      marginBottom={'2rem'}
      padding={'1rem'}
      width="100%"
    >
      <Paragraph size={'$5'} fontWeight={600}>
        {event.Date.toString()}
      </Paragraph>
      <Paragraph size={'$5'} fontWeight={600}>
        Memorial Service
      </Paragraph>
      <XStack $sm={{ flexDirection: 'column' }}>
        <YStack flex={3} minWidth={400}>
          <Paragraph>
            <Text fontWeight={600}>Presiding:</Text> {event.Preside}
          </Paragraph>
          <Paragraph>
            <Text fontWeight={600}>Exhorting:</Text> {event.Exhort}
          </Paragraph>{' '}
          <Paragraph>
            <Text fontWeight={600}>Organist:</Text> {event.Organist}
          </Paragraph>
          <Paragraph>
            <Text fontWeight={600}>Steward:</Text> {event.Steward}
          </Paragraph>
          <Paragraph>
            <Text fontWeight={600}>Doorkeeper:</Text> {event.Doorkeeper}
          </Paragraph>
        </YStack>
        {event['Hymn-opening'] && (
          <YStack flex={3} minWidth={400}>
            <Paragraph fontWeight={600}>Hymns:</Paragraph>
            <Paragraph>{event['Hymn-opening']}</Paragraph>
            <Paragraph>{event['Hymn-exhortation']}</Paragraph>
            <Paragraph>{event['Hymn-memorial']}</Paragraph>
            <Paragraph>{event['Hymn-closing']}</Paragraph>
          </YStack>
        )}
      </XStack>
      {event.Collection && <Paragraph>Second Collection is for {event.Collection}</Paragraph>}
      {event.Lunch && <Paragraph>Lunch will be held at the hall</Paragraph>}
      {event.Activities && <Paragraph>{event.Activities}</Paragraph>}
      <Separator alignSelf="stretch" borderColor={'$light4grey'} />
      <Accordion overflow="hidden" type="multiple">
        <Accordion.Item value="a1">
          <Accordion.Trigger flexDirection="row" justifyContent="space-between">
            {({ open }) => (
              <>
                <Paragraph>Zoom Info - Click to open</Paragraph>
                <Square animation="quick" rotate={open ? '180deg' : '0deg'}>
                  <ChevronDown size="$1" />
                </Square>
              </>
            )}
          </Accordion.Trigger>
          <Accordion.Content>
            <Paragraph fontWeight={600}>Join Zoom Meeting</Paragraph>
            <Anchor
              href="https://us02web.zoom.us/j/586952386?pwd=Z2svVG0zTmNlTWx2MTFoMlZIaDZLQT09"
              target={'_blank'}
            >
              Click to Join Zoom
            </Anchor>
            <Paragraph>Meeting ID: 586 952 386</Paragraph>
            <Paragraph>Passcode: 036110</Paragraph>
            <Separator alignSelf="stretch" borderColor={'$borderColor'} />
            <Paragraph>One tap mobile</Paragraph>
            <Paragraph>
              <Anchor href="tel:+14388097799,,586952386#,,,,*036110# Canada" target={'_blank'}>
                +14388097799,,586952386#,,,,*036110#
              </Anchor>{' '}
              Canada
            </Paragraph>
            <Paragraph>
              <Anchor href="tel:+15873281099,,586952386#,,,,*036110# Canada" target={'_blank'}>
                +15873281099,,586952386#,,,,*036110#
              </Anchor>{' '}
              Canada
            </Paragraph>
            <Separator alignSelf="stretch" borderColor={'$borderColor'} />
            <Paragraph>
              Find your local number:{' '}
              <Anchor href="https://us02web.zoom.us/u/kc1iqj9IRk">
                https://us02web.zoom.us/u/kc1iqj9IRk
              </Anchor>
            </Paragraph>
          </Accordion.Content>
        </Accordion.Item>

        <Accordion.Item value="a2">
          <Accordion.Trigger flexDirection="row" justifyContent="space-between">
            {({ open }) => (
              <>
                <Paragraph>YouTube Info - click to open</Paragraph>
                <Square animation="quick" rotate={open ? '180deg' : '0deg'}>
                  <ChevronDown size="$1" />
                </Square>
              </>
            )}
          </Accordion.Trigger>
          <Accordion.Content>
            <Paragraph fontWeight={600}>Watch on YouTube</Paragraph>
            <Paragraph>
              YouTube:{' '}
              <Anchor href={event.YouTube} target={'_blank'}>
                {event.YouTube}
              </Anchor>
            </Paragraph>
            <Paragraph>
              Previous recordings are available on the Toronto East Christadelphians YouTube channel
              here:{' '}
              <Anchor
                href="https://www.youtube.com/channel/UCyJamaI5mQImCF8hWE7Yp-w"
                target={'_blank'}
              >
                https://www.youtube.com/channel/UCyJamaI5mQImCF8hWE7Yp-w
              </Anchor>{' '}
              The videos can be under either Upload or Live
            </Paragraph>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion>
    </YStack>
  )
}
