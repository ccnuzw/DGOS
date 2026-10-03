// Core design tokens for DGOS V1
// DGOS独立品牌 - Independent brand identity
export type Theme = 'light' | 'dark';
export type Locale = 'en' | 'zh';

// Display scaling options per UI-AC-006
export const scaleOptions = [75, 100, 125, 150, 175] as const;
export type ScaleOption = typeof scaleOptions[number];

// Application routes
export const routes = {
  desktop: '/desktop', catalog: '/catalog', settings: '/settings', system: '/system', providers: '/providers', models: '/models', protocols: '/protocols',
  skills: '/skills', mcp: '/mcp', assistant: '/assistant', tasks: '/ai-tasks', developer: '/developer', keys: '/keys', governance: '/governance', usage: '/usage',
  designSystem: '/design-system',
} as const;
export type RouteKey = keyof typeof routes;

// Export design tokens
export * from './colors.js';
export * from './typography.js';
export * from './spacing.js';
export * from './brand.js';
export * from './macos-tokens.js';

// Breakpoints for responsive design
export const breakpoints = {
  mobile: '520px',
  tablet: '680px',
  desktop: '850px',
  wide: '1400px',
} as const;

// Motion and animation tokens
export const motion = {
  duration: {
    instant: 100,
    fast: 150,
    normal: 250,
    slow: 350,
    slower: 500,
  },
  easing: {
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
    enter: 'cubic-bezier(0, 0, 0.2, 1)',
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    emphasis: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

// Border radius tokens
export const radius = {
  none: '0',
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  full: '9999px',
} as const;

// Elevation/shadow tokens
export const elevation = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
} as const;
