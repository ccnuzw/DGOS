// Focus Management System for DGOS
// Provides keyboard navigation, focus trapping, and accessibility utilities

import { useEffect, useRef, useCallback } from 'react';

/**
 * Focus Trap Hook
 * Traps focus within a container (useful for modals, dialogs, command palette)
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement>,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = getFocusableElements(container);

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element on mount
    const focusTimeout = requestAnimationFrame(() => {
      firstElement.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      // Shift+Tab on first element -> focus last
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
      // Tab on last element -> focus first
      else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(focusTimeout);
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, containerRef]);
}

/**
 * Focus Return Hook
 * Returns focus to the previously focused element when component unmounts
 */
export function useFocusReturn(enabled: boolean = true) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (enabled) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }

    return () => {
      if (enabled && previousFocusRef.current) {
        // Use requestAnimationFrame to avoid focus conflicts
        requestAnimationFrame(() => {
          previousFocusRef.current?.focus();
        });
      }
    };
  }, [enabled]);
}

/**
 * Roving Tabindex Hook
 * Implements roving tabindex pattern for keyboard navigation in lists/grids
 */
export function useRovingTabindex(
  containerRef: React.RefObject<HTMLElement>,
  orientation: 'horizontal' | 'vertical' | 'grid' = 'vertical',
  enabled: boolean = true
) {
  const currentIndexRef = useRef(0);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    const items = Array.from(
      container.querySelectorAll('[role="option"], [role="tab"], [role="menuitem"], button, a')
    ) as HTMLElement[];

    if (items.length === 0) return;

    // Set initial tabindex
    items.forEach((item, index) => {
      item.setAttribute('tabindex', index === currentIndexRef.current ? '0' : '-1');
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const currentIndex = items.indexOf(target);

      if (currentIndex === -1) return;

      let nextIndex = currentIndex;

      switch (e.key) {
        case 'ArrowDown':
          if (orientation === 'vertical' || orientation === 'grid') {
            e.preventDefault();
            nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
          }
          break;

        case 'ArrowUp':
          if (orientation === 'vertical' || orientation === 'grid') {
            e.preventDefault();
            nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
          }
          break;

        case 'ArrowRight':
          if (orientation === 'horizontal' || orientation === 'grid') {
            e.preventDefault();
            nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
          }
          break;

        case 'ArrowLeft':
          if (orientation === 'horizontal' || orientation === 'grid') {
            e.preventDefault();
            nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
          }
          break;

        case 'Home':
          e.preventDefault();
          nextIndex = 0;
          break;

        case 'End':
          e.preventDefault();
          nextIndex = items.length - 1;
          break;

        default:
          return;
      }

      if (nextIndex !== currentIndex) {
        items[currentIndex].setAttribute('tabindex', '-1');
        items[nextIndex].setAttribute('tabindex', '0');
        items[nextIndex].focus();
        currentIndexRef.current = nextIndex;
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, orientation, containerRef]);
}

/**
 * Skip Links Hook
 * Provides "skip to content" functionality for keyboard users
 */
export function useSkipLinks(
  skipTargets: Array<{ id: string; label: string }>
) {
  const skipLinksRef = useRef<HTMLDivElement>(null);

  const handleSkip = useCallback((targetId: string) => {
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return { skipLinksRef, handleSkip };
}

/**
 * Focus Visible Hook
 * Detects keyboard navigation and applies focus-visible class
 */
export function useFocusVisible() {
  useEffect(() => {
    let hadKeyboardEvent = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') {
        hadKeyboardEvent = true;
        document.body.classList.add('keyboard-navigation');
      }
    };

    const handleMouseDown = () => {
      hadKeyboardEvent = false;
      document.body.classList.remove('keyboard-navigation');
    };

    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (hadKeyboardEvent) {
        target.classList.add('focus-visible');
      } else {
        target.classList.remove('focus-visible');
      }
    };

    const handleBlur = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      target.classList.remove('focus-visible');
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('focus', handleFocus, true);
    document.addEventListener('blur', handleBlur, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('focus', handleFocus, true);
      document.removeEventListener('blur', handleBlur, true);
    };
  }, []);
}

/**
 * Announcement Hook
 * Creates accessible announcements for screen readers
 */
export function useAnnouncer() {
  const announcerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create announcer element if it doesn't exist
    if (!announcerRef.current) {
      const announcer = document.createElement('div');
      announcer.setAttribute('role', 'status');
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      announcer.style.position = 'absolute';
      announcer.style.left = '-10000px';
      announcer.style.width = '1px';
      announcer.style.height = '1px';
      announcer.style.overflow = 'hidden';
      document.body.appendChild(announcer);
      announcerRef.current = announcer;
    }

    return () => {
      if (announcerRef.current) {
        document.body.removeChild(announcerRef.current);
        announcerRef.current = null;
      }
    };
  }, []);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (announcerRef.current) {
      announcerRef.current.setAttribute('aria-live', priority);
      announcerRef.current.textContent = message;

      // Clear after announcement
      setTimeout(() => {
        if (announcerRef.current) {
          announcerRef.current.textContent = '';
        }
      }, 1000);
    }
  }, []);

  return announce;
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ].join(', ');

  return Array.from(container.querySelectorAll(focusableSelectors));
}

/**
 * Check if an element is currently visible
 */
export function isElementVisible(element: HTMLElement): boolean {
  if (!element) return false;

  const style = window.getComputedStyle(element);
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0'
  ) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Get the first focusable element within a container
 */
export function getFirstFocusableElement(container: HTMLElement): HTMLElement | null {
  const focusable = getFocusableElements(container);
  return focusable.find(isElementVisible) || null;
}

/**
 * Get the last focusable element within a container
 */
export function getLastFocusableElement(container: HTMLElement): HTMLElement | null {
  const focusable = getFocusableElements(container);
  const visible = focusable.filter(isElementVisible);
  return visible[visible.length - 1] || null;
}
