/**
 * MCP Server Details Component
 * Detailed view of an MCP server with tools, resources, prompts, and logs
 */

import { useState, useEffect } from 'react';
import { Alert, Button, Panel, Tabs, Empty, Badge } from '@dgos/dgos-ui';
import { api, items, json, receiptError } from './api';
import { allLabels } from './i18n';

type Dict = Record<string, any>;
type T = ReturnType<typeof allLabels>;

interface MCPServerDetailsProps {
  t: T;
  server: Dict;
  onClose: () => void;
  onRefresh: () => void;
}

export function MCPServerDetails({ t, server, onClose, onRefresh }: MCPServerDetailsProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'tools' | 'resources' | 'prompts' | 'logs'>(
    'info'
  );
  const [tools, setTools] = useState<Dict[]>([]);
  const [resources, setResources] = useState<Dict[]>([]);
  const [prompts, setPrompts] = useState<Dict[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (server.connectionState === 'connected') {
      loadServerCapabilities();
    }
  }, [server.id]);

  async function loadServerCapabilities() {
    setLoading(true);
    setError('');

    try {
      // Load tools
      const toolsResult = await api<Dict>(`/api/v1/mcp/${encodeURIComponent(server.id)}/tools`);
      setTools(items(toolsResult));

      // Load resources if supported
      if (server.capabilities?.resources) {
        try {
          const resourcesResult = await api<Dict>(
            `/api/v1/mcp/${encodeURIComponent(server.id)}/resources`
          );
          setResources(items(resourcesResult));
        } catch {
          // Resources not available
        }
      }

      // Load prompts if supported
      if (server.capabilities?.prompts) {
        try {
          const promptsResult = await api<Dict>(
            `/api/v1/mcp/${encodeURIComponent(server.id)}/prompts`
          );
          setPrompts(items(promptsResult));
        } catch {
          // Prompts not available
        }
      }
    } catch (failure) {
      setError(receiptError(failure));
    } finally {
      setLoading(false);
    }
  }

  async function handleReconnect() {
    setBusy(true);
    setError('');
    try {
      await api(
        `/api/v1/mcp/${encodeURIComponent(server.id)}/connect`,
        json({
          requestId: crypto.randomUUID(),
          baseVersion: server.stateVersion,
        })
      );
      onRefresh();
      await loadServerCapabilities();
    } catch (failure) {
      setError(receiptError(failure));
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    setBusy(true);
    setError('');
    try {
      await api(
        `/api/v1/mcp/${encodeURIComponent(server.id)}/disconnect`,
        json({
          requestId: crypto.randomUUID(),
          baseVersion: server.stateVersion,
        })
      );
      onRefresh();
    } catch (failure) {
      setError(receiptError(failure));
    } finally {
      setBusy(false);
    }
  }

  async function testTool(tool: Dict) {
    // This would open a tool invocation dialog
    console.log('Test tool:', tool);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-large"
        role="dialog"
        aria-modal="true"
        aria-label={t.serverDetails || 'Server Details'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>{server.displayName || server.id}</h2>
            <div className="server-meta">
              <Badge variant="info">{server.version}</Badge>
              <Badge
                variant={
                  server.connectionState === 'connected'
                    ? 'success'
                    : server.connectionState === 'connecting'
                    ? 'warning'
                    : 'error'
                }
              >
                {server.connectionState}
              </Badge>
            </div>
          </div>
          <Button onClick={onClose} variant="ghost">
            {t.close}
          </Button>
        </div>

        {error && <Alert kind="error">{error}</Alert>}

        <Tabs
          value={activeTab}
          onChange={(value) => setActiveTab(value as any)}
          tabs={[
            { id: 'info', label: t.information || 'Information' },
            { id: 'tools', label: `${t.tools || 'Tools'} (${tools.length})` },
            {
              id: 'resources',
              label: `${t.resources || 'Resources'} (${resources.length})`,
              disabled: !server.capabilities?.resources,
            },
            {
              id: 'prompts',
              label: `${t.prompts || 'Prompts'} (${prompts.length})`,
              disabled: !server.capabilities?.prompts,
            },
            { id: 'logs', label: t.logs || 'Logs' },
          ]}
        />

        <div className="modal-content">
          {activeTab === 'info' && (
            <Panel>
              <dl className="data-grid">
                <div>
                  <dt>{t.serverId || 'Server ID'}</dt>
                  <dd className="code">{server.id}</dd>
                </div>
                <div>
                  <dt>{t.version || 'Version'}</dt>
                  <dd>{server.version}</dd>
                </div>
                <div>
                  <dt>{t.connectionType || 'Connection Type'}</dt>
                  <dd>{server.transport || 'stdio'}</dd>
                </div>
                {server.command && (
                  <div>
                    <dt>{t.command || 'Command'}</dt>
                    <dd className="code">{server.command}</dd>
                  </div>
                )}
                {server.args && server.args.length > 0 && (
                  <div>
                    <dt>{t.arguments || 'Arguments'}</dt>
                    <dd className="code">{server.args.join(' ')}</dd>
                  </div>
                )}
                {server.lastConnected && (
                  <div>
                    <dt>{t.lastConnected || 'Last Connected'}</dt>
                    <dd>{new Date(server.lastConnected).toLocaleString()}</dd>
                  </div>
                )}
                <div>
                  <dt>{t.capabilities || 'Capabilities'}</dt>
                  <dd>
                    <div className="capability-list">
                      {server.capabilities?.tools && <Badge>Tools</Badge>}
                      {server.capabilities?.resources && <Badge>Resources</Badge>}
                      {server.capabilities?.prompts && <Badge>Prompts</Badge>}
                      {server.capabilities?.sampling && <Badge>Sampling</Badge>}
                    </div>
                  </dd>
                </div>
              </dl>

              <div className="action-buttons">
                {server.connectionState === 'connected' && (
                  <Button onClick={handleDisconnect} busy={busy}>
                    {t.disconnect}
                  </Button>
                )}
                {server.connectionState !== 'connected' && (
                  <Button onClick={handleReconnect} busy={busy} variant="primary">
                    {t.reconnect || 'Reconnect'}
                  </Button>
                )}
              </div>
            </Panel>
          )}

          {activeTab === 'tools' && (
            <Panel>
              {loading ? (
                <p>{t.loading}</p>
              ) : tools.length === 0 ? (
                <Empty>{t.noToolsAvailable || 'No tools available'}</Empty>
              ) : (
                <ul className="tool-list">
                  {tools.map((tool, index) => (
                    <li key={index} className="tool-item">
                      <div className="tool-info">
                        <strong>{tool.name}</strong>
                        <p className="tool-description">{tool.description}</p>
                        {tool.inputSchema && (
                          <details className="tool-schema">
                            <summary>{t.inputSchema || 'Input Schema'}</summary>
                            <pre>{JSON.stringify(tool.inputSchema, null, 2)}</pre>
                          </details>
                        )}
                      </div>
                      <Button onClick={() => testTool(tool)} size="small">
                        {t.test || 'Test'}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {activeTab === 'resources' && (
            <Panel>
              {loading ? (
                <p>{t.loading}</p>
              ) : resources.length === 0 ? (
                <Empty>{t.noResourcesAvailable || 'No resources available'}</Empty>
              ) : (
                <ul className="resource-list">
                  {resources.map((resource, index) => (
                    <li key={index} className="resource-item">
                      <div className="resource-info">
                        <strong>{resource.name || resource.uri}</strong>
                        {resource.description && <p>{resource.description}</p>}
                        <code className="resource-uri">{resource.uri}</code>
                        {resource.mimeType && (
                          <Badge variant="info">{resource.mimeType}</Badge>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {activeTab === 'prompts' && (
            <Panel>
              {loading ? (
                <p>{t.loading}</p>
              ) : prompts.length === 0 ? (
                <Empty>{t.noPromptsAvailable || 'No prompts available'}</Empty>
              ) : (
                <ul className="prompt-list">
                  {prompts.map((prompt, index) => (
                    <li key={index} className="prompt-item">
                      <div className="prompt-info">
                        <strong>{prompt.name}</strong>
                        {prompt.description && <p>{prompt.description}</p>}
                        {prompt.arguments && prompt.arguments.length > 0 && (
                          <div className="prompt-arguments">
                            <strong>{t.arguments || 'Arguments'}:</strong>
                            <ul>
                              {prompt.arguments.map((arg: any, i: number) => (
                                <li key={i}>
                                  <code>{arg.name}</code>
                                  {arg.required && <Badge variant="warning">Required</Badge>}
                                  {arg.description && ` - ${arg.description}`}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {activeTab === 'logs' && (
            <Panel>
              {logs.length === 0 ? (
                <Empty>{t.noLogs || 'No logs available'}</Empty>
              ) : (
                <pre className="log-viewer">{logs.join('\n')}</pre>
              )}
            </Panel>
          )}
        </div>

        <div className="modal-footer">
          <Button onClick={onClose}>{t.close}</Button>
        </div>
      </div>
    </div>
  );
}
