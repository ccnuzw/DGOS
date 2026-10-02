import { useEffect, useState } from 'react';
import { Alert, Button, Panel, Status } from '@dgos/dgos-ui';
import { api, receiptError } from './api';
import { allLabels } from './i18n';
import { displayNumber } from './region';

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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

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

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      void load();
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

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
    </div>
  );
}
