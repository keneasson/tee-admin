// Region constants for multi-tenant ecclesia grouping
// Used by regional admin permission checks and ecclesia directory filtering
// Designed to be flexible — regions can be split further as the community grows

export const REGIONS = {
  // Canada
  CANADA_EAST: 'canada_east',
  CANADA_WEST: 'canada_west',

  // United States
  US_NORTHEAST: 'us_northeast',
  US_SOUTHEAST: 'us_southeast',
  US_MIDWEST_WEST: 'us_midwest_west',

  // Americas (non-US/CA)
  CARIBBEAN: 'caribbean',
  CENTRAL_AMERICA: 'central_america',
  SOUTH_AMERICA: 'south_america',

  // Europe
  UK: 'uk',
  EU: 'eu',
  REST_OF_EUROPE: 'rest_of_europe',

  // Middle East & Africa
  MIDDLE_EAST: 'middle_east',
  AFRICA: 'africa',

  // Asia
  SOUTH_ASIA: 'south_asia',
  EAST_ASIA: 'east_asia',
  SOUTHEAST_ASIA_PACIFIC: 'southeast_asia_pacific',

  // Oceania
  AUSTRALIA_NZ: 'australia_nz',
} as const

export type Region = typeof REGIONS[keyof typeof REGIONS]

export const REGION_LABELS: Record<Region, string> = {
  [REGIONS.CANADA_EAST]: 'Canada East',
  [REGIONS.CANADA_WEST]: 'Canada West',
  [REGIONS.US_NORTHEAST]: 'US Northeast',
  [REGIONS.US_SOUTHEAST]: 'US Southeast',
  [REGIONS.US_MIDWEST_WEST]: 'US Midwest & West',
  [REGIONS.CARIBBEAN]: 'Caribbean',
  [REGIONS.CENTRAL_AMERICA]: 'Central America',
  [REGIONS.SOUTH_AMERICA]: 'South America',
  [REGIONS.UK]: 'United Kingdom',
  [REGIONS.EU]: 'EU',
  [REGIONS.REST_OF_EUROPE]: 'Rest of Europe',
  [REGIONS.MIDDLE_EAST]: 'Middle East',
  [REGIONS.AFRICA]: 'Africa',
  [REGIONS.SOUTH_ASIA]: 'South Asia',
  [REGIONS.EAST_ASIA]: 'East Asia',
  [REGIONS.SOUTHEAST_ASIA_PACIFIC]: 'Southeast Asia & Pacific',
  [REGIONS.AUSTRALIA_NZ]: 'Australia & New Zealand',
}

// Map Canadian provinces to regions
export const PROVINCE_TO_REGION: Record<string, Region> = {
  ON: REGIONS.CANADA_EAST,
  QC: REGIONS.CANADA_EAST,
  NB: REGIONS.CANADA_EAST,
  NS: REGIONS.CANADA_EAST,
  PE: REGIONS.CANADA_EAST,
  NL: REGIONS.CANADA_EAST,
  MB: REGIONS.CANADA_WEST,
  SK: REGIONS.CANADA_WEST,
  AB: REGIONS.CANADA_WEST,
  BC: REGIONS.CANADA_WEST,
  NT: REGIONS.CANADA_WEST,
  NU: REGIONS.CANADA_WEST,
  YT: REGIONS.CANADA_WEST,
}

// Map countries to default regions (ecclesias can override with explicit region field)
export const COUNTRY_TO_REGION: Record<string, Region> = {
  CA: REGIONS.CANADA_EAST,
  US: REGIONS.US_NORTHEAST,
  GB: REGIONS.UK,
  AU: REGIONS.AUSTRALIA_NZ,
  NZ: REGIONS.AUSTRALIA_NZ,
  IL: REGIONS.MIDDLE_EAST,
  IN: REGIONS.SOUTH_ASIA,
  LK: REGIONS.SOUTH_ASIA,
  PH: REGIONS.SOUTHEAST_ASIA_PACIFIC,
  MY: REGIONS.SOUTHEAST_ASIA_PACIFIC,
  JP: REGIONS.EAST_ASIA,
  KR: REGIONS.EAST_ASIA,
  CN: REGIONS.EAST_ASIA,
  ZA: REGIONS.AFRICA,
  KE: REGIONS.AFRICA,
  NG: REGIONS.AFRICA,
  GH: REGIONS.AFRICA,
  MW: REGIONS.AFRICA,
  MZ: REGIONS.AFRICA,
  TZ: REGIONS.AFRICA,
  JM: REGIONS.CARIBBEAN,
  TT: REGIONS.CARIBBEAN,
  BB: REGIONS.CARIBBEAN,
  GY: REGIONS.CARIBBEAN,
  MX: REGIONS.CENTRAL_AMERICA,
  GT: REGIONS.CENTRAL_AMERICA,
  SV: REGIONS.CENTRAL_AMERICA,
  HN: REGIONS.CENTRAL_AMERICA,
  PA: REGIONS.CENTRAL_AMERICA,
  CR: REGIONS.CENTRAL_AMERICA,
  AR: REGIONS.SOUTH_AMERICA,
  BR: REGIONS.SOUTH_AMERICA,
  CL: REGIONS.SOUTH_AMERICA,
  CO: REGIONS.SOUTH_AMERICA,
  PE: REGIONS.SOUTH_AMERICA,
  DE: REGIONS.EU,
  FR: REGIONS.EU,
  NL: REGIONS.EU,
  BE: REGIONS.EU,
  IT: REGIONS.EU,
  ES: REGIONS.EU,
  PT: REGIONS.EU,
  AT: REGIONS.EU,
  DK: REGIONS.EU,
  SE: REGIONS.EU,
  FI: REGIONS.EU,
  IE: REGIONS.EU,
  RO: REGIONS.REST_OF_EUROPE,
  UA: REGIONS.REST_OF_EUROPE,
  RU: REGIONS.REST_OF_EUROPE,
  RS: REGIONS.REST_OF_EUROPE,
}

/**
 * Determine the default region for an ecclesia based on country and province.
 * Ecclesias can override this with an explicit `region` field.
 */
export function getDefaultRegion(country: string, province?: string): Region {
  if (country === 'CA' && province && PROVINCE_TO_REGION[province]) {
    return PROVINCE_TO_REGION[province]
  }
  return COUNTRY_TO_REGION[country] || REGIONS.CANADA_EAST
}

/**
 * Returns all regions as { id, label } pairs for UI selection components.
 * Sorted alphabetically by label for a predictable display order.
 */
export function getRegionOptions(): Array<{ id: Region; label: string }> {
  return (Object.values(REGIONS) as Region[])
    .map((id) => ({ id, label: REGION_LABELS[id] }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * Returns true if the provided string is a valid, known region identifier.
 */
export function isValidRegion(value: string): value is Region {
  return (Object.values(REGIONS) as string[]).includes(value)
}
