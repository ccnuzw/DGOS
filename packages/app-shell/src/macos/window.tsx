// macOS Window Component
// Window frame with traffic lights (red/yellow/green buttons)
import React, { useState, useRef, useEffect, type ReactNode } from 'react';

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type WindowState = 'normal' | 'minimized' | 'maximized' | 'fullscreen';

export interface MacOSWindowProps {
  id: string;
  title: string;
  children: ReactNode;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onFocus?: () => void;
  onBoundsChange?: (bounds: WindowBounds) => void;
  bounds?: WindowBounds;
  state?: WindowState;
  focused?: boolean;
  zIndex?: number;
  minWidth?: number;
  minHeight?: number;
}

export function MacOSWindow({
  id,
  title,
  children,
  onClose,
  onMinimize,
  onMaximize,
  onFocus,
  onBoundsChange,
  bounds = { x: 100, y: 100, width: 800, height: 600 },
  state = 'normal',
  focused = true,
  zIndex = 10,
  minWidth = 400,
  minHeight = 300,
}: MacOSWindowProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [resizeDirection, setResizeDirection] = useState<string>('');
  const windowRef = useRef<HTMLDivElement>(null);

  const handleTitleBarMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    if ((e.target as HTMLElement).closest('.macos-window__traffic-lights')) return;

    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - bounds.x,
      y: e.clientY - bounds.y,
    });
    onFocus?.();
  };

  const handleTitleBarDoubleClick = () => {
    onMaximize?.();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragStart.x;
      const newY = Math.max(44, e.clientY - dragStart.y); // Don't go above system bar

      onBoundsChange?.({
        ...bounds,
        x: newX,
        y: newY,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart, bounds, onBoundsChange]);

  const handleResizeMouseDown = (e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: bounds.width,
      height: bounds.height,
    });
    onFocus?.();
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;

      let newBounds = { ...bounds };

      if (resizeDirection.includes('e')) {
        newBounds.width = Math.max(minWidth, resizeStart.width + deltaX);
      }
      if (resizeDirection.includes('w')) {
        const newWidth = Math.max(minWidth, resizeStart.width - deltaX);
        const widthDiff = newWidth - bounds.width;
        newBounds.width = newWidth;
        newBounds.x = bounds.x - widthDiff;
      }
      if (resizeDirection.includes('s')) {
        newBounds.height = Math.max(minHeight, resizeStart.height + deltaY);
      }
      if (resizeDirection.includes('n')) {
        const newHeight = Math.max(minHeight, resizeStart.height - deltaY);
        const heightDiff = newHeight - bounds.height;
        newBounds.height = newHeight;
        newBounds.y = bounds.y - heightDiff;
      }

      onBoundsChange?.(newBounds);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeDirection('');
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeDirection, resizeStart, bounds, onBoundsChange, minWidth, minHeight]);

  const windowClasses = [
    'macos-window',
    focused ? 'macos-window--focused' : 'macos-window--unfocused',
    state === 'maximized' ? 'macos-window--maximized' : '',
  ].filter(Boolean).join(' ');

  const windowStyle: React.CSSProperties = state === 'maximized' ? {
    zIndex,
  } : {
    left: bounds.x,
    top: bounds.y,
    width: bounds.width,
    height: bounds.height,
    zIndex,
  };

  return (
    <div
      ref={windowRef}
      className={windowClasses}
      style={windowStyle}
      onClick={onFocus}
      role="dialog"
      aria-label={title}
      aria-modal="false"
    >
      <div
        className="macos-window__title-bar"
        onMouseDown={handleTitleBarMouseDown}
        onDoubleClick={handleTitleBarDoubleClick}
      >
        <div className="macos-window__traffic-lights">
          <button
            className="macos-window__traffic-light macos-window__traffic-light--close"
            onClick={onClose}
            aria-label="Close"
            type="button"
          />
          <button
            className="macos-window__traffic-light macos-window__traffic-light--minimize"
            onClick={onMinimize}
            aria-label="Minimize"
            type="button"
          />
          <button
            className="macos-window__traffic-light macos-window__traffic-light--maximize"
            onClick={onMaximize}
            aria-label={state === 'maximized' ? 'Restore' : 'Maximize'}
            type="button"
          />
        </div>

        <div className="macos-window__title">{title}</div>
      </div>

      <div className="macos-window__content">
        {children}
      </div>

      {/* Resize handles - only show when not maximized */}
      {state !== 'maximized' && (
        <>
          {/* Edges */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '8px',
              height: '100%',
              cursor: 'ew-resize',
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'e')}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              height: '8px',
              cursor: 'ns-resize',
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, 's')}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '8px',
              height: '100%',
              cursor: 'ew-resize',
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'w')}
          />
          <div
            style={{
              position: 'absolute',
              top: 32,
              left: 0,
              width: '100%',
              height: '8px',
              cursor: 'ns-resize',
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'n')}
          />

          {/* Corners */}
          <div
            style={{
              position: 'absolute',
              top: 32,
              right: 0,
              width: '12px',
              height: '12px',
              cursor: 'ne-resize',
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '12px',
              height: '12px',
              cursor: 'se-resize',
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '12px',
              height: '12px',
              cursor: 'sw-resize',
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
          />
          <div
            style={{
              position: 'absolute',
              top: 32,
              left: 0,
              width: '12px',
              height: '12px',
              cursor: 'nw-resize',
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'nw')}
          />
        </>
      )}
    </div>
  );
}
