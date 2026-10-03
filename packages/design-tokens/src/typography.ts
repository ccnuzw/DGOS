// Typography tokens for DGOS design system
// Based on DGOS brand identity - professional, technical, readable

/**
 * DGOS Typography System
 *
 * Primary: Inter (modern, technical, excellent readability)
 * - Loaded via @import or <link> in app
 * - Fallback to system fonts (SF Pro, Segoe UI, PingFang SC)
 *
 * Code: JetBrains Mono (developer-focused)
 * - Fallback to system monospace
 */

export const typography = {
  fontFamily: {
    // Primary font - Inter with system fallbacks
    base: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    // Code font - JetBrains Mono with system monospace fallbacks
    mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, "Cascadia Code", Consolas, monospace',
  },
  fontSize: {
    xs: '11px',   // Labels, captions
    sm: '12px',   // Secondary text
    base: '14px', // Body text
    md: '16px',   // Emphasized body
    lg: '18px',   // Subheadings
    xl: '22px',   // Headings
    xxl: '28px',  // Page titles
    xxxl: '36px', // Hero text
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',  // Changed from 650 to standard 600
    bold: '700',
  },
  lineHeight: {
    tight: '1.2',    // Headings
    base: '1.5',     // Body text
    relaxed: '1.65', // Long form content
  },
  letterSpacing: {
    tighter: '-0.02em',
    tight: '-0.01em',
    normal: '0',
    wide: '0.01em',
    wider: '0.02em',
  },
} as const;

export type FontSize = keyof typeof typography.fontSize;
export type FontWeight = keyof typeof typography.fontWeight;
export type LineHeight = keyof typeof typography.lineHeight;
