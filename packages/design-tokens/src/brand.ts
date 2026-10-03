// DGOS Brand Identity Tokens
// Independent brand expression for DGOS as an application operating system
// Target: Developers, creators, enterprises
// Qualities: Professional, efficient, scalable

/**
 * DGOS Brand Colors
 *
 * Primary: Deep Ocean Blue (#0F5FD9 → #5B9EFF)
 * - Represents depth, reliability, and technical precision
 * - Distinct from generic blues, has more depth and sophistication
 * - Works well for developer/enterprise tools
 *
 * Secondary: Electric Teal (#06B6D4 → #22D3EE)
 * - Represents innovation, efficiency, and modern technology
 * - Complements primary, adds energy and dynamism
 *
 * Accent: Amber (#F59E0B → #FFC759)
 * - Highlights important actions and success states
 * - Warm counterpoint to cool primaries
 */

export const brandColors = {
  // Primary brand color - Deep Ocean Blue
  primary: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',  // Base primary
    600: '#0F5FD9',  // DGOS primary (light mode)
    700: '#1E40AF',
    800: '#1E3A8A',
    900: '#1E293B',
  },

  // Secondary brand color - Electric Teal
  secondary: {
    50: '#ECFEFF',
    100: '#CFFAFE',
    200: '#A5F3FC',
    300: '#67E8F9',
    400: '#22D3EE',  // DGOS secondary (dark mode)
    500: '#06B6D4',  // DGOS secondary (light mode)
    600: '#0891B2',
    700: '#0E7490',
    800: '#155E75',
    900: '#164E63',
  },

  // Accent color - Amber
  accent: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',  // DGOS accent (light mode)
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
  },
} as const;

/**
 * DGOS Brand Typography
 *
 * Primary: Inter + SF Pro (system)
 * - Clean, modern, excellent readability
 * - Professional technical aesthetic
 *
 * Code: JetBrains Mono fallback to system mono
 * - Developer-focused, clear distinction
 */
export const brandTypography = {
  primary: {
    family: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "PingFang SC", sans-serif',
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  code: {
    family: '"JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, "Cascadia Code", "Courier New", monospace',
    weights: {
      regular: 400,
      medium: 500,
      bold: 700,
    },
  },
} as const;

/**
 * DGOS Motion Design Language
 *
 * Personality: Responsive and efficient
 * - Fast enough to feel immediate
 * - Smooth enough to feel refined
 * - Never blocking the user
 */
export const brandMotion = {
  // Easing curves
  easing: {
    // Sharp and efficient for exits/dismissals
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
    // Smooth deceleration for entrances
    enter: 'cubic-bezier(0, 0, 0.2, 1)',
    // Balanced for state changes
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    // Bouncy for emphasis (use sparingly)
    emphasis: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },

  // Duration (milliseconds)
  duration: {
    instant: 100,   // Immediate feedback
    fast: 150,      // Quick transitions
    normal: 250,    // Standard transitions
    slow: 350,      // Complex animations
    slower: 500,    // Page transitions
  },

  // Animation principles
  principles: {
    // Micro-interactions should be instant-fast
    microInteraction: '100-150ms',
    // State changes should be fast-normal
    stateChange: '150-250ms',
    // Page transitions should be normal-slow
    pageTransition: '250-350ms',
    // Loading animations can be slower
    loading: '500ms+',
  },
} as const;

/**
 * DGOS Iconography Style
 *
 * Style: Outlined with 1.5px stroke
 * - Clean, technical, professional
 * - Scales well at all sizes
 * - Consistent visual weight
 */
export const brandIconography = {
  style: 'outlined' as const,
  strokeWidth: 1.5,
  sizes: {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  // Icon set: Heroicons v2 (outlined) or custom DGOS icons
  source: 'heroicons-v2-outline',
} as const;

/**
 * DGOS Brand Spacing System
 *
 * Base unit: 4px
 * Systematic scale for consistency
 */
export const brandSpacing = {
  base: 4,
  scale: {
    0: 0,
    1: 4,    // 4px
    2: 8,    // 8px
    3: 12,   // 12px
    4: 16,   // 16px
    5: 20,   // 20px
    6: 24,   // 24px
    8: 32,   // 32px
    10: 40,  // 40px
    12: 48,  // 48px
    16: 64,  // 64px
    20: 80,  // 80px
    24: 96,  // 96px
  },
} as const;

/**
 * DGOS Brand Radius System
 *
 * Subtle rounded corners for modern feel
 * Not too round (playful), not too sharp (harsh)
 */
export const brandRadius = {
  none: 0,
  sm: 4,    // Small elements (badges, tags)
  md: 6,    // Standard elements (buttons, inputs)
  lg: 8,    // Panels, cards
  xl: 12,   // Large containers
  full: 9999, // Pills, avatars
} as const;

/**
 * DGOS Brand Elevation/Shadow System
 *
 * Subtle layering for depth hierarchy
 * Professional, not dramatic
 */
export const brandElevation = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
} as const;

/**
 * DGOS UI Voice and Tone
 *
 * Personality: Professional yet approachable
 * - Clear and direct (not verbose)
 * - Helpful and supportive (not condescending)
 * - Action-oriented (not passive)
 * - Honest about limitations (not over-promising)
 */
export const brandVoice = {
  buttons: {
    // Use action verbs
    good: ['Save', 'Create', 'Delete', 'Connect', 'Deploy'],
    avoid: ['OK', 'Submit', 'Confirm', 'Yes', 'No'],
  },

  errors: {
    // Be helpful, not blaming
    good: 'Unable to connect to the provider. Check your network and try again.',
    avoid: 'Connection failed. Error code: ECONNREFUSED',
  },

  success: {
    // Be encouraging but brief
    good: 'Provider connected successfully',
    avoid: 'Congratulations! Your provider has been successfully connected to the system!',
  },

  empty: {
    // Guide next action
    good: 'No providers yet. Connect your first provider to get started.',
    avoid: 'There are no providers available.',
  },
} as const;

// Export brand identity as single object
export const dgosBrand = {
  name: 'DGOS',
  tagline: 'Application Operating System',
  description: 'Professional application runtime for developers, creators, and enterprises',
  colors: brandColors,
  typography: brandTypography,
  motion: brandMotion,
  iconography: brandIconography,
  spacing: brandSpacing,
  radius: brandRadius,
  elevation: brandElevation,
  voice: brandVoice,
} as const;

export type BrandColorScale = typeof brandColors.primary;
export type BrandEasing = keyof typeof brandMotion.easing;
export type BrandDuration = keyof typeof brandMotion.duration;
