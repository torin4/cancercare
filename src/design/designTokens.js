/**
 * Design System Tokens
 * 
 * Centralized design values for consistent styling across the application.
 * These tokens should be used instead of hardcoded values to maintain design consistency.
 */
/**
 * ============================================
 * COLOR CONTRACT (LOCKED)
 * ============================================
 * 1) Anchor (charcoal) is the product frame.
 *    - Used for nav/app chrome, default text, borders, and PRIMARY actions.
 *    - Must remain neutral and stable across all tabs.
 *
 * 2) Primary actions are ANCHOR (dark), not module colors.
 *    - No screen may override the primary button color with tab colors.
 *
 * 3) Module colors are ACCENTS only (icons, small badges, thin active indicators).
 *    - Health accent: medical-primary (blue)
 *    - Chat accent: medical-secondary (teal)
 *    - Trials accent: care (green) (Trials identity + success highlights, NOT primary actions)
 *    - Files accent: medical-secondary (teal)
 *
 *    Screen base theme rule:
 *    - HealthTab / TrialsTab / FilesTab: may use their module accent in small accent slots only.
 *    - ChatTab / DashboardTab / ProfileTab: must remain anchor-first (aggregators).
 *
 * 4) Context coloring (e.g., Chat context filter) may tint banners/chips ONLY.
 *    - Context must NOT recolor nav, page chrome, primary buttons, or input focus.
 *
 * 5) Semantic colors keep their meaning:
 *    - Red = destructive/error
 *    - Amber = warning/urgent
 *    - Green (semantic) = success/normal status
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
    // Anchor (charcoal) palette (Tailwind anchor-*)
    anchor: {
      50: 'bg-anchor-50',
      100: 'bg-anchor-100',
      200: 'bg-anchor-200',
      300: 'bg-anchor-300',
      500: 'bg-anchor-500',
      600: 'bg-anchor-600',
      700: 'bg-anchor-700',
      800: 'bg-anchor-800',
      900: 'bg-anchor-900',
      950: 'bg-anchor-950',
      text: {
        50: 'text-anchor-50',
        100: 'text-anchor-100',
        200: 'text-anchor-200',
        300: 'text-anchor-300',
        500: 'text-anchor-500',
        600: 'text-anchor-600',
        700: 'text-anchor-700',
        800: 'text-anchor-800',
        900: 'text-anchor-900',
        950: 'text-anchor-950',
      },
      border: {
        200: 'border-anchor-200',
        300: 'border-anchor-300',
        700: 'border-anchor-700',
        800: 'border-anchor-800',
        900: 'border-anchor-900',
      },
    },
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
    
    // App Theme (Anchor chrome) - Used for navigation and app-level UI
    app: {
      50: 'bg-anchor-50',
      100: 'bg-anchor-100',
      200: 'bg-anchor-200',
      300: 'bg-anchor-300',
      500: 'bg-anchor-500',
      600: 'bg-anchor-600',
      700: 'bg-anchor-700',
      800: 'bg-anchor-800',
      900: 'bg-anchor-900',
      950: 'bg-anchor-950',
      text: {
        50: 'text-anchor-50',
        100: 'text-anchor-100',
        200: 'text-anchor-200',
        300: 'text-anchor-300',
        500: 'text-anchor-500',
        600: 'text-anchor-600',
        700: 'text-anchor-700',
        800: 'text-anchor-800',
        900: 'text-anchor-900',
        950: 'text-anchor-950',
      },
      border: {
        200: 'border-anchor-200',
        300: 'border-anchor-300',
        700: 'border-anchor-700',
        800: 'border-anchor-800',
      },
    },
  },
  // ============================================
  // SCREEN BASE THEMES
  // ============================================
  // Aggregator screens must remain anchor-first (they pull content from multiple modules).
  screenBaseTheme: {
    health: 'module',
    trials: 'module',
    files: 'module',
    chat: 'anchor',
    dashboard: 'anchor',
    profile: 'anchor',
  },

  // ============================================
  // MODULE ACCENT COLORS (Accent-only, NOT full themes)
  // ============================================
  moduleAccent: {
    health: {
      bg: 'bg-medical-primary-50',
      text: 'text-medical-primary-600',
      border: 'border-medical-primary-600',
    },
    chat: {
      bg: 'bg-medical-secondary-50',
      text: 'text-medical-secondary-600',
      border: 'border-medical-secondary-600',
    },
    trials: {
      bg: 'bg-care-400/15',
      text: 'text-care-600',
      border: 'border-care-600',
    },
    files: {
      bg: 'bg-medical-secondary-50',
      text: 'text-medical-secondary-600',
      border: 'border-medical-secondary-600',
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
      color: 'text-anchor-900',
      marginBottom: 'mb-0.5 sm:mb-1',
      complete: 'text-xl sm:text-2xl md:text-3xl font-bold text-anchor-900 mb-0.5 sm:mb-1',
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
      color: 'text-anchor-900',
    },
    
    // Body Text
    body: {
      xs: 'text-xs',
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
    
    color: {
      default: 'border-medical-neutral-200',
    },
    
    // Common border combinations
    card: 'border border-medical-neutral-200',
    divider: 'border-b border-medical-neutral-200',
    active: 'border-b-2 border-anchor-900',
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
      iconContainer: 'bg-anchor-100 p-2 sm:p-2.5 rounded-lg',
      icon: 'w-5 h-5 sm:w-6 sm:h-6 text-anchor-900',
      title: 'text-xl sm:text-2xl md:text-3xl font-bold text-anchor-900 mb-0.5 sm:mb-1',
    },
    
    // Tab Navigation
    tabs: {
      container: 'flex gap-1 sm:gap-4 mb-4 sm:mb-6 overflow-x-auto',
      button: {
        base: 'pb-3 px-2 sm:px-4 font-medium transition-all duration-200 flex items-center gap-1 sm:gap-2 min-h-[44px] touch-manipulation active:opacity-70 whitespace-nowrap flex-shrink-0',
        active: 'text-anchor-900 border-b-2 border-anchor-900',
        inactive: 'text-medical-neutral-600 hover:text-anchor-900',
      },
    },
    
    // Button Styles
    button: {
      primary: 'bg-anchor-900 text-white rounded-lg hover:bg-anchor-800 transition-colors font-medium min-h-[44px] touch-manipulation active:opacity-70 cursor-pointer',
      secondary: 'bg-white text-anchor-900 rounded-lg hover:bg-anchor-50 transition font-medium border border-anchor-300 min-h-[44px] touch-manipulation active:opacity-70 cursor-pointer',
      iconButton: 'bg-white text-anchor-900 px-3 sm:px-6 py-2.5 rounded-lg hover:bg-anchor-50 transition font-medium flex items-center gap-2 shadow-sm border border-anchor-300 min-h-[44px] touch-manipulation active:opacity-70 flex-shrink-0 cursor-pointer',
      outline: {
        primary: 'border-2 border-anchor-900 text-anchor-900 rounded-lg hover:bg-anchor-50 transition font-medium min-h-[44px] touch-manipulation active:opacity-70 flex items-center justify-center gap-2 cursor-pointer',
        accent: 'border-2 border-medical-accent-500 text-medical-accent-600 rounded-lg hover:bg-medical-accent-50 transition font-medium min-h-[44px] touch-manipulation active:opacity-70 flex items-center justify-center gap-2 cursor-pointer',
        neutral: 'border-2 border-medical-neutral-500 text-medical-neutral-700 rounded-lg hover:bg-medical-neutral-50 transition font-medium min-h-[44px] touch-manipulation active:opacity-70 flex items-center justify-center gap-2 cursor-pointer',
      },
      // Small chip/action buttons
      chip: {
        base: 'px-3 py-1.5 text-white text-xs rounded-full transition-colors flex items-center gap-1 min-h-[32px] touch-manipulation active:opacity-90',
        primary: 'bg-anchor-900 hover:bg-anchor-800',
        accent: 'bg-medical-accent-500 hover:bg-medical-accent-600',
        success: 'bg-green-500 hover:bg-green-600',
        purple: 'bg-purple-500 hover:bg-purple-600',
      },
    },
    
    // Card
    card: {
      // Primary cards (top level)
      container: 'bg-white rounded-lg sm:rounded-xl shadow-sm p-4 sm:p-5 border-2 border-medical-neutral-200',
      containerLarge: 'bg-white rounded-lg sm:rounded-xl shadow-sm p-4 sm:p-5 md:p-6 border-2 border-medical-neutral-200',
      hover: 'hover:shadow-md transition-shadow',
      interactive: 'cursor-pointer hover:border-medical-neutral-300',
      // Colored border variants
      withColoredBorder: (borderColor) => `bg-white rounded-lg sm:rounded-xl shadow-sm p-4 sm:p-5 border-2 ${borderColor}`,
      withColoredBorderLarge: (borderColor) => `bg-white rounded-lg sm:rounded-xl shadow-sm p-4 sm:p-5 md:p-6 border-2 ${borderColor}`,
      // Nested cards (within other cards - lighter styling)
      nested: 'bg-white rounded-lg p-3 border border-medical-neutral-200',
      nestedLarge: 'bg-white rounded-lg p-4 border border-medical-neutral-200',
      nestedWithShadow: 'bg-white rounded-lg shadow p-3 sm:p-4 border border-medical-neutral-200',
      nestedSubtle: 'bg-medical-neutral-50 rounded-lg p-2.5 sm:p-3 border border-medical-neutral-200',
      nestedSubtleLarge: 'bg-medical-neutral-50 rounded-lg p-4 border border-medical-neutral-200',
    },
    
    // Modal
    modal: {
      backdrop: 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4',
      container: 'bg-white w-full h-full md:h-auto md:rounded-xl md:max-w-md md:max-h-[90vh] overflow-hidden flex flex-col animate-slide-up',
      header: 'flex-shrink-0 bg-white border-b border-anchor-200 p-4 flex items-center justify-between',
      title: 'text-lg font-semibold text-anchor-900',
      closeButton: 'text-anchor-400 hover:text-anchor-700 transition',
      body: 'flex-1 overflow-y-auto p-4 sm:p-6',
      footer: 'flex-shrink-0 border-t border-anchor-200 p-4 bg-white',
    },
    
    // Form Inputs
    input: {
      base: 'w-full px-4 py-2.5 border border-medical-neutral-200 rounded-xl text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-anchor-900 focus:border-anchor-900 transition-all duration-200',
      disabled: 'bg-gray-100 cursor-not-allowed',
      textarea: 'resize-none',
      withIcon: 'pl-10',
    },
    
    // Select Dropdowns
    select: {
      base: 'px-2 sm:px-3 pr-12 sm:pr-14 py-2 sm:py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-offset-0 focus:ring-anchor-900 focus:border-anchor-900 transition-all duration-200 bg-white',
      // pr-12 sm:pr-14 ensures native chevron has generous spacing from right edge
      // Note: appearance-none removed to keep native browser chevron visible
    },
    
    // Loading States
    loading: {
      overlay: 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50',
      container: 'bg-white rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl',
      spinner: 'w-16 h-16 bg-anchor-100 rounded-full flex items-center justify-center mx-auto mb-4',
      spinnerIcon: 'w-8 h-8 text-anchor-900 animate-spin',
      title: 'text-xl font-bold text-anchor-900 mb-2',
      message: 'text-anchor-600',
    },
    
    // Empty States
    emptyState: {
      container: 'bg-white rounded-lg sm:rounded-xl p-4 sm:p-6 md:p-8 text-center',
      iconContainer: 'w-12 h-12 sm:w-16 sm:h-16 bg-anchor-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4',
      icon: 'w-6 h-6 sm:w-8 sm:h-8 text-gray-400',
      title: 'text-base sm:text-lg font-semibold text-anchor-900 mb-1.5 sm:mb-2',
      message: 'text-xs sm:text-sm text-anchor-600 mb-4 sm:mb-6',
      actions: 'flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center',
    },
    
    // Alert/Banner Patterns
    alert: {
      success: 'bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4',
      error: 'bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4',
      warning: 'bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4',
      info: 'bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4',
      text: {
        success: 'text-green-800',
        error: 'text-red-800',
        warning: 'text-yellow-800',
        info: 'text-blue-800',
      },
    },
    
    // Chat Message Bubbles
    chat: {
      userBubble: 'bg-anchor-900 text-white rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5',
      aiBubble: 'bg-white border border-medical-neutral-200 text-anchor-900 rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5',
      analysisBubble: 'bg-anchor-100 border border-anchor-200 text-anchor-800 rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5',
      avatar: 'w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-anchor-900 to-anchor-700 flex items-center justify-center shadow-sm',
    },
    
    // Status Indicators
    status: {
      normal: {
        bg: 'bg-green-50',
        text: 'text-green-600',
        border: 'border-green-200',
        icon: 'text-green-600',
      },
      high: {
        bg: 'bg-red-50',
        text: 'text-red-600',
        border: 'border-red-200',
        icon: 'text-red-600',
      },
      low: {
        bg: 'bg-yellow-50',
        text: 'text-yellow-600',
        border: 'border-yellow-200',
        icon: 'text-yellow-600',
      },
    },
    
    // Favorite/Star Icon
    favorite: {
      filled: 'fill-yellow-400 text-yellow-500 stroke-yellow-600 stroke-1',
      unfilled: 'text-yellow-500 stroke-yellow-600 stroke-1',
      border: 'border-yellow-600',
    },
  },
  
  // ============================================
  // Z-INDEX LAYERS
  // ============================================
  zIndex: {
    base: 0,
    dropdown: 10,
    sticky: 20,
    overlay: 30,
    modal: 50,
    tooltip: 70,
    notification: 100,
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

