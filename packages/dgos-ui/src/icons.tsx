// macOS-style icon component for DGOS V1
// Provides consistent icon rendering with theme support
import { CSSProperties } from 'react';

export type IconSize = 16 | 24 | 32 | 48 | 64 | 128 | 256;
export type IconVariant = 'light' | 'dark';
export type IconCategory = 'apps' | 'system' | 'statusbar';

export interface MacOSIconProps {
  /** Icon name (without .svg extension) */
  name: string;
  /** Icon size in pixels */
  size?: IconSize;
  /** Light or dark mode variant */
  variant?: IconVariant;
  /** Icon category/folder */
  category?: IconCategory;
  /** Additional CSS class */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Alt text for accessibility */
  alt?: string;
}

/**
 * MacOSIcon - Professional macOS-style icon component
 *
 * Features:
 * - Theme-aware (light/dark variants)
 * - Multiple size options (16-256px)
 * - Consistent styling and shadows
 * - Optimized SVG rendering
 *
 * @example
 * ```tsx
 * <MacOSIcon name="system-info" category="apps" size={48} />
 * <MacOSIcon name="search" category="statusbar" size={24} />
 * ```
 */
export function MacOSIcon({
  name,
  size = 48,
  variant = 'light',
  category = 'apps',
  className = '',
  style = {},
  alt,
}: MacOSIconProps) {
  // Build icon path based on variant and category
  const iconPath = variant === 'dark' && category !== 'statusbar'
    ? `/icons/dark/${category}/${name}.svg`
    : `/icons/${category}/${name}.svg`;

  // Apply drop shadow for larger icons (32px and up)
  const shouldHaveShadow = size >= 32 && category !== 'statusbar';

  const iconStyle: CSSProperties = {
    width: size,
    height: size,
    filter: shouldHaveShadow
      ? 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))'
      : 'none',
    ...style,
  };

  const altText = alt || `${name.replace(/-/g, ' ')} icon`;

  return (
    <img
      src={iconPath}
      alt={altText}
      width={size}
      height={size}
      className={`macos-icon ${className}`.trim()}
      style={iconStyle}
      draggable={false}
    />
  );
}

/**
 * Dock-sized icon for application launchers
 */
export function DockIcon({ name, variant = 'light' }: { name: string; variant?: IconVariant }) {
  return <MacOSIcon name={name} category="apps" size={48} variant={variant} />;
}

/**
 * Status bar icon with currentColor support
 */
export function StatusBarIcon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <MacOSIcon
      name={name}
      category="statusbar"
      size={24}
      className={`status-icon ${className}`.trim()}
    />
  );
}

/**
 * System icon for folders and system elements
 */
export function SystemIcon({
  name,
  variant = 'light',
  size = 48
}: {
  name: string;
  variant?: IconVariant;
  size?: IconSize;
}) {
  return <MacOSIcon name={name} category="system" size={size} variant={variant} />;
}

// Export all icon names for type safety
export const APP_ICONS = [
  'system-info',
  'catalog',
  'developer-center',
  'settings',
  'providers',
  'models',
  'extensions',
  'assistant',
  'tasks',
] as const;

export const SYSTEM_ICONS = [
  'dgos-logo',
  'downloads',
  'trash',
  'trash-full',
] as const;

export const STATUSBAR_ICONS = [
  'search',
  'notifications',
  'settings',
  'user',
  'clock',
  'wifi',
  'battery',
  'volume',
] as const;

export type AppIconName = typeof APP_ICONS[number];
export type SystemIconName = typeof SYSTEM_ICONS[number];
export type StatusBarIconName = typeof STATUSBAR_ICONS[number];
