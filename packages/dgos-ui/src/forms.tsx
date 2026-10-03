// Enhanced Form Components with UX improvements
import React, { useEffect, useRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

// Auto-focus wrapper
export function useAutoFocus<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (enabled && ref.current) {
      const timer = requestAnimationFrame(() => ref.current?.focus());
      return () => cancelAnimationFrame(timer);
    }
  }, [enabled]);

  return ref;
}

// Enhanced Input with validation
export function FormInput({
  label,
  error,
  hint,
  required,
  autoFocus,
  validate,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
  autoFocus?: boolean;
  validate?: (value: string) => string | null;
}) {
  const ref = useAutoFocus<HTMLInputElement>(autoFocus);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (validate) {
      const validationError = validate(e.target.value);
      setLocalError(validationError);
    }
    props.onBlur?.(e);
  };

  const displayError = error || localError;

  return (
    <label className={`dgos-form-field ${displayError ? 'has-error' : ''}`}>
      {label && (
        <span className="field-label">
          {label}
          {required && <span className="required-mark" aria-label="required">*</span>}
        </span>
      )}
      <input
        ref={ref}
        {...props}
        required={required}
        className={`dgos-input ${props.className || ''}`}
        aria-invalid={displayError ? 'true' : undefined}
        aria-describedby={displayError ? `${props.id}-error` : hint ? `${props.id}-hint` : undefined}
        onBlur={handleBlur}
      />
      {hint && !displayError && (
        <span id={`${props.id}-hint`} className="field-hint">{hint}</span>
      )}
      {displayError && (
        <span id={`${props.id}-error`} className="field-error" role="alert">{displayError}</span>
      )}
    </label>
  );
}

// Enhanced Select
export function FormSelect({
  label,
  error,
  hint,
  required,
  autoFocus,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  hint?: string;
  autoFocus?: boolean;
}) {
  const ref = useAutoFocus<HTMLSelectElement>(autoFocus);

  return (
    <label className={`dgos-form-field ${error ? 'has-error' : ''}`}>
      {label && (
        <span className="field-label">
          {label}
          {required && <span className="required-mark" aria-label="required">*</span>}
        </span>
      )}
      <select
        ref={ref}
        {...props}
        required={required}
        className={`dgos-select ${props.className || ''}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${props.id}-error` : hint ? `${props.id}-hint` : undefined}
      >
        {children}
      </select>
      {hint && !error && (
        <span id={`${props.id}-hint`} className="field-hint">{hint}</span>
      )}
      {error && (
        <span id={`${props.id}-error`} className="field-error" role="alert">{error}</span>
      )}
    </label>
  );
}

// Enhanced Textarea
export function FormTextarea({
  label,
  error,
  hint,
  required,
  autoFocus,
  maxLength,
  showCount,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
  hint?: string;
  autoFocus?: boolean;
  showCount?: boolean;
}) {
  const ref = useAutoFocus<HTMLTextAreaElement>(autoFocus);
  const [count, setCount] = React.useState(props.value?.toString().length || 0);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCount(e.target.value.length);
    props.onChange?.(e);
  };

  return (
    <label className={`dgos-form-field ${error ? 'has-error' : ''}`}>
      {label && (
        <span className="field-label">
          {label}
          {required && <span className="required-mark" aria-label="required">*</span>}
          {showCount && maxLength && (
            <span className="field-count" aria-live="polite">
              {count}/{maxLength}
            </span>
          )}
        </span>
      )}
      <textarea
        ref={ref}
        {...props}
        required={required}
        maxLength={maxLength}
        className={`dgos-textarea ${props.className || ''}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${props.id}-error` : hint ? `${props.id}-hint` : undefined}
        onChange={handleChange}
      />
      {hint && !error && (
        <span id={`${props.id}-hint`} className="field-hint">{hint}</span>
      )}
      {error && (
        <span id={`${props.id}-error`} className="field-error" role="alert">{error}</span>
      )}
    </label>
  );
}

// Form Group for related fields
export function FormGroup({ legend, children, className = '' }: { legend?: string; children: React.ReactNode; className?: string }) {
  return (
    <fieldset className={`dgos-form-group ${className}`}>
      {legend && <legend>{legend}</legend>}
      <div className="form-group-content">{children}</div>
    </fieldset>
  );
}

// Validation utilities
export const validators = {
  required: (message = 'This field is required') => (value: string) => {
    return value.trim() ? null : message;
  },

  minLength: (min: number, message?: string) => (value: string) => {
    return value.length >= min ? null : message || `Minimum ${min} characters required`;
  },

  maxLength: (max: number, message?: string) => (value: string) => {
    return value.length <= max ? null : message || `Maximum ${max} characters allowed`;
  },

  pattern: (regex: RegExp, message = 'Invalid format') => (value: string) => {
    return regex.test(value) ? null : message;
  },

  email: (message = 'Invalid email address') => (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? null : message;
  },

  url: (message = 'Invalid URL') => (value: string) => {
    try {
      new URL(value);
      return null;
    } catch {
      return message;
    }
  },

  combine: (...validators: Array<(value: string) => string | null>) => (value: string) => {
    for (const validator of validators) {
      const error = validator(value);
      if (error) return error;
    }
    return null;
  },
};
