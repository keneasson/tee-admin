'use client'

import React from 'react'
import { SessionProvider, useSession, signOut } from 'next-auth/react'
import { FeatureGatedNavigation } from '@my/app/features/feature-gated-navigation'
import { config } from '@my/ui'
import { ThemeProvider, ThemeAwareProvider } from '@my/ui'

if (process.env.NODE_ENV === 'production') {
  require('../public/tamagui.css')
}

// Inner component that can use useSession (inside SessionProvider)
function NavigationWithAuth({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()

  const user = session?.user
    ? {
        name: session.user.name,
        email: session.user.email,
        role: (session.user as any)?.role,
      }
    : null

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' })
  }

  return (
    <FeatureGatedNavigation user={user} onSignOut={handleSignOut}>
      {children}
    </FeatureGatedNavigation>
  )
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Toronto East Christadelphians</title>
        <meta
          name="description"
          content="Schedules, News and Information about the Christadelphians meeting in Toronto East."
        />
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
          suppressHydrationWarning
        />
      </head>
      <body>
        <ThemeProvider defaultTheme="light">
          <ThemeAwareProvider config={config}>
            <SessionProvider>
              <NavigationWithAuth>{children}</NavigationWithAuth>
            </SessionProvider>
          </ThemeAwareProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
