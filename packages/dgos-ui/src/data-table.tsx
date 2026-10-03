// DataTable Component - Virtualized table with sorting, filtering, and selection
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';

/**
 * Column definition for DataTable
 */
export interface DataTableColumn<T = any> {
  /** Unique column identifier */
  id: string;
  /** Column header label */
  label: string;
  /** Accessor function to get cell value */
  accessor: (row: T) => any;
  /** Column width (defaults to flex: 1) */
  width?: string | number;
  /** Enable sorting for this column */
  sortable?: boolean;
  /** Enable filtering for this column */
  filterable?: boolean;
  /** Render custom cell content */
  render?: (value: any, row: T) => React.ReactNode;
  /** Use monospace font for numbers */
  numeric?: boolean;
  /** Align cell content */
  align?: 'left' | 'center' | 'right';
}

/**
 * DataTable props
 */
export interface DataTableProps<T = any> {
  /** Column definitions */
  columns: DataTableColumn<T>[];
  /** Data rows */
  data: T[];
  /** Unique row key accessor */
  rowKey: (row: T) => string | number;
  /** Enable row selection */
  selectable?: boolean;
  /** Selection mode */
  selectionMode?: 'single' | 'multiple';
  /** Selected row keys */
  selectedKeys?: Set<string | number>;
  /** Selection change callback */
  onSelectionChange?: (keys: Set<string | number>) => void;
  /** Fixed header */
  fixedHeader?: boolean;
  /** Table height for virtualization */
  height?: string | number;
  /** Row height for virtualization */
  rowHeight?: number;
  /** Empty state message */
  emptyMessage?: string;
  /** Loading state */
  loading?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * DataTable - Virtualized table with sorting, filtering, and selection
 */
export function DataTable<T = any>({
  columns,
  data,
  rowKey,
  selectable = false,
  selectionMode = 'multiple',
  selectedKeys = new Set(),
  onSelectionChange,
  fixedHeader = true,
  height = '400px',
  rowHeight = 36,
  emptyMessage = 'No data available',
  loading = false,
  className = '',
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Map<string, string>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Handle column sort
  const handleSort = useCallback((columnId: string) => {
    if (sortColumn === columnId) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  }, [sortColumn, sortDirection]);

  // Handle filter change
  const handleFilterChange = useCallback((columnId: string, value: string) => {
    const newFilters = new Map(filters);
    if (value) {
      newFilters.set(columnId, value);
    } else {
      newFilters.delete(columnId);
    }
    setFilters(newFilters);
  }, [filters]);

  // Handle row selection
  const handleRowSelect = useCallback((key: string | number, event: React.MouseEvent) => {
    if (!onSelectionChange) return;

    const newSelection = new Set(selectedKeys);

    if (selectionMode === 'single') {
      newSelection.clear();
      newSelection.add(key);
    } else {
      if (event.shiftKey && selectedKeys.size > 0) {
        // Shift-select range (simplified)
        if (newSelection.has(key)) {
          newSelection.delete(key);
        } else {
          newSelection.add(key);
        }
      } else if (event.metaKey || event.ctrlKey) {
        // Toggle selection
        if (newSelection.has(key)) {
          newSelection.delete(key);
        } else {
          newSelection.add(key);
        }
      } else {
        // Replace selection
        newSelection.clear();
        newSelection.add(key);
      }
    }

    onSelectionChange(newSelection);
  }, [selectedKeys, onSelectionChange, selectionMode]);

  // Handle select all
  const handleSelectAll = useCallback((checked: boolean) => {
    if (!onSelectionChange) return;

    if (checked) {
      const allKeys = new Set(filteredAndSortedData.map(rowKey));
      onSelectionChange(allKeys);
    } else {
      onSelectionChange(new Set());
    }
  }, [data, rowKey, onSelectionChange]);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Apply filters
    filters.forEach((filterValue, columnId) => {
      const column = columns.find(col => col.id === columnId);
      if (column) {
        result = result.filter(row => {
          const value = String(column.accessor(row)).toLowerCase();
          return value.includes(filterValue.toLowerCase());
        });
      }
    });

    // Apply sorting
    if (sortColumn) {
      const column = columns.find(col => col.id === sortColumn);
      if (column) {
        result.sort((a, b) => {
          const aVal = column.accessor(a);
          const bVal = column.accessor(b);

          if (aVal === bVal) return 0;
          const comparison = aVal < bVal ? -1 : 1;
          return sortDirection === 'asc' ? comparison : -comparison;
        });
      }
    }

    return result;
  }, [data, columns, sortColumn, sortDirection, filters]);

  // Virtualization
  const totalHeight = filteredAndSortedData.length * rowHeight;
  const visibleStart = Math.floor(scrollTop / rowHeight);
  const visibleEnd = Math.ceil((scrollTop + parseInt(String(height))) / rowHeight);
  const visibleData = filteredAndSortedData.slice(
    Math.max(0, visibleStart - 5),
    Math.min(filteredAndSortedData.length, visibleEnd + 5)
  );
  const offsetY = Math.max(0, visibleStart - 5) * rowHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const allSelected = selectable && selectedKeys.size === filteredAndSortedData.length && filteredAndSortedData.length > 0;
  const someSelected = selectable && selectedKeys.size > 0 && selectedKeys.size < filteredAndSortedData.length;

  if (loading) {
    return (
      <div className={`dgos-data-table loading ${className}`}>
        <div className="table-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className={`dgos-data-table ${className}`} style={{ height }}>
      <div className={`table-header ${fixedHeader ? 'fixed' : ''}`}>
        <div className="table-row header-row" role="row">
          {selectable && (
            <div className="table-cell checkbox-cell" role="columnheader">
              {selectionMode === 'multiple' && (
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={input => {
                    if (input) input.indeterminate = someSelected;
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  aria-label="Select all rows"
                />
              )}
            </div>
          )}
          {columns.map((column) => (
            <div
              key={column.id}
              className={`table-cell ${column.numeric ? 'numeric' : ''} ${column.align || 'left'}`}
              style={{ width: column.width, flex: column.width ? 'none' : 1 }}
              role="columnheader"
            >
              <div className="cell-header">
                {column.sortable ? (
                  <button
                    className="sort-button"
                    onClick={() => handleSort(column.id)}
                    aria-label={`Sort by ${column.label}`}
                  >
                    {column.label}
                    {sortColumn === column.id && (
                      <span className="sort-indicator" aria-hidden="true">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                ) : (
                  <span>{column.label}</span>
                )}
              </div>
              {column.filterable && (
                <input
                  type="text"
                  className="filter-input"
                  placeholder="Filter..."
                  value={filters.get(column.id) || ''}
                  onChange={(e) => handleFilterChange(column.id, e.target.value)}
                  aria-label={`Filter ${column.label}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="table-body"
        onScroll={handleScroll}
        role="rowgroup"
        style={{ height: `calc(${height} - 52px)`, overflow: 'auto' }}
      >
        {filteredAndSortedData.length === 0 ? (
          <div className="table-empty" role="status">
            {emptyMessage}
          </div>
        ) : (
          <div style={{ height: totalHeight, position: 'relative' }}>
            <div style={{ transform: `translateY(${offsetY}px)` }}>
              {visibleData.map((row) => {
                const key = rowKey(row);
                const isSelected = selectedKeys.has(key);

                return (
                  <div
                    key={key}
                    className={`table-row ${isSelected ? 'selected' : ''}`}
                    onClick={(e) => selectable && handleRowSelect(key, e)}
                    role="row"
                    aria-selected={selectable ? isSelected : undefined}
                    style={{ height: rowHeight }}
                  >
                    {selectable && (
                      <div className="table-cell checkbox-cell" role="cell">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          aria-label={`Select row ${key}`}
                        />
                      </div>
                    )}
                    {columns.map((column) => {
                      const value = column.accessor(row);
                      const content = column.render ? column.render(value, row) : value;

                      return (
                        <div
                          key={column.id}
                          className={`table-cell ${column.numeric ? 'numeric' : ''} ${column.align || 'left'}`}
                          style={{ width: column.width, flex: column.width ? 'none' : 1 }}
                          role="cell"
                        >
                          {content}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
