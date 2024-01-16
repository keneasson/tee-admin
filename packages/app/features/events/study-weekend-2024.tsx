import React from 'react'
import { Wrapper } from 'app/provider/wrapper'
import { Accordion, Anchor, Heading, Paragraph, Separator, Square, Text, YStack } from '@my/ui'
import { ChevronDown } from '@tamagui/lucide-icons'

export const StudyWeekend2024: React.FC = () => {
  return (
    <Wrapper subHheader={'Ecclesial Study Day'}>
      <YStack
        borderTopColor={'$grey8Dark'}
        borderWidth={1}
        borderBottomColor={'$grey1Dark'}
        borderBottomWidth={2}
        marginBottom={'2rem'}
        padding={'1rem'}
      >
        <Heading size={5}>Events hosted by the Toronto East Christadelphians</Heading>
        <Separator marginBottom={'2rem'} />
        <Paragraph size={'$5'} fontWeight={'bold'}>
          March 2 & 3, 2024 - Study Day
        </Paragraph>
        <Paragraph>
          In person at the Toronto East Ecclesia's Hall -{' '}
          <Anchor
            href="http://maps.google.com/?q=975 Cosburn Ave, Toronto, Ontario, Canada"
            target={'_blank'}
          >
            975 Cosburn Ave, Toronto ON
          </Anchor>
        </Paragraph>
        <Paragraph>and online - see options below</Paragraph>
        <Paragraph size={'$5'} fontWeight={600}>
          The Epistle of James - A Faith that Works
        </Paragraph>
        <Paragraph fontWeight={600}>Bro. Mike LeDuke</Paragraph>
        <Separator marginBottom={'2rem'} />
        <Paragraph size={'$5'} fontWeight={600}>
          Saturday March 2nd
        </Paragraph>
        <Paragraph>
          1:00 pm <Text fontWeight={600}>Be Doers Of The Word</Text> (Introduction to the Epistle &
          Chapter 1)
        </Paragraph>
        <Paragraph>
          <Anchor href="https://youtube.com/live/JpQmx-rfjrc?feature=share" target={'_blank'}>
            View on YouTube
          </Anchor>
        </Paragraph>
        <Paragraph marginVertical={'1rem'}>2:00 Break</Paragraph>
        <Paragraph>
          2:30 <Text fontWeight={600}>Wisdom from Above</Text> (Chapters 2 & 3)
        </Paragraph>
        <Paragraph>
          <Anchor href="https://youtube.com/live/THucnZsxJjY?feature=share" target={'_blank'}>
            View on YouTube
          </Anchor>
        </Paragraph>
        <Paragraph marginVertical={'1rem'}>3:30 Break</Paragraph>
        <Paragraph>
          4:00 <Text fontWeight={600}>He Shall Lift You Up</Text> (Chapters 4 & 5:1-6)
        </Paragraph>
        <Paragraph marginBottom="2rem">
          <Anchor href="https://youtube.com/live/Jaq--moaqMI?feature=share" target={'_blank'}>
            View on YouTube
          </Anchor>
        </Paragraph>
        <Separator />
        <Paragraph size={'$5'} fontWeight={600}>
          Sunday March 3rd
        </Paragraph>
        <Paragraph>11:00 Memorial Worship</Paragraph>
        <Paragraph>
          Exhortation: <Text fontWeight={600}>The Prayer of Faith</Text> (Chapter 5:7-20)
        </Paragraph>
        <Paragraph marginBottom="2rem">
          <Anchor href="https://youtube.com/live/ki5r0EW-ON0?feature=share" target={'_blank'}>
            View on YouTube
          </Anchor>
        </Paragraph>
        <Accordion overflow="hidden" type="multiple">
          <Accordion.Item value="a1">
            <Accordion.Trigger flexDirection="row" justifyContent="space-between">
              {({ open }) => (
                <>
                  <Paragraph>Saturday Zoom Info - Click to open</Paragraph>
                  <Square animation="quick" rotate={open ? '180deg' : '0deg'}>
                    <ChevronDown size="$1" />
                  </Square>
                </>
              )}
            </Accordion.Trigger>
            <Accordion.Content>
              <Anchor
                fontWeight={600}
                href="https://us02web.zoom.us/j/82013618309?pwd=U1ZWNzVCVWF2U1g1WWU5eEkvV1dVZz09"
                target={'_blank'}
              >
                Saturday's Zoom Link
              </Anchor>
              <Paragraph>Meeting ID: 820 1361 8309</Paragraph>
              <Paragraph>Passcode: 036110</Paragraph>
              <Separator alignSelf="stretch" borderColor={'$borderColor'} />
              <Paragraph>One tap mobile</Paragraph>
              <Paragraph>
                <Anchor href="tel:+14388097799,,82013618309#,,,,*036110#" target={'_blank'}>
                  +14388097799,,82013618309#,,,,*036110#
                </Anchor>{' '}
                Canada
              </Paragraph>
              <Paragraph>
                <Anchor href="tel:+15873281099,,82013618309#,,,,*036110#" target={'_blank'}>
                  +15873281099,,82013618309#,,,,*036110#
                </Anchor>{' '}
                Canada
              </Paragraph>
              <Separator alignSelf="stretch" borderColor={'$borderColor'} />
              <Paragraph>
                Find your local number:{' '}
                <Anchor href="https://us02web.zoom.us/u/kbHWW6VEKW">
                  https://us02web.zoom.us/u/kbHWW6VEKW
                </Anchor>
              </Paragraph>
            </Accordion.Content>
          </Accordion.Item>
          <Accordion.Item value="a2">
            <Accordion.Trigger flexDirection="row" justifyContent="space-between">
              {({ open }) => (
                <>
                  <Paragraph>Sunday Zoom Info - Click to open</Paragraph>
                  <Square animation="quick" rotate={open ? '180deg' : '0deg'}>
                    <ChevronDown size="$1" />
                  </Square>
                </>
              )}
            </Accordion.Trigger>
            <Accordion.Content>
              <Anchor
                fontWeight={600}
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
        </Accordion>
      </YStack>
    </Wrapper>
  )
}
