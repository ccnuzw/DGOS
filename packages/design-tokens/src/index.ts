// Core design tokens for DGOS V1
export type Theme = 'light' | 'dark';
export type Locale = 'en' | 'zh';

// Display scaling options per UI-AC-006
export const scaleOptions = [75, 100, 125, 150, 175] as const;
export type ScaleOption = typeof scaleOptions[number];

// Application routes
export const routes = {
  desktop: '/desktop', catalog: '/catalog', settings: '/settings', system: '/system', providers: '/providers', models: '/models', protocols: '/protocols',
  skills: '/skills', mcp: '/mcp', assistant: '/assistant', tasks: '/ai-tasks', developer: '/developer', keys: '/keys', governance: '/governance', usage: '/usage',
} as const;
export type RouteKey = keyof typeof routes;

// Export design tokens
export * from './colors.js';
export * from './typography.js';
export * from './spacing.js';

// Breakpoints for responsive design
export const breakpoints = {
  mobile: '520px',
  tablet: '680px',
  desktop: '850px',
  wide: '1400px',
} as const;
