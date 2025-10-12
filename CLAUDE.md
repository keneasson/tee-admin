# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Model Selection Guidelines (Opus vs Sonnet)

### Use Sonnet 4.5 for (Default):
- **End-to-End Feature Development**: Discovery, planning, implementation, and verification
- **File Operations**: Reading, searching, grepping files
- **Code Changes**: Simple edits, refactoring, restructuring
- **Bash Commands**: Running builds, tests, checking git status
- **Documentation**: Writing comments, updating READMEs, API docs
- **Type Checking**: Running TypeScript compiler, fixing type errors
- **Todo Management**: Updating task lists, marking items complete
- **Code Formatting**: Fixing indentation, organizing imports
- **Search & Discovery**: Finding files, understanding project structure
- **Complex Debugging**: Root cause analysis, multi-step debugging
- **API Design**: RESTful, GraphQL, following established patterns
- **Multi-File Refactoring**: Cross-cutting changes with dependency tracking
- **Business Logic**: Implementing complex domain rules and workflows
- **Security Analysis**: Authentication, authorization, routine security reviews
- **Performance Issues**: Identifying bottlenecks, standard optimizations

### Use Opus (4.1) for (Rare Cases):
- **Novel Architecture Design**: Completely new system components requiring deep innovation
- **Algorithmic Innovation**: Creating new algorithms, complex mathematical solutions
- **Critical Security Vulnerabilities**: Expert-level security analysis for zero-days
- **Performance Breakthroughs**: Algorithmic optimization requiring novel approaches
- **Complex Cross-System Design**: New integration patterns across multiple services
- **Research & Proof of Concepts**: Exploring uncharted technical territory

### Sonnet 4.5 Capabilities (New)
- **Advanced reasoning**: Complex multi-step problem solving
- **Deep code understanding**: Large codebase analysis and navigation
- **Context utilization**: Effective use of large conversation contexts
- **Error recovery**: Self-correction and debugging without escalation
- **Pattern recognition**: Identifying architectural patterns and anti-patterns
- **Dependency tracking**: Managing changes across related components

### Prompting for Efficiency
Default to Sonnet 4.5 for all tasks. Only escalate when:
- "This needs Opus:" - Novel problems, algorithmic innovation, or architectural redesign
- "Try Sonnet first, escalate if needed:" - Uncertain complexity

### Task Breakdown Strategy (Simplified)
1. **Start with Sonnet 4.5** (Default): Handles discovery → planning → implementation → verification
2. **Escalate to Opus only when**: Hitting novel problems, need algorithmic innovation, or major architectural redesign
3. **Return to Sonnet**: Once Opus provides design/strategy, Sonnet implements

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
- **CRITICAL**: Single production DynamoDB - all environments use the SAME tables (`tee-admin`, `tee-schedules`, `tee-sync-status`)
- User data stored in DynamoDB with email-based account linking
- Role-based access control (owner, admin, member, guest)
- Google Sheets integration for schedules, contacts, and newsletters
- Email campaigns scheduled via AWS EventBridge (migrated from Vercel cron)

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

### Email Scheduling System

TEE Admin uses a simple Vercel cron-based email system for scheduled test emails.

#### Current Schedule
- **Thursday 9:30pm** - Test newsletter email (via Vercel cron)
  - Endpoint: `/api/email/test-thursday`
  - Always runs in **TEST MODE** (sends to test list only)
  - Uses newsletter template

#### Configuration
Scheduled emails are configured in `apps/next/vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/email/test-thursday",
      "schedule": "30 21 * * 4"  // Thursday 9:30pm
    }
  ]
}
```

#### Security
- All email endpoints require `EMAIL_SENDER_SECRET` authentication
- Vercel automatically includes this in cron requests
- Manual testing: `curl -H "Authorization: Bearer $EMAIL_SENDER_SECRET" https://your-domain.vercel.app/api/email/test-thursday`

#### Email Types Available
- `newsletter` - Weekly newsletter
- `bible-class` - Bible class reminder
- `sunday-school` - Sunday school reminder
- `recap` - Memorial service (recap)

#### Advanced System (Future)
For advanced scheduling needs, see [`AWS_EVENTBRIDGE_SETUP.md`](./AWS_EVENTBRIDGE_SETUP.md) for the DynamoDB queue-based system with EventBridge integration.

#### Environment Variables
- `EMAIL_SENDER_SECRET` - Bearer token for authenticating cron requests
- AWS credentials - Required for SES email delivery

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