/**
 * BrandProfile — a tenant's (ecclesia/organization) identity, used to brand the
 * shared email/newsletter templates "for free" by param. Resolved from the
 * content's owning ecclesia/org (EcclesiaData / OrganizationRecord), falling
 * back to the deployment tenant and finally Toronto East defaults.
 *
 * Multi-tenant split, Phase 1 (see /Users/keneasson/.claude/plans). The
 * look-and-feel fields (`logoUrl`, `templateKey`) are reserved for a later
 * S3-backed brand bundle and are not populated/consumed yet.
 */
export interface BrandProfile {
  /** Canonical ecclesia/org name (matches EcclesiaData.name). */
  ecclesiaName: string
  /** Short display name — email From-name / headings. */
  displayName: string
  /** Public-facing name — footers, newsletter title. */
  publicName: string
  /** Postal address lines for the email footer (CAN-SPAM). Omit when unknown. */
  addressLines?: string[]
  /** Public website URL. */
  website?: string
  /** Reserved for the S3 brand bundle. */
  logoUrl?: string
  /** Reserved: opt into a non-default template layout. */
  templateKey?: string
}

/**
 * Identity slice consumed by the email Footer. Kept as a plain shape so the
 * email-builder templates don't depend on the full resolver.
 */
export interface EmailIdentity {
  name: string
  addressLines?: string[]
}

export function emailIdentityFromProfile(profile: BrandProfile): EmailIdentity {
  return { name: profile.publicName, addressLines: profile.addressLines }
}
