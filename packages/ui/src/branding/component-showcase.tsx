'use client'

import { useState } from 'react'
import { YStack, XStack, Text, H2, H3, H4, Separator, Button, View } from '@my/ui'

interface ComponentShowcaseProps {
  title: string
  description: string
  children?: React.ReactNode
  code?: string
  variants?: Array<{
    name: string
    component: React.ReactNode
    props?: Record<string, any>
  }>
}

export function ComponentShowcase({ title, description, children, code, variants }: ComponentShowcaseProps) {
  const [showCode, setShowCode] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState(0)
  
  return (
    <YStack gap="$4" padding="$4" borderWidth={1} borderColor="$borderLight" borderRadius="$4">
      <YStack gap="$2">
        <H3>{title}</H3>
        <Text color="$textSecondary" fontSize="$3">
          {description}
        </Text>
      </YStack>
      
      {variants && variants.length > 0 && (
        <XStack gap="$2" flexWrap="wrap">
          {variants.map((variant, index) => (
            <Button
              key={variant.name}
              variant={selectedVariant === index ? 'outlined' : undefined}
              size="$2"
              onPress={() => setSelectedVariant(index)}
            >
              {variant.name}
            </Button>
          ))}
        </XStack>
      )}
      
      <View
        backgroundColor="$backgroundSecondary"
        borderRadius="$4"
        padding="$4"
        borderWidth={1}
        borderColor="$borderLight"
      >
        {variants && variants.length > 0 ? variants[selectedVariant].component : children || (
          <Text color="$textSecondary">No preview available</Text>
        )}
      </View>
      
      {code && (
        <YStack gap="$2">
          <Button
            variant={showCode ? 'outlined' : undefined}
            onPress={() => setShowCode(!showCode)}
            alignSelf="flex-start"
          >
            {showCode ? 'Hide' : 'Show'} Code
          </Button>
          
          {showCode && (
            <View
              backgroundColor="$backgroundTertiary"
              borderRadius="$4"
              padding="$3"
              borderWidth={1}
              borderColor="$border"
            >
              <Text fontFamily="monospace" fontSize="$2">
                {code}
              </Text>
            </View>
          )}
        </YStack>
      )}
    </YStack>
  )
}

interface ComponentGroupProps {
  title: string
  description: string
  children: React.ReactNode
}

export function ComponentGroup({ title, description, children }: ComponentGroupProps) {
  return (
    <YStack gap="$4">
      <YStack gap="$2">
        <H2>{title}</H2>
        <Text color="$textSecondary" fontSize="$4">
          {description}
        </Text>
      </YStack>
      
      <Separator />
      
      <YStack gap="$6">
        {children}
      </YStack>
    </YStack>
  )
}