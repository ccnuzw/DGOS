import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Empty, Panel, Status } from '@dgos/dgos-ui';
import { api, items, json, receiptError } from './api';
import { allLabels } from './i18n';
import { useDialogKeyboard } from './dialog';

type Dict = Record<string, any>;
type T = ReturnType<typeof allLabels>;

export function SkillManagement({ t, onChanged }: { t: T; onChanged: () => void }) {
  const [skillId, setSkillId] = useState('');
  const [definition, setDefinition] = useState<Dict | null>(null);
  const [taskId, setTaskId] = useState('');
  const [task, setTask] = useState<Dict | null>(null);
  const [artifact, setArtifact] = useState<Dict | null>(null);
  const [review, setReview] = useState<{ title: string; body: Dict; run: () => Promise<void> } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useDialogKeyboard(Boolean(review), () => setReview(null));
  async function perform(fn: () => Promise<void>) { setBusy(true); setError(''); try { await fn(); } catch (failure) { setError(receiptError(failure)); } finally { setBusy(false); } }
  async function load(id = skillId) { const result = await api<Dict>(`/api/v1/skills/${encodeURIComponent(id)}/definition`); setDefinition(result); setSkillId(id); }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const fields = new FormData(form);
    const body = { requestId: crypto.randomUUID(), skillId: String(fields.get('skillId')).trim(), content: { name: String(fields.get('name')).trim(), description: String(fields.get('description')), systemPrompt: String(fields.get('systemPrompt')) }, confirmed: true };
    setReview({ title: t.createSkill, body: { skillId: body.skillId, fields: ['name', 'description', 'systemPrompt'] }, run: async () => { const result = await api<Dict>('/api/v1/skills/custom', json(body)); setDefinition(result); setSkillId(result.skillId); form.reset(); onChanged(); } });
  }
  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!definition) return; const fields = new FormData(event.currentTarget);
    const patch: Dict = { name: String(fields.get('name')).trim(), description: String(fields.get('description')) };
    if (definition.sourceType === 'custom' && String(fields.get('systemPrompt')) !== definition.content.systemPrompt) patch.systemPrompt = String(fields.get('systemPrompt'));
    const body = { requestId: crypto.randomUUID(), baseVersion: definition.stateVersion, patch, ...(patch.systemPrompt !== undefined ? { confirmed: true } : {}) };
    setReview({ title: t.editDefinition, body: { skillId, fields: Object.keys(patch) }, run: async () => { setDefinition(await api(`/api/v1/skills/${encodeURIComponent(skillId)}/definition`, json(body, 'PATCH'))); onChanged(); } });
  }
  async function translate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!definition) return; const fields = new FormData(event.currentTarget); const selected = ['name', 'description', 'systemPrompt'].filter(field => fields.has(field)); if (!selected.length) { setError(t.fieldsToTranslate); return; }
    const body = { requestId: crypto.randomUUID(), baseVersion: definition.stateVersion, targetLocale: String(fields.get('targetLocale')), fields: selected, options: { providerConfigId: String(fields.get('providerConfigId')).trim(), modelId: String(fields.get('modelId')).trim() }, confirmed: true };
    setReview({ title: t.reviewCost, body: { targetLocale: body.targetLocale, fields: selected, providerConfigId: body.options.providerConfigId, modelId: body.options.modelId }, run: async () => { const result = await api<Dict>(`/api/v1/skills/${encodeURIComponent(skillId)}/translations`, json(body)); setTaskId(result.taskId); setTask(result); } });
  }
  async function readTask() { if (!taskId) return; const result = await api<Dict>(`/api/v1/ai-tasks/${encodeURIComponent(taskId)}`); setTask(result); setArtifact(null); }
  async function readArtifact() { if (!task?.artifactIds?.[0]) return; setArtifact(await api(`/api/v1/artifacts/${encodeURIComponent(task.artifactIds[0])}`)); }
  function apply() { if (!definition || !taskId || !artifact?.artifactId) return; const body = { requestId: crypto.randomUUID(), baseVersion: definition.stateVersion, taskId, artifactId: artifact.artifactId, confirmed: true }; setReview({ title: t.applyTranslation, body: { skillId, taskId, artifactId: artifact.artifactId }, run: async () => { setDefinition(await api(`/api/v1/skills/${encodeURIComponent(skillId)}/translations/apply`, json(body))); onChanged(); } }); }
  return <div className="stack"><Panel><h2>{t.customSkill}</h2>{error && <Alert>{error}</Alert>}<details><summary>{t.create}</summary><form onSubmit={create}><label>{t.skillId}<input name="skillId" required pattern="[a-z0-9_][a-z0-9_.-]*" /></label><label>{t.name}<input name="name" required maxLength={128} /></label><label>{t.description}<textarea name="description" maxLength={4096}/></label><label>{t.systemPrompt}<textarea name="systemPrompt" required maxLength={16384}/></label><Button type="submit">{t.createSkill}</Button></form></details><form className="inline-form" onSubmit={event => { event.preventDefault(); void perform(() => load()); }}><label>{t.skillId}<input value={skillId} onChange={event => setSkillId(event.target.value)} required /></label><Button type="submit">{t.editDefinition}</Button></form>
    {definition && <><p><Status value={definition.state}/>{definition.skillId} · {t.version} {definition.stateVersion}</p><form key={`${definition.skillId}:${definition.stateVersion}`} onSubmit={update}><label>{t.name}<input name="name" defaultValue={definition.content.name} required /></label><label>{t.description}<textarea name="description" defaultValue={definition.content.description}/></label>{definition.sourceType === 'custom' && <label>{t.systemPrompt}<textarea name="systemPrompt" defaultValue={definition.content.systemPrompt}/></label>}<Button type="submit" busy={busy}>{t.save}</Button></form><form onSubmit={translate}><label>{t.targetLanguage}<select name="targetLocale"><option value="zh-CN">中文</option><option value="en-US">English</option></select></label><fieldset><legend>{t.fieldsToTranslate}</legend>{['name','description','systemPrompt'].map(field => <label className="checkline" key={field}><input name={field} type="checkbox" disabled={field === 'systemPrompt' && definition.sourceType !== 'custom'}/>{field === 'systemPrompt' ? t.systemPrompt : t[field as 'name' | 'description']}</label>)}</fieldset><label>{t.providerConfigId}<input name="providerConfigId" required /></label><label>{t.modelId}<input name="modelId" required /></label><Button type="submit">{t.translateSkill}</Button></form></>}
    {taskId && <div className="stack"><label>{t.translationTask}<input value={taskId} onChange={event => setTaskId(event.target.value)} /></label><div className="row"><Button onClick={() => void perform(readTask)}>{t.readTask}</Button><Button onClick={() => void perform(async () => { await api(`/api/v1/ai-tasks/${encodeURIComponent(taskId)}`, json({}, 'DELETE')); await readTask(); })} disabled={['succeeded','failed','cancelled'].includes(task?.status)}>{t.cancelTask}</Button><Button onClick={() => void perform(readArtifact)} disabled={task?.status !== 'succeeded' || !task?.artifactIds?.length}>{t.readArtifact}</Button></div>{task && <Status value={task.status}/ >}{artifact && <><pre>{artifact.content}</pre><Button onClick={apply}>{t.applyTranslation}</Button></>}</div>}
  </Panel>{review && <div className="modal-backdrop" onClick={() => setReview(null)}><div className="modal" role="dialog" aria-modal="true" aria-label={review.title} onClick={event => event.stopPropagation()}><h2>{review.title}</h2><pre>{JSON.stringify(review.body, null, 2)}</pre><div className="row"><Button variant="primary" busy={busy} onClick={() => void perform(async () => { await review.run(); setReview(null); })}>{t.confirm}</Button><Button onClick={() => setReview(null)}>{t.cancel}</Button></div></div></div>}</div>;
}

export function McpManagement({ t, selected, onChanged }: { t: T; selected: Dict | null; onChanged: () => void }) {
  const [templates, setTemplates] = useState<Dict[] | null>(null);
  const [templateId, setTemplateId] = useState('');
  const [mode, setMode] = useState<'install' | 'configure'>('install');
  const [preview, setPreview] = useState<Dict | null>(null);
  const [templateError, setTemplateError] = useState('');
  const [review, setReview] = useState<{ body: Dict; credentials: Dict; mode: 'install' | 'configure'; targetId?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useDialogKeyboard(Boolean(review), () => setReview(null));
  async function load() { try { const next = items(await api('/api/v1/mcp/templates')); setTemplates(next); setTemplateId(current => next.some((item: Dict) => item.templateId === current) ? current : next[0]?.templateId || ''); setTemplateError(''); } catch (failure) { setTemplateError(receiptError(failure)); } }
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (selected) { setMode('configure'); setPreview(null); setReview(null); } }, [selected?.id, selected?.stateVersion]);
  async function choose(template: Dict) {
    setTemplateId(template.templateId); setMode('install'); setPreview(null); setReview(null); setError(''); setBusy(true);
    try {
      const receipt = await api<Dict>('/api/v1/extensions/previews', json({ requestId: crypto.randomUUID(), kind: 'mcp', source: template.source }));
      if (receipt.trustState !== 'verified' || receipt.summary?.templateId && receipt.summary.templateId !== template.templateId || receipt.summary?.templateVersion && receipt.summary.templateVersion !== template.version) throw new Error(t.untrustedTemplate);
      setPreview(receipt);
    } catch (failure) { setError(receiptError(failure)); } finally { setBusy(false); }
  }
  async function commit() {
    if (!review) return;
    setBusy(true); setError('');
    try {
      const credentials = Object.keys(review.credentials).length ? { credentials: review.credentials } : {};
      if (review.mode === 'install') await api('/api/v1/mcp', json({ ...review.body, ...credentials, confirmed: true }));
      else await api(`/api/v1/mcp/${encodeURIComponent(review.targetId!)}/config`, json({ ...review.body, ...credentials, confirmed: true }, 'PUT'));
      setReview(null); setPreview(null); onChanged();
    } catch (failure) { setError(receiptError(failure)); } finally { setBusy(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const template = templates?.find(item => item.templateId === templateId);
    if (!template || mode === 'install' && (!preview || preview.trustState !== 'verified') || mode === 'configure' && !selected) { setError(t.unavailable); return; }
    const fields = new FormData(event.currentTarget), credentials: Dict = {};
    for (const field of template.credentialFields) { const value = String(fields.get(`secret:${field.name}`) || ''); if (field.required && mode === 'install' && !value) { setError(`${field.label}: ${t.credentialRequired}`); return; } if (value) credentials[field.name] = value; }
    const body = mode === 'install'
      ? { requestId: crypto.randomUUID(), source: template.source, version: preview!.summary.version, previewId: preview!.previewId, previewDigest: preview!.digest, config: template.config, templateId: template.templateId, templateVersion: template.version }
      : { requestId: crypto.randomUUID(), baseVersion: selected!.stateVersion, config: template.config };
    setError(''); event.currentTarget.reset(); setReview({ body, credentials, mode, targetId: selected?.id });
  }
  const chosen = templates?.find(item => item.templateId === templateId);
  return <Panel><div className="row between"><h2>{t.mcpTemplates}</h2><Button onClick={() => void load()}>{t.refresh}</Button></div>{templateError && <Alert>{templateError}</Alert>}{error && <Alert>{error}</Alert>}{templates && (templates.length ? <ul className="record-list">{templates.map(item => <li key={`${item.templateId}:${item.version}`}><div><strong>{item.name}</strong><small>{item.templateId} · {item.version} · {item.setupState}</small></div><Button onClick={() => void choose(item)}>{t.choose}</Button></li>)}</ul> : <Empty>{t.empty}</Empty>)}{mode === 'configure' && selected && <><p>{selected.id} · <Status value={selected.connectionState || selected.state}/></p><p>{t.requiresStop}</p></>}{chosen && (mode === 'install' && preview || mode === 'configure' && selected) && <><p>{t.templateSource}: {chosen.source} · {chosen.version}</p>{mode === 'install' && <p>{t.preview}: {preview?.summary?.id} · <Status value={preview?.trustState || 'unknown'} /></p>}<form key={`${mode}:${templateId}`} onSubmit={submit}><label>{t.mcpTemplates}<select name="templateId" value={templateId} onChange={event => { setTemplateId(event.target.value); setReview(null); setPreview(null); setError(''); }}>{templates?.map(item => <option key={item.templateId} value={item.templateId}>{item.name}</option>)}</select></label>{chosen.credentialFields.map((field: Dict) => <label key={`${templateId}:${field.name}`}>{field.label}<input name={`secret:${field.name}`} type="password" autoComplete="new-password" required={mode === 'install' && field.required} /></label>)}<Button type="submit" disabled={busy || mode === 'configure' && !['stopped','needs-credentials','failed'].includes(selected?.connectionState)}>{mode === 'install' ? t.install : t.storeConfig}</Button></form></>}{review && <div className="modal-backdrop" onClick={() => setReview(null)}><div className="modal" role="dialog" aria-modal="true" aria-label={mode === 'install' ? t.install : t.configureMcp} onClick={event => event.stopPropagation()}><h2>{mode === 'install' ? t.install : t.configureMcp}</h2><p>{review.mode === 'install' ? preview?.summary?.id : review.targetId}</p><pre>{JSON.stringify(review.body.config, null, 2)}</pre><p>{t.credentialFields}: {Object.keys(review.credentials).join(', ') || t.none}</p><div className="row"><Button variant="primary" busy={busy} onClick={() => void commit()}>{t.confirm}</Button><Button onClick={() => setReview(null)}>{t.cancel}</Button></div></div></div>}</Panel>;
}
