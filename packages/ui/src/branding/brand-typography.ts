// Typography definitions based on current Tamagui config
export const brandTypography = {
  // Heading styles
  headings: {
    h1: {
      fontSize: '$10', // ~48px
      lineHeight: '$10',
      fontWeight: '700',
      letterSpacing: -2,
      fontFamily: '$heading',
    },
    h2: {
      fontSize: '$9', // ~36px  
      lineHeight: '$9',
      fontWeight: '700',
      letterSpacing: -1,
      fontFamily: '$heading',
    },
    h3: {
      fontSize: '$8', // ~28px
      lineHeight: '$8', 
      fontWeight: '600',
      letterSpacing: -0.5,
      fontFamily: '$heading',
    },
    h4: {
      fontSize: '$7', // ~24px
      lineHeight: '$7',
      fontWeight: '600', 
      letterSpacing: 0,
      fontFamily: '$heading',
    },
    h5: {
      fontSize: '$6', // ~20px
      lineHeight: '$6',
      fontWeight: '600',
      letterSpacing: 0,
      fontFamily: '$heading',
    },
    h6: {
      fontSize: '$5', // ~18px
      lineHeight: '$5',
      fontWeight: '600',
      letterSpacing: 1,
      fontFamily: '$heading',
      textTransform: 'uppercase',
    }
  },
  
  // Body text styles
  body: {
    large: {
      fontSize: '$5', // ~18px
      lineHeight: '$6', // ~28px
      fontWeight: '400',
      fontFamily: '$body',
    },
    base: {
      fontSize: '$4', // ~16px  
      lineHeight: '$5', // ~24px
      fontWeight: '400',
      fontFamily: '$body',
    },
    small: {
      fontSize: '$3', // ~14px
      lineHeight: '$4', // ~20px
      fontWeight: '400', 
      fontFamily: '$body',
    },
    // Additional body variants found in codebase
    emphasized: {
      fontSize: '$4',
      lineHeight: '$5',
      fontWeight: '600',
      fontFamily: '$body',
    },
    subtle: {
      fontSize: '$3',
      lineHeight: '$4', 
      fontWeight: '400',
      fontFamily: '$body',
      color: '$textSecondary',
    }
  },
  
  // Utility text styles
  utility: {
    caption: {
      fontSize: '$2', // ~12px
      lineHeight: '$3', // ~16px
      fontWeight: '400',
      fontFamily: '$body',
      color: '$textTertiary',
    },
    label: {
      fontSize: '$3', // ~14px
      lineHeight: '$4', // ~20px 
      fontWeight: '500',
      fontFamily: '$body',
    },
    code: {
      fontSize: '$3',
      lineHeight: '$4',
      fontWeight: '400',
      fontFamily: '$mono',
      backgroundColor: '$backgroundSecondary',
      padding: '$1',
      borderRadius: '$2',
    },
    link: {
      fontSize: '$4',
      lineHeight: '$5',
      fontWeight: '400',
      fontFamily: '$body',
      color: '$interactive',
      textDecorationLine: 'underline',
    }
  },
  
  // Interactive text styles
  interactive: {
    button: {
      fontSize: '$4',
      lineHeight: '$4',
      fontWeight: '600',
      fontFamily: '$body',
    },
    buttonSmall: {
      fontSize: '$3', 
      lineHeight: '$3',
      fontWeight: '600',
      fontFamily: '$body',
    },
    buttonLarge: {
      fontSize: '$5',
      lineHeight: '$5', 
      fontWeight: '600',
      fontFamily: '$body',
    }
  }
} as const

export type TypographyVariant = keyof typeof brandTypography
export type HeadingVariant = keyof typeof brandTypography.headings  
export type BodyVariant = keyof typeof brandTypography.body
export type UtilityVariant = keyof typeof brandTypography.utility
export type InteractiveVariant = keyof typeof brandTypography.interactive