// Brand identity per deployment. Driven by NEXT_PUBLIC_BRAND so the
// value is baked into the client bundle at build time and picked up
// without any server round-trip in client components.
//
// echadhub is the universal hub for multiple ecclesias; tee-admin is
// branded specifically for Toronto East Ecclesia. See
// project_multi_domain_tenant_resolution.md for the broader plan.

export type Brand = 'tee' | 'echadhub'

export interface BrandConfig {
  id: Brand
  /** Sidebar brand mark — line 1. */
  primary: string
  /** Sidebar brand mark — line 2. */
  secondary?: string
  /** Page header: large script mark shown before the title (Hebrew "One" on echadhub). */
  headerMark?: string
  /**
   * Page header: default title shown until a user signs in. Once a user signs
   * in, the header shows their home ecclesia instead.
   */
  headerTitle: string
  /** Page header: show the open-bible image before the title (tee branding). */
  headerImage?: boolean
  /** Page header: verse shown when no user is signed in (echadhub). */
  verse?: { text: string; reference: string }
}

const BRANDS: Record<Brand, BrandConfig> = {
  tee: {
    id: 'tee',
    primary: 'TEE Portal',
    headerTitle: 'Toronto East Ecclesia',
    headerImage: true,
  },
  echadhub: {
    id: 'echadhub',
    primary: 'אֶחָד',
    secondary: 'Echad Hub',
    headerMark: 'אֶחָד',
    headerTitle: 'Echad Hub',
    verse: {
      text: 'Then those who feared the LORD spoke with one another. The LORD paid attention and heard them, and a book of remembrance was written before him of those who feared the LORD and esteemed his name.',
      reference: 'Malachi 3:16',
    },
  },
}

export function getBrand(): BrandConfig {
  const id = process.env.NEXT_PUBLIC_BRAND as Brand | undefined
  return (id && BRANDS[id]) || BRANDS.tee
}
