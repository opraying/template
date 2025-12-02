/**
 * Layout constants for consistent styling across all layout components
 */

// Spacing constants
export const LAYOUT_SPACING = {
  /** Standard padding for containers */
  container: 'px-4',
  /** Header height for sticky headers */
  headerHeight: '50px',
  /** Sidebar width for desktop */
  sidebarWidth: '260px',
  /** Mobile tabbar height */
  tabbarHeight: '49px',
  /** Safe area insets */
  safeArea: {
    top: 'pt-[max(16px,env(safe-area-inset-top))]',
    bottom: 'pb-[max(24px,env(safe-area-inset-bottom))]',
    left: 'pl-[env(safe-area-inset-left)]',
    right: 'pr-[env(safe-area-inset-right)]',
  },
} as const

// Z-index layers for consistent stacking
export const Z_INDEX = {
  /** Main content layer */
  content: 'z-0',
  /** Overlay elements like dropdowns */
  overlay: 'z-10',
  /** Modal dialogs */
  modal: 'z-40',
  /** Fixed positioned elements like headers */
  fixed: 'z-50',
  /** Drawers and sidebars */
  drawer: 'z-50',
  /** Tooltips and highest priority overlays */
  tooltip: 'z-60',
} as const

// Animation constants
export const ANIMATIONS = {
  /** Standard transition duration */
  duration: 'duration-200',
  /** Easing function for smooth animations */
  easing: 'ease-out',
  /** Hover scale effect */
  hoverScale: 'hover:scale-105',
  /** Active scale effect */
  activeScale: 'active:scale-95',
  /** Fade in animation */
  fadeIn: 'animate-in fade-in',
  /** Slide in from left */
  slideInLeft: 'animate-in slide-in-from-left',
  /** Slide in from right */
  slideInRight: 'animate-in slide-in-from-right',
} as const

// Color scheme constants using CSS variables
export const COLORS = {
  sidebar: {
    background: 'bg-[hsl(var(--sidebar-background))]',
    foreground: 'text-[hsl(var(--sidebar-foreground))]',
    accent: 'bg-[hsl(var(--sidebar-accent))]',
    border: 'border-[hsl(var(--sidebar-border))]',
  },
  surface: {
    background: 'bg-background',
    foreground: 'text-foreground',
    muted: 'bg-muted',
    mutedForeground: 'text-muted-foreground',
    accent: 'bg-accent',
    accentForeground: 'text-accent-foreground',
  },
  interactive: {
    hover: 'hover:bg-muted/50',
    active: 'active:bg-muted/80',
    focus: 'focus:ring-2 focus:ring-accent/50 focus:ring-inset',
    disabled: 'opacity-50 cursor-not-allowed pointer-events-none',
  },
} as const

// Common component class patterns
export const COMPONENT_CLASSES = {
  /** Standard button-like interactive element */
  button: [
    'transition-all',
    ANIMATIONS.duration,
    ANIMATIONS.easing,
    COLORS.interactive.hover,
    COLORS.interactive.active,
    COLORS.interactive.focus,
    'touch-manipulation',
    'select-none',
    'focus:outline-none',
  ].join(' '),

  /** Scrollable container with custom scrollbars */
  scrollable: [
    'overflow-y-auto',
    'overscroll-none',
    'scrollbar-thin',
    'scrollbar-track-transparent',
    'scrollbar-thumb-muted-foreground/20',
    'hover:scrollbar-thumb-muted-foreground/40',
  ].join(' '),

  /** Glass morphism effect for overlays */
  glass: ['backdrop-blur-sm', 'bg-background/95'].join(' '),

  /** Card-like container */
  card: ['bg-background', 'border', 'border-border/20', 'rounded-lg', 'overflow-hidden'].join(' '),

  /** Sticky header */
  get stickyHeader() {
    return ['sticky', 'top-0', Z_INDEX.fixed, 'flex-shrink-0', this.glass, 'border-b'].join(' ')
  },
} as const

// Responsive breakpoint helpers
export const RESPONSIVE = {
  /** Hide on mobile, show on desktop */
  desktopOnly: 'hidden lg:block',
  /** Show on mobile, hide on desktop */
  mobileOnly: 'block lg:hidden',
  /** Different layouts for mobile vs desktop */
  responsive: {
    mobile: 'lg:hidden',
    desktop: 'hidden lg:block',
  },
} as const

// Test ID patterns for consistent testing
export const TEST_IDS = {
  layout: 'app-layout',
  header: 'app-header',
  sidebar: 'app-sidebar',
  content: 'app-content',
  mobileLayout: 'mobile-app-layout',
  settingsDetail: 'mobile-settings-detail',
  settingsList: 'mobile-settings-list',
  backButton: 'mobile-settings-back-button',
} as const
