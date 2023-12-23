import React from 'react'
import { H1, H2 } from '@my/ui'

type BannerProps = {
  pageTitle?: string
}

export const Banner: React.FC<BannerProps> = ({ pageTitle }) => {
  return (
    <>
      <H1 ta="center" $md={{ fontSize: 22 }}>
        Toronto East Ecclesia Assistant
      </H1>
      {pageTitle && (
        <H2 ta="center" $md={{ fontSize: 18 }}>
          {pageTitle}
        </H2>
      )}
    </>
  )
}
