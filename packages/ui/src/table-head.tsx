import React from 'react'
import { Text, View } from 'tamagui'
import { TableProps } from './table-body'

export const TableHead: React.FC<TableProps> = ({ children, past }) => {
  return (
    <View flex={1} flexBasis={0}>
      <Text fontWeight={'bold'}>{children}</Text>
    </View>
  )
}
