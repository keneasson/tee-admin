import React from 'react'
import { H1, H2, Picture, useMedia } from '@my/ui'

type BannerProps = {
  pageTitle?: string
}

export const Banner: React.FC<BannerProps> = ({ pageTitle }) => {
  const media = useMedia()
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
      <H1
        ta="center"
        fontFamily="$body"
        fontWeight="600"
        $md={{ fontSize: 22 }}
        $sm={{
          marginTop: 32,
        }}
      >
        <Picture
          source={{
            src: 'bible-pages.png',
            ...sized,
          }}
          alt={'Open Bible'}
        />
        Toronto East Ecclesia
      </H1>
      {pageTitle && (
        <H2 ta="center" fontFamily="$body" fontWeight="500" $md={{ fontSize: 18 }}>
          {pageTitle}
        </H2>
      )}
    </>
  )
}
