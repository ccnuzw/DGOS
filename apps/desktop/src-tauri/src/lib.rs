#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod host;
mod proxy;

pub fn run() {
    let api = proxy::ApiProxy::from_environment().expect("invalid DGOS desktop API origin");
    tauri::Builder::default()
        .manage(api)
        .manage(host::RestoreGate::default())
        .invoke_handler(tauri::generate_handler![host::open_window, host::save_workspace, host::load_workspace, host::restore_subject_workspace, host::set_window_route, host::forget_desktop_session, host::desktop_test_result, host::desktop_test_window, proxy::desktop_api])
        .setup(host::restore_windows)
        .on_window_event(host::persist_window_event)
        .run(tauri::generate_context!())
        .expect("error while running DGOS desktop host");
}
