import { render } from '@react-email/render'
import ExhorterHeadsUp, {
  type ExhorterHeadsUpAttendOption,
} from 'email-builder/emails/ExhorterHeadsUp'
import { resolveTenantFromEnv, type TenantConfig } from '@my/app/config/tenants'
import { emailIdentityFromProfile } from '@my/app/types/brand-profile'
import { resolveBrandProfile } from './resolve-brand-profile'

/**
 * Server-safe render for the exhorter heads-up email (#124, slice A).
 *
 * Mirrors the `get-email-content.tsx` pattern: the tenant-scoped brand identity
 * is injected as a PROP (never via the client EmailIdentityProvider context), so
 * this renders from an App Router server route. Kept in its own module so the
 * send service can be unit-tested with this render mocked.
 */

export interface RenderExhorterHeadsUpInput {
  firstName: string
  hostEcclesiaName: string
  dateDisplay: string
  timeDisplay: string
  visiting: boolean
  attendOptions: ExhorterHeadsUpAttendOption[]
  emailPreferencesUrl: string
  tenant?: TenantConfig
}

export async function renderExhorterHeadsUp(
  input: RenderExhorterHeadsUpInput
): Promise<{ html: string; text: string }> {
  const tenant = input.tenant ?? resolveTenantFromEnv()
  const emailIdentity = {
    ...emailIdentityFromProfile(await resolveBrandProfile({ tenant })),
    homeUrl: `https://${tenant.senderDomain}`,
    homeLabel: tenant.publicName,
  }

  const element = (
    <ExhorterHeadsUp
      firstName={input.firstName}
      hostEcclesiaName={input.hostEcclesiaName}
      dateDisplay={input.dateDisplay}
      timeDisplay={input.timeDisplay}
      visiting={input.visiting}
      attendOptions={input.attendOptions}
      emailPreferencesUrl={input.emailPreferencesUrl}
      identity={emailIdentity}
    />
  )

  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ])
  return { html, text }
}
