import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from '@react-email/render'
import { AutoLinkText } from 'email-builder/components/AutoLinkText'

/**
 * Italic was CAPTURED by the editor and STORED by the serializer, but rendered
 * by neither the web view nor email — so it silently disappeared at publish.
 * That is the first iteration of ADR-0004's "render progressively": the format
 * already held it; the renderers catch up.
 */
describe('email renders emphasis the storage already held', () => {
  it('renders *italic* as <em>', async () => {
    const html = await render(<AutoLinkText text="a *stressed* word" />)
    expect(html).toContain('<em>stressed</em>')
  })

  it('still renders **bold** as <strong>', async () => {
    const html = await render(<AutoLinkText text="a **strong** word" />)
    expect(html).toContain('<strong>strong</strong>')
  })

  it('does not mis-read **bold** as two italics', async () => {
    const html = await render(<AutoLinkText text="**bold**" />)
    expect(html).toContain('<strong>bold</strong>')
    expect(html).not.toContain('<em></em>')
  })

  it('renders ***both*** as bold + italic', async () => {
    const html = await render(<AutoLinkText text="***loud***" />)
    expect(html).toContain('<strong>')
    expect(html).toContain('<em>loud</em>')
  })

  it('leaves URLs auto-linked alongside emphasis', async () => {
    const html = await render(<AutoLinkText text="see *this* https://example.com now" />)
    expect(html).toContain('<em>this</em>')
    expect(html).toContain('https://example.com')
  })
})
