# Upgrade Next.js and Expo to Latest Versions

## 🎯 Objective
Upgrade Next.js from 14.2.21 to version 15.3.4 (latest stable) and Expo from SDK 51.0.9 to SDK 53.0.13 (latest stable) to access new features, performance improvements, and security updates.

## 📋 Current State

### Next.js Web App
- **Current Version**: 14.2.21
- **Target Version**: 15.3.4 (latest stable)
- **Router**: Hybrid (App Router for API, Pages Router for frontend)
- **Features**: NextAuth.js v5, Tamagui integration, Vercel deployment

### Expo Mobile App  
- **Current SDK Version**: 51.0.9
- **Target SDK Version**: 53.0.13 (latest stable)
- **Router**: Expo Router 3.5.15
- **React Native**: 0.74.2 → 0.77.x (with SDK 53)

## 🔧 Next.js Upgrade Tasks

### 1. Pre-Upgrade Assessment  
- [ ] Check Next.js 15.3.4 compatibility with NextAuth.js v5
- [ ] Verify Tamagui Next.js plugin compatibility with 15.x
- [ ] Review breaking changes between 14.2.21 and 15.3.4
- [ ] **Major**: React 19 support and requirements assessment
- [ ] **Major**: Turbopack stable release impact evaluation

### 2. Next.js Core Upgrade
- [ ] Update `next` package to 15.3.4
- [ ] Update `@types/node` for Node.js compatibility  
- [ ] Update `eslint-config-next` to matching 15.x version
- [ ] Update React to 19.x (required for Next.js 15)
- [ ] Update `@next/*` related packages to compatible versions

### 3. Configuration Updates
- [ ] **next.config.js**: Update for Next.js 15 features
- [ ] **Middleware**: Update middleware API if changed
- [ ] **API Routes**: Verify App Router API compatibility
- [ ] **Build Configuration**: Update for new build optimizations

### 4. Dependencies Compatibility Check
```bash
# Critical dependencies to verify:
- @tamagui/next-plugin: Ensure Next.js 15 compatibility
- next-auth: Verify v5 works with Next.js 15
- @vercel/analytics: Update if needed
- next-compose-plugins: May be deprecated in Next.js 15
- next-transpile-modules: May be deprecated in Next.js 15
```

## 🔧 Expo Upgrade Tasks

### 1. Pre-Upgrade Assessment
- [ ] Review Expo SDK 53.0.13 changelog and breaking changes
- [ ] **Major**: React Native 0.77.x compatibility assessment  
- [ ] **Major**: New Architecture enabled by default impact
- [ ] Verify Expo Router compatibility with SDK 53
- [ ] Assess iOS 15.1+ and Android SDK 24+ requirements

### 2. Expo SDK Upgrade
- [ ] Update `expo` package to 53.0.13
- [ ] Update all `expo-*` packages to SDK 53 versions
- [ ] Update `@expo/*` development packages to compatible versions
- [ ] Update React Native to 0.77.x (required for SDK 53)

### 3. Configuration Updates
- [ ] **app.json/app.config.js**: Update for new SDK features
- [ ] **Metro Config**: Update metro configuration
- [ ] **Babel Config**: Update babel plugins for new SDK
- [ ] **EAS Configuration**: Update EAS build configuration

### 4. Dependencies Compatibility
```bash
# Expo-specific packages to update:
- expo-router: Latest version for new routing features
- expo-constants: SDK-matched version
- expo-linking: SDK-matched version  
- expo-dev-client: Latest development client
- @expo/metro-config: Latest metro configuration
```

## ⚠️ Breaking Changes Assessment

### Next.js 15.3.4 Major Breaking Changes
1. **React 19 Required**: Next.js 15 requires React 19 (breaking change)
2. **Turbopack Stable**: New bundler is now stable and default for dev
3. **API Routes**: Enhanced caching and request handling
4. **ESLint 9 Support**: Updated linting requirements
5. **Node.js Requirements**: Minimum Node.js version updates

### Expo SDK 53 Major Breaking Changes  
1. **React Native 0.77**: Major React Native version jump (0.74 → 0.77)
2. **New Architecture Default**: Hermes and New Architecture enabled by default
3. **iOS 15.1+ Required**: Minimum iOS deployment target increased
4. **Android SDK 24+**: Minimum Android API level increased to 24
5. **Breaking Package Changes**: Several expo-* packages have breaking API changes

## 🔧 Migration Strategy

### Phase 1: Next.js Upgrade
1. **Create Upgrade Branch**
   ```bash
   git checkout -b upgrade/nextjs-15
   ```

2. **Update Dependencies**
   ```bash
   yarn add next@15.3.4
   yarn add react@19 react-dom@19
   yarn add -D eslint-config-next@15
   yarn add -D @types/node@latest
   ```

3. **Update Configuration**
   ```bash
   # Update next.config.js
   # Update middleware.ts
   # Test API routes
   ```

4. **Test Web Application**
   ```bash
   yarn web
   yarn web:prod
   yarn test:e2e
   ```

### Phase 2: Expo Upgrade  
1. **Update Expo SDK**
   ```bash
   cd apps/expo
   npx expo upgrade 53
   npx expo install --fix
   ```

2. **Update Dependencies**
   ```bash
   yarn add expo@53.0.13
   yarn add expo-router@latest
   # Update all expo-* packages to SDK 53 versions
   yarn add react-native@0.77
   ```

3. **Test Mobile Application**
   ```bash
   yarn native
   # Test on iOS/Android
   ```

## 🚀 Expected Benefits

### Next.js 15 Benefits
- **Performance**: Improved build times and runtime performance
- **Developer Experience**: Better development tools and debugging
- **Security**: Latest security patches and improvements
- **Features**: Access to newest Next.js features

### Latest Expo SDK Benefits
- **React Native**: Latest React Native features and performance
- **Development**: Improved development tools and hot reload
- **Build System**: Faster builds and better optimization
- **Platform Features**: Access to latest iOS/Android capabilities

## 🔍 Testing Strategy

### Next.js Testing
- [ ] **Authentication Flow**: NextAuth.js functionality
- [ ] **API Routes**: All existing API endpoints
- [ ] **Static Generation**: Build and static export
- [ ] **Development Server**: Hot reload and development features
- [ ] **Production Build**: Vercel deployment testing

### Expo Testing
- [ ] **Development Build**: Expo development client
- [ ] **Navigation**: Expo Router functionality
- [ ] **Platform Features**: iOS and Android compatibility
- [ ] **Build Process**: EAS Build compatibility
- [ ] **API Integration**: Next.js API communication

### Cross-Platform Testing
- [ ] **Authentication**: Shared auth flow between web/mobile
- [ ] **API Communication**: Expo app calling Next.js APIs
- [ ] **UI Consistency**: Tamagui components across platforms
- [ ] **Navigation**: Solito navigation integration

## ⚠️ Risk Assessment

### High Risk Areas
1. **React 19 Breaking Changes**: Major React version jump requires code updates
2. **New Architecture Impact**: Expo's New Architecture may break existing native modules
3. **NextAuth.js + React 19**: Authentication compatibility with React 19
4. **Tamagui Compatibility**: UI framework support for React 19 and RN 0.77
5. **API Communication**: Potential breaking changes in Expo-Next.js integration

### Mitigation Strategies
1. **Incremental Upgrade**: Upgrade Next.js first, then Expo
2. **Extensive Testing**: Test all critical user flows
3. **Rollback Plan**: Maintain previous working versions
4. **Documentation**: Document all changes made

## 📝 Post-Upgrade Tasks

### Configuration Optimization
- [ ] **Next.js**: Enable new performance features
- [ ] **Expo**: Configure new SDK capabilities
- [ ] **Build Optimization**: Update build configurations
- [ ] **Development Tools**: Configure new development features

### Code Modernization
- [ ] **API Routes**: Migrate to App Router if beneficial
- [ ] **React Features**: Use React 19 features if available
- [ ] **Expo Features**: Implement new Expo SDK features
- [ ] **Performance**: Optimize for new platform capabilities

## ✅ Definition of Done
- [ ] Next.js updated to version 15.3.4
- [ ] React updated to version 19.x  
- [ ] Expo updated to SDK 53.0.13
- [ ] React Native updated to 0.77.x
- [ ] All applications build successfully with new versions
- [ ] All tests pass with updated dependencies
- [ ] Authentication flow works on both platforms with React 19
- [ ] API communication between Expo and Next.js functional
- [ ] New Architecture compatibility verified
- [ ] Performance metrics maintained or improved
- [ ] Documentation updated with version changes

## 📚 Resources
- [Next.js 15 Upgrade Guide](https://nextjs.org/docs/upgrading)
- [Expo SDK Upgrade Guide](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
- [React Native Upgrade Guide](https://react-native-community.github.io/upgrade-helper/)

## 🏷️ Labels
`enhancement`, `nextjs`, `expo`, `react-native`, `dependencies`, `breaking-change`

## 📊 Priority
**High** - Framework updates are critical for security, performance, and access to new features