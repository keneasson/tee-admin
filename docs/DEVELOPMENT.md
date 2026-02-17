# TEE Admin Development Guide

> **Purpose**: Patterns, workflows, and learnings for developing features in TEE Admin
> **Audience**: Developers (human and AI) building and maintaining this codebase

---

## Critical Development Rules

### 1. Never Break Mobile
- **Always** test responsive design
- **Always** include hamburger menu for navigation on mobile
- **Always** use `useMedia()` hook for breakpoints
- **Never** use fixed widths without mobile alternative

### 2. TypeScript Validation Workflow
```bash
# Run after EVERY significant change:
yarn workspace next-app typecheck

# Before committing:
yarn workspace next-app typecheck && yarn workspace next-app build
```

### 3. Cross-Platform Safety
- Session data passed as props, not from `useSession()` in shared packages
- Navigation callbacks (e.g., `onNavigate`) instead of `useRouter()` in shared packages
- See [ARCHITECTURE.md](./ARCHITECTURE.md) for details

---

## Feature Development Location

```
CORRECT:
packages/app/experiments/[feature-name]/     # During development
packages/app/features/[feature-name].tsx     # When promoted

WRONG:
apps/next/app/[page]/                        # Business logic in pages
apps/next/app/api/[route]/                   # Complex logic in routes
packages/ui/src/random-experiment.tsx        # Experiments scattered
```

---

## Feature Flag Workflow

### Creating an Experiment

1. **Add Flag Definition**
```typescript
// packages/app/features/feature-flags/feature-flags.ts
export const FEATURE_FLAGS = {
  EXPERIMENT_[FEATURE]: 'experiment_[feature]',
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
const isEnabled = checkFeatureFlag(FEATURE_FLAGS.EXPERIMENT_[FEATURE], session)
return isEnabled ? <Experimental[Feature] /> : <Current[Feature] />
```

### Promoting to Production

1. Validate: Mobile responsive, accessible, no TypeScript errors
2. Move code from experiments to features
3. Set feature flag to 100%
4. Wait 1 week for stability
5. **Delete**: Old code, feature flag, experiment folder

---

## Common Patterns

### Loading States
```typescript
const [isLoading, setIsLoading] = useState(true)
const [data, setData] = useState(null)
const [error, setError] = useState(null)

if (isLoading) return <Spinner />
if (error) return <ErrorMessage error={error} />
if (!data) return <EmptyState />
```

### Form Handling
```typescript
import { useForm } from 'react-hook-form'

<FormInput
  control={control}
  name="email"
  rules={{ required: 'Email is required' }}
/>
```

### Mobile-First Development
```typescript
const media = useMedia()

if (media.sm) {
  return <MobileLayout />
}
return <DesktopLayout />
```

---

## Tamagui Token Reference

| Category | Valid Tokens |
|----------|--------------|
| Fonts | `$body`, `$heading`, `$mono` |
| Sizes | `$1` through `$12` |
| Colors | `$textPrimary`, `$textSecondary`, `$background`, `$primary` |
| Spacing | `$1` through `$20` |

```typescript
// CORRECT
fontFamily="$mono"
fontSize="$8"
color="$textPrimary"

// WRONG
fontFamily="monospace"
fontSize="$6"  // May not exist
```

---

## Icon Imports

**Always use barrel imports for @tamagui/lucide-icons:**

```typescript
// CORRECT
import { Sun, Moon, Eye } from '@tamagui/lucide-icons'

// WRONG - specific paths can break
import { Sun } from '@tamagui/lucide-icons/icons/Sun'
```

---

## Recorded Learnings

### Form Component Development
- React Hook Form `Control` objects are complex - never mock with `as any`
- Document complex components instead of creating broken demos
- Use real providers in tests, not incomplete mocks

### Mini-CSS-Extract-Plugin Conflicts
```bash
# Kill running Next.js processes before starting dev
pkill -f "next-server" && pkill -f "next.*dist.*bin.*next"
yarn web
```

### Environment Variables
- **Only for secrets**: AWS keys, OAuth tokens, API keys
- **Config files for everything else**: Sheet IDs, table names
- **Fail-fast**: No silent fallbacks, clear error messages

### Git Secrets
- Always mask credentials in documentation (`***`)
- Check `git diff` before committing
- If secrets leak, use `git filter-branch` to clean history

---

## Anti-Patterns to Avoid

| Anti-Pattern | Problem |
|--------------|---------|
| Multiple component versions | navigation.tsx, navigation-v2.tsx - confusing |
| Hardcoded values | Sheet IDs in components - unmaintainable |
| Feature flags never removed | Tech debt accumulation |
| "Test" or "New" in code names | Use feature flags instead |
| Direct env access in components | Use config services |
| `as any` for complex objects | Bypasses type safety |

---

## Regression Prevention Checklist

Before ANY navigation or layout change:
- [ ] Test on iPhone (Safari)
- [ ] Test on Android (Chrome)
- [ ] Test on tablet (iPad)
- [ ] Test keyboard navigation
- [ ] Verify hamburger menu on mobile
- [ ] Verify no horizontal scroll on mobile
- [ ] Run `yarn workspace next-app typecheck`
- [ ] Run `yarn workspace next-app build`

---

## Testing Strategy

### Test Commands
```bash
yarn workspace next-app typecheck   # Type safety
yarn workspace next-app build       # Build validation
yarn test:unit                      # Unit tests
npx playwright test                 # E2E tests
```

### What To Test vs. What Not To Test

**DO Test:**
- Component renders without errors
- Props passed correctly
- User interactions work
- Accessibility compliance

**DON'T Test:**
- Complex form validation (test at integration level)
- External library internals
- Styling specifics (use visual regression)

---

## Knowledge Capture

Update this document when:
- Fixing complex bugs
- Discovering platform-specific patterns
- Establishing new workflows
- Onboarding reveals knowledge gaps

Format for new learnings:
```markdown
### [Learning Title] ([Date])
**Problem**: What went wrong
**Root Cause**: Technical explanation
**Solution**: Working code
**Prevention**: How to avoid in future
```

---

*Consolidated from AI_FEATURE_DEVELOPMENT_PATTERNS.md and DEVELOPMENT_LEARNINGS.md*
