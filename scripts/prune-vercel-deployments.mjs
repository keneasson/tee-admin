#!/usr/bin/env node
/**
 * Prune old Vercel deployments so "Deployment Storage" stays under the free-tier
 * cap. Vercel never auto-deletes deployments; without this they accumulate
 * indefinitely (we hit 100% of the 10 GB free tier at 184 retained builds).
 *
 * For each project it KEEPS:
 *   - the current production deployment (whatever the live domain points at), and
 *   - the newest KEEP deployments (rollback points),
 * and deletes everything else.
 *
 * Safe by construction: the live production deployment is always protected, and
 * deleted builds are just stale preview URLs — anything can be re-deployed from git.
 *
 * Env:
 *   VERCEL_TOKEN   (required) — a Vercel access token
 *   VERCEL_TEAM_ID (required) — the team id (team_...)
 *   PROJECTS       default "tee-admin,echadhub"
 *   KEEP           default "5"   (newest N kept per project, in addition to prod)
 *   DRY_RUN        "true" to log what would be deleted without deleting
 *
 * Run locally:  VERCEL_TOKEN=… VERCEL_TEAM_ID=team_… node scripts/prune-vercel-deployments.mjs
 */

const TOKEN = process.env.VERCEL_TOKEN
const TEAM = process.env.VERCEL_TEAM_ID
const PROJECTS = (process.env.PROJECTS || 'tee-admin,echadhub').split(',').map((s) => s.trim()).filter(Boolean)
const KEEP = Math.max(0, parseInt(process.env.KEEP || '5', 10) || 0)
const DRY_RUN = String(process.env.DRY_RUN || '').toLowerCase() === 'true'

if (!TOKEN || !TEAM) {
  console.error('ERROR: VERCEL_TOKEN and VERCEL_TEAM_ID are required. Nothing deleted.')
  process.exit(1)
}

const api = async (path, method = 'GET') => {
  const url = `https://api.vercel.com${path}${path.includes('?') ? '&' : '?'}teamId=${TEAM}`
  const res = await fetch(url, { method, headers: { Authorization: `Bearer ${TOKEN}` } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${method} ${path} -> ${res.status} ${body.slice(0, 200)}`)
  }
  return method === 'GET' ? res.json() : {}
}

const listAllDeployments = async (project) => {
  const all = []
  let until
  for (let i = 0; i < 100; i++) {
    const q = `/v6/deployments?app=${encodeURIComponent(project)}&limit=100${until ? `&until=${until}` : ''}`
    const d = await api(q)
    const batch = d.deployments || []
    all.push(...batch)
    until = d.pagination && d.pagination.next
    if (!until || batch.length === 0) break
  }
  return all
}

let grandDeleted = 0
let grandFailed = 0

for (const project of PROJECTS) {
  try {
    const info = await api(`/v9/projects/${encodeURIComponent(project)}`)
    const prodId = info?.targets?.production?.id || null

    const deps = await listAllDeployments(project)
    deps.sort((a, b) => (b.created || 0) - (a.created || 0))

    const keep = new Set()
    if (prodId) keep.add(prodId)
    for (const d of deps.slice(0, KEEP)) keep.add(d.uid || d.id)

    const toDelete = deps.filter((d) => !keep.has(d.uid || d.id))
    console.log(
      `\n[${project}] total=${deps.length} keep=${keep.size} delete=${toDelete.length}` +
        (DRY_RUN ? ' (DRY_RUN)' : '')
    )

    let ok = 0
    let fail = 0
    for (const d of toDelete) {
      const uid = d.uid || d.id
      if (DRY_RUN) {
        ok++
        continue
      }
      try {
        await api(`/v13/deployments/${uid}`, 'DELETE')
        ok++
      } catch (e) {
        fail++
        console.error(`  delete failed ${uid}: ${e.message}`)
      }
    }
    grandDeleted += ok
    grandFailed += fail
    console.log(`[${project}] ${DRY_RUN ? 'would delete' : 'deleted'} ${ok}/${toDelete.length} (failures ${fail}); kept ${keep.size} (prod=${prodId || 'n/a'})`)
  } catch (e) {
    grandFailed++
    console.error(`[${project}] ERROR: ${e.message}`)
  }
}

console.log(`\nTOTAL ${DRY_RUN ? 'would delete' : 'deleted'}=${grandDeleted} failures=${grandFailed}`)
// Fail the job only if a project errored out entirely; per-deployment delete
// failures are logged but non-fatal so a single flaky delete doesn't block cleanup.
process.exit(grandFailed > 0 && grandDeleted === 0 ? 1 : 0)
