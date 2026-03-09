'use client'

import { useAdminAccess } from '@/hooks/use-admin-access'
import {
  YStack,
  XStack,
  Text,
  Spinner,
  Heading,
  Card,
  Button,
  ScrollView,
  useThemeName,
} from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { brandColors } from '@my/ui/src/branding/brand-colors'
import { useState, useEffect, useCallback } from 'react'
import { Eye, Send, ChevronUp, X } from '@tamagui/lucide-icons'
import type { EmailTypeInfo } from '../../../../utils/email/email-test-mocks'

type PreviewState = {
  emailType: string
  html: string
  subject: string
} | null

type SendResult = {
  emailType: string
  success: boolean
  message: string
}

export default function EmailTesterPage() {
  const isHydrated = useHydrated()
  const { hasAccess, isLoading, user } = useAdminAccess()
  const themeName = useThemeName()
  const mode = themeName.includes('dark') ? 'dark' : 'light'
  const colors = brandColors[mode]

  const [catalog, setCatalog] = useState<EmailTypeInfo[]>([])
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [preview, setPreview] = useState<PreviewState>(null)
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null)
  const [loadingSend, setLoadingSend] = useState<string | null>(null)
  const [sendResult, setSendResult] = useState<SendResult | null>(null)
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

  const fetchCatalog = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/email-tester')
      if (!res.ok) throw new Error('Failed to fetch catalog')
      const data = await res.json()
      setCatalog(data.catalog)
    } catch (err) {
      console.error('Failed to load email catalog:', err)
    } finally {
      setLoadingCatalog(false)
    }
  }, [])

  useEffect(() => {
    if (hasAccess) fetchCatalog()
  }, [hasAccess, fetchCatalog])

  const handlePreview = async (emailType: string) => {
    // Toggle off if already previewing this type
    if (preview?.emailType === emailType) {
      setPreview(null)
      setExpandedCards((prev) => {
        const next = new Set(prev)
        next.delete(emailType)
        return next
      })
      return
    }

    setLoadingPreview(emailType)
    setSendResult(null)
    try {
      const res = await fetch('/api/admin/email-tester', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', emailType }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Preview failed')
      }
      const data = await res.json()
      setPreview({ emailType, html: data.html, subject: data.subject })
      setExpandedCards((prev) => new Set(prev).add(emailType))
    } catch (err) {
      console.error('Preview error:', err)
      setSendResult({
        emailType,
        success: false,
        message: err instanceof Error ? err.message : 'Preview failed',
      })
    } finally {
      setLoadingPreview(null)
    }
  }

  const handleSend = async (emailType: string) => {
    setLoadingSend(emailType)
    setSendResult(null)
    try {
      const res = await fetch('/api/admin/email-tester', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', emailType }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Send failed')
      }
      setSendResult({
        emailType,
        success: true,
        message: `Sent to ${data.sentTo}`,
      })
    } catch (err) {
      setSendResult({
        emailType,
        success: false,
        message: err instanceof Error ? err.message : 'Send failed',
      })
    } finally {
      setLoadingSend(null)
    }
  }

  if (!isHydrated || isLoading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Spinner size="large" width={36} height={36} />
      </YStack>
    )
  }

  if (!hasAccess) return null

  const templateEmails = catalog.filter((t) => t.category === 'template')
  const systemEmails = catalog.filter((t) => t.category === 'system')

  return (
    <ScrollView flex={1}>
      <YStack padding="$4" gap="$4" maxWidth={1000} marginHorizontal="auto" width="100%">
        <YStack gap="$2">
          <Heading size="$7">Email Tester</Heading>
          <Text color={colors.textSecondary} fontSize="$3">
            Test emails will be sent to: <Text fontWeight="600" color={colors.textPrimary}>{user?.email}</Text>
          </Text>
        </YStack>

        {loadingCatalog ? (
          <YStack alignItems="center" padding="$6">
            <Spinner size="large" width={36} height={36} />
            <Text marginTop="$2" color={colors.textSecondary}>Loading email types...</Text>
          </YStack>
        ) : (
          <>
            {/* React Email Templates */}
            <YStack gap="$3">
              <Text fontSize="$5" fontWeight="600" color={colors.textPrimary}>
                React Email Templates
              </Text>
              {templateEmails.map((emailType) => (
                <EmailCard
                  key={emailType.key}
                  emailType={emailType}
                  colors={colors}
                  preview={preview}
                  loadingPreview={loadingPreview}
                  loadingSend={loadingSend}
                  sendResult={sendResult}
                  expanded={expandedCards.has(emailType.key)}
                  onPreview={handlePreview}
                  onSend={handleSend}
                  onClosePreview={() => {
                    setPreview(null)
                    setExpandedCards((prev) => {
                      const next = new Set(prev)
                      next.delete(emailType.key)
                      return next
                    })
                  }}

                />
              ))}
            </YStack>

            {/* System Emails */}
            <YStack gap="$3">
              <Text fontSize="$5" fontWeight="600" color={colors.textPrimary}>
                System Emails
              </Text>
              {systemEmails.map((emailType) => (
                <EmailCard
                  key={emailType.key}
                  emailType={emailType}
                  colors={colors}
                  preview={preview}
                  loadingPreview={loadingPreview}
                  loadingSend={loadingSend}
                  sendResult={sendResult}
                  expanded={expandedCards.has(emailType.key)}
                  onPreview={handlePreview}
                  onSend={handleSend}
                  onClosePreview={() => {
                    setPreview(null)
                    setExpandedCards((prev) => {
                      const next = new Set(prev)
                      next.delete(emailType.key)
                      return next
                    })
                  }}

                />
              ))}
            </YStack>
          </>
        )}
      </YStack>
    </ScrollView>
  )
}

type BrandColorsType = (typeof brandColors)['light'] | (typeof brandColors)['dark']

function EmailCard({
  emailType,
  colors,
  preview,
  loadingPreview,
  loadingSend,
  sendResult,
  expanded,
  onPreview,
  onSend,
  onClosePreview,
}: {
  emailType: EmailTypeInfo
  colors: BrandColorsType
  preview: PreviewState
  loadingPreview: string | null
  loadingSend: string | null
  sendResult: SendResult | null
  expanded: boolean
  onPreview: (key: string) => void
  onSend: (key: string) => void
  onClosePreview: () => void
}) {
  const isPreviewingThis = preview?.emailType === emailType.key
  const isLoadingPreview = loadingPreview === emailType.key
  const isLoadingSend = loadingSend === emailType.key
  const resultForThis = sendResult?.emailType === emailType.key ? sendResult : null

  return (
    <Card
      padding="$3"
      backgroundColor={colors.backgroundTertiary}
      borderWidth={isPreviewingThis ? 2 : 1}
      borderColor={isPreviewingThis ? colors.primary : colors.border}
    >
      <YStack gap="$3">
        {/* Header row */}
        <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$2">
          <YStack flex={1} minWidth={200}>
            <Text fontSize="$4" fontWeight="600" color={colors.textPrimary}>
              {emailType.label}
            </Text>
            <Text fontSize="$2" color={colors.textSecondary}>
              {emailType.description}
            </Text>
          </YStack>

          <XStack gap="$2" alignItems="center">
            <Button
              size="$3"
              icon={isLoadingPreview ? <Spinner size="small" width={16} height={16} /> : (isPreviewingThis ? ChevronUp : Eye)}
              onPress={() => onPreview(emailType.key)}
              backgroundColor="transparent"
              borderWidth={1}
              borderColor={colors.primary}
              disabled={isLoadingPreview}
            >
              <Text color={colors.primary} fontSize="$2">
                {isPreviewingThis ? 'Close' : 'Preview'}
              </Text>
            </Button>
            <Button
              size="$3"
              icon={isLoadingSend ? <Spinner size="small" width={16} height={16} /> : <Send size={16} color={colors.primaryForeground} />}
              onPress={() => onSend(emailType.key)}
              backgroundColor={colors.primary}
              hoverStyle={{ backgroundColor: colors.primaryHover }}
              pressStyle={{ backgroundColor: colors.primaryHover }}
              disabled={isLoadingSend}
            >
              <Text color={colors.primaryForeground} fontSize="$2">
                Send Test
              </Text>
            </Button>
          </XStack>
        </XStack>

        {/* Send result message */}
        {resultForThis ? (
          <XStack
            padding="$2"
            borderRadius="$2"
            backgroundColor={resultForThis.success ? '#dcfce7' : '#fef2f2'}
            alignItems="center"
            gap="$2"
          >
            <Text
              fontSize="$2"
              color={resultForThis.success ? '#166534' : '#991b1b'}
              flex={1}
            >
              {resultForThis.success ? 'Sent successfully' : 'Error'}: {resultForThis.message}
            </Text>
          </XStack>
        ) : null}

        {/* Preview iframe */}
        {isPreviewingThis && preview ? (
          <YStack gap="$2">
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize="$2" color={colors.textSecondary}>
                Subject: <Text fontWeight="600" color={colors.textPrimary}>{preview.subject}</Text>
              </Text>
              <Button
                size="$2"
                icon={X}
                onPress={onClosePreview}
                backgroundColor="transparent"
                circular
              />
            </XStack>
            <div
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                overflow: 'hidden',
                backgroundColor: '#ffffff',
              }}
            >
              <iframe
                srcDoc={preview.html}
                sandbox="allow-same-origin"
                style={{
                  width: '100%',
                  minHeight: 500,
                  border: 'none',
                  display: 'block',
                }}
                title={`Preview: ${emailType.label}`}
              />
            </div>
          </YStack>
        ) : null}
      </YStack>
    </Card>
  )
}
