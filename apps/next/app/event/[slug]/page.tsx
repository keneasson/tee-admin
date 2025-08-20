import { EventService } from '@/utils/events'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { Event } from '@my/app/types/events'
import { use } from 'react'
import EventPageClient from './event-page-client'

interface EventPageProps {
  params: Promise<{ slug: string }>
}

// Server-side data fetching
async function getEventBySlug(slug: string): Promise<Event | null> {
  try {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
    })
    const dynamoDb = DynamoDBDocument.from(client)
    const eventService = new EventService(dynamoDb)

    return await eventService.getEventBySlug(slug)
  } catch (error) {
    console.error('Error fetching event by slug:', error)
    return null
  }
}

export default function EventPage({ params }: EventPageProps) {
  const { slug } = use(params)

  return <EventPageClient slug={slug} />
}

// Generate metadata for SEO
export async function generateMetadata({ params }: EventPageProps) {
  const { slug } = await params
  const event = await getEventBySlug(slug)

  if (!event) {
    return {
      title: 'Event Not Found',
      description: 'The requested event could not be found.',
    }
  }

  const eventDate = getEventDisplayDate(event)
  const title = `${event.title}${eventDate ? ` - ${eventDate}` : ''} | Toronto East Christadelphian Ecclesia`
  const description =
    event.metadata?.metaDescription ||
    event.newsletter?.webSummary ||
    event.newsletter?.emailSummary ||
    event.description ||
    `Join us for ${event.title}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: event.metadata?.socialImage ? [event.metadata.socialImage] : [],
      type: 'article',
      publishedTime: event.publishDate?.toISOString(),
      modifiedTime: event.updatedAt.toISOString(),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: event.metadata?.socialImage ? [event.metadata.socialImage] : [],
    },
    alternates: {
      canonical: `/event/${slug}`,
    },
  }
}

// Helper function to get display date for event
function getEventDisplayDate(event: Event): string | null {
  try {
    let date: Date | undefined

    switch (event.type) {
      case 'study-weekend':
        date = (event as any).dateRange?.start
        break
      case 'funeral':
        date = (event as any).serviceDate
        break
      case 'wedding':
        date = (event as any).ceremonyDate
        break
      case 'baptism':
        date = (event as any).baptismDate
        break
      case 'general':
        date = (event as any).startDate
        break
    }

    if (date) {
      return new Date(date).toLocaleDateString('en-CA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    }
  } catch (error) {
    console.error('Error formatting event date:', error)
  }

  return null
}
