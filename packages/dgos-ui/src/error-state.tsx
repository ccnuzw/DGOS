// ErrorState Component - Error display with request_id and recovery actions
import React from 'react';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'warning' | 'error' | 'critical';

/**
 * ErrorState props
 */
export interface ErrorStateProps {
  /** Error severity */
  severity?: ErrorSeverity;
  /** Error title/message */
  title: string;
  /** Detailed error description */
  description?: string;
  /** Request ID for tracing */
  requestId?: string;
  /** Error code */
  code?: string;
  /** Retry action */
  onRetry?: () => void;
  /** Retry button label */
  retryLabel?: string;
  /** Additional recovery actions */
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'default' | 'danger';
  }>;
  /** Whether to show in inline/non-blocking mode */
  inline?: boolean;
  /** Dismissable */
  onDismiss?: () => void;
  /** Custom class name */
  className?: string;
}

/**
 * ErrorState - Error display with request_id, retry/recovery actions
 *
 * Non-blocking by default (doesn't cover existing results).
 * Supports different severity levels and provides clear recovery paths.
 */
export function ErrorState({
  severity = 'error',
  title,
  description,
  requestId,
  code,
  onRetry,
  retryLabel = 'Retry',
  actions = [],
  inline = false,
  onDismiss,
  className = '',
}: ErrorStateProps) {
  const severityIcons = {
    warning: '⚠️',
    error: '❌',
    critical: '🔴',
  };

  const severityLabels = {
    warning: 'Warning',
    error: 'Error',
    critical: 'Critical Error',
  };

  return (
    <div
      className={`dgos-error-state ${severity} ${inline ? 'inline' : ''} ${className}`}
      role="alert"
      aria-live={severity === 'critical' ? 'assertive' : 'polite'}
    >
      <div className="error-state-header">
        <div className="error-state-icon" aria-hidden="true">
          {severityIcons[severity]}
        </div>

        <div className="error-state-content">
          <div className="error-state-title-row">
            <h3 className="error-state-title">
              <span className="sr-only">{severityLabels[severity]}: </span>
              {title}
            </h3>

            {onDismiss && (
              <button
                className="error-state-dismiss"
                onClick={onDismiss}
                aria-label="Dismiss error"
              >
                ×
              </button>
            )}
          </div>

          {description && (
            <p className="error-state-description">{description}</p>
          )}

          {(requestId || code) && (
            <div className="error-state-meta">
              {code && (
                <span className="error-code">
                  Code: <code>{code}</code>
                </span>
              )}
              {requestId && (
                <span className="error-request-id">
                  Request ID: <code>{requestId}</code>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {(onRetry || actions.length > 0) && (
        <div className="error-state-actions">
          {onRetry && (
            <button
              className="dgos-button primary"
              onClick={onRetry}
            >
              {retryLabel}
            </button>
          )}

          {actions.map((action, index) => (
            <button
              key={index}
              className={`dgos-button ${action.variant || 'default'}`}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * InlineError - Compact inline error for form fields or small sections
 */
export interface InlineErrorProps {
  /** Error message */
  message: string;
  /** Request ID */
  requestId?: string;
  /** Custom class name */
  className?: string;
}

export function InlineError({ message, requestId, className = '' }: InlineErrorProps) {
  return (
    <div className={`dgos-inline-error ${className}`} role="alert">
      <span className="inline-error-icon" aria-hidden="true">⚠️</span>
      <span className="inline-error-message">{message}</span>
      {requestId && (
        <span className="inline-error-request-id">
          <code>{requestId}</code>
        </span>
      )}
    </div>
  );
}
