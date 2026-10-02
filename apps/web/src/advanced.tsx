import { useEffect, useState, type FormEvent } from "react";
import { Alert, Button, Empty, Panel, Status } from "@dgos/dgos-ui";
import { api, items, json, receiptError } from "./api";
import { allLabels } from "./i18n";
import { useDialogKeyboard } from './dialog';
import { displayDate } from './region';
import { SkillManagement, McpManagement } from './management';
import { ManualMcpConfig } from './mcp-manual-config';
import { EnhancedMcpList } from './mcp-enhanced-list';
import { ToolPermissionReview } from './permission-review';

type Dict = Record<string, any>;
type Resource = {
  data: any;
  error: string;
  loading: boolean;
  reload: () => void;
};
function useResource(path: string, enabled = true): Resource {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [version, reload] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);
    api(path)
      .then((v) => {
        if (active) {
          setData(v);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(receiptError(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, enabled, version]);
  return { data, error, loading, reload: () => reload((v) => v + 1) };
}
function Load({
  resource,
  children,
}: {
  resource: Resource;
  children: (data: any) => React.ReactNode;
}) {
  const t = allLabels('en'); // Default to English for loading/retry messages
  if (resource.loading && !resource.data) return <p role="status">{t.loading}</p>;
  if (resource.error && !resource.data)
    return (
      <Alert>
        {resource.error} <Button onClick={resource.reload}>{t.retry}</Button>
      </Alert>
    );
  return (
    <>
      {resource.error && <Alert>{resource.error}</Alert>}
      {children(resource.data)}
    </>
  );
}
function useAction() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  async function run(fn: () => Promise<any>, success = "") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const value = await fn();
      setNotice(success);
      return value;
    } catch (e) {
      setError(receiptError(e));
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { run, error, busy, notice };
}
function Feedback({ op }: { op: ReturnType<typeof useAction> }) {
  return (
    <>
      {op.error && <Alert>{op.error}</Alert>}
      {op.notice && <Alert kind="info">{op.notice}</Alert>}
    </>
  );
}
function Confirm({
  title,
  body,
  t,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  t: ReturnType<typeof allLabels>;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useDialogKeyboard(true, onClose);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{title}</h2>
        <p>{body}</p>
        <div className="row">
          <Button variant="danger" onClick={onConfirm}>
            {t.confirm}
          </Button>
          <Button onClick={onClose}>{t.cancel}</Button>
        </div>
      </div>
    </div>
  );
}
const formatOk = (m: Dict) =>
  m?.format === "dgos-app/v1" &&
  /^[a-z][a-z0-9.-]{1,63}$/.test(m.appId || "") &&
  /^\d+\.\d+\.\d+/.test(m.version || "") &&
  Number.isSafeInteger(m.build) &&
  Number.isSafeInteger(m.dataVersion) &&
  ["stable", "beta", "dev"].includes(m.releaseChannel) &&
  m.minRuntimeVersion &&
  m.name?.["zh-CN"] &&
  m.name?.["en-US"] &&
  m.entrypoints &&
  Array.isArray(m.permissions) &&
  Array.isArray(m.capabilityAllowlist) &&
  ["standard", "trusted", "system"].includes(m.trustLevel) &&
  ["release", "keep-alive"].includes(m.backgroundPolicy) &&
  ["user-removable", "protected-preinstall"].includes(m.uninstallPolicy);
export function Developer({ t }: { t: ReturnType<typeof allLabels> }) {
  const catalog = useResource("/api/v1/apps"),
    op = useAction(),
    [envelope, setEnvelope] = useState(""),
    [summary, setSummary] = useState<Dict | null>(null),
    [confirm, setConfirm] = useState(false),
    [review, setReview] = useState<null | {app:Dict; action:string}>(null),
    [reason, setReason] = useState("");
  function inspect() {
    try {
      const value = JSON.parse(envelope);
      if (
        !formatOk(value.manifest) ||
        !value.files ||
        !value.resourceDigests ||
        !value.keyId ||
        !value.signature
      )
        throw new Error(
          "Envelope needs a dgos-app/v1 manifest, files, resourceDigests, keyId and signature.",
        );
      setSummary(value.manifest);
    } catch (e) {
      op.run(async () => {
        throw e;
      });
    }
  }
  async function submit() {
    setConfirm(false);
    const result = await op.run(
      () => api("/api/v1/apps", json({requestId: crypto.randomUUID(), ...JSON.parse(envelope)})),
      "Submitted for review",
    );
    if (result) {
      setSummary(null);
      setEnvelope("");
      catalog.reload();
    }
  }
  async function reviewAction(){
    if(!review)return;
    const {app,action}=review;
    const body={requestId:crypto.randomUUID(),version:app.version,build:app.build,releaseChannel:app.releaseChannel,baseVersion:app.reviewVersion,...(reason.trim()?{reason:reason.trim()}:{})};
    const result=await op.run(()=>api(`/api/v1/apps/${encodeURIComponent(app.appId)}/${action}`,json(body)),`${action} accepted`);
    if(result){setReview(null);setReason("");catalog.reload()}
  }
  return (
    <div className="stack">
      <Feedback op={op} />
      <div className="two-col">
        <Panel>
          <h2>{t.signedPackage}</h2>
          <p className="section-note">{t.packageHint}</p>
          <label>
            {t.packageEnvelope}
            <textarea
              rows={14}
              spellCheck={false}
              value={envelope}
              onChange={(e) => {
                setEnvelope(e.target.value);
                setSummary(null);
              }}
            />
          </label>
          <div className="row">
            <Button onClick={inspect} disabled={!envelope}>
              {t.preview}
            </Button>
            {summary && (
              <Button variant="primary" onClick={() => setConfirm(true)}>
                {t.apply}
              </Button>
            )}
          </div>
          {summary && (
            <dl className="data-grid">
              <div>
                <dt>{t.appId}</dt>
                <dd>{summary.appId}</dd>
              </div>
              <div>
                <dt>{t.version}</dt>
                <dd>
                  {summary.version} · {t.build} {summary.build}
                </dd>
              </div>
              <div>
                <dt>{t.channel}</dt>
                <dd>{summary.releaseChannel}</dd>
              </div>
              <div>
                <dt>{t.requestedTrust}</dt>
                <dd>{summary.trustLevel}</dd>
              </div>
              <div>
                <dt>{t.permissions}</dt>
                <dd>{summary.permissions.join(", ") || t.none}</dd>
              </div>
            </dl>
          )}
        </Panel>
        <Load resource={catalog}>
          {(data) => (
            <Panel>
              <h2>{t.catalog}</h2>
              <ul className="record-list">
                {items(data).map((x: Dict) => (
                  <li key={`${x.appId}:${x.version}:${x.build}:${x.releaseChannel}`}>
                    <div>
                      <strong>
                        {x.displayName || x.name?.["en-US"] || x.appId}
                      </strong>
                      <small>
                        {x.appId} · {x.version} · {t.build} {x.build} · {x.releaseChannel} · {x.catalogState || x.status}
                      </small>
                    </div>
                    <div className="row"><Status value={x.catalogState || x.status || "unknown"} />{(['approve','reject','withdraw','test-install'] as const).map(action=><Button key={action} onClick={()=>setReview({app:x,action})}>{action==='test-install'?t.testInstall:t[action]}</Button>)}</div>
                  </li>
                ))}
              </ul>
              {!items(data).length && <Empty>{t.empty}</Empty>}
            </Panel>
          )}
        </Load>
      </div>
      {confirm && (
        <Confirm
          title={t.submitPackage}
          body={t.packageHint}
          t={t}
          onConfirm={submit}
          onClose={() => setConfirm(false)}
        />
      )}
      {review&&<div className="modal-backdrop" onClick={()=>setReview(null)}><div className="modal" role="dialog" aria-modal="true" aria-label={`${review.action} ${review.app.appId}`} onClick={e=>e.stopPropagation()}><h2>{review.action} {review.app.appId}</h2><p>{review.app.version} · {t.build} {review.app.build} · {review.app.releaseChannel}</p><label>{t.reviewReason}<input value={reason} onChange={e=>setReason(e.target.value)}/></label><div className="row"><Button variant="primary" onClick={reviewAction} busy={op.busy}>{t.confirm}</Button><Button onClick={()=>setReview(null)}>{t.cancel}</Button></div></div></div>}
    </div>
  );
}
export function ExtensionsV1({
  t,
  kind,
}: {
  t: ReturnType<typeof allLabels>;
  kind: "skills" | "mcp";
}) {
  const kindName = kind === "skills" ? "skill" : "mcp",
    path = `/api/v1/${kind}`,
    resource = useResource(path),
    op = useAction(),
    [source, setSource] = useState(""),
    [preview, setPreview] = useState<Dict | null>(null),
    [selected, setSelected] = useState<Dict | null>(null),
    [tools, setTools] = useState<Dict | null>(null),
    [toolsError, setToolsError] = useState(""),
    [operationId, setOperationId] = useState(""),
    [input, setInput] = useState("{}"),
    [callerAppId, setCallerAppId] = useState(""),
    [ticket, setTicket] = useState<{ confirmationId: string; requestId: string; input: Dict } | null>(null),
    [runId, setRunId] = useState(
      localStorage.getItem("dgos.ui.extensionRunId") || "",
    ),
    run = useResource(
      runId ? `/api/v1/extensions/runs/${encodeURIComponent(runId)}` : "",
      !!runId,
    ),
    [confirm, setConfirm] = useState<Dict | null>(null);
  useEffect(() => {
    if (!runId) return;
    if (
      ["succeeded", "failed", "cancelled", "timed_out", "blocked"].includes(
        run.data?.state,
      )
    )
      return;
    const timer = setInterval(run.reload, 1200);
    return () => clearInterval(timer);
  }, [runId, run.data?.state]);
  async function inspect(e: FormEvent) {
    e.preventDefault();
    setPreview(null);
    const result = await op.run(() =>
      api<Dict>(
        "/api/v1/extensions/previews",
        json({ requestId: crypto.randomUUID(), kind: kindName, source }),
      ),
    );
    if (result) setPreview(result);
  }
  async function install() {
    if (!preview || preview.trustState !== "verified") return;
    const result = await op.run(
      () =>
        api(
          path,
          json({
            requestId: crypto.randomUUID(),
            source,
            previewId: preview.previewId,
            previewDigest: preview.digest,
            confirmed: true,
          }),
        ),
      "Installation accepted",
    );
    if (result) {
      setPreview(null);
      resource.reload();
    }
  }
  async function mutate(item: Dict, action: string) {
    setConfirm(null);
    const base = `${path}/${encodeURIComponent(item.id)}`,
      body = { requestId: crypto.randomUUID(), baseVersion: item.stateVersion };
    const endpoint =
      action === "remove"
        ? base
        : action === "state"
          ? `${base}/state`
          : `${base}/${action}`;
    const payload =
      action === "state"
        ? {
            ...body,
            desiredState: item.state === "enabled" ? "disabled" : "enabled",
          }
        : body;
    const result = await op.run(() =>
      api(endpoint, json(payload, action === "remove" ? "DELETE" : "POST")),
    );
    if (result) resource.reload();
  }
  async function loadTools(item: Dict, discover = false) {
    const current = discover
      ? items(await api(`/api/v1/mcp`)).find((candidate: Dict) => candidate.id === item.id)
      : item;
    if (!current) { setToolsError(t.unavailable); return; }
    setSelected(current);
    setTicket(null);
    setOperationId("");
    setToolsError("");
    const url = `/api/v1/mcp/${encodeURIComponent(item.id)}/tools`;
    try {
      const result = await api<Dict>(
        url,
        discover
          ? json({
              requestId: crypto.randomUUID(),
              baseVersion: current.stateVersion,
            })
          : {},
      );
      setTools(result);
    } catch (e) {
      setTools(null);
      setToolsError(receiptError(e));
    }
  }
  async function confirmInvocation() {
    if (!selected || !operationId || !callerAppId.trim()) return;
    let parsed: Dict;
    try {
      parsed = JSON.parse(input);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Tool input must be a JSON object');
    } catch {
      await op.run(async () => {
        throw new Error("Tool input must be JSON");
      });
      return;
    }
    const requestId = crypto.randomUUID();
    const result = await op.run(() =>
      api<Dict>(
        "/api/v1/extensions/confirmations",
        json({
          requestId,
          appId: callerAppId.trim(),
          kind: kindName,
          extensionId: selected.id,
          operationId,
          extensionVersion: selected.version,
          input: parsed,
        }),
      ),
    );
    if (result?.confirmationId) setTicket({ confirmationId: result.confirmationId, requestId, input: structuredClone(parsed) });
  }
  async function invoke() {
    if (!selected || !ticket) return;
    const result = await op.run(() => api<Dict>("/api/v1/extensions/runs", json({
      requestId: ticket.requestId,
      appId: callerAppId.trim(), kind: kindName, extensionId: selected.id,
      operationId, extensionVersion: selected.version, input: ticket.input,
      confirmationId: ticket.confirmationId,
    })));
    if (result?.runId) {
      setTicket(null);
      setRunId(result.runId);
      localStorage.setItem("dgos.ui.extensionRunId", result.runId);
      run.reload();
    }
  }
  async function cancelRun() {
    const result = await op.run(() =>
      api(
        `/api/v1/extensions/runs/${encodeURIComponent(runId)}`,
        json({ requestId: crypto.randomUUID() }, "DELETE"),
      ),
    );
    if (result) run.reload();
  }
  return (
    <div className="stack">
      <Feedback op={op} />
      {kind === 'skills' && <SkillManagement t={t} onChanged={resource.reload} />}
      {kind === 'mcp' && <McpManagement t={t} selected={selected} onChanged={resource.reload} />}
      {kind === 'mcp' && <ManualMcpConfig t={t} onInstalled={resource.reload} />}
      {kind === 'mcp' ? (
        <EnhancedMcpList
          t={t}
          onSelectForConfig={(server) => setSelected(server)}
          onSelectForTools={(server) => loadTools(server, true)}
        />
      ) : (
        <div className="two-col">
        <Panel>
          <h2>{t[kind]}</h2>
          <form onSubmit={inspect}>
            <label>
              {t.source}
              <input
                required
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  setPreview(null);
                }}
              />
            </label>
            <Button type="submit" busy={op.busy}>
              {t.preview}
            </Button>
          </form>
          {preview && (
            <div className="secret-receipt">
              <dl className="data-grid">
                <div>
                  <dt>{t.appId}</dt>
                  <dd>{preview.summary?.id}</dd>
                </div>
                <div>
                  <dt>{t.version}</dt>
                  <dd>{preview.summary?.version}</dd>
                </div>
                <div>
                  <dt>Trust</dt>
                  <dd>{preview.trustState}</dd>
                </div>
                <div>
                  <dt>{t.permissions}</dt>
                  <dd>{preview.summary?.permissions?.join(", ") || t.none}</dd>
                </div>
                <div>
                  <dt>Risks</dt>
                  <dd>{preview.summary?.risks?.join(", ") || "none"}</dd>
                </div>
                <div>
                  <dt>Expires</dt>
                  <dd>{displayDate(preview.expiresAt)}</dd>
                </div>
              </dl>
              <Button
                variant="primary"
                disabled={preview.trustState !== "verified"}
                onClick={install}
                busy={op.busy}
              >
                {t.confirm} {t.install}
              </Button>
            </div>
          )}
        </Panel>
        <Load resource={resource}>
          {(data) => (
            <Panel>
              <h2>{t.installed} {t[kind]}</h2>
              {items(data).length ? (
                <ul className="record-list">
                  {items(data).map((x: Dict) => (
                    <li key={x.id}>
                      <div>
                        <strong>{x.displayName || x.id}</strong>
                        <small>
                          {x.version} · credential{" "}
                          {x.credentialStatus || "unknown"}
                        </small>
                        <Status value={x.connectionState || x.state} />
                      </div>
                      <div className="row">
                        <Button onClick={() => mutate(x, "state")}>
                          {x.state === "enabled" ? t.disable : t.enable}
                        </Button>
                        <Button onClick={() => { document.querySelector<HTMLInputElement>('input[name="skillId"]')?.focus(); }}>{t.editDefinition}</Button>
                        <Button variant="danger" onClick={() => setConfirm(x)}>
                          {t.uninstall}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>{t.empty}</Empty>
              )}
            </Panel>
          )}
        </Load>
      </div>
      )}
      {kind === "mcp" && selected && (
        <Panel>
          <div className="row between">
            <h2>{t.tools} · {selected.id}</h2>
            <Button onClick={() => loadTools(selected, true)}>
              {t.discoverTools}
            </Button>
          </div>
          {toolsError && <Alert>{toolsError}</Alert>}
          {tools && (
            <>
              <ul className="record-list">
                {items(tools).map((tool: Dict) => (
                  <li key={tool.operationId}>
                    <div>
                      <strong>{tool.operationId}</strong>
                      <small>
                        {tool.permission} · {t.risk} {tool.risk} · {t.sideEffects}{" "}
                        {String(tool.sideEffects)}
                      </small>
                    </div>
                    <Button onClick={() => {setOperationId(tool.operationId);setTicket(null)}}>
                      {t.choose}
                    </Button>
                  </li>
                ))}
              </ul>
              {operationId && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    confirmInvocation();
                  }}
                >
                  <label>
                    {t.callingApp} ID
                    <input required value={callerAppId} onChange={(e)=>{setCallerAppId(e.target.value);setTicket(null)}} />
                  </label>
                  <label>
                    {t.operation}
                    <input value={operationId} readOnly />
                  </label>
                  <label>
                    {t.inputJson}
                    <textarea
                      value={input}
                      onChange={(e) => {setInput(e.target.value);setTicket(null)}}
                    />
                  </label>
                  <div className="result">
                    <strong>{t.reviewInvocation}</strong>
                    <p>{selected.id} · {selected.version} · {operationId}</p>
                    <p>{t.callingApp}: {callerAppId}</p>
                    <p>{t.risk}: {items(tools).find((tool:Dict)=>tool.operationId===operationId)?.risk} · {t.permission}: {items(tools).find((tool:Dict)=>tool.operationId===operationId)?.permission} · {t.sideEffects}: {String(items(tools).find((tool:Dict)=>tool.operationId===operationId)?.sideEffects)}</p>
                    <pre>{input}</pre>
                  </div>
                  <Button variant="primary" type="submit">
                    {t.issueConfirmation}
                  </Button>
                  {ticket && <div className="secret-receipt"><strong>{t.confirmInvocation}</strong><p>{selected.id} · {selected.version} · {operationId}</p><p>{t.callingApp}: {callerAppId}</p><p>{t.risk}: {items(tools).find((tool:Dict)=>tool.operationId===operationId)?.risk} · {t.permission}: {items(tools).find((tool:Dict)=>tool.operationId===operationId)?.permission} · {t.sideEffects}: {String(items(tools).find((tool:Dict)=>tool.operationId===operationId)?.sideEffects)}</p><pre>{JSON.stringify(ticket.input, null, 2)}</pre><Button type="button" variant="primary" onClick={invoke} busy={op.busy}>{t.invokeTool}</Button></div>}
                </form>
              )}
            </>
          )}
        </Panel>
      )}
      {runId && (
        <Load resource={run}>
          {(data) => (
            <Panel>
              <div className="row between">
                <h2>{t.extensionRun}</h2>
                <Button onClick={run.reload}>{t.refresh}</Button>
              </div>
              <p className="code">Run ID: {runId}</p>
              {data && (
                <>
                  <Status value={data.state} />
                  <pre>
                    {JSON.stringify(
                      {
                        sequence: data.sequence,
                        resultSummary: data.resultSummary,
                        reasonCode: data.reasonCode,
                        artifactIds: data.artifactIds,
                      },
                      null,
                      2,
                    )}
                  </pre>
                  {![
                    "succeeded",
                    "failed",
                    "cancelled",
                    "timed_out",
                    "blocked",
                  ].includes(data.state) && (
                    <Button onClick={cancelRun}>{t.cancel}</Button>
                  )}
                </>
              )}
            </Panel>
          )}
        </Load>
      )}
      {confirm && (
        <Confirm
          title={`${t.uninstall} ${confirm.id}`}
          body={t.deleteConfirm}
          t={t}
          onConfirm={() => mutate(confirm, "remove")}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
