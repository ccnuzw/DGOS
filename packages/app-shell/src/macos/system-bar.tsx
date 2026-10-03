// macOS System Bar Component
// Top bar with app name, search, and system controls
import React, { useState, useEffect } from 'react';
import { Search, Bell, Settings, User } from 'lucide-react';

export interface SystemBarProps {
  currentApp?: string;
  onMenuClick?: () => void;
  onSearchClick?: () => void;
  onNotificationsClick?: () => void;
  onSettingsClick?: () => void;
  theme?: 'light' | 'dark';
  onThemeToggle?: () => void;
}

export function MacOSSystemBar({
  currentApp,
  onMenuClick,
  onSearchClick,
  onNotificationsClick,
  onSettingsClick,
  theme = 'light',
  onThemeToggle,
}: SystemBarProps) {
  const [time, setTime] = useState(formatTime(new Date()));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(formatTime(new Date()));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="macos-system-bar">
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
        {currentApp && (
          <span className="macos-system-bar__app-name">{currentApp}</span>
        )}
      </div>

      <div className="macos-system-bar__center">
        {/* Reserved for future use - window title or breadcrumbs */}
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
