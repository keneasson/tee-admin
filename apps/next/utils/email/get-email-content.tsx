import { get_upcoming_program } from 'next-app/utils/get-upcoming-program'
import { render } from '@react-email/render'
import SundaySchool from 'email-builder/emails/SundaySchool'
import {
  BibleClassType,
  MemorialServiceType,
  ProgramTypes,
  SundayEvents,
  SundaySchoolType,
} from '@my/app/types'
import { Event, LocationInfo } from '@my/app/types/events'
import MemorialService from 'email-builder/emails/Memorial'
import Newsletter from 'email-builder/emails/Newsletter'
import { emailReasons } from './email-send'
import BibleClass from 'email-builder/emails/BibleClass'
import BusinessMeeting from 'email-builder/emails/BusinessMeeting'
import CustomEmail from 'email-builder/emails/CustomEmail'
import FuneralEmail from 'email-builder/emails/Funeral'
import BaptismEmail from 'email-builder/emails/Baptism'
import InterEcclesiaWrapper from 'email-builder/emails/InterEcclesiaWrapper'
import { StudyWeekendContent } from 'email-builder/components/StudyWeekendContent'
import { getEventById } from '@my/app/services/event-service'
import { generateEcclesiaUpdateUrl } from './ecclesia-token'
import { EventDurationCalculator } from '@my/app/utils/newsletter/event-duration'
import type { DisplayDuration } from '@my/app/types/newsletter-rules'
import { syncYouTubeUrlsForEmail } from '../youtube-sync-helper'
import { resolveServiceTime } from '@my/app/config/service-time-resolver'
import { getEcclesiaByName } from '../dynamodb/locations'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'
import { meetingRepository } from '@my/app/provider/dynamodb/repositories/meeting-repository'
import MeetingEmail from 'email-builder/emails/MeetingEmail'
import { meetingRecordToEmailProps } from './meeting-email-helpers'

// Event display duration rules - same as news-events.tsx
const EVENT_DURATION_RULES: Record<string, { displayDuration: DisplayDuration; priority: number; includeInSummary: boolean; requiresCTA: boolean }> = {
  'recurring': { displayDuration: 'until_event_date', priority: 1, includeInSummary: true, requiresCTA: false },
  'funeral': { displayDuration: '2_weeks_then_thursday_before', priority: 2, includeInSummary: true, requiresCTA: false },
  'engagement': { displayDuration: '3_weeks_from_publish', priority: 3, includeInSummary: true, requiresCTA: false },
  'wedding': { displayDuration: '3_weeks_or_until_event_date', priority: 4, includeInSummary: true, requiresCTA: false },
  'baptism': { displayDuration: '1_week_after_event', priority: 5, includeInSummary: true, requiresCTA: false },
  'study-weekend': { displayDuration: 'until_event_date', priority: 6, includeInSummary: true, requiresCTA: true },
  'general': { displayDuration: 'until_event_date', priority: 7, includeInSummary: true, requiresCTA: false },
  'election-cycle': { displayDuration: 'until_event_date', priority: 8, includeInSummary: false, requiresCTA: false },
}

function mergeSundayEvents(events: ProgramTypes[]): SundayEvents[] {
  const memorial = events.filter((e) => e.Key === 'memorial') as MemorialServiceType[]

  return memorial.reduce((acc, m) => {
    const date = m.Date
    const sundaySchool = events.find(
      (e) => e.Key === 'sundaySchool' && e.Date === date
    ) as SundaySchoolType
    return sundaySchool
      ? [
          ...acc,
          {
            ...m,
            Refreshments: sundaySchool.Refreshments,
            'Holidays and Special Events': sundaySchool['Holidays and Special Events'],
          },
        ]
      : [
          ...acc,
          {
            ...m,
            Refreshments: '',
            'Holidays and Special Events': 'Sunday School is in Recess',
          },
        ]
  }, [] as SundayEvents[])
}

// Data fetching functions for newsletter - call functions directly, not APIs
async function fetchEvents(): Promise<Event[]> {
  try {
    // Import the actual function that the /api/events/public route uses
    const { getPublishedEvents } = await import('@my/app/services/event-service')
    const events = await getPublishedEvents()

    // Apply EventDurationCalculator filtering (same rules as web UI)
    const currentDate = new Date()
    const filteredEvents = events.filter((event: Event) => {
      const rule = EVENT_DURATION_RULES[event.type]
      if (!rule) {
        console.warn(`[Newsletter Email] No duration rule for event type: ${event.type}`)
        return true // Include if no rule defined
      }

      const context = {
        event,
        rule,
        currentDate,
        firstIncludedDate: (event as any).newsletter?.firstIncludedDate
          ? new Date((event as any).newsletter.firstIncludedDate)
          : undefined
      }

      const result = EventDurationCalculator.shouldIncludeEvent(context)

      console.log(`[Newsletter Email] Event "${event.title}" (${event.type}):`, {
        shouldInclude: result.shouldInclude,
        reason: result.reason,
      })

      return result.shouldInclude
    })

    console.log(`[Newsletter Email] Filtered ${events.length} events down to ${filteredEvents.length}`)
    return filteredEvents
  } catch (error) {
    console.error('Failed to fetch events for newsletter:', error)
    return []
  }
}

async function fetchBibleReadings(): Promise<any[]> {
  try {
    // Import the actual function that the /api/json/range route uses
    const { default: dailyReadings } = await import('../../data/daily-readings.json')

    // Use the same logic as the API route
    const startRange = new Date()
    const endRange = new Date()
    const startMidnight = stripTime(startRange)
    endRange.setDate(endRange.getDate() + 7)
    const endMidnight = stripTime(endRange)

    const filteredReadings = dailyReadings.filter((row: any) => {
      const date = Object.keys(row)[0]
      const dateObj = new Date(`${date}, ${startMidnight.getUTCFullYear()}`)
      const dateOnly = stripTime(dateObj)
      return dateOnly >= startMidnight && dateOnly <= endMidnight
    })

    // Transform the data structure for the email template
    return filteredReadings.map((row: any) => {
      const dateKey = Object.keys(row)[0]
      const readings = row[dateKey]
      const dateObj = new Date(`${dateKey}, ${startMidnight.getUTCFullYear()}`)

      return {
        date: dateObj,
        reading1: readings[0] || '',
        reading2: readings[1] || '',
        reading3: readings[2] || ''
      }
    })
  } catch (error) {
    console.error('Failed to fetch readings for newsletter:', error)
    return []
  }
}

function stripTime(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}

// Returns [html, text, subject?] - subject is optional and only returned for event-specific emails
export const getEmailContent = async (
  reason: emailReasons,
  note?: string,
  customHtmlContent?: string,
  customSubject?: string,
  eventId?: string,
  eventType?: string,
  meetingId?: string
): Promise<(string | undefined)[]> => {
  switch (reason) {
    case 'sunday-school':
      const events = await get_upcoming_program(['sundaySchool'])
      console.log('events', events)
      const htmlContent = await render(<SundaySchool events={events as SundaySchoolType[]} note={note} />)
      const textContent = await render(<SundaySchool events={events as SundaySchoolType[]} note={note} />, {
        plainText: true,
      })
      return [htmlContent, textContent]
    case 'recap':
      // Fallback: Sync YouTube URLs if any are missing (primary sync happens at livestream creation)
      const recapSyncResult = await syncYouTubeUrlsForEmail(14)
      if (recapSyncResult?.updated && recapSyncResult.updated > 0) {
        console.log(`📺 YouTube fallback sync for recap: ${recapSyncResult.updated} URLs synced`)
      }

      const [memorialEvents, recapUpcomingEvents] = await Promise.all([
        get_upcoming_program(['memorial', 'sundaySchool']),
        fetchEvents(),
      ])
      console.log('memorialEvents', memorialEvents)
      const mergeEvents = mergeSundayEvents(memorialEvents)
      console.log('mergeEvents', mergeEvents)
      const MemorialHtmlContent = await render(<MemorialService events={mergeEvents} note={note} upcomingEvents={recapUpcomingEvents} />)
      const MemorialTextContent = await render(<MemorialService events={mergeEvents} note={note} upcomingEvents={recapUpcomingEvents} />, {
        plainText: true,
      })
      return [MemorialHtmlContent, MemorialTextContent]
    case 'bible-class':
      const bibleClassEvents = await get_upcoming_program(['bibleClass'])
      const bibleClassHtmlContent = await render(
        <BibleClass events={bibleClassEvents as BibleClassType[]} note={note} />
      )
      const bibleClassTextContent = await render(
        <BibleClass events={bibleClassEvents as BibleClassType[]} note={note} />,
        {
          plainText: true,
        }
      )
      return [bibleClassHtmlContent, bibleClassTextContent]
    case 'newsletter':
      // Fallback: Sync YouTube URLs if any are missing (primary sync happens at livestream creation)
      const newsletterSyncResult = await syncYouTubeUrlsForEmail(14)
      if (newsletterSyncResult?.updated && newsletterSyncResult.updated > 0) {
        console.log(`📺 YouTube fallback sync for newsletter: ${newsletterSyncResult.updated} URLs synced`)
      }

      // Fetch all required data for newsletter (including per-ecclesia service times)
      const [scheduleData, upcomingEvents, readingsData, homeEcclesia] = await Promise.all([
        get_upcoming_program(['memorial', 'sundaySchool', 'bibleClass']),
        fetchEvents(),
        fetchBibleReadings(),
        getEcclesiaByName(HOME_ECCLESIA.canonicalName),
      ])

      console.log('Newsletter data fetched:', {
        scheduleData: scheduleData.length,
        upcomingEvents: upcomingEvents.length,
        readingsData: readingsData.length
      })

      // Resolve per-ecclesia service times (falls back to catalogue defaults)
      const ecclesiaConfig = homeEcclesia?.scheduleConfig
      const newsletterServiceTimes = {
        sundaySchool: {
          displayTime: resolveServiceTime(ecclesiaConfig, 'sundaySchool').displayTime,
          label: resolveServiceTime(ecclesiaConfig, 'sundaySchool').name,
        },
        memorial: {
          displayTime: resolveServiceTime(ecclesiaConfig, 'memorial').displayTime,
          label: resolveServiceTime(ecclesiaConfig, 'memorial').name,
        },
        bibleClass: {
          displayTime: resolveServiceTime(ecclesiaConfig, 'bibleClass').displayTime,
          label: resolveServiceTime(ecclesiaConfig, 'bibleClass').name,
        },
      }

      const newsletterHtmlContent = await render(
        <Newsletter
          scheduleEvents={scheduleData as (MemorialServiceType | BibleClassType | SundaySchoolType)[]}
          upcomingEvents={upcomingEvents}
          readings={readingsData}
          note={note}
          serviceTimes={newsletterServiceTimes}
        />
      )
      const newsletterTextContent = await render(
        <Newsletter
          scheduleEvents={scheduleData as (MemorialServiceType | BibleClassType | SundaySchoolType)[]}
          upcomingEvents={upcomingEvents}
          readings={readingsData}
          note={note}
          serviceTimes={newsletterServiceTimes}
        />,
        { plainText: true }
      )
      return [newsletterHtmlContent, newsletterTextContent]
    case 'business-meeting':
      // If meetingId is provided, use the new MeetingEmail template
      if (meetingId) {
        const meeting = await meetingRepository.getById(meetingId)
        if (!meeting) {
          throw new Error(`Meeting not found: ${meetingId}`)
        }
        const emailProps = meetingRecordToEmailProps(meeting)
        const meetingHtmlContent = await render(<MeetingEmail {...emailProps} />)
        const meetingTextContent = await render(<MeetingEmail {...emailProps} />, {
          plainText: true,
        })
        return [meetingHtmlContent, meetingTextContent, meeting.title]
      }
      // Fallback to legacy BusinessMeeting template
      const businessMeetingHtmlContent = await render(<BusinessMeeting note={note} />)
      const businessMeetingTextContent = await render(<BusinessMeeting note={note} />, {
        plainText: true,
      })
      return [businessMeetingHtmlContent, businessMeetingTextContent]
    case 'custom':
      if (!customHtmlContent) {
        throw new Error('Custom email requires htmlContent')
      }
      const customEmailHtmlContent = await render(
        <CustomEmail htmlContent={customHtmlContent} subject={customSubject} note={note} />
      )
      const customEmailTextContent = await render(
        <CustomEmail htmlContent={customHtmlContent} subject={customSubject} note={note} />,
        { plainText: true }
      )
      return [customEmailHtmlContent, customEmailTextContent]
    case 'event-announcement':
      if (!eventId) {
        throw new Error('Event announcement requires eventId')
      }
      const event = await getEventById(eventId)
      if (!event) {
        throw new Error(`Event not found: ${eventId}`)
      }

      // Build event URL
      const baseUrl = process.env.NEXT_PUBLIC_AUTH_URL || 'https://tee-admin.com'
      const eventUrl = `${baseUrl}/events/${event.id}`

      if (event.type === 'funeral') {
        // Funerals can have location in locations.service or location field
        const locations = (event as any).locations
        const serviceLocation = locations?.service || event.location
        const visitationLocation = locations?.visitation || locations?.viewing // Support both field names
        const gravesideLocation = locations?.graveside

        // Debug: log the event data to see what we're working with
        console.log('[FuneralEmail] Event data:', JSON.stringify({
          title: event.title,
          locations: (event as any).locations,
          location: event.location,
          serviceLocation,
          serviceDate: event.serviceDate,
          visitationDate: (event as any).visitationDate || (event as any).viewingDate,
          hasGravesideService: (event as any).hasGravesideService,
          eventTimezone: (event as any).eventTimezone,
        }, null, 2))

        // Helper to convert location object to email-compatible format
        const formatLocation = (loc: any) => {
          if (!loc) return undefined
          if (typeof loc === 'string') return { name: loc }
          if (!loc.name) return undefined
          return {
            name: loc.name,
            address: loc.address,
            city: loc.city,
            province: loc.province,
            postalCode: loc.postalCode,
            onlineMeeting: loc.onlineMeeting,
          }
        }

        const locationData = formatLocation(serviceLocation)
        const visitationLocationData = formatLocation(visitationLocation)
        const gravesideLocationData = formatLocation(gravesideLocation)

        // Get visitation and graveside data
        const visitationDate = (event as any).visitationDate || (event as any).viewingDate
        const visitationEndDate = (event as any).visitationEndDate
        const visitationSameLocation = (event as any).visitationSameLocation ?? true
        const hasGravesideService = (event as any).hasGravesideService ?? false
        const gravesideDate = (event as any).gravesideDate
        const eventTimezone = (event as any).eventTimezone || 'America/Toronto'

        const funeralHtml = await render(
          <FuneralEmail
            title={event.title}
            deceased={event.deceased}
            ecclesia={typeof event.hostingEcclesia === 'string' ? event.hostingEcclesia : event.hostingEcclesia?.name}
            aboutDeceased={event.aboutDeceased}
            deceasedPhoto={event.deceasedPhoto}
            serviceDate={event.serviceDate}
            location={locationData}
            visitationDate={visitationDate}
            visitationEndDate={visitationEndDate}
            visitationSameLocation={visitationSameLocation}
            visitationLocation={visitationLocationData}
            hasGravesideService={hasGravesideService}
            gravesideDate={gravesideDate}
            gravesideLocation={gravesideLocationData}
            eventTimezone={eventTimezone}
            note={note}
            eventUrl={eventUrl}
            obituaryUrl={event.obituaryUrl}
          />
        )
        const funeralText = await render(
          <FuneralEmail
            title={event.title}
            deceased={event.deceased}
            ecclesia={typeof event.hostingEcclesia === 'string' ? event.hostingEcclesia : event.hostingEcclesia?.name}
            aboutDeceased={event.aboutDeceased}
            deceasedPhoto={event.deceasedPhoto}
            serviceDate={event.serviceDate}
            location={locationData}
            visitationDate={visitationDate}
            visitationEndDate={visitationEndDate}
            visitationSameLocation={visitationSameLocation}
            visitationLocation={visitationLocationData}
            hasGravesideService={hasGravesideService}
            gravesideDate={gravesideDate}
            gravesideLocation={gravesideLocationData}
            eventTimezone={eventTimezone}
            note={note}
            eventUrl={eventUrl}
            obituaryUrl={event.obituaryUrl}
          />,
          { plainText: true }
        )

        // Build custom subject for funeral emails: "In memory of {title} {first_name} {last_name}"
        const deceased = event.deceased
        const deceasedName = deceased
          ? `${deceased.title || ''} ${deceased.firstName || ''} ${deceased.lastName || ''}`.trim()
          : ''
        const funeralSubject = deceasedName ? `In memory of ${deceasedName}` : undefined

        return [funeralHtml, funeralText, funeralSubject]
      } else if (event.type === 'baptism') {
        // Format location for baptism email template
        const formatBaptismLocation = (loc: LocationInfo | undefined) => {
          if (!loc) return undefined
          return {
            name: loc.name || '',
            address: loc.address,
            city: loc.city,
            province: loc.province,
            postalCode: loc.postalCode,
          }
        }
        const baptismLocation = formatBaptismLocation(event.location)
        const baptismOnlineMeeting = event.location?.onlineMeeting

        console.log('[BaptismEmail] Location data:', JSON.stringify({
          locationMode: event.location?.mode,
          hasOnlineMeeting: !!baptismOnlineMeeting,
          onlineMeetingLink: baptismOnlineMeeting?.link,
          onlineMeetingPlatform: baptismOnlineMeeting?.platform,
          fullLocation: event.location,
        }, null, 2))

        const baptismHtml = await render(
          <BaptismEmail
            title={event.title}
            candidate={event.candidate}
            aboutCandidate={event.aboutCandidate}
            candidatePhoto={event.candidatePhoto}
            baptismDate={event.baptismDate}
            baptismTime={(event as any).baptismTime}
            location={baptismLocation}
            onlineMeeting={baptismOnlineMeeting}
            hostingEcclesia={event.hostingEcclesia}
            description={event.description}
            note={note}
            eventUrl={eventUrl}
          />
        )
        const baptismText = await render(
          <BaptismEmail
            title={event.title}
            candidate={event.candidate}
            aboutCandidate={event.aboutCandidate}
            candidatePhoto={event.candidatePhoto}
            baptismDate={event.baptismDate}
            baptismTime={(event as any).baptismTime}
            location={baptismLocation}
            onlineMeeting={baptismOnlineMeeting}
            hostingEcclesia={event.hostingEcclesia}
            description={event.description}
            note={note}
            eventUrl={eventUrl}
          />,
          { plainText: true }
        )
        return [baptismHtml, baptismText]
      } else {
        throw new Error(`Unsupported event type for announcement: ${event.type}`)
      }
    case 'inter-ecclesia':
      if (!eventId) {
        throw new Error('Inter-ecclesia announcement requires eventId')
      }
      const interEcclesiaEvent = await getEventById(eventId)
      if (!interEcclesiaEvent) {
        throw new Error(`Event not found: ${eventId}`)
      }

      // Build event URL
      const interEcclesiaBaseUrl = process.env.NEXT_PUBLIC_AUTH_URL || 'https://tee-admin.com'
      const interEcclesiaEventUrl = `${interEcclesiaBaseUrl}/events/${interEcclesiaEvent.id}`

      // Get ecclesia name for the "from" field
      const fromEcclesia = typeof interEcclesiaEvent.hostingEcclesia === 'string'
        ? interEcclesiaEvent.hostingEcclesia
        : interEcclesiaEvent.hostingEcclesia?.name || 'Toronto East Christadelphian Ecclesia'

      // Render the inner event content based on type
      let innerEventHtml = ''
      let interEcclesiaSubject = ''

      if (interEcclesiaEvent.type === 'funeral') {
        // Similar to event-announcement funeral handling
        const locations = (interEcclesiaEvent as any).locations
        const serviceLocation = locations?.service || interEcclesiaEvent.location
        const visitationLocation = locations?.visitation || locations?.viewing
        const gravesideLocation = locations?.graveside

        const formatLocation = (loc: any) => {
          if (!loc) return undefined
          if (typeof loc === 'string') return { name: loc }
          if (!loc.name) return undefined
          return {
            name: loc.name,
            address: loc.address,
            city: loc.city,
            province: loc.province,
            postalCode: loc.postalCode,
            onlineMeeting: loc.onlineMeeting,
          }
        }

        const locationData = formatLocation(serviceLocation)
        const visitationLocationData = formatLocation(visitationLocation)
        const gravesideLocationData = formatLocation(gravesideLocation)
        const visitationDate = (interEcclesiaEvent as any).visitationDate || (interEcclesiaEvent as any).viewingDate
        const visitationEndDate = (interEcclesiaEvent as any).visitationEndDate
        const visitationSameLocation = (interEcclesiaEvent as any).visitationSameLocation ?? true
        const hasGravesideService = (interEcclesiaEvent as any).hasGravesideService ?? false
        const gravesideDate = (interEcclesiaEvent as any).gravesideDate
        const eventTimezone = (interEcclesiaEvent as any).eventTimezone || 'America/Toronto'

        // Render funeral template to get inner HTML
        const funeralFullHtml = await render(
          <FuneralEmail
            title={interEcclesiaEvent.title}
            deceased={interEcclesiaEvent.deceased}
            ecclesia={fromEcclesia}
            aboutDeceased={interEcclesiaEvent.aboutDeceased}
            deceasedPhoto={interEcclesiaEvent.deceasedPhoto}
            serviceDate={interEcclesiaEvent.serviceDate}
            location={locationData}
            visitationDate={visitationDate}
            visitationEndDate={visitationEndDate}
            visitationSameLocation={visitationSameLocation}
            visitationLocation={visitationLocationData}
            hasGravesideService={hasGravesideService}
            gravesideDate={gravesideDate}
            gravesideLocation={gravesideLocationData}
            eventTimezone={eventTimezone}
            note={note}
            eventUrl={interEcclesiaEventUrl}
            obituaryUrl={interEcclesiaEvent.obituaryUrl}
          />
        )

        // Extract body content (between <body> and </body>)
        const bodyMatch = funeralFullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i)
        innerEventHtml = bodyMatch ? bodyMatch[1] : funeralFullHtml

        // Build subject
        const deceased = interEcclesiaEvent.deceased
        const deceasedName = deceased
          ? `${deceased.title || ''} ${deceased.firstName || ''} ${deceased.lastName || ''}`.trim()
          : ''
        interEcclesiaSubject = deceasedName ? `In memory of ${deceasedName}` : 'Funeral Announcement'

      } else if (interEcclesiaEvent.type === 'baptism') {
        // Format location for baptism (similar to funeral handling)
        const formatBaptismLocation = (loc: LocationInfo | undefined) => {
          if (!loc) return undefined
          return {
            name: loc.name || '',
            address: loc.address,
            city: loc.city,
            province: loc.province,
            postalCode: loc.postalCode,
          }
        }

        const baptismLocation = formatBaptismLocation(interEcclesiaEvent.location)
        const interBaptismOnlineMeeting = interEcclesiaEvent.location?.onlineMeeting

        // Render baptism template to get inner HTML
        const baptismFullHtml = await render(
          <BaptismEmail
            title={interEcclesiaEvent.title}
            candidate={interEcclesiaEvent.candidate}
            aboutCandidate={interEcclesiaEvent.aboutCandidate}
            candidatePhoto={interEcclesiaEvent.candidatePhoto}
            baptismDate={interEcclesiaEvent.baptismDate}
            baptismTime={(interEcclesiaEvent as any).baptismTime}
            location={baptismLocation}
            onlineMeeting={interBaptismOnlineMeeting}
            hostingEcclesia={interEcclesiaEvent.hostingEcclesia}
            description={interEcclesiaEvent.description}
            note={note}
            eventUrl={interEcclesiaEventUrl}
          />
        )

        // Extract body content
        const bodyMatch = baptismFullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i)
        innerEventHtml = bodyMatch ? bodyMatch[1] : baptismFullHtml

        // Build subject
        const candidate = interEcclesiaEvent.candidate
        const candidateName = candidate
          ? `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim()
          : ''
        interEcclesiaSubject = candidateName ? `Baptism of ${candidateName}` : 'Baptism Announcement'

      } else if (interEcclesiaEvent.type === 'study-weekend') {
        // Study weekend - render directly with InterEcclesiaWrapper
        const dateRange = interEcclesiaEvent.dateRange
        const startDate = dateRange?.start ? new Date(dateRange.start) : null
        const endDate = dateRange?.end ? new Date(dateRange.end) : null
        const eventTitle = interEcclesiaEvent.title
        const theme = (interEcclesiaEvent as any).theme || interEcclesiaEvent.title
        const speakers = (interEcclesiaEvent as any).speakers || []
        const description = interEcclesiaEvent.description || ''
        const registration = (interEcclesiaEvent as any).registration
        const location = interEcclesiaEvent.location

        // Format location for component with full address
        const locationData = location ? {
          name: typeof location === 'string' ? location : location.name,
          address: typeof location === 'string' ? undefined : location.address,
          city: typeof location === 'string' ? undefined : location.city,
          province: typeof location === 'string' ? undefined : location.province,
          postalCode: typeof location === 'string' ? undefined : location.postalCode,
          country: typeof location === 'string' ? undefined : (location as any).country,
        } : null

        interEcclesiaSubject = theme || 'Study Weekend Invitation'
        const updateContactUrl = '{{ecclesiaUpdateUrl}}'

        // Render with proper React composition
        const studyWeekendHtml = await render(
          <InterEcclesiaWrapper
            eventType="study-weekend"
            title={interEcclesiaSubject}
            previewText={`Please share with your ecclesia: ${interEcclesiaSubject}`}
            updateContactUrl={updateContactUrl}
          >
            <StudyWeekendContent
              title={eventTitle}
              theme={theme}
              startDate={startDate}
              endDate={endDate}
              location={locationData}
              speakers={speakers}
              description={description}
              registration={registration}
              eventUrl={interEcclesiaEventUrl}
            />
          </InterEcclesiaWrapper>
        )
        const studyWeekendText = await render(
          <InterEcclesiaWrapper
            eventType="study-weekend"
            title={interEcclesiaSubject}
            previewText={`Please share with your ecclesia: ${interEcclesiaSubject}`}
            updateContactUrl={updateContactUrl}
          >
            <StudyWeekendContent
              title={eventTitle}
              theme={theme}
              startDate={startDate}
              endDate={endDate}
              location={locationData}
              speakers={speakers}
              description={description}
              registration={registration}
              eventUrl={interEcclesiaEventUrl}
            />
          </InterEcclesiaWrapper>,
          { plainText: true }
        )

        return [studyWeekendHtml, studyWeekendText, interEcclesiaSubject]

      } else {
        throw new Error(`Unsupported event type for inter-ecclesia announcement: ${interEcclesiaEvent.type}`)
      }

      // Generate a placeholder for the update URL - will be personalized at send time
      // For now, use a generic URL that can be replaced
      const updateContactUrl = '{{ecclesiaUpdateUrl}}'

      // Wrap in InterEcclesiaWrapper
      const interEcclesiaHtml = await render(
        <InterEcclesiaWrapper
          eventType={interEcclesiaEvent.type as any}
          title={interEcclesiaSubject}
          previewText={`Please share with your ecclesia: ${interEcclesiaSubject}`}
          fromEcclesia={fromEcclesia}
          innerHtml={innerEventHtml}
          updateContactUrl={updateContactUrl}
        />
      )
      const interEcclesiaText = await render(
        <InterEcclesiaWrapper
          eventType={interEcclesiaEvent.type as any}
          title={interEcclesiaSubject}
          previewText={`Please share with your ecclesia: ${interEcclesiaSubject}`}
          fromEcclesia={fromEcclesia}
          innerHtml={innerEventHtml}
          updateContactUrl={updateContactUrl}
        />,
        { plainText: true }
      )

      return [interEcclesiaHtml, interEcclesiaText, interEcclesiaSubject]
    default:
      return [undefined]
  }
}
