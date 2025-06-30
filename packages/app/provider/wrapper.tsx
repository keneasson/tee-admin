'use client'

import React, { ReactNode } from 'react'
import { SafeAreaView } from 'react-native'
import { YStack } from 'tamagui'
import { Banner } from '@my/app/features/banner'

type WrapperType = {
  children: ReactNode
  subHeader?: string
}

export const Wrapper: React.FC<WrapperType> = ({ children, subHeader }) => {
  return (
    <SafeAreaView style={{ height: '100%' }}>
      <YStack fullscreen $lg={{ padding: 5 }} $gtLg={{ padding: 15 }}>
        <YStack>
          <Banner pageTitle={subHeader} />
          {children}
        </YStack>
      </YStack>
    </SafeAreaView>
  )
}
