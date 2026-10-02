// Keep the installed model metadata, changing only the tool presentation mode.
// No provider credentials, model IDs, instructions or approval policies change.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const state = fileURLToPath(new URL('./state/', import.meta.url));
const catalog = JSON.parse(execFileSync('codex', ['debug', 'models', '--bundled'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
const models = Array.isArray(catalog) ? catalog : catalog.models;
if (!Array.isArray(models)) throw new Error('Unexpected Codex catalog shape');
const changed = [];
for (const model of models) {
  if (model.tool_mode === 'code_mode_only') {
    model.tool_mode = 'direct';
    changed.push(model.slug);
  }
}
mkdirSync(state, { recursive: true });
writeFileSync(`${state}codex-models.json`, JSON.stringify(catalog, null, 2));
console.log(JSON.stringify({ file: `${state}codex-models.json`, changed_tool_mode_only: changed }));
