// SplitPane Component - Resizable split panels
import React, { useState, useRef, useCallback, useEffect } from 'react';

/**
 * SplitPane props
 */
export interface SplitPaneProps {
  /** Split direction */
  direction?: 'horizontal' | 'vertical';
  /** Initial size of first pane (in pixels or percentage) */
  initialSize?: number | string;
  /** Minimum size of first pane in pixels */
  minSize?: number;
  /** Maximum size of first pane in pixels */
  maxSize?: number;
  /** First pane content */
  children: [React.ReactNode, React.ReactNode];
  /** Custom class name */
  className?: string;
  /** Called when size changes */
  onSizeChange?: (size: number) => void;
  /** Storage key to persist size */
  storageKey?: string;
}

/**
 * SplitPane - Resizable split panels with drag handle
 */
export function SplitPane({
  direction = 'horizontal',
  initialSize = '50%',
  minSize = 100,
  maxSize,
  children,
  className = '',
  onSizeChange,
  storageKey,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Initialize size from storage or prop
  const getInitialSize = (): number => {
    if (storageKey) {
      try {
        const stored = localStorage.getItem(`split-pane-${storageKey}`);
        if (stored) return parseInt(stored, 10);
      } catch (e) {
        // Storage access failed, use default
      }
    }

    if (typeof initialSize === 'string' && initialSize.endsWith('%')) {
      return parseInt(initialSize, 10);
    }
    return typeof initialSize === 'number' ? initialSize : 50;
  };

  const [size, setSize] = useState<number>(getInitialSize());
  const isPercentage = typeof initialSize === 'string' && initialSize.endsWith('%');

  // Save size to storage
  useEffect(() => {
    if (storageKey && !isPercentage) {
      try {
        localStorage.setItem(`split-pane-${storageKey}`, String(size));
      } catch (e) {
        // Storage access failed
      }
    }
  }, [size, storageKey, isPercentage]);

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();

    let newSize: number;

    if (direction === 'horizontal') {
      newSize = e.clientX - rect.left;
    } else {
      newSize = e.clientY - rect.top;
    }

    // Apply constraints
    const containerSize = direction === 'horizontal' ? rect.width : rect.height;
    const effectiveMaxSize = maxSize ?? containerSize - minSize;

    newSize = Math.max(minSize, Math.min(effectiveMaxSize, newSize));

    setSize(newSize);
    onSizeChange?.(newSize);
  }, [isDragging, direction, minSize, maxSize, onSizeChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, direction]);

  const [firstChild, secondChild] = children;

  const firstPaneSize = isPercentage ? `${size}%` : `${size}px`;
  const secondPaneSize = isPercentage ? `${100 - size}%` : `calc(100% - ${size}px - 8px)`;

  return (
    <div
      ref={containerRef}
      className={`dgos-split-pane ${direction} ${isDragging ? 'dragging' : ''} ${className}`}
      role="group"
    >
      <div
        className="split-pane-first"
        style={{
          [direction === 'horizontal' ? 'width' : 'height']: firstPaneSize,
        }}
      >
        {firstChild}
      </div>

      <div
        className={`split-handle ${direction}`}
        onMouseDown={handleMouseDown}
        role="separator"
        aria-orientation={direction === 'horizontal' ? 'vertical' : 'horizontal'}
        aria-valuenow={size}
        aria-valuemin={minSize}
        aria-valuemax={maxSize}
        tabIndex={0}
        onKeyDown={(e) => {
          const step = 10;
          let newSize = size;

          if (direction === 'horizontal') {
            if (e.key === 'ArrowLeft') newSize -= step;
            if (e.key === 'ArrowRight') newSize += step;
          } else {
            if (e.key === 'ArrowUp') newSize -= step;
            if (e.key === 'ArrowDown') newSize += step;
          }

          if (newSize !== size) {
            const containerSize = containerRef.current
              ? (direction === 'horizontal' ? containerRef.current.clientWidth : containerRef.current.clientHeight)
              : 1000;
            const effectiveMaxSize = maxSize ?? containerSize - minSize;
            newSize = Math.max(minSize, Math.min(effectiveMaxSize, newSize));
            setSize(newSize);
            onSizeChange?.(newSize);
            e.preventDefault();
          }
        }}
      >
        <div className="split-handle-inner" aria-hidden="true">
          <div className="split-handle-grip" />
        </div>
      </div>

      <div
        className="split-pane-second"
        style={{
          [direction === 'horizontal' ? 'width' : 'height']: secondPaneSize,
        }}
      >
        {secondChild}
      </div>
    </div>
  );
}
