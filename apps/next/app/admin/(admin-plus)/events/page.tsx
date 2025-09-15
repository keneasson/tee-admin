'use client'

import { useAdminAccess } from '@my/ui/src/branding'
import { YStack, Text, Spinner, Heading, Tabs, Card, Button, XStack } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { ProgressiveEventForm } from '@my/ui/src/events/progressive-event-form'
import { EventListSelector } from '@my/ui/src/events/event-list-selector'
import { EventPreviewModal } from '@my/ui/src/events/event-preview-modal'
import { useState, useEffect } from 'react'
// Remove direct service imports - we'll use API routes instead
import { Event } from '@my/app/types/events'
import { List, Plus } from '@tamagui/lucide-icons'

export default function AdminEventsPage() {
  const isHydrated = useHydrated()
  const { hasAccess, isLoading } = useAdminAccess()
  const [isCreating, setIsCreating] = useState(false)
  const [events, setEvents] = useState<Event[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [activeTab, setActiveTab] = useState('list')
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [previewData, setPreviewData] = useState<any>(null)
  const [showPreview, setShowPreview] = useState(false)
  
  // Load events on mount
  useEffect(() => {
    if (hasAccess) {
      loadEvents()
    }
  }, [hasAccess])
  
  const loadEvents = async () => {
    try {
      setLoadingEvents(true)
      const response = await fetch('/api/events')
      if (!response.ok) {
        throw new Error('Failed to fetch events')
      }
      const allEvents = await response.json()
      setEvents(allEvents)
    } catch (error) {
      console.error('Failed to load events:', error)
    } finally {
      setLoadingEvents(false)
    }
  }
  
  // Show loading state during hydration, auth check, or when redirecting
  if (!isHydrated || isLoading || !hasAccess) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Spinner size="large" />
        <Text marginTop="$4">Loading...</Text>
      </YStack>
    )
  }

  const handleSaveEvent = async (eventData: any) => {
    try {
      setIsCreating(true)
      console.log('Creating/updating event:', eventData)
      
      const response = await fetch('/api/events', {
        method: selectedEvent?.id || eventData.id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...eventData,
          id: selectedEvent?.id || eventData.id
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || error.error || 'Failed to save event')
      }
      
      const savedEvent = await response.json()
      console.log('Event saved successfully:', savedEvent)
      
      // Reload events and switch to list view
      await loadEvents()
      setActiveTab('list')
      setSelectedEvent(null)
    } catch (error) {
      console.error('Failed to save event:', error)
      alert(`Failed to save event: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsCreating(false)
    }
  }

  const handleAutoSave = async (eventData: any) => {
    try {
      console.log('Auto-saving event:', eventData)
      
      const response = await fetch('/api/events', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData)
      })
      
      if (!response.ok) {
        const error = await response.json()
        console.error('Auto-save failed:', error)
        throw new Error(error.details || error.error || 'Auto-save failed')
      }
      
      const savedEvent = await response.json()
      console.log('Auto-save successful:', savedEvent)
      
      return savedEvent
    } catch (error) {
      console.error('Auto-save failed:', error)
      throw error
    }
  }

  const handlePreviewEvent = (eventData: any) => {
    console.log('Preview event:', eventData)
    setPreviewData(eventData)
    setShowPreview(true)
  }
  
  const handleSelectEvent = (event: Event) => {
    setSelectedEvent(event)
    setActiveTab('form')
  }
  
  const handleCreateNew = () => {
    setSelectedEvent(null)
    setActiveTab('form')
  }

  return (
    <YStack flex={1} padding="$4" space="$4">
      <YStack space="$2">
        <Heading size="$8">Event Management</Heading>
        <Text color="$textSecondary">
          Create and manage events for the Toronto East Christadelphian Ecclesia
        </Text>
      </YStack>
      
      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab}
        width="100%"
        flex={1}
        flexDirection="column"
      >
        <Tabs.List backgroundColor="$background" borderRadius="$4">
          <Tabs.Tab value="list" flex={1}>
            <XStack space="$2" alignItems="center">
              <List size="$1" />
              <Text>Event List</Text>
            </XStack>
          </Tabs.Tab>
          <Tabs.Tab value="form" flex={1}>
            <XStack space="$2" alignItems="center">
              <Plus size="$1" />
              <Text>{selectedEvent ? 'Edit Event' : 'Create Event'}</Text>
            </XStack>
          </Tabs.Tab>
        </Tabs.List>
        
        <Tabs.Content value="list" flex={1} paddingTop="$4">
          {loadingEvents ? (
            <YStack flex={1} justifyContent="center" alignItems="center">
              <Spinner size="large" />
              <Text marginTop="$4">Loading events...</Text>
            </YStack>
          ) : (
            <EventListSelector
              events={events}
              onSelect={handleSelectEvent}
              onCreateNew={handleCreateNew}
              onPreview={handlePreviewEvent}
              isLoading={loadingEvents}
            />
          )}
        </Tabs.Content>
        
        <Tabs.Content value="form" flex={1} paddingTop="$4">
          <Card padding="$4" borderWidth={1} borderColor="$borderColor">
            <YStack space="$3">
              {selectedEvent && (
                <XStack justifyContent="space-between" alignItems="center" marginBottom="$4">
                  <Text fontSize="$5" fontWeight="600">
                    Editing: {selectedEvent.title}
                  </Text>
                  <Button 
                    size="$3" 
                    variant="outlined" 
                    onPress={() => {
                      setSelectedEvent(null)
                      setActiveTab('list')
                    }}
                  >
                    Cancel Edit
                  </Button>
                </XStack>
              )}
              
              <ProgressiveEventForm
                initialData={selectedEvent || undefined}
                onSave={handleSaveEvent}
                onAutoSave={handleAutoSave}
                onPreview={handlePreviewEvent}
                isLoading={isCreating}
                skipTypeSelection={!!selectedEvent}
                selectedType={selectedEvent?.type}
              />
            </YStack>
          </Card>
        </Tabs.Content>
      </Tabs>

      {/* Event Preview Modal */}
      {previewData && (
        <EventPreviewModal 
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          eventData={previewData}
        />
      )}
    </YStack>
  )
}