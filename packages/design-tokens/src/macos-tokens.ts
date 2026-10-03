// macOS-style design tokens for DGOS V1
// Implements the visual language from MACOS-UI-DESIGN-SPEC.md

/**
 * macOS Window Tokens
 * Defines dimensions and visual properties for window chrome
 */
export const macOSWindow = {
  titleBarHeight: '32px',
  borderRadius: '12px',
  minWidth: '400px',
  minHeight: '300px',
  defaultWidth: '800px',
  defaultHeight: '600px',
  shadow: '0 20px 60px rgba(0, 0, 0, 0.25)',
  shadowFocused: '0 24px 70px rgba(0, 0, 0, 0.3)',
  shadowUnfocused: '0 12px 40px rgba(0, 0, 0, 0.15)',
  borderLight: '1px solid rgba(0, 0, 0, 0.08)',
  borderDark: '1px solid rgba(255, 255, 255, 0.08)',
  backdropBlur: 'blur(20px) saturate(180%)',
  resizeHandleSize: '8px',
  resizeCornerSize: '12px',
  unfocusedOpacity: '0.95',
} as const;

/**
 * macOS Traffic Lights (Window Control Buttons)
 * Red, Yellow, Green buttons with exact macOS styling
 */
export const macOSTrafficLights = {
  size: '12px',
  spacing: '8px',
  offsetX: '12px',
  offsetY: '10px',
  colors: {
    close: '#FF5F56',
    closeHover: '#E64942',
    minimize: '#FFBD2E',
    minimizeHover: '#E5A824',
    maximize: '#27C93F',
    maximizeHover: '#1FB035',
  },
  symbolColor: '#00000080',
} as const;

/**
 * macOS Dock Tokens
 * Bottom-centered app launcher with magnification effects
 */
export const macOSDock = {
  height: '68px',
  borderRadius: '24px',
  iconSize: '48px',
  iconSizeHover: '58px',
  iconSpacing: '8px',
  bottomOffset: '8px',
  padding: '10px 16px',
  backgroundLight: 'rgba(255, 255, 255, 0.75)',
  backgroundDark: 'rgba(50, 50, 50, 0.85)',
  backdropBlur: 'blur(30px) saturate(180%)',
  shadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
  borderLight: '1px solid rgba(255, 255, 255, 0.2)',
  borderDark: '1px solid rgba(255, 255, 255, 0.05)',
  dividerWidth: '2px',
  dividerHeight: '40px',
  dividerColor: 'rgba(0, 0, 0, 0.15)',
  hoverScale: '1.21',
  hoverLift: '-8px',
  indicatorSize: '6px',
  indicatorColor: '#0F5FD9', // DGOS brand primary
  badgeSize: '18px',
  badgeBackground: '#ef4444',
  badgeTextSize: '11px',
} as const;

/**
 * macOS System Bar Tokens
 * Top bar with app name, search, and system controls
 */
export const macOSSystemBar = {
  height: '44px',
  backgroundLight: 'rgba(255, 255, 255, 0.8)',
  backgroundDark: 'rgba(30, 30, 30, 0.85)',
  backdropBlur: 'blur(20px) saturate(180%)',
  borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
  borderBottomDark: '1px solid rgba(255, 255, 255, 0.05)',
  logoSize: '32px',
  iconSize: '20px',
  iconSpacing: '12px',
  padding: '0 16px',
  fontSize: '14px',
  fontWeight: '600',
  textColor: 'var(--text)',
  mutedColor: 'var(--muted)',
} as const;

/**
 * macOS Launchpad Tokens
 * Full-screen app grid overlay
 */
export const macOSLaunchpad = {
  gridColumns: 7,
  gridRows: 5,
  iconSize: '64px',
  iconSpacing: '32px',
  iconVerticalSpacing: '40px',
  labelSize: '12px',
  labelMaxLines: 2,
  overlayBackground: 'rgba(0, 0, 0, 0.3)',
  backdropBlur: 'blur(40px)',
  searchHeight: '48px',
  searchWidth: '600px',
  pageIndicatorSize: '8px',
  pageIndicatorSpacing: '8px',
} as const;

/**
 * macOS Animation Tokens
 * Timing functions and durations for smooth, native-feeling animations
 */
export const macOSAnimations = {
  // Timing functions
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  enter: 'cubic-bezier(0, 0, 0.2, 1)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',

  // Durations (in ms)
  quick: 150,
  fast: 200,
  normal: 250,
  smooth: 300,
  slow: 400,

  // Specific animations
  windowOpen: '300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  windowClose: '200ms cubic-bezier(0.4, 0, 1, 1)',
  windowMinimize: '400ms cubic-bezier(0.4, 0, 0.2, 1)',
  dockHover: '300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  dockIconEntrance: '400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  launchpadOpen: '400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  launchpadClose: '300ms cubic-bezier(0.4, 0, 1, 1)',

  // Stagger delays
  iconStagger: 20, // ms between each icon
  dockStagger: 50,
} as const;

/**
 * macOS Glassmorphism Mixins
 * Reusable glass effect styles
 */
export const macOSGlass = {
  light: {
    background: 'rgba(255, 255, 255, 0.75)',
    backdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    shadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
  },
  dark: {
    background: 'rgba(30, 30, 30, 0.85)',
    backdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    shadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  },
} as const;

/**
 * macOS Z-Index Scale
 * Layering system for overlapping elements
 */
export const macOSZIndex = {
  base: 0,
  dock: 100,
  systemBar: 1000,
  window: 10, // Base z-index, increments per window
  windowIncrement: 1,
  dropdown: 50,
  modal: 200,
  launchpad: 500,
  tooltip: 1100,
  notification: 1200,
} as const;

/**
 * macOS Icon Tokens
 * Standardized icon sizing and spacing
 */
export const macOSIcons = {
  appIconSize: '48px',
  appIconRadius: '12px',
  systemIconSize: '20px',
  dockIconSize: '48px',
  launchpadIconSize: '64px',

  // Icon shadows and effects
  appIconShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
  appIconInnerShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.3)',

  // Icon states
  iconStrokeWidth: '2px',
  iconActiveScale: '0.95',
  iconDisabledOpacity: '0.4',
} as const;

/**
 * macOS Keyboard Shortcuts
 * Standard macOS keyboard conventions
 */
export const macOSKeyboardShortcuts = {
  commandPalette: '⌘K',
  closeWindow: '⌘W',
  minimizeWindow: '⌘M',
  quitApp: '⌘Q',
  newWindow: '⌘N',
  launchpad: 'F4',
  spotlight: '⌘Space',
  hideApp: '⌘H',
  switchApps: '⌘Tab',
  missionControl: 'Control+↑',
} as const;

/**
 * Complete macOS Token Export
 */
export const macOSTokens = {
  window: macOSWindow,
  trafficLights: macOSTrafficLights,
  dock: macOSDock,
  systemBar: macOSSystemBar,
  launchpad: macOSLaunchpad,
  animations: macOSAnimations,
  glass: macOSGlass,
  zIndex: macOSZIndex,
  icons: macOSIcons,
  shortcuts: macOSKeyboardShortcuts,
} as const;

export type MacOSTokens = typeof macOSTokens;
