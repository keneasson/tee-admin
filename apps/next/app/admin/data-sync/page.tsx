'use client'

import React, { useState, useEffect } from 'react'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Loading } from '@my/app/provider/loading'
import { Wrapper } from '@my/app/provider/wrapper'
import { Button, Card, H2, H3, Paragraph, XStack, YStack, Text, Separator } from '@my/ui'
import { RefreshCw, Play, Database, FileSpreadsheet, Zap } from '@tamagui/lucide-icons'
import type { TestSyncStatus, TestSyncRecord } from '@my/app/types/test-sync'

export default function DataSyncPage() {
  const isHydrated = useHydrated()
  const [status, setStatus] = useState<TestSyncStatus | null>(null)
  const [sheetData, setSheetData] = useState<TestSyncRecord[]>([])
  const [dynamoData, setDynamoData] = useState<TestSyncRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (isHydrated) {
      fetchStatus()
    }
  }, [isHydrated])

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/admin/test-sync/status')
      if (response.ok) {
        const data = await response.json()
        setStatus(data.status)
        setSheetData(data.sheetData || [])
        setDynamoData(data.dynamoData || [])
      }
    } catch (error) {
      console.error('Failed to fetch status:', error)
      setMessage('Failed to fetch sync status')
    }
  }

  const triggerSync = async () => {
    setLoading(true)
    setMessage('Triggering manual sync...')
    try {
      const response = await fetch('/api/admin/test-sync/trigger', {
        method: 'POST'
      })
      const data = await response.json()
      setMessage(data.message || 'Sync triggered successfully')
      // Refresh status after a delay
      setTimeout(fetchStatus, 2000)
    } catch (error) {
      setMessage('Failed to trigger sync')
    } finally {
      setLoading(false)
    }
  }

  const runPlaywrightTest = async () => {
    setLoading(true)
    setMessage('Running Playwright test to modify Google Sheet...')
    try {
      const response = await fetch('/api/admin/test-sync/playwright', {
        method: 'POST'
      })
      const data = await response.json()
      setMessage(data.message || 'Playwright test completed')
      // Refresh status after a delay for webhook to process
      setTimeout(fetchStatus, 35000) // Wait for 30s debounce + buffer
    } catch (error) {
      setMessage('Failed to run Playwright test')
    } finally {
      setLoading(false)
    }
  }

  const clearCache = async () => {
    setLoading(true)
    setMessage('Clearing cache...')
    try {
      const response = await fetch('/api/admin/test-sync/clear-cache', {
        method: 'POST'
      })
      const data = await response.json()
      setMessage(data.message || 'Cache cleared')
      setTimeout(fetchStatus, 1000)
    } catch (error) {
      setMessage('Failed to clear cache')
    } finally {
      setLoading(false)
    }
  }

  if (!isHydrated) {
    return <Loading />
  }

  return (
    <Wrapper subHeader="Data Sync Test System">
      <YStack gap="$4" maxWidth={1200}>
        {/* Controls */}
        <Card padding="$4">
          <H2 marginBottom="$3">Test Controls</H2>
          <XStack gap="$3" flexWrap="wrap">
            <Button
              icon={RefreshCw}
              onPress={fetchStatus}
              disabled={loading}
            >
              Refresh Status
            </Button>
            <Button
              icon={Zap}
              onPress={triggerSync}
              disabled={loading}
              theme="blue"
            >
              Trigger Manual Sync
            </Button>
            <Button
              icon={Play}
              onPress={runPlaywrightTest}
              disabled={loading}
              theme="green"
            >
              Run Playwright Test
            </Button>
            <Button
              icon={Database}
              onPress={clearCache}
              disabled={loading}
              theme="orange"
            >
              Clear Cache
            </Button>
          </XStack>
          {message && (
            <Paragraph marginTop="$3" color="$blue10">
              {message}
            </Paragraph>
          )}
        </Card>

        {/* Status Overview */}
        <Card padding="$4">
          <H2 marginBottom="$3">Sync Status</H2>
          {status ? (
            <YStack gap="$2">
              <XStack justifyContent="space-between">
                <Text>Last Sync:</Text>
                <Text fontWeight="bold">
                  {status.lastSync || 'Never'}
                </Text>
              </XStack>
              <XStack justifyContent="space-between">
                <Text>Last Webhook:</Text>
                <Text fontWeight="bold">
                  {status.lastWebhook || 'Never'}
                </Text>
              </XStack>
              <XStack justifyContent="space-between">
                <Text>Total Records:</Text>
                <Text fontWeight="bold">{status.totalRecords}</Text>
              </XStack>
              <XStack justifyContent="space-between">
                <Text>Cache Status:</Text>
                <Text 
                  fontWeight="bold"
                  color={
                    status.cacheStatus === 'hot' ? '$green10' :
                    status.cacheStatus === 'cold' ? '$blue10' : '$orange10'
                  }
                >
                  {status.cacheStatus.toUpperCase()}
                </Text>
              </XStack>
              <XStack justifyContent="space-between">
                <Text>Sheet Version:</Text>
                <Text fontFamily="$mono">{status.sheetVersion || 'N/A'}</Text>
              </XStack>
              <XStack justifyContent="space-between">
                <Text>DynamoDB Version:</Text>
                <Text fontFamily="$mono">{status.dynamoVersion || 'N/A'}</Text>
              </XStack>
              {status.errors.length > 0 && (
                <>
                  <Separator marginVertical="$2" />
                  <Text color="$red10" fontWeight="bold">Errors:</Text>
                  {status.errors.map((error, i) => (
                    <Text key={i} color="$red10" fontSize="$2">
                      • {error}
                    </Text>
                  ))}
                </>
              )}
            </YStack>
          ) : (
            <Text>Loading status...</Text>
          )}
        </Card>

        {/* Data Comparison */}
        <XStack gap="$4" flexWrap="wrap">
          {/* Google Sheets Data */}
          <Card flex={1} minWidth={300} padding="$4">
            <H3 marginBottom="$3">
              <FileSpreadsheet size={20} /> Google Sheets Data
            </H3>
            {sheetData.length > 0 ? (
              <YStack gap="$2">
                {sheetData.map((record, i) => (
                  <Card key={i} padding="$2" backgroundColor="$backgroundHover">
                    <Text fontSize="$2" fontWeight="bold">
                      {record.Date?.toString()}
                    </Text>
                    <Text fontSize="$2">Name: {record.Name}</Text>
                    <Text fontSize="$2">Topic: {record.Topic}</Text>
                  </Card>
                ))}
              </YStack>
            ) : (
              <Text color="$gray10">No data in Google Sheets</Text>
            )}
          </Card>

          {/* DynamoDB Data */}
          <Card flex={1} minWidth={300} padding="$4">
            <H3 marginBottom="$3">
              <Database size={20} /> DynamoDB Data
            </H3>
            {dynamoData.length > 0 ? (
              <YStack gap="$2">
                {dynamoData.map((record, i) => (
                  <Card key={i} padding="$2" backgroundColor="$backgroundHover">
                    <Text fontSize="$2" fontWeight="bold">
                      {record.Date?.toString()}
                    </Text>
                    <Text fontSize="$2">Name: {record.Name}</Text>
                    <Text fontSize="$2">Topic: {record.Topic}</Text>
                  </Card>
                ))}
              </YStack>
            ) : (
              <Text color="$gray10">No data in DynamoDB</Text>
            )}
          </Card>
        </XStack>

        {/* Sync Comparison */}
        <Card padding="$4">
          <H2 marginBottom="$3">Data Comparison</H2>
          <YStack gap="$2">
            <XStack justifyContent="space-between">
              <Text>Records in Sheets:</Text>
              <Text fontWeight="bold">{sheetData.length}</Text>
            </XStack>
            <XStack justifyContent="space-between">
              <Text>Records in DynamoDB:</Text>
              <Text fontWeight="bold">{dynamoData.length}</Text>
            </XStack>
            <XStack justifyContent="space-between">
              <Text>Sync Status:</Text>
              <Text 
                fontWeight="bold"
                color={sheetData.length === dynamoData.length ? '$green10' : '$red10'}
              >
                {sheetData.length === dynamoData.length ? '✅ In Sync' : '❌ Out of Sync'}
              </Text>
            </XStack>
          </YStack>
        </Card>
      </YStack>
    </Wrapper>
  )
}