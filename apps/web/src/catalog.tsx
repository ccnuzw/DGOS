import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Empty, Panel, Status } from '@dgos/dgos-ui';
import { ApiError, api, items, json, receiptError } from './api';
import { allLabels } from './i18n';

type Dict = Record<string, any>;
type T = ReturnType<typeof allLabels>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Dict => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const fields = (value: Dict, allowed: string[], required: string[] = []) => Object.keys(value).every(key => allowed.includes(key)) && required.every(key => Object.hasOwn(value, key));
const nonempty = (value: unknown) => typeof value === 'string' && value.length > 0;
function validBridgeInput(capability: string, input: unknown): input is Dict {
  if (!record(input)) return false;
  switch (capability) {
    case 'dgos.model.list': return fields(input, ['providerConfigId']) && (input.providerConfigId === undefined || nonempty(input.providerConfigId));
    case 'dgos.model.resolve': return fields(input, ['providerConfigId', 'modelId', 'intent'], ['providerConfigId', 'modelId', 'intent']) && nonempty(input.providerConfigId) && nonempty(input.modelId) && input.intent === 'text.chat';
    case 'dgos.system.context.read': return fields(input, []);
    case 'dgos.system.context.events': return fields(input, ['cursor'], ['cursor']) && typeof input.cursor === 'string' && /^(0|[1-9][0-9]*)$/.test(input.cursor);
    case 'dgos.aiTask.submit': return fields(input, ['target', 'intent', 'input', 'options'], ['target', 'intent', 'input', 'options']) && nonempty(input.target) && input.intent === 'text.chat' && record(input.input) && fields(input.input, ['text'], ['text']) && typeof input.input.text === 'string' && record(input.options) && fields(input.options, ['providerConfigId', 'modelId', 'parameters'], ['providerConfigId', 'modelId']) && nonempty(input.options.providerConfigId) && nonempty(input.options.modelId) && (input.options.parameters === undefined || record(input.options.parameters) && fields(input.options.parameters, ['temperature', 'maxOutputTokens']) && (input.options.parameters.temperature === undefined || typeof input.options.parameters.temperature === 'number' && Number.isFinite(input.options.parameters.temperature) && input.options.parameters.temperature >= 0 && input.options.parameters.temperature <= 2) && (input.options.parameters.maxOutputTokens === undefined || Number.isSafeInteger(input.options.parameters.maxOutputTokens) && input.options.parameters.maxOutputTokens >= 1));
    case 'dgos.aiTask.get':
    case 'dgos.aiTask.cancel': return fields(input, ['taskId'], ['taskId']) && nonempty(input.taskId);
    case 'dgos.aiTask.events': return fields(input, ['taskId', 'cursor'], ['taskId']) && nonempty(input.taskId) && (input.cursor === undefined || Number.isSafeInteger(input.cursor) && input.cursor >= 0);
    case 'dgos.artifact.read': return fields(input, ['artifactId'], ['artifactId']) && nonempty(input.artifactId);
    default: return false;
  }
}

function AppRuntime({ appId, receipt, subjectId, t, onClose }: { appId: string; receipt: Dict; subjectId: string; t: T; onClose: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const loadCount = useRef(0);
  const pending = useRef(new Set<string>());
  const readyRef = useRef(false);
  const expiredRef = useRef(false);
  const helloTimer = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [instanceInvalid, setInstanceInvalid] = useState(false);
  const [error, setError] = useState('');
  const taskKey = `dgos.ui.appTask.${subjectId}.${appId}`;
  const intentKey = `dgos.ui.appIntent.${subjectId}.${appId}`;
  const [taskId, setTaskId] = useState(() => localStorage.getItem(taskKey) || '');
  const [task, setTask] = useState<Dict | null>(null);
  const [events, setEvents] = useState<Dict[]>([]);
  const [artifact, setArtifact] = useState<Dict | null>(null);
  const [reading, setReading] = useState(false);
  const [pendingIntent, setPendingIntent] = useState(() => Boolean(localStorage.getItem(intentKey)));
  async function readTask(id = taskId) {
    if (!id.trim() || !readyRef.current) return;
    setReading(true); setError(''); setTask(null); setEvents([]); setArtifact(null);
    const bridge = (capability: string, input: Dict) => api<Dict>(`/api/v1/apps/${encodeURIComponent(appId)}/bridge`, json({ instanceId: receipt.instanceId, requestId: crypto.randomUUID(), capability, input }));
    try {
      id = id.trim();
      const [snapshot, batch] = await Promise.all([bridge('dgos.aiTask.get', { taskId: id }), bridge('dgos.aiTask.events', { taskId: id, cursor: 0 })]);
      setTask(snapshot); setEvents(items(batch));
      if (snapshot.artifactIds?.[0]) setArtifact(await bridge('dgos.artifact.read', { artifactId: snapshot.artifactIds[0] }));
    } catch (failure) { setError(receiptError(failure)); }
    finally { setReading(false); }
  }
  useEffect(() => {
    let live = true;
    const instanceId = receipt.instanceId;
    const windowForInstance = () => frame.current?.contentWindow;
    const reply = (requestId: string, result?: Dict, failure?: { errorKey: string; message: string; requestId: string }) => {
      if (!live || !windowForInstance()) return;
      windowForInstance()!.postMessage({ type: 'dgos.host.result', instanceId, requestId, ...(failure ? { error: failure } : { result }) }, '*');
    };
    const onMessage = async (event: MessageEvent) => {
      if (!live || expiredRef.current || event.source !== windowForInstance() || event.origin !== 'null') return;
      const message = event.data;
      if (!message || typeof message !== 'object' || Array.isArray(message) || message.instanceId !== instanceId) return;
      if (message.type === 'dgos.app.ready') {
        if (message.bridgeVersion === 1 && Object.keys(message).every(key => ['type', 'instanceId', 'bridgeVersion'].includes(key))) { readyRef.current = true; if (helloTimer.current !== null) window.clearInterval(helloTimer.current); helloTimer.current = null; setReady(true); const remembered = localStorage.getItem(taskKey); if (remembered) { setTaskId(remembered); void readTask(remembered); } }
        return;
      }
      if (message.type !== 'dgos.app.invoke' || !readyRef.current || !uuid.test(message.requestId) || pending.current.has(message.requestId)) return;
      if (Object.keys(message).some(key => !['type', 'instanceId', 'requestId', 'capability', 'input'].includes(key))) return;
      if (!receipt.declaredCapabilities.includes(message.capability) || !validBridgeInput(message.capability, message.input)) {
        reply(message.requestId, undefined, { errorKey: 'permission_denied', message: 'Capability unavailable', requestId: message.requestId });
        return;
      }
      pending.current.add(message.requestId);
      if (message.capability === 'dgos.aiTask.submit') { localStorage.setItem(intentKey, message.requestId); setPendingIntent(true); }
      try {
        const result = await api<Dict>(`/api/v1/apps/${encodeURIComponent(appId)}/bridge`, json({ instanceId, requestId: message.requestId, capability: message.capability, input: message.input }));
        if (message.capability === 'dgos.aiTask.submit' && nonempty(result.taskId)) { localStorage.setItem(taskKey, result.taskId); localStorage.removeItem(intentKey); setPendingIntent(false); setTaskId(result.taskId); }
        reply(message.requestId, result);
      } catch (failure) {
        const messageText = receiptError(failure);
        setError(messageText);
        const publicError = failure instanceof ApiError ? { errorKey: failure.errorKey || 'bridge_failed', message: failure.message, requestId: failure.requestId || message.requestId } : { errorKey: 'bridge_failed', message: messageText, requestId: message.requestId };
        reply(message.requestId, undefined, publicError);
        if (failure instanceof ApiError && (failure.status === 401 || ['session_invalid', 'app_not_installed', 'app_not_available', 'launch_ticket_invalid'].includes(failure.errorKey || ''))) {
          expiredRef.current = true;
          readyRef.current = false;
          pending.current.clear();
          if (helloTimer.current !== null) window.clearInterval(helloTimer.current);
          helloTimer.current = null;
          setReady(false);
          setInstanceInvalid(true);
        }
      } finally {
        pending.current.delete(message.requestId);
      }
    };
    window.addEventListener('message', onMessage);
    return () => { live = false; pending.current.clear(); if (helloTimer.current !== null) window.clearInterval(helloTimer.current); helloTimer.current = null; window.removeEventListener('message', onMessage); };
  }, [appId, receipt, subjectId]);
  return <Panel>
    <div className="row between"><h2>{appId}</h2><div className="row"><Status value={ready ? 'ready' : 'connecting'} /><Button onClick={onClose}>{t.close}</Button></div></div>
    {error && <Alert>{error}</Alert>}
    {!instanceInvalid && <iframe ref={frame} className="app-sandbox" title={appId} src={receipt.entrypoint} sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" onLoad={() => { readyRef.current = false; setReady(false); loadCount.current++; if (loadCount.current > 1) { expiredRef.current = true; if (helloTimer.current !== null) window.clearInterval(helloTimer.current); helloTimer.current = null; setError(t.relaunchRequired); setInstanceInvalid(true); return; } const hello = () => frame.current?.contentWindow?.postMessage({ type: 'dgos.host.hello', instanceId: receipt.instanceId, bridgeVersion: 1 }, '*'); hello(); helloTimer.current = window.setInterval(() => { if (readyRef.current || expiredRef.current) { if (helloTimer.current !== null) window.clearInterval(helloTimer.current); helloTimer.current = null; return; } hello(); }, 250); }} />}
    {appId === 'dgos.ai-workbench' && <div className="stack">{pendingIntent && <Alert>{t.pendingTaskIntent}</Alert>}<form className="inline-form" onSubmit={event => { event.preventDefault(); void readTask(); }}><label>{t.taskId}<input value={taskId} onChange={event => setTaskId(event.target.value)} required /></label><Button type="submit" disabled={!ready || reading} busy={reading}>{t.resume}</Button></form>{task && <div className="secret-receipt"><div className="row"><Status value={task.status} /><span className="task-info">{task.taskId}</span></div><pre className="task-output">{task.text || task.error?.message || task.error?.errorKey || ''}</pre><p>{t.events}: {events.length}</p>{artifact && <pre className="task-output">{artifact.content}</pre>}</div>}</div>}
  </Panel>;
}

export function AppCatalog({ t, subjectId }: { t: T; subjectId: string }) {
  const [records, setRecords] = useState<Dict[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<{ appId: string; receipt: Dict } | null>(null);
  const [confirm, setConfirm] = useState<Dict | null>(null);
  const [deployments, setDeployments] = useState<Record<string, Dict>>({});
  const [deploymentErrors, setDeploymentErrors] = useState<Record<string, string>>({});
  const [selectedVersion, setSelectedVersion] = useState<Record<string, string>>({});
  async function loadDeployment(appId: string) {
    try {
      const result = await api<Dict>(`/api/v1/apps/${encodeURIComponent(appId)}/deployment`);
      setDeployments(value => ({ ...value, [appId]: result }));
      setDeploymentErrors(value => { const next = { ...value }; delete next[appId]; return next; });
    } catch (failure) {
      setDeployments(value => { const next = { ...value }; delete next[appId]; return next; });
      setDeploymentErrors(value => ({ ...value, [appId]: failure instanceof ApiError && failure.status === 404 ? t.deploymentNotFound : receiptError(failure) }));
    }
  }
  async function reload() {
    setLoading(true);
    try { const result = await api<Dict>('/api/v1/apps'); const next = items(result); setRecords(next); setError(''); await Promise.allSettled([...new Set(next.map((item: Dict) => String(item.appId)))].map(loadDeployment)); }
    catch (failure) { setError(receiptError(failure)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void reload(); }, []);
  async function act(app: Dict, action: 'install' | 'update' | 'launch' | 'uninstall') {
    setBusy(true); setError(''); setConfirm(null);
    const deployment = deployments[app.appId];
    const body = { requestId: crypto.randomUUID(), ...(action === 'install' || action === 'update' ? { version: app.version, build: app.build, releaseChannel: app.releaseChannel } : {}), ...(deployment?.versionNumber != null ? { baseVersion: deployment.versionNumber } : {}) };
    try {
      const result = await api<Dict>(`/api/v1/apps/${encodeURIComponent(app.appId)}/${action}`, json(body));
      if (action === 'launch') {
        const prefix = `/api/v1/apps/${encodeURIComponent(app.appId)}/resources/`;
        if (!uuid.test(result.instanceId) || result.bridgeVersion !== 1 || result.isolation !== 'opaque-origin-sandbox' || !Array.isArray(result.declaredCapabilities) || typeof result.entrypoint !== 'string' || !result.entrypoint.startsWith(prefix) || !Number.isFinite(Date.parse(result.expiresAt)) || Date.parse(result.expiresAt) <= Date.now()) throw new Error('Invalid launch receipt');
        setActive({ appId: app.appId, receipt: result });
      } else {
        if (action === 'uninstall' && active?.appId === app.appId) setActive(null);
        await reload();
      }
    } catch (failure) { setError(receiptError(failure)); }
    finally { setBusy(false); }
  }
  const groups = new Map<string, Dict[]>();
  for (const record of records) {
    const key = String(record.appId);
    groups.set(key, [...(groups.get(key) || []), record]);
  }
  return <div className="stack">
    {error && <Alert>{error} <Button onClick={reload}>{t.retry}</Button></Alert>}
    <Panel><div className="row between"><h2>{t.catalog}</h2><Button onClick={reload} busy={loading}>{t.refresh}</Button></div>
      {loading && !records.length ? <p role="status">{t.loading}</p> : groups.size ? <ul className="record-list">{[...groups].map(([appId, releases]) => {
        const chosen = releases.find(release => `${release.version}:${release.build}:${release.releaseChannel}` === selectedVersion[appId]) || releases[0];
        const deployment = deployments[appId];
        return <li key={appId}><div><strong>{chosen.name?.['en-US'] || chosen.displayName || appId}</strong><small>{appId} · {chosen.catalogState}</small>{deployment ? <Status value={deployment.state} /> : <small>{deploymentErrors[appId] || t.loading}</small>}</div><div className="row"><label>{t.version}<select value={`${chosen.version}:${chosen.build}:${chosen.releaseChannel}`} onChange={event => setSelectedVersion(value => ({ ...value, [appId]: event.target.value }))}>{releases.map(release => <option key={`${release.version}:${release.build}:${release.releaseChannel}`} value={`${release.version}:${release.build}:${release.releaseChannel}`}>{release.version} · {t.build} {release.build} · {release.releaseChannel}</option>)}</select></label><Button onClick={() => act(chosen, 'install')} busy={busy}>{t.install}</Button><Button onClick={() => act(chosen, 'launch')} busy={busy}>{t.launch}</Button><Button onClick={() => act(chosen, 'update')} disabled={!deployment?.versionNumber} title={!deployment?.versionNumber ? t.deploymentVersionUnavailable : undefined} busy={busy}>{t.update}</Button><Button variant="danger" onClick={() => setConfirm(chosen)} disabled={!deployment?.versionNumber} title={!deployment?.versionNumber ? t.deploymentVersionUnavailable : undefined}>{t.uninstall}</Button></div></li>;
      })}</ul> : <Empty>{t.empty}</Empty>}
    </Panel>
    {active && <AppRuntime key={active.receipt.instanceId} appId={active.appId} receipt={active.receipt} subjectId={subjectId} t={t} onClose={() => setActive(null)} />}
    {confirm && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-label={t.uninstall}><h2>{t.uninstall} {confirm.appId}</h2><p>{t.deleteConfirm}</p><div className="row"><Button variant="danger" onClick={() => act(confirm, 'uninstall')}>{t.confirm}</Button><Button onClick={() => setConfirm(null)}>{t.cancel}</Button></div></div></div>}
  </div>;
}
