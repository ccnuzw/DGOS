import { useState, type FormEvent } from 'react';
import { Alert, Button, Panel, Status } from '@dgos/dgos-ui';
import { api, json, receiptError } from './api';
import { allLabels } from './i18n';
import { useDialogKeyboard } from './dialog';

type Dict = Record<string, any>;
type T = ReturnType<typeof allLabels>;

interface EnvVar {
  key: string;
  value: string;
  isSecret: boolean;
}

export function ManualMcpConfig({ t, onInstalled }: { t: T; onInstalled: () => void }) {
  const [serverId, setServerId] = useState('');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [cwd, setCwd] = useState('');
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [review, setReview] = useState<{ body: Dict; secrets: Dict } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useDialogKeyboard(Boolean(review), () => setReview(null));

  function addEnvVar() {
    setEnvVars([...envVars, { key: '', value: '', isSecret: false }]);
  }

  function updateEnvVar(index: number, field: keyof EnvVar, value: string | boolean) {
    const updated = [...envVars];
    updated[index] = { ...updated[index], [field]: value };
    setEnvVars(updated);
  }

  function removeEnvVar(index: number) {
    setEnvVars(envVars.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    // Validate
    if (!serverId.match(/^[a-z0-9][a-z0-9._-]*$/)) {
      setError(t.invalidServerId || 'Invalid server ID format');
      return;
    }

    if (!command.trim()) {
      setError(t.commandRequired || 'Command is required');
      return;
    }

    // Parse arguments
    const argsList = args
      .trim()
      .split(/\s+/)
      .filter(a => a.length > 0);

    // Build environment
    const env: Dict = {};
    const secrets: Dict = {};

    for (const envVar of envVars) {
      if (!envVar.key.trim()) continue;
      if (envVar.isSecret && envVar.value.trim()) {
        secrets[envVar.key.trim()] = envVar.value;
      } else if (envVar.value.trim()) {
        env[envVar.key.trim()] = envVar.value;
      }
    }

    // Build config
    const config = {
      transport: 'stdio',
      command: command.trim(),
      args: argsList,
      ...(cwd.trim() ? { cwd: cwd.trim() } : {}),
      ...(Object.keys(env).length ? { env } : {}),
    };

    const body = {
      requestId: crypto.randomUUID(),
      source: `manual:${serverId}`,
      config,
      confirmed: false, // Will confirm in review dialog
    };

    setReview({ body, secrets });
  }

  async function confirmInstall() {
    if (!review) return;
    setBusy(true);
    setError('');

    try {
      const payload = {
        ...review.body,
        confirmed: true,
        ...(Object.keys(review.secrets).length ? { credentials: review.secrets } : {}),
      };

      await api('/api/v1/mcp', json(payload));

      // Reset form
      setServerId('');
      setCommand('');
      setArgs('');
      setCwd('');
      setEnvVars([]);
      setReview(null);

      onInstalled();
    } catch (failure) {
      setError(receiptError(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <h2>{t.manualMcpConfig || 'Manual MCP Configuration'}</h2>
      <p className="section-note">
        {t.manualMcpHint || 'Configure a custom MCP server with command, arguments, and environment variables.'}
      </p>

      {error && <Alert>{error}</Alert>}

      <form onSubmit={handleSubmit}>
        <label>
          {t.serverId || 'Server ID'}
          <input
            required
            pattern="[a-z0-9][a-z0-9._-]*"
            placeholder="my-custom-server"
            value={serverId}
            onChange={(e) => setServerId(e.target.value)}
          />
          <small>{t.serverIdHint || 'Lowercase letters, numbers, dots, hyphens'}</small>
        </label>

        <label>
          {t.command || 'Command'}
          <input
            required
            placeholder="/usr/local/bin/my-mcp-server"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
          />
          <small>{t.commandHint || 'Full path to the MCP server executable'}</small>
        </label>

        <label>
          {t.arguments || 'Arguments'}
          <input
            placeholder="--port 3000 --verbose"
            value={args}
            onChange={(e) => setArgs(e.target.value)}
          />
          <small>{t.argsHint || 'Space-separated command arguments (optional)'}</small>
        </label>

        <label>
          {t.workingDirectory || 'Working Directory'}
          <input
            placeholder="/path/to/working/dir"
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
          />
          <small>{t.cwdHint || 'Working directory for the process (optional)'}</small>
        </label>

        <fieldset>
          <legend>{t.environmentVariables || 'Environment Variables'}</legend>

          {envVars.length === 0 && (
            <p className="muted">{t.noEnvVars || 'No environment variables configured'}</p>
          )}

          {envVars.map((envVar, index) => (
            <div key={index} className="env-var-row">
              <input
                placeholder="VARIABLE_NAME"
                value={envVar.key}
                onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
              />
              <input
                type={envVar.isSecret ? 'password' : 'text'}
                placeholder="value"
                value={envVar.value}
                onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
              />
              <label className="checkline">
                <input
                  type="checkbox"
                  checked={envVar.isSecret}
                  onChange={(e) => updateEnvVar(index, 'isSecret', e.target.checked)}
                />
                {t.secret || 'Secret'}
              </label>
              <Button type="button" onClick={() => removeEnvVar(index)}>
                {t.remove || 'Remove'}
              </Button>
            </div>
          ))}

          <Button type="button" onClick={addEnvVar}>
            {t.addEnvironmentVariable || 'Add Variable'}
          </Button>
        </fieldset>

        <Button type="submit" variant="primary">
          {t.preview}
        </Button>
      </form>

      {review && (
        <div className="modal-backdrop" onClick={() => setReview(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={t.reviewConfiguration || 'Review Configuration'}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>{t.reviewConfiguration || 'Review Configuration'}</h2>

            <dl className="data-grid">
              <div>
                <dt>{t.serverId || 'Server ID'}</dt>
                <dd>{serverId}</dd>
              </div>
              <div>
                <dt>{t.command || 'Command'}</dt>
                <dd className="code">{review.body.config.command}</dd>
              </div>
              {review.body.config.args?.length > 0 && (
                <div>
                  <dt>{t.arguments || 'Arguments'}</dt>
                  <dd className="code">{review.body.config.args.join(' ')}</dd>
                </div>
              )}
              {review.body.config.cwd && (
                <div>
                  <dt>{t.workingDirectory || 'Working Directory'}</dt>
                  <dd className="code">{review.body.config.cwd}</dd>
                </div>
              )}
              {Object.keys(review.body.config.env || {}).length > 0 && (
                <div>
                  <dt>{t.environment || 'Environment'}</dt>
                  <dd>
                    <pre>{JSON.stringify(review.body.config.env, null, 2)}</pre>
                  </dd>
                </div>
              )}
              {Object.keys(review.secrets).length > 0 && (
                <div>
                  <dt>{t.secrets || 'Secrets'}</dt>
                  <dd>{Object.keys(review.secrets).join(', ')}</dd>
                </div>
              )}
            </dl>

            <Alert kind="error">
              {t.manualConfigWarning ||
                'Manual configuration runs arbitrary commands. Ensure the command path and arguments are trusted.'}
            </Alert>

            <div className="row">
              <Button variant="primary" onClick={confirmInstall} busy={busy}>
                {t.confirm} {t.install}
              </Button>
              <Button onClick={() => setReview(null)}>{t.cancel}</Button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
