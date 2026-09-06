import { redirect } from 'next/navigation'

/**
 * Canonical public subscription URL from issue #75 ("/subscribe").
 *
 * The self-serve preference UI ships at `/email-preferences` (the footer link
 * target); `/subscribe` is the friendly, memorable public entry point named in
 * the issue — e.g. a cold "find your ecclesia → pick Newsletter" visitor typing
 * it in. It forwards to the real page, preserving the one-click-login `token`
 * so an emailed link that lands here still identifies the recipient.
 */
export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  redirect(token ? `/email-preferences?token=${encodeURIComponent(token)}` : '/email-preferences')
}
