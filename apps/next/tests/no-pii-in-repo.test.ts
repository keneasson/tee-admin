/**
 * This repo is public. Personal information (real names, emails, phone
 * numbers, street addresses) must never be committed — see CLAUDE.md,
 * "Personal information never goes in the repo".
 *
 * This guard scans every tracked text file for an address at a personal mail
 * provider and for subscriber/contact exports under apps/next/data/. Names and
 * phone numbers can't be caught reliably by a pattern, so check every diff by
 * eye before pushing.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: __dirname, encoding: 'utf8' }).trim()

const trackedFiles = execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .split('\0')
  .filter(Boolean)

// Files allowed to hold a personal-provider address, each approved by the owner.
const ALLOWLIST: Record<string, string> = {
  'packages/app/provider/auth/get-user-from-legacy.ts': 'owner address is the OWNER_EMAILS fallback (functional default)',
  'apps/next/aws-monitor/health-check.js': 'owner address is the default alert recipient (functional default)',
  'apps/next/aws-monitor/template.yaml': 'owner address is the default alert recipient (functional default)',
  'apps/next/aws-monitor/samconfig.toml': 'owner address is the deployed alert recipient (functional default)',
  'apps/next/aws-monitor/README.md': 'documents the alert recipient default above',
  'apps/next/utils/email/email-send.tsx': "ecclesia's Recording Brother role mailbox used as Reply-To (functional)",
  'apps/next/utils/email/exhorter-heads-up.ts': "ecclesia's Recording Brother role mailbox used as fallback Reply-To (functional)",
  'apps/next/app/api/user/email-change/confirm/route.ts': "ecclesia's Recording Brother role mailbox shown as the support contact (functional)",
  'apps/next/features/account/change-email-flow.tsx': "ecclesia's Recording Brother role mailbox shown as the support contact (functional)",
  'packages/app/email-builder/newsletter.html': 'published newsletter content, pending an owner decision',
}

// Local parts that are obviously placeholders (e.g. member1@gmail.com in a test
// that needs a free-mail domain).
const PLACEHOLDER_LOCAL = /^(owner|member\d*|person\d*|user|test|someone|example)$/i

// The local part must not be preceded by another address character or `*`, so
// a masked address ("m***1@gmail.com") is not read as an address whose local
// part is just the characters after the stars.
const PERSONAL_ADDRESS =
  /(?<![A-Za-z0-9._%+*-])([A-Za-z0-9._%+-]+)@(?:gmail|hotmail|yahoo|outlook|icloud|live|rogers|sympatico|bell|me|aol)\.(?:com|ca|net)\b/gi

const BINARY_EXT =
  /\.(png|jpe?g|gif|webp|ico|icns|bmp|tiff?|pdf|zip|gz|tgz|br|woff2?|ttf|otf|eot|mp[34]|mov|webm|wav|ogg|psd|ai|sketch|jar|wasm|keystore|jks|p12)$/i
const LOCKFILES = new Set(['yarn.lock', 'package-lock.json', 'pnpm-lock.yaml'])

function isScanned(file: string): boolean {
  if (file.startsWith('.yarn/') || file.includes('node_modules/')) return false
  if (LOCKFILES.has(path.basename(file))) return false
  if (BINARY_EXT.test(file)) return false
  return true
}

function readText(file: string): string | null {
  const abs = path.join(repoRoot, file)
  try {
    if (!statSync(abs).isFile()) return null
    const buf = readFileSync(abs)
    if (buf.includes(0)) return null // binary
    return buf.toString('utf8')
  } catch {
    return null // deleted in the working tree, or a submodule
  }
}

describe('no personal information in the repo', () => {
  it('no tracked file holds an address at a personal mail provider (outside the allowlist)', () => {
    const offenders: string[] = []
    for (const file of trackedFiles) {
      if (!isScanned(file) || ALLOWLIST[file]) continue
      const text = readText(file)
      if (text === null) continue
      const lines = text.split('\n')
      lines.forEach((line, i) => {
        for (const m of line.matchAll(PERSONAL_ADDRESS)) {
          if (!PLACEHOLDER_LOCAL.test(m[1]!)) offenders.push(`${file}:${i + 1}`)
        }
      })
    }
    // Only file:line is printed, never the address itself.
    expect(offenders, 'Replace with a placeholder such as member1@example.org').toEqual([])
  })

  it('every allowlisted file still exists (drop stale entries)', () => {
    const tracked = new Set(trackedFiles)
    expect(Object.keys(ALLOWLIST).filter((f) => !tracked.has(f))).toEqual([])
  })

  it('no subscriber or contact export is committed under apps/next/data/', () => {
    const exports = trackedFiles.filter(
      (f) =>
        f.startsWith('apps/next/data/') &&
        (/subscriber|audience_export/i.test(path.basename(f)) || path.basename(f) === 'bkup.json')
    )
    expect(exports).toEqual([])
  })
})
