'use client'

import { useMemo, useState } from 'react'
import { YStack, XStack, H2, Paragraph, Separator, Button, Text } from '@my/ui'
import { PostView } from '../post-view'
import { redactPost } from '@my/app/utils/redact-post'
import { ANONYMOUS_VIEWER, type Viewer } from '@my/app/utils/viewer-pii'
import type { Post } from '@my/app/types/post'

/**
 * /brand showcase for {@link PostView} (Consolidated CMS Phase 3).
 *
 * The primary dev surface for the read-only renderer, mirroring the
 * PostEditorShowcase. Mounts a rich in-memory sample Post exercising ALL SEVEN
 * block kinds, then renders it through the SAME redaction boundary the real
 * public page uses (`redactPost(sample, viewer, {channel:'public-web'})`) so the
 * showcase proves the display is a pure function of a redacted post. A tier
 * toggle flips the viewer between anonymous and verified-member so you can see
 * PII (surnames, precise address, bios, contacts) appear/disappear WITHOUT
 * PostView knowing anything about privacy — the redactor does all the work.
 */

const MEMBER_VIEWER: Viewer = {
  assurance: 'authenticated',
  role: 'member',
  tenant: 'demo-ecclesia',
  email: 'member@demo.test',
}

function makeSamplePost(): Post {
  const now = new Date().toISOString()
  return {
    id: 'sample-post',
    tenant: 'demo-ecclesia',
    authorId: 'showcase@tee-admin.com',
    title: 'Baptism & Fraternal Weekend',
    occasion: ['baptism', 'study-weekend'],
    summary: 'Join us to witness a baptism and for a weekend of study and fellowship.',
    visibility: 'public',
    sharingScope: 'own',
    lifecycle: {
      publishDate: '2026-08-01',
      startsAt: '2026-09-12T14:00:00.000Z',
    },
    status: 'ready',
    createdAt: now,
    updatedAt: now,
    blocks: [
      {
        id: 'b-text',
        kind: 'text',
        containsPii: false,
        body:
          '# You are warmly invited\n\nWe rejoice to announce a **baptism** followed by a study weekend.\n\n- Talks across the weekend\n- Shared meals\n- Visit https://www.example.org for the full programme',
      },
      {
        id: 'b-person',
        kind: 'person',
        role: 'candidate',
        people: [
          {
            id: 'p1',
            firstName: 'Sarah',
            lastName: 'Thompson',
            title: 'Sister',
            ecclesia: 'Toronto East',
            bio: 'Sarah has been attending for two years and gives her testimony of coming to the Truth.',
          },
        ],
      },
      {
        id: 'b-person2',
        kind: 'person',
        role: 'speaker',
        people: [
          {
            id: 'p2',
            firstName: 'John',
            lastName: 'Carter',
            title: 'Brother',
            ecclesia: 'Hamilton',
            label: 'weekend speaker',
            contact: 'john.carter@example.org',
          },
        ],
      },
      {
        id: 'b-location',
        kind: 'location',
        mode: 'geo',
        label: 'Service & Weekend',
        venueName: 'Toronto East Hall',
        address: '960 Pape Avenue',
        city: 'Toronto',
        province: 'ON',
        postalCode: 'M4K 3V1',
        country: 'Canada',
        lat: 43.68,
        lng: -79.35,
        directions: 'Enter from the north parking lot.',
        parkingInfo: 'Free parking on site and on adjacent streets.',
        onlineMeeting: {
          link: 'https://zoom.us/j/123456789',
          platform: 'zoom',
          meetingId: '123 456 789',
          password: 'ecclesia',
          dialInNumber: '+1 647 555 0100',
        },
      },
      {
        id: 'b-time',
        kind: 'time',
        label: 'Baptism service',
        startsAt: '2026-09-12T14:00:00.000Z',
        endsAt: '2026-09-12T16:00:00.000Z',
        timezone: 'America/Toronto',
      },
      {
        id: 'b-flyer',
        kind: 'flyer',
        document: {
          id: 'doc1',
          documentType: 'upload',
          fileName: 'weekend.png',
          originalName: 'Weekend Programme',
          fileUrl: 'https://placehold.co/600x800/png?text=Weekend+Programme',
          fileSize: 12345,
          mimeType: 'image/png',
          uploadedAt: new Date(),
          uploadedBy: 'showcase@tee-admin.com',
          description: 'The full weekend programme and talk schedule.',
        },
      },
      {
        id: 'b-registration',
        kind: 'registration',
        required: true,
        deadline: '2026-09-05',
        registrationUrl: 'https://www.example.org/register',
        contactEmail: 'welcome@example.org',
        contactPhone: '+1 647 555 0199',
        hasFee: true,
        fee: 25,
        paymentInstructions: 'Payment collected at the door or via e-transfer.',
        notes: 'Lunch provided for those who register.',
      },
      {
        id: 'b-link',
        kind: 'link',
        url: 'https://www.example.org/weekend',
        label: 'Full weekend details',
      },
    ],
  }
}

export function PostViewShowcase() {
  const sample = useMemo(makeSamplePost, [])
  const [asMember, setAsMember] = useState(false)

  const viewer = asMember ? MEMBER_VIEWER : ANONYMOUS_VIEWER
  const redacted = redactPost(sample, viewer, { channel: 'public-web' })

  return (
    <YStack padding="$4" gap="$4" maxWidth={860} width="100%" alignSelf="center">
      <YStack gap="$2">
        <H2>Post View</H2>
        <Paragraph color="$color10">
          The read-only display twin of the editor. This mounts a rich in-memory
          sample post (all seven block kinds) rendered through the SAME
          `redactPost(...)` boundary the public page uses. Toggle the viewer tier to
          watch surnames, precise address, bios and contacts appear/disappear —
          PostView itself does no gating.
        </Paragraph>
        <XStack gap="$2" alignItems="center">
          <Button
            size="$3"
            theme={asMember ? undefined : 'blue'}
            onPress={() => setAsMember(false)}
          >
            Anonymous (public)
          </Button>
          <Button
            size="$3"
            theme={asMember ? 'blue' : undefined}
            onPress={() => setAsMember(true)}
          >
            Verified member
          </Button>
          <Text fontSize="$2" color="$color10">
            Channel: public-web
          </Text>
        </XStack>
      </YStack>

      <Separator />

      {redacted ? (
        <PostView post={redacted} />
      ) : (
        <Text color="$color10">This viewer cannot reach the sample post.</Text>
      )}
    </YStack>
  )
}
