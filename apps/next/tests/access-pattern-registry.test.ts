/**
 * Enforcement for `packages/app/provider/dynamodb/access-patterns.ts`.
 *
 * Request paths never Scan (a Scan reads 1 MB and stops; on a 2.7 MB table it
 * silently misses rows), and index names live only in the registry. A file on
 * the allowlist must say why; the only accepted reasons are a legacy store R8
 * deletes, or a named maintenance job that genuinely needs a full scan and
 * paginates.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOT = join(__dirname, '..', '..', '..')

const EXEMPT = new Set([
  'packages/app/provider/dynamodb/access-patterns.ts',
  'packages/app/provider/dynamodb/repositories/base-repository.ts',
])

/** file → reason. Reasons must start with "R8 deletes:" or "maintenance:". */
const ALLOWLIST: Record<string, string> = {
  'packages/app/provider/dynamodb/repositories/user-repository.ts':
    'R8 deletes: legacy USER# userRepository (getEmailByToken).',
  'packages/app/provider/dynamodb/repositories/admin-repository.ts':
    'R8 deletes: dead admin-repository over DIRECTORY#MEMBERS.',
  'apps/next/utils/dynamodb/credentials-users.ts':
    'R8 deletes: legacy NextAuth credentials USER# store (findAnyUserByEmail, USER# gsi1 lookups).',
  'apps/next/utils/dynamodb/get-user.ts':
    'R8 deletes: legacy NextAuth USER# lookup.',
  'apps/next/utils/mailing-lists/backfill-mailing-lists.ts':
    'maintenance: owner-run mailing-list backfill script; its pre-write S3 backup pages the whole PERSON#/LIST# set.',
}

const SKIP_DIRS = new Set(['node_modules', 'tests', '__tests__', 'scripts', 'pages-backup', '.next', 'dist', 'build'])

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name)) sourceFiles(full, out)
    } else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) && !/\.bak/.test(name)) {
      out.push(full)
    }
  }
  return out
}

const RULES: Array<{ name: string; re: RegExp }> = [
  { name: 'ScanCommand', re: /\bScanCommand\b/ },
  { name: '.scan(', re: /\.scan\(/ },
  { name: '.scanAll(', re: /\.scanAll\(/ },
  { name: 'string-literal index name', re: /\b[iI]ndexName\s*:\s*['"`]/ },
]

function violations(): Array<{ file: string; line: number; rule: string; text: string }> {
  const found: Array<{ file: string; line: number; rule: string; text: string }> = []
  const files = [...sourceFiles(join(ROOT, 'packages', 'app')), ...sourceFiles(join(ROOT, 'apps', 'next'))]
  for (const full of files) {
    const file = relative(ROOT, full).split('\\').join('/')
    if (EXEMPT.has(file) || ALLOWLIST[file]) continue
    readFileSync(full, 'utf8')
      .split('\n')
      .forEach((text, i) => {
        const code = text.replace(/\/\/.*$/, '')
        if (/^\s*\*/.test(code)) return
        for (const rule of RULES) {
          if (rule.re.test(code)) found.push({ file, line: i + 1, rule: rule.name, text: text.trim() })
        }
      })
  }
  return found
}

describe('access-pattern registry enforcement', () => {
  it('no Scan and no raw index name outside the registry', () => {
    const found = violations()
    expect(found.map((v) => `${v.file}:${v.line} [${v.rule}] ${v.text}`)).toEqual([])
  })

  it('every allowlist entry gives an accepted reason and still exists', () => {
    for (const [file, reason] of Object.entries(ALLOWLIST)) {
      expect(reason, file).toMatch(/^(R8 deletes|maintenance): \S/)
      expect(() => statSync(join(ROOT, file)), file).not.toThrow()
    }
  })

  it('the rules catch what they should', () => {
    const hit = (line: string) => RULES.some((r) => r.re.test(line))
    expect(hit("const r = await this.scan({")).toBe(true)
    expect(hit("await repo.scanAll({ filterExpression })")).toBe(true)
    expect(hit("new ScanCommand({ TableName })")).toBe(true)
    expect(hit("IndexName: 'gsi1',")).toBe(true)
    expect(hit("{ indexName: 'GSI1' }")).toBe(true)
    expect(hit("IndexName: PATTERNS.postById.index,")).toBe(false)
    expect(hit("ScanIndexForward: true,")).toBe(false)
  })
})
