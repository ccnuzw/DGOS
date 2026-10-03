# w1-20261003131836-1617

- Result: FAIL
- Code version: `7833ced2d70e009e6cc76f3c7ad1e93bfca99ac6`
- Dirty working tree: true

| Group | Command | Status | Exit |
| --- | --- | --- | ---: |
| governance | `node scripts/check-docs.mjs` | failed | 1 |
| web-text-only | `pnpm --filter @dgos/web check` | passed | 0 |
| web-text-only | `node --test tests/provider/*.test.mjs` | passed | 0 |
| web-text-only | `node --test tests/integration/ai-task-api.test.mjs tests/integration/provider-worker.test.mjs` | passed | 0 |
| native-workbench | `pnpm --filter @dgos/desktop check` | passed | 0 |
| native-workbench | `native-workbench-e2e` | blocked |  |

## Limitations
- This batch records local host execution only.
- Web text-only and native Workbench results are separate evidence groups.
- Native static check does not prove foreground-window ownership, frame-present or bridge handshake.
- Native Workbench runtime E2E is blocked unless DGOS_NATIVE_WORKBENCH_COMMAND is supplied on macOS.
