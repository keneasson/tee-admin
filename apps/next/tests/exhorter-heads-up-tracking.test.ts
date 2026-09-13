import { describe, it, expect } from 'vitest'
import {
  exhorterHeadsUpCampaignId,
  EMAIL_TRACKING_CONFIG_SET,
} from '../utils/email/exhorter-heads-up'

/**
 * Whether the heads-up ARRIVED is part of the feature, not a nicety: a bounce
 * means a visiting brother was never told he is exhorting.
 *
 * Two things make that work, and both are easy to get subtly wrong in a way
 * that looks wired up while recording nothing:
 *
 *   1. the send must carry a configuration set, or SES publishes no events at
 *      all and the webhook never hears about the message;
 *   2. the campaign tag must be named and shaped so the webhook can attribute
 *      the event back to a recipient row.
 */
describe('the campaign id is usable as an SES message tag', () => {
  const id = exhorterHeadsUpCampaignId('2026-09-20')

  it('contains only characters SES accepts in a tag value', () => {
    // SES allows ASCII letters, digits, dashes and underscores. Anything else
    // — a `#`, most obviously — makes SendEmail fail, so the email would not
    // go at all. This is the assertion that would have caught it.
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('does not smuggle a second # into the row key', () => {
    // Rows are keyed `SEND#{campaignId}`; a `#` inside would muddle the key.
    expect(id).not.toContain('#')
    expect(`SEND#${id}`.match(/#/g)).toHaveLength(1)
  })

  it('identifies the Sunday it belongs to, so it can be looked up', () => {
    expect(id).toContain('2026-09-20')
    expect(id).not.toBe(exhorterHeadsUpCampaignId('2026-09-27'))
  })

  it('is stable — the same Sunday always gives the same id', () => {
    // Events arrive minutes after the send; a fresh id per call (a UUID, say)
    // would leave every event unattributable.
    expect(exhorterHeadsUpCampaignId('2026-09-20')).toBe(id)
  })

  it('stays within the SES tag length limit', () => {
    expect(id.length).toBeLessThanOrEqual(256)
  })
})

describe('the configuration set', () => {
  it('matches the one the SES webhook is wired to', () => {
    // Broadcasts use this exact name (`email-send.tsx`). A different one here
    // would publish events to a set nothing is subscribed to.
    expect(EMAIL_TRACKING_CONFIG_SET).toBe('tee-email-tracking')
  })
})
