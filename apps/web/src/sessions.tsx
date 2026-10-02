import { useState } from 'react';
import { Alert, Button, Empty, Panel, Status } from '@dgos/dgos-ui';
import { ApiError, api, items, json, receiptError } from './api';
import { useDialogKeyboard } from './dialog';
import { displayDate } from './region';
import { allLabels } from './i18n';

type Dict = Record<string, any>;
type T = ReturnType<typeof allLabels>;

export function DeviceSessions({ t, onStepUp }: { t: T; onStepUp: (retry: () => Promise<void>) => void }) {
  const [devices, setDevices] = useState<Dict[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState<Dict | null>(null);
  const [busy, setBusy] = useState(false);
  useDialogKeyboard(Boolean(target), () => setTarget(null));
  async function load() {
    setLoading(true); setError('');
    try { setDevices(items(await api('/api/v1/identity/admin/sessions'))); }
    catch (failure) { setError(receiptError(failure)); }
    finally { setLoading(false); }
  }
  async function revoke(device: Dict, requestId: string) {
    setBusy(true); setError('');
    try {
      await api(`/api/v1/identity/admin/sessions/${encodeURIComponent(device.sessionManagementId)}`, json({ requestId }, 'DELETE'));
      setTarget(null);
      await load();
    } catch (failure) {
      if (failure instanceof ApiError && failure.errorKey === 'step_up_required') {
        setTarget(null);
        onStepUp(() => revoke(device, requestId));
      } else setError(receiptError(failure));
    } finally { setBusy(false); }
  }
  return <Panel><div className="row between"><h2>{t.devices}</h2><Button onClick={load} busy={loading}>{t.refresh}</Button></div>
    {error && <Alert>{error}</Alert>}
    {devices && (devices.length ? <ul className="record-list">{devices.map(device => <li key={device.sessionManagementId}><div><strong>{device.deviceSummary?.label || device.deviceSummary?.host || t.unknownDevice}{device.current ? ` · ${t.currentDevice}` : ''}</strong><small>{t.created}: {displayDate(device.createdAt)} · {t.expires}: {displayDate(device.expiresAt)}</small></div><div className="row"><Status value={device.state} />{!device.current && device.state === 'active' && <Button variant="danger" onClick={() => setTarget(device)}>{t.revoke}</Button>}</div></li>)}</ul> : <Empty>{t.empty}</Empty>)}
    {target && <div className="modal-backdrop" onClick={() => setTarget(null)}><div className="modal" role="dialog" aria-modal="true" aria-label={t.revokeDevice} onClick={event => event.stopPropagation()}><h2>{t.revokeDevice}</h2><p>{target.deviceSummary?.label || target.deviceSummary?.host || t.unknownDevice}</p><div className="row"><Button variant="danger" busy={busy} onClick={() => revoke(target, crypto.randomUUID())}>{t.confirm}</Button><Button onClick={() => setTarget(null)}>{t.cancel}</Button></div></div></div>}
  </Panel>;
}
