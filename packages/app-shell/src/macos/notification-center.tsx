// macOS Notification Center
// System notifications with grouping and actions
import React, { useState, useEffect, type ReactNode } from 'react';
import { X, Bell, Check, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';

export interface NotificationAction {
  id: string;
  label: string;
  primary?: boolean;
  onAction: () => void;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  priority?: NotificationPriority;
  timestamp: Date;
  icon?: ReactNode;
  appName?: string;
  actions?: NotificationAction[];
  persistent?: boolean; // Don't auto-dismiss
  read?: boolean;
}

export interface NotificationCenterProps {
  visible: boolean;
  notifications: Notification[];
  onClose: () => void;
  onNotificationDismiss?: (id: string) => void;
  onNotificationAction?: (notificationId: string, actionId: string) => void;
  onClearAll?: () => void;
  emptyMessage?: string;
  titleText?: string;
  clearAllText?: string;
}

// Get severity icon
function getSeverityIcon(severity: NotificationSeverity, size = 20): ReactNode {
  switch (severity) {
    case 'success':
      return <Check size={size} />;
    case 'error':
      return <AlertCircle size={size} />;
    case 'warning':
      return <AlertTriangle size={size} />;
    case 'info':
    default:
      return <Info size={size} />;
  }
}

// Format timestamp
function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function NotificationCenter({
  visible,
  notifications,
  onClose,
  onNotificationDismiss,
  onNotificationAction,
  onClearAll,
  emptyMessage = 'No notifications',
  titleText = 'Notifications',
  clearAllText = 'Clear All',
}: NotificationCenterProps) {
  const [localNotifications, setLocalNotifications] = useState(notifications);

  useEffect(() => {
    setLocalNotifications(notifications);
  }, [notifications]);

  // Sort by priority and timestamp
  const sortedNotifications = [...localNotifications].sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    const aPriority = priorityOrder[a.priority || 'normal'];
    const bPriority = priorityOrder[b.priority || 'normal'];

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    return b.timestamp.getTime() - a.timestamp.getTime();
  });

  // Group notifications by date
  const groupedNotifications = sortedNotifications.reduce((acc, notif) => {
    const dateKey = notif.timestamp.toDateString();
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(notif);
    return acc;
  }, {} as Record<string, Notification[]>);

  const handleDismiss = (id: string) => {
    setLocalNotifications((prev) => prev.filter((n) => n.id !== id));
    onNotificationDismiss?.(id);
  };

  const handleAction = (notificationId: string, actionId: string) => {
    onNotificationAction?.(notificationId, actionId);
  };

  const handleClearAll = () => {
    setLocalNotifications([]);
    onClearAll?.();
  };

  // Close on Escape key
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="macos-notification-center__backdrop"
        onClick={onClose}
        role="presentation"
      />

      {/* Notification Panel */}
      <aside
        className="macos-notification-center"
        role="complementary"
        aria-label="Notification Center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="macos-notification-center__header">
          <div className="macos-notification-center__title">
            <Bell size={20} />
            <h2>{titleText}</h2>
          </div>
          <button
            className="macos-notification-center__close"
            onClick={onClose}
            aria-label="Close notification center"
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="macos-notification-center__content">
          {sortedNotifications.length === 0 ? (
            <div className="macos-notification-center__empty">
              <Bell size={48} strokeWidth={1} />
              <p>{emptyMessage}</p>
            </div>
          ) : (
            <>
              {/* Clear All Button */}
              {sortedNotifications.length > 0 && (
                <div className="macos-notification-center__actions">
                  <button
                    className="macos-notification-center__clear-all"
                    onClick={handleClearAll}
                    type="button"
                  >
                    {clearAllText}
                  </button>
                </div>
              )}

              {/* Grouped Notifications */}
              {Object.entries(groupedNotifications).map(([dateKey, notifs]) => (
                <div key={dateKey} className="macos-notification-center__group">
                  <div className="macos-notification-center__group-date">
                    {dateKey === new Date().toDateString()
                      ? 'Today'
                      : dateKey === new Date(Date.now() - 86400000).toDateString()
                      ? 'Yesterday'
                      : new Date(dateKey).toLocaleDateString(undefined, {
                          month: 'long',
                          day: 'numeric',
                        })}
                  </div>

                  {notifs.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onDismiss={() => handleDismiss(notification.id)}
                      onAction={(actionId) => handleAction(notification.id, actionId)}
                    />
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </aside>
    </>
  );
}

// Notification Item Component
interface NotificationItemProps {
  notification: Notification;
  onDismiss: () => void;
  onAction: (actionId: string) => void;
}

function NotificationItem({ notification, onDismiss, onAction }: NotificationItemProps) {
  const severityIcon = notification.icon || getSeverityIcon(notification.severity, 20);

  return (
    <div
      className={`macos-notification-item macos-notification-item--${notification.severity} ${
        notification.read ? 'macos-notification-item--read' : ''
      }`}
      role="article"
      aria-label={`${notification.title}: ${notification.message}`}
    >
      <div className="macos-notification-item__icon-wrapper">
        <div className={`macos-notification-item__icon macos-notification-item__icon--${notification.severity}`}>
          {severityIcon}
        </div>
      </div>

      <div className="macos-notification-item__content">
        <div className="macos-notification-item__header">
          <div className="macos-notification-item__meta">
            {notification.appName && (
              <span className="macos-notification-item__app">
                {notification.appName}
              </span>
            )}
            <span className="macos-notification-item__timestamp">
              {formatTimestamp(notification.timestamp)}
            </span>
          </div>
          <button
            className="macos-notification-item__dismiss"
            onClick={onDismiss}
            aria-label="Dismiss notification"
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <div className="macos-notification-item__body">
          <h3 className="macos-notification-item__title">{notification.title}</h3>
          <p className="macos-notification-item__message">{notification.message}</p>
        </div>

        {notification.actions && notification.actions.length > 0 && (
          <div className="macos-notification-item__actions">
            {notification.actions.map((action) => (
              <button
                key={action.id}
                className={`macos-notification-item__action ${
                  action.primary ? 'macos-notification-item__action--primary' : ''
                }`}
                onClick={() => {
                  action.onAction();
                  onAction(action.id);
                }}
                type="button"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Toast Notification (appears temporarily at top-right)
export interface ToastNotificationProps {
  notification: Notification;
  onDismiss: () => void;
  duration?: number; // milliseconds, 0 = don't auto-dismiss
}

export function ToastNotification({
  notification,
  onDismiss,
  duration = 5000,
}: ToastNotificationProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Fade in
    requestAnimationFrame(() => {
      setVisible(true);
    });

    // Auto-dismiss after duration (unless persistent or duration is 0)
    if (duration > 0 && !notification.persistent) {
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300); // Wait for fade out animation
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, notification.persistent, onDismiss]);

  const severityIcon = notification.icon || getSeverityIcon(notification.severity, 20);

  return (
    <div
      className={`macos-toast-notification macos-toast-notification--${notification.severity} ${
        visible ? 'macos-toast-notification--visible' : ''
      }`}
      role="status"
      aria-live={notification.severity === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <div className={`macos-toast-notification__icon macos-toast-notification__icon--${notification.severity}`}>
        {severityIcon}
      </div>
      <div className="macos-toast-notification__content">
        <div className="macos-toast-notification__title">{notification.title}</div>
        <div className="macos-toast-notification__message">{notification.message}</div>
      </div>
      <button
        className="macos-toast-notification__dismiss"
        onClick={onDismiss}
        aria-label="Dismiss"
        type="button"
      >
        <X size={16} />
      </button>
    </div>
  );
}
