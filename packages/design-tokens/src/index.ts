export type Theme = 'light' | 'dark';
export type Locale = 'en' | 'zh';
export const scaleOptions = [75, 100, 125, 150, 175] as const;
export const routes = {
  desktop: '/desktop', catalog: '/catalog', settings: '/settings', providers: '/providers', protocols: '/protocols',
  skills: '/skills', mcp: '/mcp', assistant: '/assistant', tasks: '/ai-tasks', developer: '/developer', keys: '/keys', governance: '/governance', usage: '/usage',
} as const;
export type RouteKey = keyof typeof routes;
