// macOS Dock Component
// Bottom-centered app launcher with advanced magnification effects
import React, { useState, useRef, useEffect } from 'react';
import type { RouteKey } from '@dgos/design-tokens';

export interface DockApp {
  id: string;
  name: string;
  icon: React.ReactNode;
  route?: RouteKey;
  isRunning?: boolean;
  badge?: number;
  onClick?: () => void;
}

export interface MacOSDockProps {
  apps: DockApp[];
  hidden?: boolean;
  onAppClick?: (appId: string) => void;
  onAppRightClick?: (appId: string, event: React.MouseEvent) => void;
}

// Calculate icon scale based on mouse position with realistic macOS magnification
function calculateIconScale(
  mouseX: number,
  iconCenter: number,
  maxScale: number = 1.5
): number {
  const distance = Math.abs(mouseX - iconCenter);
  const influenceRange = 100; // pixels

  if (distance > influenceRange) return 1;

  // Use a cosine curve for smooth magnification
  const normalizedDistance = distance / influenceRange;
  const scale = 1 + (maxScale - 1) * Math.cos(normalizedDistance * Math.PI / 2);

  return scale;
}

export function MacOSDock({ apps, hidden = false, onAppClick, onAppRightClick }: MacOSDockProps) {
  const [mousePosition, setMousePosition] = useState<number | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const iconRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePosition(e.clientX);
  };

  const handleMouseLeave = () => {
    setMousePosition(null);
  };

  const handleAppClick = (app: DockApp) => {
    if (app.onClick) {
      app.onClick();
    } else if (onAppClick) {
      onAppClick(app.id);
    }
  };

  const handleRightClick = (app: DockApp, event: React.MouseEvent) => {
    event.preventDefault();
    if (onAppRightClick) {
      onAppRightClick(app.id, event);
    }
  };

  // Calculate scale for each icon based on mouse position
  const getIconScale = (index: number): number => {
    if (mousePosition === null) return 1;

    const iconElement = iconRefs.current[index];
    if (!iconElement) return 1;

    const rect = iconElement.getBoundingClientRect();
    const iconCenter = rect.left + rect.width / 2;

    return calculateIconScale(mousePosition, iconCenter);
  };

  // Find the divider position (between apps and system items)
  const dividerIndex = apps.findIndex((app) => app.id === 'downloads' || app.id === 'trash');
  const hasSystemSection = dividerIndex !== -1;

  return (
    <div
      ref={dockRef}
      className={`macos-dock ${hidden ? 'macos-dock--hidden' : ''}`}
      role="toolbar"
      aria-label="Application Dock"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {apps.map((app, index) => {
        const scale = getIconScale(index);

        return (
          <React.Fragment key={app.id}>
            {hasSystemSection && index === dividerIndex && (
              <div className="macos-dock__divider" role="separator" aria-hidden="true" />
            )}

            <div
              ref={(el) => {
                iconRefs.current[index] = el;
              }}
              className={`macos-dock__item ${app.isRunning ? 'macos-dock__item--running' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={app.name}
              onClick={() => handleAppClick(app)}
              onContextMenu={(e) => handleRightClick(app, e)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleAppClick(app);
                }
              }}
              style={{
                position: 'relative',
                width: '60px',
                height: '60px',
                cursor: 'pointer',
                transition: 'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                transformOrigin: 'center bottom',
                flexShrink: 0,
                transform: `scale(${scale}) translateY(${scale > 1 ? -(scale - 1) * 8 : 0}px)`,
                zIndex: Math.round(scale * 10),
              }}
            >
              <div
                className="macos-dock__icon"
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 0.5px rgba(0, 0, 0, 0.1)',
                  transition: 'box-shadow 200ms ease',
                }}
              >
                {app.icon}
              </div>

              {app.isRunning && (
                <div className="macos-dock__indicator" aria-label="Running" />
              )}

              {app.badge && app.badge > 0 && (
                <div className="macos-dock__badge" aria-label={`${app.badge} notifications`}>
                  {app.badge > 99 ? '99+' : app.badge}
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
