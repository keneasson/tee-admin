import React from 'react'
import { H2, Picture, useMedia, Text, XStack, useThemeName } from '@my/ui'
import { brandColors } from '@my/ui/src/branding/brand-colors'

type BannerProps = {
  pageTitle?: string
}

export const Banner: React.FC<BannerProps> = ({ pageTitle }) => {
  const media = useMedia()
  const themeName = useThemeName()
  const mode = themeName.includes('dark') ? 'dark' : 'light'
  const colors = brandColors[mode]
  
  const sized = media.gtMd
    ? {
        width: 74,
        height: 56,
      }
    : {
        width: 54,
        height: 41,
      }
  
  return (
    <>
      <XStack 
        alignItems="center" 
        justifyContent="center" 
        gap="$3"
        marginTop={media.gtMd ? "$4" : "$6"}
      >
        <Picture
          source={{
            src: 'bible-pages.png',
            ...sized,
          }}
          alt={'Open Bible'}
        />
        <Text 
          fontSize={media.gtMd ? 28 : 22} 
          fontWeight="700" 
          color={colors.textPrimary}
          letterSpacing={0}
          textAlign="center"
        >
          Toronto East Ecclesia
        </Text>
      </XStack>
      {pageTitle && (
        <Text 
          textAlign="center" 
          fontSize={media.gtMd ? 20 : 18}
          fontWeight="600"
          color={colors.textSecondary}
          marginTop="$2"
        >
          {pageTitle}
        </Text>
      )}
    </>
  )
}
