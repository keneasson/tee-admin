import React, { useEffect, useState, ReactNode } from 'react'
import { TamaguiProvider, TamaguiProviderProps, Theme } from 'tamagui'
import { useThemeContext } from './theme-provider'

export interface ThemeAwareProviderProps extends Omit<TamaguiProviderProps, 'defaultTheme'> {
  children: ReactNode
}

export const ThemeAwareProvider: React.FC<ThemeAwareProviderProps> = ({ 
  children, 
  ...props 
}) => {
  const { theme } = useThemeContext()
  
  return (
    <TamaguiProvider {...props} defaultTheme={theme}>
      <Theme name={theme}>
        {children}
      </Theme>
    </TamaguiProvider>
  )
}