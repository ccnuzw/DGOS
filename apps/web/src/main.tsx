import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Alert, Button, Empty, Panel, Status } from "@dgos/dgos-ui";
import { Shell, useRoute } from "@dgos/app-shell";
import {
  routes,
  scaleOptions,
  type Locale,
  type RouteKey,
  type Theme,
} from "@dgos/design-tokens";
import { webHost } from "@dgos/host-adapter-web";
import { ApiError, api, items, json, receiptError, taskApi } from "./api";
import { allLabels } from "./i18n";
import { ExtensionsV1 } from "./advanced";
import { DeveloperCenter } from "./developer-center";
import { GovernanceControl, KeyControl, ProviderControl, UsageControl } from "./hardening";
import { AppCatalog } from "./catalog";
import { Protocols as ProtocolControl } from "./protocols";
import { SystemInfo } from "./system-info";
import { ModelManagement } from "./model-management";
import { useDialogKeyboard } from './dialog';
import { displayNumber, setRegionFormat } from './region';
import { DeviceSessions } from './sessions';
import { DesignSystemShowcase } from './design-system-showcase';
import { AssistantChat } from './assistant-chat';
import "./style.css";

type Dict = Record<string, any>;
const saved = (key: string) => localStorage.getItem(`dgos.ui.${key}`) || "";
const remember = (key: string, value: string) => {
  if (value) localStorage.setItem(`dgos.ui.${key}`, value);
  else localStorage.removeItem(`dgos.ui.${key}`);
};
const terminal = (value: string) =>
  [
    "succeeded",
    "failed",
    "cancelled",
    "canceled",
    "timed_out",
    "denied",
    "expired",
  ].includes(value);
const navigationRoutes: Record<string, string> = {
  "system.settings": routes.settings,
  "system.info": routes.system,
  "provider.settings": routes.providers,
  "model.management": routes.models,
  "skill.management": routes.skills,
  "mcp.management": routes.mcp,
  "app.catalog": routes.catalog,
};
function useResource(path: string, enabled = true) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(enabled),
    [version, reload] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);
    api(path)
      .then((value) => {
        if (active) {
          setData(value);
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
  return { data, error, loading, reload: () => reload((v) => v + 1), setData };
}
function Resource({
  resource,
  children,
  t,
}: {
  resource: ReturnType<typeof useResource>;
  children: (data: any) => ReactNode;
  t: ReturnType<typeof allLabels>;
}) {
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
function useOperation() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const run = async (fn: () => Promise<any>, success = "") => {
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
  };
  return {
    run,
    error,
    busy,
    notice,
    clear: () => {
      setError("");
      setNotice("");
    },
  };
}
function Feedback({ op }: { op: ReturnType<typeof useOperation> }) {
  return (
    <>
      {op.error && <Alert>{op.error}</Alert>}
      {op.notice && <Alert kind="info">{op.notice}</Alert>}
    </>
  );
}
function Confirm({
  title,
  description,
  t,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  t: ReturnType<typeof allLabels>;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useDialogKeyboard(true, onClose);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{title}</h2>
        <p>{description}</p>
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
function Auth({
  onAuth,
  t,
  reauth = false,
}: {
  onAuth: (session: Dict) => void;
  t: ReturnType<typeof allLabels>;
  reauth?: boolean;
}) {
  const [mode, setMode] = useState<"login" | "bootstrap">("login"),
    op = useOperation();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = await op.run(() =>
      taskApi<Dict>(
        `/api/v1/identity/admin/${mode}`,
        json({
          credential: form.get("credential"),
          ...(mode === "bootstrap"
            ? { displayName: form.get("displayName") }
            : { principalHint: form.get("principalHint") }),
        }),
      ),
    );
    if (result) {
      if (typeof result.principalId === "string") remember("principalHint", result.principalId);
      onAuth(result);
    }
  }
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>DGOS</h1>
        <p className="muted">{t.controlPlane}</p>
        <Panel>
          {!reauth && <div className="auth-tabs">
            <Button
              onClick={() => setMode("login")}
              variant={mode === "login" ? "primary" : "default"}
            >
              {t.signIn}
            </Button>
            <Button
              onClick={() => setMode("bootstrap")}
              variant={mode === "bootstrap" ? "primary" : "default"}
            >
              {t.setup}
            </Button>
          </div>}
          <form onSubmit={submit}>
            {mode === "login" && (
              <label>
                {t.principalHint}
                <input name="principalHint" required autoComplete="username" defaultValue={saved("principalHint")} />
              </label>
            )}
            {mode === "bootstrap" && (
              <label>
                {t.displayName}
                <input name="displayName" required autoComplete="name" />
              </label>
            )}
            <label>
              {t.credential}
              <input
                name="credential"
                type="password"
                required
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
            </label>
            <Button variant="primary" type="submit" busy={op.busy}>
              {mode === "login" ? t.signIn : t.createSession}
            </Button>
          </form>
          <Feedback op={op} />
        </Panel>
      </div>
    </div>
  );
}
function StepUpDialog({ t, onClose, onAuth }: { t: ReturnType<typeof allLabels>; onClose: () => void; onAuth: (session: Dict) => void }) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[data-step-up]');
    dialog?.querySelector<HTMLElement>('input')?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('input, button')].filter(element => !element.hasAttribute('disabled'));
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop"><div className="modal" data-step-up role="dialog" aria-modal="true" aria-label={t.reauthenticate}><h2>{t.reauthenticate}</h2><Auth t={t} reauth onAuth={onAuth}/><Button onClick={onClose}>{t.cancel}</Button></div></div>;
}
function Desktop({ t }: { t: ReturnType<typeof allLabels> }) {
  const apps = [
    ["catalog", t.catalog],
    ["tasks", t.tasks],
    ["assistant", t.assistant],
    ["settings", t.settings],
    ["providers", t.providers],
    ["models", t.models],
    ["skills", t.skills],
    ["mcp", t.mcp],
  ] as const;
  return (
    <div className="stack">
      <div className="workspace-head">
        <h2>{t.workspace}</h2>
        <span className="muted">V1</span>
      </div>
      <div className="two-col">
        {apps.map(([key, title]) => (
          <Panel key={key}>
            <div className="app-tile">
              <div>
                <strong>{title}</strong>
                <p className="muted">{routes[key]}</p>
              </div>
              <Button onClick={() => webHost.open(routes[key])}>
                {t.launch}
              </Button>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
function Catalog({
  t,
  developer = false,
}: {
  t: ReturnType<typeof allLabels>;
  developer?: boolean;
}) {
  const resource = useResource("/api/v1/apps"),
    op = useOperation(),
    [confirm, setConfirm] = useState<null | { app: Dict; kind: string }>(null);
  async function act(app: Dict, kind: string) {
    setConfirm(null);
    const release = {version: app.version, build: app.build, releaseChannel: app.releaseChannel};
    const baseVersion = app.versionNumber ?? app.reviewVersion;
    const body = kind === 'install' || kind === 'update' ? {requestId: crypto.randomUUID(), ...release, ...(baseVersion ? {baseVersion} : {})} : {requestId: crypto.randomUUID(), ...(baseVersion ? {baseVersion} : {})};
    const result = await op.run(
      () =>
        api(
          `/api/v1/apps/${encodeURIComponent(app.appId)}/${kind}`,
          json(body),
        ),
      `${kind} requested`,
    );
    if (result) resource.reload();
  }
  return (
    <div className="stack">
      <div className="toolbar">
        <Button onClick={resource.reload}>{t.refresh}</Button>
      </div>
      <Feedback op={op} />
      <Resource resource={resource} t={t}>
        {(data) => (
          <Panel>
            <h2>{developer ? t.developer : t.catalog}</h2>
            {items(data).length ? (
              <ul className="record-list">
                {items(data).map((app: Dict) => (
                  <li key={`${app.appId}:${app.version}:${app.build}:${app.releaseChannel}`}>
                    <div>
                      <strong>
                        {app.displayName || app.name?.['en-US'] || app.name?.['zh-CN'] || app.appId}
                      </strong>
                      <small>
                        {app.appId} · {app.version || ""} · {t.build} {app.build} · {app.releaseChannel} ·{" "}
                        {app.catalogState || app.status || ""}
                      </small>
                    </div>
                    <div className="row">
                      {["install", "launch", "update", "uninstall"].map(
                        (kind) => (
                          <Button
                            key={kind}
                            variant={
                              kind === "uninstall" ? "danger" : "default"
                            }
                            busy={op.busy}
                            onClick={() =>
                              kind === "uninstall"
                                ? setConfirm({ app, kind })
                                : act(app, kind)
                            }
                          >
                            {
                              t[
                                kind as
                                  "install" | "launch" | "update" | "uninstall"
                              ]
                            }
                          </Button>
                        ),
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>{t.empty}</Empty>
            )}
          </Panel>
        )}
      </Resource>
      {confirm && (
        <Confirm
          t={t}
          title={t.uninstall}
          description={t.deleteConfirm}
          onConfirm={() => act(confirm.app, confirm.kind)}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
function Settings({
  t,
  onAppearance,
  subjectId,
}: {
  t: ReturnType<typeof allLabels>;
  onAppearance: (theme: Theme, locale: Locale, scale: number) => void;
  subjectId: string;
}) {
  const resource = useResource("/api/v1/system/settings"),
    op = useOperation(),
    [domain, setDomain] = useState("appearance"),
    [permissionIndex, setPermissionIndex] = useState(-1),
    [proxyReceipt, setProxyReceipt] = useState<Dict | null>(null),
    [proxyBusy, setProxyBusy] = useState(false),
    [proxyError, setProxyError] = useState('');
  async function provisionProxy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const username = String(fields.get('username') || '');
    const password = String(fields.get('password') || '');
    if (Boolean(username) !== Boolean(password)) { setProxyError(t.proxyPairRequired); return; }
    setProxyBusy(true); setProxyError(''); setProxyReceipt(null);
    try {
      const receipt = await api<Dict>('/api/v1/system/network/proxy-configurations', json({ requestId: crypto.randomUUID(), displayName: String(fields.get('displayName')).trim(), endpoint: String(fields.get('endpoint')).trim(), ...(username ? { username, password } : {}) }));
      setProxyReceipt(receipt);
      form.reset();
    } catch (error) { setProxyError(receiptError(error)); }
    finally { setProxyBusy(false); }
  }
  async function savePatch(patch: Dict) {
    if (!resource.data?.settingsVersion) return;
    const result = await op.run(() => api<Dict>(
      "/api/v1/system/settings",
      json({ requestId: crypto.randomUUID(), baseVersion: resource.data.settingsVersion, domain, patch }, "PATCH"),
    ), t.save);
    if (!result) return;
    resource.setData(result);
    if (domain === "appearance" || domain === "locale") {
      onAppearance(
        result.appearance?.appearanceMode === "dark" ? "dark" : "light",
        String(result.locale?.uiLocale || "en").startsWith("zh") ? "zh" : "en",
        Number(result.appearance?.displayScale || 1) * 100,
      );
    }
  }
  return (
    <div className="stack">
      <Feedback op={op} />
      <Resource resource={resource} t={t}>
        {(data) => (
          <div className="two-col">
            <Panel>
              <h2>{t.settings}</h2>
              <p className="section-note">
                {t.settingsVersion}: {data?.settingsVersion}
              </p>
              <label>
                {t.choose}
                <select value={domain} onChange={(e) => setDomain(e.target.value)}>
                  {["appearance", "locale", "network", "grid", "privacy", "appPermissions"].map((x) => <option key={x}>{x}</option>)}
                </select>
              </label>
              {domain === "appearance" && <form onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void savePatch({ appearanceMode: form.get("appearanceMode"), displayScale: Number(form.get("displayScale")) }); }} key={`${data.settingsVersion}:appearance`}>
                <label>{t.theme}<select name="appearanceMode" defaultValue={data.appearance?.appearanceMode || "light"}><option value="light">{t.light}</option><option value="dark">{t.dark}</option><option value="system">{t.systemTheme}</option></select></label>
                <label>{t.scale}<select name="displayScale" defaultValue={data.appearance?.displayScale || 1}>{scaleOptions.map(value => <option value={value / 100} key={value}>{value}%</option>)}</select></label>
                <Button type="submit" variant="primary" busy={op.busy}>{t.save}</Button>
              </form>}
              {domain === "locale" && <form onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void savePatch({ uiLocale: form.get("uiLocale") }); }} key={`${data.settingsVersion}:locale`}>
                <label>{t.language}<select name="uiLocale" defaultValue={data.locale?.uiLocale || "en-US"}><option value="en-US">English</option><option value="zh-CN">中文</option></select></label>
                <Button type="submit" variant="primary" busy={op.busy}>{t.save}</Button>
              </form>}
              {domain === "network" && <form key={`${data.settingsVersion}:network`} onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); const mode = String(form.get('proxyMode')); void savePatch({ proxyMode: mode, ...(mode === 'manual' ? { manualProxyRef: String(form.get('manualProxyRef')).trim() } : {}) }); }}>
                <label>{t.proxyMode}<select name="proxyMode" defaultValue={data.network?.proxyMode || 'system'}><option value="system">{t.systemTheme}</option><option value="manual">{t.manual}</option><option value="off">{t.off}</option></select></label>
                <label>{t.manualProxyRef}<input name="manualProxyRef" value={proxyReceipt?.manualProxyRef || data.network?.manualProxyRef || ''} readOnly /></label>
                {proxyReceipt && <p role="status">{proxyReceipt.displayName} · {t.proxyStored} · {proxyReceipt.credentialStatus}</p>}
                {data.network?.restartRequired && <p role="status">{t.restartRequired}</p>}
                <Button type="submit" variant="primary" busy={op.busy}>{t.save}</Button>
              </form>}
              {domain === 'network' && <details><summary>{t.addProxy}</summary><form onSubmit={provisionProxy} autoComplete="off">
                <label>{t.displayName}<input name="displayName" required maxLength={128} autoComplete="off" /></label>
                <label>{t.proxyEndpoint}<input name="endpoint" type="url" required maxLength={2048} autoComplete="off" /></label>
                <label>{t.proxyUsername}<input name="username" maxLength={128} autoComplete="off" /></label>
                <label>{t.proxyPassword}<input name="password" type="password" maxLength={128} autoComplete="new-password" /></label>
                <Button type="submit" busy={proxyBusy}>{t.storeProxy}</Button>
                {proxyError && <Alert>{proxyError}</Alert>}
              </form></details>}
              {domain === "grid" && <form key={`${data.settingsVersion}:grid`} onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void savePatch({ enabled: form.has('enabled'), style: form.get('style'), spacing: Number(form.get('spacing')), majorLineEvery: Number(form.get('majorLineEvery')), showAxes: form.has('showAxes'), snapEnabled: form.has('snapEnabled'), snapTolerance: Number(form.get('snapTolerance')), colorToken: String(form.get('colorToken')), opacity: Number(form.get('opacity')) }); }}>
                <label className="checkline"><input name="enabled" type="checkbox" defaultChecked={data.grid?.enabled} />{t.gridEnabled}</label>
                <label>{t.gridStyle}<select name="style" defaultValue={data.grid?.style || 'dot'}><option value="dot">{t.dots}</option><option value="line">{t.lines}</option></select></label>
                <div className="settings-grid"><label>{t.gridSpacing}<input name="spacing" type="number" min="1" max="256" defaultValue={data.grid?.spacing} required /></label><label>{t.majorLineEvery}<input name="majorLineEvery" type="number" min="1" max="64" defaultValue={data.grid?.majorLineEvery} required /></label><label>{t.snapTolerance}<input name="snapTolerance" type="number" min="0" max="64" defaultValue={data.grid?.snapTolerance} required /></label><label>{t.gridOpacity}<input name="opacity" type="number" min="0" max="1" step="0.05" defaultValue={data.grid?.opacity} required /></label></div>
                <label className="checkline"><input name="showAxes" type="checkbox" defaultChecked={data.grid?.showAxes} />{t.showAxes}</label>
                <label className="checkline"><input name="snapEnabled" type="checkbox" defaultChecked={data.grid?.snapEnabled} />{t.snapEnabled}</label>
                <label>{t.colorToken}<input name="colorToken" pattern="[-.a-zA-Z0-9]{1,64}" defaultValue={data.grid?.colorToken} required /></label>
                <Button type="submit" variant="primary" busy={op.busy}>{t.save}</Button>
              </form>}
              {domain === "privacy" && <form key={`${data.settingsVersion}:privacy`} onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void savePatch({ telemetry: form.has('telemetry') }); }}>
                <label className="checkline"><input name="telemetry" type="checkbox" defaultChecked={data.privacy?.telemetry} />{t.telemetry}</label>
                <Button type="submit" variant="primary" busy={op.busy}>{t.save}</Button>
              </form>}
              {domain === "appPermissions" && (Array.isArray(data.appPermissions) ? <div>
                <label>{t.permissionRule}<select value={permissionIndex} onChange={e => setPermissionIndex(Number(e.target.value))}><option value={-1}>{t.newRule}</option>{data.appPermissions.map((rule: Dict, index: number) => <option value={index} key={`${rule.appId}:${rule.capability}:${index}`}>{rule.appId} · {rule.capability} · {rule.decision}</option>)}</select></label>
                <form key={`${data.settingsVersion}:permission:${permissionIndex}`} onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void savePatch({ rules: [{ appId: String(form.get('appId')).trim(), subjectType: 'user', subjectId, capability: String(form.get('capability')).trim(), scope: { value: '*' }, decision: String(form.get('decision')) }] }); }}>
                  <label>{t.appId}<input name="appId" defaultValue={data.appPermissions[permissionIndex]?.appId || ''} required /></label>
                  <label>{t.capability}<input name="capability" defaultValue={data.appPermissions[permissionIndex]?.capability || ''} required /></label>
                  <label>{t.permission}<select name="decision" defaultValue={data.appPermissions[permissionIndex]?.decision || 'ask'}><option value="ask">{t.ask}</option><option value="allow">{t.allow}</option><option value="deny">{t.deny}</option></select></label>
                  <p className="section-note">{t.scope}: * · {t.owner}: {subjectId}</p>
                  <Button type="submit" variant="primary" busy={op.busy}>{t.save}</Button>
                </form>
              </div> : <Alert>{t.permissionUnavailable}</Alert>)}
            </Panel>
            <Panel>
              <h2>{t.systemContext}</h2>
              <Context t={t} />
            </Panel>
          </div>
        )}
      </Resource>
    </div>
  );
}
function Context({ t }: { t: ReturnType<typeof allLabels> }) {
  const resource = useResource("/api/v1/system/context");
  return (
    <Resource resource={resource} t={t}>
      {(data) => <dl className="data-grid">
        <div><dt>{t.contextVersion}</dt><dd>{data.contextVersion}</dd></div>
        <div><dt>{t.effectiveLanguage}</dt><dd>{data.locale?.effectiveLocale || t.unavailable}</dd></div>
        <div><dt>{t.regionFormat}</dt><dd>{data.locale?.regionFormat || t.unavailable}</dd></div>
        <div><dt>{t.assistantLanguage}</dt><dd>{data.locale?.assistantLanguage || t.unavailable}</dd></div>
        <div><dt>{t.projectLanguage}</dt><dd>{data.locale?.projectContentLanguage || t.unavailable}</dd></div>
      </dl>}
    </Resource>
  );
}
function Providers({ t }: { t: ReturnType<typeof allLabels> }) {
  const resource = useResource("/api/v1/provider/configs"),
    op = useOperation(),
    [selected, setSelected] = useState(saved("providerId")),
    [step, setStep] = useState("");
  const list = items(resource.data),
    config = list.find((x: Dict) => x.id === selected) || list[0],
    models = useResource(
      config
        ? `/api/v1/provider/configs/${encodeURIComponent(config.id)}/models`
        : "",
      !!config,
    ),
    policies = useResource(
      config
        ? `/api/v1/provider/configs/${encodeURIComponent(config.id)}/model-policies`
        : "",
      !!config,
    );
  useEffect(() => {
    if (config) {
      setSelected(config.id);
      remember("providerId", config.id);
    }
  }, [config?.id]);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const account = await op.run(() =>
      api<Dict>(
        "/api/v1/provider/accounts",
        json({
          protocolType: "openai-compatible",
          displayName: f.get("displayName"),
          credential: f.get("credential"),
          scope: { endpoint: f.get("baseUrl") },
        }),
      ),
    );
    if (!account) return;
    const result = await op.run(() =>
      api<Dict>(
        "/api/v1/provider/configs",
        json({
          providerAccountId: account.accountId,
          protocolType: "openai-compatible",
          displayName: f.get("displayName"),
          baseUrl: f.get("baseUrl"),
        }),
      ),
    );
    if (result) {
      setSelected(result.id);
      resource.reload();
    }
  }
  async function perform(kind: "validate" | "refresh") {
    if (!config) return;
    setStep(kind);
    const path = `/api/v1/provider/configs/${encodeURIComponent(config.id)}/${kind === "validate" ? "validate" : "models"}`;
    const result = await op.run(
      () => api(path, json({})),
      kind === "validate" ? "Connection checked" : "Catalog refreshed",
    );
    if (result) {
      resource.reload();
      if (kind === "refresh") models.reload();
    }
    setStep("");
  }
  async function policy(model: Dict) {
    const current = items(policies.data).find(
      (p: Dict) => p.modelId === model.modelId,
    );
    const result = await op.run(() =>
      api(
        `/api/v1/provider/configs/${encodeURIComponent(config.id)}/model-policies`,
        json({
          modelId: model.modelId,
          enabled: !current?.enabled,
          assignedCapabilities: ["text"],
          defaultFor: [],
          baseVersion: current?.policyVersion || "0",
        }),
      ),
    );
    if (result) policies.reload();
  }
  return (
    <div className="stack">
      <Feedback op={op} />
      <Resource resource={resource} t={t}>
        {() => (
          <div className="two-col">
            <Panel>
              <h2>{t.providers}</h2>
              {list.length > 0 && (
                <>
                  <label>
                    {t.choose}
                    <select
                      value={config?.id || ""}
                      onChange={(e) => {
                        setSelected(e.target.value);
                        remember("providerId", e.target.value);
                      }}
                    >
                      {list.map((x: Dict) => (
                        <option key={x.id} value={x.id}>
                          {x.displayName} · {x.status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    <Status value={config?.status || "draft"} />
                  </p>
                  <div className="row">
                    <Button
                      onClick={() => perform("validate")}
                      busy={step === "validate"}
                    >
                      {t.validate}
                    </Button>
                    <Button
                      onClick={() => perform("refresh")}
                      busy={step === "refresh"}
                    >
                      {t.refreshCatalog}
                    </Button>
                  </div>
                </>
              )}
              <details>
                <summary>
                  {list.length
                    ? "Add provider"
                    : "Create provider configuration"}
                </summary>
                <form onSubmit={create}>
                  <label>
                    {t.displayName}
                    <input name="displayName" required />
                  </label>
                  <label>
                    Base URL
                    <input name="baseUrl" type="url" required />
                  </label>
                  <label>
                    {t.credential}
                    <input name="credential" type="password" required />
                  </label>
                  <Button variant="primary" type="submit" busy={op.busy}>
                    {t.save}
                  </Button>
                </form>
              </details>
            </Panel>
            <Panel>
              <h2>{t.model}</h2>
              {config ? (
                <Resource resource={models} t={t}>
                  {(data) => (
                    <ul className="record-list">
                      {items(data).map((m: Dict) => {
                        const p = items(policies.data).find(
                          (x: Dict) => x.modelId === m.modelId,
                        );
                        return (
                          <li key={m.modelId}>
                            <div>
                              <strong>{m.displayName || m.modelId}</strong>
                              <small>{m.modelId}</small>
                            </div>
                            <Button onClick={() => policy(m)}>
                              {p?.enabled ? t.disable : t.enable}
                            </Button>
                          </li>
                        );
                      })}
                      {!items(data).length && <Empty>{t.noModels}</Empty>}
                    </ul>
                  )}
                </Resource>
              ) : (
                <Empty>{t.noModels}</Empty>
              )}
            </Panel>
          </div>
        )}
      </Resource>
    </div>
  );
}
function Tasks({ t }: { t: ReturnType<typeof allLabels> }) {
  const op = useOperation(),
    [taskId, setTaskId] = useState(saved("taskId")),
    [queryId, setQueryId] = useState(saved("taskId")),
    [snapshot, setSnapshot] = useState<Dict | null>(null),
    [text, setText] = useState(""),
    [cursor, setCursor] = useState(0),
    [connection, setConnection] = useState(""),
    [eventCount, setEventCount] = useState(0),
    [prompt, setPrompt] = useState(""),
    [modelId, setModelId] = useState("fixture-text-model"),
    [resumeVersion, setResumeVersion] = useState(0);
  useEffect(() => { localStorage.removeItem('dgos.ui.prompt'); }, []);
  useEffect(() => {
    if (!taskId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function tick() {
      try {
        const value = await taskApi<Dict>(
          `/api/v1/ai-tasks/${encodeURIComponent(taskId)}`,
        );
        if (!active) return;
        setSnapshot(value);
        const authoritativeText = typeof value.text === "string";
        if (authoritativeText) setText(value.text);
        setConnection("connected");
        if (terminal(value.status)) return;
        const body = await taskApi<string>(
          `/api/v1/ai-tasks/${encodeURIComponent(taskId)}/events?cursor=${cursor}`,
          { credentials: "include", headers: cursor ? { "last-event-id": String(cursor) } : {} },
        );
        if (!active) return;
        let latest = cursor;
        for (const block of body.split("\n\n")) {
          const line = block.split("\n").find((x) => x.startsWith("data: "));
          if (!line) continue;
          const event = JSON.parse(line.slice(6));
          if (event.sequence > latest) {
            latest = event.sequence;
            setEventCount(count => count + 1);
            if (event.type === "text.delta" && !authoritativeText)
              setText((v) => v + (event.delta || event.data?.delta || ""));
          }
        }
        if (latest !== cursor) setCursor(latest);
      } catch (e) {
        if (active) setConnection(receiptError(e));
      }
      if (active)
        timer = setTimeout(tick, connection === "connected" ? 700 : 2000);
    }
    tick();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [taskId, cursor, resumeVersion]);
  function selectTask(e: FormEvent) {
    e.preventDefault();
    const next = queryId.trim();
    if (!next) return;
    remember("taskId", next);
    setSnapshot(null);
    setText("");
    setCursor(0);
    setConnection("");
    setTaskId(next);
    setResumeVersion(value => value + 1);
  }
  async function submitTask(e: FormEvent) {
    e.preventDefault();
    const value = prompt.trim();
    if (!value) return;
    const result = await op.run(() => taskApi<Dict>("/api/v1/ai-tasks", json({
      requestId: crypto.randomUUID(), target: "text", intent: "text.chat",
      input: { text: value }, options: { modelId, providerConfigId: "fixture-provider" },
    })));
    if (result?.taskId) {
      remember("taskId", result.taskId); setQueryId(result.taskId); setTaskId(result.taskId);
      setSnapshot(result); setText(""); setCursor(0); setEventCount(0); setConnection("queued"); setResumeVersion(v => v + 1);
    }
  }
  async function cancel() {
    if (!taskId) return;
    const result = await op.run(() =>
      api<Dict>(
        `/api/v1/ai-tasks/${encodeURIComponent(taskId)}`,
        json({}, "DELETE"),
      ),
    );
    if (result) setSnapshot(result);
  }
  return (
    <div className="stack">
      <Feedback op={op} />
      <div className="two-col">
        <Panel>
          <h2>{t.tasks}</h2>
          <form onSubmit={submitTask} className="stack">
            <label>{t.prompt}<textarea value={prompt} onChange={event => setPrompt(event.target.value)} rows={4} required placeholder="Describe what the model should do" /></label>
            <label>{t.model}<input value={modelId} onChange={event => setModelId(event.target.value)} required /></label>
            <Button variant="primary" type="submit" busy={op.busy}>Submit task</Button>
          </form>
          <hr />
          <form onSubmit={selectTask}>
            <label>{t.taskId}<input value={queryId} onChange={event => setQueryId(event.target.value)} required /></label>
            <Button variant="primary" type="submit">{t.resume}</Button>
          </form>
          <Button onClick={() => webHost.open(routes.catalog)}>{t.openWorkbench}</Button>
        </Panel>
        <Panel>
              <div className="row between">
                <h2>{t.result}</h2>
                {snapshot && <Status value={snapshot.status || "queued"} />}
              </div>
              {taskId ? (
                <>
                  <p className="task-info">
                    {t.taskId}: {taskId}
                  </p>
                  {connection && (
                    <p className="muted" role="status">
                      {connection}
                    </p>
                  )}
                  <p className="muted">{t.events}: {eventCount} · {t.cursor}: {cursor}</p>
                  <pre className="task-output">
                    {text || snapshot?.text || "Waiting for output…"}
                  </pre>
                  {snapshot?.error && (
                    <Alert>
                      {typeof snapshot.error === "string"
                        ? snapshot.error
                        : JSON.stringify(snapshot.error)}
                    </Alert>
                  )}
                  <div className="row">
                    <Button
                      onClick={() => {
                        setCursor(0);
                        setConnection("reconnecting");
                        setResumeVersion(v => v + 1);
                      }}
                    >
                      {t.resume}
                    </Button>
                    {snapshot && !terminal(snapshot.status) && (
                      <Button onClick={cancel}>{t.cancelTask}</Button>
                    )}
                    {snapshot?.artifactIds?.map((id: string) => (
                      <a
                        key={id}
                        href={`/api/v1/artifacts/${encodeURIComponent(id)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t.artifactId}: {id}
                      </a>
                    ))}
                  </div>
                </>
              ) : (
                    <Empty>{t.noTask}</Empty>
              )}
        </Panel>
      </div>
    </div>
  );
}
function Assistant({ t, session }: { t: ReturnType<typeof allLabels>; session: Dict }) {
  const actions = useResource("/api/v1/actions"),
    audit = useResource("/api/v1/audit/events?limit=10"),
    op = useOperation(),
    [actionId, setActionId] = useState(""),
    [input, setInput] = useState<Dict>({}),
    [plannedInput, setPlannedInput] = useState<Dict | null>(null),
    [plan, setPlan] = useState<Dict | null>(null),
    [intent, setIntent] = useState(""),
    [candidates, setCandidates] = useState<Dict[] | null>(null),
    [permissionRequests, setPermissionRequests] = useState<Record<string, Dict>>({}),
    [permissionChecks, setPermissionChecks] = useState<Record<string, Dict>>({}),
    [runId, setRunId] = useState(saved("runId")),
    [run, setRun] = useState<Dict | null>(null);
  const openedRunId = useRef("");
  useEffect(() => {
    if (!run?.runId || run.state !== "succeeded" || openedRunId.current === run.runId) return;
    const target = run.resultSummary?.navigation?.target;
    if (typeof target !== "string" || !Object.hasOwn(navigationRoutes, target)) return;
    openedRunId.current = run.runId;
    webHost.open(navigationRoutes[target]);
  }, [run]);
  const selected =
    items(actions.data).find((x: Dict) => x.actionId === actionId) ||
    items(actions.data)[0];
  const required = Array.isArray(selected?.requiredCapabilities) ? selected.requiredCapabilities.filter((value: unknown): value is string => typeof value === 'string' && value.length > 0) : [];
  const permissionValues = required.map((capability: string) => permissionChecks[capability]?.decision);
  const allPermissionsAllowed = required.length > 0 && permissionValues.every((value: string | undefined) => value === 'allow');
  function clearPlan() {
    setPlan(null);
    setPlannedInput(null);
    setPermissionRequests({});
    setPermissionChecks({});
  }
  async function resolve(e: FormEvent) {
    e.preventDefault();
    const result = await op.run(() => api<Dict>("/api/v1/actions/resolve", json({ requestId: crypto.randomUUID(), text: intent.trim() })));
    if (result) setCandidates(items(result.candidates));
  }
  function chooseCandidate(candidate: Dict) {
    const action = items(actions.data).find((x: Dict) => x.actionId === candidate.actionId && String(x.actionVersion) === String(candidate.actionVersion));
    if (!action) return;
    setActionId(action.actionId);
    setInput(candidate.input || {});
    clearPlan();
  }
  useEffect(() => {
    if (!runId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const value = await api<Dict>(
          `/api/v1/action-runs/${encodeURIComponent(runId)}`,
        );
        if (!active) return;
        setRun(value);
        if (!terminal(value.state || value.status))
          timer = setTimeout(poll, 1000);
        else audit.reload();
      } catch (e) {
        if (active)
          op.run(async () => {
            throw e;
          });
      }
    }
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [runId]);
  async function createPlan(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const payload: Dict = {};
    for (const [name, spec] of Object.entries<Dict>(
      selected.inputSchema?.properties || {},
    )) {
      let value = input[name];
      if (spec.type === "boolean") value = !!value;
      else if (spec.type === "integer" || spec.type === "number")
        value = Number(value);
      else if (
        (spec.type === "object" || spec.type === "array") &&
        typeof value === "string"
      ) {
        try {
          value = JSON.parse(value);
        } catch {
          await op.run(async () => {
            throw new Error(`Invalid JSON: ${name}`);
          });
          return;
        }
      }
      if (value !== undefined) payload[name] = value;
    }
    const result = await op.run(() =>
      api<Dict>(
        `/api/v1/actions/${encodeURIComponent(selected.actionId)}/plan`,
        json({
          requestId: crypto.randomUUID(),
          input: payload,
          appId: selected.ownerAppId || selected.appId,
        }),
      ),
    );
    if (result) {
      const capabilities = selected.requiredCapabilities;
      if (!selected.appId || !Array.isArray(capabilities) || !capabilities.length || capabilities.some((value: unknown) => typeof value !== 'string' || !value)) {
        await op.run(async () => { throw new Error(t.permissionUnavailable); });
        return;
      }
      const checks: Record<string, Dict> = {};
      for (const capability of capabilities) {
        const decision = await op.run(() => api<Dict>('/api/v1/permissions/check', json(permissionBody(capability))));
        if (!decision) return;
        checks[capability] = decision;
      }
      setPlan(result); setPlannedInput(structuredClone(payload)); setPermissionRequests({}); setPermissionChecks(checks);
    }
  }
  function permissionBody(capability: string) {
    return { requestId: crypto.randomUUID(), subjectId: session.principalId, appId: selected.appId,
      capability, scope: "*" };
  }
  async function requestPermission(capability: string) {
    if (!selected || !plan || permissionChecks[capability]?.decision !== 'ask') return;
    const result = await op.run(() => api<Dict>("/api/v1/permissions/request", json(permissionBody(capability))));
    if (result) {
      setPermissionChecks(value => ({ ...value, [capability]: result }));
      if (result.decision === 'ask' && result.confirmationRequired) setPermissionRequests(value => ({ ...value, [capability]: result }));
    }
  }
  async function approvePermission(capability: string) {
    if (!selected || !plan || !permissionRequests[capability]?.confirmationRequired) return;
    const result = await op.run(async () => {
      const settings = await api<Dict>('/api/v1/system/settings');
      if (!settings.settingsVersion || !Array.isArray(settings.appPermissions)) throw new Error(t.permissionUnavailable);
      return api<Dict>('/api/v1/system/settings', json({
        requestId: crypto.randomUUID(), baseVersion: settings.settingsVersion,
        domain: 'appPermissions', patch: { rules: [{
          appId: selected.appId, subjectType: 'user', subjectId: session.principalId,
          capability, scope: { value: '*' }, decision: 'allow',
        }] },
      }, 'PATCH'));
    });
    if (result?.appPermissions?.some((rule: Dict) => rule.appId === selected.appId && rule.capability === capability && rule.decision === 'allow')) clearPlan();
  }
  async function execute() {
    if (!selected || !plan || !plannedInput || plan.permission?.decision !== "allow" || !selected.requiredCapabilities?.length || selected.requiredCapabilities.some((capability: string) => permissionChecks[capability]?.decision !== 'allow')) return;
    const result = await op.run(() =>
      api<Dict>(
        `/api/v1/actions/${encodeURIComponent(selected.actionId)}/execute`,
        json({
          requestId: crypto.randomUUID(),
          planId: plan.planId,
          input: plannedInput,
          confirmed: true,
        }),
      ),
    );
    if (result?.runId) {
      setPlan(null);
      setRun(result);
      setRunId(result.runId);
      remember("runId", result.runId);
    }
  }
  async function cancel() {
    const result = await op.run(() =>
      api<Dict>(
        `/api/v1/action-runs/${encodeURIComponent(runId)}`,
        json({}, "DELETE"),
      ),
    );
    if (result) setRun(result);
  }
  return (
    <div className="stack">
      <Feedback op={op} />
      <Resource resource={actions} t={t}>
        {() => (
          <div className="two-col">
            <Panel>
              <h2>{t.assistant}</h2>
              <form onSubmit={resolve}>
                <label>{t.intent}<input value={intent} onChange={e => setIntent(e.target.value)} required /></label>
                <Button type="submit" busy={op.busy}>{t.resolve}</Button>
              </form>
              {candidates && <div className="result"><h3>{t.candidates}</h3>{candidates.length ?
                <ul className="record-list">{candidates.map((candidate: Dict) => {
                  const registered = items(actions.data).some((x: Dict) => x.actionId === candidate.actionId && String(x.actionVersion) === String(candidate.actionVersion));
                  return <li key={`${candidate.actionId}:${candidate.actionVersion}`}><div><strong>{candidate.actionId}</strong><small>{t.risk}: {candidate.risk} · {t.permission}: {candidate.permission} · {t.notExecutable}</small></div><Button disabled={!registered} onClick={() => chooseCandidate(candidate)}>{t.choose}</Button></li>;
                })}</ul> : <Empty>{t.noCandidates}</Empty>}</div>}
              <label>
                {t.action}
                <select
                  value={selected?.actionId || ""}
                  onChange={(e) => {
                    setActionId(e.target.value);
                    setInput({});
                    clearPlan();
                  }}
                >
                  {items(actions.data).map((x: Dict) => (
                    <option key={x.actionId} value={x.actionId}>
                      {x.actionId} · {x.riskLevel || x.risk}
                    </option>
                  ))}
                </select>
              </label>
              {selected ? (
                <>
                  <p className="muted">
                    {selected.description || required.join(', ')}
                  </p>
                  <form onSubmit={createPlan}>
                    {Object.entries<Dict>(
                      selected.inputSchema?.properties || {},
                    ).map(([name, spec]) => (
                      <label key={name}>
                        {name}
                        {spec.type === "boolean" ? (
                          <input
                            type="checkbox"
                            checked={!!input[name]}
                            onChange={(e) => {
                              clearPlan();
                              setInput((v) => ({
                                ...v,
                                [name]: e.target.checked,
                              }));
                            }}
                          />
                        ) : (
                          <input
                            required={selected.inputSchema?.required?.includes(
                              name,
                            )}
                            value={
                              input[name] ?? (name === "baseVersion" ? "" : "")
                            }
                            onChange={(e) => {
                              clearPlan();
                              setInput((v) => ({
                                ...v,
                                [name]: e.target.value,
                              }));
                            }}
                          />
                        )}
                      </label>
                    ))}
                    <Button variant="primary" type="submit" busy={op.busy}>
                      {t.createPlan}
                    </Button>
                  </form>
                </>
              ) : (
                <Empty>{t.empty}</Empty>
              )}
              {plan && (
                <div className="secret-receipt">
                  <strong>{t.confirm}</strong>
                  <p>
                    {t.risk}: {plan.riskLevel || plan.risk} · {t.permission}:{" "}
                    {plan.permission?.decision || "pending"}
                  </p>
                  <pre>{JSON.stringify(plan.inputSummary || {}, null, 2)}</pre>
                  {required.map((capability: string) => <div className="result" key={capability}>
                    <p>{capability} · {t.permission}: {permissionChecks[capability]?.decision || 'pending'}</p>
                    {permissionChecks[capability]?.decision === 'ask' && <>
                      <p>{t.permissionPending}</p>
                      <Button onClick={() => requestPermission(capability)} busy={op.busy}>{t.requestPermission}</Button>
                      {permissionRequests[capability]?.confirmationRequired && <><p>{t.permissionRequestCreated}</p><Button onClick={() => approvePermission(capability)} busy={op.busy}>{t.allowPermission}</Button></>}
                    </>}
                  </div>)}
                  {(!required.length || permissionValues.some((value: string | undefined) => value === 'deny') || plan.permission?.decision === 'deny') && <Alert>{t.noAccess}</Alert>}
                  {plan.permission?.decision === "allow" && allPermissionsAllowed && <Button variant="primary" onClick={execute} busy={op.busy}>{t.execute}</Button>}
                </div>
              )}
            </Panel>
            <Panel>
              <h2>{t.history}</h2>
              {runId ? (
                <>
                  <p className="code">
                    {t.runId}: {runId}
                  </p>
                  {run && (
                    <>
                      <Status value={run.state || run.status} />
                      <pre>
                        {JSON.stringify(
                          run.resultSummary ||
                            run.errorSummary ||
                            run.result ||
                            run.error ||
                            {},
                          null,
                          2,
                        )}
                      </pre>
                      {!terminal(run.state || run.status) && (
                        <Button onClick={cancel}>{t.cancel}</Button>
                      )}
                    </>
                  )}
                </>
              ) : (
                <Empty>{t.empty}</Empty>
              )}
              <h2>{t.audit}</h2>
              <Resource resource={audit} t={t}>
                {(data) => (
                  <ul className="record-list">
                    {items(data).map((x: Dict, i: number) => (
                      <li key={x.eventId || i}>
                        <div>
                          <strong>{x.action}</strong>
                          <small>
                            {x.result || x.status} · {x.target?.id || ""}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Resource>
            </Panel>
          </div>
        )}
      </Resource>
    </div>
  );
}
function Extensions({
  t,
  kind,
}: {
  t: ReturnType<typeof allLabels>;
  kind: "skills" | "mcp";
}) {
  const path = `/api/v1/${kind}`,
    resource = useResource(path),
    op = useOperation(),
    [confirm, setConfirm] = useState<Dict | null>(null);
  async function install(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const result = await op.run(
      () =>
        api(
          path,
          json({ requestId: crypto.randomUUID(), source: f.get("source") }),
        ),
      "Install requested",
    );
    if (result) resource.reload();
  }
  async function act(item: Dict, kindAction: string) {
    setConfirm(null);
    const id = item.id || item.skillId || item.mcpId;
    const endpoint = `${path}/${encodeURIComponent(id)}${kindAction === "uninstall" ? "" : "/state"}`;
    const result = await op.run(() =>
      api(
        endpoint,
        json(
          kindAction === "uninstall"
            ? { requestId: crypto.randomUUID() }
            : { requestId: crypto.randomUUID(), desiredState: kindAction },
          kindAction === "uninstall" ? "DELETE" : "POST",
        ),
      ),
    );
    if (result) resource.reload();
  }
  return (
    <div className="stack">
      <Feedback op={op} />
      <div className="two-col">
        <Panel>
          <h2>{t[kind]}</h2>
          <form onSubmit={install}>
            <label>
              {t.source}
              <input name="source" required />
            </label>
            <Button variant="primary" type="submit" busy={op.busy}>
              {t.install}
            </Button>
          </form>
        </Panel>
        <Resource resource={resource} t={t}>
          {(data) => (
            <Panel>
              <h2>{t.status}</h2>
              {items(data).length ? (
                <ul className="record-list">
                  {items(data).map((x: Dict) => (
                    <li key={x.id}>
                      <div>
                        <strong>{x.displayName || x.id}</strong>
                        <small>
                          {x.version || ""} · {x.credentialStatus || ""}
                        </small>
                      </div>
                      <div className="row">
                        <Status value={x.state} />
                        <Button
                          onClick={() =>
                            act(
                              x,
                              x.state === "enabled" ? "disabled" : "enabled",
                            )
                          }
                        >
                          {x.state === "enabled" ? t.disable : t.enable}
                        </Button>
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
        </Resource>
      </div>
      {confirm && (
        <Confirm
          t={t}
          title={t.uninstall}
          description={t.deleteConfirm}
          onConfirm={() => act(confirm, "uninstall")}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
function Protocols({ t }: { t: ReturnType<typeof allLabels> }) {
  const protocols = useResource("/api/v1/provider/protocols"),
    capabilities = useResource("/api/v1/provider/capability-protocols");
  return (
    <div className="two-col">
      <Resource resource={protocols} t={t}>
        {(data) => (
          <Panel>
            <h2>{t.connectionProtocols}</h2>
            <pre>{JSON.stringify(items(data), null, 2)}</pre>
          </Panel>
        )}
      </Resource>
      <Resource resource={capabilities} t={t}>
        {(data) => (
          <Panel>
            <h2>{t.capabilityProtocols}</h2>
            <pre>{JSON.stringify(items(data), null, 2)}</pre>
          </Panel>
        )}
      </Resource>
    </div>
  );
}
function Keys({ t, session }: { t: ReturnType<typeof allLabels>; session: Dict }) {
  const resource = useResource("/api/v1/secret/api-keys"),
    op = useOperation(),
    [secret, setSecret] = useState(""),
    [confirm, setConfirm] = useState<Dict | null>(null);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const result = await op.run(() =>
      api<Dict>(
        "/api/v1/secret/api-keys",
        json({
          requestId: crypto.randomUUID(),
          ownerId: session.principalId || session.subjectId,
          name: f.get("name"),
          scopes: String(f.get("scopes"))
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      ),
    );
    if (result) {
      setSecret(result.secret || "");
      resource.reload();
    }
  }
  async function revoke(item: Dict) {
    setConfirm(null);
    const result = await op.run(() =>
      api(
        `/api/v1/secret/api-keys/${encodeURIComponent(item.keyId)}`,
        json({ requestId: crypto.randomUUID() }, "DELETE"),
      ),
    );
    if (result) resource.reload();
  }
  return (
    <div className="stack">
      <Feedback op={op} />
      <div className="two-col">
        <Panel>
          <h2>{t.keys}</h2>
          <form onSubmit={create}>
            <label>
              Name
              <input name="name" required />
            </label>
            <label>
              Scopes (comma separated)
              <input name="scopes" required />
            </label>
            <Button variant="primary" type="submit" busy={op.busy}>
              Create key
            </Button>
          </form>
          {secret && (
            <div className="secret-receipt">
              <strong>{t.oneTime}</strong>
              <pre>{secret}</pre>
              <Button onClick={() => setSecret("")}>{t.close}</Button>
            </div>
          )}
        </Panel>
        <Resource resource={resource} t={t}>
          {(data) => (
            <Panel>
              <h2>Existing keys</h2>
              <ul className="record-list">
                {items(data).map((x: Dict) => (
                  <li key={x.keyId}>
                    <div>
                      <strong>{x.name}</strong>
                      <small>
                        {x.keyId} · {x.status}
                      </small>
                    </div>
                    <Button variant="danger" onClick={() => setConfirm(x)}>
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
              {!items(data).length && <Empty>{t.empty}</Empty>}
            </Panel>
          )}
        </Resource>
      </div>
      {confirm && (
        <Confirm
          t={t}
          title={t.revoke}
          description={t.deleteConfirm}
          onConfirm={() => revoke(confirm)}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
function Governance({ t }: { t: ReturnType<typeof allLabels> }) {
  const policy = useResource("/api/v1/admin/governance/policy"),
    audit = useResource("/api/v1/audit/events?limit=30"),
    op = useOperation(),
    [jobId, setJobId] = useState(saved("retentionJobId")),
    [digest, setDigest] = useState("");
  const job = useResource(
    jobId
      ? `/api/v1/admin/governance/retention-sweeps/${encodeURIComponent(jobId)}`
      : "",
    !!jobId,
  );
  async function preview() {
    const result = await op.run(() =>
      api<Dict>(
        "/api/v1/admin/governance/retention-sweeps",
        json({
          requestId: crypto.randomUUID(),
          previewDigest: digest,
          dryRun: true,
        }),
      ),
    );
    if (result?.jobId) {
      setJobId(result.jobId);
      remember("retentionJobId", result.jobId);
      job.reload();
    }
  }
  return (
    <div className="stack">
      <Feedback op={op} />
      <div className="two-col">
        <Resource resource={policy} t={t}>
          {(data) => (
            <Panel>
              <h2>Retention policy</h2>
              <pre>{JSON.stringify(data, null, 2)}</pre>
              <label>
                Preview digest
                <input
                  value={digest}
                  onChange={(e) => setDigest(e.target.value)}
                />
              </label>
              <Button onClick={preview} disabled={!digest}>
                {t.preview}
              </Button>
              {jobId && (
                <Resource resource={job} t={t}>
                  {(data) => <pre>{JSON.stringify(data, null, 2)}</pre>}
                </Resource>
              )}
            </Panel>
          )}
        </Resource>
        <Resource resource={audit} t={t}>
          {(data) => (
            <Panel>
              <h2>Audit events</h2>
              <ul className="record-list">
                {items(data).map((x: Dict, i: number) => (
                  <li key={x.eventId || i}>
                    <div>
                      <strong>{x.action}</strong>
                      <small>
                        {x.result || x.status} · {x.eventId}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
              {!items(data).length && <Empty>{t.empty}</Empty>}
            </Panel>
          )}
        </Resource>
      </div>
    </div>
  );
}
function Usage({ t }: { t: ReturnType<typeof allLabels> }) {
  const [to, setTo] = useState(new Date().toISOString()),
    [from, setFrom] = useState(
      new Date(Date.now() - 30 * 86400000).toISOString(),
    );
  const usage = useResource(
      `/api/v1/usage?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
    quota = useResource("/api/v1/quota/policies");
  return (
    <div className="stack">
      <div className="toolbar">
        <label>
          From
          <input
            type="date"
            value={from.slice(0, 10)}
            onChange={(e) => setFrom(new Date(e.target.value).toISOString())}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to.slice(0, 10)}
            onChange={(e) => setTo(new Date(e.target.value).toISOString())}
          />
        </label>
      </div>
      <div className="two-col">
        <Resource resource={usage} t={t}>
          {(data) => (
            <Panel>
              <h2>{t.usage}</h2>
              <pre>{JSON.stringify(data, null, 2)}</pre>
            </Panel>
          )}
        </Resource>
        <Resource resource={quota} t={t}>
          {(data) => (
            <Panel>
              <h2>Quota policies</h2>
              <pre>{JSON.stringify(data, null, 2)}</pre>
            </Panel>
          )}
        </Resource>
      </div>
    </div>
  );
}
function App() {
  const route = useRoute(),
    [locale, setLocale] = useState<Locale>(
      saved("locale") === "zh" ? "zh" : "en",
    ),
    [theme, setTheme] = useState<Theme>(
      saved("theme") === "dark" ? "dark" : "light",
    ),
    [scale, setScale] = useState(Number(saved("scale") || 100)),
    [session, setSession] = useState<Dict | null>(null),
    [sessionError, setSessionError] = useState(""),
    [sessionVersion, retrySession] = useState(0),
    [stepUpRetry, setStepUpRetry] = useState<null | (() => Promise<void>)>(null),
    [accountError, setAccountError] = useState(''),
    [authLoading, setAuthLoading] = useState(true);
  const t = allLabels(locale);
  const beginStepUp = (retry:()=>Promise<void>) => setStepUpRetry(() => retry);
  async function signOut(){if(!session)return;try{await api('/api/v1/identity/admin/session',{method:'DELETE'});setSession(null);setStepUpRetry(null)}catch(e){setAccountError(receiptError(e))}}
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = locale;
    document.documentElement.style.zoom = `${scale}%`;
    remember("theme", theme);
    remember("locale", locale);
    remember("scale", String(scale));
  }, [theme, locale, scale]);
  useEffect(() => {
    if (!session) return;
    let active = true;
    api<Dict>('/api/v1/system/context').then(value => {
      if (active) setRegionFormat(value.locale?.regionFormat);
    }).catch(() => {});
    return () => { active = false; };
  }, [session]);
  useEffect(() => {
    let active = true;
    setAuthLoading(true);
    api<Dict>("/api/v1/identity/admin/session")
      .then(value => {if(active){setSession(value);setSessionError("")}})
      .catch(error => {if(!active)return;if(error instanceof ApiError && error.status === 401){setSession(null);setSessionError("")}else setSessionError(receiptError(error))})
      .finally(() => {if(active)setAuthLoading(false)});
    return () => {active = false};
  }, [sessionVersion]);
  if (authLoading)
    return (
      <div className="auth-screen" role="status">
        {t.loading}
      </div>
    );
  if (sessionError) return <div className="auth-screen"><Panel className="auth-card"><h1>{t.unavailable}</h1><Alert>{sessionError}</Alert><Button onClick={() => retrySession(v => v + 1)}>{t.retry}</Button></Panel></div>;
  if (!session) return <Auth t={t} onAuth={setSession} />;
  const appearance = (th: Theme, lo: Locale, sc: number) => {
    setTheme(th);
    setLocale(lo === "zh" ? "zh" : "en");
    setScale(sc);
  };
  const page: Record<RouteKey, ReactNode> = {
    desktop: <Desktop t={t} />,
    catalog: <AppCatalog t={t} subjectId={session.principalId} />,
    settings: <><Settings t={t} onAppearance={appearance} subjectId={session.principalId} /><DeviceSessions t={t} onStepUp={beginStepUp} /></>,
    system: <SystemInfo t={t} />,
    providers: <ProviderControl t={t} />,
    models: <ModelManagement t={t} onChanged={() => {}} />,
    protocols: <ProtocolControl t={t} />,
    skills: <ExtensionsV1 t={t} kind="skills" />,
    mcp: <ExtensionsV1 t={t} kind="mcp" />,
    assistant: <AssistantChat t={t} session={session} />,
    tasks: <Tasks t={t} />,
    developer: <DeveloperCenter t={t} />,
    keys: <KeyControl t={t} session={session} onStepUp={beginStepUp} />,
    governance: <GovernanceControl t={t} onStepUp={beginStepUp} />,
    usage: <UsageControl t={t} session={session} />,
    designSystem: <DesignSystemShowcase t={t} />,
  };
  return (
    <Shell
      route={route}
      labels={t}
      actions={
        <>
          <Button onClick={signOut}>{t.signOut}</Button>
          <label className="help">
            {t.theme}
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as Theme)}
            >
              <option value="light">{t.light}</option>
              <option value="dark">{t.dark}</option>
            </select>
          </label>
          <label className="help">
            {t.language}
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
            >
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
          </label>
          <label className="help">
            {t.scale}
            <select
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
            >
              {scaleOptions.map((n) => (
                <option key={n} value={n}>
                  {n}%
                </option>
              ))}
            </select>
          </label>
        </>
      }
    >
      {accountError&&<Alert>{accountError}</Alert>}
      {page[route]}
      {stepUpRetry&&<StepUpDialog t={t} onClose={()=>setStepUpRetry(null)} onAuth={async result=>{setSession(result);const retry=stepUpRetry;setStepUpRetry(null);await retry()}}/>}
    </Shell>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
