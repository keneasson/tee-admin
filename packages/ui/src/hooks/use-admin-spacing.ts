import { useThemeContext } from '../theme-provider'

// Admin-specific design tokens - inline to avoid import issues
const adminTokens = {
  spacing: {
    xs: '$1',
    sm: '$2', 
    md: '$3',
    lg: '$4',
    xl: '$5',
  },
  form: {
    sectionPadding: '$3',
    itemSpacing: '$2',
    fieldSpacing: '$2',
    groupSpacing: '$2',
  },
  card: {
    padding: '$3',
    spacing: '$2',
    nestedPadding: '$3',
  },
  typography: {
    sizes: {
      xs: '$2',
      sm: '$3',
      md: '$4',
      lg: '$5',
      xl: '$6',
      xxl: '$7',
    },
  },
  interactive: {
    buttonSizeSmall: '$2',
    buttonSizeMedium: '$3',
    buttonSizeLarge: '$4',
    iconSize: '$1',
    iconSizeSmall: '$0.75',
  },
} as const

const getAdminSpacing = (isAdminTheme: boolean) => ({
  sectionPadding: isAdminTheme ? adminTokens.form.sectionPadding : '$4',
  itemSpacing: isAdminTheme ? adminTokens.form.itemSpacing : '$4',
  cardPadding: isAdminTheme ? adminTokens.card.padding : '$4',
  cardSpacing: isAdminTheme ? adminTokens.card.spacing : '$4',
})

/**
 * Hook that returns theme-aware spacing values
 * Automatically switches between standard and admin spacing based on current theme
 */
export const useAdminSpacing = () => {
  const { isAdminTheme } = useThemeContext()
  
  return {
    // Basic spacing
    ...getAdminSpacing(isAdminTheme),
    
    // Raw admin tokens (always admin values)
    admin: adminTokens,
    
    // Conditional spacing helpers
    spacing: (adminValue: string, standardValue: string = '$4') => 
      isAdminTheme ? adminValue : standardValue,
    
    // Common patterns
    formSection: {
      padding: isAdminTheme ? adminTokens.form.sectionPadding : '$4',
      space: isAdminTheme ? adminTokens.form.itemSpacing : '$4',
    },
    
    card: {
      padding: isAdminTheme ? adminTokens.card.padding : '$4',
      space: isAdminTheme ? adminTokens.card.spacing : '$4',
    },
    
    // Typography
    text: {
      size: isAdminTheme ? adminTokens.typography.sizes.md : '$4',
      headerSize: isAdminTheme ? adminTokens.typography.sizes.lg : '$5',
      titleSize: isAdminTheme ? adminTokens.typography.sizes.xl : '$6',
    },
    
    // Interactive elements
    button: {
      size: isAdminTheme ? adminTokens.interactive.buttonSizeMedium : '$3',
      iconSize: isAdminTheme ? adminTokens.interactive.iconSize : '$1',
    },
    
    // Boolean flag for manual conditionals
    isAdminTheme,
  }
}

/**
 * Simplified hook for just getting spacing values
 */
export const useSpacing = () => {
  const { isAdminTheme } = useThemeContext()
  return getAdminSpacing(isAdminTheme)
}