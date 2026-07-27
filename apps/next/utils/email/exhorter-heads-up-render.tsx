import { render } from '@react-email/render'
import ExhorterHeadsUp, {
  type ExhorterHeadsUpAttendOption,
  type ExhorterHeadsUpLunch,
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
  /** Exhorter's full name for the formal "Dear Brother {name}" greeting. */
  exhorterName: string
  /** Host ecclesia SHORT name, e.g. "Toronto East". */
  hostEcclesiaName: string
  /** Full street address of the meeting hall. */
  address?: string
  dateDisplay: string
  timeDisplay: string
  attendOptions: ExhorterHeadsUpAttendOption[]
  /** Fellowship lunch style, or undefined for no lunch line. */
  lunchType?: ExhorterHeadsUpLunch
  /** Recording Brother's full name for the signature. */
  signatoryName?: string
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
      exhorterName={input.exhorterName}
      hostEcclesiaName={input.hostEcclesiaName}
      address={input.address}
      dateDisplay={input.dateDisplay}
      timeDisplay={input.timeDisplay}
      attendOptions={input.attendOptions}
      lunchType={input.lunchType}
      signatoryName={input.signatoryName}
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
