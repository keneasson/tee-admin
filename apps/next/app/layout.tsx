'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { SessionProvider, useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { FeatureGatedNavigation } from '@my/app/features/feature-gated-navigation'
import { HeaderEcclesiaProvider } from '@my/app/provider/ecclesia/header-ecclesia-context'
import { config } from '@my/ui'
import { ThemeProvider, ThemeAwareProvider } from '@my/ui'

if (process.env.NODE_ENV === 'production') {
  require('../public/tamagui.css')
}

// Polling interval for notification count (60 seconds)
const NOTIFICATION_POLL_INTERVAL = 60_000

// Inner component that can use useSession (inside SessionProvider)
function NavigationWithAuth({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const router = useRouter()
  const [notificationCount, setNotificationCount] = useState<number | undefined>(undefined)
  const [featureEnabled, setFeatureEnabled] = useState(false)

  const user = session?.user
    ? {
        name: session.user.name,
        email: session.user.email,
        role: (session.user as any)?.role,
        ecclesia: (session.user as any)?.ecclesia,
        isRecordingBrother: (session.user as any)?.isRecordingBrother,
      }
    : null

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' })
  }

  // Check feature flag and poll notification count
  const fetchNotificationCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/count')
      if (res.ok) {
        const data = await res.json()
        setNotificationCount(data.unreadCount)
        setFeatureEnabled(true)
      } else if (res.status === 401) {
        // Not logged in — disable
        setFeatureEnabled(false)
      }
    } catch {
      // Notification failures must not block anything
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setFeatureEnabled(false)
      setNotificationCount(undefined)
      return
    }

    // Initial fetch
    fetchNotificationCount()

    // Poll every 60 seconds
    const interval = setInterval(fetchNotificationCount, NOTIFICATION_POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [user, fetchNotificationCount])

  const handleNotificationPress = () => {
    router.push('/notifications')
  }

  return (
    <FeatureGatedNavigation
      user={user}
      onSignOut={handleSignOut}
      notificationCount={featureEnabled ? notificationCount : undefined}
      onNotificationPress={featureEnabled ? handleNotificationPress : undefined}
    >
      <HeaderEcclesiaProvider value={user?.ecclesia ?? null}>
        {children}
      </HeaderEcclesiaProvider>
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
