// macOS Settings-Style Components
// Pixel-perfect recreation of macOS system preferences UI
import React, { useState } from 'react';
import './macos-settings-components.css';

// Sidebar Navigation Component
export interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  section?: string;
}

export function MacOSSidebar({
  items,
  activeId,
  onItemClick,
}: {
  items: SidebarItem[];
  activeId?: string;
  onItemClick?: (id: string) => void;
}) {
  // Group items by section
  const sections = items.reduce((acc, item) => {
    const section = item.section || 'default';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, SidebarItem[]>);

  return (
    <div className="macos-settings-sidebar">
      {Object.entries(sections).map(([section, sectionItems], idx) => (
        <div key={section} className={idx > 0 ? 'macos-sidebar-section' : ''}>
          {sectionItems.map((item) => (
            <button
              key={item.id}
              className={`macos-sidebar-item ${
                activeId === item.id ? 'macos-sidebar-item--active' : ''
              }`}
              onClick={() => onItemClick?.(item.id)}
            >
              <span className="macos-sidebar-item__icon">{item.icon}</span>
              <span className="macos-sidebar-item__label">{item.label}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// Content Header with Navigation
export function MacOSContentHeader({
  title,
  onBack,
  onForward,
  canGoBack = false,
  canGoForward = false,
}: {
  title: string;
  onBack?: () => void;
  onForward?: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
}) {
  return (
    <div className="macos-content-header">
      <div className="macos-content-nav">
        <button onClick={onBack} disabled={!canGoBack} aria-label="Go back">
          ‹
        </button>
        <button onClick={onForward} disabled={!canGoForward} aria-label="Go forward">
          ›
        </button>
      </div>
      <h1 className="macos-content-title">{title}</h1>
    </div>
  );
}

// Settings Row with Toggle
export function MacOSToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <div className="macos-settings-row">
      <div className="macos-settings-row__label">
        <div className="macos-settings-row__title">{title}</div>
        {description && (
          <div className="macos-settings-row__description">{description}</div>
        )}
      </div>
      <div
        className={`macos-toggle ${checked ? 'macos-toggle--on' : ''}`}
        onClick={() => onChange?.(!checked)}
        role="switch"
        aria-checked={checked}
        tabIndex={0}
      />
    </div>
  );
}

// Settings Row with Select
export function MacOSSelectRow({
  title,
  description,
  value,
  options,
  onChange,
}: {
  title: string;
  description?: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="macos-settings-row">
      <div className="macos-settings-row__label">
        <div className="macos-settings-row__title">{title}</div>
        {description && (
          <div className="macos-settings-row__description">{description}</div>
        )}
      </div>
      <select
        className="macos-select"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// Settings Row with Checkbox
export function MacOSCheckboxRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <div className="macos-settings-row">
      <div className="macos-settings-row__label">
        <div className="macos-settings-row__title">{title}</div>
        {description && (
          <div className="macos-settings-row__description">{description}</div>
        )}
      </div>
      <div
        className={`macos-checkbox ${checked ? 'macos-checkbox--checked' : ''}`}
        onClick={() => onChange?.(!checked)}
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
      />
    </div>
  );
}

// List Item with Icon and Arrow
export function MacOSListItem({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  onClick?: () => void;
}) {
  return (
    <div className="macos-list-item" onClick={onClick}>
      {icon && <div className="macos-list-item__icon">{icon}</div>}
      <div className="macos-list-item__content">
        <div className="macos-list-item__title">{title}</div>
        {subtitle && <div className="macos-list-item__subtitle">{subtitle}</div>}
      </div>
      <div className="macos-list-item__arrow">›</div>
    </div>
  );
}

// Slider Control
export function MacOSSlider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
}) {
  return (
    <input
      type="range"
      className="macos-slider"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange?.(Number(e.target.value))}
    />
  );
}

// Help Button
export function MacOSHelpButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      className="macos-help-button"
      onClick={onClick}
      aria-label="Help"
    >
      ?
    </button>
  );
}

// Settings Section
export function MacOSSettingsSection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="macos-settings-section">
      {title && <div className="macos-settings-section-title">{title}</div>}
      {children}
    </div>
  );
}

// Complete Settings Layout
export function MacOSSettingsLayout({
  sidebar,
  content,
}: {
  sidebar: React.ReactNode;
  content: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {sidebar}
      <div className="macos-settings-content">{content}</div>
    </div>
  );
}
