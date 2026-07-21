import React from 'react'
import { H1, H2, Paragraph, Picture, Text, YStack, useMedia } from '@my/ui'
import { getBrand } from '@my/app/config/brand'
import { useHeaderEcclesia } from '@my/app/provider/ecclesia/header-ecclesia-context'

type BannerProps = {
  pageTitle?: string
}

export const Banner: React.FC<BannerProps> = ({ pageTitle }) => {
  const media = useMedia()
  const brand = getBrand()
  const rawEcclesia = useHeaderEcclesia()
  // 'Unknown' is the stored sentinel for "no ecclesia set" (see person-repository);
  // treat it as unset so it never surfaces as a title.
  const ecclesia = rawEcclesia && rawEcclesia !== 'Unknown' ? rawEcclesia : null
  // Signed-in user's home ecclesia wins; otherwise the brand's default title
  // (Toronto East Ecclesia for tee, Echad Hub for the generic hub).
  const title = ecclesia || brand.headerTitle
  // Verse belongs to the generic hub and only on the landing header (no page
  // title) while signed out — it's a welcome, not a per-page banner.
  const showVerse = brand.verse && !ecclesia && !pageTitle

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
        {brand.headerImage ? (
          <Picture
            source={{
              src: 'bible-pages.png',
              ...sized,
            }}
            alt={'Open Bible'}
          />
        ) : null}
        {brand.headerMark ? <Text>{`${brand.headerMark}  `}</Text> : null}
        {title}
      </H1>
      {showVerse ? (
        <YStack alignItems="center" marginTop="$2" paddingHorizontal="$4" gap="$1">
          <Paragraph
            ta="center"
            fontStyle="italic"
            maxWidth={680}
            color="$gray11"
            $md={{ fontSize: 15 }}
          >
            {`"${brand.verse!.text}"`}
          </Paragraph>
          <Paragraph ta="center" fontWeight="600" color="$gray11" $md={{ fontSize: 14 }}>
            {`— ${brand.verse!.reference}`}
          </Paragraph>
        </YStack>
      ) : null}
      {pageTitle ? <H2 ta="center" fontFamily="$body" fontWeight="500" $md={{ fontSize: 18 }}>
          {pageTitle}
        </H2> : null}
    </>
  )
}
