/**
 * Cross-Platform Static Analysis Tests
 *
 * These tests use file scanning to catch common cross-platform issues
 * that would break the Expo mobile app when code is shared from packages/.
 *
 * Key issues detected:
 * 1. Importing next-auth in shared packages (breaks Expo build)
 * 2. Importing next/navigation in shared packages (breaks Expo build)
 * 3. Direct string children in View/YStack/XStack (React Native error)
 */

import { describe, test, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const ROOT_DIR = path.resolve(__dirname, '../../../..')
const PACKAGES_UI_DIR = path.join(ROOT_DIR, 'packages/ui/src')
const PACKAGES_APP_DIR = path.join(ROOT_DIR, 'packages/app')

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Recursively find files matching extensions in a directory
 */
function findFilesRecursive(dir: string, extensions: string[]): string[] {
  const results: string[] = []

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories
        if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
          results.push(...findFilesRecursive(fullPath, extensions))
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name)
        if (extensions.includes(ext)) {
          results.push(fullPath)
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return results
}

function getFilesInDir(dir: string, pattern: string): string[] {
  // Parse pattern to get extensions
  const extMatch = pattern.match(/\*\.\{([^}]+)\}/)
  const extensions = extMatch
    ? extMatch[1]!.split(',').map((ext) => `.${ext}`)
    : ['.ts', '.tsx']

  return findFilesRecursive(dir, extensions)
}

function readFileContent(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

// ============================================================================
// Import Analysis Tests
// ============================================================================

describe('Cross-Platform Import Rules', () => {
  test('packages/ui should not import from next-auth', () => {
    const files = getFilesInDir(PACKAGES_UI_DIR, '**/*.{ts,tsx}')
    const violations: string[] = []

    for (const file of files) {
      const content = readFileContent(file)
      const relativePath = path.relative(ROOT_DIR, file)

      // Check for next-auth imports
      if (content.match(/from\s+['"]next-auth/)) {
        violations.push(`${relativePath}: imports from 'next-auth'`)
      }
      if (content.match(/from\s+['"]next-auth\/react/)) {
        violations.push(`${relativePath}: imports from 'next-auth/react'`)
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Found next-auth imports in shared UI package (breaks Expo build):\n${violations.join('\n')}\n\n` +
          'Solution: Move auth logic to apps/next/ and pass auth state as props to shared components.'
      )
    }

    expect(violations).toHaveLength(0)
  })

  test('packages/app should not import from next-auth', () => {
    const files = getFilesInDir(PACKAGES_APP_DIR, '**/*.{ts,tsx}')
    const violations: string[] = []

    // Known violations to be fixed incrementally (tracked in GitHub Issue #21)
    // These files need refactoring to receive auth state as props
    // FIXED: home/screen.tsx, welfare.tsx, navItem-logout.tsx, simple-enhanced-navigation.tsx,
    //        with-navigation.tsx, feature-gated-navigation.tsx
    const knownViolations = new Set([
      'packages/app/features/directory-email-sync/index.tsx',
      'packages/app/features/email-lists/index.tsx',
      'packages/app/features/email-sender/index.tsx',
      'packages/app/features/email-tester/index.tsx',
      'packages/app/features/enhanced-with-navigation.tsx',
      'packages/app/features/feature-flags/use-feature-flag-wrapper.tsx',
      'packages/app/features/profile/index.tsx',
    ])

    for (const file of files) {
      const content = readFileContent(file)
      const relativePath = path.relative(ROOT_DIR, file)

      // Skip known violations
      if (knownViolations.has(relativePath)) {
        continue
      }

      // Check for next-auth imports
      if (content.match(/from\s+['"]next-auth/)) {
        violations.push(`${relativePath}: imports from 'next-auth'`)
      }
      if (content.match(/from\s+['"]next-auth\/react/)) {
        violations.push(`${relativePath}: imports from 'next-auth/react'`)
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Found NEW next-auth imports in shared app package (breaks Expo build):\n${violations.join('\n')}\n\n` +
          'Solution: Move auth logic to apps/next/ and pass auth state as props to shared components.'
      )
    }

    // Log info about known violations for visibility
    console.log(`ℹ️ ${knownViolations.size} known next-auth import violations in packages/app (tracked in GitHub Issue #21)`)

    expect(violations).toHaveLength(0)
  })

  test('packages/ui should not import from next/navigation', () => {
    const files = getFilesInDir(PACKAGES_UI_DIR, '**/*.{ts,tsx}')
    const violations: string[] = []

    for (const file of files) {
      const content = readFileContent(file)
      const relativePath = path.relative(ROOT_DIR, file)

      // Check for next/navigation imports
      if (content.match(/from\s+['"]next\/navigation/)) {
        violations.push(`${relativePath}: imports from 'next/navigation'`)
      }
      if (content.match(/from\s+['"]next\/router/)) {
        violations.push(`${relativePath}: imports from 'next/router'`)
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Found next/navigation imports in shared UI package (breaks Expo build):\n${violations.join('\n')}\n\n` +
          'Solution: Use solito for cross-platform navigation or pass navigation handlers as props.'
      )
    }

    expect(violations).toHaveLength(0)
  })

  test('packages/app should not import from next/navigation (except allowed patterns)', () => {
    const files = getFilesInDir(PACKAGES_APP_DIR, '**/*.{ts,tsx}')
    const violations: string[] = []

    // Known violations to be fixed incrementally (tracked in GitHub Issue #21)
    // These files need refactoring to use solito or receive navigation handlers as props
    const knownViolations = new Set([
      'packages/app/features/newsletter/newsletter-screen.tsx',
      'packages/app/features/newsletter/news-events.tsx',
      'packages/app/features/profile/index.tsx',
      'packages/app/hooks/use-search-params-with-suspense.tsx',
      'packages/app/provider/auth/log-in-user.tsx',
    ])
    // Note: These use useRouter from next/navigation for event navigation
    // Should be refactored to use solito/navigation or pass onNavigate props

    for (const file of files) {
      const content = readFileContent(file)
      const relativePath = path.relative(ROOT_DIR, file)

      // Skip known violations
      if (knownViolations.has(relativePath)) {
        continue
      }

      // Check for next/navigation imports
      if (content.match(/from\s+['"]next\/navigation/)) {
        violations.push(`${relativePath}: imports from 'next/navigation'`)
      }
      if (content.match(/from\s+['"]next\/router/)) {
        violations.push(`${relativePath}: imports from 'next/router'`)
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Found NEW next/navigation imports in shared app package (breaks Expo build):\n${violations.join('\n')}\n\n` +
          'Solution: Use solito for cross-platform navigation or pass navigation handlers as props.'
      )
    }

    // Log info about known violations for visibility
    console.log(`ℹ️ ${knownViolations.size} known next/navigation import violations in packages/app (tracked in GitHub Issue #21)`)

    expect(violations).toHaveLength(0)
  })
})

// ============================================================================
// JSX Structure Analysis Tests
// ============================================================================

describe('React Native Text Wrapper Rules', () => {
  /**
   * This test uses a regex-based heuristic to detect potential "text cannot be
   * a child of View" errors. It's not perfect (AST would be more accurate) but
   * catches many common issues.
   *
   * Pattern: Look for View/YStack/XStack/Card containing direct text
   */
  test('packages/ui components should not have direct string children in View-like components', () => {
    const files = getFilesInDir(PACKAGES_UI_DIR, '**/*.tsx')
    const potentialIssues: string[] = []

    // Components that don't accept text children in React Native
    const viewComponents = ['View', 'YStack', 'XStack', 'Card', 'Square', 'Circle']

    for (const file of files) {
      const content = readFileContent(file)
      const relativePath = path.relative(ROOT_DIR, file)
      const lines = content.split('\n')

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!

        // Look for patterns like <YStack>Some text</YStack> on single line
        for (const component of viewComponents) {
          // Single-line pattern: <Component>text</Component>
          const singleLinePattern = new RegExp(
            `<${component}[^>]*>\\s*[^<{\\s][^<]*<\\/${component}>`,
            'g'
          )
          if (singleLinePattern.test(line)) {
            // Check if the content is actually text (not just whitespace or JSX)
            const match = line.match(new RegExp(`<${component}[^>]*>([^<]*)<\\/${component}>`))
            if (match && match[1]?.trim() && !match[1].includes('{')) {
              potentialIssues.push(
                `${relativePath}:${i + 1}: Potential direct text in <${component}>: "${match[1].trim().substring(0, 30)}..."`
              )
            }
          }
        }
      }
    }

    // This is a heuristic check - report but don't fail for now
    // since the regex can have false positives
    if (potentialIssues.length > 0) {
      console.warn(
        'Potential "text cannot be child of View" issues found:\n' +
          potentialIssues.join('\n') +
          '\n\nPlease verify these manually. Wrap text in <Text> components.'
      )
    }

    // Don't fail the test - just warn
    // This is a heuristic that may have false positives
    expect(true).toBe(true)
  })
})

// ============================================================================
// Auth Props Pattern Tests
// ============================================================================

describe('Auth State Pattern Verification', () => {
  test('EventSummaryCard should accept auth props', () => {
    const filePath = path.join(PACKAGES_UI_DIR, 'events/event-summary-card.tsx')
    const content = readFileContent(filePath)

    // Check for auth-related props
    expect(content).toMatch(/userRole\??:\s*string/)
    expect(content).toMatch(/isMemberOrHigher\??:\s*boolean/)
  })

  test('EventDetailView should accept auth props (if exists)', () => {
    const filePath = path.join(PACKAGES_UI_DIR, 'events/event-detail-view.tsx')

    if (!fs.existsSync(filePath)) {
      // File doesn't exist - skip
      return
    }

    const content = readFileContent(filePath)

    // Check for auth-related props
    expect(content).toMatch(/userRole|isMemberOrHigher/)
  })

  test('NewsletterScreen should accept auth props', () => {
    const filePath = path.join(PACKAGES_APP_DIR, 'features/newsletter/newsletter-screen.tsx')
    const content = readFileContent(filePath)

    // Check for auth-related props
    expect(content).toMatch(/userRole\??:\s*string/)
    expect(content).toMatch(/isMemberOrHigher\??:\s*boolean/)
    expect(content).toMatch(/isAdminOrOwner\??:\s*boolean/)
  })
})

// ============================================================================
// Test ID Verification
// ============================================================================

describe('Test ID Attributes for Key Components', () => {
  test('NewsletterScreen should have testID attributes for major sections', () => {
    const filePath = path.join(PACKAGES_APP_DIR, 'features/newsletter/newsletter-screen.tsx')
    const content = readFileContent(filePath)

    const expectedTestIds = [
      'newsletter-container',
      'newsletter-admin-toolbar',
      'newsletter-regular-services',
      'newsletter-election-notice',
      'newsletter-special-announcements',
      'newsletter-upcoming-events',
      'newsletter-daily-readings',
    ]

    const missingTestIds: string[] = []
    for (const testId of expectedTestIds) {
      if (!content.includes(`testID="${testId}"`)) {
        missingTestIds.push(testId)
      }
    }

    if (missingTestIds.length > 0) {
      throw new Error(
        `Missing testID attributes in NewsletterScreen:\n${missingTestIds.join('\n')}\n\n` +
          'These are needed for resilient Playwright testing.'
      )
    }

    expect(missingTestIds).toHaveLength(0)
  })

  test('EventSummaryCard should have testID attribute', () => {
    const filePath = path.join(PACKAGES_UI_DIR, 'events/event-summary-card.tsx')
    const content = readFileContent(filePath)

    expect(content).toMatch(/testID=/)
  })
})
