import React, { ReactNode } from 'react'
import { SafeAreaView } from 'react-native'
import { YStack } from 'tamagui'
import { Banner } from 'app/features/banner'

type WrapperType = {
  children: ReactNode
  subHheader?: string
}

export const Wrapper: React.FC<WrapperType> = ({ children, subHheader }) => {
  return (
    <SafeAreaView style={{ height: '100%' }}>
      <YStack fullscreen $lg={{ padding: 5 }} $gtLg={{ padding: 15 }}>
        <YStack>
          <Banner pageTitle={subHheader} />
          {children}
        </YStack>
      </YStack>
    </SafeAreaView>
  )
}
