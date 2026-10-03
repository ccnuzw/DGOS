// Enhanced Breadcrumbs Component with overflow handling and › separator
import React, { useState, useRef, useEffect } from 'react';

/**
 * Breadcrumb item
 */
export interface BreadcrumbItem {
  /** Item label */
  label: string;
  /** Optional href for navigation */
  href?: string;
  /** Click handler (alternative to href) */
  onClick?: () => void;
}

/**
 * Enhanced Breadcrumbs props
 */
export interface EnhancedBreadcrumbsProps {
  /** Breadcrumb items */
  items: BreadcrumbItem[];
  /** Maximum items to show before collapsing */
  maxItems?: number;
  /** Custom class name */
  className?: string;
  /** Separator character */
  separator?: string;
}

/**
 * EnhancedBreadcrumbs - Navigation path with overflow handling
 */
export function EnhancedBreadcrumbs({
  items,
  maxItems = 4,
  className = '',
  separator = '›',
}: EnhancedBreadcrumbsProps) {
  const [showAll, setShowAll] = useState(false);
  const containerRef = useRef<HTMLElement>(null);

  // Determine which items to show
  const shouldCollapse = items.length > maxItems && !showAll;
  let displayItems: (BreadcrumbItem | { type: 'ellipsis' })[];

  if (shouldCollapse) {
    // Show first item, ellipsis, and last 2 items
    const firstItem = items[0];
    const lastItems = items.slice(-2);
    displayItems = [
      firstItem,
      { type: 'ellipsis' as const },
      ...lastItems,
    ];
  } else {
    displayItems = items;
  }

  const handleEllipsisClick = () => {
    setShowAll(true);
  };

  const handleItemClick = (item: BreadcrumbItem, e: React.MouseEvent) => {
    if (item.onClick) {
      e.preventDefault();
      item.onClick();
    }
  };

  return (
    <nav
      ref={containerRef}
      aria-label="Breadcrumb"
      className={`dgos-enhanced-breadcrumbs ${className}`}
    >
      <ol className="breadcrumb-list">
        {displayItems.map((item, index) => {
          const isLast = index === displayItems.length - 1;

          if ('type' in item && item.type === 'ellipsis') {
            return (
              <li key="ellipsis" className="breadcrumb-item ellipsis">
                <button
                  className="breadcrumb-ellipsis"
                  onClick={handleEllipsisClick}
                  aria-label="Show all items"
                  title="Show all items"
                >
                  …
                </button>
                <span className="breadcrumb-separator" aria-hidden="true">
                  {separator}
                </span>
              </li>
            );
          }

          const breadcrumbItem = item as BreadcrumbItem;

          return (
            <li key={index} className="breadcrumb-item">
              {breadcrumbItem.href ? (
                <a
                  href={breadcrumbItem.href}
                  className="breadcrumb-link"
                  onClick={(e) => handleItemClick(breadcrumbItem, e)}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {breadcrumbItem.label}
                </a>
              ) : (
                <span
                  className={`breadcrumb-text ${isLast ? 'current' : ''}`}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {breadcrumbItem.label}
                </span>
              )}

              {!isLast && (
                <span className="breadcrumb-separator" aria-hidden="true">
                  {separator}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
