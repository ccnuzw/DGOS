# V1-DESKTOP r6 — native visible workbench

Worker-F, main workspace, prior r5 stopped. Existing FR001 workspace/window and FR005 task requirements apply. Own only desktop/native/host-adapter and `scripts/v1-desktop-real.mjs`; D owns Web sources and dist builds. Reuse r5 isolated desktop resources, never D15200. No signing account/profile changes.

Close actual native window visibility and interaction evidence: investigate System Events zero windows; use native Tauri window state and macOS window-server evidence to establish app rendered/visible. Capture app-only screenshot if possible without unrelated apps/sensitive data. Exercise focus/maximize/close/reopen/restored workspace and actual user-facing controls with a bounded automation path. Debug injected bridge evidence must remain labeled; do not equate DOM execution with visible UI.

Read-only inspect whether a usable Developer ID signing identity is installed (`security find-identity -v -p codesigning`, no private material). If none, explicitly record external signing dependency. Do not invent a signing credential. Can produce unsigned/ad-hoc runnable artifact under existing authorization; no release publication.

Acceptance: real app window evidence plus actual workbench behavior and native restore; exact artifact/source/dist identity; no screenshot credentials; precise environment cleanup. Any unavailable OS permission produces a specific evidence limitation while implementation defects are fixed. Report `.herdr/V1-DESKTOP-r6.md` and paired manifest; stop writing after delivery. I r6 currently changes shared API/worker network startup; test at a known stable boundary and bind hashes, report drift rather than silently reuse r5.
