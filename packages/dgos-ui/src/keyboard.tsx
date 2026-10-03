// Keyboard Shortcut System
import React, { createContext, useContext, useEffect, useCallback, type ReactNode } from 'react';

export type ShortcutHandler = () => void;

export interface Shortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: ShortcutHandler;
  description: string;
  global?: boolean;
}

interface KeyboardContextValue {
  register: (id: string, shortcut: Shortcut) => void;
  unregister: (id: string) => void;
  shortcuts: Record<string, Shortcut>;
  showHelp: () => void;
  hideHelp: () => void;
}

const KeyboardContext = createContext<KeyboardContextValue | null>(null);

export function useKeyboard() {
  const context = useContext(KeyboardContext);
  if (!context) throw new Error('useKeyboard must be used within KeyboardProvider');
  return context;
}

export function useShortcut(
  shortcut: Omit<Shortcut, 'handler'>,
  handler: ShortcutHandler,
  deps: React.DependencyList = []
) {
  const { register, unregister } = useKeyboard();

  useEffect(() => {
    const id = crypto.randomUUID();
    register(id, { ...shortcut, handler });
    return () => unregister(id);
  }, [shortcut.key, shortcut.ctrl, shortcut.meta, shortcut.shift, shortcut.alt, ...deps]);
}

export function KeyboardProvider({ children }: { children: ReactNode }) {
  const [shortcuts, setShortcuts] = React.useState<Record<string, Shortcut>>({});
  const [helpVisible, setHelpVisible] = React.useState(false);

  const register = useCallback((id: string, shortcut: Shortcut) => {
    setShortcuts(prev => ({ ...prev, [id]: shortcut }));
  }, []);

  const unregister = useCallback((id: string) => {
    setShortcuts(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const showHelp = useCallback(() => setHelpVisible(true), []);
  const hideHelp = useCallback(() => setHelpVisible(false), []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Help shortcut (?)
      if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        event.preventDefault();
        setHelpVisible(true);
        return;
      }

      // Check for matching shortcuts
      for (const shortcut of Object.values(shortcuts)) {
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey;
        const metaMatches = shortcut.meta ? (event.metaKey || event.ctrlKey) : true;
        const shiftMatches = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatches = shortcut.alt ? event.altKey : !event.altKey;

        if (keyMatches && ctrlMatches && shiftMatches && altMatches) {
          // Only prevent default for global shortcuts or when not in input
          const target = event.target as HTMLElement;
          const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

          if (shortcut.global || !inInput) {
            event.preventDefault();
            shortcut.handler();
            break;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);

  return (
    <KeyboardContext.Provider value={{ register, unregister, shortcuts, showHelp, hideHelp }}>
      {children}
      {helpVisible && <KeyboardHelp shortcuts={shortcuts} onClose={hideHelp} />}
    </KeyboardContext.Provider>
  );
}

function KeyboardHelp({ shortcuts, onClose }: { shortcuts: Record<string, Shortcut>; onClose: () => void }) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const formatKey = (shortcut: Shortcut) => {
    const parts: string[] = [];
    if (shortcut.ctrl || shortcut.meta) parts.push('⌘');
    if (shortcut.shift) parts.push('⇧');
    if (shortcut.alt) parts.push('⌥');
    parts.push(shortcut.key.toUpperCase());
    return parts.join(' ');
  };

  const groupedShortcuts = Object.entries(shortcuts).reduce((acc, [id, shortcut]) => {
    const category = shortcut.global ? 'Global' : 'Context';
    if (!acc[category]) acc[category] = [];
    acc[category].push({ id, ...shortcut });
    return acc;
  }, {} as Record<string, Array<{ id: string } & Shortcut>>);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal keyboard-help" role="dialog" aria-modal="true" aria-labelledby="keyboard-help-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="keyboard-help-title">Keyboard Shortcuts</h2>
        <div className="keyboard-help-content">
          {Object.entries(groupedShortcuts).map(([category, items]) => (
            <div key={category} className="shortcut-group">
              <h3>{category}</h3>
              <dl className="shortcut-list">
                {items.map(item => (
                  <div key={item.id} className="shortcut-item">
                    <dt>{item.description}</dt>
                    <dd><kbd>{formatKey(item)}</kbd></dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
          <div className="shortcut-group">
            <h3>Standard</h3>
            <dl className="shortcut-list">
              <div className="shortcut-item">
                <dt>Show this help</dt>
                <dd><kbd>?</kbd></dd>
              </div>
              <div className="shortcut-item">
                <dt>Close dialog</dt>
                <dd><kbd>ESC</kbd></dd>
              </div>
              <div className="shortcut-item">
                <dt>Navigate forms</dt>
                <dd><kbd>TAB</kbd> / <kbd>⇧ TAB</kbd></dd>
              </div>
              <div className="shortcut-item">
                <dt>Submit form</dt>
                <dd><kbd>ENTER</kbd></dd>
              </div>
            </dl>
          </div>
        </div>
        <button onClick={onClose} className="dgos-button primary">Close</button>
      </div>
    </div>
  );
}
