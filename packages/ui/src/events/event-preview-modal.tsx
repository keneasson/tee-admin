import { useState } from 'react'
import {
  Dialog,
  Button,
  YStack,
  XStack,
  Text,
  Tabs,
  ScrollView,
} from 'tamagui'
import { X } from '@tamagui/lucide-icons'
import { Event } from '@my/app/types/events'
import { EventSummaryCard } from './event-summary-card'
import { EventDetailView } from './event-detail-view'
import { generateEventStub } from './event-utils'

interface EventPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  eventData: Partial<Event>
}

/**
 * Preview Modal that uses the same components as the actual event pages
 * This ensures the preview matches exactly what users will see
 */
export function EventPreviewModal({ isOpen, onClose, eventData }: EventPreviewModalProps) {
  const [activeTab, setActiveTab] = useState('summary')
  const eventStub = generateEventStub(eventData.title || 'untitled', eventData.startDate)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay
          key="overlay"
          animation="quick"
          opacity={0.5}
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
        />
        <Dialog.Content
          bordered
          elevate
          key="content"
          animateOnly={['transform', 'opacity']}
          animation={[
            'quick',
            {
              opacity: {
                overshootClamping: true,
              },
            },
          ]}
          enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
          exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
          gap="$3"
          maxWidth="90vw"
          width={800}
          maxHeight="90vh"
        >
          {/* Header */}
          <XStack justifyContent="space-between" alignItems="center">
            <Dialog.Title>Event Preview</Dialog.Title>
            <Dialog.Close asChild>
              <Button size="$2" variant="ghost" icon={X} />
            </Dialog.Close>
          </XStack>

          <Text fontSize="$2" color="$gray10">
            Event URL: /events/{eventStub}
          </Text>

          {/* Tabs for different views */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            orientation="horizontal"
            flexDirection="column"
            flex={1}
          >
            <Tabs.List>
              <Tabs.Tab value="summary">
                <Text>Summary View (Newsletter/List)</Text>
              </Tabs.Tab>
              <Tabs.Tab value="detail">
                <Text>Detail View (Event Page)</Text>
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Content value="summary" padding="$4">
              <YStack gap="$3">
                <Text fontSize="$3" color="$gray10" marginBottom="$2">
                  This is how the event will appear in the newsletter and event lists:
                </Text>
                {/* Using the same component that will be used in newsletters and lists */}
                <EventSummaryCard 
                  event={eventData} 
                  variant="newsletter"
                  onPress={() => console.log('Navigate to event details')}
                />
              </YStack>
            </Tabs.Content>

            <Tabs.Content value="detail" padding="$0">
              <YStack gap="$3">
                <Text fontSize="$3" color="$gray10" padding="$4" paddingBottom="$0">
                  This is how the event will appear on its detail page:
                </Text>
                <ScrollView maxHeight="60vh" padding="$4">
                  {/* Using the same component that will be used on event detail pages */}
                  <EventDetailView 
                    event={eventData}
                    showAdminInfo={false}
                  />
                </ScrollView>
              </YStack>
            </Tabs.Content>
          </Tabs>

          {/* Footer */}
          <XStack justifyContent="flex-end" gap="$3" padding="$3">
            <Dialog.Close asChild>
              <Button variant="outlined">Close Preview</Button>
            </Dialog.Close>
          </XStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}