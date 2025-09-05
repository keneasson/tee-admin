'use client'

import React from 'react'
import { YStack, H1, Text, Separator } from '@my/ui'
import { EnhancedScheduleWithData } from '@my/ui/src/data-table/enhanced-schedule-with-data'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { useSession } from 'next-auth/react'

export default function RealSchedulePage() {
  const isHydrated = useHydrated()
  const { data: session } = useSession()

  if (!isHydrated) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Text>Loading real schedule data...</Text>
      </YStack>
    )
  }

  // Check if user has admin privileges
  const userRole = session?.user?.role
  const showAdminFeatures = userRole === 'admin' || userRole === 'owner'

  return (
    <YStack gap="$6" padding="$4">
      {/* Header */}
      <YStack gap="$4">
        <H1>TEE Admin Schedule (Real Data)</H1>
        <Text color="$textSecondary" fontSize="$4">
          Live schedule data from Google Sheets and DynamoDB integration. 
          {session?.user?.email && ` Welcome, ${session.user.email.split('@')[0]}!`}
        </Text>
        {showAdminFeatures && (
          <Text color="$textSecondary" fontSize="$3">
            Admin features enabled - showing data refresh controls and detailed status.
          </Text>
        )}
      </YStack>
      
      <Separator />
      
      {/* Real Schedule Table with Live Data */}
      <EnhancedScheduleWithData
        types={['memorial', 'bibleClass', 'sundaySchool', 'cyc']}
        autoRefresh={true}
        refreshInterval={5 * 60 * 1000} // 5 minutes
        showAdminFeatures={showAdminFeatures}
      />
      
      <Separator />
      
      {/* Technical Details */}
      <YStack gap="$4">
        <Text fontSize="$4" fontWeight="600">Real Data Integration</Text>
        <YStack gap="$3">
          <YStack gap="$2">
            <Text fontSize="$3" fontWeight="600">Data Sources:</Text>
            <YStack gap="$1" paddingLeft="$3">
              <Text fontSize="$2">• <Text fontWeight="600">Primary</Text> - DynamoDB with auto-sync</Text>
              <Text fontSize="$2">• <Text fontWeight="600">Fallback</Text> - Google Sheets API</Text>
              <Text fontSize="$2">• <Text fontWeight="600">Authentication</Text> - NextAuth.js v5 integration</Text>
              <Text fontSize="$2">• <Text fontWeight="600">Real-time</Text> - 5-minute auto-refresh</Text>
            </YStack>
          </YStack>
          
          <YStack gap="$2">
            <Text fontSize="$3" fontWeight="600">Enhanced Features:</Text>
            <YStack gap="$1" paddingLeft="$3">
              <Text fontSize="$2">• <Text fontWeight="600">User Highlighting</Text> - Your name highlighted in blue</Text>
              <Text fontSize="$2">• <Text fontWeight="600">Next Event Detection</Text> - Live calculation of upcoming events</Text>
              <Text fontSize="$2">• <Text fontWeight="600">Conflict Detection</Text> - Multiple responsibilities on same date</Text>
              <Text fontSize="$2">• <Text fontWeight="600">Search & Filter</Text> - Real-time search across all schedules</Text>
              <Text fontSize="$2">• <Text fontWeight="600">Cross-Platform</Text> - Same component works on mobile app</Text>
            </YStack>
          </YStack>
          
          <YStack gap="$2">
            <Text fontSize="$3" fontWeight="600">Schedule Types:</Text>
            <YStack gap="$1" paddingLeft="$3">
              <Text fontSize="$2">• <Text fontWeight="600">Memorial Service</Text> - Sunday 11:00 AM</Text>
              <Text fontSize="$2">• <Text fontWeight="600">Bible Class</Text> - Wednesday 7:30 PM</Text>
              <Text fontSize="$2">• <Text fontWeight="600">Sunday School</Text> - Sunday 9:30 AM</Text>
              <Text fontSize="$2">• <Text fontWeight="600">CYC</Text> - Youth meetings 6:30 PM</Text>
            </YStack>
          </YStack>
        </YStack>
      </YStack>
    </YStack>
  )
}