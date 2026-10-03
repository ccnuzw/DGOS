// Skill Testing Interface

import { useState, type FormEvent } from 'react';
import { Alert, Button, Panel } from '@dgos/dgos-ui';
import { api, json, receiptError } from './api';
import { allLabels } from './i18n';
import { useDialogKeyboard } from './dialog';

type Dict = Record<string, any>;
type T = ReturnType<typeof allLabels>;

export function SkillTester({ skillId, manifest, t, onClose }: {
  skillId: string;
  manifest: Dict;
  t: T;
  onClose: () => void;
}) {
  const [parameters, setParameters] = useState<Dict>({});
  const [result, setResult] = useState<Dict | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');

  useDialogKeyboard(true, onClose);

  async function runTest(event: FormEvent) {
    event.preventDefault();
    setExecuting(true);
    setError('');
    setResult(null);
    setLogs([]);

    try {
      const startTime = Date.now();
      addLog('Starting skill execution...');

      const response = await api(
        `/api/v1/skills/${encodeURIComponent(skillId)}/execute`,
        json({
          requestId: crypto.randomUUID(),
          parameters,
        })
      );

      const duration = Date.now() - startTime;
      addLog(`Execution completed in ${duration}ms`);

      setResult(response);
    } catch (err) {
      setError(receiptError(err));
      addLog(`Error: ${receiptError(err)}`);
    } finally {
      setExecuting(false);
    }
  }

  function addLog(message: string) {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  }

  function handleParameterChange(paramName: string, value: any) {
    setParameters(prev => ({
      ...prev,
      [paramName]: value,
    }));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal skill-tester" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Test Skill: {skillId}</h2>
          <Button onClick={onClose}>{t.close}</Button>
        </div>

        <form onSubmit={runTest}>
          {/* Parameters Input */}
          <section>
            <h3>Input Parameters</h3>
            {manifest.parameters?.length > 0 ? (
              manifest.parameters.map((param: Dict) => (
                <label key={param.name}>
                  {param.name}
                  {param.required && <span className="required">*</span>}
                  <small>{param.description}</small>
                  {param.type === 'enum' ? (
                    <select
                      required={param.required}
                      value={parameters[param.name] || param.default || ''}
                      onChange={(e) => handleParameterChange(param.name, e.target.value)}
                    >
                      <option value="">Select...</option>
                      {param.options?.map((opt: string) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : param.type === 'number' ? (
                    <input
                      type="number"
                      required={param.required}
                      value={parameters[param.name] ?? param.default ?? ''}
                      onChange={(e) => handleParameterChange(param.name, Number(e.target.value))}
                      min={param.validation?.min}
                      max={param.validation?.max}
                    />
                  ) : param.type === 'boolean' ? (
                    <input
                      type="checkbox"
                      checked={parameters[param.name] ?? param.default ?? false}
                      onChange={(e) => handleParameterChange(param.name, e.target.checked)}
                    />
                  ) : (
                    <input
                      type="text"
                      required={param.required}
                      value={parameters[param.name] ?? param.default ?? ''}
                      onChange={(e) => handleParameterChange(param.name, e.target.value)}
                      pattern={param.validation?.pattern}
                    />
                  )}
                </label>
              ))
            ) : (
              <p>No parameters required</p>
            )}
          </section>

          {/* Execution Controls */}
          <div className="row">
            <Button type="submit" variant="primary" busy={executing}>
              Run Test
            </Button>
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>

        {/* Logs */}
        {logs.length > 0 && (
          <section>
            <h3>Execution Logs</h3>
            <pre className="logs-panel">
              {logs.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
            </pre>
          </section>
        )}

        {/* Error */}
        {error && <Alert>{error}</Alert>}

        {/* Result */}
        {result && (
          <section>
            <h3>Result</h3>
            <div className="result-panel">
              <dl>
                <dt>Success</dt>
                <dd>{result.success ? 'Yes' : 'No'}</dd>
                {result.metadata?.duration && (
                  <>
                    <dt>Duration</dt>
                    <dd>{result.metadata.duration}ms</dd>
                  </>
                )}
                {result.metadata?.tokensUsed && (
                  <>
                    <dt>Tokens Used</dt>
                    <dd>{result.metadata.tokensUsed}</dd>
                  </>
                )}
              </dl>

              {result.output && (
                <>
                  <h4>Output</h4>
                  <pre>{JSON.stringify(result.output, null, 2)}</pre>
                </>
              )}

              {result.error && (
                <>
                  <h4>Error</h4>
                  <Alert>
                    <strong>{result.error.code}</strong>: {result.error.message}
                    {result.error.details && (
                      <pre>{JSON.stringify(result.error.details, null, 2)}</pre>
                    )}
                  </Alert>
                </>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
