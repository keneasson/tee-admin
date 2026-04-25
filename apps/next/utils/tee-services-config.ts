import * as fs from 'fs'
import * as path from 'path'

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

// Loads the Google service account + sheet config. Production reads from
// GOOGLE_SERVICE_ACCOUNT_KEY (full JSON as env var, set in Vercel). Local
// dev falls back to apps/next/tee-services-db47a9e534d3.json on disk so
// devs can keep using the file workflow.
export function getTeeServicesConfig(): TeeServicesConfig {
  if (cached) return cached

  const envValue = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (envValue) {
    try {
      cached = JSON.parse(envValue) as TeeServicesConfig
      return cached
    } catch (e) {
      throw new Error(
        `GOOGLE_SERVICE_ACCOUNT_KEY env var is not valid JSON: ${(e as Error).message}`
      )
    }
  }

  // process.cwd() in Next.js prod is the rootDirectory (apps/next); in dev
  // when running yarn web from monorepo root it's also apps/next via turbo
  const filePath = path.join(process.cwd(), 'tee-services-db47a9e534d3.json')
  if (!fs.existsSync(filePath)) {
    throw new Error(
      'Google service account config not found. Set GOOGLE_SERVICE_ACCOUNT_KEY env var or place tee-services-db47a9e534d3.json in apps/next/.'
    )
  }
  cached = JSON.parse(fs.readFileSync(filePath, 'utf8')) as TeeServicesConfig
  return cached
}
