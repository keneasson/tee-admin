import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useThemeName } from 'tamagui'

type ThemeContextType = {
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const useThemeContext = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider')
  }
  return context
}

export interface ThemeProviderProps {
  children: ReactNode
  defaultTheme?: 'light' | 'dark'
  storageKey?: string
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'light',
  storageKey = 'tee-theme',
}) => {
  const [theme, setThemeState] = useState<'light' | 'dark'>(defaultTheme)
  const [isInitialized, setIsInitialized] = useState(false)
  
  // Load theme from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem(storageKey) as 'light' | 'dark' | null
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
        setThemeState(savedTheme)
      } else {
        // Check system preference
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches 
          ? 'dark' 
          : 'light'
        setThemeState(systemTheme)
      }
      setIsInitialized(true)
    }
  }, [storageKey])
  
  // Save theme to localStorage when it changes
  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, theme)
    }
  }, [theme, storageKey, isInitialized])
  
  const setTheme = (newTheme: 'light' | 'dark') => {
    setThemeState(newTheme)
  }
  
  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }
  
  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// Hook to get current theme from Tamagui
export const useCurrentTheme = () => {
  const themeName = useThemeName()
  return themeName.includes('dark') ? 'dark' : 'light'
}