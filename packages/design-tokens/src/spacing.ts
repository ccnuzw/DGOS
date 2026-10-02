// Spacing tokens for DGOS design system

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '24px',
  xxxl: '32px',
} as const;

export const radius = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '10px',
} as const;

export const shadow = {
  sm: '0 2px 8px rgba(29, 31, 35, 0.08)',
  md: '0 4px 16px rgba(29, 31, 35, 0.1)',
  lg: '0 8px 24px rgba(29, 31, 35, 0.12)',
} as const;

export const zIndex = {
  dropdown: 50,
  sticky: 100,
  modal: 1000,
  toast: 2000,
  tooltip: 3000,
} as const;

export type Spacing = keyof typeof spacing;
export type Radius = keyof typeof radius;
