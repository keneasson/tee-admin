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
  primary: string
  secondary?: string
}

const BRANDS: Record<Brand, BrandConfig> = {
  tee: {
    id: 'tee',
    primary: 'TEE Portal',
  },
  echadhub: {
    id: 'echadhub',
    primary: 'אֶחָד',
    secondary: 'Echad Hub',
  },
}

export function getBrand(): BrandConfig {
  const id = process.env.NEXT_PUBLIC_BRAND as Brand | undefined
  return (id && BRANDS[id]) || BRANDS.tee
}
