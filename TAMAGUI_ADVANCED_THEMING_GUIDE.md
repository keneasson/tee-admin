# Tamagui Advanced Theming Guide: Multiple Theme Modes

This guide documents the complete process for implementing multiple theme modes in Tamagui, including admin-specific themes. The official Tamagui documentation lacks comprehensive guidance on this topic, so this serves as a practical implementation guide.

## Table of Contents
1. [The Problem](#the-problem)
2. [Core Concepts](#core-concepts)
3. [Implementation Steps](#implementation-steps)
4. [Common Gotchas](#common-gotchas)
5. [Testing & Validation](#testing--validation)
6. [Advanced Patterns](#advanced-patterns)

## The Problem

### What Tamagui Documentation Doesn't Tell You

1. **Multiple Theme Variants**: The docs show basic light/dark themes but don't explain how to create specialized variants (admin, mobile, accessibility, etc.)
2. **Build Configuration**: Critical import/export issues that break builds aren't well documented
3. **Type Safety**: TypeScript integration with custom themes has many undocumented pitfalls
4. **Context Management**: How to properly manage theme state across complex applications
5. **Performance**: Theme switching performance implications and optimization strategies

### Our Use Case
We needed:
- Standard `light` and `dark` themes for regular users
- Admin-specific `admin_light` and `admin_dark` themes with condensed spacing
- Automatic role-based theme switching
- Persistent theme preferences
- Type-safe theme management

## Core Concepts

### Theme Architecture
```
Themes Structure:
├── Standard Themes (for end users)
│   ├── light
│   └── dark
└── Admin Themes (for admin/owner roles)
    ├── admin_light (condensed spacing, professional colors)
    └── admin_dark (optimized for long sessions)
```

### Theme Token Strategy
```typescript
// Standard brand colors
const brandColors = {
  light: { /* user-friendly colors */ },
  dark: { /* user-friendly dark colors */ }
}

// Admin-optimized colors
const adminBrandColors = {
  light: { 
    // More neutral, less eye strain
    background: '#FBFBFB', // vs '#FEFEFE' for standard
    // Higher contrast for data density
    textPrimary: '#0F0F0F', // vs '#1A1A1A' for standard
  },
  dark: { /* optimized for long admin sessions */ }
}
```

## Implementation Steps

### Step 1: Define Theme Structure

**File: `packages/config/src/tee-themes.ts`**

```typescript
// 1. Define base brand colors
const brandColors = {
  light: {
    primary: '#1B365D',
    background: '#FEFEFE',
    textPrimary: '#1A1A1A',
    // ... complete color palette
  },
  dark: {
    primary: '#4A90E2',
    background: '#0D1117',
    textPrimary: '#FFFFFF',
    // ... complete color palette
  }
}

// 2. Define admin-specific variants
const adminBrandColors = {
  light: {
    ...brandColors.light,
    // Override with admin-optimized values
    background: '#FBFBFB',      // Less stark white
    textPrimary: '#0F0F0F',     // Higher contrast
    primary: '#2563EB',         // More modern blue
  },
  dark: {
    ...brandColors.dark,
    // Override with admin-optimized values
    background: '#0F172A',      // Deeper blue-black
    textPrimary: '#F8FAFC',     // Off-white for readability
  }
}

// 3. Create Tamagui theme objects
export const teeThemes = {
  light: {
    // Map brand colors to Tamagui tokens
    background: brandColors.light.background,
    color: brandColors.light.textPrimary,
    primary: brandColors.light.primary,
    // ... complete mapping
  },
  dark: { /* similar mapping */ },
  admin_light: {
    // Use admin brand colors
    background: adminBrandColors.light.background,
    color: adminBrandColors.light.textPrimary,
    // ... complete mapping
  },
  admin_dark: { /* similar mapping */ }
}
```

### Step 2: Update Tamagui Configuration

**File: `packages/config/src/tamagui.config.ts`**

**❌ Common Mistake:**
```typescript
// This BREAKS the build - 'components' doesn't exist in v3
import { tokens, themes, components } from '@tamagui/config/v3'

export const config = createTamagui({
  themes: { ...themes, ...teeThemes },
  components, // This property doesn't exist!
})
```

**✅ Correct Implementation:**
```typescript
import { createTamagui } from 'tamagui'
import { tokens, themes } from '@tamagui/config/v3' // No 'components'!
import { teeThemes } from './tee-themes'

export const config = createTamagui({
  // Essential properties
  themes: {
    ...themes,        // Tamagui base themes
    ...teeThemes,     // Your custom themes
  },
  tokens,             // Tamagui design tokens
  fonts: { /* fonts */ },
  media: { /* responsive breakpoints */ },
  // Note: NO 'components' property in v3
})
```

### Step 3: Theme Context Management

**File: `packages/ui/src/theme-provider.tsx`**

```typescript
// 1. Define theme type union
export type ThemeName = 'light' | 'dark' | 'admin_light' | 'admin_dark'

// 2. Enhanced context interface
type ThemeContextType = {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
  toggleTheme: () => void
  isAdminTheme: boolean
  getBaseTheme: () => 'light' | 'dark'
  setAdminMode: (enabled: boolean) => void
}

// 3. Smart theme management
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'light',
}) => {
  const [theme, setThemeState] = useState<ThemeName>(defaultTheme)
  
  // Helper functions
  const isAdminTheme = theme.startsWith('admin_')
  const getBaseTheme = (): 'light' | 'dark' => {
    if (theme === 'admin_light' || theme === 'light') return 'light'
    return 'dark'
  }
  
  // Smart theme toggling preserves admin mode
  const toggleTheme = () => {
    const baseTheme = getBaseTheme()
    const newBaseTheme = baseTheme === 'light' ? 'dark' : 'light'
    const newTheme = isAdminTheme ? `admin_${newBaseTheme}` as ThemeName : newBaseTheme
    setTheme(newTheme)
  }
  
  // Role-based admin mode switching
  const setAdminMode = (enabled: boolean) => {
    const baseTheme = getBaseTheme()
    const newTheme = enabled ? `admin_${baseTheme}` as ThemeName : baseTheme
    setTheme(newTheme)
  }
  
  // Persistent storage for both theme and admin mode
  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      localStorage.setItem('tee-theme', theme)
      localStorage.setItem('tee-admin-mode', isAdminTheme.toString())
    }
  }, [theme, isInitialized, isAdminTheme])
  
  return (
    <ThemeContext.Provider value={{ 
      theme, setTheme, toggleTheme, 
      isAdminTheme, getBaseTheme, setAdminMode 
    }}>
      {children}
    </ThemeContext.Provider>
  )
}
```

### Step 4: Theme-Aware Component System

**File: `packages/ui/src/hooks/use-admin-spacing.ts`**

```typescript
// Inline tokens to avoid circular import issues
const adminTokens = {
  form: {
    sectionPadding: '$3',    // vs '$4' for standard
    itemSpacing: '$2',       // vs '$4' for standard
  },
  card: {
    padding: '$3',           // vs '$4' for standard
    spacing: '$2',           // vs '$4' for standard
  },
}

export const useAdminSpacing = () => {
  const { isAdminTheme } = useThemeContext()
  
  return {
    // Conditional spacing based on theme
    card: {
      padding: isAdminTheme ? adminTokens.card.padding : '$4',
      space: isAdminTheme ? adminTokens.card.spacing : '$4',
    },
    formSection: {
      padding: isAdminTheme ? adminTokens.form.sectionPadding : '$4',
      space: isAdminTheme ? adminTokens.form.itemSpacing : '$4',
    },
    // Boolean for manual conditionals
    isAdminTheme,
  }
}
```

### Step 5: Role-Based Auto-Switching

```typescript
// Automatic admin theme activation
export const useAdminTheme = (userRole?: string) => {
  const { setAdminMode, isAdminTheme } = useThemeContext()
  
  useEffect(() => {
    const shouldUseAdminTheme = userRole === 'admin' || userRole === 'owner'
    if (shouldUseAdminTheme && !isAdminTheme) {
      setAdminMode(true)
    } else if (!shouldUseAdminTheme && isAdminTheme) {
      setAdminMode(false)
    }
  }, [userRole, isAdminTheme, setAdminMode])
  
  return { isAdminTheme, setAdminMode }
}

// Usage in admin pages
export default function AdminPage() {
  const { data: session } = useSession()
  
  // Auto-enable admin theme
  useAdminTheme(session?.user?.role)
  
  return <AdminContent />
}
```

## Common Gotchas

### 1. React Hooks "Invalid hook call" Errors

**❌ Problem:**
```
Invalid hook call. Hooks can only be called inside of the body of a function component.
[TypeError: Cannot read properties of null (reading 'useReducer')]
```

**Root Causes:**
- Theme context hooks called before provider initialization
- SSR/hydration mismatches with localStorage access
- Missing error boundaries in theme hooks

**✅ Solution:**
```typescript
// Add safety checks and error boundaries
export const useThemeContext = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    if (process.env.NODE_ENV === 'development') {
      console.error('useThemeContext must be used within a ThemeProvider')
    }
    throw new Error('useThemeContext must be used within a ThemeProvider')
  }
  return context
}

// Safe hook usage with try/catch
export const useAdminTheme = (userRole?: string) => {
  try {
    const { setAdminMode, isAdminTheme } = useThemeContext()
    
    React.useEffect(() => {
      if (!userRole || !setAdminMode) return // Safety check
      
      const shouldUseAdminTheme = userRole === 'admin' || userRole === 'owner'
      if (shouldUseAdminTheme && !isAdminTheme) {
        setAdminMode(true)
      }
    }, [userRole, isAdminTheme, setAdminMode])
    
    return { isAdminTheme, setAdminMode }
  } catch (error) {
    console.warn('useAdminTheme called outside ThemeProvider context')
    return { 
      isAdminTheme: false, 
      setAdminMode: () => {} 
    }
  }
}

// SSR-safe theme provider
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isMounted, setIsMounted] = useState(false)
  
  useEffect(() => {
    setIsMounted(true) // Prevent SSR issues
  }, [])
  
  useEffect(() => {
    if (typeof window !== 'undefined' && isMounted) {
      try {
        const savedTheme = localStorage.getItem(storageKey)
        // Safe localStorage access
      } catch (error) {
        console.warn('localStorage access failed:', error)
      }
    }
  }, [isMounted])
}
```

### 2. Import/Export Conflicts

**❌ Problem:**
```typescript
// This creates circular imports and build failures
import { adminTokens } from '@my/config/admin-tokens'
// When config also imports from UI package
```

**✅ Solution:**
```typescript
// Inline tokens or use a separate, non-circular path
const adminTokens = { /* inline definition */ }
```

### 2. TypeScript Theme Name Conflicts

**❌ Problem:**
```typescript
// Both packages export 'ThemeName'
export * from 'tamagui'
export * from './theme-provider'
// Error: Module has already exported a member named 'ThemeName'
```

**✅ Solution:**
```typescript
// Explicit re-export with renaming
export { 
  ThemeProvider, 
  useThemeContext, 
  type ThemeName as UIThemeName 
} from './theme-provider'
```

### 3. Tamagui v3 Configuration

**❌ Problem:**
```typescript
// 'components' doesn't exist in @tamagui/config/v3
import { tokens, themes, components } from '@tamagui/config/v3'
```

**✅ Solution:**
```typescript
// Only import what actually exists
import { tokens, themes } from '@tamagui/config/v3'
// No 'components' property in createTamagui config
```

### 4. Theme Token Validation

**❌ Problem:**
```typescript
// Invalid token references cause runtime errors
<Text fontSize="$invalid" /> // Breaks at runtime
```

**✅ Solution:**
```typescript
// Always use valid Tamagui tokens
<Text fontSize="$4" />      // Works
<Text fontSize={text.size} /> // Theme-aware, validated
```

### 5. Performance Issues

**❌ Problem:**
```typescript
// Re-creating spacing objects on every render
const getSpacing = () => ({
  card: { padding: isAdminTheme ? '$3' : '$4' }
})
```

**✅ Solution:**
```typescript
// Memoize or use stable objects
const spacing = useMemo(() => getAdminSpacing(isAdminTheme), [isAdminTheme])
```

## Testing & Validation

### Build Validation
```bash
# Test config bundling
yarn workspace next-app build

# Check for Tamagui errors
# Should NOT see: "Must provide components"
# Should NOT see: "Could not resolve" errors
```

### Theme Switching Tests
```typescript
// Test all theme combinations
const themes: ThemeName[] = ['light', 'dark', 'admin_light', 'admin_dark']

themes.forEach(theme => {
  // Verify theme applies correctly
  // Verify spacing changes appropriately
  // Verify persistence works
})
```

### TypeScript Validation
```bash
# Ensure no type conflicts
yarn workspace next-app typecheck

# Watch for:
# - ThemeName conflicts
# - Invalid token references
# - Missing theme properties
```

## Advanced Patterns

### 1. Conditional Component Styling

```typescript
// Theme-aware component variants
export function AdminCard({ children, ...props }) {
  const { card } = useAdminSpacing()
  
  return (
    <Card 
      padding={card.padding}
      space={card.space}
      {...props}
    >
      {children}
    </Card>
  )
}
```

### 2. Theme-Specific Components

```typescript
// Components that only render in admin themes
export function AdminThemeToggle() {
  const { isAdminTheme, setAdminMode, toggleTheme } = useThemeContext()
  
  if (!isAdminTheme) return null
  
  return (
    <XStack space="$2">
      <Button onPress={() => setAdminMode(false)}>Exit Admin</Button>
      <Button onPress={toggleTheme}>Toggle Dark</Button>
    </XStack>
  )
}
```

### 3. Responsive Admin Themes

```typescript
// Different admin themes for different screen sizes
const useResponsiveAdminTheme = () => {
  const media = useMedia()
  const { isAdminTheme } = useThemeContext()
  
  if (!isAdminTheme) return null
  
  return {
    spacing: media.sm ? '$2' : '$3', // Tighter on mobile
    fontSize: media.sm ? '$3' : '$4',
  }
}
```

## Lessons Learned

### What Works Well
1. **Inline token definitions** prevent circular imports
2. **Explicit re-exports** avoid TypeScript conflicts  
3. **Role-based auto-switching** provides seamless UX
4. **Persistent storage** maintains user preferences
5. **Theme-aware hooks** make components automatically adaptive

### What Doesn't Work
1. **Separate token packages** create circular dependencies
2. **Importing 'components'** from @tamagui/config/v3 breaks builds
3. **Export * patterns** cause TypeScript naming conflicts
4. **Runtime theme switching** without proper state management
5. **Complex theme inheritance** leads to maintenance issues

### Performance Considerations
1. **Memoize theme calculations** to avoid re-renders
2. **Use CSS variables** for frequently-changing properties
3. **Limit theme switching frequency** to avoid layout thrashing
4. **Bundle size impact** - each theme adds to the bundle

## Conclusion

Implementing advanced Tamagui theming requires understanding several undocumented aspects:

1. **Configuration limitations** in different Tamagui versions
2. **Import/export dependencies** and how they interact with build systems
3. **TypeScript integration** and naming conflict resolution
4. **Performance implications** of dynamic theme switching
5. **State management patterns** for complex theme scenarios

This guide provides a battle-tested approach that works in production environments with complex requirements. The key is understanding that Tamagui's documentation focuses on simple use cases, but real-world applications often need more sophisticated theming strategies.

---

*This guide was created based on implementing a production admin theme system for the TEE (Toronto East Christadelphian Ecclesia) administrative application. All patterns have been tested in a Next.js 15 + React 19 + Tamagui 1.129.11 environment.*