// Progress and Loading Components
import React from 'react';

// Linear Progress Bar
export function ProgressBar({
  value,
  max = 100,
  label,
  showPercentage = true,
  variant = 'default'
}: {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const percentage = Math.round((value / max) * 100);

  return (
    <div className="dgos-progress-wrapper" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      {label && (
        <div className="progress-label">
          <span>{label}</span>
          {showPercentage && <span>{percentage}%</span>}
        </div>
      )}
      <div className={`dgos-progress-bar ${variant}`}>
        <div className="progress-fill" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

// Indeterminate Progress (for unknown duration)
export function ProgressIndeterminate({ label }: { label?: string }) {
  return (
    <div className="dgos-progress-wrapper" role="progressbar" aria-label={label || 'Loading'}>
      {label && <div className="progress-label"><span>{label}</span></div>}
      <div className="dgos-progress-bar indeterminate">
        <div className="progress-fill" />
      </div>
    </div>
  );
}

// Skeleton Loader for content
export function Skeleton({
  width,
  height = '1em',
  variant = 'text',
  count = 1,
  className = ''
}: {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'circular' | 'rectangular';
  count?: number;
  className?: string;
}) {
  const skeletons = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      className={`dgos-skeleton ${variant} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
      aria-hidden="true"
    />
  ));

  return count === 1 ? skeletons[0] : <>{skeletons}</>;
}

// Skeleton List Pattern
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton-list" aria-busy="true" aria-label="Loading content">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-list-item">
          <Skeleton variant="circular" width={40} height={40} />
          <div className="skeleton-list-content">
            <Skeleton width="60%" height="1.2em" />
            <Skeleton width="40%" height="0.9em" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Skeleton Panel Pattern
export function SkeletonPanel() {
  return (
    <div className="dgos-panel skeleton-panel" aria-busy="true" aria-label="Loading panel">
      <Skeleton width="40%" height="1.5em" className="skeleton-title" />
      <Skeleton width="100%" height="1em" count={3} />
      <div className="skeleton-actions">
        <Skeleton width={100} height={36} variant="rectangular" />
        <Skeleton width={100} height={36} variant="rectangular" />
      </div>
    </div>
  );
}

// Loading Overlay
export function LoadingOverlay({ message }: { message?: string }) {
  return (
    <div className="dgos-loading-overlay" role="status" aria-live="polite">
      <div className="loading-content">
        <div className="dgos-spinner lg">
          <div className="spinner-circle" />
        </div>
        {message && <p>{message}</p>}
      </div>
    </div>
  );
}

// Inline Loading State
export function LoadingInline({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`dgos-spinner-inline ${size}`} role="status" aria-label="Loading">
      <span className="spinner-dot" />
      <span className="spinner-dot" />
      <span className="spinner-dot" />
    </span>
  );
}
