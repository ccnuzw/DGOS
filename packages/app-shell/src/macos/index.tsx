// macOS Shell - Main Desktop Environment
// Integrates system bar, dock, windows, and launchpad
import React, { useState, useEffect, type ReactNode } from 'react';
import {
  AppWindow, FolderDown, Trash2
} from 'lucide-react';
import { routes, type RouteKey } from '@dgos/design-tokens';
import { MacOSSystemBar } from './system-bar';
import { MacOSDock, type DockApp } from './dock';
import { MacOSLaunchpad, type LaunchpadApp } from './launchpad';
import { WindowManager, useWindowManager } from './window-manager';
import {
  CatalogIcon,
  AssistantIcon,
  TasksIcon,
  SettingsIcon,
  ProvidersIcon,
  ModelsIcon,
  SkillsIcon,
  MCPIcon,
  DeveloperIcon,
} from './icons/app-icons';
import './macos.css';

export interface MacOSShellProps {
  currentRoute: RouteKey;
  labels: Record<string, string>;
  children: ReactNode;
  onNavigate: (route: RouteKey) => void;
  theme?: 'light' | 'dark';
  onThemeToggle?: () => void;
}

// Icon mapping for apps - using professional SVG icons
const appIcons: Record<string, ReactNode> = {
  desktop: <AppWindow size={32} />,
  catalog: <CatalogIcon />,
  settings: <SettingsIcon />,
  providers: <ProvidersIcon />,
  models: <ModelsIcon />,
  skills: <SkillsIcon />,
  mcp: <MCPIcon />,
  assistant: <AssistantIcon />,
  tasks: <TasksIcon />,
  developer: <DeveloperIcon />,
  downloads: <FolderDown size={32} />,
  trash: <Trash2 size={32} />,
};

export function MacOSShell({
  currentRoute,
  labels,
  children,
  onNavigate,
  theme = 'light',
  onThemeToggle,
}: MacOSShellProps) {
  const [launchpadVisible, setLaunchpadVisible] = useState(false);
  const [runningApps, setRunningApps] = useState<Set<string>>(new Set([currentRoute]));

  const {
    windows,
    focusedWindowId,
    setWindows,
    setFocusedWindowId,
  } = useWindowManager();

  // Update running apps when route changes
  useEffect(() => {
    setRunningApps((prev) => new Set([...prev, currentRoute]));
  }, [currentRoute]);

  // Define dock apps
  const dockApps: DockApp[] = [
    {
      id: 'catalog',
      name: labels.catalog || 'Catalog',
      icon: appIcons.catalog,
      route: 'catalog',
      isRunning: runningApps.has('catalog'),
      onClick: () => onNavigate('catalog'),
    },
    {
      id: 'assistant',
      name: labels.assistant || 'Assistant',
      icon: appIcons.assistant,
      route: 'assistant',
      isRunning: runningApps.has('assistant'),
      onClick: () => onNavigate('assistant'),
    },
    {
      id: 'tasks',
      name: labels.tasks || 'Tasks',
      icon: appIcons.tasks,
      route: 'tasks',
      isRunning: runningApps.has('tasks'),
      onClick: () => onNavigate('tasks'),
    },
    {
      id: 'providers',
      name: labels.providers || 'Providers',
      icon: appIcons.providers,
      route: 'providers',
      isRunning: runningApps.has('providers'),
      onClick: () => onNavigate('providers'),
    },
    {
      id: 'models',
      name: labels.models || 'Models',
      icon: appIcons.models,
      route: 'models',
      isRunning: runningApps.has('models'),
      onClick: () => onNavigate('models'),
    },
    {
      id: 'settings',
      name: labels.settings || 'Settings',
      icon: appIcons.settings,
      route: 'settings',
      isRunning: runningApps.has('settings'),
      onClick: () => onNavigate('settings'),
    },
    // System section (after divider)
    {
      id: 'downloads',
      name: labels.downloads || 'Downloads',
      icon: appIcons.downloads,
      onClick: () => console.log('Downloads clicked'),
    },
    {
      id: 'trash',
      name: labels.trash || 'Trash',
      icon: appIcons.trash,
      onClick: () => console.log('Trash clicked'),
    },
  ];

  // Define launchpad apps (all available apps)
  const launchpadApps: LaunchpadApp[] = [
    { id: 'catalog', name: labels.catalog || 'Catalog', icon: appIcons.catalog, onClick: () => onNavigate('catalog') },
    { id: 'assistant', name: labels.assistant || 'Assistant', icon: appIcons.assistant, onClick: () => onNavigate('assistant') },
    { id: 'tasks', name: labels.tasks || 'Tasks', icon: appIcons.tasks, onClick: () => onNavigate('tasks') },
    { id: 'settings', name: labels.settings || 'Settings', icon: appIcons.settings, onClick: () => onNavigate('settings') },
    { id: 'providers', name: labels.providers || 'Providers', icon: appIcons.providers, onClick: () => onNavigate('providers') },
    { id: 'models', name: labels.models || 'Models', icon: appIcons.models, onClick: () => onNavigate('models') },
    { id: 'skills', name: labels.skills || 'Skills', icon: appIcons.skills, onClick: () => onNavigate('skills') },
    { id: 'mcp', name: labels.mcp || 'MCP', icon: appIcons.mcp, onClick: () => onNavigate('mcp') },
    { id: 'developer', name: labels.developer || 'Developer', icon: appIcons.developer, onClick: () => onNavigate('developer') },
  ];

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K or Ctrl+K - Command palette (using launchpad for now)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setLaunchpadVisible((prev) => !prev);
      }

      // F4 - Launchpad
      if (e.key === 'F4') {
        e.preventDefault();
        setLaunchpadVisible((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="macos-desktop" data-theme={theme}>
      <MacOSSystemBar
        currentApp={labels[currentRoute]}
        onMenuClick={() => setLaunchpadVisible(true)}
        onSearchClick={() => setLaunchpadVisible(true)}
        onNotificationsClick={() => console.log('Notifications')}
        onSettingsClick={() => onNavigate('settings')}
        theme={theme}
        onThemeToggle={onThemeToggle}
      />

      <div className="macos-desktop__workspace">
        <WindowManager
          windows={windows}
          focusedWindowId={focusedWindowId}
          onWindowsChange={setWindows}
          onFocusChange={setFocusedWindowId}
        />

        {/* Main content area - rendered as the active "window" */}
        <div style={{
          padding: '24px',
          maxWidth: '1400px',
          margin: 'auto',
        }}>
          {children}
        </div>
      </div>

      <MacOSDock apps={dockApps} />

      <MacOSLaunchpad
        visible={launchpadVisible}
        apps={launchpadApps}
        onClose={() => setLaunchpadVisible(false)}
      />
    </div>
  );
}
