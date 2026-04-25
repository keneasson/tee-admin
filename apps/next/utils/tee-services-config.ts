export interface TeeServicesConfig {
  type: string
  project_id: string
  private_key_id: string
  private_key: string
  client_email: string
  client_id: string
  auth_uri: string
  token_uri: string
  auth_provider_x509_cert_url: string
  client_x509_cert_url: string
  universe_domain?: string
  sheet_ids: Record<string, { name: string; startTime: string; key: string }>
}

let cached: TeeServicesConfig | null = null

// Loads the Google service account + sheet config from the
// GOOGLE_SERVICE_ACCOUNT_KEY env var, which holds the full JSON
// (credentials + sheet_ids) as a single string. Local dev: set this
// in apps/next/.env.local — paste the JSON on one line.
export function getTeeServicesConfig(): TeeServicesConfig {
  if (cached) return cached

  const envValue = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!envValue) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_KEY env var is not set. Add it to apps/next/.env.local for local dev (full service account JSON as a single-line string).'
    )
  }
  try {
    cached = JSON.parse(envValue) as TeeServicesConfig
    return cached
  } catch (e) {
    throw new Error(
      `GOOGLE_SERVICE_ACCOUNT_KEY env var is not valid JSON: ${(e as Error).message}`
    )
  }
}
