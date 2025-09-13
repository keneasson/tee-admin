import { useMedia } from 'tamagui'

/**
 * Hook for consistent admin UI spacing across different screen sizes
 * Returns responsive spacing values for admin interfaces
 */
export function useAdminSpacing() {
  const media = useMedia()
  
  // Mobile-first responsive values
  const isMobile = media.sm
  const isTablet = media.md && !media.lg
  const isDesktop = media.lg
  
  return {
    card: {
      padding: isMobile ? '$3' : isTablet ? '$4' : '$5',
      space: isMobile ? '$2' : isTablet ? '$3' : '$4',
    },
    text: {
      headerSize: isMobile ? '$5' : isTablet ? '$6' : '$7',
      labelSize: isMobile ? '$3' : '$4',
      bodySize: isMobile ? '$3' : '$4',
    },
    button: {
      iconSize: isMobile ? 16 : isTablet ? 20 : 24,
      padding: isMobile ? '$2' : isTablet ? '$3' : '$4',
      height: isMobile ? '$3' : isTablet ? '$4' : '$5',
    },
    form: {
      inputHeight: isMobile ? '$4' : '$5',
      labelSpace: isMobile ? '$1' : '$2',
      fieldSpace: isMobile ? '$3' : '$4',
    },
    layout: {
      sidebarWidth: isMobile ? '100%' : isTablet ? '280px' : '320px',
      contentMaxWidth: isMobile ? '100%' : isTablet ? '768px' : '1200px',
      sectionSpace: isMobile ? '$4' : isTablet ? '$6' : '$8',
    }
  }
}