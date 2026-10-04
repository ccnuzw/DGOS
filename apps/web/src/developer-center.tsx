import { useEffect, useState, type FormEvent } from "react";
import { Alert, Button, Empty, Panel, Status } from "@dgos/dgos-ui";
import { api, items, json, receiptError } from "./api";
import { allLabels } from "./i18n";
import { useDialogKeyboard } from './dialog';
import { displayDate } from './region';

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

interface AppDetailViewProps {
  app: Dict;
  t: ReturnType<typeof allLabels>;
  onClose: () => void;
  onAction: (app: Dict, action: string) => void;
}

function AppDetailView({ app, t, onClose, onAction }: AppDetailViewProps) {
  useDialogKeyboard(true, onClose);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${t.details} - ${app.appId}`}
        className="modal"
        style={{ maxWidth: "800px", maxHeight: "90vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row between">
          <h2>{app.name?.["en-US"] || app.displayName || app.appId}</h2>
          <Button onClick={onClose}>{t.close}</Button>
        </div>

        <dl className="data-grid">
          <div>
            <dt>{t.appId}</dt>
            <dd>{app.appId}</dd>
          </div>
          <div>
            <dt>{t.version}</dt>
            <dd>{app.version} · {t.build} {app.build}</dd>
          </div>
          <div>
            <dt>{t.channel}</dt>
            <dd>{app.releaseChannel}</dd>
          </div>
          <div>
            <dt>{t.status}</dt>
            <dd><Status value={app.catalogState || app.status || "unknown"} /></dd>
          </div>
          <div>
            <dt>{t.source}</dt>
            <dd>{app.source}</dd>
          </div>
          <div>
            <dt>{t.requestedTrust}</dt>
            <dd>{app.trustLevel}</dd>
          </div>
          <div>
            <dt>{t.dataVersion}</dt>
            <dd>{app.dataVersion}</dd>
          </div>
          <div>
            <dt>{t.uninstallPolicy}</dt>
            <dd>{app.uninstallPolicy}</dd>
          </div>
          <div>
            <dt>{t.backgroundPolicy}</dt>
            <dd>{app.backgroundPolicy}</dd>
          </div>
          <div>
            <dt>{t.permissions}</dt>
            <dd>{app.permissions?.join(", ") || t.none}</dd>
          </div>
          <div>
            <dt>{t.capabilities}</dt>
            <dd>{app.capabilityAllowlist?.join(", ") || t.none}</dd>
          </div>
          {app.description && (
            <div>
              <dt>{t.description}</dt>
              <dd>{app.description["en-US"] || app.description["zh-CN"]}</dd>
            </div>
          )}
          {app.reviewReason && (
            <div>
              <dt>{t.reviewReason}</dt>
              <dd>{app.reviewReason}</dd>
            </div>
          )}
        </dl>

        <div className="row" style={{ marginTop: "1rem" }}>
          {(['approve', 'reject', 'withdraw', 'test-install'] as const).map(action => (
            <Button key={action} onClick={() => onAction(app, action)}>
              {action === 'test-install' ? t.testInstall : t[action]}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface InstallationRecordsViewProps {
  appId: string;
  t: ReturnType<typeof allLabels>;
  onClose: () => void;
}

function InstallationRecordsView({ appId, t, onClose }: InstallationRecordsViewProps) {
  const deployment = useResource(`/api/v1/apps/${encodeURIComponent(appId)}/deployment`);
  useDialogKeyboard(true, onClose);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${t.installationRecords} - ${appId}`}
        className="modal"
        style={{ maxWidth: "700px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row between">
          <h2>{t.installation}: {appId}</h2>
          <Button onClick={onClose}>{t.close}</Button>
        </div>

        <Load resource={deployment}>
          {(data) => (
            <dl className="data-grid">
              <div>
                <dt>{t.status}</dt>
                <dd><Status value={data.state} /></dd>
              </div>
              <div>
                <dt>{t.version}</dt>
                <dd>{data.version} · {t.build} {data.build}</dd>
              </div>
              <div>
                <dt>{t.channel}</dt>
                <dd>{data.releaseChannel}</dd>
              </div>
              <div>
                <dt>{t.installedAt}</dt>
                <dd>{displayDate(data.installedAt)}</dd>
              </div>
              {data.healthCheckState && (
              <div>
                <dt>{t.healthCheck}</dt>
                <dd><Status value={data.healthCheckState || data.lastHealth?.state || data.state || 'unknown'} /></dd>
              </div>
              )}
              {(data.rollbackVersion || data.previousDigest || data.previousVersion) && (
                <div>
                  <dt>{t.rollbackVersion}</dt>
                  <dd>{data.rollbackVersion || data.previousVersion || data.previousDigest}</dd>
                </div>
              )}
              <div><dt>{t.dataVersion}</dt><dd>{data.dataRetained === false ? t.error : t.none}</dd></div>
            </dl>
          )}
        </Load>
      </div>
    </div>
  );
}

export function DeveloperCenter({ t }: { t: ReturnType<typeof allLabels> }) {
  const catalog = useResource("/api/v1/apps"),
    op = useAction(),
    [envelope, setEnvelope] = useState(""),
    [summary, setSummary] = useState<Dict | null>(null),
    [confirm, setConfirm] = useState(false),
    [review, setReview] = useState<null | {app:Dict; action:string}>(null),
    [reason, setReason] = useState(""),
    [selectedApp, setSelectedApp] = useState<Dict | null>(null),
    [installationView, setInstallationView] = useState<string | null>(null),
    [validationIssues, setValidationIssues] = useState<string[]>([]),
    [filter, setFilter] = useState<string>("all");

  function inspect() {
    setValidationIssues([]);
    try {
      const value = JSON.parse(envelope);
      const issues: string[] = [];
      if (!formatOk(value.manifest)) issues.push('manifest: invalid or incomplete dgos-app/v1 manifest');
      if (!value.files || typeof value.files !== 'object' || Array.isArray(value.files)) issues.push('files: package file map is required');
      if (!value.resourceDigests || typeof value.resourceDigests !== 'object' || Array.isArray(value.resourceDigests)) issues.push('resourceDigests: resource digest map is required');
      if (!value.keyId) issues.push('keyId: trusted key identifier is required');
      if (!value.signature) issues.push('signature: package signature is required');
      if (issues.length) { setValidationIssues(issues); throw new Error(issues.join('; ')); }
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
      t.submittedForReview,
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
    const result=await op.run(()=>api(`/api/v1/apps/${encodeURIComponent(app.appId)}/${action}`,json(body)),`${action} ${t.actionAccepted}`);
    if(result){setReview(null);setReason("");catalog.reload()}
  }

  const filteredApps = items(catalog.data).filter((app: Dict) => {
    if (filter === "all") return true;
    if (filter === "pending") return app.catalogState === "pending_review";
    if (filter === "approved") return app.catalogState === "approved";
    if (filter === "rejected") return app.catalogState === "rejected";
    return true;
  });

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
          {validationIssues.length > 0 && <div role="alert" className="stack"><strong>{t.error}</strong><ul>{validationIssues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
        </Panel>

        <Load resource={catalog}>
          {(data) => (
            <Panel>
              <div className="row between">
                <h2>{t.catalog}</h2>
                <div className="row">
                  <label>
                    {t.filterLabel}
                    <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                      <option value="all">{t.filterAll}</option>
                      <option value="pending">{t.filterPending}</option>
                      <option value="approved">{t.filterApproved}</option>
                      <option value="rejected">{t.filterRejected}</option>
                    </select>
                  </label>
                  <Button onClick={catalog.reload}>{t.refresh}</Button>
                </div>
              </div>
              <ul className="record-list">
                {filteredApps.map((x: Dict) => (
                  <li key={`${x.appId}:${x.version}:${x.build}:${x.releaseChannel}`}>
                    <div>
                      <strong>
                        {x.displayName || x.name?.["en-US"] || x.appId}
                      </strong>
                      <small>
                        {x.appId} · {x.version} · {t.build} {x.build} · {x.releaseChannel}
                      </small>
                      <Status value={x.catalogState || x.status || "unknown"} />
                    </div>
                    <div className="row">
                      <Button onClick={() => setSelectedApp(x)}>{t.details}</Button>
                      <Button onClick={() => setInstallationView(x.appId)}>{t.installation}</Button>
                      {(['approve','reject','withdraw','test-install'] as const).map(action => (
                        <Button key={action} onClick={() => setReview({app:x,action})}>
                          {action === 'test-install' ? t.testInstall : t[action]}
                        </Button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
              {!filteredApps.length && <Empty>{t.empty}</Empty>}
            </Panel>
          )}
        </Load>
      </div>

      {confirm && (
        <div className="modal-backdrop" onClick={() => setConfirm(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label={t.submitPackage} onClick={e => e.stopPropagation()}>
            <h2>{t.submitPackage}</h2>
            <p>{t.packageHint}</p>
            <div className="row">
              <Button variant="primary" onClick={submit} busy={op.busy}>{t.confirm}</Button>
              <Button onClick={() => setConfirm(false)}>{t.cancel}</Button>
            </div>
          </div>
        </div>
      )}

      {review && (
        <div className="modal-backdrop" onClick={() => setReview(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label={`${review.action} ${review.app.appId}`} onClick={e => e.stopPropagation()}>
            <h2>{review.action} {review.app.appId}</h2>
            <p>{review.app.version} · {t.build} {review.app.build} · {review.app.releaseChannel}</p>
            <label>
              {t.reviewReason}
              <input value={reason} onChange={e => setReason(e.target.value)}/>
            </label>
            <div className="row">
              <Button variant="primary" onClick={reviewAction} busy={op.busy}>{t.confirm}</Button>
              <Button onClick={() => setReview(null)}>{t.cancel}</Button>
            </div>
          </div>
        </div>
      )}

      {selectedApp && (
        <AppDetailView
          app={selectedApp}
          t={t}
          onClose={() => setSelectedApp(null)}
          onAction={(app, action) => {
            setSelectedApp(null);
            setReview({ app, action });
          }}
        />
      )}

      {installationView && (
        <InstallationRecordsView
          appId={installationView}
          t={t}
          onClose={() => setInstallationView(null)}
        />
      )}
    </div>
  );
}
