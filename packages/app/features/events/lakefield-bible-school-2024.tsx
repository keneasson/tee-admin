'use client'
import React from 'react'
import { Paragraph, ProgramElement, Section } from '@my/ui'
import { Wrapper } from 'app/provider/wrapper'
import { EventsFooter } from 'app/features/events/index'

export const LakefieldBibleSchool2024: React.FC = () => {
  return (
    <Wrapper subHheader={'Bible School'}>
      <Section
        borderTopColor={'$grey8Dark'}
        borderWidth={1}
        borderBottomColor={'$grey1Dark'}
        borderBottomWidth={2}
        marginBottom={'2rem'}
        padding={'1rem'}
      >
        <Paragraph size={'$5'} fontWeight={'bold'}>
          August 5-10, 2024 – Lakefield Christadelphian Bible School at Fleming
        </Paragraph>
        <ProgramElement label={'Location'} content={'Fleming College in Peterborough, Ontario'} />
        <ProgramElement
          label={'Dates'}
          content={'Monday August 5th to Saturday August 10th, 2024'}
        />
        <ProgramElement label={'Speaker'} content={'Bro. Mark Whittaker'} />
        <ProgramElement label={'Speaker'} content={'Bro. Bill Link'} />
        <ProgramElement label={'Registration'} content={'Coming in March'} />
        <Paragraph>Details and Flyer coming soon.</Paragraph>
      </Section>
      <EventsFooter />
    </Wrapper>
  )
}
