# Migrate Pages Router to App Router in Next.js

## 🎯 Objective
Migrate all remaining Pages Router routes (`/pages`) to the modern App Router (`/app`) to consolidate routing architecture and leverage Next.js App Router benefits.

## 📋 Current State

### Hybrid Router Architecture
Currently using **both** routing systems:
- **App Router (`/app`)**: API routes only
- **Pages Router (`/pages`)**: All frontend pages + legacy API routes

### Current Pages Router Routes
```
📁 pages/
├── _app.tsx                 → Root app component
├── _document.tsx            → Document customization  
├── index.tsx               → Home page
├── 📁 auth/                → Authentication pages
│   ├── forgot-password.tsx
│   ├── register.tsx
│   ├── resend-verification.tsx
│   ├── reset-password.tsx
│   ├── signin.tsx
│   ├── verify-email-sent.tsx
│   └── verify-email.tsx
├── 📁 email-tester/        → Admin email testing
│   └── index.tsx
├── events.tsx              → Events listing
├── 📁 events/              → Event details
│   └── [eventId].tsx
├── 📁 newsletter/          → Newsletter pages
│   └── index.tsx
├── 📁 profile/             → User profile
│   └── index.tsx
├── 📁 schedule/            → Schedule pages
│   └── index.tsx
├── 📁 welfare/             → Welfare pages
│   └── index.tsx
└── 📁 api/                 → Legacy API routes (to be removed)
    └── [various endpoints]
```

### Current App Router Structure
```
📁 app/
└── 📁 api/                 → Modern API routes
    ├── 📁 auth/            → Authentication APIs
    └── 📁 debug/           → Debug endpoints
```

## 🔧 Migration Tasks

### 1. Analysis and Planning
- [ ] **Route Mapping**: Create complete mapping of pages → app routes
- [ ] **Component Dependencies**: Identify shared components and layouts
- [ ] **Data Fetching**: Analyze data fetching patterns for conversion
- [ ] **Authentication Integration**: Plan NextAuth.js integration with App Router

### 2. App Router Structure Design
```
📁 app/
├── layout.tsx              → Root layout (replaces _app.tsx)
├── page.tsx               → Home page
├── loading.tsx            → Global loading UI
├── error.tsx              → Global error UI
├── not-found.tsx          → 404 page
├── 📁 auth/               → Authentication pages
│   ├── layout.tsx         → Auth layout
│   ├── 📁 signin/         → Sign in page
│   ├── 📁 register/       → Registration page
│   ├── 📁 forgot-password/→ Password reset
│   └── [other auth pages]
├── 📁 profile/            → User profile
│   ├── layout.tsx         → Profile layout
│   └── page.tsx           → Profile page
├── 📁 newsletter/         → Newsletter section
├── 📁 events/             → Events section
├── 📁 schedule/           → Schedule section
├── 📁 email-tester/       → Admin tools
└── 📁 api/                → API routes (existing)
```

### 3. Core Infrastructure Migration

#### Root Layout (`app/layout.tsx`)
- [ ] Migrate `_app.tsx` functionality
- [ ] Implement NextAuth SessionProvider
- [ ] Setup Tamagui providers
- [ ] Configure global styles and fonts
- [ ] Setup analytics and monitoring

#### Document Customization  
- [ ] Migrate `_document.tsx` customizations to `layout.tsx`
- [ ] Update meta tags and head configuration
- [ ] Ensure proper SSR configuration

### 4. Authentication Pages Migration

#### High Priority Auth Pages
- [ ] **`/auth/signin`** → `app/auth/signin/page.tsx`
- [ ] **`/auth/register`** → `app/auth/register/page.tsx`  
- [ ] **`/auth/forgot-password`** → `app/auth/forgot-password/page.tsx`
- [ ] **`/auth/reset-password`** → `app/auth/reset-password/page.tsx`

#### Auth Layout
- [ ] Create `app/auth/layout.tsx` for shared auth UI
- [ ] Implement authentication guards
- [ ] Setup proper error boundaries

### 5. Application Pages Migration

#### User-Facing Pages
- [ ] **Home** (`/`) → `app/page.tsx`
- [ ] **Profile** (`/profile`) → `app/profile/page.tsx`
- [ ] **Newsletter** (`/newsletter`) → `app/newsletter/page.tsx`
- [ ] **Events** (`/events`) → `app/events/page.tsx`
- [ ] **Event Detail** (`/events/[eventId]`) → `app/events/[eventId]/page.tsx`
- [ ] **Schedule** (`/schedule`) → `app/schedule/page.tsx`
- [ ] **Welfare** (`/welfare`) → `app/welfare/page.tsx`

#### Admin Pages
- [ ] **Email Tester** (`/email-tester`) → `app/email-tester/page.tsx`

### 6. Data Fetching Modernization

#### Convert to App Router Patterns
- [ ] **Server Components**: Use for static content
- [ ] **Client Components**: Use for interactive elements
- [ ] **Data Fetching**: Migrate to `fetch()` with caching
- [ ] **Loading States**: Implement `loading.tsx` files
- [ ] **Error Handling**: Implement `error.tsx` files

### 7. Navigation and Routing Updates

#### Update Navigation Components
- [ ] **WithNavigation**: Update for App Router
- [ ] **Links**: Convert to App Router navigation
- [ ] **Route Guards**: Implement middleware-based protection
- [ ] **Redirects**: Update redirect logic

### 8. Legacy API Routes Cleanup
- [ ] **Remove** `pages/api` routes (already migrated to `app/api`)
- [ ] **Verify** all API endpoints work correctly
- [ ] **Update** API client calls if needed

## 🔧 Technical Implementation

### 1. Create Base App Router Structure
```typescript
// app/layout.tsx
import { NextAuthProvider } from './providers/NextAuthProvider'
import { TamaguiProvider } from './providers/TamaguiProvider'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <NextAuthProvider>
          <TamaguiProvider>
            {children}
          </TamaguiProvider>
        </NextAuthProvider>
      </body>
    </html>
  )
}
```

### 2. Authentication Integration
```typescript
// app/auth/layout.tsx
import { redirect } from 'next/navigation'
import { auth } from '@/utils/auth'

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  
  // Redirect if already authenticated
  if (session) {
    redirect('/profile')
  }

  return (
    <div className="auth-layout">
      {children}
    </div>
  )
}
```

### 3. Protected Routes
```typescript
// app/profile/layout.tsx
import { redirect } from 'next/navigation'
import { auth } from '@/utils/auth'

export default async function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  
  if (!session) {
    redirect('/auth/signin')
  }

  return (
    <div className="profile-layout">
      {children}
    </div>
  )
}
```

## ⚠️ Migration Challenges

### NextAuth.js v5 Integration
- **Challenge**: NextAuth.js v5 App Router integration
- **Solution**: Use `auth()` function for server-side authentication
- **Testing**: Verify all auth flows work correctly

### Tamagui SSR Configuration
- **Challenge**: Ensure proper SSR with Tamagui
- **Solution**: Configure Tamagui provider in root layout
- **Testing**: Verify no hydration mismatches

### Route Protection
- **Challenge**: Implement proper route guards
- **Solution**: Use layouts for authentication checks
- **Testing**: Verify unauthorized access redirects

### Data Fetching Patterns
- **Challenge**: Convert from getServerSideProps/getStaticProps
- **Solution**: Use Server Components with fetch()
- **Testing**: Verify data loading performance

## 🚀 Benefits of App Router Migration

### Performance Benefits
- **Streaming**: Improved loading with React Server Components
- **Caching**: Better caching strategies with fetch()
- **Bundle Size**: Reduced client-side JavaScript
- **SEO**: Improved SEO with server components

### Developer Experience
- **Co-location**: Layouts, loading, and error states co-located
- **Type Safety**: Better TypeScript integration
- **Modern Patterns**: Use latest React patterns
- **Debugging**: Better error messages and debugging

### Architecture Benefits
- **Unified Routing**: Single routing system
- **Cleaner Structure**: More organized file structure
- **Scalability**: Better for large applications
- **Maintenance**: Easier to maintain and extend

## 🔍 Testing Strategy

### Functional Testing
- [ ] **Authentication Flows**: All auth pages work correctly
- [ ] **Navigation**: All links and redirects work
- [ ] **Data Loading**: All pages load data correctly
- [ ] **Form Submissions**: All forms submit correctly
- [ ] **Error Handling**: Error states display properly

### Performance Testing
- [ ] **Page Load Times**: Compare before/after migration
- [ ] **Bundle Size**: Measure client-side bundle impact
- [ ] **Server Response**: Measure server response times
- [ ] **Core Web Vitals**: Ensure no regression in metrics

### Cross-Platform Testing
- [ ] **Expo Integration**: Ensure mobile app still works with APIs
- [ ] **API Compatibility**: Verify API endpoints unchanged
- [ ] **Authentication**: Cross-platform auth still works

## 📝 Migration Phases

### Phase 1: Infrastructure (Week 1)
- [ ] Setup base App Router structure
- [ ] Migrate root layout and providers
- [ ] Configure NextAuth.js integration
- [ ] Setup error and loading boundaries

### Phase 2: Authentication (Week 2)
- [ ] Migrate all authentication pages
- [ ] Implement auth layouts and guards
- [ ] Test authentication flows
- [ ] Update navigation components

### Phase 3: Application Pages (Week 3)
- [ ] Migrate main application pages
- [ ] Implement page-specific layouts
- [ ] Update data fetching patterns
- [ ] Test all user flows

### Phase 4: Cleanup and Optimization (Week 4)
- [ ] Remove old Pages Router files
- [ ] Optimize performance
- [ ] Update documentation
- [ ] Final testing and deployment

## ✅ Definition of Done
- [ ] All pages migrated from Pages Router to App Router
- [ ] No remaining files in `/pages` directory (except if needed for compatibility)
- [ ] All authentication flows work correctly
- [ ] All user journeys function properly
- [ ] Performance metrics maintained or improved
- [ ] Cross-platform compatibility maintained
- [ ] Tests updated and passing
- [ ] Documentation updated

## 📚 Resources
- [Next.js App Router Migration Guide](https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration)
- [NextAuth.js App Router Guide](https://next-auth.js.org/configuration/nextjs#in-app-router)
- [React Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)

## 🏷️ Labels
`enhancement`, `nextjs`, `app-router`, `architecture`, `migration`, `breaking-change`

## 📊 Priority
**Medium-High** - Important for modernization but requires careful planning and testing