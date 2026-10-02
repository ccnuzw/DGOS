function invoke(command, args) {
  const bridge = globalThis.__TAURI_INTERNALS__;
  if (!bridge?.invoke) throw new Error('macOS host is unavailable');
  return bridge.invoke(command, args);
}

export const macosHostAdapter = Object.freeze({
  platform: 'macos',
  windows: Object.freeze({
    open(label) { return invoke('open_window', { label }); },
    saveWorkspace() { return invoke('save_workspace'); },
    loadWorkspace() { return invoke('load_workspace'); },
    restoreSubjectWorkspace() { return invoke('restore_subject_workspace'); },
  }),
  session: Object.freeze({
    forgetLocalBinding() { return invoke('forget_desktop_session'); },
  }),
});
