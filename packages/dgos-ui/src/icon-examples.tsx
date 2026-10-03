import React from 'react';
import { MacOSIcon, DockIcon, StatusBarIcon } from '@dgos/ui';

/**
 * Example: Basic Icon Usage
 */
export function BasicIconExample() {
  return (
    <div style={{ display: 'flex', gap: '16px', padding: '20px' }}>
      <MacOSIcon name="system-info" category="apps" size={48} />
      <MacOSIcon name="catalog" category="apps" size={48} />
      <MacOSIcon name="developer-center" category="apps" size={48} />
      <MacOSIcon name="settings" category="apps" size={48} />
    </div>
  );
}

/**
 * Example: Theme-Aware Icons
 */
export function ThemeAwareIconExample() {
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');

  return (
    <div style={{ padding: '20px' }}>
      <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
        Toggle Theme
      </button>
      <div style={{
        display: 'flex',
        gap: '16px',
        marginTop: '20px',
        padding: '20px',
        background: theme === 'dark' ? '#0f172a' : '#ffffff',
        borderRadius: '12px'
      }}>
        <MacOSIcon name="models" category="apps" size={48} variant={theme} />
        <MacOSIcon name="providers" category="apps" size={48} variant={theme} />
        <MacOSIcon name="assistant" category="apps" size={48} variant={theme} />
        <MacOSIcon name="tasks" category="apps" size={48} variant={theme} />
      </div>
    </div>
  );
}

/**
 * Example: Dock Component
 */
export function DockExample() {
  const apps = [
    'system-info',
    'catalog',
    'developer-center',
    'settings',
    'providers',
    'models',
    'extensions',
    'assistant',
    'tasks',
  ];

  return (
    <div
      className="dock"
      style={{
        display: 'flex',
        gap: '12px',
        padding: '16px 24px',
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        borderRadius: '16px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
        justifyContent: 'center',
      }}
    >
      {apps.map(app => (
        <DockIcon key={app} name={app} />
      ))}
    </div>
  );
}

/**
 * Example: Status Bar
 */
export function StatusBarExample() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '8px 16px',
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
      }}
    >
      <StatusBarIcon name="search" />
      <StatusBarIcon name="notifications" />
      <div style={{ flex: 1 }} />
      <StatusBarIcon name="wifi" />
      <StatusBarIcon name="battery" />
      <StatusBarIcon name="volume" />
      <StatusBarIcon name="clock" />
      <StatusBarIcon name="user" />
    </div>
  );
}

/**
 * Example: Icon Grid (App Launcher)
 */
export function IconGridExample() {
  const apps = [
    { name: 'system-info', label: 'System Info' },
    { name: 'catalog', label: 'App Catalog' },
    { name: 'developer-center', label: 'Developer' },
    { name: 'settings', label: 'Settings' },
    { name: 'providers', label: 'Providers' },
    { name: 'models', label: 'Models' },
    { name: 'extensions', label: 'Extensions' },
    { name: 'assistant', label: 'Assistant' },
    { name: 'tasks', label: 'Tasks' },
  ];

  return (
    <div className="icon-grid">
      {apps.map(app => (
        <div key={app.name} className="icon-grid-item">
          <MacOSIcon name={app.name} category="apps" size={48} />
          <span className="icon-label">{app.label}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Example: System Icons
 */
export function SystemIconsExample() {
  return (
    <div style={{ display: 'flex', gap: '24px', padding: '20px' }}>
      <div style={{ textAlign: 'center' }}>
        <MacOSIcon name="dgos-logo" category="system" size={64} />
        <p style={{ marginTop: '8px', fontSize: '12px' }}>DGOS</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <MacOSIcon name="downloads" category="system" size={64} />
        <p style={{ marginTop: '8px', fontSize: '12px' }}>Downloads</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <MacOSIcon name="trash" category="system" size={64} />
        <p style={{ marginTop: '8px', fontSize: '12px' }}>Trash</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <MacOSIcon name="trash-full" category="system" size={64} />
        <p style={{ marginTop: '8px', fontSize: '12px' }}>Trash (Full)</p>
      </div>
    </div>
  );
}

/**
 * Example: Icon with Badge
 */
export function IconBadgeExample() {
  return (
    <div style={{ padding: '20px' }}>
      <div className="icon-badge" data-badge="5">
        <MacOSIcon name="notifications" category="statusbar" size={24} />
      </div>
    </div>
  );
}

/**
 * Example: Different Sizes
 */
export function IconSizesExample() {
  const sizes = [16, 24, 32, 48, 64] as const;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', padding: '20px' }}>
      {sizes.map(size => (
        <div key={size} style={{ textAlign: 'center' }}>
          <MacOSIcon name="assistant" category="apps" size={size} />
          <p style={{ marginTop: '8px', fontSize: '11px' }}>{size}px</p>
        </div>
      ))}
    </div>
  );
}
