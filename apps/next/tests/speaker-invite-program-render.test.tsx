import { describe, it, expect, vi } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import SpeakerInvitation, { speakerInvitationSubject } from '../../email-builder/emails/SpeakerInvitation'
import SpeakerConfirmation from '../../email-builder/emails/SpeakerConfirmation'
import { inviteWording } from '@my/app/provider/dynamodb/invite-program-types'

/**
 * The invitation email with an ecclesia's own program wording (§3a), and the
 * core three unchanged. Placeholder people and ecclesias only.
 */

vi.mock('../utils/email/resolve-brand-profile', () => ({
  resolveBrandProfile: vi.fn(async () => ({
    ecclesiaName: 'Example Ecclesia',
    displayName: 'Example Ecclesia',
    publicName: 'Example Ecclesia Christadelphians',
    addressLines: ['123 Example Street'],
  })),
}))

import { renderSpeakerInvitation } from '../utils/email/speaker-invite-render'

const base = SpeakerInvitation.PreviewProps
const plain = async (el: React.ReactElement) => (await render(el, { plainText: true })).replace(/\s+/g, ' ')

describe('SpeakerInvitation with a program phrase and about line', () => {
  it('header, opening line and subject use the phrase; the about line follows the opening line', async () => {
    const props = {
      ...base,
      inviteType: 'youth-meditation',
      phrase: 'share a meditation',
      about: 'Our youth evening is held at the hall, Fridays at 7:30pm.',
    }
    const text = await plain(<SpeakerInvitation {...props} />)
    expect(text).toContain('An invitation to share a meditation')
    expect(text).toContain('We invite you to share a meditation at Example Ecclesia.')
    const opening = text.indexOf('We invite you to')
    const about = text.indexOf('Our youth evening is held at the hall')
    const note = text.indexOf('It has been too long')
    expect(opening).toBeLessThan(about)
    expect(about).toBeLessThan(note)
    expect(speakerInvitationSubject(props.inviteType, 'Example Ecclesia', props.phrase)).toBe(
      'An invitation to share a meditation at Example Ecclesia'
    )
  })

  it('memorial renders exactly as before when its program keeps the built-in wording', async () => {
    const before = await render(<SpeakerInvitation {...base} />)
    const withProgram = await render(<SpeakerInvitation {...base} phrase={inviteWording({ type: 'memorial' }).phrase} />)
    expect(withProgram).toBe(before)
    expect(speakerInvitationSubject('memorial', 'Example Ecclesia')).toBe('An invitation to exhort at our Memorial Service at Example Ecclesia')
  })

  it('an old invite (no snapshot) renders its type’s legacy phrase through the server render', async () => {
    const old = { type: 'bible_class' }
    const wording = inviteWording(old)
    const r = await renderSpeakerInvitation({ ...base, inviteType: old.type, phrase: wording.phrase })
    expect(r.subject).toBe('An invitation to speak at our Bible Class at Example Ecclesia')
    expect(r.text.replace(/\s+/g, ' ')).toContain('We invite you to speak at our Bible Class at Example Ecclesia.')
  })

  it('other emails name a custom program by its name, and the core three by their old labels', async () => {
    const cProps = SpeakerConfirmation.PreviewProps
    const custom = await plain(<SpeakerConfirmation {...cProps} inviteType="CYC class" />)
    expect(custom).toContain('CYC class at Example Ecclesia')
    const core = await plain(<SpeakerConfirmation {...cProps} inviteType="memorial" />)
    const byName = await plain(<SpeakerConfirmation {...cProps} inviteType={inviteWording({ type: 'memorial' }).name} />)
    expect(byName).toBe(core)
  })
})
