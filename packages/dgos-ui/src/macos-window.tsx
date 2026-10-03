/**
 * macOS Window Frame Component
 *
 * A macOS-inspired window with title bar, rounded corners, and glassmorphism effect.
 * Supports focus/unfocus states and light/dark themes via CSS variables.
 *
 * Design: Uses tokens from design-tokens/macos-tokens.ts
 * - 12px rounded corners for native macOS feel
 * - Glass morphism: blur(20px) saturate(180%)
 * - Elevation with dynamic shadows based on focus state
 * - 32px title bar height with traffic lights integration
 */

import React, { type HTMLAttributes, type PropsWithChildren } from 'react';
import './macos-window.css';

export interface MacOSWindowProps extends PropsWithChildren<HTMLAttributes<HTMLDivElement>> {
  /** Window title displayed in title bar */
  title?: string;

  /** Whether window is focused (affects shadow and opacity) */
  focused?: boolean;

  /** Whether to show traffic lights (close, minimize, maximize) */
  showTrafficLights?: boolean;

  /** Width of window (default: 800px) */
  width?: string | number;

  /** Height of window (default: 600px) */
  height?: string | number;

  /** Minimum width constraint */
  minWidth?: string | number;

  /** Minimum height constraint */
  minHeight?: string | number;

  /** Traffic lights callbacks */
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;

  /** Whether window is resizable */
  resizable?: boolean;
}

/**
 * MacOSWindow - Main window container with title bar
 */
export function MacOSWindow({
  title = 'Untitled',
  focused = true,
  showTrafficLights = true,
  width,
  height,
  minWidth,
  minHeight,
  onClose,
  onMinimize,
  onMaximize,
  resizable = true,
  children,
  className = '',
  style,
  ...props
}: MacOSWindowProps) {
  const windowStyle: React.CSSProperties = {
    width,
    height,
    minWidth,
    minHeight,
    ...style,
  };

  return (
    <div
      className={`macos-window ${focused ? 'focused' : 'unfocused'} ${resizable ? 'resizable' : ''} ${className}`}
      style={windowStyle}
      role="dialog"
      aria-label={title}
      {...props}
    >
      {/* Title Bar */}
      <div className="macos-window-titlebar">
        {/* Traffic Lights - rendered as placeholder div, actual component imported separately */}
        {showTrafficLights && (
          <div
            className="macos-window-traffic-lights-container"
            role="group"
            aria-label="Window controls"
          >
            <button
              className="macos-traffic-light close"
              onClick={onClose}
              aria-label="Close window"
              title="Close"
              type="button"
            >
              <span className="traffic-light-symbol">×</span>
            </button>
            <button
              className="macos-traffic-light minimize"
              onClick={onMinimize}
              aria-label="Minimize window"
              title="Minimize"
              type="button"
            >
              <span className="traffic-light-symbol">−</span>
            </button>
            <button
              className="macos-traffic-light maximize"
              onClick={onMaximize}
              aria-label="Maximize window"
              title="Maximize"
              type="button"
            >
              <span className="traffic-light-symbol">+</span>
            </button>
          </div>
        )}

        {/* Window Title */}
        <div className="macos-window-title" title={title}>
          {title}
        </div>
      </div>

      {/* Window Content */}
      <div className="macos-window-content">
        {children}
      </div>

      {/* Resize Handles (only if resizable) */}
      {resizable && (
        <>
          <div className="macos-window-resize-handle top" />
          <div className="macos-window-resize-handle right" />
          <div className="macos-window-resize-handle bottom" />
          <div className="macos-window-resize-handle left" />
          <div className="macos-window-resize-handle top-left" />
          <div className="macos-window-resize-handle top-right" />
          <div className="macos-window-resize-handle bottom-left" />
          <div className="macos-window-resize-handle bottom-right" />
        </>
      )}
    </div>
  );
}
