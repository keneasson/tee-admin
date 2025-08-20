import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useThemeName } from 'tamagui'

export type ThemeName = 'light' | 'dark' | 'admin_light' | 'admin_dark'

type ThemeContextType = {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
  toggleTheme: () => void
  isAdminTheme: boolean
  getBaseTheme: () => 'light' | 'dark'
  setAdminMode: (enabled: boolean) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const useThemeContext = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    // During development, provide a more helpful error message
    if (process.env.NODE_ENV === 'development') {
      console.error('useThemeContext must be used within a ThemeProvider. Check that your component is wrapped with <ThemeProvider>.')
    }
    throw new Error('useThemeContext must be used within a ThemeProvider')
  }
  return context
}

export interface ThemeProviderProps {
  children: ReactNode
  defaultTheme?: ThemeName
  storageKey?: string
  adminStorageKey?: string
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'light',
  storageKey = 'tee-theme',
  adminStorageKey = 'tee-admin-mode',
}) => {
  const [theme, setThemeState] = useState<ThemeName>(defaultTheme)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  
  // Track mounting state to prevent SSR issues
  useEffect(() => {
    setIsMounted(true)
  }, [])
  
  // Helper functions
  const isAdminTheme = theme.startsWith('admin_')
  const getBaseTheme = (): 'light' | 'dark' => {
    if (theme === 'admin_light' || theme === 'light') return 'light'
    return 'dark'
  }
  
  // Load theme from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && isMounted) {
      try {
        const savedTheme = localStorage.getItem(storageKey) as ThemeName | null
        const savedAdminMode = localStorage.getItem(adminStorageKey) === 'true'
        
        if (savedTheme && ['light', 'dark', 'admin_light', 'admin_dark'].includes(savedTheme)) {
          setThemeState(savedTheme)
        } else {
          // Use defaultTheme instead of system preference for initial load
          // Only check system preference if no defaultTheme is provided
          let baseTheme: 'light' | 'dark' = 'light'
          
          if (defaultTheme === 'dark' || defaultTheme === 'admin_dark') {
            baseTheme = 'dark'
          } else if (defaultTheme === 'light' || defaultTheme === 'admin_light') {
            baseTheme = 'light'
          } else {
            // Always default to light theme - don't use system preference
            // This prevents browser dark mode from overriding our theme selection
            baseTheme = 'light'
          }
          
          // Apply admin mode if it was enabled
          const initialTheme = savedAdminMode ? `admin_${baseTheme}` as ThemeName : baseTheme
          setThemeState(initialTheme)
        }
        setIsInitialized(true)
      } catch (error) {
        // Fallback to default theme if localStorage fails
        console.warn('Failed to load theme from localStorage:', error)
        setThemeState(defaultTheme)
        setIsInitialized(true)
      }
    }
  }, [storageKey, adminStorageKey, isMounted, defaultTheme])
  
  // Save theme to localStorage when it changes
  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined' && isMounted) {
      try {
        localStorage.setItem(storageKey, theme)
        localStorage.setItem(adminStorageKey, isAdminTheme.toString())
      } catch (error) {
        console.warn('Failed to save theme to localStorage:', error)
      }
    }
  }, [theme, storageKey, adminStorageKey, isInitialized, isAdminTheme, isMounted])
  
  const setTheme = (newTheme: ThemeName) => {
    setThemeState(newTheme)
  }
  
  const toggleTheme = () => {
    const baseTheme = getBaseTheme()
    const newBaseTheme = baseTheme === 'light' ? 'dark' : 'light'
    const newTheme = isAdminTheme ? `admin_${newBaseTheme}` as ThemeName : newBaseTheme
    setTheme(newTheme)
  }
  
  const setAdminMode = (enabled: boolean) => {
    const baseTheme = getBaseTheme()
    const newTheme = enabled ? `admin_${baseTheme}` as ThemeName : baseTheme
    setTheme(newTheme)
  }
  
  return (
    <ThemeContext.Provider value={{ 
      theme, 
      setTheme, 
      toggleTheme, 
      isAdminTheme,
      getBaseTheme,
      setAdminMode
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

// Hook to get current theme from Tamagui
export const useCurrentTheme = () => {
  const themeName = useThemeName()
  if (themeName.includes('admin_dark')) return 'admin_dark'
  if (themeName.includes('admin_light')) return 'admin_light'
  return themeName.includes('dark') ? 'dark' : 'light'
}

// Hook to automatically enable admin theme based on user role
export const useAdminTheme = (userRole?: string) => {
  // Safe hook usage with error boundary
  try {
    const { setAdminMode, isAdminTheme } = useThemeContext()
    
    React.useEffect(() => {
      // Only run if we have a valid user role and theme context
      if (!userRole || !setAdminMode) return
      
      const shouldUseAdminTheme = userRole === 'admin' || userRole === 'owner'
      if (shouldUseAdminTheme && !isAdminTheme) {
        setAdminMode(true)
      } else if (!shouldUseAdminTheme && isAdminTheme) {
        setAdminMode(false)
      }
    }, [userRole, isAdminTheme, setAdminMode])
    
    return { isAdminTheme, setAdminMode }
  } catch (error) {
    // Fallback if theme context is not available
    console.warn('useAdminTheme called outside ThemeProvider context')
    return { 
      isAdminTheme: false, 
      setAdminMode: () => console.warn('Theme context not available') 
    }
  }
}