#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod host;
mod proxy;
use std::sync::Arc;

pub fn run() {
    let api = Arc::new(proxy::ApiProxy::from_environment().expect("invalid DGOS desktop API origin"));
    let workbench_resources = proxy::WorkbenchResourceServer::start(api.clone()).expect("unable to start Workbench resource server");
    let mut context = tauri::generate_context!();
    if let Some(csp) = context.config_mut().app.security.csp.as_mut() {
        let mut map: std::collections::HashMap<String, tauri::utils::config::CspDirectiveSources> = csp.clone().into();
        map.entry("frame-src".into()).or_insert_with(|| tauri::utils::config::CspDirectiveSources::Inline("'self'".into())).push("http://127.0.0.1:*" );
        *csp = tauri::utils::config::Csp::from(map);
    }
    tauri::Builder::default()
        .manage(api)
        .manage(workbench_resources)
        .manage(host::RestoreGate::default())
        .invoke_handler(tauri::generate_handler![host::open_window, host::save_workspace, host::load_workspace, host::restore_subject_workspace, host::set_window_route, host::forget_desktop_session, host::desktop_test_result, host::desktop_test_window, proxy::desktop_api])
        .setup(host::restore_windows)
        .on_window_event(host::persist_window_event)
        .run(context)
        .expect("error while running DGOS desktop host");
}
