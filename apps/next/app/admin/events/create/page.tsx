'use client'

import { useHydrated } from '@my/app/hooks/use-hydrated'
import { useSession } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { YStack, XStack, Text, Button, Dialog, Card, ScrollView } from '@my/ui'
import { X, Calendar, MapPin, User } from '@tamagui/lucide-icons'
import { ProgressiveEventForm } from '@my/ui'
import { useAdminTheme } from '@my/ui'

export default function CreateEventPage() {
  const isHydrated = useHydrated()
  const { data: session } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  
  // Automatically enable admin theme for admin/owner users
  useAdminTheme(session?.user?.role)

  // Early returns after all hooks have been called
  if (!isHydrated) {
    return (
      <YStack padding="$4" alignItems="center">
        <Text>Loading...</Text>
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

  const handleSave = async (eventData: any) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      })

      if (response.ok) {
        const newEvent = await response.json()
        router.push(`/admin/events/${newEvent.id}/edit`)
      } else {
        const error = await response.json()
        console.error('Error creating event:', error)
        alert('Failed to create event. Please try again.')
      }
    } catch (error) {
      console.error('Error creating event:', error)
      alert('Failed to create event. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePreview = (eventData: any) => {
    setPreviewData(eventData)
    setShowPreview(true)
  }

  const formatEventDate = (date: any) => {
    if (!date) return 'Not set'
    const d = new Date(date)
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleCancel = () => {
    if (confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')) {
      router.back()
    }
  }

  return (
    <YStack padding="$4" space="$4" maxWidth={1000} alignSelf="center">
      {/* Header */}
      <YStack space="$2">
        <XStack space="$3" alignItems="center">
          <Button
            size="$3"
            variant="outlined"
            icon={X}
            onPress={handleCancel}
          >
            Cancel
          </Button>
          <YStack>
            <Text fontSize="$8" fontWeight="bold">Create New Event</Text>
            <Text color="$gray11">
              Create a new ecclesial event with progressive disclosure for easy setup.
            </Text>
          </YStack>
        </XStack>
      </YStack>

      {/* Event Form */}
      <ProgressiveEventForm
        onSave={handleSave}
        onPreview={handlePreview}
        isLoading={isLoading}
      />

      {/* Preview Modal */}
      <Dialog modal open={showPreview} onOpenChange={setShowPreview}>
        <Dialog.Portal>
          <Dialog.Overlay key="overlay" backgroundColor="rgba(0,0,0,0.5)" />
          <Dialog.Content
            key="content"
            bordered
            elevate
            backgroundColor="$background"
            padding="$0"
            maxWidth="90vw"
            maxHeight="90vh"
            width="800px"
          >
            <XStack justifyContent="space-between" alignItems="center" padding="$4" borderBottomWidth={1} borderBottomColor="$borderColor">
              <Text fontSize="$6" fontWeight="bold">Event Preview</Text>
              <Button size="$3" variant="ghost" icon={X} onPress={() => setShowPreview(false)} />
            </XStack>

            <ScrollView maxHeight="70vh">
              <YStack padding="$4" space="$4">
                {previewData && (
                  <>
                    {/* Basic Info */}
                    <Card padding="$4" backgroundColor="$gray1">
                      <YStack space="$3">
                        <Text fontSize="$7" fontWeight="bold">{previewData.title || 'Untitled Event'}</Text>
                        <XStack space="$2" alignItems="center">
                          <Calendar size="$1" color="$blue10" />
                          <Text fontSize="$4" color="$blue11" textTransform="capitalize">
                            {previewData.type?.replace('-', ' ')} Event
                          </Text>
                        </XStack>
                        
                        {previewData.description && (
                          <Text fontSize="$4" color="$gray11">{previewData.description}</Text>
                        )}

                        {/* Event-specific date display */}
                        {previewData.type === 'baptism' && previewData.baptismDate && (
                          <XStack space="$2" alignItems="center">
                            <Text fontWeight="600">Date:</Text>
                            <Text>{formatEventDate(previewData.baptismDate)}</Text>
                          </XStack>
                        )}
                        
                        {previewData.type === 'study-weekend' && previewData.dateRange && (
                          <XStack space="$2" alignItems="center">
                            <Text fontWeight="600">Dates:</Text>
                            <Text>{formatEventDate(previewData.dateRange.start)} - {formatEventDate(previewData.dateRange.end)}</Text>
                          </XStack>
                        )}
                        
                        {previewData.type === 'wedding' && previewData.ceremonyDate && (
                          <XStack space="$2" alignItems="center">
                            <Text fontWeight="600">Date:</Text>
                            <Text>{formatEventDate(previewData.ceremonyDate)}</Text>
                          </XStack>
                        )}
                      </YStack>
                    </Card>

                    {/* Type-specific details */}
                    {previewData.type === 'baptism' && previewData.candidate && (
                      <Card padding="$4" backgroundColor="$blue1">
                        <YStack space="$2">
                          <Text fontSize="$5" fontWeight="600">Candidate</Text>
                          <Text fontSize="$4">{previewData.candidate.firstName} {previewData.candidate.lastName}</Text>
                        </YStack>
                      </Card>
                    )}

                    {previewData.type === 'study-weekend' && previewData.theme && (
                      <Card padding="$4" backgroundColor="$green1">
                        <YStack space="$2">
                          <Text fontSize="$5" fontWeight="600">Theme</Text>
                          <Text fontSize="$4">{previewData.theme}</Text>
                        </YStack>
                      </Card>
                    )}

                    {previewData.type === 'wedding' && previewData.couple && (
                      <Card padding="$4" backgroundColor="$pink1">
                        <YStack space="$2">
                          <Text fontSize="$5" fontWeight="600">Couple</Text>
                          <Text fontSize="$4">
                            {previewData.couple.bride?.firstName} {previewData.couple.bride?.lastName} & {previewData.couple.groom?.firstName} {previewData.couple.groom?.lastName}
                          </Text>
                        </YStack>
                      </Card>
                    )}

                    {/* Hosting */}
                    {previewData.hostingEcclesia && (
                      <Card padding="$4" backgroundColor="$gray1">
                        <XStack space="$2" alignItems="center">
                          <User size="$1" color="$green10" />
                          <XStack space="$2" alignItems="center">
                            <Text fontWeight="600">Hosted by:</Text>
                            <Text>{previewData.hostingEcclesia}</Text>
                          </XStack>
                        </XStack>
                      </Card>
                    )}

                    {/* Location */}
                    {previewData.location?.name && (
                      <Card padding="$4" backgroundColor="$gray1">
                        <YStack space="$2">
                          <XStack space="$2" alignItems="center">
                            <MapPin size="$1" color="$blue10" />
                            <Text fontSize="$5" fontWeight="600">Location</Text>
                          </XStack>
                          <Text fontSize="$4">{previewData.location.name}</Text>
                          {previewData.location.address && (
                            <Text fontSize="$3" color="$gray11">
                              {previewData.location.address}
                              {previewData.location.city && `, ${previewData.location.city}`}
                              {previewData.location.province && `, ${previewData.location.province}`}
                            </Text>
                          )}
                        </YStack>
                      </Card>
                    )}

                    {/* Speakers */}
                    {previewData.speakers?.length > 0 && (
                      <Card padding="$4" backgroundColor="$gray1">
                        <YStack space="$2">
                          <Text fontSize="$5" fontWeight="600">Speakers</Text>
                          {previewData.speakers.map((speaker: any, index: number) => (
                            <XStack key={index} space="$1" alignItems="center">
                              <Text fontSize="$4">{speaker.firstName} {speaker.lastName}</Text>
                              {speaker.ecclesia ? (
                                <Text fontSize="$4" color="$gray11"> ({speaker.ecclesia})</Text>
                              ) : null}
                            </XStack>
                          ))}
                        </YStack>
                      </Card>
                    )}

                    {/* Zoom Link */}
                    {previewData.zoomLink && (
                      <Card padding="$4" backgroundColor="$blue1">
                        <YStack space="$2">
                          <Text fontSize="$5" fontWeight="600">Zoom Link</Text>
                          <Text fontSize="$3" color="$blue11" selectable>{previewData.zoomLink}</Text>
                        </YStack>
                      </Card>
                    )}
                  </>
                )}
              </YStack>
            </ScrollView>

            <XStack justifyContent="flex-end" padding="$4" borderTopWidth={1} borderTopColor="$borderColor">
              <Button onPress={() => setShowPreview(false)}>Close</Button>
            </XStack>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </YStack>
  )
}