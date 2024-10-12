import React from 'react'
import { Text, View } from 'tamagui'

export type TableProps = {
  past?: boolean
  children: React.ReactNode
}

export const TableBody: React.FC<TableProps> = ({ children, past }) => {
  return (
    <View flex={1} flexBasis={0}>
      <Text fontStyle={'normal'} color={past ? '$gray12Dark' : '$gray2Dark'}>
        {children}
      </Text>
    </View>
  )
}
