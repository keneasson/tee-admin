/**
 * Shared, READ-ONLY setup for the office scripts (R3): credential guard and a
 * one-pass table snapshot (a script may Scan; request paths may not).
 */
import { execSync } from 'node:child_process'

export const EXPECTED_ACCOUNT = '911911532459'
export const TABLE = 'tee-admin'

export type Item = Record<string, any> & { pkey: string; skey: string }

/** AWS_* env vars if set, else the default CLI profile. Refuses any account but prod's. */
export function loadCredentials() {
  if (!process.env.AWS_ACCESS_KEY_ID) {
    const creds = JSON.parse(execSync('aws configure export-credentials --format process', { encoding: 'utf8' }))
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

export interface OfficeSnapshot {
  profiles: Item[]
  ecclesias: Item[]
  ecclesiaIds: string[]
  offices: Item[]
}

/** Call after `loadCredentials()` (config.ts reads the env at import). */
export async function readOfficeSnapshot(): Promise<OfficeSnapshot> {
  const { ScanCommand } = await import('@aws-sdk/lib-dynamodb')
  const { docClient } = await import('../../packages/app/provider/dynamodb/config')
  const { ecclesiaIdOf } = await import('../../packages/app/provider/dynamodb/people-index/keys')
  const all: Item[] = []
  let lastKey: Record<string, any> | undefined
  do {
    const page = await docClient.send(new ScanCommand({ TableName: TABLE, ExclusiveStartKey: lastKey }))
    all.push(...((page.Items || []) as Item[]))
    lastKey = page.LastEvaluatedKey
  } while (lastKey)
  const ecclesias = all.filter((i) => i.type === 'ECCLESIA' && i.pkey.startsWith('ECCLESIA#'))
  return {
    profiles: all.filter((i) => i.pkey.startsWith('PERSON#') && i.skey === 'PROFILE'),
    ecclesias,
    ecclesiaIds: [...new Set(ecclesias.map((e) => ecclesiaIdOf(e)).filter(Boolean))].sort(),
    offices: all.filter((i) => i.pkey.startsWith('ECCLESIA_ID#') && i.skey.startsWith('OFFICE#')),
  }
}

/** PROFILE → the planner's person snapshot. A person is "named" when either name part is set. */
export function toPersonSnapshots(profiles: Item[]) {
  return new Map(
    profiles.map((p) => [
      p.personId as string,
      {
        personId: p.personId as string,
        named: !!((p.firstName || '').trim() || (p.lastName || '').trim()),
        primaryEmail: (p.primaryEmail || '') as string,
      },
    ])
  )
}

/** Addresses → person ids, so reports name ids only (this repo and its logs are public). */
export function addressesToPersonIds(addresses: string[], profiles: Item[]): string[] {
  const set = new Set(addresses)
  return profiles
    .filter((p) => set.has(String(p.primaryEmail || '').trim().toLowerCase()))
    .map((p) => p.personId as string)
    .sort()
}
