import { render } from '@react-email/render'
import { createElement } from 'react'
import PostAnnouncement from 'email-builder/emails/PostAnnouncement'
import { postRepository } from '@my/app/provider/dynamodb/repositories/post-repository'
import { redactPost } from '@my/app/utils/redact-post'
import { emailIdentityFromProfile } from '@my/app/types/brand-profile'
import type { TenantConfig } from '@my/app/config/tenants'
import type { Viewer } from '@my/app/utils/viewer-pii'
import { resolveBrandProfile } from './resolve-brand-profile'

/**
 * getPostAnnouncementContent — render a single {@link Post} into the
 * `[html, text, subject]` tuple the send layer expects (mirrors the shape of
 * `getEmailContent` / `getNewsletterNativePosts`). This is the render half of the
 * Consolidated CMS send bridge (epic #131 §4-B).
 *
 * It is occasion-agnostic: funeral / baptism / wedding / double-baptism / general
 * ALL flow through here with NO per-type branching, because the body is just the
 * post's blocks rendered by the server-safe `PostEmailView` (wrapped in
 * `PostAnnouncement`).
 *
 * PII: the announcement goes to an opted-in member audience, so it renders at
 * member tier via the `'newsletter-email'` channel — the same narrow, audited
 * full-PII door the curated newsletter uses (redactor §8.2). We pass a matching
 * member-tier viewer so reach and PII agree.
 *
 * Brand: identity is resolved from the post's OWNING tenant (per-org footer/
 * header), passed as a PROP (not the client `EmailIdentityProvider`) so this runs
 * from an App Router server route.
 *
 * @throws when the post does not exist, or when the redactor drops it entirely
 *   (should not happen at member tier — surfaced rather than sending an empty
 *   shell).
 */
export async function getPostAnnouncementContent(
  postId: string,
  tenant: TenantConfig,
  note?: string
): Promise<[string, string, string]> {
  const post = await postRepository.getPost(postId)
  if (!post) {
    throw new Error(`Post not found: ${postId}`)
  }

  // Member-tier viewer for the announcement audience. The channel already forces
  // member reach + full-PII reveal; this viewer keeps the two axes consistent.
  const viewer: Viewer = {
    assurance: 'authenticated',
    role: 'member',
    tenant: post.tenant,
    email: null,
  }

  const redacted = redactPost(post, viewer, { channel: 'newsletter-email' })
  if (!redacted) {
    // Member tier can always reach the post; a null here means the post's own
    // visibility excludes even members (e.g. 'admins') — surface, don't send.
    throw new Error(`Post ${postId} is not visible to the member audience`)
  }

  const profile = await resolveBrandProfile({ ownerEcclesiaName: post.tenant, tenant })
  const identity = {
    ...emailIdentityFromProfile(profile),
    homeUrl: `https://${tenant.senderDomain}`,
    homeLabel: tenant.publicName,
  }

  const subject = post.title?.trim() || 'Announcement'

  const el = createElement(PostAnnouncement as any, { post: redacted, subject, note, identity })
  const html = await render(el)
  const text = await render(el, { plainText: true })

  return [html, text, subject]
}
