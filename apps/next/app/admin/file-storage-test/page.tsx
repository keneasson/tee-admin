'use client'

import { useHydrated } from '@my/app/hooks/use-hydrated'
import { useSession } from 'next-auth/react'
import { useState } from 'react'
import { YStack, XStack, Text, Button, Card, Spinner } from '@my/ui'
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from '@tamagui/lucide-icons'

interface ValidationResult {
  isValid: boolean
  step: string
  error?: string
  details?: any
  timestamp?: string
  help?: any
}

export default function FileStorageTestPage() {
  const isHydrated = useHydrated()
  const { data: session } = useSession()
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  if (!isHydrated) {
    return (
      <YStack padding="$4" alignItems="center">
        <Spinner size="large" />
      </YStack>
    )
  }

  if (!session?.user) {
    return (
      <YStack padding="$4" alignItems="center">
        <Text>Please sign in to access this page.</Text>
      </YStack>
    )
  }

  if (session.user.role !== 'owner' && session.user.role !== 'admin') {
    return (
      <YStack padding="$4" alignItems="center">
        <Text>Insufficient permissions. Admin/Owner access required.</Text>
      </YStack>
    )
  }

  const validateFileStorage = async () => {
    setIsLoading(true)
    setValidation(null)

    try {
      const response = await fetch('/api/admin/file-storage/validate')
      const result = await response.json()
      setValidation(result)
    } catch (error) {
      setValidation({
        isValid: false,
        step: 'request',
        error: error instanceof Error ? error.message : 'Network error'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = (isValid: boolean) => {
    if (isValid) {
      return <CheckCircle color="$green10" size="$1" />
    }
    return <XCircle color="$red10" size="$1" />
  }

  const getStepDescription = (step: string) => {
    switch (step) {
      case 'environment': return 'Environment Configuration'
      case 'connection': return 'AWS S3 Connection'
      case 'complete': return 'Validation Complete'
      case 'request': return 'API Request'
      default: return 'Unknown Step'
    }
  }

  return (
    <YStack padding="$4" space="$4" maxWidth={800} alignSelf="center">
      <YStack space="$2">
        <Text fontSize="$8" fontWeight="bold">File Storage Validation</Text>
        <Text color="$gray11">
          Test AWS S3 connectivity and IAM permissions for file upload functionality.
        </Text>
      </YStack>

      <XStack space="$3">
        <Button
          onPress={validateFileStorage}
          disabled={isLoading}
          theme="blue"
          icon={isLoading ? <Spinner size="small" /> : <RefreshCw size="$1" />}
        >
          {isLoading ? 'Testing...' : 'Test Connection'}
        </Button>
      </XStack>

      {validation && (
        <Card padding="$4" space="$3">
          <XStack space="$3" alignItems="center">
            {getStatusIcon(validation.isValid)}
            <YStack flex={1}>
              <Text fontWeight="bold" fontSize="$6">
                {validation.isValid ? 'Connection Successful' : 'Connection Failed'}
              </Text>
              <Text color="$gray11" fontSize="$3">
                Step: {getStepDescription(validation.step)}
              </Text>
            </YStack>
          </XStack>

          {validation.error && (
            <YStack space="$2">
              <XStack space="$2" alignItems="center">
                <AlertCircle color="$red10" size="$1" />
                <Text fontWeight="bold" color="$red11">Error Details</Text>
              </XStack>
              <Text color="$red11" fontSize="$4">
                {validation.error}
              </Text>
            </YStack>
          )}

          {validation.details && (
            <YStack space="$2">
              <Text fontWeight="bold">Service Details</Text>
              <Card backgroundColor="$gray2" padding="$3">
                <Text fontFamily="$mono" fontSize="$3">
                  {JSON.stringify(validation.details, null, 2)}
                </Text>
              </Card>
            </YStack>
          )}

          {validation.help && (
            <YStack space="$2">
              <Text fontWeight="bold">Environment Variables Help</Text>
              <YStack space="$2">
                <Text fontWeight="600" color="$red11">Required:</Text>
                {Object.entries(validation.help.required).map(([key, desc]) => (
                  <Text key={key} fontFamily="$mono" fontSize="$3">
                    {key}: {desc as string}
                  </Text>
                ))}
                
                <Text fontWeight="600" color="$blue11">Optional:</Text>
                {Object.entries(validation.help.optional).map(([key, desc]) => (
                  <Text key={key} fontFamily="$mono" fontSize="$3">
                    {key}: {desc as string}
                  </Text>
                ))}
              </YStack>
            </YStack>
          )}

          {validation.timestamp && (
            <Text color="$gray11" fontSize="$2">
              Tested at: {new Date(validation.timestamp).toLocaleString()}
            </Text>
          )}
        </Card>
      )}

      <Card padding="$4" backgroundColor="$blue2">
        <YStack space="$2">
          <Text fontWeight="bold" color="$blue11">What This Test Validates</Text>
          <YStack space="$1">
            <Text fontSize="$3">• Environment variables are properly configured</Text>
            <Text fontSize="$3">• AWS credentials are valid and accessible</Text>
            <Text fontSize="$3">• S3 bucket exists and is accessible</Text>
            <Text fontSize="$3">• IAM permissions allow read, write, and delete operations</Text>
            <Text fontSize="$3">• Network connectivity to AWS S3 service</Text>
          </YStack>
        </YStack>
      </Card>
    </YStack>
  )
}