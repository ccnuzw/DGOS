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
import { CommandPalette, type CommandItem } from './command-palette';
import { NotificationCenter, type Notification } from './notification-center';
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
  SystemIcon,
  DownloadsIcon,
  TrashIcon,
} from './icons/premium-app-icons';
import './macos.css';
import './premium-macos.css';
import './ultra-realistic-macos.css';
import './premium-dock.css';
import './perfect-traffic-lights.css';
import './integrated-tabs.css';
import './disable-context-menu.css';
import './window-tabs.css';

// Re-export new components and types
export { CommandPalette, type CommandItem } from './command-palette';
export { NotificationCenter, type Notification, ToastNotification } from './notification-center';
export { WindowTabBar, type WindowTab } from './window-tabs';
export { useWindowManager, type WindowInstance } from './window-manager';

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
  const [commandPaletteVisible, setCommandPaletteVisible] = useState(false);
  const [notificationCenterVisible, setNotificationCenterVisible] = useState(false);
  const [runningApps, setRunningApps] = useState<Set<string>>(new Set([currentRoute]));
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const {
    windows,
    focusedWindowId,
    openWindow,
    setWindows,
    setFocusedWindowId,
  } = useWindowManager();

  const hasMaximizedWindow = windows.some((window) => window.state === 'maximized');

  // Open window for current route on mount and when route changes
  useEffect(() => {
    // Check if window for this route already exists
    const existingWindow = windows.find((w) => w.route === currentRoute);

    if (!existingWindow && currentRoute !== 'desktop') {
      // Open a new window for this route
      openWindow(
        currentRoute,
        labels[currentRoute] || currentRoute,
        children,
        {
          icon: appIcons[currentRoute],
        }
      );
    } else if (existingWindow) {
      // Focus existing window and update its content
      setFocusedWindowId(existingWindow.id);
      setWindows((prev) =>
        prev.map((w) =>
          w.id === existingWindow.id ? { ...w, content: children } : w
        )
      );
    }
  }, [currentRoute, children, labels, windows, openWindow, setWindows, setFocusedWindowId]);

  // Update running apps based on open windows
  useEffect(() => {
    const runningRoutes = new Set(windows.map((w) => w.route));
    setRunningApps(runningRoutes);
  }, [windows]);

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

  // Define command palette items
  const commandItems: CommandItem[] = launchpadApps.map((app) => ({
    id: app.id,
    type: 'app' as const,
    label: app.name,
    description: `Open ${app.name}`,
    icon: app.icon,
    onExecute: app.onClick,
  }));

  // Disable browser context menu on desktop
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // Only prevent on desktop area, not in windows
      if ((e.target as HTMLElement).closest('.macos-desktop') &&
          !(e.target as HTMLElement).closest('.macos-window__content')) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K or Ctrl+K - Command palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteVisible((prev) => !prev);
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
        onMenuClick={() => setLaunchpadVisible((visible) => !visible)}
        onSearchClick={() => setCommandPaletteVisible(true)}
        onNotificationsClick={() => setNotificationCenterVisible(true)}
        onSettingsClick={() => onNavigate('settings')}
        theme={theme}
        onThemeToggle={onThemeToggle}
        windows={windows}
        focusedWindowId={focusedWindowId}
        onWindowFocus={setFocusedWindowId}
        onWindowClose={(windowId) => {
          setWindows((prev) => prev.filter((w) => w.id !== windowId));
        }}
        onLauncherClick={() => setLaunchpadVisible((visible) => !visible)}
      />

      <div className="macos-desktop__workspace">
        <WindowManager
          windows={windows}
          focusedWindowId={focusedWindowId}
          onWindowsChange={setWindows}
          onFocusChange={setFocusedWindowId}
        />

        {/* Desktop background - empty workspace when no windows or windows are open */}
      </div>

      <MacOSDock apps={dockApps} hidden={hasMaximizedWindow || launchpadVisible} />

      <MacOSLaunchpad
        visible={launchpadVisible}
        apps={launchpadApps}
        onClose={() => setLaunchpadVisible(false)}
      />

      <CommandPalette
        visible={commandPaletteVisible}
        items={commandItems}
        onClose={() => setCommandPaletteVisible(false)}
        placeholder={labels.commandPalettePlaceholder || 'Search apps and actions...'}
        recentLabel={labels.recentLabel || 'Recent'}
        noResultsLabel={labels.noResultsLabel || 'No results found'}
      />

      <NotificationCenter
        visible={notificationCenterVisible}
        notifications={notifications}
        onClose={() => setNotificationCenterVisible(false)}
        onNotificationDismiss={(id) => {
          setNotifications((prev) => prev.filter((n) => n.id !== id));
        }}
        titleText={labels.notificationsTitle || 'Notifications'}
        clearAllText={labels.clearAllText || 'Clear All'}
        emptyMessage={labels.noNotificationsMessage || 'No notifications'}
      />
    </div>
  );
}
