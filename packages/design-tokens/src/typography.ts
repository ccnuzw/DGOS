// Typography tokens for DGOS design system

export const typography = {
  fontFamily: {
    base: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", Inter, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, "Courier New", monospace',
  },
  fontSize: {
    xs: '11px',
    sm: '12px',
    base: '14px',
    md: '16px',
    lg: '18px',
    xl: '22px',
    xxl: '28px',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '650',
    bold: '700',
  },
  lineHeight: {
    tight: '1.2',
    base: '1.5',
    relaxed: '1.65',
  },
} as const;

export type FontSize = keyof typeof typography.fontSize;
export type FontWeight = keyof typeof typography.fontWeight;
