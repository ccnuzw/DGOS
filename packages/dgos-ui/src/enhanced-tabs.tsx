// Enhanced Tabs Component with icons, keyboard navigation, and underline indicator
import React, { useRef, useEffect, useState } from 'react';

/**
 * Tab definition
 */
export interface Tab {
  /** Unique tab identifier */
  id: string;
  /** Tab label */
  label: string;
  /** Optional icon */
  icon?: React.ReactNode;
  /** Disabled state */
  disabled?: boolean;
  /** Badge count or text */
  badge?: string | number;
}

/**
 * Enhanced Tabs props
 */
export interface EnhancedTabsProps {
  /** Tab definitions */
  tabs: Tab[];
  /** Active tab ID */
  activeId: string;
  /** Tab change callback */
  onChange: (id: string) => void;
  /** Custom class name */
  className?: string;
  /** Tab size variant */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * EnhancedTabs - Horizontal tabs with icons, keyboard navigation, and animated underline
 */
export function EnhancedTabs({
  tabs,
  activeId,
  onChange,
  className = '',
  size = 'md',
}: EnhancedTabsProps) {
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  // Update indicator position
  useEffect(() => {
    const activeTab = tabRefs.current.get(activeId);
    if (activeTab) {
      const parent = activeTab.parentElement;
      if (parent) {
        setIndicatorStyle({
          left: activeTab.offsetLeft,
          width: activeTab.offsetWidth,
        });
      }
    }
  }, [activeId, tabs]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, currentId: string) => {
    const currentIndex = tabs.findIndex(tab => tab.id === currentId);
    let newIndex = currentIndex;

    switch (e.key) {
      case 'ArrowLeft':
        // Move to previous tab (skip disabled)
        newIndex = currentIndex - 1;
        while (newIndex >= 0 && tabs[newIndex].disabled) {
          newIndex--;
        }
        if (newIndex >= 0) {
          onChange(tabs[newIndex].id);
          e.preventDefault();
        }
        break;

      case 'ArrowRight':
        // Move to next tab (skip disabled)
        newIndex = currentIndex + 1;
        while (newIndex < tabs.length && tabs[newIndex].disabled) {
          newIndex++;
        }
        if (newIndex < tabs.length) {
          onChange(tabs[newIndex].id);
          e.preventDefault();
        }
        break;

      case 'Home':
        // Move to first enabled tab
        newIndex = 0;
        while (newIndex < tabs.length && tabs[newIndex].disabled) {
          newIndex++;
        }
        if (newIndex < tabs.length) {
          onChange(tabs[newIndex].id);
          e.preventDefault();
        }
        break;

      case 'End':
        // Move to last enabled tab
        newIndex = tabs.length - 1;
        while (newIndex >= 0 && tabs[newIndex].disabled) {
          newIndex--;
        }
        if (newIndex >= 0) {
          onChange(tabs[newIndex].id);
          e.preventDefault();
        }
        break;
    }
  };

  return (
    <div className={`dgos-enhanced-tabs ${size} ${className}`} role="tablist">
      <div className="tabs-container">
        {tabs.map((tab) => {
          const isActive = activeId === tab.id;

          return (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) {
                  tabRefs.current.set(tab.id, el);
                } else {
                  tabRefs.current.delete(tab.id);
                }
              }}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              aria-disabled={tab.disabled}
              tabIndex={isActive ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => !tab.disabled && onChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, tab.id)}
              className={`tab-button ${isActive ? 'active' : ''} ${tab.disabled ? 'disabled' : ''}`}
            >
              {tab.icon && (
                <span className="tab-icon" aria-hidden="true">
                  {tab.icon}
                </span>
              )}
              <span className="tab-label">{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="tab-badge" aria-label={`${tab.badge} items`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}

        <div
          className="tab-indicator"
          style={{
            transform: `translateX(${indicatorStyle.left}px)`,
            width: indicatorStyle.width,
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

/**
 * TabPanel - Content panel for a tab
 */
export interface TabPanelProps {
  /** Tab ID this panel belongs to */
  tabId: string;
  /** Active tab ID */
  activeId: string;
  /** Panel content */
  children: React.ReactNode;
  /** Custom class name */
  className?: string;
}

export function TabPanel({ tabId, activeId, children, className = '' }: TabPanelProps) {
  const isActive = tabId === activeId;

  return (
    <div
      id={`panel-${tabId}`}
      role="tabpanel"
      aria-labelledby={tabId}
      hidden={!isActive}
      className={`dgos-tab-panel ${className}`}
    >
      {isActive && children}
    </div>
  );
}
