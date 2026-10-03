/**
 * macOS Dock Component
 *
 * Bottom-centered app launcher with macOS-style interactions:
 * - Icon magnification on hover (spring animation)
 * - Running indicator dots beneath active apps
 * - Badge support for notifications
 * - Glass morphism background
 * - Divider between apps and system items
 *
 * Design tokens from design-tokens/macos-tokens.ts
 */

import React, { useState, type HTMLAttributes } from 'react';
import './macos-dock.css';

export interface DockApp {
  /** Unique identifier */
  id: string;

  /** App name */
  name: string;

  /** Icon URL or emoji */
  icon: string;

  /** Whether app is currently running */
  running?: boolean;

  /** Badge count (for notifications) */
  badge?: number;

  /** Click handler */
  onClick?: () => void;
}

export interface MacOSDockProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Array of apps to display */
  apps: DockApp[];

  /** Optional system items (right side of divider) */
  systemApps?: DockApp[];

  /** Position of dock */
  position?: 'bottom' | 'left' | 'right';

  /** Enable magnification effect */
  magnification?: boolean;
}

/**
 * DockIcon - Individual dock icon with hover magnification
 */
function DockIcon({ app, magnification = true }: { app: DockApp; magnification?: boolean }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`macos-dock-icon-wrapper ${magnification ? 'magnify' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        className="macos-dock-icon"
        onClick={app.onClick}
        aria-label={app.name}
        title={app.name}
        type="button"
      >
        {/* Icon Image or Emoji */}
        {app.icon.startsWith('http') || app.icon.startsWith('/') ? (
          <img src={app.icon} alt={app.name} className="dock-icon-image" />
        ) : (
          <span className="dock-icon-emoji" role="img" aria-label={app.name}>
            {app.icon}
          </span>
        )}

        {/* Badge for notifications */}
        {app.badge && app.badge > 0 && (
          <span className="dock-icon-badge" aria-label={`${app.badge} notifications`}>
            {app.badge > 99 ? '99+' : app.badge}
          </span>
        )}
      </button>

      {/* Running Indicator Dot */}
      {app.running && (
        <span className="dock-icon-indicator" aria-label="Running" />
      )}
    </div>
  );
}

/**
 * MacOSDock - Main dock component
 */
export function MacOSDock({
  apps,
  systemApps = [],
  position = 'bottom',
  magnification = true,
  className = '',
  ...props
}: MacOSDockProps) {
  return (
    <div
      className={`macos-dock ${position} ${className}`}
      role="toolbar"
      aria-label="Application Dock"
      {...props}
    >
      <div className="macos-dock-container">
        {/* Main Apps */}
        <div className="macos-dock-apps" role="list">
          {apps.map((app) => (
            <div key={app.id} role="listitem">
              <DockIcon app={app} magnification={magnification} />
            </div>
          ))}
        </div>

        {/* Divider */}
        {systemApps.length > 0 && (
          <div className="macos-dock-divider" aria-hidden="true" />
        )}

        {/* System Apps */}
        {systemApps.length > 0 && (
          <div className="macos-dock-system" role="list">
            {systemApps.map((app) => (
              <div key={app.id} role="listitem">
                <DockIcon app={app} magnification={magnification} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
