// Color tokens for DGOS design system
// These are exported as TypeScript constants for programmatic use
// CSS variables are defined in tokens.css
// Brand colors defined in brand.ts

/**
 * DGOS Semantic Color Tokens
 *
 * Based on DGOS brand identity:
 * - Primary: Deep Ocean Blue (#0F5FD9) - Technical, reliable, professional
 * - Secondary: Electric Teal (#06B6D4) - Modern, efficient, innovative
 * - Accent: Amber (#F59E0B) - Energy, success, highlights
 *
 * Distinct from generic design systems - DGOS独立品牌表达
 */

export const colors = {
  light: {
    // Base surfaces
    canvas: '#f8fafc',      // Slightly cooler neutral
    surface: '#ffffff',
    raised: '#ffffff',

    // Text
    text: '#0f172a',        // Deeper, more readable
    muted: '#64748b',       // Cooler gray

    // Borders and dividers
    border: '#e2e8f0',      // Cooler, more subtle
    soft: '#f1f5f9',        // Background for soft emphasis

    // DGOS Brand Primary - Deep Ocean Blue
    primary: '#0F5FD9',     // DGOS signature blue
    onPrimary: '#ffffff',

    // Secondary - Electric Teal (for accents, not main actions)
    secondary: '#06B6D4',
    onSecondary: '#ffffff',

    // Semantic colors
    success: '#10b981',     // Modern green
    warning: '#f59e0b',     // Amber (brand accent)
    danger: '#ef4444',      // Clear red
    info: '#0ea5e9',        // Sky blue

    // Interactive states
    focus: '#0F5FD9',       // Primary brand color
    hover: '#0d4fb8',       // Slightly darker primary
  },
  dark: {
    // Base surfaces
    canvas: '#0f172a',      // Deep navy canvas
    surface: '#1e293b',     // Slate surface
    raised: '#334155',      // Elevated slate

    // Text
    text: '#f1f5f9',        // High contrast
    muted: '#94a3b8',       // Readable muted

    // Borders and dividers
    border: '#334155',      // Subtle borders
    soft: '#1e293b',        // Soft backgrounds

    // DGOS Brand Primary - Lighter for dark mode
    primary: '#5B9EFF',     // Lighter DGOS blue for dark
    onPrimary: '#0f172a',   // Dark text on bright primary

    // Secondary - Brighter teal for dark mode
    secondary: '#22D3EE',
    onSecondary: '#0f172a',

    // Semantic colors (brighter for dark mode)
    success: '#34d399',
    warning: '#fbbf24',     // Brighter amber
    danger: '#f87171',      // Softer red
    info: '#38bdf8',        // Brighter sky

    // Interactive states
    focus: '#5B9EFF',       // Lighter primary for dark
    hover: '#7db1ff',       // Even lighter on hover
  },
} as const;

export type ColorToken = keyof typeof colors.light;
