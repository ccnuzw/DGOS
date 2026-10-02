import { useEffect, useState } from 'react';
import { Alert, Button, Empty, Panel, Status } from '@dgos/dgos-ui';
import { api, items, json, receiptError } from './api';
import { allLabels } from './i18n';

type Dict = Record<string, any>;
type T = ReturnType<typeof allLabels>;

interface ConnectionMetrics {
  toolCount: number;
  lastConnected?: string;
  failureReason?: string;
}

export function EnhancedMcpList({
  t,
  onSelectForConfig,
  onSelectForTools,
}: {
  t: T;
  onSelectForConfig: (server: Dict) => void;
  onSelectForTools: (server: Dict) => void;
}) {
  const [servers, setServers] = useState<Dict[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Record<string, ConnectionMetrics>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<Dict | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const result = await api<Dict>('/api/v1/mcp');
      const serverList = items(result);
      setServers(serverList);

      // Load tool counts for connected servers
      for (const server of serverList) {
        if (server.connectionState === 'connected') {
          loadMetrics(server.id);
        }
      }
    } catch (failure) {
      setError(receiptError(failure));
    } finally {
      setLoading(false);
    }
  }

  async function loadMetrics(serverId: string) {
    try {
      const result = await api<Dict>(`/api/v1/mcp/${encodeURIComponent(serverId)}/tools`);
      const toolCount = items(result).length;
      setMetrics((prev) => ({
        ...prev,
        [serverId]: { toolCount, lastConnected: new Date().toISOString() },
      }));
    } catch (failure) {
      // Silent fail - metrics are optional
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggleState(server: Dict) {
    setBusy(server.id);
    setError('');
    try {
      const newState = server.state === 'enabled' ? 'disabled' : 'enabled';
      await api(
        `/api/v1/mcp/${encodeURIComponent(server.id)}/state`,
        json({
          requestId: crypto.randomUUID(),
          baseVersion: server.stateVersion,
          desiredState: newState,
        }),
      );
      await load();
    } catch (failure) {
      setError(receiptError(failure));
    } finally {
      setBusy(null);
    }
  }

  async function toggleConnection(server: Dict) {
    setBusy(server.id);
    setError('');
    try {
      const action = server.connectionState === 'connected' ? 'disconnect' : 'connect';
      await api(
        `/api/v1/mcp/${encodeURIComponent(server.id)}/${action}`,
        json({
          requestId: crypto.randomUUID(),
          baseVersion: server.stateVersion,
        }),
      );
      await load();

      // Load metrics after successful connection
      if (action === 'connect') {
        setTimeout(() => loadMetrics(server.id), 1000);
      }
    } catch (failure) {
      setError(receiptError(failure));
    } finally {
      setBusy(null);
    }
  }

  async function discoverTools(server: Dict) {
    setBusy(server.id);
    setError('');
    try {
      await api(
        `/api/v1/mcp/${encodeURIComponent(server.id)}/tools`,
        json({
          requestId: crypto.randomUUID(),
          baseVersion: server.stateVersion,
        }),
      );
      await loadMetrics(server.id);
      onSelectForTools(server);
    } catch (failure) {
      setError(receiptError(failure));
    } finally {
      setBusy(null);
    }
  }

  async function deleteServer(server: Dict) {
    setBusy(server.id);
    setError('');
    setDeleteConfirm(null);
    try {
      await api(
        `/api/v1/mcp/${encodeURIComponent(server.id)}`,
        json(
          {
            requestId: crypto.randomUUID(),
            baseVersion: server.stateVersion,
          },
          'DELETE',
        ),
      );
      await load();
    } catch (failure) {
      setError(receiptError(failure));
    } finally {
      setBusy(null);
    }
  }

  function getConnectionStateLabel(state: string): string {
    switch (state) {
      case 'connected':
        return t.connected || 'Connected';
      case 'connecting':
        return t.connecting || 'Connecting...';
      case 'disconnected':
        return t.disconnected || 'Disconnected';
      case 'failed':
        return t.connectionFailed || 'Failed';
      case 'needs-credentials':
        return t.needsCredentials || 'Needs Credentials';
      case 'stopped':
        return t.stopped || 'Stopped';
      default:
        return state;
    }
  }

  function getConnectionColor(state: string): 'success' | 'warning' | 'error' | 'info' {
    switch (state) {
      case 'connected':
        return 'success';
      case 'connecting':
        return 'info';
      case 'failed':
      case 'needs-credentials':
        return 'error';
      default:
        return 'warning';
    }
  }

  if (loading && servers.length === 0) {
    return (
      <Panel>
        <h2>{t.mcpServers || 'MCP Servers'}</h2>
        <p role="status">{t.loading}</p>
      </Panel>
    );
  }

  return (
    <>
      <Panel>
        <div className="row between">
          <h2>{t.mcpServers || 'MCP Servers'}</h2>
          <Button onClick={load} busy={loading}>
            {t.refresh}
          </Button>
        </div>

        {error && <Alert>{error}</Alert>}

        {servers.length === 0 ? (
          <Empty>{t.noMcpServers || 'No MCP servers installed'}</Empty>
        ) : (
          <ul className="record-list">
            {servers.map((server) => {
              const serverMetrics = metrics[server.id];
              const isBusy = busy === server.id;
              const connectionState = server.connectionState || 'disconnected';
              const canConnect =
                server.state === 'enabled' &&
                ['disconnected', 'stopped', 'failed'].includes(connectionState);
              const canDisconnect = connectionState === 'connected';

              return (
                <li key={server.id} className="mcp-server-card">
                  <div className="server-info">
                    <strong>{server.displayName || server.id}</strong>
                    <small>
                      {server.id} · {server.version}
                      {server.credentialStatus && ` · ${server.credentialStatus}`}
                    </small>
                    <div className="server-status">
                      <Status value={server.state} />
                      <span
                        className={`connection-badge connection-${getConnectionColor(connectionState)}`}
                      >
                        {getConnectionStateLabel(connectionState)}
                      </span>
                      {serverMetrics && connectionState === 'connected' && (
                        <span className="tool-count">
                          {serverMetrics.toolCount} {t.tools || 'tools'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="server-actions row">
                    <Button
                      onClick={() => toggleState(server)}
                      disabled={isBusy}
                      busy={isBusy}
                    >
                      {server.state === 'enabled' ? t.disable : t.enable}
                    </Button>

                    {canConnect && (
                      <Button
                        onClick={() => toggleConnection(server)}
                        disabled={isBusy}
                        busy={isBusy}
                      >
                        {t.connect}
                      </Button>
                    )}

                    {canDisconnect && (
                      <Button
                        onClick={() => toggleConnection(server)}
                        disabled={isBusy}
                        busy={isBusy}
                      >
                        {t.disconnect}
                      </Button>
                    )}

                    {connectionState === 'connected' && (
                      <Button
                        onClick={() => discoverTools(server)}
                        disabled={isBusy}
                        busy={isBusy}
                      >
                        {t.discoverTools || 'Discover Tools'}
                      </Button>
                    )}

                    {['stopped', 'failed', 'needs-credentials'].includes(connectionState) && (
                      <Button onClick={() => onSelectForConfig(server)} disabled={isBusy}>
                        {t.configureMcp}
                      </Button>
                    )}

                    <Button
                      variant="danger"
                      onClick={() => setDeleteConfirm(server)}
                      disabled={isBusy}
                    >
                      {t.uninstall}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {deleteConfirm && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={t.confirmDelete || 'Confirm Delete'}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>
              {t.uninstall} {deleteConfirm.displayName || deleteConfirm.id}
            </h2>
            <p>
              {t.mcpDeleteWarning ||
                'This will remove the MCP server configuration. Active tool invocations may fail.'}
            </p>
            {metrics[deleteConfirm.id]?.toolCount > 0 && (
              <Alert kind="error">
                {t.mcpHasTools ||
                  `This server provides ${metrics[deleteConfirm.id].toolCount} tools that may be in use.`}
              </Alert>
            )}
            <div className="row">
              <Button variant="danger" onClick={() => deleteServer(deleteConfirm)} busy={busy === deleteConfirm.id}>
                {t.confirm} {t.uninstall}
              </Button>
              <Button onClick={() => setDeleteConfirm(null)}>{t.cancel}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
