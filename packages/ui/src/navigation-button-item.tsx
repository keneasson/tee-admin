import React from 'react'
import { NavItem } from './nav-item'
import { Text } from 'tamagui'

type NavigationItemProps = {
  linkTo: () => void
  text: string
  active: boolean
}
export const NavigationButtonItem: React.FC<NavigationItemProps> = ({ linkTo, text, active }) => {
  return (
    <NavItem
      onPress={() => {
        linkTo()
      }}
      backgroundColor={active ? '#f5c418' : 'transparent'}
    >
      <Text>{text}</Text>
    </NavItem>
  )
}
