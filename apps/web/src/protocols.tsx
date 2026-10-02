import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Empty, Panel, Status } from '@dgos/dgos-ui';
import { api, items, json, receiptError } from './api';
import { allLabels } from './i18n';

type Dict = Record<string, any>;
type T = ReturnType<typeof allLabels>;
const requestId = () => crypto.randomUUID();

export function Protocols({ t }: { t: T }) {
  const [adapters, setAdapters] = useState<Dict[]>([]);
  const [profiles, setProfiles] = useState<Dict[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [validated, setValidated] = useState<Dict | null>(null);
  const [declaration, setDeclaration] = useState<Dict | null>(null);
  const [confirmation, setConfirmation] = useState<Dict | null>(null);
  const [publishRequestId, setPublishRequestId] = useState('');
  const [, setNow] = useState(Date.now());
  const [stateDraft, setStateDraft] = useState<{ profile: Dict; state: 'disabled' | 'active'; requestId: string } | null>(null);
  const [stateTicket, setStateTicket] = useState<Dict | null>(null);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const currentTicket = (ticket: Dict | null) => Boolean(ticket && Number.isFinite(Date.parse(ticket.expiresAt)) && Date.parse(ticket.expiresAt) > Date.now());
  async function load() {
    try {
      const [adapterResult, profileResult] = await Promise.all([
        api<Dict>('/api/v1/provider/protocols'),
        api<Dict>('/api/v1/provider/capability-protocols'),
      ]);
      setAdapters(items(adapterResult)); setProfiles(items(profileResult)); setError('');
    } catch (failure) { setError(receiptError(failure)); }
  }
  useEffect(() => { void load(); }, []);
  async function validate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setValidated(null); setConfirmation(null); setPublishRequestId('');
    const fields = new FormData(event.currentTarget);
    const profile = String(fields.get('profile'));
    const modelName = String(fields.get('modelName')).trim();
    const temperature = Number(fields.get('temperature'));
    const maxOutputTokens = Number(fields.get('maxOutputTokens'));
    const maxInputCharacters = Number(fields.get('maxInputCharacters'));
    const parameters = ['temperature', 'maxOutputTokens'].filter(name => fields.has(`editable:${name}`));
    const next = {
      schemaVersion: 'dgos-capability/v1', kind: 'model',
      id: String(fields.get('id')).trim(), version: String(fields.get('version')).trim(),
      label: String(fields.get('label')).trim(),
      executor: { type: 'declarative', engine: 'dgos-text-v1' },
      capabilities: ['text.chat'],
      operations: { submit: { profile, method: 'POST', path: profile === 'responses' ? '/responses' : '/chat/completions' } },
      workflows: { 'text.chat': { submit: 'submit' } },
      modelProfiles: { text: { modelNames: [modelName], workflow: 'text.chat' } },
      defaults: { temperature, maxOutputTokens },
      limits: { maxInputCharacters, maxOutputTokens },
      uiSchemas: { parameters }, assets: {},
    };
    try {
      const result = await api<Dict>('/api/v1/provider/capability-protocols', json({ requestId: requestId(), declaration: next }));
      if (result.digest) { setValidated(result); setDeclaration(next); setPublishRequestId(requestId()); }
      else setError(t.protocolDigestMissing);
    } catch (failure) { setError(receiptError(failure)); }
    finally { setBusy(false); }
  }
  async function issuePublish() {
    if (!validated || !declaration) return;
    setBusy(true); setError('');
    const id = publishRequestId;
    try {
      const result = await api<Dict>('/api/v1/provider/capability-protocols/confirmations', json({
        requestId: id, operation: 'provider.protocol.publish', protocolId: declaration.id,
        version: declaration.version, declaration, validationDigest: validated.digest,
      }));
      if (result.confirmationId && result.requestId === id && result.digest === validated.digest) {
        if (currentTicket(result)) setConfirmation(result);
        else setError(t.protocolTicketExpired);
      } else setError(t.protocolTicketMismatch);
    } catch (failure) { setError(receiptError(failure)); }
    finally { setBusy(false); }
  }
  async function publish() {
    if (!validated || !declaration || !confirmation || !currentTicket(confirmation)) { setError(t.protocolTicketExpired); return; }
    setBusy(true); setError('');
    try {
      await api(`/api/v1/provider/capability-protocols/${encodeURIComponent(declaration.id)}/versions`, json({
        requestId: confirmation.requestId, declaration, validationDigest: validated.digest, confirmationId: confirmation.confirmationId,
      }));
      setValidated(null); setDeclaration(null); setConfirmation(null); setPublishRequestId(''); await load();
    } catch (failure) { setError(receiptError(failure)); }
    finally { setBusy(false); }
  }
  async function issueState() {
    if (!stateDraft) return;
    setBusy(true); setError('');
    const { profile, state } = stateDraft;
    try {
      const result = await api<Dict>('/api/v1/provider/capability-protocols/confirmations', json({
        requestId: stateDraft.requestId, operation: 'provider.protocol.state', protocolId: profile.id,
        version: profile.version, baseVersion: profile.registryVersion, state,
      }));
      if (result.confirmationId && result.requestId === stateDraft.requestId) {
        if (currentTicket(result)) setStateTicket(result);
        else setError(t.protocolTicketExpired);
      } else setError(t.protocolTicketMismatch);
    } catch (failure) { setError(receiptError(failure)); }
    finally { setBusy(false); }
  }
  async function changeState() {
    if (!stateDraft || !stateTicket || !currentTicket(stateTicket)) { setError(t.protocolTicketExpired); return; }
    setBusy(true); setError('');
    const { profile, state } = stateDraft;
    try {
      await api(`/api/v1/provider/capability-protocols/${encodeURIComponent(profile.id)}/versions/${encodeURIComponent(profile.version)}/state`, json({
        requestId: stateDraft.requestId, baseVersion: profile.registryVersion, state, confirmationId: stateTicket.confirmationId,
      }));
      setStateDraft(null); setStateTicket(null); await load();
    } catch (failure) { setError(receiptError(failure)); }
    finally { setBusy(false); }
  }
  return <div className="stack">
    {error && <Alert>{error}</Alert>}
    <div className="two-col">
      <Panel><h2>{t.connectionProtocols}</h2>{adapters.length ? <ul className="record-list">{adapters.map(item => <li key={item.protocolType}><div><strong>{item.protocolType}</strong><small>{item.adapterVersion} · {item.configSchemaRef}</small></div><Status value={item.status} /></li>)}</ul> : <Empty>{t.empty}</Empty>}</Panel>
      <Panel><h2>{t.capabilityProtocols}</h2>{profiles.length ? <ul className="record-list">{profiles.map(item => <li key={`${item.id}:${item.version}`}><div><strong>{item.label || item.id}</strong><small>{item.id} · {item.version} · {t.version} {item.registryVersion}</small></div><div className="row"><Status value={item.status} /><Button onClick={() => { setStateTicket(null); setStateDraft({ profile: item, state: item.status === 'active' ? 'disabled' : 'active', requestId: requestId() }); }}>{item.status === 'active' ? t.disable : t.enable}</Button></div></li>)}</ul> : <Empty>{t.empty}</Empty>}</Panel>
    </div>
    <Panel><h2>{t.registerTextProtocol}</h2><form onSubmit={validate}>
      <div className="two-col"><label>{t.protocolId}<input name="id" pattern="[a-z0-9][a-z0-9._-]*" required /></label><label>{t.version}<input name="version" pattern="[0-9]+\.[0-9]+\.[0-9]+" defaultValue="1.0.0" required /></label><label>{t.displayName}<input name="label" required /></label><label>{t.model}<input name="modelName" required /></label><label>{t.operation}<select name="profile"><option value="chat.completions">chat.completions</option><option value="responses">responses</option></select></label><label>{t.temperature}<input name="temperature" type="number" min="0" max="2" step="0.1" defaultValue="0.6" required /></label><label>{t.maxOutputTokens}<input name="maxOutputTokens" type="number" min="1" step="1" defaultValue="64" required /></label><label>{t.maxInputCharacters}<input name="maxInputCharacters" type="number" min="1" step="1" defaultValue="4000" required /></label></div>
      <fieldset><legend>{t.editableParameters}</legend><label className="checkline"><input name="editable:temperature" type="checkbox" defaultChecked />{t.temperature}</label><label className="checkline"><input name="editable:maxOutputTokens" type="checkbox" defaultChecked />{t.maxOutputTokens}</label></fieldset>
      <Button type="submit" busy={busy}>{t.validateProtocol}</Button>
    </form>
    {validated && declaration && <div className="secret-receipt"><strong>{t.protocolReview}</strong><p>{declaration.id} · {declaration.version} · {declaration.modelProfiles.text.modelNames[0]}</p><p>{t.operation}: {declaration.operations.submit.profile} · {t.version}: {validated.digest}</p><Button onClick={issuePublish} busy={busy}>{t.issueConfirmation}</Button>{confirmation && <div className="row"><span>{currentTicket(confirmation) ? `${t.confirmInvocation}: ${confirmation.expiresAt}` : t.protocolTicketExpired}</span><Button variant="primary" onClick={publish} disabled={!currentTicket(confirmation)} busy={busy}>{t.publishProtocol}</Button></div>}</div>}
    </Panel>
    {stateDraft && <div className="modal-backdrop" onKeyDown={event => { if (event.key === 'Escape') { setStateDraft(null); setStateTicket(null); } }}><div className="modal" role="dialog" aria-modal="true" aria-label={t.protocolReview}><h2>{t.protocolReview}</h2><p>{stateDraft.profile.id} · {stateDraft.profile.version} · {t.version} {stateDraft.profile.registryVersion}</p><p>{stateDraft.state === 'active' ? t.enable : t.disable}</p><div className="row"><Button onClick={issueState} busy={busy}>{t.issueConfirmation}</Button>{stateTicket && <Button variant={stateDraft.state === 'active' ? 'primary' : 'danger'} onClick={changeState} disabled={!currentTicket(stateTicket)} busy={busy}>{t.confirm} {stateDraft.state === 'active' ? t.enable : t.disable}</Button>}{stateTicket && !currentTicket(stateTicket) && <span>{t.protocolTicketExpired}</span>}<Button onClick={() => { setStateDraft(null); setStateTicket(null); }}>{t.cancel}</Button></div></div></div>}
  </div>;
}
