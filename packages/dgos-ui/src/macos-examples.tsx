/**
 * macOS Components Usage Examples
 *
 * This file demonstrates how to use the macOS Core Visual Components:
 * - MacOSWindow: Window with title bar and traffic lights
 * - MacOSTrafficLights: Standalone traffic light controls
 * - MacOSDock: Bottom app launcher with magnification
 * - MacOSSystemBar: Top system bar with search and controls
 */

import React from 'react';
import {
  MacOSWindow,
  MacOSTrafficLights,
  MacOSDock,
  MacOSSystemBar,
  SystemBarIcon,
  type DockApp,
} from './index';

/**
 * Example 1: Basic Window
 */
export function BasicWindowExample() {
  return (
    <MacOSWindow
      title="My Application"
      focused={true}
      width={800}
      height={600}
      onClose={() => console.log('Close')}
      onMinimize={() => console.log('Minimize')}
      onMaximize={() => console.log('Maximize')}
    >
      <div style={{ padding: '20px' }}>
        <h1>Welcome to DGOS</h1>
        <p>This is a macOS-style window component.</p>
      </div>
    </MacOSWindow>
  );
}

/**
 * Example 2: Standalone Traffic Lights
 */
export function TrafficLightsExample() {
  return (
    <div style={{ padding: '20px' }}>
      <h2>Window Controls</h2>
      <MacOSTrafficLights
        focused={true}
        onClose={() => alert('Closed')}
        onMinimize={() => alert('Minimized')}
        onMaximize={() => alert('Maximized')}
      />
    </div>
  );
}

/**
 * Example 3: Dock with Apps
 */
export function DockExample() {
  const apps: DockApp[] = [
    {
      id: 'finder',
      name: 'Finder',
      icon: '📁',
      running: true,
      onClick: () => console.log('Finder clicked'),
    },
    {
      id: 'messages',
      name: 'Messages',
      icon: '💬',
      running: true,
      badge: 5,
      onClick: () => console.log('Messages clicked'),
    },
    {
      id: 'mail',
      name: 'Mail',
      icon: '✉️',
      running: false,
      badge: 12,
      onClick: () => console.log('Mail clicked'),
    },
    {
      id: 'calendar',
      name: 'Calendar',
      icon: '📅',
      running: true,
      onClick: () => console.log('Calendar clicked'),
    },
    {
      id: 'photos',
      name: 'Photos',
      icon: '🖼️',
      running: false,
      onClick: () => console.log('Photos clicked'),
    },
  ];

  const systemApps: DockApp[] = [
    {
      id: 'settings',
      name: 'Settings',
      icon: '⚙️',
      running: false,
      onClick: () => console.log('Settings clicked'),
    },
    {
      id: 'trash',
      name: 'Trash',
      icon: '🗑️',
      running: false,
      onClick: () => console.log('Trash clicked'),
    },
  ];

  return (
    <MacOSDock
      apps={apps}
      systemApps={systemApps}
      position="bottom"
      magnification={true}
    />
  );
}

/**
 * Example 4: System Bar
 */
export function SystemBarExample() {
  const menuItems = [
    { id: 'file', label: 'File', onClick: () => console.log('File') },
    { id: 'edit', label: 'Edit', onClick: () => console.log('Edit') },
    { id: 'view', label: 'View', onClick: () => console.log('View') },
  ];

  return (
    <MacOSSystemBar
      appName="DGOS"
      showSearch={true}
      onSearch={(query) => console.log('Search:', query)}
      menuItems={menuItems}
      controls={
        <>
          <SystemBarIcon
            icon="🔔"
            label="Notifications"
            badge={true}
            badgeCount={3}
            onClick={() => console.log('Notifications')}
          />
          <SystemBarIcon
            icon="👤"
            label="User Profile"
            onClick={() => console.log('Profile')}
          />
        </>
      }
    />
  );
}

/**
 * Example 5: Complete macOS Layout
 */
export function CompleteMacOSLayout() {
  const [windowFocused, setWindowFocused] = React.useState(true);

  const dockApps: DockApp[] = [
    { id: '1', name: 'App 1', icon: '📱', running: true, onClick: () => {} },
    { id: '2', name: 'App 2', icon: '💻', running: true, badge: 2, onClick: () => {} },
    { id: '3', name: 'App 3', icon: '🎵', running: false, onClick: () => {} },
    { id: '4', name: 'App 4', icon: '📸', running: true, onClick: () => {} },
  ];

  return (
    <div style={{ height: '100vh', background: '#f0f0f0', position: 'relative' }}>
      {/* System Bar */}
      <MacOSSystemBar
        appName="DGOS"
        showSearch={true}
        onSearch={(q) => console.log('Search:', q)}
        controls={
          <SystemBarIcon
            icon="⚙️"
            label="Settings"
            onClick={() => console.log('Settings')}
          />
        }
      />

      {/* Main Content Area */}
      <div style={{ paddingTop: '44px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 44px)' }}>
        <MacOSWindow
          title="Example Application"
          focused={windowFocused}
          width={700}
          height={500}
          onClose={() => console.log('Close')}
          onMinimize={() => console.log('Minimize')}
          onMaximize={() => console.log('Maximize')}
        >
          <div style={{ padding: '24px' }}>
            <h1 style={{ marginTop: 0 }}>DGOS Application</h1>
            <p>This demonstrates the complete macOS visual experience:</p>
            <ul>
              <li>System Bar with search and controls</li>
              <li>Window with glass morphism effect</li>
              <li>Traffic lights for window control</li>
              <li>Dock at the bottom with app icons</li>
            </ul>
            <button onClick={() => setWindowFocused(!windowFocused)}>
              Toggle Window Focus
            </button>
          </div>
        </MacOSWindow>
      </div>

      {/* Dock */}
      <MacOSDock apps={dockApps} position="bottom" magnification={true} />
    </div>
  );
}
