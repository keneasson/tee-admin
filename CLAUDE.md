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

### Next.js Hybrid Router Architecture
- **App Router (`apps/next/app/`)** - Used for API routes (modern approach)
- **Pages Router (`apps/next/pages/`)** - Used for frontend pages (NextAuth.js v5 compatibility)
- This hybrid approach leverages new App Router features while maintaining compatibility with existing authentication patterns

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

## Deployment

Deploy to Vercel using:
- `vercel deploy` - Deploy to preview environment
- `vercel deploy --prod` - Deploy to production
- Root: `apps/next`
- Install command: `yarn set version berry && yarn install`
- Build command: default
- Includes automated cron jobs for email campaigns