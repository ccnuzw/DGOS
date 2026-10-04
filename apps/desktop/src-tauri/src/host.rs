use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{webview::PageLoadEvent, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder, Window, WindowEvent};

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WindowSummary { label: String, route: String, x: i32, y: i32, width: u32, height: u32, maximized: bool }

#[derive(Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Workspace { version: u8, windows: Vec<WindowSummary> }

#[derive(Default)]
pub struct RestoreGate(AtomicBool);

const ROUTES: &[&str] = &["/desktop", "/catalog", "/settings", "/providers", "/protocols", "/skills", "/mcp", "/assistant", "/ai-tasks", "/developer", "/keys", "/governance", "/usage"];

fn valid_route(route: &str) -> bool { ROUTES.contains(&route) }

fn subject_key(app: &tauri::AppHandle) -> Result<String, String> {
    let api = app.state::<std::sync::Arc<crate::proxy::ApiProxy>>();
    let subject = api.authenticated_subject().ok_or("desktop session has no verified subject")?;
    let digest = Sha256::digest(subject.as_bytes());
    Ok(format!("{:x}", digest))
}

fn state_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let key = subject_key(app)?;
    if let Ok(override_path) = std::env::var("DGOS_DESKTOP_WORKSPACE_FILE") {
        let path = PathBuf::from(override_path);
        if !path.is_absolute() { return Err("workspace override must be absolute".into()); }
        let parent = path.parent().ok_or("workspace override has no parent")?;
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        return Ok(parent.join(format!("workspace-{key}.json")));
    }
    let base = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    Ok(base.join(format!("workspace-{key}.json")))
}

fn read(app: &tauri::AppHandle) -> Result<Workspace, String> {
    let path = state_path(app)?;
    if !path.exists() { return Ok(Workspace::default()); }
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    let snapshot: Workspace = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
    if snapshot.version != 1 || snapshot.windows.len() > 12 || snapshot.windows.iter().any(|w| !valid_route(&w.route)) {
        return Err("unsupported workspace snapshot".into());
    }
    Ok(snapshot)
}

fn persist(app: &tauri::AppHandle) -> Result<(), String> {
    let previous = read(app).unwrap_or_default();
    let mut windows = Vec::new();
    for window in app.webview_windows().values() {
        let size = window.outer_size().map_err(|e| e.to_string())?;
        let pos = window.outer_position().map_err(|e| e.to_string())?;
        let route = previous.windows.iter().find(|item| item.label == window.label()).map(|item| item.route.clone())
            .or_else(|| window.url().ok().map(|url| url.path().to_owned()).filter(|route| valid_route(route)))
            .unwrap_or_else(|| "/desktop".into());
        windows.push(WindowSummary { label: window.label().into(), route, x: pos.x, y: pos.y,
            width: size.width, height: size.height, maximized: window.is_maximized().unwrap_or(false) });
    }
    let path = state_path(app)?;
    let temp = path.with_extension("tmp");
    fs::write(&temp, serde_json::to_vec(&Workspace { version: 1, windows }).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    fs::rename(temp, path).map_err(|e| e.to_string())
}

fn persist_snapshot(app: &tauri::AppHandle, snapshot: &Workspace) -> Result<(), String> {
    let path = state_path(app)?;
    let temp = path.with_extension("tmp");
    fs::write(&temp, serde_json::to_vec(snapshot).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    fs::rename(temp, path).map_err(|e| e.to_string())
}

fn create(app: &tauri::AppHandle, summary: &WindowSummary, restored_geometry: bool) -> Result<(), String> {
    let handle = app.clone();
    let dev = cfg!(debug_assertions) && std::env::var("DGOS_DESKTOP_DEV_SERVER").ok().as_deref() == Some("1");
    let route = serde_json::to_string(&summary.route).map_err(|e| e.to_string())?;
    let label = serde_json::to_string(&summary.label).map_err(|e| e.to_string())?;
    let fixture_probe = cfg!(debug_assertions) && summary.label == "main"
        && std::env::var("DGOS_DESKTOP_TEST_KEYCHAIN_SERVICE").ok()
            .is_some_and(|service| service.starts_with("com.dgos.desktop.test."));
    let real_config = if fixture_probe { std::env::var("DGOS_DESKTOP_TEST_CONFIG_ID").ok() } else { None };
    let visible_test = fixture_probe
        && std::env::var("DGOS_DESKTOP_TEST_VISIBLE").ok().as_deref() == Some("1");
    let workbench_test = fixture_probe
        && std::env::var("DGOS_DESKTOP_TEST_WORKBENCH").ok().as_deref() == Some("1");
    let workbench_resources = app.state::<crate::proxy::WorkbenchResourceServer>();
    let workbench_origin = workbench_resources.origin().to_string();
    let workbench_port = workbench_origin.rsplit(':').next().and_then(|port| port.parse::<u16>().ok()).ok_or("invalid Workbench loopback port")?;
    let workbench_origin_json = serde_json::to_string(&workbench_origin).map_err(|e| e.to_string())?;
    if fixture_probe { eprintln!("dgos desktop debug window: workbench_test={workbench_test}, visible_test={visible_test}"); }
    let real_config = serde_json::to_string(&real_config).map_err(|e| e.to_string())?;
    let init = format!(r#"(() => {{
      const route = {route};
      if (location.pathname !== route) history.replaceState({{}}, '', route);
      const nativeFetch = window.fetch.bind(window);
      window.fetch = async (resource, options = {{}}) => {{
        const path = typeof resource === 'string' ? resource : resource?.url;
        if (!path?.startsWith('/api/v1/')) return nativeFetch(resource, options);
        const headers = Object.fromEntries(new Headers(options.headers || {{}}).entries());
        const result = await window.__TAURI_INTERNALS__.invoke('desktop_api', {{ input: {{ path, method: options.method || 'GET', body: options.body == null ? null : String(options.body), headers }} }});
        return new Response(result.body, {{ status: result.status, headers: result.headers }});
      }};
      {{
        const nativeCreateElement = document.createElement.bind(document);
        document.createElement = (tagName, options) => {{
          const element = nativeCreateElement(tagName, options);
          if (String(tagName).toLowerCase() === 'iframe') {{
            const setSrc = element.setAttribute.bind(element);
            element.setAttribute = (name, value) => {{
              if (name === 'src' && typeof value === 'string' && value.includes('/api/v1/apps/dgos.ai-workbench/resources/')) {{
                try {{ const url = new URL(value, location.href); const resource = `${{url.pathname}}${{url.search}}`; value = {workbench_origin_json} + resource; if ({workbench_test}) value += (value.includes('?') ? '&' : '?') + 'dgosDesktopTest=1'; }} catch (_) {{}}
              }}
              return setSrc(name, value);
            }};
          }}
          return element;
        }};
      }}
      if (!window.__DGOS_ROUTE_LISTENER__) {{
        window.__DGOS_ROUTE_LISTENER__ = true;
        window.addEventListener('popstate', () => window.__TAURI_INTERNALS__?.invoke('set_window_route', {{ label: {label}, route: location.pathname }}));
      }}
      if ({fixture_probe}) window.addEventListener('DOMContentLoaded', () => {{
        fetch('/api/v1/identity/admin/session', {{ headers: {{ 'x-request-id': 'desktop-bridge-fixture' }} }})
          .catch(error => console.error('DGOS desktop bridge fixture:', error));
      }}, {{ once: true }});
      if ({workbench_test}) window.addEventListener('message', (event) => {{
        const type = event.data?.type;
        const frame = document.querySelector('iframe[title="dgos.ai-workbench"]');
        const sourceMatchesFrame = event.source === frame?.contentWindow;
        if (type === 'dgos.app.ready' || type === 'dgos.desktop.test.frame.injected' || type === 'dgos.desktop.test.workbench.ready')
          window.__TAURI_INTERNALS__?.invoke('desktop_test_result', {{ result: {{ stage: 'message_observed', type, origin: event.origin, sourceMatchesFrame, instanceId: event.data?.instanceId ?? null, bridgeVersion: event.data?.bridgeVersion ?? null }} }}).catch(() => {{}});
      }});
      const realConfig = {real_config};
      window.__DGOS_VISIBLE_TEST__ = {visible_test};
      if (window.__DGOS_VISIBLE_TEST__ && !realConfig) window.addEventListener('DOMContentLoaded', async () => {{
        const result = {{ stage: 'window' }};
        try {{
          const native = async action => window.__TAURI_INTERNALS__.invoke('desktop_test_window', {{ action }});
          const settled = async (predicate) => {{
            for (let i = 0; i < 30; i++) {{
              const state = await native('state');
              if (predicate(state)) return state;
              await new Promise(resolve => setTimeout(resolve, 100));
            }}
            throw new Error('window_state_timeout');
          }};
          result.windowInitial = await native('state');
          await native('focus');
          result.windowFocused = await settled(state => state.focused);
          await native('maximize');
          result.windowMaximized = await settled(state => state.maximized);
          await native('restore');
          result.windowRestored = await settled(state => !state.maximized);
          const settingsLink = await new Promise((resolve, reject) => {{
            let attempts = 0;
            const find = () => {{
              const link = document.querySelector('nav a[href="/settings"]');
              if (link) resolve(link);
              else if (++attempts > 30) reject(new Error('settings_navigation_missing'));
              else setTimeout(find, 100);
            }};
            find();
          }});
          settingsLink.click();
          for (let i = 0; i < 30 && location.pathname !== '/settings'; i++) await new Promise(resolve => setTimeout(resolve, 100));
          if (location.pathname !== '/settings') throw new Error('settings_navigation_failed');
          result.settingsControlVisible = await new Promise(resolve => {{
            let attempts = 0;
            const find = () => {{
              if (document.querySelector('main select[name="appearanceMode"]')) resolve(true);
              else if (++attempts > 30) resolve(false);
              else setTimeout(find, 100);
            }};
            find();
          }});
          if (!result.settingsControlVisible) throw new Error('settings_control_missing');
          result.windowRoute = location.pathname;
          result.windowAfterNavigation = await settled(state => state.route === '/settings');
          result.stage = 'complete';
        }} catch (error) {{ result.error = String(error?.message || error).slice(0, 160); }}
        await window.__TAURI_INTERNALS__.invoke('desktop_test_result', {{ result }});
        setTimeout(() => window.__TAURI_INTERNALS__.invoke('desktop_test_window', {{ action: 'close' }}), 5000);
      }}, {{ once: true }});
      if (realConfig && !{workbench_test}) window.addEventListener('DOMContentLoaded', async () => {{
        const result = {{ stage: 'start' }};
        try {{
          const call = async (path, options) => {{
            const response = await fetch(path, options);
            if (!response.ok) throw new Error(`api_status_${{response.status}}:${{path.split('?')[0]}}`);
            return response;
          }};
          const session = await (await call('/api/v1/identity/admin/session')).json();
          if (!session.principalId) throw new Error('missing_session_subject');
          result.stage = 'submit';
          const submitted = await (await call('/api/v1/ai-tasks', {{ method: 'POST', headers: {{ 'content-type': 'application/json' }}, body: JSON.stringify({{ requestId: crypto.randomUUID(), target: 'text', intent: 'text.chat', input: {{ text: 'desktop-real-fixture' }}, options: {{ providerConfigId: realConfig, modelId: 'fixture-text-model' }} }}) }})).json();
          result.taskId = submitted.taskId;
          if (!result.taskId) throw new Error('missing_task_id');
          result.stage = 'poll';
          let task;
          for (let i = 0; i < 100; i++) {{
            task = await (await call(`/api/v1/ai-tasks/${{result.taskId}}`)).json();
            if (['succeeded', 'failed', 'cancelled', 'timed_out'].includes(task.status)) break;
            await new Promise(resolve => setTimeout(resolve, 200));
          }}
          result.taskStatus = task?.status;
          if (task?.status !== 'succeeded') throw new Error(`task_${{task?.status || 'timeout'}}`);
          result.stage = 'events';
          const events = await (await call(`/api/v1/ai-tasks/${{result.taskId}}/events?cursor=0`)).text();
          result.eventCount = [...events.matchAll(/^id: /gm)].length;
          if (!result.eventCount) throw new Error('missing_task_events');
          result.stage = 'artifact';
          result.artifactId = task.artifactIds?.[0];
          if (!result.artifactId) throw new Error('missing_artifact_id');
          const artifact = await (await call(`/api/v1/artifacts/${{result.artifactId}}`)).json();
          result.artifactMatched = artifact.content?.includes('desktop-real-fixture') === true;
          if (!result.artifactMatched) throw new Error('artifact_content_mismatch');
          if (window.__DGOS_VISIBLE_TEST__) {{
            result.stage = 'window';
            const native = async action => window.__TAURI_INTERNALS__.invoke('desktop_test_window', {{ action }});
            const settled = async predicate => {{
              for (let i = 0; i < 30; i++) {{
                const state = await native('state');
                if (predicate(state)) return state;
                await new Promise(resolve => setTimeout(resolve, 100));
              }}
              throw new Error('window_state_timeout');
            }};
            result.windowInitial = await native('state');
            await native('focus');
            result.windowFocused = await settled(state => state.focused);
            await native('maximize');
            result.windowMaximized = await settled(state => state.maximized);
            await native('restore');
            result.windowRestored = await settled(state => !state.maximized);
            const settingsLink = await new Promise((resolve, reject) => {{
              let attempts = 0;
              const find = () => {{
                const link = document.querySelector('nav a[href="/settings"]');
                if (link) resolve(link);
                else if (++attempts > 30) reject(new Error('settings_navigation_missing'));
                else setTimeout(find, 100);
              }};
              find();
            }});
            settingsLink.click();
            result.windowAfterNavigation = await settled(state => state.route === '/settings');
            result.windowRoute = location.pathname;
            result.settingsRendered = await new Promise(resolve => {{
              let attempts = 0;
              const find = () => {{
                if (document.querySelector('main select[name="appearanceMode"]')) resolve(true);
                else if (++attempts > 50) resolve(false);
                else setTimeout(find, 100);
              }};
              find();
            }});
            if (!result.settingsRendered) throw new Error('settings_render_timeout');
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            result.paintReady = true;
          }}
          result.stage = 'complete';
        }} catch (error) {{ result.error = String(error?.message || error).slice(0, 160); }}
        await window.__TAURI_INTERNALS__.invoke('desktop_test_result', {{ result }});
        if (window.__DGOS_VISIBLE_TEST__) setTimeout(() => window.__TAURI_INTERNALS__.invoke('desktop_test_window', {{ action: 'close' }}), 12000);
      }}, {{ once: true }});
    }})()"#);
    let (logical_width, logical_height) = if summary.label == "main" { (1280.0, 840.0) } else { (1100.0, 760.0) };
    // WebKit does not guarantee cross-frame eval for the signed app resource.
    // The frame driver is therefore loaded by the Workbench test entry itself.
    let frame_injection_script = String::new();
    let builder = WebviewWindowBuilder::new(app, &summary.label, WebviewUrl::App("index.html".into()))
        .title("DGOS")
        .inner_size(logical_width, logical_height)
        .min_inner_size(720.0, 500.0)
        .initialization_script(init)
        .initialization_script(if workbench_test { include_str!("../../scripts/workbench-main-driver.js") } else { "" })
        .initialization_script(frame_injection_script)
        .on_page_load(move |window, payload| {
            if !workbench_test || !matches!(payload.event(), PageLoadEvent::Finished) { return; }
            eprintln!("dgos desktop debug page finished: {}", payload.url());
            if let Err(error) = window.eval(include_str!("../../scripts/workbench-main-driver.js")) {
                eprintln!("dgos desktop debug main driver eval failed: {error}");
            }
        })
        .on_navigation(move |url| {
            let packaged = (url.scheme() == "tauri" && url.host_str() == Some("localhost") && url.port().is_none())
                || (url.scheme() == "http" && url.host_str() == Some("tauri.localhost") && url.port().is_none());
            let development = dev && url.scheme() == "http" && url.host_str() == Some("127.0.0.1") && url.port() == Some(15151);
            let loopback_workbench = url.scheme() == "http" && url.host_str() == Some("127.0.0.1")
                && url.port() == Some(workbench_port) && url.path().starts_with("/api/v1/apps/dgos.ai-workbench/resources/");
            packaged || development || loopback_workbench
        })
        .on_web_resource_request(move |request, response| handle.state::<std::sync::Arc<crate::proxy::ApiProxy>>().handle(&request, response));
    let window = builder.build().map_err(|e| e.to_string())?;
    if restored_geometry {
        window.set_size(PhysicalSize::new(summary.width.clamp(720, 7680), summary.height.clamp(500, 4320))).map_err(|e| e.to_string())?;
    }
    let _ = window.set_position(PhysicalPosition::new(summary.x, summary.y));
    if summary.maximized { let _ = window.maximize(); }
    Ok(())
}

pub fn restore_windows(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle();
    let workbench_test = cfg!(debug_assertions)
        && std::env::var("DGOS_DESKTOP_TEST_KEYCHAIN_SERVICE").ok()
            .is_some_and(|service| service.starts_with("com.dgos.desktop.test."))
        && std::env::var("DGOS_DESKTOP_TEST_WORKBENCH").ok().as_deref() == Some("1");
    let initial_route = if workbench_test { "/catalog".to_string() } else { "/desktop".to_string() };
    create(handle, &WindowSummary { label: "main".into(), route: initial_route, x: 100, y: 100,
        width: 1280, height: 840, maximized: false }, false)?;
    let background = handle.clone();
    std::thread::spawn(move || {
        if background.state::<std::sync::Arc<crate::proxy::ApiProxy>>().probe_session().is_none() {
            background.state::<RestoreGate>().0.store(true, Ordering::Release);
            return;
        }
        let snapshot = read(&background).unwrap_or_default();
        let ui = background.clone();
        let _ = background.run_on_main_thread(move || {
            let first_launch = snapshot.windows.is_empty();
            if let Some(main) = ui.get_webview_window("main") {
                if let Some(summary) = snapshot.windows.iter().find(|item| item.label == "main") {
                    let _ = main.set_size(PhysicalSize::new(summary.width.clamp(720, 7680), summary.height.clamp(500, 4320)));
                    let _ = main.set_position(PhysicalPosition::new(summary.x, summary.y));
                    if summary.maximized { let _ = main.maximize(); }
                    if summary.route != "/desktop" {
                        if let Ok(route) = serde_json::to_string(&summary.route) {
                            let _ = main.eval(format!("history.replaceState({{}}, '', {route}); window.dispatchEvent(new PopStateEvent('popstate'));"));
                        }
                    }
                }
                if cfg!(debug_assertions) && std::env::var("DGOS_DESKTOP_TEST_RESTORE_PROBE").ok().as_deref() == Some("1") {
                    let _ = main.eval("setTimeout(async () => { const state = await window.__TAURI_INTERNALS__.invoke('desktop_test_window', { action: 'state' }); await window.__TAURI_INTERNALS__.invoke('desktop_test_result', { result: { stage: 'restored', route: location.pathname, window: state } }); }, 500)");
                }
            }
            for summary in snapshot.windows {
                if summary.label == "main" { continue; }
                if ui.get_webview_window(&summary.label).is_none() { let _ = create(&ui, &summary, true); }
            }
            ui.state::<RestoreGate>().0.store(true, Ordering::Release);
            if first_launch { let _ = persist(&ui); }
        });
    });
    Ok(())
}

pub fn persist_window_event(window: &Window, event: &WindowEvent) {
    if window.app_handle().state::<RestoreGate>().0.load(Ordering::Acquire)
        && matches!(event, WindowEvent::Moved(_) | WindowEvent::Resized(_) | WindowEvent::CloseRequested { .. }) {
        let _ = persist(&window.app_handle());
    }
}

#[tauri::command]
pub fn restore_subject_workspace(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let api = app.state::<std::sync::Arc<crate::proxy::ApiProxy>>();
    api.authenticated_subject().ok_or("desktop session unavailable")?;
    let snapshot = read(&app)?;
    for summary in &snapshot.windows {
        if app.get_webview_window(&summary.label).is_none() { create(&app, summary, true)?; }
    }
    serde_json::to_value(snapshot).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_window(app: tauri::AppHandle, label: String) -> Result<(), String> {
    if !label.starts_with("app-") || label.len() > 68 || !label.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'.') { return Err("invalid app window label".into()); }
    let app_id = label.strip_prefix("app-").ok_or("invalid app window label")?;
    if app_id.is_empty() { return Err("invalid app window label".into()); }
    app.state::<std::sync::Arc<crate::proxy::ApiProxy>>().authenticated_subject().ok_or("desktop session unavailable")?;
    app.state::<std::sync::Arc<crate::proxy::ApiProxy>>().authorize_app(app_id)?;
    if let Some(window) = app.get_webview_window(&label) { return window.set_focus().map_err(|e| e.to_string()); }
    if app.webview_windows().len() >= 12 { return Err("window limit reached".into()); }
    create(&app, &WindowSummary { label, route: "/desktop".into(), x: 120, y: 120, width: 1100, height: 760, maximized: false }, false)?;
    persist(&app)
}

#[tauri::command]
pub fn save_workspace(app: tauri::AppHandle) -> Result<(), String> { persist(&app) }

#[tauri::command]
pub fn load_workspace(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    serde_json::to_value(read(&app)?).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_window_route(app: tauri::AppHandle, label: String, route: String) -> Result<(), String> {
    if !valid_route(&route) {
        return Err("invalid workspace route".into());
    }
    let _ = subject_key(&app)?;
    persist(&app)?;
    let mut snapshot = read(&app)?;
    let target = snapshot.windows.iter_mut().find(|item| item.label == label).ok_or("window not found")?;
    target.route = route;
    persist_snapshot(&app, &snapshot)
}

#[tauri::command]
pub fn forget_desktop_session(api: tauri::State<std::sync::Arc<crate::proxy::ApiProxy>>) -> Result<(), String> { crate::proxy::forget_session(&api) }

#[tauri::command]
pub fn desktop_test_result(result: serde_json::Value) -> Result<(), String> {
    if !cfg!(debug_assertions) { return Err("test result unavailable".into()); }
    eprintln!("dgos desktop debug result: {}", result.get("stage").and_then(|value| value.as_str()).unwrap_or("unknown"));
    let service = std::env::var("DGOS_DESKTOP_TEST_KEYCHAIN_SERVICE").map_err(|_| "test service unavailable")?;
    if !service.starts_with("com.dgos.desktop.test.") { return Err("test service unavailable".into()); }
    let path = PathBuf::from(std::env::var("DGOS_DESKTOP_TEST_RESULT_FILE").map_err(|_| "test result path unavailable")?);
    if !path.is_absolute() || result.to_string().len() > 4096 { return Err("invalid test result".into()); }
    let serialized = serde_json::to_vec(&result).map_err(|e| e.to_string())?;
    let mut history = OpenOptions::new().create(true).append(true).open(path.with_extension("jsonl")).map_err(|e| e.to_string())?;
    history.write_all(&serialized).and_then(|_| history.write_all(b"\n")).map_err(|e| e.to_string())?;
    fs::write(path, serialized).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn desktop_test_window(app: tauri::AppHandle, action: String) -> Result<serde_json::Value, String> {
    if !cfg!(debug_assertions) || std::env::var("DGOS_DESKTOP_TEST_KEYCHAIN_SERVICE").ok()
        .is_none_or(|service| !service.starts_with("com.dgos.desktop.test.")) {
        return Err("test window control unavailable".into());
    }
    let window = app.get_webview_window("main").ok_or("main window unavailable")?;
    match action.as_str() {
        "focus" => window.set_focus().map_err(|e| e.to_string())?,
        "maximize" => window.maximize().map_err(|e| e.to_string())?,
        "restore" => window.unmaximize().map_err(|e| e.to_string())?,
        "close" => { window.close().map_err(|e| e.to_string())?; return Ok(serde_json::json!({ "closed": true })); },
        "state" => {},
        _ => return Err("invalid test window action".into()),
    }
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let position = window.outer_position().map_err(|e| e.to_string())?;
    let route = window.url().map_err(|e| e.to_string())?.path().to_owned();
    Ok(serde_json::json!({
        "visible": window.is_visible().map_err(|e| e.to_string())?,
        "focused": window.is_focused().map_err(|e| e.to_string())?,
        "maximized": window.is_maximized().map_err(|e| e.to_string())?,
        "width": size.width, "height": size.height, "x": position.x, "y": position.y, "route": route,
    }))
}
