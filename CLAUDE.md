# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TEE Admin is a cross-platform monorepo for the Toronto East Christadelphian Ecclesia administrative system. Built with Turborepo, it includes web (Next.js), mobile (Expo), and email template (React Email) applications sharing common business logic and UI components.

## Development Commands

### Start Applications
- `yarn web` - Start Next.js web application (builds packages first)
- `yarn native` - Start Expo mobile application  
- `yarn email` - Start React Email template builder

### Build & Deploy
- `yarn build` - Build all packages (excludes next-app)
- `yarn web:prod` - Build Next.js for production
- `yarn web:prod:serve` - Serve production build locally

### Package Management
- `yarn` - Install dependencies
- `yarn fix` - Fix monorepo package dependencies
- `yarn check-deps` - Verify dependency version consistency

### GitHub Issue Management
- **Default Workflow**: When creating issues or planning new features, ALWAYS create GitHub issues automatically using GitHub CLI
- **Command**: `gh issue create --title "Issue Title" --body-file path/to/issue.md --label "enhancement"`
- **Process**: 
  1. Create comprehensive issue content in `.github/ISSUE_TEMPLATE/` directory
  2. Use GitHub CLI to create the issue immediately
  3. Return the GitHub issue URL to the user
- **Labels**: Use standard labels like `enhancement`, `bug`, `documentation` (check available labels first)

## Architecture

### Monorepo Structure
- `apps/next/` - Next.js web application with API routes
- `apps/expo/` - React Native mobile app
- `apps/email-builder/` - React Email templates
- `packages/app/` - Shared business logic and features
- `packages/ui/` - Cross-platform UI components (Tamagui)
- `packages/config/` - Tamagui configuration

### Key Technologies
- **Tamagui** - Cross-platform UI components with compile-time optimizations
- **Solito** - Cross-platform navigation between Next.js and React Native
- **Turborepo** - Monorepo build system and caching
- **NextAuth.js v5** - Authentication with Google OAuth and Credentials provider
- **AWS DynamoDB** - User data storage
- **AWS SES** - Email delivery service
- **Google Sheets API** - Data source integration
- **React Hook Form** - Form validation and state management
- **Lucide Icons** - Via @tamagui/lucide-icons for consistent iconography

### Next.js App Router Architecture
- **App Router (`apps/next/app/`)** - Full App Router implementation for all routes
- **Frontend Pages** - All user-facing pages migrated to App Router (`/page.tsx` pattern)
- **API Routes** - RESTful API endpoints using App Router (`/route.ts` pattern)
- **NextAuth.js v5** - Authentication fully integrated with App Router
- **Pages Router** - Completely phased out (migration completed)

### Authentication & Data Flow
- **Multi-provider authentication**: Google OAuth + Email/Password credentials
- **Email verification**: Required for new credential-based accounts
- **Invitation system**: 8-character codes with 7-day expiry and single-use enforcement
- **Password requirements**: Minimum 12 characters, spaces encouraged for passphrases
- User data stored in DynamoDB with email-based account linking
- Role-based access control (owner, admin, member, guest)
- Google Sheets integration for schedules, contacts, and newsletters
- Email campaigns triggered via Vercel cron jobs

### Cross-Platform Development
- Business logic lives in `packages/app/features/`
- UI components in `packages/ui/` work across web and mobile
- Platform-specific code only in `apps/` directories
- Shared navigation logic using Solito

### App Router Architecture & Patterns

#### Hydration Safety
All client components use the `useHydrated` hook to prevent hydration mismatches:

```typescript
import { useHydrated } from '@my/app/hooks/use-hydrated'

export default function MyPage() {
  const isHydrated = useHydrated()
  
  if (!isHydrated) {
    return <Loading />
  }
  
  return <MyContent />
}
```

#### Page Structure
- **App Router Pages**: `/apps/next/app/[route]/page.tsx`
- **API Routes**: `/apps/next/app/api/[route]/route.ts`
- **Layouts**: `/apps/next/app/layout.tsx` (global layout)
- **Authentication**: NextAuth.js v5 integrated with App Router middleware

#### Migration Pattern
1. Create `/app/[route]/page.tsx` with `'use client'` directive
2. Import existing screen component from `@my/app/features/`
3. Add hydration safety with `useHydrated` hook
4. Update router imports (`next/router` → `next/navigation`)
5. Remove conflicting Pages Router routes
6. Add Playwright regression tests

### Form Component Architecture
- **React Hook Form integration**: Custom components (`FormInput`, `PasswordInput`) with built-in validation
- **Browser compatibility**: Proper `name` attributes and `autoComplete` values for password managers
- **Password visibility toggle**: Using Lucide Eye/EyeOff icons from @tamagui/lucide-icons
- **Consistent validation**: Error display and field state management across all forms

```typescript
// Standard form input pattern:
<FormInput 
  control={control}
  name="email"
  label="Email Address"
  type="email"
  autoComplete="email"
  rules={{ required: 'Email is required' }}
/>

// Password input with visibility toggle:
<PasswordInput
  control={control}
  name="password"
  label="Password"
  autoComplete="current-password"
  rules={{ required: 'Password is required' }}
/>
```

## Configuration Requirements

### Google Services Setup
Copy `apps/next/tee-services-db47a9e534d3.tmpt.json` to `apps/next/tee-services-db47a9e534d3.json` and configure with Google Cloud Services credentials.

### Environment Variables
Configure AWS credentials, Google OAuth, and DynamoDB settings in appropriate environment files.

## Testing & Linting

### Code Quality Commands
- `yarn workspace next-app lint` - Next.js linting
- `yarn workspace next-app typecheck` - TypeScript type checking
- `yarn web:prod` - Build Next.js for production
- `yarn build` - Build all packages (excludes next-app)

Always run lint and typecheck commands after implementing new features to ensure code quality.

**🚨 CRITICAL**: When encountering text node errors, ALWAYS follow the Text Node Error Troubleshooting Checklist in the Text Component Guidelines section before making changes.

## Deployment

Deploy to Vercel using:
- `vercel deploy` - Deploy to preview environment
- `vercel deploy --prod` - Deploy to production
- Root: `apps/next`
- Install command: `yarn set version berry && yarn install`
- Build command: default
- Includes automated cron jobs for email campaigns

## ✅ Migration Status - COMPLETED

**MIGRATION COMPLETE** - Comprehensive modernization successfully completed following a systematic phased approach.

### Migration State: Phase 4 Complete - Full App Router Migration
- **Start Date**: June 30, 2025
- **Completion Date**: July 1, 2025  
- **Final Phase**: Phase 4 (App Router Migration)
- **Overall Progress**: 100% Complete
- **Status**: 🟢 **MIGRATION SUCCESSFUL**

## 🎨 Brand System & Component Development

### Brand Route Design System
TEE Admin includes a comprehensive brand system accessible at `/brand/*` routes for Admin/Owner roles only. This serves as our custom Storybook/Chromatic solution for component development and brand consistency.

**Brand System Routes:**
- `/brand/colours` - Color palette with accessibility testing
- `/brand/typography` - Typography hierarchy and examples
- `/brand/components` - Interactive component showcase
- `/brand/navigation` - Navigation testing environment
- `/brand/playground` - Feature flag testing area

### Component Development Workflow
1. **Component Creation**: All new components go in `packages/ui/src/`
2. **Brand Testing**: Add component variants to `/brand/components`
3. **Integration Testing**: Test with real data in `/brand/playground`
4. **Feature Flags**: Use feature flags for gradual rollout
5. **Production**: Deploy when ready via feature flag activation

### Feature Flag System
- **Location**: `packages/app/features/feature-flags/`
- **Usage**: Control visibility of new components and features
- **Testing**: Brand route allows safe testing without user exposure
- **Rollout**: Gradual deployment through flag percentage controls

### Brand Consistency Requirements
- **All UI components** must be showcased in brand system
- **Color usage** must follow brand palette definitions
- **Typography** must use defined hierarchy
- **Component props** must be documented with examples
- **Accessibility** must be tested and validated
- **Cross-platform** compatibility must be verified

### Development Guidelines
- **Never deploy directly to production** - use brand system first
- **Test all viewport sizes** in component showcase
- **Validate accessibility** using built-in contrast testing
- **Document component APIs** with interactive examples
- **Use feature flags** for any user-facing changes
- **Run TypeScript validation** after every major change: `yarn workspace next-app typecheck`
- **Capture learnings** in `DEVELOPMENT_LEARNINGS.md` when encountering complex issues
- **Test builds, not just dev** - run `yarn workspace next-app build` before commits

### Text Component Guidelines
**CRITICAL**: Avoid nested Text components and conditional rendering issues that break in React Native.

#### ❌ Incorrect Patterns:
```tsx
// Nested Text components (breaks in React Native)
<Text>
  Main content
  {condition && <Text>additional text</Text>}
</Text>

// Boolean && operator with Text (can render "false")
{isVisible && <Text>Content</Text>}
```

#### ✅ Correct Patterns:
```tsx
// Use ternary operators for conditional text
<Text>
  Main content
  {condition ? ` additional text` : ''}
</Text>

// Use Fragment wrapper for complex conditional rendering
<>
  {condition ? <Text>Content</Text> : null}
</>

// Separate Text components instead of nesting
<YStack>
  <Text>Main content</Text>
  {condition ? <Text>Additional content</Text> : null}
</YStack>
```

#### Consistency Rule:
**Always use ternary operators** (`condition ? value : ''`) instead of boolean AND operators (`condition && <Text>`) for conditional text rendering.

#### 🚨 Text Node Error Troubleshooting Checklist
When encountering "Unexpected text node: . A text node cannot be a child of a \<View\>" errors, **ALWAYS** follow this systematic process:

1. **Check for template strings outside Text components**:
   ```bash
   # Search for template literals that might need Text wrapping
   grep -n "\`.*\`" [filename]
   ```

2. **Find all conditional && operators**:
   ```bash
   # Search for all && conditional rendering
   grep -n "&&" [filename]
   ```

3. **Replace ALL && operators with ternary operators**:
   ```tsx
   // WRONG: Creates whitespace text nodes
   {condition && <Component />}
   
   // CORRECT: No whitespace text nodes
   {condition ? <Component /> : null}
   ```

4. **Wrap all template strings in Text components**:
   ```tsx
   // WRONG: Template string creates text node
   <Text>{`Hello ${name}`}</Text>
   
   // CORRECT: Wrapped in explicit Text component
   <Text><Text>{`Hello ${name}`}</Text></Text>
   ```

5. **Reference TEXT_NODE_FIX_DOCUMENTATION.md** for detailed examples and patterns

**⚠️ CRITICAL**: Do NOT skip steps in this checklist. Text node errors are systematic and require systematic fixes.

### Next.js 15 Route Parameters
**CRITICAL**: In Next.js 15, route parameters are now Promises and must be unwrapped with `React.use()`.

#### ❌ Incorrect Pattern (Next.js 14 style):
```tsx
interface PageProps {
  params: { id: string }
}

export default function Page({ params }: PageProps) {
  useEffect(() => {
    fetch(`/api/items/${params.id}`) // ❌ Direct access
  }, [params.id])
}
```

#### ✅ Correct Pattern (Next.js 15):
```tsx
import { use } from 'react'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function Page({ params }: PageProps) {
  const resolvedParams = use(params)
  
  useEffect(() => {
    fetch(`/api/items/${resolvedParams.id}`) // ✅ Unwrapped with use()
  }, [resolvedParams.id])
}
```

#### Alternative (useParams hook):
```tsx
import { useParams } from 'next/navigation'

export default function Page() {
  const params = useParams()
  const id = params?.id as string // ✅ useParams doesn't return Promise
  
  useEffect(() => {
    fetch(`/api/items/${id}`)
  }, [id])
}
```

### Knowledge Management
- **Development Learnings**: [`DEVELOPMENT_LEARNINGS.md`](./DEVELOPMENT_LEARNINGS.md) - Comprehensive knowledge base of lessons learned, common pitfalls, and best practices
- **Update learnings** after fixing complex bugs, discovering new patterns, or establishing workflows
- **Review monthly** to keep knowledge current and actionable

### Current Version State (Post-Migration)
- **Node.js**: 22 LTS ✅
- **Next.js**: 15.3.4 ✅
- **React**: 19.x ✅
- **Expo**: SDK 53.0.13 ✅
- **React Native**: 0.77.x ✅
- **Tamagui**: 1.129.11 ✅
- **Architecture**: Full App Router ✅

### Completed Migration Phases
1. **Phase 1**: Node.js 22 + Next.js 15 + React 19 ✅
2. **Phase 2**: Tamagui 1.129.11 upgrade ✅
3. **Phase 3**: Expo SDK 53 + React Native 0.77 ✅
4. **Phase 4**: Complete App Router migration ✅

### Migration Tracking
- **Progress Tracker**: `MIGRATION_TRACKER.md`
- **Risk Evaluation**: `GITHUB_ISSUES/00-comprehensive-risk-evaluation.md`
- **Upgrade Issues**: `GITHUB_ISSUES/01-05-*.md`

### Important Notes for Development
- **NO PRODUCTION CHANGES** until Phase 0 validation complete
- **Feature Freeze**: No new features during migration period
- **Backup Strategy**: Current working state preserved as rollback option
- **Testing Required**: All changes require comprehensive testing
- **Documentation**: All migration steps documented for continuity

### Migration Phases (Pending Validation)
1. **Phase 1**: Foundation (Node.js 22 + Tamagui upgrade)
2. **Phase 2**: Framework (Next.js 15 + React 19) - **HIGH RISK**
3. **Phase 3**: Mobile (Expo SDK 53 + React Native 0.77) - **HIGH RISK**
4. **Phase 4**: Architecture (Pages → App Router migration)
5. **Phase 5**: Data Layer (TanStack Query implementation)

**⚠️ CRITICAL**: Migration may be halted if Phase 0 validation reveals blocking incompatibilities. Always check `MIGRATION_TRACKER.md` for current status before making any changes.