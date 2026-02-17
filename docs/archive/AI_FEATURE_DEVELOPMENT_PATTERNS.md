# AI Feature Development Patterns

> **PURPOSE**: Strict patterns to prevent regressions and maintain clean architecture
> **FOR**: AI agents developing features in this codebase

## 🚨 CRITICAL RULES FOR AI DEVELOPMENT

### 1. NEVER Break Mobile
- **ALWAYS** test responsive design
- **ALWAYS** include hamburger menu for navigation
- **ALWAYS** use `useMedia()` hook for breakpoints
- **NEVER** use fixed widths without mobile alternative

### 2. Feature Development Location
```
CORRECT:
packages/app/experiments/[feature-name]/     # During development
packages/app/features/[feature-name].tsx     # When promoted

WRONG:
apps/next/app/[page]/                        # Business logic in pages
apps/next/app/api/[route]/                   # Complex logic in routes
packages/ui/src/random-experiment.tsx        # Experiments scattered
```

### 3. State Management Hierarchy
1. **Component State**: useState for UI state
2. **Feature State**: Context or Zustand for feature-wide state  
3. **Global State**: NextAuth session, feature flags
4. **Server State**: TanStack Query (coming soon)

## 📋 FEATURE FLAG WORKFLOW

### Creating an Experiment

1. **Add Flag Definition**
```typescript
// packages/app/features/feature-flags/feature-flags.ts
export const FEATURE_FLAGS = {
  EXPERIMENT_[FEATURE]: 'experiment_[feature]', // During development
}
```

2. **Create Experiment Component**
```typescript
// packages/app/experiments/[feature]/index.tsx
export const Experimental[Feature] = () => {
  // New implementation
}
```

3. **Add Feature Gate**
```typescript
// In the consuming component
const isEnabled = useFeatureFlag(FEATURE_FLAGS.EXPERIMENT_[FEATURE])

return isEnabled ? <Experimental[Feature] /> : <Current[Feature] />
```

### Promoting to Production

1. **Validate Requirements**
- [ ] Mobile responsive
- [ ] Accessibility tested
- [ ] No TypeScript errors
- [ ] No breaking changes OR migration guide written

2. **Migration Steps**
```bash
# 1. Move code from experiments to features
mv packages/app/experiments/[feature] packages/app/features/

# 2. Update imports
# 3. Set feature flag to 100%
# 4. Wait 1 week for stability
# 5. Remove old code and feature flag
```

3. **Clean Up**
- DELETE old implementation
- DELETE feature flag
- DELETE experiment folder
- UPDATE documentation

## 🏗️ ARCHITECTURE PATTERNS

### Component Structure
```typescript
// ✅ CORRECT: Separation of concerns
// packages/app/features/newsletter/newsletter-service.ts
export class NewsletterService {
  async fetchNewsletters() { /* business logic */ }
}

// packages/app/features/newsletter/newsletter-screen.tsx  
export function NewsletterScreen() {
  const service = new NewsletterService()
  /* UI logic */
}

// apps/next/app/newsletter/page.tsx
export default function NewsletterPage() {
  return <NewsletterScreen /> // Just a wrapper
}
```

```typescript
// ❌ WRONG: Everything in the page
// apps/next/app/newsletter/page.tsx
export default function NewsletterPage() {
  // Business logic mixed with UI
  const fetchNewsletters = async () => { /* ... */ }
  // Direct DynamoDB calls
  const data = await dynamoClient.query(/* ... */)
  // UI rendering
  return <div>...</div>
}
```

### Data Access Patterns
```typescript
// ✅ CORRECT: Through repositories
import { scheduleRepo } from '@my/app/provider/dynamodb'
const schedules = await scheduleRepo.getSchedulesByType('memorial')

// ❌ WRONG: Direct DynamoDB access
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
const client = new DynamoDBClient()
const data = await client.query(/* ... */)
```

### Mobile-First Development
```typescript
// ✅ CORRECT: Mobile-first with progressive enhancement
export function Navigation() {
  const media = useMedia()
  
  // Mobile layout (default)
  if (media.sm) {
    return <MobileNavigation />
  }
  
  // Desktop enhancement
  return <DesktopNavigation />
}

// ❌ WRONG: Desktop-only
export function Navigation() {
  return <div style={{ width: '250px' }}>...</div>
}
```

## 🔄 COMMON PATTERNS TO FOLLOW

### 1. Loading States
```typescript
const [isLoading, setIsLoading] = useState(true)
const [data, setData] = useState(null)
const [error, setError] = useState(null)

// ALWAYS show loading state
if (isLoading) return <Spinner />
if (error) return <ErrorMessage error={error} />
if (!data) return <EmptyState />
```

### 2. Form Handling
```typescript
// Use React Hook Form
import { useForm } from 'react-hook-form'

// With Tamagui components
<FormInput
  control={control}
  name="email"
  rules={{ required: 'Email is required' }}
/>
```

### 3. Authentication Checks
```typescript
// ALWAYS use NextAuth
import { useSession } from 'next-auth/react'

const { data: session, status } = useSession()
if (status === 'loading') return <Loading />
if (!session) return <LoginPrompt />
```

## ❌ ANTI-PATTERNS TO AVOID

1. **Multiple versions of the same component**
   - navigation.tsx, navigation-v2.tsx, new-navigation.tsx
   
2. **Hardcoded values in components**
   - Sheet IDs, table names, API endpoints
   
3. **Feature flags that never get removed**
   - Set timeline for flag removal
   
4. **"Test" or "New" in production code names**
   - Use feature flags, not naming conventions
   
5. **Direct environment variable access in components**
   - Use configuration services

## 📝 REGRESSION PREVENTION CHECKLIST

Before ANY navigation or layout change:
- [ ] Test on iPhone (Safari)
- [ ] Test on Android (Chrome)  
- [ ] Test on tablet (iPad)
- [ ] Test keyboard navigation
- [ ] Test with screen reader
- [ ] Verify hamburger menu present on mobile
- [ ] Verify no horizontal scroll on mobile

## 🎯 SUCCESS CRITERIA

A feature is ready for production when:
1. Works on all screen sizes
2. No TypeScript errors
3. Follows repository pattern for data
4. Has proper loading/error states
5. Removes old code completely
6. Updates documentation

---
**REMEMBER**: Mobile users are >50% of traffic. If it doesn't work on mobile, it doesn't work.