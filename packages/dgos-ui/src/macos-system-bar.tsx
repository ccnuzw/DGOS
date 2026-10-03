/**
 * macOS System Bar Component
 *
 * Top system bar with:
 * - App name/logo on left
 * - Search and system controls on right
 * - Glass morphism with backdrop blur
 * - 44px height matching macOS design
 *
 * Design tokens from design-tokens/macos-tokens.ts
 */

import React, { type HTMLAttributes, type ReactNode } from 'react';
import './macos-system-bar.css';

export interface MacOSSystemBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** App name or logo to display on left */
  appName?: string;

  /** Custom logo element (overrides appName) */
  logo?: ReactNode;

  /** Search callback */
  onSearch?: (query: string) => void;

  /** Whether to show search bar */
  showSearch?: boolean;

  /** Custom controls to display on right side */
  controls?: ReactNode;

  /** System menu items */
  menuItems?: Array<{
    id: string;
    label: string;
    onClick: () => void;
  }>;
}

/**
 * MacOSSystemBar - Top system bar component
 */
export function MacOSSystemBar({
  appName = 'DGOS',
  logo,
  onSearch,
  showSearch = true,
  controls,
  menuItems = [],
  className = '',
  ...props
}: MacOSSystemBarProps) {
  const [searchQuery, setSearchQuery] = React.useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch && searchQuery.trim()) {
      onSearch(searchQuery);
    }
  };

  return (
    <header
      className={`macos-system-bar ${className}`}
      role="banner"
      {...props}
    >
      {/* Left Section - Logo/App Name */}
      <div className="macos-system-bar-left">
        {logo ? (
          <div className="macos-system-bar-logo">{logo}</div>
        ) : (
          <div className="macos-system-bar-app-name" aria-label={`${appName} application`}>
            <span className="app-name-text">{appName}</span>
          </div>
        )}

        {/* Menu Items */}
        {menuItems.length > 0 && (
          <nav className="macos-system-bar-menu" role="navigation" aria-label="Main menu">
            {menuItems.map((item) => (
              <button
                key={item.id}
                className="system-bar-menu-item"
                onClick={item.onClick}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* Right Section - Search and Controls */}
      <div className="macos-system-bar-right">
        {/* Search Bar */}
        {showSearch && (
          <form
            className="macos-system-bar-search"
            onSubmit={handleSearchSubmit}
            role="search"
          >
            <label htmlFor="system-bar-search" className="sr-only">
              Search
            </label>
            <input
              id="system-bar-search"
              type="search"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="system-bar-search-input"
              aria-label="Search"
            />
            <span className="search-icon" aria-hidden="true">
              🔍
            </span>
          </form>
        )}

        {/* Custom Controls */}
        {controls && (
          <div className="macos-system-bar-controls">
            {controls}
          </div>
        )}
      </div>
    </header>
  );
}

/**
 * SystemBarIcon - Icon button for system bar
 */
export interface SystemBarIconProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon to display (emoji or content) */
  icon: ReactNode;

  /** Accessible label */
  label: string;

  /** Show badge indicator */
  badge?: boolean;

  /** Badge count */
  badgeCount?: number;
}

export function SystemBarIcon({
  icon,
  label,
  badge = false,
  badgeCount,
  className = '',
  ...props
}: SystemBarIconProps) {
  return (
    <button
      className={`system-bar-icon ${className}`}
      aria-label={label}
      title={label}
      type="button"
      {...props}
    >
      <span className="icon-content" aria-hidden="true">
        {icon}
      </span>
      {badge && (
        <span className="icon-badge" aria-label={badgeCount ? `${badgeCount} notifications` : 'Has notifications'}>
          {badgeCount && badgeCount > 0 ? (badgeCount > 9 ? '9+' : badgeCount) : ''}
        </span>
      )}
    </button>
  );
}
