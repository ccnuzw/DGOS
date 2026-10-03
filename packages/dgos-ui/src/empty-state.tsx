// EmptyState Component - Clear empty state display
import React from 'react';

/**
 * EmptyState props
 */
export interface EmptyStateProps {
  /** Icon or illustration */
  icon?: React.ReactNode;
  /** Main heading */
  title: string;
  /** Description message */
  description?: string;
  /** Primary action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Secondary action button */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Custom class name */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * EmptyState - Centered empty state with icon, message, and action
 *
 * Used when lists, tables, or views have no data. Provides clear next steps
 * without marketing copy.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = '',
  size = 'md',
}: EmptyStateProps) {
  return (
    <div className={`dgos-empty-state ${size} ${className}`} role="status">
      {icon && (
        <div className="empty-state-icon" aria-hidden="true">
          {icon}
        </div>
      )}

      <div className="empty-state-content">
        <h3 className="empty-state-title">{title}</h3>

        {description && (
          <p className="empty-state-description">{description}</p>
        )}
      </div>

      {(action || secondaryAction) && (
        <div className="empty-state-actions">
          {action && (
            <button
              className="dgos-button primary"
              onClick={action.onClick}
            >
              {action.label}
            </button>
          )}

          {secondaryAction && (
            <button
              className="dgos-button default"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
