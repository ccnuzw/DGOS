/**
 * macOS Traffic Lights Component
 *
 * Standalone window control buttons (close, minimize, maximize)
 * with exact macOS styling and behavior.
 *
 * Design tokens from design-tokens/macos-tokens.ts:
 * - 12px circular buttons with 8px spacing
 * - Exact color matching: #FF5F56, #FFBD2E, #27C93F
 * - Hover states reveal symbols (×, −, +)
 * - Position: 12px from left, 10px from top
 */

import React, { type ButtonHTMLAttributes } from 'react';
import './macos-traffic-lights.css';

export interface TrafficLightProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /** Type of traffic light button */
  type: 'close' | 'minimize' | 'maximize';

  /** Whether parent window is focused */
  focused?: boolean;
}

/**
 * Individual Traffic Light Button
 */
export function TrafficLight({
  type,
  focused = true,
  className = '',
  ...props
}: TrafficLightProps) {
  const symbols = {
    close: '×',
    minimize: '−',
    maximize: '+',
  };

  const labels = {
    close: 'Close window',
    minimize: 'Minimize window',
    maximize: 'Maximize window',
  };

  return (
    <button
      className={`macos-traffic-light ${type} ${focused ? 'focused' : 'unfocused'} ${className}`}
      aria-label={labels[type]}
      title={labels[type]}
      type="button"
      {...props}
    >
      <span className="traffic-light-symbol" aria-hidden="true">
        {symbols[type]}
      </span>
    </button>
  );
}

export interface MacOSTrafficLightsProps {
  /** Callback when close button is clicked */
  onClose?: () => void;

  /** Callback when minimize button is clicked */
  onMinimize?: () => void;

  /** Callback when maximize button is clicked */
  onMaximize?: () => void;

  /** Whether parent window is focused */
  focused?: boolean;

  /** Additional CSS class */
  className?: string;

  /** Disable individual buttons */
  disableClose?: boolean;
  disableMinimize?: boolean;
  disableMaximize?: boolean;
}

/**
 * MacOSTrafficLights - Complete traffic lights group
 * Can be used standalone or integrated into window components
 */
export function MacOSTrafficLights({
  onClose,
  onMinimize,
  onMaximize,
  focused = true,
  className = '',
  disableClose = false,
  disableMinimize = false,
  disableMaximize = false,
}: MacOSTrafficLightsProps) {
  return (
    <div
      className={`macos-traffic-lights-group ${className}`}
      role="group"
      aria-label="Window controls"
    >
      <TrafficLight
        type="close"
        onClick={onClose}
        focused={focused}
        disabled={disableClose}
      />
      <TrafficLight
        type="minimize"
        onClick={onMinimize}
        focused={focused}
        disabled={disableMinimize}
      />
      <TrafficLight
        type="maximize"
        onClick={onMaximize}
        focused={focused}
        disabled={disableMaximize}
      />
    </div>
  );
}
