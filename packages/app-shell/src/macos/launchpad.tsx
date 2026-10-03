// macOS Launchpad Component
// Full-screen app grid overlay
import React, { useEffect, useRef } from 'react';

export interface LaunchpadApp {
  id: string;
  name: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

export interface MacOSLaunchpadProps {
  visible: boolean;
  apps: LaunchpadApp[];
  onAppClick?: (appId: string) => void;
  onClose: () => void;
}

export function MacOSLaunchpad({
  visible,
  apps,
  onAppClick,
  onClose,
}: MacOSLaunchpadProps) {
  const launchpadRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = React.useState(false);

  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'F4') {
        e.preventDefault();
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  useEffect(() => {
    if (visible) {
      setIsClosing(false);
      // Focus first app for keyboard navigation
      setTimeout(() => {
        const firstApp = launchpadRef.current?.querySelector<HTMLElement>('.macos-launchpad__item');
        firstApp?.focus();
      }, 100);
    }
  }, [visible]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleAppClick = (app: LaunchpadApp) => {
    if (app.onClick) {
      app.onClick();
    } else if (onAppClick) {
      onAppClick(app.id);
    }
    handleClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent, app: LaunchpadApp, index: number) => {
    const items = launchpadRef.current?.querySelectorAll<HTMLElement>('.macos-launchpad__item');
    if (!items) return;

    let nextIndex = index;

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        handleAppClick(app);
        break;
      case 'ArrowRight':
        e.preventDefault();
        nextIndex = Math.min(index + 1, items.length - 1);
        items[nextIndex]?.focus();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        nextIndex = Math.max(index - 1, 0);
        items[nextIndex]?.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        nextIndex = Math.min(index + 7, items.length - 1); // 7 columns
        items[nextIndex]?.focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        nextIndex = Math.max(index - 7, 0);
        items[nextIndex]?.focus();
        break;
      case 'Home':
        e.preventDefault();
        items[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        items[items.length - 1]?.focus();
        break;
    }
  };

  if (!visible && !isClosing) {
    return null;
  }

  return (
    <div
      ref={launchpadRef}
      className={`macos-launchpad ${isClosing ? 'macos-launchpad--closing' : ''}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Application Launcher"
    >
      <button className="macos-launchpad__backdrop-close" aria-label="Close application launcher" onClick={handleClose} type="button" />
      <div className="macos-launchpad__grid">
        {apps.map((app, index) => (
          <div
            key={app.id}
            className="macos-launchpad__item"
            role="button"
            tabIndex={0}
            aria-label={app.name}
            onClick={() => handleAppClick(app)}
            onKeyDown={(e) => handleKeyDown(e, app, index)}
          >
            <div className="macos-launchpad__icon">
              {app.icon}
            </div>
            <div className="macos-launchpad__label">
              {app.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
