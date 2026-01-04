/**
 * Design System Tokens
 * 
 * Centralized design values for consistent styling across the application.
 * These tokens should be used instead of hardcoded values to maintain design consistency.
 */

export const DesignTokens = {
  // ============================================
  // SPACING & SIZING
  // ============================================
  spacing: {
    // Container Padding
    container: {
      mobile: 'p-3',
      tablet: 'sm:p-4',
      desktop: 'md:p-6',
      full: 'p-3 sm:p-4 md:p-6',
    },
    
    // Section Spacing (margin-bottom)
    section: {
      mobile: 'mb-4',
      tablet: 'sm:mb-6',
      full: 'mb-4 sm:mb-6',
    },
    
    // Header Spacing (margin-bottom)
    header: {
      mobile: 'mb-4',
      tablet: 'sm:mb-6',
      full: 'mb-4 sm:mb-6',
    },
    
    // Gap Spacing
    gap: {
      xs: 'gap-1',
      sm: 'gap-2',
      md: 'gap-3',
      lg: 'gap-4',
      responsive: {
        xs: 'gap-1 sm:gap-4',
        sm: 'gap-2 sm:gap-3',
        md: 'gap-3 sm:gap-4',
      },
    },
    
    // Icon Container Padding
    iconContainer: {
      mobile: 'p-2',
      tablet: 'sm:p-2.5',
      full: 'p-2 sm:p-2.5',
    },
    
    // Button Padding
    button: {
      mobile: 'px-3 sm:px-4',
      desktop: 'px-4 sm:px-6',
      full: 'px-4 sm:px-6',
      iconOnly: 'px-3 sm:px-6',
    },
    
    // Card Padding
    card: {
      mobile: 'p-3 sm:p-4',
      desktop: 'p-3 sm:p-4 md:p-5',
      full: 'p-3 sm:p-4 md:p-5',
    },
    
    // Minimum Touch Target
    touchTarget: 'min-h-[44px]',
  },

  // ============================================
  // COLORS
  // ============================================
  colors: {
    primary: {
      50: 'bg-medical-primary-50',
      100: 'bg-medical-primary-100',
      200: 'bg-medical-primary-200',
      500: 'bg-medical-primary-500',
      600: 'bg-medical-primary-600',
      700: 'bg-medical-primary-700',
      text: {
        50: 'text-medical-primary-50',
        100: 'text-medical-primary-100',
        200: 'text-medical-primary-200',
        500: 'text-medical-primary-500',
        600: 'text-medical-primary-600',
        700: 'text-medical-primary-700',
      },
      border: {
        200: 'border-medical-primary-200',
        600: 'border-medical-primary-600',
      },
    },
    
    accent: {
      50: 'bg-medical-accent-50',
      100: 'bg-medical-accent-100',
      200: 'bg-medical-accent-200',
      300: 'bg-medical-accent-300',
      500: 'bg-medical-accent-500',
      600: 'bg-medical-accent-600',
      700: 'bg-medical-accent-700',
      text: {
        50: 'text-medical-accent-50',
        100: 'text-medical-accent-100',
        200: 'text-medical-accent-200',
        300: 'text-medical-accent-300',
        500: 'text-medical-accent-500',
        600: 'text-medical-accent-600',
        700: 'text-medical-accent-700',
      },
      border: {
        200: 'border-medical-accent-200',
        300: 'border-medical-accent-300',
        600: 'border-medical-accent-600',
      },
    },
    
    neutral: {
      50: 'bg-medical-neutral-50',
      100: 'bg-medical-neutral-100',
      200: 'bg-medical-neutral-200',
      300: 'bg-medical-neutral-300',
      500: 'bg-medical-neutral-500',
      600: 'bg-medical-neutral-600',
      700: 'bg-medical-neutral-700',
      900: 'bg-medical-neutral-900',
      text: {
        50: 'text-medical-neutral-50',
        100: 'text-medical-neutral-100',
        200: 'text-medical-neutral-200',
        300: 'text-medical-neutral-300',
        500: 'text-medical-neutral-500',
        600: 'text-medical-neutral-600',
        700: 'text-medical-neutral-700',
        900: 'text-medical-neutral-900',
      },
      border: {
        200: 'border-medical-neutral-200',
        300: 'border-medical-neutral-300',
      },
    },
  },

  // ============================================
  // TYPOGRAPHY
  // ============================================
  typography: {
    // Headings
    h1: {
      mobile: 'text-xl',
      tablet: 'sm:text-2xl',
      desktop: 'md:text-3xl',
      full: 'text-xl sm:text-2xl md:text-3xl',
      weight: 'font-bold',
      color: 'text-medical-neutral-900',
      marginBottom: 'mb-0.5 sm:mb-1',
      complete: 'text-xl sm:text-2xl md:text-3xl font-bold text-medical-neutral-900 mb-0.5 sm:mb-1',
    },
    
    h2: {
      mobile: 'text-lg',
      tablet: 'sm:text-xl',
      desktop: 'md:text-2xl',
      full: 'text-lg sm:text-xl md:text-2xl',
      weight: 'font-semibold',
    },
    
    h3: {
      mobile: 'text-sm',
      tablet: 'sm:text-base',
      desktop: 'md:text-lg',
      full: 'text-sm sm:text-base md:text-lg',
      weight: 'font-semibold',
      color: 'text-medical-neutral-900',
    },
    
    // Body Text
    body: {
      sm: 'text-xs sm:text-sm',
      base: 'text-sm sm:text-base',
      lg: 'text-base sm:text-lg',
    },
  },

  // ============================================
  // ICONS
  // ============================================
  icons: {
    // Header Icon
    header: {
      size: {
        mobile: 'w-5 h-5',
        tablet: 'sm:w-6 sm:h-6',
        full: 'w-5 h-5 sm:w-6 sm:h-6',
      },
    },
    
    // Standard Icon
    standard: {
      size: {
        mobile: 'w-4 h-4',
        tablet: 'sm:w-5 sm:h-5',
        full: 'w-4 h-4 sm:w-5 sm:h-5',
      },
    },
    
    // Small Icon
    small: {
      size: {
        mobile: 'w-3.5 h-3.5',
        tablet: 'sm:w-4 sm:h-4',
        full: 'w-3.5 h-3.5 sm:w-4 sm:h-4',
      },
    },
    
    // Button Icon (with text)
    button: {
      size: {
        mobile: 'w-4 h-4',
        tablet: 'sm:w-5 sm:h-5',
        full: 'w-4 h-4 sm:w-5 sm:h-5',
      },
    },
  },

  // ============================================
  // BORDERS & RADIUS
  // ============================================
  borders: {
    radius: {
      sm: 'rounded-lg',
      md: 'rounded-xl',
      lg: 'rounded-2xl',
      full: 'rounded-full',
    },
    
    width: {
      default: 'border',
      thick: 'border-2',
    },
    
    // Common border combinations
    card: 'border border-medical-neutral-200',
    divider: 'border-b border-medical-neutral-200',
    active: 'border-b-2 border-medical-primary-600',
  },

  // ============================================
  // SHADOWS
  // ============================================
  shadows: {
    sm: 'shadow-sm',
    md: 'shadow',
    lg: 'shadow-md',
    hover: 'hover:shadow-md',
  },

  // ============================================
  // COMMON COMPONENT STYLES
  // ============================================
  components: {
    // Header Container
    header: {
      container: 'mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3',
      iconContainer: 'bg-medical-primary-50 p-2 sm:p-2.5 rounded-lg',
      icon: 'w-5 h-5 sm:w-6 sm:h-6 text-medical-primary-600',
      title: 'text-xl sm:text-2xl md:text-3xl font-bold text-medical-neutral-900 mb-0.5 sm:mb-1',
    },
    
    // Tab Navigation
    tabs: {
      container: 'flex gap-1 sm:gap-4 mb-4 sm:mb-6 border-b border-medical-neutral-200 overflow-x-auto',
      button: {
        base: 'pb-3 px-2 sm:px-4 font-medium transition-all duration-200 flex items-center gap-1 sm:gap-2 min-h-[44px] touch-manipulation active:opacity-70 whitespace-nowrap flex-shrink-0',
        active: 'text-medical-primary-600 border-b-2 border-medical-primary-600',
        inactive: 'text-medical-neutral-600 hover:text-medical-primary-600',
      },
    },
    
    // Button Styles
    button: {
      primary: 'bg-medical-primary-500 text-white rounded-lg hover:bg-medical-primary-600 transition-colors font-medium min-h-[44px] touch-manipulation active:opacity-70',
      secondary: 'bg-medical-primary-50 text-medical-primary-600 rounded-lg hover:bg-medical-primary-100 transition font-medium border border-medical-primary-200 min-h-[44px] touch-manipulation active:opacity-70',
      iconButton: 'bg-medical-primary-50 text-medical-primary-600 px-3 sm:px-6 py-2.5 rounded-lg hover:bg-medical-primary-100 transition font-medium flex items-center gap-2 shadow-sm border border-medical-primary-200 min-h-[44px] touch-manipulation active:opacity-70 flex-shrink-0',
    },
    
    // Card
    card: {
      container: 'bg-white rounded-lg shadow p-3 sm:p-4 md:p-5 border border-medical-neutral-200',
    },
  },

  // ============================================
  // BREAKPOINTS (Tailwind defaults)
  // ============================================
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },

  // ============================================
  // TRANSITIONS
  // ============================================
  transitions: {
    default: 'transition-colors',
    all: 'transition-all duration-200',
    fast: 'transition-all duration-150',
    slow: 'transition-all duration-300',
  },
};

/**
 * Helper function to combine multiple class strings
 */
export const combineClasses = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

/**
 * Common layout patterns
 */
export const Layouts = {
  container: combineClasses(
    DesignTokens.spacing.container.full
  ),
  
  header: combineClasses(
    DesignTokens.components.header.container,
  ),
  
  headerIcon: combineClasses(
    DesignTokens.components.header.iconContainer,
  ),
  
  headerTitle: combineClasses(
    DesignTokens.components.header.title,
  ),
  
  section: combineClasses(
    DesignTokens.spacing.section.full
  ),
  
  tabsContainer: combineClasses(
    DesignTokens.components.tabs.container
  ),
};

