'use client'

import React, { useState, useEffect } from 'react'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Loading } from '@my/app/provider/loading'
import { Wrapper } from '@my/app/provider/wrapper'
import { Button, Card, H2, H3, Paragraph, XStack, YStack, Text, Separator } from '@my/ui'
import { RefreshCw, Database, FileSpreadsheet, Zap, ExternalLink, AlertTriangle, CheckCircle, Clock, Globe } from '@tamagui/lucide-icons'
import type { TestSyncStatus, TestSyncRecord } from '@my/app/types/test-sync'
import type { MultiSheetSyncStatus, SheetConfig } from '@my/app/types/multi-sheet-sync'

export default function DataSyncPage() {
  const isHydrated = useHydrated()
  const [status, setStatus] = useState<TestSyncStatus | null>(null)
  const [sheetData, setSheetData] = useState<TestSyncRecord[]>([])
  const [dynamoData, setDynamoData] = useState<TestSyncRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  
  // Multi-sheet monitoring state
  const [multiSheetStatus, setMultiSheetStatus] = useState<MultiSheetSyncStatus | null>(null)
  const [multiSheetLoading, setMultiSheetLoading] = useState(false)

  useEffect(() => {
    if (isHydrated) {
      fetchStatus()
      fetchMultiSheetStatus()
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

  const fetchMultiSheetStatus = async () => {
    try {
      setMultiSheetLoading(true)
      const response = await fetch('/api/admin/multi-sheet-sync/status')
      if (response.ok) {
        const data = await response.json()
        setMultiSheetStatus(data.status)
      }
    } catch (error) {
      console.error('Failed to fetch multi-sheet status:', error)
    } finally {
      setMultiSheetLoading(false)
    }
  }

  const triggerSheetSync = async (sheetId: string, sheetType: string) => {
    try {
      setMultiSheetLoading(true)
      const response = await fetch('/api/admin/multi-sheet-sync/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetId, sheetType })
      })
      const data = await response.json()
      setMessage(data.message || 'Sheet sync triggered')
      // Refresh after delay
      setTimeout(() => {
        fetchMultiSheetStatus()
        fetchStatus()
      }, 2000)
    } catch (error) {
      setMessage('Failed to trigger sheet sync')
    } finally {
      setMultiSheetLoading(false)
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
          <H2 marginBottom="$3">Data Sync Controls</H2>
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
              Manual Sync
            </Button>
            <Button
              icon={ExternalLink}
              onPress={() => window.open('https://docs.google.com/spreadsheets/d/1ffB9-VWxaTQudAskm_m9vP2bbaFwA5l_tkGimTkzXAw/edit', '_blank')}
              theme="green"
            >
              Open Test Sheet
            </Button>
          </XStack>
          {message && (
            <Paragraph marginTop="$3" color={
              message.includes('✅') ? '$green10' :
              message.includes('⚠️') ? '$orange10' :
              message.includes('❌') ? '$red10' : '$blue10'
            }>
              {message}
            </Paragraph>
          )}
        </Card>


        {/* Sync Health Overview */}
        <Card padding="$4" borderColor={
          !status ? '$gray8' :
          status.errors.length > 0 ? '$red10' :
          status.cacheStatus === 'hot' ? '$green10' :
          status.cacheStatus === 'stale' ? '$orange10' : '$blue10'
        } borderWidth={2}>
          <H2 marginBottom="$3">📊 Sync Health Monitor</H2>
          {status ? (
            <YStack gap="$3">
              {/* Primary Sync Status */}
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize="$4" fontWeight="bold">Overall Status:</Text>
                <Text 
                  fontSize="$4"
                  fontWeight="bold"
                  color={
                    status.errors.length > 0 ? '$red10' :
                    status.cacheStatus === 'hot' ? '$green10' :
                    status.cacheStatus === 'stale' ? '$orange10' : '$blue10'
                  }
                >
                  {status.errors.length > 0 ? '❌ ERRORS' :
                   status.cacheStatus === 'hot' ? '✅ HEALTHY' :
                   status.cacheStatus === 'stale' ? '⚠️ STALE' : '🔵 COLD'}
                </Text>
              </XStack>
              
              <Separator />
              
              {/* Sync Sources */}
              <YStack gap="$2">
                <Text fontWeight="bold" color="$gray11">Sync Sources:</Text>
                <XStack justifyContent="space-between">
                  <Text>🔔 Last Webhook:</Text>
                  <Text 
                    fontWeight="bold"
                    color={status.lastWebhook ? '$green10' : '$gray10'}
                  >
                    {status.lastWebhook ? new Date(status.lastWebhook).toLocaleString() : 'Never'}
                  </Text>
                </XStack>
                <XStack justifyContent="space-between">
                  <Text>👤 Last Manual:</Text>
                  <Text 
                    fontWeight="bold"
                    color={status.lastManual ? '$blue10' : '$gray10'}
                  >
                    {status.lastManual ? new Date(status.lastManual).toLocaleString() : 'Never'}
                  </Text>
                </XStack>
                <XStack justifyContent="space-between">
                  <Text>📋 Total Records:</Text>
                  <Text fontWeight="bold" color="$purple10">{status.totalRecords}</Text>
                </XStack>
              </YStack>
              
              {/* Errors Section */}
              {status.errors.length > 0 && (
                <>
                  <Separator />
                  <YStack gap="$2">
                    <Text color="$red10" fontWeight="bold" fontSize="$3">🚨 Active Issues:</Text>
                    {status.errors.map((error, i) => (
                      <Card key={i} padding="$2" backgroundColor="$red2" borderColor="$red7" borderWidth={1}>
                        <Text color="$red11" fontSize="$2">
                          • {error}
                        </Text>
                      </Card>
                    ))}
                    <Text fontSize="$2" color="$red10" fontStyle="italic">
                      💡 Use "Manual Sync" to attempt recovery
                    </Text>
                  </YStack>
                </>
              )}
            </YStack>
          ) : (
            <Text>Loading sync health...</Text>
          )}
        </Card>

        {/* Multi-Sheet Production Monitoring */}
        <Card padding="$4" borderColor={
          !multiSheetStatus ? '$gray8' :
          multiSheetStatus.overallHealth === 'critical' ? '$red10' :
          multiSheetStatus.overallHealth === 'degraded' ? '$orange10' : '$green10'
        } borderWidth={2}>
          <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
            <H2>🏗️ Production Sheet Monitor</H2>
            <Button
              icon={RefreshCw}
              size="$2"
              onPress={fetchMultiSheetStatus}
              disabled={multiSheetLoading}
            >
              Refresh All
            </Button>
          </XStack>
          
          {multiSheetStatus ? (
            <YStack gap="$3">
              {/* Environment Status */}
              <Card padding="$3" backgroundColor="$backgroundHover">
                <XStack justifyContent="space-between" alignItems="center">
                  <XStack gap="$2" alignItems="center">
                    <Globe size={16} />
                    <Text fontWeight="bold">Environment:</Text>
                  </XStack>
                  <XStack gap="$3" alignItems="center">
                    <Text 
                      fontSize="$3"
                      color={multiSheetStatus.isProduction ? '$green10' : '$orange10'}
                      fontWeight="bold"
                    >
                      {multiSheetStatus.isProduction ? '🟢 PRODUCTION' : '🟡 DEVELOPMENT'}
                    </Text>
                    <Text fontSize="$2" color="$gray11">
                      {multiSheetStatus.webhookDomain}
                    </Text>
                  </XStack>
                </XStack>
              </Card>

              {/* Overall Health Summary */}
              <XStack justifyContent="space-around" alignItems="center">
                <YStack alignItems="center">
                  <Text fontSize="$6" fontWeight="bold" color="$green10">
                    {multiSheetStatus.healthySheets}
                  </Text>
                  <Text fontSize="$2" color="$gray11">Healthy</Text>
                </YStack>
                <YStack alignItems="center">
                  <Text fontSize="$6" fontWeight="bold" color="$orange10">
                    {multiSheetStatus.staleSheets}
                  </Text>
                  <Text fontSize="$2" color="$gray11">Stale</Text>
                </YStack>
                <YStack alignItems="center">
                  <Text fontSize="$6" fontWeight="bold" color="$red10">
                    {multiSheetStatus.errorSheets}
                  </Text>
                  <Text fontSize="$2" color="$gray11">Errors</Text>
                </YStack>
                <YStack alignItems="center">
                  <Text fontSize="$6" fontWeight="bold" color="$gray10">
                    {multiSheetStatus.unknownSheets}
                  </Text>
                  <Text fontSize="$2" color="$gray11">Unknown</Text>
                </YStack>
              </XStack>

              <Separator />

              {/* Individual Sheet Status */}
              <YStack gap="$2">
                <Text fontWeight="bold" marginBottom="$1">Individual Sheet Status:</Text>
                {multiSheetStatus.sheets.map((sheet) => (
                  <Card 
                    key={sheet.id}
                    padding="$3"
                    borderColor={
                      sheet.status === 'healthy' ? '$green8' :
                      sheet.status === 'stale' ? '$orange8' :
                      sheet.status === 'error' ? '$red8' : '$gray8'
                    }
                    borderWidth={1}
                    backgroundColor="$backgroundHover"
                  >
                    <XStack justifyContent="space-between" alignItems="center">
                      <XStack gap="$3" alignItems="center" flex={1}>
                        {/* Status Icon */}
                        {sheet.status === 'healthy' ? (
                          <CheckCircle color="$green10" size={20} />
                        ) : sheet.status === 'stale' ? (
                          <Clock color="$orange10" size={20} />
                        ) : sheet.status === 'error' ? (
                          <AlertTriangle color="$red10" size={20} />
                        ) : (
                          <Database color="$gray10" size={20} />
                        )}
                        
                        <YStack flex={1}>
                          <XStack gap="$2" alignItems="center">
                            <Text fontWeight="bold">{sheet.name}</Text>
                            <Text fontSize="$1" color="$gray11">({sheet.type})</Text>
                          </XStack>
                          <XStack gap="$4">
                            {sheet.lastWebhook && (
                              <Text fontSize="$1" color="$green11">
                                🔔 {new Date(sheet.lastWebhook).toLocaleString()}
                              </Text>
                            )}
                            {sheet.lastSync && (
                              <Text fontSize="$1" color="$blue11">
                                👤 {new Date(sheet.lastSync).toLocaleString()}
                              </Text>
                            )}
                            {sheet.recordCount && (
                              <Text fontSize="$1" color="$purple11">
                                📊 {sheet.recordCount} records
                              </Text>
                            )}
                          </XStack>
                        </YStack>
                      </XStack>

                      {/* Quick Fix Button */}
                      <Button
                        size="$1"
                        theme={sheet.status === 'error' ? 'red' : 'blue'}
                        onPress={() => triggerSheetSync(sheet.id, sheet.type)}
                        disabled={multiSheetLoading}
                      >
                        Fix
                      </Button>
                    </XStack>
                    
                    {/* Error Messages */}
                    {sheet.errors && sheet.errors.length > 0 && (
                      <YStack gap="$1" marginTop="$2">
                        {sheet.errors.map((error, i) => (
                          <Text key={i} fontSize="$1" color="$red11">
                            • {error}
                          </Text>
                        ))}
                      </YStack>
                    )}
                  </Card>
                ))}
              </YStack>
              
              {/* Quick Actions */}
              <Card padding="$2" backgroundColor="$blue2">
                <Text fontSize="$2" color="$blue11">
                  💡 <Text fontWeight="bold">Webhooks:</Text> {multiSheetStatus.isProduction ? 
                    'Connected to production domain - webhooks active' : 
                    'Development mode - webhooks may not reach localhost'
                  }
                </Text>
              </Card>
            </YStack>
          ) : (
            <Text>Loading production sheet status...</Text>
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
        <Card padding="$4" borderColor={sheetData.length !== dynamoData.length ? '$red10' : '$green10'} borderWidth={2}>
          <H2 marginBottom="$3">🔍 Webhook & Sync Analysis</H2>
          <YStack gap="$3">
            <XStack justifyContent="space-between">
              <Text>Records in Google Sheets:</Text>
              <Text fontWeight="bold" color="$blue10">{sheetData.length}</Text>
            </XStack>
            <XStack justifyContent="space-between">
              <Text>Records in DynamoDB:</Text>
              <Text fontWeight="bold" color="$purple10">{dynamoData.length}</Text>
            </XStack>
            <Separator marginVertical="$2" />
            <XStack justifyContent="space-between">
              <Text>Data Match Status:</Text>
              <Text 
                fontWeight="bold"
                color={sheetData.length === dynamoData.length ? '$green10' : '$red10'}
              >
                {sheetData.length === dynamoData.length ? '✅ Count Matches' : '❌ Count Mismatch'}
              </Text>
            </XStack>
            
            {/* Content Comparison */}
            {(() => {
              const sheetsOnly = sheetData.filter(s => 
                !dynamoData.some(d => d.Date === s.Date && d.Name === s.Name && d.Topic === s.Topic)
              )
              const dynamoOnly = dynamoData.filter(d => 
                !sheetData.some(s => s.Date === d.Date && s.Name === d.Name && s.Topic === d.Topic)
              )
              
              return (
                <>
                  {sheetsOnly.length > 0 && (
                    <YStack gap="$2">
                      <Text color="$orange10" fontWeight="bold">
                        ⚠️ In Google Sheets but NOT in DynamoDB ({sheetsOnly.length}):
                      </Text>
                      {sheetsOnly.map((record, i) => (
                        <Text key={i} fontSize="$2" color="$orange10">
                          • {record.Date} | {record.Name} | {record.Topic}
                        </Text>
                      ))}
                      <Text fontSize="$2" color="$red10" fontWeight="bold">
                        → Webhook did not trigger or failed to update DynamoDB
                      </Text>
                    </YStack>
                  )}
                  
                  {dynamoOnly.length > 0 && (
                    <YStack gap="$2">
                      <Text color="$purple10" fontWeight="bold">
                        📦 In DynamoDB but NOT in Google Sheets ({dynamoOnly.length}):
                      </Text>
                      {dynamoOnly.map((record, i) => (
                        <Text key={i} fontSize="$2" color="$purple10">
                          • {record.Date} | {record.Name} | {record.Topic}
                        </Text>
                      ))}
                    </YStack>
                  )}
                  
                  {sheetsOnly.length === 0 && dynamoOnly.length === 0 && sheetData.length > 0 && (
                    <Text color="$green10" fontWeight="bold">
                      ✅ All records match between Google Sheets and DynamoDB
                    </Text>
                  )}
                </>
              )
            })()}
            
            <Separator marginVertical="$2" />
            
            {/* Webhook Status */}
            <YStack gap="$2">
              <Text fontWeight="bold">🔔 Webhook Status:</Text>
              <Text fontSize="$2">
                Last Webhook: {status?.lastWebhook || 'Never triggered'}
              </Text>
              <Text fontSize="$2">
                Last Sync: {status?.lastSync || 'Never'}
              </Text>
              {status?.lastWebhook && status?.lastSync && (
                <Text fontSize="$2" color={
                  new Date(status.lastWebhook) > new Date(status.lastSync) ? '$orange10' : '$gray10'
                }>
                  {new Date(status.lastWebhook) > new Date(status.lastSync) 
                    ? '⚠️ Webhook triggered but sync may have failed'
                    : 'ℹ️ No recent webhook activity detected'}
                </Text>
              )}
            </YStack>
            
            <Card backgroundColor="$backgroundHover" padding="$3">
              <Text fontSize="$2" color="$gray11">
                💡 <Text fontWeight="bold">Diagnosis:</Text> If you edited the Google Sheet and data doesn't appear in DynamoDB, 
                the webhook is not triggering. This could be because:
              </Text>
              <YStack gap="$1" marginTop="$2">
                <Text fontSize="$1">1. Webhook is not configured for this sheet</Text>
                <Text fontSize="$1">2. Google hasn't sent the webhook notification</Text>
                <Text fontSize="$1">3. Webhook endpoint is not receiving the request</Text>
                <Text fontSize="$1">4. Webhook is received but processing failed</Text>
              </YStack>
            </Card>
          </YStack>
        </Card>
      </YStack>
    </Wrapper>
  )
}