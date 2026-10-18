import { execSync } from 'node:child_process'

/**
 * Shared setup for the mailing-list operator scripts (backfill, parity, cutover).
 * Same conventions as scripts/rebuild-people-projections.ts:
 *  - credentials from AWS_* env vars, else the default CLI profile;
 *  - refuses any AWS account other than the TEE production account;
 *  - backups go to the PRIVATE `tee-admin-backups` bucket only (never the repo).
 */

export const EXPECTED_ACCOUNT = '911911532459'
export const BACKUP_BUCKET = 'tee-admin-backups'

export function loadCredentials(): void {
  if (!process.env.AWS_ACCESS_KEY_ID) {
    const creds = JSON.parse(
      execSync('aws configure export-credentials --format process', { encoding: 'utf8' })
    )
    process.env.AWS_ACCESS_KEY_ID = creds.AccessKeyId
    process.env.AWS_SECRET_ACCESS_KEY = creds.SecretAccessKey
    if (creds.SessionToken) process.env.AWS_SESSION_TOKEN = creds.SessionToken
  }
  const account = execSync('aws sts get-caller-identity --query Account --output text', {
    encoding: 'utf8',
    env: process.env,
  }).trim()
  if (account !== EXPECTED_ACCOUNT) {
    throw new Error(`Refusing to run: AWS account is ${account}, expected ${EXPECTED_ACCOUNT}`)
  }
}

/**
 * Upload one JSON document to s3://tee-admin-backups/<key> (SSE) and confirm it
 * landed with the expected size. Throws on any failure, so a caller that writes
 * only after this returns never writes without a backup.
 */
export function backupJsonToS3(key: string, body: unknown): string {
  const json = JSON.stringify(body)
  const dest = `s3://${BACKUP_BUCKET}/${key}`
  execSync(`aws s3 cp - ${dest} --sse AES256 --content-type application/json`, {
    input: json,
    env: process.env,
    stdio: ['pipe', 'inherit', 'inherit'],
  })
  const size = Number(
    execSync(
      `aws s3api head-object --bucket ${BACKUP_BUCKET} --key ${key} --query ContentLength --output text`,
      { encoding: 'utf8', env: process.env }
    ).trim()
  )
  if (size !== Buffer.byteLength(json)) {
    throw new Error(`Backup verification failed for ${dest}: ${size} bytes stored, ${Buffer.byteLength(json)} expected`)
  }
  return dest
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
