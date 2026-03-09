// Region constants for multi-tenant ecclesia grouping
// Used by regional admin permission checks and ecclesia directory filtering

export const REGIONS = {
  ONTARIO_EAST: 'ontario_east',
  ONTARIO_WEST: 'ontario_west',
  QUEBEC: 'quebec',
  PRAIRIES: 'prairies',
  BRITISH_COLUMBIA: 'british_columbia',
  ATLANTIC: 'atlantic',
  NORTHEAST_US: 'northeast_us',
  SOUTHEAST_US: 'southeast_us',
  MIDWEST_US: 'midwest_us',
  WEST_US: 'west_us',
  UK: 'uk',
  AUSTRALIA: 'australia',
  OTHER: 'other',
} as const

export type Region = typeof REGIONS[keyof typeof REGIONS]

// Map Canadian provinces to regions
export const PROVINCE_TO_REGION: Record<string, Region> = {
  ON: REGIONS.ONTARIO_EAST, // Default; individual ecclesias can override
  QC: REGIONS.QUEBEC,
  BC: REGIONS.BRITISH_COLUMBIA,
  AB: REGIONS.PRAIRIES,
  SK: REGIONS.PRAIRIES,
  MB: REGIONS.PRAIRIES,
  NB: REGIONS.ATLANTIC,
  NS: REGIONS.ATLANTIC,
  PE: REGIONS.ATLANTIC,
  NL: REGIONS.ATLANTIC,
  NT: REGIONS.PRAIRIES,
  NU: REGIONS.PRAIRIES,
  YT: REGIONS.BRITISH_COLUMBIA,
}

// Map countries to default regions (for non-Canadian ecclesias)
export const COUNTRY_TO_REGION: Record<string, Region> = {
  CA: REGIONS.ONTARIO_EAST, // Default; overridden by province mapping
  US: REGIONS.NORTHEAST_US,
  GB: REGIONS.UK,
  AU: REGIONS.AUSTRALIA,
}

export const REGION_LABELS: Record<Region, string> = {
  [REGIONS.ONTARIO_EAST]: 'Ontario East',
  [REGIONS.ONTARIO_WEST]: 'Ontario West',
  [REGIONS.QUEBEC]: 'Quebec',
  [REGIONS.PRAIRIES]: 'Prairies',
  [REGIONS.BRITISH_COLUMBIA]: 'British Columbia',
  [REGIONS.ATLANTIC]: 'Atlantic',
  [REGIONS.NORTHEAST_US]: 'Northeast US',
  [REGIONS.SOUTHEAST_US]: 'Southeast US',
  [REGIONS.MIDWEST_US]: 'Midwest US',
  [REGIONS.WEST_US]: 'West US',
  [REGIONS.UK]: 'United Kingdom',
  [REGIONS.AUSTRALIA]: 'Australia',
  [REGIONS.OTHER]: 'Other',
}

/**
 * Determine the default region for an ecclesia based on country and province.
 * Ecclesias can override this with an explicit `region` field.
 */
export function getDefaultRegion(country: string, province?: string): Region {
  if (country === 'CA' && province && PROVINCE_TO_REGION[province]) {
    return PROVINCE_TO_REGION[province]
  }
  return COUNTRY_TO_REGION[country] || REGIONS.OTHER
}
