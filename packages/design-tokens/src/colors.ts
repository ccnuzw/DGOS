// Color tokens for DGOS design system
// These are exported as TypeScript constants for programmatic use
// CSS variables are defined in tokens.css

export const colors = {
  light: {
    canvas: '#f5f6f8',
    surface: '#ffffff',
    raised: '#ffffff',
    text: '#1d1f23',
    muted: '#5f6774',
    border: '#d9dde5',
    primary: '#1769e0',
    onPrimary: '#ffffff',
    success: '#16834b',
    warning: '#a15c00',
    danger: '#c0352b',
    info: '#286a9e',
    soft: '#edf1f6',
    focus: '#1769e0',
  },
  dark: {
    canvas: '#17181b',
    surface: '#222428',
    raised: '#2b2e33',
    text: '#f4f5f7',
    muted: '#b7bec8',
    border: '#3a3f47',
    primary: '#6ea8ff',
    onPrimary: '#10213a',
    success: '#55c88a',
    warning: '#f0b45d',
    danger: '#ff8178',
    info: '#7bc4ff',
    soft: '#30343a',
    focus: '#8bb8ff',
  },
} as const;

export type ColorToken = keyof typeof colors.light;
