// macOS Window Tab Bar
// Shows tabs for all open windows when any window is maximized
import React, { type ReactNode } from 'react';
import { X } from 'lucide-react';

export interface WindowTab {
  id: string;
  title: string;
  icon?: ReactNode;
  active: boolean;
}

export interface WindowTabBarProps {
  tabs: WindowTab[];
  onTabClick: (id: string) => void;
  onTabClose: (id: string) => void;
}

export function WindowTabBar({ tabs, onTabClick, onTabClose }: WindowTabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="macos-window-tabs">
      <div className="macos-window-tabs__container">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`macos-window-tabs__tab ${tab.active ? 'macos-window-tabs__tab--active' : ''}`}
            onClick={() => onTabClick(tab.id)}
            aria-label={`Switch to ${tab.title}`}
            aria-current={tab.active ? 'true' : 'false'}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTabClick(tab.id); }
            }}
          >
            {tab.icon && (
              <div className="macos-window-tabs__icon">
                {tab.icon}
              </div>
            )}
            <span className="macos-window-tabs__title">{tab.title}</span>
            <button
              className="macos-window-tabs__close"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              type="button"
              aria-label={`Close ${tab.title}`}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
