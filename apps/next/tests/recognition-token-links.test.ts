import { describe, it, expect } from 'vitest'
import { addRecognitionToken, addUtmParameters } from '../utils/email/utm-links'

// #252: every first-party link in a bulk email carries the recipient's
// recognition token, so click-through lands `recognized`, not anonymous.
describe('addRecognitionToken', () => {
  const T = 'tok123'

  it('stamps ?rt= on a tee-admin event link (the Shelburne case)', () => {
    const html = '<a href="https://tee-admin.com/events/abc">Register</a>'
    expect(addRecognitionToken(html, T)).toContain('href="https://tee-admin.com/events/abc?rt=tok123"')
  })

  it('keeps existing query params (UTM) and escapes & for HTML', () => {
    const html = addUtmParameters('<a href="https://tee-admin.com/events/abc">x</a>', 'newsletter', '2026-09-26')
    const out = addRecognitionToken(html, T)
    expect(out).toMatch(/utm_medium=email&amp;.*rt=tok123/)
  })

  it('covers echadhub.org and subdomains', () => {
    expect(addRecognitionToken('<a href="https://echadhub.org/posts/1">x</a>', T)).toContain('rt=tok123')
    expect(addRecognitionToken('<a href="https://www.tee-admin.com/">x</a>', T)).toContain('rt=tok123')
  })

  it('leaves third-party, unsubscribe, api, auth and already-tokened links alone', () => {
    const untouched = [
      '<a href="https://example.com/events/1">x</a>',
      '<a href="https://tee-admin.com.evil.io/x">x</a>',
      '<a href="https://tee-admin.com/unsubscribe">x</a>',
      '<a href="https://tee-admin.com/api/email/open">x</a>',
      '<a href="https://tee-admin.com/auth/signin-token?token=abc">x</a>',
      '<a href="https://tee-admin.com/email-preferences?token=abc">x</a>',
    ]
    for (const html of untouched) expect(addRecognitionToken(html, T)).toBe(html)
  })
})
