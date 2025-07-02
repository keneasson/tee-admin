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

---

*Last Updated: July 2, 2025*
*Contributors: Claude (AI Assistant)*
*Review Schedule: Monthly*