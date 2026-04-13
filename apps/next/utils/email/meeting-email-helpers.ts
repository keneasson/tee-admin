import type { MeetingRecord } from '@my/app/types/meetings'
import type { MeetingEmailProps } from 'email-builder/emails/MeetingEmail'

/**
 * Maps a MeetingRecord (from DynamoDB) to the flat props expected by MeetingEmail template.
 */
export function meetingRecordToEmailProps(meeting: MeetingRecord): MeetingEmailProps {
  // Format date for display
  const rawDate = meeting.nextOccurrence || meeting.oneOffDate
  let formattedDate: string | undefined
  if (rawDate) {
    try {
      const dateObj = new Date(rawDate)
      formattedDate = dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: meeting.timezone || 'America/Toronto',
      })
    } catch {
      formattedDate = rawDate
    }
  }

  // Format time for display (convert "19:30" to "7:30 PM")
  let formattedTime: string | undefined
  if (meeting.startTime) {
    try {
      const [hours, minutes] = meeting.startTime.split(':').map(Number)
      const period = hours >= 12 ? 'PM' : 'AM'
      const displayHours = hours % 12 || 12
      formattedTime = `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`
    } catch {
      formattedTime = meeting.startTime
    }
  }

  return {
    ownerName: meeting.ownerName,
    title: meeting.title,
    date: formattedDate,
    time: formattedTime,
    zoomLink: meeting.onlineMeeting?.link,
    meetingId: meeting.onlineMeeting?.meetingId,
    passcode: meeting.onlineMeeting?.passcode,
    dialIn: meeting.onlineMeeting?.dialIn,
    locationName: meeting.location?.name,
    locationAddress: meeting.location?.address,
    documents: meeting.documents.length > 0 ? meeting.documents : undefined,
    note: meeting.notes,
  }
}
