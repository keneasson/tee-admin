import React from 'react'
import { Text, View } from 'tamagui'

type TableBodyProps = {
  past: boolean
  children: React.ReactNode
}

export const TableBody: React.FC<TableBodyProps> = ({ children, past }) => {
  return (
    <View flex={1} flexBasis={0}>
      <Text fontStyle={'normal'} color={past ? '$gray12Dark' : '$grey2Dark'}>
        {children}
      </Text>
    </View>
  )
}
