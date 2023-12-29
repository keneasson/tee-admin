import React from 'react'
import { Button, styled } from 'tamagui'

type ListSelectorProps = {
  children?: React.ReactNode
  styles?: React.CSSProperties
  onPress: (event?: any) => void
  title?: string
  iconName?: string
}

export const ListNavigation: React.FC<ListSelectorProps> = ({ styles, onPress, children }) => {
  const Selector = styled(Button, {
    display: 'flex',
    backgroundColor: '$blue1Light',
    color: '$blue10Light',
    flexDirection: 'row',
    flexWrap: 'wrap',
    height: 47,
    alignItems: 'center',
    alignContent: 'center',
    paddingHorizontal: 18,
    width: '100%',
    ...(styles as object),
  })
  const handlePress = (event?: any) => {
    onPress && onPress(event)
  }

  return (
    <Selector hoverTheme pressTheme focusTheme onPress={handlePress}>
      {children}
    </Selector>
  )
}
