import React from 'react'
import { Image, isWeb } from 'tamagui'

type PictureProps = {
  source: {
    src: string
    width: number
    height: number
  }
  alt: string
}
export const Picture: React.FC<PictureProps> = ({ source, alt }) => {
  const srcSm = source.src.replace('.png', '@sm.png')
  const srcMd = source.src.replace('.png', '@md.png')
  const srcLg = source.src.replace('.png', '@lg.png')

  return isWeb ? (
    <picture>
      {/* High-resolution image for devices with a pixel density of 2x or higher */}
      <source srcSet={`/images/${srcLg}`} media="(min-resolution: 192dpi)" />
      {/* Medium-resolution image for devices with a pixel density between 1.5x and 2x */}
      <source srcSet={`/images/${srcMd}`} media="(min-resolution: 144dpi)" />
      {/* Default image for devices with a pixel density of 1x */}
      <img
        style={{ width: source.width, height: source.height }}
        src={`/images/${srcSm}`}
        alt={alt}
      />
    </picture>
  ) : (
    <Image
      source={require(`../../assets/${source.src}`)}
      style={{ width: source.width, height: source.height }}
      alt={alt}
    />
  )
}
