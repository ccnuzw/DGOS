import { useEffect, useState } from 'react';
import { Alert, Button, Panel, Status, Badge, Empty } from '@dgos/dgos-ui';
import { api, receiptError, items } from './api';
import { allLabels } from './i18n';
import { displayNumber } from './region';
import { webHost } from '@dgos/host-adapter-web';
import { routes } from '@dgos/design-tokens';

type Dict = Record<string, any>;
type T = ReturnType<typeof allLabels>;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.length > 0 ? parts.join(' ') : '< 1m';
}

export function SystemInfo({ t }: { t: T }) {
  const [data, setData] = useState<Dict | null>(null);
  const [apps, setApps] = useState<Dict[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [appsLoading, setAppsLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const result = await api<Dict>('/api/v1/system/info');
      setData(result);
      setError('');
    } catch (e) {
      setError(receiptError(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadApps() {
    setAppsLoading(true);
    try {
      const result = await api<Dict>('/api/v1/apps');
      setApps(items(result).filter((app: Dict) => app.catalogState === 'installed'));
    } catch (e) {
      // Apps may not be available
    } finally {
      setAppsLoading(false);
    }
  }

  useEffect(() => {
    void load();
    void loadApps();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      void load();
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getHealthStatus = (): 'healthy' | 'degraded' | 'unhealthy' => {
    if (!data) return 'unhealthy';
    const services = data.services || {};
    const statuses = [
      services.api?.status,
      services.worker?.status,
      services.database?.status,
      services.redis?.status,
    ];

    const failed = statuses.filter(s => s === 'failed' || s === 'error' || s === 'unavailable').length;
    if (failed > 0) return 'unhealthy';

    const degraded = statuses.filter(s => s === 'degraded' || s === 'warning').length;
    if (degraded > 0) return 'degraded';

    return 'healthy';
  };

  const healthStatus = getHealthStatus();
  const healthColors = {
    healthy: 'success',
    degraded: 'warning',
    unhealthy: 'danger',
  };

  if (loading && !data) {
    return (
      <div className="stack">
        <Panel>
          <p role="status">{t.loading}</p>
        </Panel>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="stack">
        <Panel>
          <Alert>{error}</Alert>
          <Button onClick={() => void load()}>{t.retry}</Button>
        </Panel>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="stack">
      {error && <Alert>{error}</Alert>}

      <Panel>
        <div className="row between">
          <h2>{t.systemInformation}</h2>
          <div className="row">
            <Badge variant={healthColors[healthStatus] as any}>
              {healthStatus.toUpperCase()}
            </Badge>
            <label className="checkline">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                aria-label={t.autoRefresh}
              />
              {t.autoRefresh}
            </label>
            <Button onClick={() => void load()}>{t.refresh}</Button>
          </div>
        </div>

        <div className="two-col">
          <div>
            <h3>{t.systemSection}</h3>
            <dl className="info-list">
              <dt>{t.dgosVersion}</dt>
              <dd>{data.system?.version || 'V1'}</dd>

              <dt>{t.apiVersion}</dt>
              <dd>{data.system?.apiVersion || 'unknown'}</dd>

              <dt>{t.nodejs}</dt>
              <dd>{data.system?.nodeVersion || process.version}</dd>

              <dt>{t.platform}</dt>
              <dd>{data.system?.platform || 'unknown'}</dd>

              <dt>{t.uptime}</dt>
              <dd>{data.system?.uptime ? formatUptime(data.system.uptime) : 'unknown'}</dd>
            </dl>
          </div>

          <div>
            <h3>{t.resourcesSection}</h3>
            <dl className="info-list">
              <dt>{t.cpuUsage}</dt>
              <dd>{data.resources?.cpuUsage ? `${displayNumber(data.resources.cpuUsage)}%` : 'N/A'}</dd>

              <dt>{t.memoryUsed}</dt>
              <dd>
                {data.resources?.memoryUsed && data.resources?.memoryTotal
                  ? `${formatBytes(data.resources.memoryUsed)} / ${formatBytes(data.resources.memoryTotal)} (${displayNumber((data.resources.memoryUsed / data.resources.memoryTotal) * 100)}%)`
                  : 'N/A'}
              </dd>

              <dt>{t.heapUsed}</dt>
              <dd>
                {data.resources?.heapUsed && data.resources?.heapTotal
                  ? `${formatBytes(data.resources.heapUsed)} / ${formatBytes(data.resources.heapTotal)}`
                  : 'N/A'}
              </dd>
            </dl>
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="row between">
          <h2>{t.installedApps}</h2>
          <Button onClick={() => void loadApps()}>{t.refresh}</Button>
        </div>
        {appsLoading ? (
          <p role="status">{t.loading}</p>
        ) : apps.length > 0 ? (
          <ul className="record-list">
            {apps.map((app: Dict) => (
              <li key={app.appId}>
                <div>
                  <strong>{app.displayName || app.name?.['en-US'] || app.name?.['zh-CN'] || app.appId}</strong>
                  <small>
                    {app.appId} · v{app.version} · {t.build} {app.build}
                  </small>
                </div>
                <div className="row">
                  <Button onClick={() => webHost.open(`/apps/${app.appId}`)}>
                    {t.launch}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{t.empty}</Empty>
        )}
      </Panel>

      <Panel>
        <h2>{t.servicesSection}</h2>
        <div className="two-col">
          <div>
            <h3>{t.coreServices}</h3>
            <ul className="service-list">
              <li>
                <span>{t.apiServer}</span>
                <Status value={data.services?.api?.status || 'unknown'} />
              </li>
              <li>
                <span>{t.worker}</span>
                <Status value={data.services?.worker?.status || 'unknown'} />
              </li>
              <li>
                <span>{t.database}</span>
                <Status value={data.services?.database?.status || 'unknown'} />
                {data.services?.database?.connections !== undefined && (
                  <small>{data.services.database.connections} {t.connections}</small>
                )}
              </li>
              <li>
                <span>{t.redis}</span>
                <Status value={data.services?.redis?.status || 'unknown'} />
              </li>
            </ul>
          </div>

          <div>
            <h3>{t.networkSection}</h3>
            <dl className="info-list">
              <dt>{t.proxyModeLabel}</dt>
              <dd>{data.network?.proxyMode || 'unknown'}</dd>

              <dt>{t.effectiveRoute}</dt>
              <dd>{data.network?.effectiveRoute || 'none'}</dd>

              {data.network?.restartRequired && (
                <>
                  <dt>{t.status}</dt>
                  <dd className="warning">{t.restartRequiredLabel}</dd>
                </>
              )}

              {data.network?.affectedServices?.length > 0 && (
                <>
                  <dt>{t.affectedServices}</dt>
                  <dd>{data.network.affectedServices.join(', ')}</dd>
                </>
              )}
            </dl>
          </div>
        </div>
      </Panel>

      <Panel>
        <h2>{t.applicationsSection}</h2>
        <div className="two-col">
          <div>
            <dl className="info-list">
              <dt>{t.installedApps}</dt>
              <dd>{data.apps?.installedCount !== undefined ? data.apps.installedCount : 'N/A'}</dd>

              <dt>{t.runningApps}</dt>
              <dd>{data.apps?.runningCount !== undefined ? data.apps.runningCount : 'N/A'}</dd>
            </dl>
          </div>

          <div>
            <dl className="info-list">
              <dt>{t.activeSessions}</dt>
              <dd>{data.sessions?.activeCount !== undefined ? data.sessions.activeCount : 'N/A'}</dd>

              <dt>{t.totalUsers}</dt>
              <dd>{data.sessions?.totalUsers !== undefined ? data.sessions.totalUsers : 'N/A'}</dd>
            </dl>
          </div>
        </div>
      </Panel>

      <Panel>
        <h2>{t.storageSection}</h2>
        <div className="two-col">
          <div>
            <dl className="info-list">
              <dt>{t.databaseType}</dt>
              <dd>{data.storage?.databaseType || 'In-Memory'}</dd>

              <dt>{t.databaseSize}</dt>
              <dd>{data.storage?.databaseSize ? formatBytes(data.storage.databaseSize) : 'N/A'}</dd>
            </dl>
          </div>

          <div>
            <dl className="info-list">
              <dt>{t.totalRecords}</dt>
              <dd>{data.storage?.totalRecords !== undefined ? displayNumber(data.storage.totalRecords) : 'N/A'}</dd>

              <dt>{t.auditEventsLabel}</dt>
              <dd>{data.storage?.auditEvents !== undefined ? displayNumber(data.storage.auditEvents) : 'N/A'}</dd>
            </dl>
          </div>
        </div>
      </Panel>

      <Panel>
        <h2>Quick Actions</h2>
        <div className="quick-actions-grid">
          <button
            className="quick-action-card"
            onClick={() => webHost.open(routes.settings)}
          >
            <strong>{t.settings}</strong>
            <span>{t.systemContext}</span>
          </button>
          <button
            className="quick-action-card"
            onClick={() => webHost.open(routes.developer)}
          >
            <strong>{t.developer}</strong>
            <span>Development tools</span>
          </button>
          <button
            className="quick-action-card"
            onClick={() => webHost.open(routes.catalog)}
          >
            <strong>{t.catalog}</strong>
            <span>Manage applications</span>
          </button>
          <button
            className="quick-action-card"
            onClick={() => webHost.open(routes.providers)}
          >
            <strong>{t.providers}</strong>
            <span>Provider configurations</span>
          </button>
        </div>
      </Panel>
    </div>
  );
}
