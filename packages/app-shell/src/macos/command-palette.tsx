// macOS Command Palette (⌘K)
// Quick access to all apps and actions
import React, { useState, useEffect, useRef, type ReactNode } from 'react';
import { Search, Command as CommandIcon } from 'lucide-react';
import type { RouteKey } from '@dgos/design-tokens';

export interface CommandItem {
  id: string;
  type: 'app' | 'action' | 'recent';
  label: string;
  description?: string;
  icon?: ReactNode;
  route?: RouteKey;
  keywords?: string[];
  onExecute?: () => void;
}

export interface CommandPaletteProps {
  visible: boolean;
  items: CommandItem[];
  onClose: () => void;
  onItemSelect?: (item: CommandItem) => void;
  placeholder?: string;
  recentLabel?: string;
  noResultsLabel?: string;
}

export function CommandPalette({
  visible,
  items,
  onClose,
  onItemSelect,
  placeholder = 'Search apps and actions...',
  recentLabel = 'Recent',
  noResultsLabel = 'No results found',
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Filter items based on search query
  const filteredItems = query.trim()
    ? items.filter((item) => {
        const searchText = query.toLowerCase();
        const labelMatch = item.label.toLowerCase().includes(searchText);
        const descMatch = item.description?.toLowerCase().includes(searchText);
        const keywordsMatch = item.keywords?.some((kw) =>
          kw.toLowerCase().includes(searchText)
        );
        return labelMatch || descMatch || keywordsMatch;
      })
    : items.filter((item) => item.type === 'recent');

  // Group items by type
  const groupedItems = filteredItems.reduce((acc, item) => {
    const type = item.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  // Reset selection when filtered items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, filteredItems.length]);

  // Focus input when palette opens
  useEffect(() => {
    if (visible) {
      setQuery('');
      setSelectedIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [visible]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = itemRefs.current[selectedIndex];
    if (selectedElement && listRef.current) {
      const listRect = listRef.current.getBoundingClientRect();
      const itemRect = selectedElement.getBoundingClientRect();

      if (itemRect.bottom > listRect.bottom) {
        selectedElement.scrollIntoView({ block: 'end', behavior: 'smooth' });
      } else if (itemRect.top < listRect.top) {
        selectedElement.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  const handleItemSelect = (item: CommandItem) => {
    if (item.onExecute) {
      item.onExecute();
    }
    if (onItemSelect) {
      onItemSelect(item);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        onClose();
        break;

      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredItems.length - 1 ? prev + 1 : prev
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;

      case 'Enter':
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          handleItemSelect(filteredItems[selectedIndex]);
        }
        break;
    }
  };

  if (!visible) return null;

  return (
    <div
      className="macos-command-palette__backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="macos-command-palette"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
      >
        <div className="macos-command-palette__header">
          <div className="macos-command-palette__search">
            <Search size={20} className="macos-command-palette__search-icon" />
            <input
              ref={inputRef}
              type="text"
              className="macos-command-palette__input"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Search command palette"
            />
            <kbd className="macos-command-palette__hint">⌘K</kbd>
          </div>
        </div>

        <div
          ref={listRef}
          className="macos-command-palette__content"
          role="listbox"
          aria-label="Search results"
        >
          {filteredItems.length === 0 ? (
            <div className="macos-command-palette__empty">
              {noResultsLabel}
            </div>
          ) : (
            <>
              {!query && groupedItems.recent && groupedItems.recent.length > 0 && (
                <div className="macos-command-palette__group">
                  <div className="macos-command-palette__group-label">
                    {recentLabel}
                  </div>
                  {groupedItems.recent.map((item, globalIndex) => (
                    <CommandPaletteItem
                      key={item.id}
                      item={item}
                      selected={selectedIndex === globalIndex}
                      onSelect={() => handleItemSelect(item)}
                      ref={(el) => {
                        itemRefs.current[globalIndex] = el;
                      }}
                    />
                  ))}
                </div>
              )}

              {query && filteredItems.map((item, index) => (
                <CommandPaletteItem
                  key={item.id}
                  item={item}
                  selected={selectedIndex === index}
                  onSelect={() => handleItemSelect(item)}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                />
              ))}
            </>
          )}
        </div>

        <div className="macos-command-palette__footer">
          <kbd>↑↓</kbd> Navigate
          <kbd>↵</kbd> Select
          <kbd>Esc</kbd> Close
        </div>
      </div>
    </div>
  );
}

// Command Palette Item Component
interface CommandPaletteItemProps {
  item: CommandItem;
  selected: boolean;
  onSelect: () => void;
}

const CommandPaletteItem = React.forwardRef<
  HTMLButtonElement,
  CommandPaletteItemProps
>(({ item, selected, onSelect }, ref) => {
  return (
    <button
      ref={ref}
      className={`macos-command-palette__item ${
        selected ? 'macos-command-palette__item--selected' : ''
      }`}
      onClick={onSelect}
      role="option"
      aria-selected={selected}
      type="button"
    >
      {item.icon && (
        <div className="macos-command-palette__item-icon">{item.icon}</div>
      )}
      <div className="macos-command-palette__item-content">
        <div className="macos-command-palette__item-label">{item.label}</div>
        {item.description && (
          <div className="macos-command-palette__item-description">
            {item.description}
          </div>
        )}
      </div>
      {selected && (
        <CommandIcon
          size={16}
          className="macos-command-palette__item-indicator"
        />
      )}
    </button>
  );
});

CommandPaletteItem.displayName = 'CommandPaletteItem';
