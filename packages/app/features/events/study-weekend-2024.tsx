'use client'
import React from 'react'
import { Wrapper } from 'app/provider/wrapper'
import { ExtLink, Heading, Paragraph, Separator, Text } from '@my/ui'
import { Section } from 'app/features/newsletter/Section'
import { DownloadButton } from '@my/ui/src/download-button'
import { EventsFooter } from 'app/features/events/index'

export const StudyWeekend2024: React.FC = () => {
  return (
    <Wrapper subHheader={'Ecclesial Study Day'}>
      <Section
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
          March 2 & 3, 2024 - Study Day{' '}
        </Paragraph>
        <Paragraph size={'$5'} fontWeight={600}>
          The Epistle of James - A Faith that Works
        </Paragraph>
        <Paragraph fontWeight={600}>Bro. Mike LeDuke</Paragraph>
        <Separator marginBottom={'1rem'} />
        <Paragraph>
          Bro. Mike has shared a prequel: Setting the Stage and also his Full notes:
        </Paragraph>
        <DownloadButton href="/pdf/James-introductory-notes.pdf">
          Download "Setting the Stage"
        </DownloadButton>
        <DownloadButton href="/pdf/James-Full-Set-of-Notes.pdf">Download Full notes</DownloadButton>
        <Separator marginBottom={'2rem'} />
        <Paragraph>
          Class 1<br />
          <Text fontWeight={600}>Be Doers Of The Word</Text> (Introduction to the Epistle & Chapter
          1)
        </Paragraph>
        <Paragraph marginBottom={'1Rem'}>
          <ExtLink href="https://youtube.com/live/JpQmx-rfjrc?feature=share">
            View on YouTube
          </ExtLink>
        </Paragraph>
        <Paragraph>
          Class 2<br />
          <Text fontWeight={600}>Wisdom from Above</Text> (Chapters 2 & 3)
        </Paragraph>
        <Paragraph marginBottom={'1Rem'}>
          <ExtLink href="https://youtube.com/live/THucnZsxJjY?feature=share">
            View on YouTube
          </ExtLink>
        </Paragraph>
        <Paragraph>
          Class 3<br />
          <Text fontWeight={600}>He Shall Lift You Up</Text> (Chapters 4 & 5:1-6)
        </Paragraph>
        <Paragraph marginBottom={'1Rem'}>
          <ExtLink href="https://youtube.com/live/Jaq--moaqMI?feature=share">
            View on YouTube
          </ExtLink>
        </Paragraph>
        <Paragraph>Memorial Worship</Paragraph>
        <Paragraph>
          Exhortation: <Text fontWeight={600}>The Prayer of Faith</Text> (Chapter 5:7-20)
        </Paragraph>
        <Paragraph marginBottom={'1Rem'}>
          <ExtLink href="https://youtube.com/live/ki5r0EW-ON0?feature=share">
            View on YouTube
          </ExtLink>
        </Paragraph>
      </Section>
      <EventsFooter />
    </Wrapper>
  )
}
