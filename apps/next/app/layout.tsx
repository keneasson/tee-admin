'use client'

import '@tamagui/core/reset.css'
import '@tamagui/font-inter/css/400.css'
import '@tamagui/font-inter/css/700.css'
import { NextThemeProvider, useRootTheme } from '@tamagui/next-theme'
import { Analytics } from '@vercel/analytics/react'

import React from 'react'
import { SessionProvider } from 'next-auth/react'
import 'raf/polyfill'

import { Provider } from '@my/app/provider'
import { WithNavigation } from '@my/app/features/with-navigation'
import { config } from '@my/ui'

if (process.env.NODE_ENV === 'production') {
  require('../public/tamagui.css')
}

// Metadata moved to head section in HTML since this is now a client component

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useRootTheme()

  return (
    <NextThemeProvider
      onChangeTheme={(next) => {
        setTheme(next as any)
      }}
    >
      <Provider disableRootThemeClass defaultTheme={theme}>
        {children}
      </Provider>
    </NextThemeProvider>
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <title>Toronto East Christadelphians</title>
        <meta name="description" content="Schedules, News and Information about the Christadelphians meeting in Toronto East." />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <style
          dangerouslySetInnerHTML={{
            __html: config.getCSS({
              exclude: process.env.NODE_ENV === 'development' ? null : 'design-system',
            }),
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <SessionProvider>
            <WithNavigation>
              {children}
            </WithNavigation>
          </SessionProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}