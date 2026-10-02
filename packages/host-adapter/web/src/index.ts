export const webHost = {
  kind: 'web' as const,
  open: (path: string) => { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); },
  notify: (message: string) => { if ('Notification' in window && Notification.permission === 'granted') new Notification('DGOS', { body: message }); },
  capabilities: { filePicker: typeof window !== 'undefined' && 'showOpenFilePicker' in window, nativeWindow: false, keychain: false },
};
