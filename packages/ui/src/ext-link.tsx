import React from 'react'
import { Anchor, styled } from 'tamagui'
import { color } from '@tamagui/themes'
import { ExternalLink } from '@tamagui/lucide-icons'

const StyledLink = styled(Anchor, {
  fontWeight: 'bold',
  color: color.blue11Light,
})

type ExtLinkProps = {
  children: React.ReactNode
  href: string
}
export const ExtLink: React.FC<ExtLinkProps> = ({ href, children }) => {
  return (
    <StyledLink href={href} target="_blank">
      {children} <ExternalLink size={14} />
    </StyledLink>
  )
}
export const IntLink: React.FC<ExtLinkProps> = ({ href, children }) => {
  return <StyledLink href={href}>{children}</StyledLink>
}
