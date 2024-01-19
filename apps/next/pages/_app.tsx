import '@tamagui/core/reset.css'
import '@tamagui/font-inter/css/400.css'
import '@tamagui/font-inter/css/700.css'
import { NextThemeProvider, useRootTheme } from '@tamagui/next-theme'
import { Analytics } from '@vercel/analytics/react'

import React from 'react'
import Head from 'next/head'
import { SessionProvider } from 'next-auth/react'
import 'raf/polyfill'
import type { SolitoAppProps } from 'solito'

import { Provider } from 'app/provider'
import { WithNavigation } from 'app/features/with-navigation'

if (process.env.NODE_ENV === 'production') {
  require('../public/tamagui.css')
}

function MyApp({ Component, pageProps }: SolitoAppProps) {
  return (
    <>
      <Head>
        <title>Tamagui Example App</title>
        <meta
          name="description"
          content="Schedules, News and Information about the Christadelphians meeting in Toronto East."
        />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </Head>
      <ThemeProvider>
        <SessionProvider>
          <WithNavigation>
            <Component {...pageProps} />
          </WithNavigation>
        </SessionProvider>
      </ThemeProvider>
      <Analytics />
    </>
  )
}

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

export default MyApp
