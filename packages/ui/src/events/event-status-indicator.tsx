import { Event } from '@my/app/types/events'
import { getEventValidationStatus } from '@my/app/services/event-service'
import { EventValidator } from '@my/app/utils/event-validation'
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  XCircle, 
  Eye, 
  EyeOff 
} from '@tamagui/lucide-icons'
import { XStack, YStack, Text, Circle } from 'tamagui'

interface EventStatusIndicatorProps {
  event: Partial<Event>
  showDetails?: boolean
  size?: 'small' | 'medium' | 'large'
}

export function EventStatusIndicator({ 
  event, 
  showDetails = false, 
  size = 'medium' 
}: EventStatusIndicatorProps) {
  const validationStatus = getEventValidationStatus(event)
  
  const getStatusConfig = () => {
    // Check if event is effectively published (ready status + past publish date)
    const now = new Date()
    const isPublished = event.status === 'ready' && event.publishDate && new Date(event.publishDate) <= now
    
    if (isPublished) {
      return {
        icon: Eye,
        color: '$green10',
        bgColor: '$green2',
        text: 'Published',
        description: 'Event is live and visible to users'
      }
    }

    switch (validationStatus.status) {
      case 'publish-ready':
        return {
          icon: CheckCircle,
          color: '$green10',
          bgColor: '$green2',
          text: 'Ready to Publish',
          description: 'All required fields complete'
        }
      case 'draft-ready':
        return {
          icon: Clock,
          color: '$blue10',
          bgColor: '$blue2',
          text: 'Draft',
          description: 'Saved but needs more details to publish'
        }
      case 'incomplete':
        return {
          icon: AlertCircle,
          color: '$orange10',
          bgColor: '$orange2',
          text: 'Incomplete',
          description: 'Add basic information to save'
        }
      default:
        return {
          icon: XCircle,
          color: '$gray10',
          bgColor: '$gray2',
          text: 'Unknown',
          description: 'Status unclear'
        }
    }
  }

  const getArchiveConfig = () => {
    if (event.status === 'archived') {
      return {
        icon: EyeOff,
        color: '$red10',
        bgColor: '$red2',
        text: 'Archived',
        description: 'Event is archived and hidden'
      }
    }
    return null
  }

  const statusConfig = getStatusConfig()
  const archiveConfig = getArchiveConfig()
  const IconComponent = archiveConfig?.icon || statusConfig.icon

  const iconSize = size === 'small' ? '$0.75' : size === 'medium' ? '$1' : '$1.25'
  const textSize = size === 'small' ? '$2' : size === 'medium' ? '$3' : '$4'

  if (archiveConfig) {
    return (
      <XStack space="$2" alignItems="center">
        <Circle 
          size={iconSize} 
          backgroundColor={archiveConfig.bgColor}
          padding="$1"
          alignItems="center"
          justifyContent="center"
        >
          <IconComponent size={iconSize} color={archiveConfig.color} />
        </Circle>
        
        <Text fontSize={textSize} color={archiveConfig.color} fontWeight="500">
          {archiveConfig.text}
        </Text>
        
        {showDetails && (
          <Text fontSize="$2" color="$gray11">
            ({archiveConfig.description})
          </Text>
        )}
      </XStack>
    )
  }

  return (
    <XStack space="$2" alignItems="center">
      <Circle 
        size={iconSize} 
        backgroundColor={statusConfig.bgColor}
        padding="$1"
        alignItems="center"
        justifyContent="center"
      >
        <IconComponent size={iconSize} color={statusConfig.color} />
      </Circle>
      
      <Text fontSize={textSize} color={statusConfig.color} fontWeight="500">
        {statusConfig.text}
      </Text>
      
      {showDetails && (
        <Text fontSize="$2" color="$gray11">
          ({statusConfig.description})
        </Text>
      )}
    </XStack>
  )
}

interface EventValidationSummaryProps {
  event: Partial<Event>
  showWarnings?: boolean
}

export function EventValidationSummary({ 
  event, 
  showWarnings = false 
}: EventValidationSummaryProps) {
  const validationStatus = getEventValidationStatus(event)
  
  // Get detailed validation errors for publishing
  const publishValidation = EventValidator.canPublish(event)
  
  // Check if event is effectively published
  const now = new Date()
  const isPublished = event.status === 'ready' && event.publishDate && new Date(event.publishDate) <= now

  if (validationStatus.status === 'publish-ready' && isPublished) {
    return null // No need to show summary for published, complete events
  }

  if (validationStatus.canPublish && !isPublished) {
    return (
      <XStack space="$3" alignItems="center" padding="$3" backgroundColor="$green1" borderRadius="$3" borderWidth={1} borderColor="$green6">
        <CheckCircle size="$1" color="$green10" />
        <Text flex={1} fontSize="$3" color="$green11" fontWeight="600">
          ✅ Ready to publish! Click "Save Event" to make it live.
        </Text>
      </XStack>
    )
  }

  if (!validationStatus.canPublish && publishValidation.errors.length > 0) {
    return (
      <YStack space="$2" padding="$3" backgroundColor="$orange1" borderRadius="$3" borderWidth={1} borderColor="$orange6">
        <XStack space="$2" alignItems="center">
          <Clock size="$1" color="$orange10" />
          <Text fontSize="$3" color="$orange11" fontWeight="600">
            📝 Draft Mode - Missing fields to publish:
          </Text>
        </XStack>
        <YStack space="$1" paddingLeft="$4">
          {publishValidation.errors.map((error, index) => (
            <Text key={index} fontSize="$2" color="$orange11">
              • {error.message}
            </Text>
          ))}
        </YStack>
        <Text fontSize="$2" color="$gray11" fontStyle="italic">
          Fill these in to automatically publish when you save
        </Text>
      </YStack>
    )
  }

  return (
    <XStack space="$3" alignItems="center" padding="$3" backgroundColor="$gray1" borderRadius="$3">
      <EventStatusIndicator event={event} size="small" />
      <Text flex={1} fontSize="$3" color="$gray11">
        {validationStatus.message}
      </Text>
    </XStack>
  )
}