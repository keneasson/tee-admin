import React from 'react'
import { Paragraph, Text } from 'tamagui'

type ProgramElementProps = {
  label: string
  content: string
}
export const ProgramElement: React.FC<ProgramElementProps> = ({ label, content }) => {
  return (
    <Paragraph>
      <Text fontWeight={600}>{label}:</Text> {content}
    </Paragraph>
  )
}
