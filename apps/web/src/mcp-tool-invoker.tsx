/**
 * MCP Tool Invoker Component
 * Interface for testing and invoking MCP tools
 */

import { useState, useEffect } from 'react';
import { Alert, Button, Panel, Empty } from '@dgos/dgos-ui';
import { api, items, json, receiptError } from './api';
import { allLabels } from './i18n';

type Dict = Record<string, any>;
type T = ReturnType<typeof allLabels>;

interface MCPToolInvokerProps {
  t: T;
  selectedServer: Dict | null;
  onServerChange: (server: Dict | null) => void;
}

export function MCPToolInvoker({ t, selectedServer, onServerChange }: MCPToolInvokerProps) {
  const [servers, setServers] = useState<Dict[]>([]);
  const [tools, setTools] = useState<Dict[]>([]);
  const [selectedTool, setSelectedTool] = useState<Dict | null>(null);
  const [toolArgs, setToolArgs] = useState<Record<string, any>>({});
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<Array<{ tool: string; args: any; result: any; timestamp: string }>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    loadServers();
  }, []);

  useEffect(() => {
    if (selectedServer) {
      loadTools();
    }
  }, [selectedServer]);

  async function loadServers() {
    setLoading(true);
    try {
      const result = await api<Dict>('/api/v1/mcp');
      const serverList = items(result).filter((s: Dict) => s.connectionState === 'connected');
      setServers(serverList);
    } catch (failure) {
      setError(receiptError(failure));
    } finally {
      setLoading(false);
    }
  }

  async function loadTools() {
    if (!selectedServer) return;

    setLoading(true);
    setError('');
    try {
      const result = await api<Dict>(`/api/v1/mcp/${encodeURIComponent(selectedServer.id)}/tools`);
      setTools(items(result));
    } catch (failure) {
      setError(receiptError(failure));
    } finally {
      setLoading(false);
    }
  }

  async function executeTool() {
    if (!selectedServer || !selectedTool) return;

    setExecuting(true);
    setError('');
    setResult(null);

    const startTime = performance.now();

    try {
      const response = await api(
        `/api/v1/mcp/${encodeURIComponent(selectedServer.id)}/tools/${encodeURIComponent(selectedTool.name)}/invoke`,
        json({
          requestId: crypto.randomUUID(),
          arguments: toolArgs,
        })
      );

      const duration = performance.now() - startTime;
      const toolResult = response;

      setResult(toolResult);

      // Add to history
      setHistory([
        {
          tool: selectedTool.name,
          args: toolArgs,
          result: toolResult,
          timestamp: new Date().toISOString(),
        },
        ...history.slice(0, 9), // Keep last 10
      ]);
    } catch (failure) {
      setError(receiptError(failure));
    } finally {
      setExecuting(false);
    }
  }

  function handleToolSelect(tool: Dict) {
    setSelectedTool(tool);
    setToolArgs({});
    setResult(null);
    setError('');
  }

  function renderInputField(name: string, schema: any) {
    const value = toolArgs[name] ?? '';

    const handleChange = (newValue: any) => {
      setToolArgs({ ...toolArgs, [name]: newValue });
    };

    switch (schema.type) {
      case 'boolean':
        return (
          <label className="checkline">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleChange(e.target.checked)}
            />
            {name}
            {schema.description && <small>{schema.description}</small>}
          </label>
        );

      case 'number':
      case 'integer':
        return (
          <label>
            {name}
            {schema.description && <small>{schema.description}</small>}
            <input
              type="number"
              value={value}
              onChange={(e) => handleChange(Number(e.target.value))}
              placeholder={schema.description}
            />
          </label>
        );

      case 'array':
        return (
          <label>
            {name}
            {schema.description && <small>{schema.description}</small>}
            <textarea
              value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
              onChange={(e) => {
                try {
                  handleChange(JSON.parse(e.target.value));
                } catch {
                  handleChange(e.target.value);
                }
              }}
              placeholder="JSON array"
              rows={3}
            />
          </label>
        );

      case 'object':
        return (
          <label>
            {name}
            {schema.description && <small>{schema.description}</small>}
            <textarea
              value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
              onChange={(e) => {
                try {
                  handleChange(JSON.parse(e.target.value));
                } catch {
                  handleChange(e.target.value);
                }
              }}
              placeholder="JSON object"
              rows={5}
            />
          </label>
        );

      default:
        return (
          <label>
            {name}
            {schema.description && <small>{schema.description}</small>}
            <input
              type="text"
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={schema.description}
            />
          </label>
        );
    }
  }

  return (
    <div className="mcp-tool-invoker">
      <Panel>
        <h2>{t.toolInvoker || 'Tool Invoker'}</h2>
        <p className="section-note">
          {t.toolInvokerDescription || 'Test and invoke tools from connected MCP servers'}
        </p>

        <div className="tool-invoker-layout">
          <div className="server-selector">
            <label>
              {t.selectServer || 'Select Server'}
              <select
                value={selectedServer?.id || ''}
                onChange={(e) => {
                  const server = servers.find((s) => s.id === e.target.value);
                  onServerChange(server || null);
                }}
              >
                <option value="">{t.selectServer || 'Select Server'}</option>
                {servers.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.displayName || server.id}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedServer && (
            <div className="tool-selector">
              <label>
                {t.selectTool || 'Select Tool'}
                <select
                  value={selectedTool?.name || ''}
                  onChange={(e) => {
                    const tool = tools.find((t) => t.name === e.target.value);
                    if (tool) handleToolSelect(tool);
                  }}
                >
                  <option value="">{t.selectTool || 'Select Tool'}</option>
                  {tools.map((tool) => (
                    <option key={tool.name} value={tool.name}>
                      {tool.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>

        {error && <Alert kind="error">{error}</Alert>}

        {selectedTool && (
          <div className="tool-execution">
            <div className="tool-info">
              <h3>{selectedTool.name}</h3>
              <p>{selectedTool.description}</p>
            </div>

            <fieldset>
              <legend>{t.inputParameters || 'Input Parameters'}</legend>

              {selectedTool.inputSchema?.properties ? (
                Object.entries(selectedTool.inputSchema.properties).map(([name, schema]: [string, any]) => (
                  <div key={name} className="input-field">
                    {renderInputField(name, schema)}
                    {selectedTool.inputSchema.required?.includes(name) && (
                      <span className="required">*</span>
                    )}
                  </div>
                ))
              ) : (
                <p className="muted">{t.noParameters || 'No parameters required'}</p>
              )}
            </fieldset>

            <Button variant="primary" onClick={executeTool} busy={executing}>
              {t.execute || 'Execute'}
            </Button>

            {result && (
              <div className="tool-result">
                <h4>{t.result || 'Result'}</h4>
                {result.isError ? (
                  <Alert kind="error">
                    {result.content?.[0]?.text || t.executionError || 'Execution error'}
                  </Alert>
                ) : (
                  <div className="result-content">
                    {result.content?.map((item: any, index: number) => (
                      <div key={index} className="content-item">
                        {item.type === 'text' && <pre>{item.text}</pre>}
                        {item.type === 'image' && (
                          <img src={`data:${item.mimeType};base64,${item.data}`} alt="Result" />
                        )}
                        {item.type === 'resource' && (
                          <div>
                            <strong>Resource:</strong> <code>{item.uri}</code>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {history.length > 0 && (
          <div className="execution-history">
            <h3>{t.executionHistory || 'Execution History'}</h3>
            <ul className="history-list">
              {history.map((entry, index) => (
                <li key={index} className="history-item">
                  <div className="history-header">
                    <strong>{entry.tool}</strong>
                    <small>{new Date(entry.timestamp).toLocaleString()}</small>
                  </div>
                  <details>
                    <summary>{t.viewDetails || 'View Details'}</summary>
                    <div className="history-details">
                      <div>
                        <strong>{t.arguments || 'Arguments'}:</strong>
                        <pre>{JSON.stringify(entry.args, null, 2)}</pre>
                      </div>
                      <div>
                        <strong>{t.result || 'Result'}:</strong>
                        <pre>{JSON.stringify(entry.result, null, 2)}</pre>
                      </div>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>
    </div>
  );
}
