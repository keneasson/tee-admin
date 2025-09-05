# Development Learnings & Best Practices

## Overview

This document captures key learnings, mistakes, and best practices discovered during TEE Admin development. It serves as a knowledge base for current and future developers working on the project.

---

## 🔥 Critical Learnings

### **Form Component Development (July 2, 2025)**

#### **The Problem**
```typescript
// ❌ WRONG: Assumed mock control would work
const mockControl = {
  formState: { errors: {} },
  register: () => ({}),
  // ... incomplete mock
} as any

<FormInput control={mockControl} name="example" />
// Result: "Cannot read properties of undefined (reading 'array')"
```

#### **Root Cause**
- React Hook Form `Control` object has complex internal structure with `_subjects`, `_names`, etc.
- TypeScript `as any` bypassed validation that would have caught this
- Form components require real React Hook Form context, not mocked objects

#### **Solution**
```typescript
// ✅ CORRECT: Document instead of mock complex components
<ComponentShowcase
  title="Form Components Overview"
  description="Requires React Hook Form setup with proper control, name, and validation rules"
  children={/* Documentation UI */}
  code={`// Real usage example
import { useForm } from 'react-hook-form'

function MyForm() {
  const { control, handleSubmit } = useForm()
  return (
    <FormInput 
      control={control} 
      name="email" 
      rules={{ required: 'Email required' }} 
    />
  )
}`}
/>
```

#### **Prevention Strategy**
1. **Never use `as any` for complex objects** - Create proper types or interfaces
2. **Test with real dependencies** - Don't mock React Hook Form, Redux, etc.
3. **Documentation over broken examples** - Better to explain than demo incorrectly
4. **Run TypeScript frequently** - `yarn typecheck` after every major change

---

### **TypeScript Development Workflow (July 2, 2025)**

#### **The Problem**
- Developed brand system components without running TypeScript validation
- Multiple type errors accumulated (wrong font tokens, missing props, invalid interfaces)
- Tests didn't catch issues because they run in separate TS environment

#### **What Went Wrong**
```bash
# ❌ What I did: Developed without validation
# 1. Created components
# 2. Added to showcase
# 3. Created tests
# 4. Finally ran typecheck -> MANY ERRORS

# ❌ Missing validation steps:
yarn workspace next-app typecheck  # Never ran this
yarn workspace next-app build      # Never tested actual build
```

#### **Correct Workflow**
```bash
# ✅ Proper development cycle:
# 1. Plan component interface
yarn workspace next-app typecheck  # Start clean

# 2. Implement component
# 3. Validate immediately
yarn workspace next-app typecheck  # Check after each component

# 4. Add to showcase/tests
# 5. Final validation
yarn workspace next-app typecheck
yarn workspace next-app build      # Test actual build
```

#### **Automation Solution**
```json
// package.json
{
  "scripts": {
    "dev:safe": "yarn typecheck && yarn web",
    "validate": "yarn typecheck && yarn lint",
    "pre-commit": "yarn validate && yarn test:unit"
  }
}
```

---

### **Tamagui Token System (July 2, 2025)**

#### **The Problem**
```typescript
// ❌ WRONG: Used generic CSS values
fontFamily="monospace"        // TypeScript error
fontSize="$6"                 // Invalid token size
lineHeight="$6"              // Doesn't work with all sizes
```

#### **Tamagui Best Practices**
```typescript
// ✅ CORRECT: Use Tamagui design tokens
fontFamily="$mono"           // Proper token
fontSize="$8"                // Valid size tokens: $1-$12
lineHeight={1.6}             // Use numeric values for line-height
color="$textPrimary"         // Semantic color tokens
backgroundColor="$background" // Theme-aware tokens
```

#### **Token Reference**
- **Fonts**: `$body`, `$heading`, `$mono`
- **Sizes**: `$1` through `$12` (no `$6` for fontSize in our config)
- **Colors**: `$textPrimary`, `$textSecondary`, `$background`, `$primary`, etc.
- **Spacing**: `$1` through `$20` for padding/margin

---

### **Component Interface Design (July 2, 2025)**

#### **The Problem**
```typescript
// ❌ WRONG: Required prop without fallback
interface ComponentShowcaseProps {
  children: React.ReactNode  // Required but not always provided
  variants?: Array<...>
}

// Usage that breaks:
<ComponentShowcase 
  title="Example"
  description="..."
  variants={[...]}  // No children provided
/>
```

#### **Solution Pattern**
```typescript
// ✅ CORRECT: Optional with proper fallback
interface ComponentShowcaseProps {
  children?: React.ReactNode  // Optional
  variants?: Array<...>
}

// Implementation with fallback:
{variants?.length > 0 
  ? variants[selectedVariant].component 
  : children || <Text>No preview available</Text>
}
```

#### **Interface Design Rules**
1. **Make props optional when possible** with sensible defaults
2. **Provide fallbacks** for missing content
3. **Use union types** for mutually exclusive props
4. **Document required combinations** in JSDoc comments

---

## 🛠 Testing Strategy Learnings

### **Test Environment Separation (July 2, 2025)**

#### **Key Insight**
- **Playwright tests** run in separate TypeScript environment
- **Unit tests** don't catch integration issues
- **Dev server** can mask build-time errors

#### **Comprehensive Testing Approach**
```bash
# 1. Type Safety
yarn workspace next-app typecheck

# 2. Build Validation  
yarn workspace next-app build

# 3. Unit Tests
yarn test:unit

# 4. Integration Tests
yarn test:integration

# 5. E2E Tests
npx playwright test

# 6. Accessibility Tests
npx playwright test brand-accessibility.spec.ts
```

### **Component Testing Philosophy**

#### **What To Test**
✅ **DO Test:**
- Component renders without errors
- Props are passed correctly
- User interactions work
- Accessibility compliance
- Cross-browser compatibility

❌ **DON'T Test:**
- Complex form validation (test at integration level)
- External library internals (React Hook Form, etc.)
- Styling specifics (use visual regression instead)

#### **Mock vs Real Dependencies**
```typescript
// ✅ GOOD: Mock simple dependencies
const mockOnClick = jest.fn()

// ❌ BAD: Mock complex state management
const mockControl = { /* incomplete */ } as any

// ✅ BETTER: Use real providers in tests
<TestWrapper>
  <FormProvider methods={methods}>
    <FormInput name="test" />
  </FormProvider>
</TestWrapper>
```

---

## 🎨 Brand System Learnings

### **Component Showcase Strategy (July 2, 2025)**

#### **Documentation vs. Interactive Examples**
```typescript
// ✅ For complex components: Document, don't demo
{
  title: "Form Components Overview",
  description: "Advanced components requiring React Hook Form setup",
  children: <DocumentationUI />,
  code: `// Real usage example with proper setup`
}

// ✅ For simple components: Interactive demos
{
  title: "Navigation Button",
  variants: [
    { name: "Active", component: <NavButton active={true} /> },
    { name: "Inactive", component: <NavButton active={false} /> }
  ]
}
```

#### **When to Use Each Approach**
- **Documentation**: Form components, complex state management, external dependencies
- **Interactive Demo**: Simple UI components, styling variations, basic interactions
- **Code Examples**: Always provide real usage patterns

---

## 🚨 Common Pitfalls & Solutions

### **1. TypeScript `as any` Abuse**
```typescript
// ❌ DANGEROUS: Bypasses all type checking
const mockThing = { incomplete: true } as any

// ✅ SAFE: Create proper interface
interface MockThing {
  incomplete: boolean
  // ... other required properties
}
const mockThing: MockThing = { incomplete: true }
```

### **2. Assumptions About Component APIs**
```typescript
// ❌ WRONG: Assumed FormInput would accept any control
<FormInput control={anyObject} />

// ✅ RIGHT: Read the actual component interface
// FormInput expects: Control<T extends FieldValues>
```

### **3. Development Without Validation**
```bash
# ❌ RISKY: Develop -> Test -> Fix
git add . && git commit -m "new feature"

# ✅ SAFE: Validate -> Develop -> Validate -> Commit
yarn typecheck && yarn lint && yarn test
```

---

## 📚 Knowledge Capture Process

### **When to Update This Document**
- **After fixing complex bugs** (like the React Hook Form issue)
- **When discovering platform-specific patterns** (Tamagui tokens, Next.js quirks)
- **After establishing new workflows** (testing strategies, deployment processes)
- **When onboarding reveals knowledge gaps**

### **How to Document Learnings**
1. **Problem Statement**: What went wrong and why
2. **Root Cause Analysis**: Technical details of the issue
3. **Solution**: Working code examples and explanations
4. **Prevention**: How to avoid the issue in future
5. **Related Issues**: Links to similar problems or patterns

### **Review Schedule**
- **Monthly Review**: Update with recent learnings
- **Quarterly Review**: Reorganize and consolidate
- **Project Milestones**: Major learnings capture
- **Team Changes**: Knowledge transfer sessions

---

## 🔗 Related Resources

### **Internal Documentation**
- [`CLAUDE.md`](./CLAUDE.md) - Project overview and architecture
- [`apps/next/tests/BRAND_TESTING.md`](./apps/next/tests/BRAND_TESTING.md) - Testing documentation
- [`packages/ui/src/branding/`](./packages/ui/src/branding/) - Brand system components

### **External References**
- [Tamagui Documentation](https://tamagui.dev) - Design system patterns
- [React Hook Form](https://react-hook-form.com) - Form state management
- [Playwright Best Practices](https://playwright.dev/docs/best-practices) - E2E testing

---

## 📝 Contributing to This Document

### **Format for New Learnings**
```markdown
### **[Learning Title] ([Date])**

#### **The Problem**
[Describe what went wrong]

#### **Root Cause**
[Technical explanation]

#### **Solution**
```typescript
// Code example
```

#### **Prevention Strategy**
[How to avoid this in future]
```

### **Editing Guidelines**
- **Be specific**: Include exact error messages and code snippets
- **Be actionable**: Provide clear steps to avoid/fix issues
- **Be concise**: Focus on the learning, not the story
- **Update references**: Keep links and examples current

### **Mini-CSS-Extract-Plugin Webpack Conflict (July 2, 2025)**

#### **The Problem**
```bash
Error: ObjectMiddleware.register: serializer for mini-css-extract-plugin/dist/CssModule/null is already registered
```

#### **Root Cause**
- Multiple Next.js development servers running simultaneously
- Webpack's mini-css-extract-plugin gets registered multiple times across different processes
- Tamagui's CSS extraction conflicts with multiple running instances

#### **Solution**
```bash
# 1. Kill all running Next.js processes
pkill -f "next-server" && pkill -f "next.*dist.*bin.*next"

# 2. Clean restart
yarn web

# 3. If problem persists, clear Next.js cache
rm -rf .next
yarn web
```

#### **Prevention Strategy**
1. **Always check for running processes** before starting dev server
2. **Use process managers** like PM2 for consistent process management
3. **Set up development scripts** to automatically clean up before start
4. **Monitor port usage** to avoid conflicts

#### **Next.js Configuration Notes**
- Tamagui's `withTamagui` plugin handles CSS extraction
- `disableExtraction` is set to `true` in development mode
- Multiple instances sharing the same webpack cache can cause conflicts

### **Tamagui Lucide Icons Import Pattern (July 4, 2025)**

#### **The Problem**
```typescript
// ❌ WRONG: Specific path imports causing module resolution errors
import { Sun } from '@tamagui/lucide-icons/icons/Sun'
import { Moon } from '@tamagui/lucide-icons/icons/Moon'
// Error: Package path ./dist/esm/icons/sun is not exported

// ❌ ALSO WRONG: Mixed import patterns causing inconsistency
// Sometimes using specific paths, sometimes barrel imports
// Led to constant "flip-flopping" between different approaches
```

#### **Root Cause**
- **Package exports confusion**: `@tamagui/lucide-icons` supports multiple import patterns
- **Inconsistent documentation**: Some examples show specific paths, others show barrel imports
- **Build-time vs dev-time differences**: Different module resolution behavior
- **Developer uncertainty**: Switching between patterns without establishing a standard

#### **Final Solution - Use Tamagui Documentation Pattern**
```typescript
// ✅ CORRECT: Always use main package barrel imports
import { Sun, Moon } from '@tamagui/lucide-icons'

// This pattern:
// ✅ Matches official Tamagui documentation exactly
// ✅ Uses the main package exports (confirmed in package.json)
// ✅ Works in both development and production builds
// ✅ Prevents future import pattern confusion
```

#### **Verification Process**
```bash
# 1. Check package.json exports
head -50 node_modules/@tamagui/lucide-icons/package.json

# 2. Verify main index exports
grep -E "(Sun|Moon)" node_modules/@tamagui/lucide-icons/dist/esm/index.mjs

# 3. Test build
yarn build  # Must succeed

# 4. Test runtime
yarn web   # Must start without errors
```

#### **Prevention Strategy - DEFINITIVE RULE**
1. **ALWAYS use barrel imports**: `import { IconName } from '@tamagui/lucide-icons'`
2. **NEVER use specific paths**: Avoid `/icons/IconName` pattern
3. **Follow Tamagui docs**: When in doubt, reference https://tamagui.dev/ui/lucide-icons
4. **Document the standard**: Update this file when import patterns change
5. **Test immediately**: Run `yarn build` after any icon import changes

#### **Working Examples**
```typescript
// ✅ Theme toggle icons
import { Sun, Moon } from '@tamagui/lucide-icons'

// ✅ Form icons (existing working pattern)
import { Eye } from '@tamagui/lucide-icons/icons/Eye'     // Legacy - but works
import { EyeOff } from '@tamagui/lucide-icons/icons/EyeOff' // Legacy - but works

// 🔄 TODO: Standardize existing specific path imports to barrel imports
// Only change when touching those files to avoid unnecessary churn
```

#### **Implementation Locations**
- **Theme Toggle**: `packages/app/features/theme-toggle.tsx`
- **Password Input**: `packages/ui/src/form/password-input.tsx` (uses specific paths - legacy)
- **Other Components**: Various locations using mixed patterns

#### **CRITICAL ROOT CAUSE DISCOVERED**
The persistent issue was caused by **Next.js `modularizeImports` configuration**:

```javascript
// ❌ WRONG: This was transforming Sun → sun (kebabCase)
modularizeImports: {
  '@tamagui/lucide-icons': {
    transform: `@tamagui/lucide-icons/dist/esm/icons/{{kebabCase member}}`,
    //                                              ^^^^^^^^^^^^^^^^
    //                                              This caused Sun → sun
  },
},

// ✅ CORRECT: Use exact member name and proper path
modularizeImports: {
  '@tamagui/lucide-icons': {
    transform: `@tamagui/lucide-icons/icons/{{member}}`,
    //                               ^^^^^  ^^^^^^^^
    //                               Right path, exact case
  },
},
```

**What was happening**:
1. Code: `import { Sun } from '@tamagui/lucide-icons'`
2. Next.js transforms: `Sun` → `sun` (kebabCase) → `@tamagui/lucide-icons/dist/esm/icons/sun`
3. But actual export: `@tamagui/lucide-icons/icons/Sun` (uppercase)
4. Result: Module not found error

#### **Key Lesson**
**Check build tool configurations first**: When imports work in isolation but fail in the build, investigate webpack/Next.js transform rules before changing code patterns.

### **Environment Variables Anti-Pattern (August 31, 2025)**

#### **The Problem**
```bash
# ❌ WRONG: Configuration values scattered in environment variables
MEMORIAL_SHEET_ID=...
BIBLE_CLASS_SHEET_ID=...
SUNDAY_SCHOOL_SHEET_ID=...
DYNAMODB_TABLE_NAME=tee-admin

# Result: Deployment failures, can't fork repository, config in wrong layer
```

#### **Root Cause**
- **Configuration treated as secrets**: Sheet IDs and table names aren't secrets
- **Environment variables leaked into business logic**: Direct `process.env` calls everywhere
- **Silent fallbacks hiding issues**: Code had hardcoded defaults masking missing config
- **Can't fork repository**: Private configuration in environment variables

#### **Solution - Fail-Fast Config Service**
```typescript
// ✅ CORRECT: Centralized config with fail-fast behavior
class GoogleSheetsConfig {
  constructor() {
    const configFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE
    if (!configFile) {
      throw new Error('CRITICAL: GOOGLE_SERVICE_ACCOUNT_KEY_FILE not set')
    }
    
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'))
    // NO FALLBACKS - fail immediately if config missing
  }

  getSheetId(type: string): string | null {
    return this.sheets[type] || null  // Explicit null, no silent defaults
  }
}
```

#### **Prevention Strategy**
1. **Environment variables ONLY for secrets**: AWS keys, OAuth tokens, API keys
2. **Configuration in files**: Sheet IDs, table names, feature flags
3. **Fail-fast architecture**: No silent fallbacks, clear error messages
4. **Single source of truth**: One config service per domain

---

### **Mobile-First Development Crisis (August 31, 2025)**

#### **The Problem**
```typescript
// ❌ WRONG: Desktop-only navigation deployed to production
<XStack width={250} position="fixed">
  {/* No mobile support, no hamburger menu */}
  <NavigationContent />
</XStack>

// Result: Navigation took 80% of mobile screen at church service
```

#### **Root Cause**
- **Testing on desktop only**: Developed without checking mobile viewport
- **Multiple navigation implementations**: 3 different versions causing confusion
- **No responsive testing in workflow**: Deployed without mobile verification
- **useMedia() hook not used**: Tamagui's responsive utilities ignored

#### **Solution - Mobile-First with useMedia()**
```typescript
// ✅ CORRECT: Always check mobile layout first
const media = useMedia()

if (media.sm) {  // Mobile layout
  return (
    <Sheet modal open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
      <Sheet.Overlay />
      <Sheet.Frame>
        <NavigationContent />
      </Sheet.Frame>
    </Sheet>
  )
}

// Desktop layout
return <XStack>...</XStack>
```

#### **Prevention Strategy**
1. **Mobile-first development**: Design for mobile, enhance for desktop
2. **useMedia() hook always**: Never assume single layout
3. **Test at 375px width**: iPhone SE is smallest common device
4. **Remove experiments after promotion**: Don't leave multiple implementations

---

### **Git Secrets in Documentation (August 31, 2025)**

#### **The Problem**
```markdown
# ❌ WRONG: Actual AWS credentials in markdown documentation
AWS_ACCESS_KEY_ID=AKIA[REDACTED]
AWS_SECRET_ACCESS_KEY=[REDACTED]

# Result: GitHub push protection blocked all pushes
```

#### **Root Cause**
- **Documentation not sanitized**: Real credentials copied into test results
- **Git history contaminated**: Secrets persisted in commit history
- **Push protection triggered**: GitHub's security scanning blocked repository

#### **Solution - History Rewrite**
```bash
# ✅ CORRECT: Clean git history with filter-branch
git filter-branch --force --tree-filter \
  'sed -i "s/AKIA[A-Z0-9]*/AKIA***/g" DATA_SYNC_TEST_RESULTS.md' \
  --prune-empty --tag-name-filter cat -- --all

git push --force  # After verifying cleanup
```

#### **Prevention Strategy**
1. **Always mask credentials**: Use `***` in documentation
2. **Check before committing**: `git diff` to review changes
3. **Use .gitignore properly**: Ensure sensitive files excluded
4. **Enable secret scanning**: GitHub security features

---

### **Single Production Database Pattern (August 31, 2025)**

#### **The Problem**
```javascript
// ❌ WRONG: Attempting to create staging/dev environment splits
if (process.env.NODE_ENV === 'development') {
  tableName = 'tee-admin-dev'
} else if (process.env.NODE_ENV === 'staging') {
  tableName = 'tee-admin-staging'
}

// Reality: All environments use SAME production tables
```

#### **Root Cause**
- **Misunderstanding architecture**: Assumed multiple database environments
- **Traditional deployment mindset**: Expected dev/staging/prod separation
- **Documentation gaps**: Pattern not clearly stated

#### **Solution - Everything Production-Ready**
```typescript
// ✅ CORRECT: Single set of production tables
const tableNames = {
  admin: 'tee-admin',        // Same in ALL environments
  schedules: 'tee-schedules', // Same in ALL environments
  syncStatus: 'tee-sync-status' // Same in ALL environments
}

// Use feature flags for gradual rollout
if (isFeatureEnabled('new-feature')) {
  // New code path
}
```

#### **Prevention Strategy**
1. **No environment splits**: Everything is production
2. **Feature flags for safety**: Control rollout, not environments
3. **Test with production data**: Same database, careful testing
4. **Document in AI_ARCHITECTURE.md**: Clear statement of pattern

---

### **Repository Pattern Enforcement (August 31, 2025)**

#### **The Problem**
```typescript
// ❌ WRONG: Direct DynamoDB calls in routes
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'

export async function GET() {
  const client = new DynamoDBClient()
  const result = await client.send(...)  // Direct database access
}
```

#### **Root Cause**
- **Bypassing abstraction layers**: Direct database calls for "quick fixes"
- **Scattered data access**: No single source of truth for data operations
- **Inconsistent error handling**: Each route handling errors differently

#### **Solution - Always Use Repositories**
```typescript
// ✅ CORRECT: Repository pattern for all data access
import { scheduleRepo } from '@my/app/provider/dynamodb/repositories/schedule-repository'

export async function GET() {
  try {
    const schedules = await scheduleRepo.getSchedulesByType('memorial')
    return NextResponse.json(schedules)
  } catch (error) {
    // Centralized error handling
    return handleRepositoryError(error)
  }
}
```

#### **Prevention Strategy**
1. **Never import DynamoDB client directly in routes**
2. **All data access through repositories**
3. **Document in AI_DYNAMODB_CONTRACTS.md**
4. **Code review enforcement**

---

*Last Updated: August 31, 2025*
*Contributors: Claude (AI Assistant), Ken Easson*
*Review Schedule: Monthly*