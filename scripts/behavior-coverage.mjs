#!/usr/bin/env node
/**
 * Behaviour-spec coverage (ADR-0006). Lists every scenario ID in
 * docs/behavior/*.md and reports which ones no test file cites by its full ID
 * (e.g. `CONTACT-EDIT-05`). Report-only: always exits 0 until the specs settle.
 *
 *   node scripts/behavior-coverage.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const specDir = join(root, 'docs/behavior')
const testRoots = ['apps/next/tests', 'packages'].map((p) => join(root, p))

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, out)
    else if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(name)) out.push(p)
  }
  return out
}

const tests = testRoots.flatMap((d) => { try { return walk(d) } catch { return [] } })
const testText = tests.map((f) => readFileSync(f, 'utf8')).join('\n')

let total = 0
let cited = 0
for (const file of readdirSync(specDir).filter((f) => f.endsWith('.md') && f !== 'README.md')) {
  const md = readFileSync(join(specDir, file), 'utf8')
  // Prefix comes from the "— `PREFIX`" section headings, e.g. "— `CONTACT-SEE`".
  const rows = [...md.matchAll(/^\| ([A-Z]+-\d{2}) \|/gm)].map((m) => m[1])
  const sections = [...md.matchAll(/`([A-Z]+)-([A-Z]+)`/g)].map((m) => [m[2], m[1]])
  const prefixFor = Object.fromEntries(sections)
  const missing = []
  for (const short of rows) {
    const [section] = short.split('-')
    const id = prefixFor[section] ? `${prefixFor[section]}-${short}` : short
    total++
    if (testText.includes(id)) cited++
    else missing.push(id)
  }
  console.log(`\n${file}: ${rows.length - missing.length}/${rows.length} scenarios cited by a test`)
  for (const id of missing) console.log(`  · ${id}`)
}
console.log(`\nTotal: ${cited}/${total} scenarios cited by ID. (Report-only — ADR-0006.)`)
