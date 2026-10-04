// macOS System Bar Component
// Top bar with app name, search, and system controls
import React, { useState, useEffect, type ReactNode } from 'react';
import { Search, Bell, Settings, User, X } from 'lucide-react';
import type { WindowInstance } from './window-manager';

export interface SystemBarProps {
  currentApp?: string;
  onMenuClick?: () => void;
  onSearchClick?: () => void;
  onNotificationsClick?: () => void;
  onSettingsClick?: () => void;
  theme?: 'light' | 'dark';
  onThemeToggle?: () => void;
  windows?: WindowInstance[];
  focusedWindowId?: string | null;
  onWindowFocus?: (windowId: string) => void;
  onWindowClose?: (windowId: string) => void;
}

export function MacOSSystemBar({
  currentApp,
  onMenuClick,
  onSearchClick,
  onNotificationsClick,
  onSettingsClick,
  theme = 'light',
  onThemeToggle,
  windows = [],
  focusedWindowId,
  onWindowFocus,
  onWindowClose,
}: SystemBarProps) {
  const [time, setTime] = useState(formatTime(new Date()));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(formatTime(new Date()));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Get visible windows (not minimized)
  const visibleWindows = windows.filter((w) => w.state !== 'minimized');

  // Check if any window is maximized
  const hasMaximizedWindow = visibleWindows.some((w) => w.state === 'maximized');

  // Render tabs only when at least one window is maximized
  const renderTabs = () => {
    if (!hasMaximizedWindow || visibleWindows.length === 0) {
      return null;
    }

    return visibleWindows.map((window) => (
      <div
        key={window.id}
        className={`macos-window-tab ${window.id === focusedWindowId ? 'macos-window-tab--active' : ''}`}
        onClick={() => onWindowFocus?.(window.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onWindowFocus?.(window.id); }
        }}
      >
        {window.icon && (
          <div className="macos-window-tab__icon" style={{ width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div className="macos-window-tab__icon-content">{window.icon}</div>
          </div>
        )}
        <span className="macos-window-tab__title">{window.title}</span>
        <button
          className="macos-window-tab__close"
          onClick={(e) => {
            e.stopPropagation();
            onWindowClose?.(window.id);
          }}
          type="button"
          aria-label={`Close ${window.title}`}
        >
          <X size={10} strokeWidth={2.5} />
        </button>
      </div>
    ));
  };

  return (
    <div className={`macos-system-bar ${hasMaximizedWindow ? 'macos-system-bar--with-tabs' : ''}`}>
      <div className="macos-system-bar__left">
        <button
          className="macos-system-bar__logo"
          onClick={onMenuClick}
          aria-label="DGOS Menu"
          type="button"
        >
          <div className="macos-system-bar__logo-mark">D</div>
          <span>DGOS</span>
        </button>
        {!hasMaximizedWindow && currentApp && (
          <span className="macos-system-bar__app-name">{currentApp}</span>
        )}
      </div>

      <div className="macos-system-bar__center">
        {renderTabs()}
      </div>

      <div className="macos-system-bar__right">
        <button
          className="macos-system-bar__icon-button"
          onClick={onSearchClick}
          aria-label="Search"
          type="button"
        >
          <Search size={20} />
        </button>

        <button
          className="macos-system-bar__icon-button"
          onClick={onNotificationsClick}
          aria-label="Notifications"
          type="button"
        >
          <Bell size={20} />
        </button>

        <button
          className="macos-system-bar__icon-button"
          onClick={onSettingsClick}
          aria-label="Settings"
          type="button"
        >
          <Settings size={20} />
        </button>

        <span className="macos-system-bar__time" aria-live="off">
          {time}
        </span>
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
