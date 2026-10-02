// Additional DGOS UI Components
import React, { type InputHTMLAttributes, type SelectHTMLAttributes, type HTMLAttributes, type PropsWithChildren } from 'react';

// Input component with label
export function Input({ label, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <label className="dgos-input-field">
      {label && <span>{label}</span>}
      <input {...props} className={`dgos-input ${props.className || ''}`} aria-invalid={error ? 'true' : undefined} />
      {error && <span className="dgos-input-error" role="alert">{error}</span>}
    </label>
  );
}

// Select component with label
export function Select({ label, error, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }) {
  return (
    <label className="dgos-select-field">
      {label && <span>{label}</span>}
      <select {...props} className={`dgos-select ${props.className || ''}`} aria-invalid={error ? 'true' : undefined}>
        {children}
      </select>
      {error && <span className="dgos-input-error" role="alert">{error}</span>}
    </label>
  );
}

// Checkbox component
export function Checkbox({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="dgos-checkbox">
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}

// Radio component
export function Radio({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="dgos-radio">
      <input type="radio" {...props} />
      <span>{label}</span>
    </label>
  );
}

// Badge component
export function Badge({ children, variant = 'default' }: PropsWithChildren<{ variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' }>) {
  return <span className={`dgos-badge ${variant}`}>{children}</span>;
}

// Card component
export function Card({ children, ...props }: PropsWithChildren<HTMLAttributes<HTMLElement>>) {
  return <article {...props} className={`dgos-card ${props.className || ''}`}>{children}</article>;
}

// Spinner component
export function Spinner({ size = 'md', label }: { size?: 'sm' | 'md' | 'lg'; label?: string }) {
  return (
    <div className={`dgos-spinner ${size}`} role="status" aria-label={label || 'Loading'}>
      <div className="spinner-circle" />
    </div>
  );
}

// Toast notification component
export function Toast({ children, type = 'info', onClose }: PropsWithChildren<{ type?: 'success' | 'error' | 'info' | 'warning'; onClose?: () => void }>) {
  return (
    <div role="status" className={`dgos-toast ${type}`}>
      <div className="toast-content">{children}</div>
      {onClose && (
        <button onClick={onClose} className="toast-close" aria-label="Close notification">
          ×
        </button>
      )}
    </div>
  );
}

// Dialog/Modal component
export function Dialog({ open, onClose, title, children, actions }: PropsWithChildren<{ open: boolean; onClose: () => void; title: string; actions?: React.ReactNode }>) {
  if (!open) return null;

  return (
    <div className="dgos-dialog-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="dgos-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dialog-title">{title}</h2>
        <div className="dialog-body">{children}</div>
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </div>
  );
}

// Tabs component
export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div role="tablist" className="dgos-tabs">
      {tabs.map(tab => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          aria-controls={`panel-${tab.id}`}
          onClick={() => onChange(tab.id)}
          className={active === tab.id ? 'active' : ''}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// Breadcrumb component
export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="dgos-breadcrumb">
      <ol>
        {items.map((item, i) => (
          <li key={i}>
            {item.href ? (
              <a href={item.href}>{item.label}</a>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// Dropdown Menu component
export function Menu({ trigger, items }: { trigger: React.ReactNode; items: { label: string; onClick: () => void; disabled?: boolean }[] }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="dgos-menu">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="true">
        {trigger}
      </button>
      {open && (
        <ul role="menu" className="menu-list">
          {items.map((item, i) => (
            <li key={i} role="none">
              <button
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
