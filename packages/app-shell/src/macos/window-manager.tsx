// macOS Window Manager
// Manages multiple windows, z-index, focus, and state
import React, { useState, useCallback, useEffect, type ReactNode } from 'react';
import { MacOSWindow, type WindowBounds, type WindowState } from './window';
import { WindowTabBar, type WindowTab } from './window-tabs';
import type { RouteKey } from '@dgos/design-tokens';

export interface WindowInstance {
  id: string;
  route: RouteKey;
  title: string;
  content: ReactNode;
  bounds: WindowBounds;
  state: WindowState;
  zIndex: number;
  minWidth?: number;
  minHeight?: number;
  icon?: ReactNode;
}

export interface WindowManagerProps {
  windows: WindowInstance[];
  focusedWindowId: string | null;
  onWindowsChange: (windows: WindowInstance[]) => void;
  onFocusChange: (windowId: string | null) => void;
}

export function WindowManager({
  windows,
  focusedWindowId,
  onWindowsChange,
  onFocusChange,
}: WindowManagerProps) {
  const handleWindowClose = useCallback((windowId: string) => {
    const updatedWindows = windows.filter((w) => w.id !== windowId);
    onWindowsChange(updatedWindows);

    // Focus the next highest window
    if (focusedWindowId === windowId && updatedWindows.length > 0) {
      const nextWindow = updatedWindows.reduce((highest, current) =>
        current.zIndex > highest.zIndex ? current : highest
      );
      onFocusChange(nextWindow.id);
    } else if (updatedWindows.length === 0) {
      onFocusChange(null);
    }
  }, [windows, focusedWindowId, onWindowsChange, onFocusChange]);

  const handleWindowMinimize = useCallback((windowId: string) => {
    const updatedWindows = windows.map((w) =>
      w.id === windowId ? { ...w, state: 'minimized' as WindowState } : w
    );
    onWindowsChange(updatedWindows);

    // Focus the next highest window
    const visibleWindows = updatedWindows.filter((w) => w.state !== 'minimized');
    if (visibleWindows.length > 0) {
      const nextWindow = visibleWindows.reduce((highest, current) =>
        current.zIndex > highest.zIndex ? current : highest
      );
      onFocusChange(nextWindow.id);
    } else {
      onFocusChange(null);
    }
  }, [windows, onWindowsChange, onFocusChange]);

  const handleWindowMaximize = useCallback((windowId: string) => {
    const updatedWindows = windows.map((w) => {
      if (w.id === windowId) {
        const newState: WindowState = w.state === 'maximized' ? 'normal' : 'maximized';
        return { ...w, state: newState };
      }
      return w;
    });
    onWindowsChange(updatedWindows);
  }, [windows, onWindowsChange]);

  const handleWindowFocus = useCallback((windowId: string) => {
    if (focusedWindowId === windowId) return;

    // Find the highest z-index
    const maxZIndex = windows.reduce((max, w) => Math.max(max, w.zIndex), 0);

    // Update z-index for the focused window
    const updatedWindows = windows.map((w) =>
      w.id === windowId ? { ...w, zIndex: maxZIndex + 1 } : w
    );

    onWindowsChange(updatedWindows);
    onFocusChange(windowId);
  }, [windows, focusedWindowId, onWindowsChange, onFocusChange]);

  const handleWindowBoundsChange = useCallback((windowId: string, bounds: WindowBounds) => {
    const updatedWindows = windows.map((w) =>
      w.id === windowId ? { ...w, bounds } : w
    );
    onWindowsChange(updatedWindows);
  }, [windows, onWindowsChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if Cmd/Ctrl is pressed
      if (!e.metaKey && !e.ctrlKey) return;

      // Cmd+W - Close focused window
      if (e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (focusedWindowId) {
          handleWindowClose(focusedWindowId);
        }
      }

      // Cmd+M - Minimize focused window
      if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        if (focusedWindowId) {
          handleWindowMinimize(focusedWindowId);
        }
      }

      // Cmd+` - Cycle through windows
      if (e.key === '`') {
        e.preventDefault();
        const visibleWindows = windows.filter((w) => w.state !== 'minimized');
        if (visibleWindows.length > 1) {
          const currentIndex = visibleWindows.findIndex((w) => w.id === focusedWindowId);
          const nextIndex = (currentIndex + 1) % visibleWindows.length;
          handleWindowFocus(visibleWindows[nextIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [windows, focusedWindowId, handleWindowClose, handleWindowMinimize, handleWindowFocus]);

  // Filter out minimized windows (they're in the Dock)
  const visibleWindows = windows.filter((w) => w.state !== 'minimized');

  // Check if any window is maximized
  const hasMaximizedWindow = visibleWindows.some((w) => w.state === 'maximized');

  // Create tabs for tab bar (only show when a window is maximized)
  const tabs: WindowTab[] = hasMaximizedWindow
    ? visibleWindows.map((w) => ({
        id: w.id,
        title: w.title,
        icon: w.icon,
        active: w.id === focusedWindowId,
      }))
    : [];

  return (
    <>
      {/* Tab bar removed - tabs now integrated into system bar */}
      {visibleWindows.map((window) => (
        <MacOSWindow
          key={window.id}
          id={window.id}
          title={window.title}
          bounds={window.bounds}
          state={window.state}
          zIndex={window.zIndex}
          focused={focusedWindowId === window.id}
          minWidth={window.minWidth}
          minHeight={window.minHeight}
          onClose={() => handleWindowClose(window.id)}
          onMinimize={() => handleWindowMinimize(window.id)}
          onMaximize={() => handleWindowMaximize(window.id)}
          onFocus={() => handleWindowFocus(window.id)}
          onBoundsChange={(bounds) => handleWindowBoundsChange(window.id, bounds)}
          hasTabBar={hasMaximizedWindow}
        >
          {window.content}
        </MacOSWindow>
      ))}
    </>
  );
}

// Helper hook for managing windows
export function useWindowManager() {
  const [windows, setWindows] = useState<WindowInstance[]>([]);
  const [focusedWindowId, setFocusedWindowId] = useState<string | null>(null);
  const [nextZIndex, setNextZIndex] = useState(10);

  const openWindow = useCallback((
    route: RouteKey,
    title: string,
    content: ReactNode,
    options?: Partial<Omit<WindowInstance, 'id' | 'route' | 'title' | 'content' | 'zIndex'>>
  ) => {
    const windowId = `window-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newWindow: WindowInstance = {
      id: windowId,
      route,
      title,
      content,
      bounds: options?.bounds || {
        x: 100 + (windows.length * 30),
        y: 100 + (windows.length * 30),
        width: 800,
        height: 600,
      },
      state: options?.state || 'normal',
      zIndex: nextZIndex,
      minWidth: options?.minWidth || 400,
      minHeight: options?.minHeight || 300,
      icon: options?.icon,
    };

    setWindows((prev) => [...prev, newWindow]);
    setFocusedWindowId(windowId);
    setNextZIndex((prev) => prev + 1);

    return windowId;
  }, [windows.length, nextZIndex]);

  const closeWindow = useCallback((windowId: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== windowId));
    setFocusedWindowId((prev) => prev === windowId ? null : prev);
  }, []);

  const minimizeWindow = useCallback((windowId: string) => {
    setWindows((prev) =>
      prev.map((w) => w.id === windowId ? { ...w, state: 'minimized' as WindowState } : w)
    );
  }, []);

  const restoreWindow = useCallback((windowId: string) => {
    setWindows((prev) =>
      prev.map((w) => w.id === windowId ? { ...w, state: 'normal' as WindowState } : w)
    );
    setFocusedWindowId(windowId);
    setNextZIndex((prev) => prev + 1);
  }, []);

  return {
    windows,
    focusedWindowId,
    openWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    setWindows,
    setFocusedWindowId,
  };
}
