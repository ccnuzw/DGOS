use std::borrow::Cow;
use std::io::Read;
use std::sync::Mutex;
use std::time::Duration;
use tauri::http::{header, Request, Response, StatusCode};
use url::Url;
use serde::{Deserialize, Serialize};

const SERVICE: &str = "com.dgos.desktop.session";
const SESSION_PATH: &str = "/api/v1/identity/admin/session";

fn keychain_service() -> String {
    if !cfg!(debug_assertions) { return SERVICE.into(); }
    match std::env::var("DGOS_DESKTOP_TEST_KEYCHAIN_SERVICE") {
        Ok(value) if value.starts_with("com.dgos.desktop.test.") && value.len() <= 120
            && value.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'-') => value,
        _ => SERVICE.into(),
    }
}

fn keychain_options(service: &str, account: &str) -> security_framework::passwords::PasswordOptions {
    security_framework::passwords::PasswordOptions::new_generic_password(service, account)
}

fn keychain_get(service: &str, account: &str) -> security_framework::base::Result<Vec<u8>> {
    security_framework::passwords::generic_password(keychain_options(service, account))
}

fn keychain_set(service: &str, account: &str, value: &[u8]) -> security_framework::base::Result<()> {
    security_framework::passwords::set_generic_password_options(value, keychain_options(service, account))
}

fn keychain_delete(service: &str, account: &str) -> security_framework::base::Result<()> {
    security_framework::passwords::delete_generic_password_options(keychain_options(service, account))
}

pub struct ApiProxy { origin: Url, subject: Mutex<Option<String>> }

#[derive(Deserialize)]
pub struct ProxyInput { path: String, method: String, body: Option<String>, headers: Option<std::collections::HashMap<String, String>> }

#[derive(Serialize)]
pub struct ProxyOutput { status: u16, headers: std::collections::HashMap<String, String>, body: String }

#[tauri::command]
pub fn desktop_api(api: tauri::State<ApiProxy>, input: ProxyInput) -> Result<ProxyOutput, String> {
    if !input.path.starts_with("/api/v1/") || input.path.starts_with("//") || input.path.contains('#')
        || input.path.contains("\\") || input.path.len() > 4096 { return Err("invalid API path".into()); }
    if !["GET", "POST", "PUT", "PATCH", "DELETE"].contains(&input.method.as_str()) { return Err("invalid API method".into()); }
    let method: tauri::http::Method = input.method.parse().map_err(|_| "invalid API method")?;
    let mut builder = Request::builder().method(method).uri(format!("tauri://localhost{}", input.path));
    for (key, value) in input.headers.unwrap_or_default() {
        let name = key.to_ascii_lowercase();
        if ["content-type", "accept", "last-event-id", "x-request-id"].contains(&name.as_str()) {
            builder = builder.header(name, value);
        }
    }
    let request = builder.body(input.body.unwrap_or_default().into_bytes()).map_err(|_| "invalid API request")?;
    let mut response: Response<Cow<'static, [u8]>> = Response::builder().status(StatusCode::BAD_GATEWAY).body(Cow::Owned(Vec::new()))
        .map_err(|_| "invalid API response")?;
    api.handle(request, &mut response);
    let headers = response.headers().iter().filter_map(|(key, value)| value.to_str().ok().map(|v| (key.to_string(), v.to_owned()))).collect();
    Ok(ProxyOutput { status: response.status().as_u16(), headers, body: String::from_utf8_lossy(response.body()).into_owned() })
}

impl ApiProxy {
    pub fn from_environment() -> Result<Self, String> {
    let raw = std::env::var("DGOS_DESKTOP_API_ORIGIN").unwrap_or_else(|_| "http://127.0.0.1:3000".into());
        let origin = Url::parse(&raw).map_err(|_| "API origin is not a URL")?;
        let local = matches!(origin.host_str(), Some("127.0.0.1" | "localhost" | "::1"));
        if origin.scheme() != "http" || !local || !origin.username().is_empty() || origin.password().is_some()
            || origin.path() != "/" || origin.query().is_some() || origin.fragment().is_some() {
            return Err("desktop API origin must be a bare loopback HTTP origin".into());
        }
        if cfg!(debug_assertions) {
            if let Ok(service) = std::env::var("DGOS_DESKTOP_TEST_KEYCHAIN_SERVICE") {
                if !valid_test_service(&service) { return Err("invalid test keychain service".into()); }
            }
        }
        Ok(Self { origin, subject: Mutex::new(None) })
    }

    pub fn handle(&self, request: Request<Vec<u8>>, response: &mut Response<Cow<'static, [u8]>>) {
        if !request.uri().path().starts_with("/api/v1/") { return; }
        let packaged = (request.uri().scheme_str() == Some("tauri") && request.uri().host() == Some("localhost") && request.uri().port_u16().is_none())
            || (request.uri().scheme_str() == Some("http") && request.uri().host() == Some("tauri.localhost") && request.uri().port_u16().is_none());
        let development = cfg!(debug_assertions)
            && std::env::var("DGOS_DESKTOP_DEV_SERVER").ok().as_deref() == Some("1")
            && request.uri().scheme_str() == Some("http")
            && request.uri().host() == Some("127.0.0.1")
            && request.uri().port_u16() == Some(15151);
        let local_asset = packaged || development;
        if !local_asset {
            *response.status_mut() = StatusCode::FORBIDDEN;
            *response.body_mut() = Cow::Borrowed(b"forbidden desktop resource origin");
            return;
        }
        let path = request.uri().path_and_query().map(|p| p.as_str()).unwrap_or(request.uri().path());
        if cfg!(debug_assertions) && std::env::var("DGOS_DESKTOP_TEST_WORKBENCH").ok().as_deref() == Some("1")
            && path.contains("/api/v1/apps/dgos.ai-workbench/") {
            eprintln!("dgos desktop debug workbench resource request: {}", path);
        }
        let target = format!("{}{}", self.origin, path.trim_start_matches('/'));
        let agent = ureq::AgentBuilder::new().timeout(Duration::from_secs(45)).redirects(0).build();
        let mut upstream = agent.request(request.method().as_str(), &target)
            .set("Origin", &self.origin.origin().ascii_serialization()).set("X-DGOS-CSRF", "desktop");
        let account = self.account();
        if let Ok(cookie) = keychain_get(&keychain_service(), &account) {
            if let Ok(cookie) = String::from_utf8(cookie) { upstream = upstream.set("Cookie", &format!("dgos_session={cookie}")); }
        }
        for key in ["content-type", "accept", "last-event-id", "x-request-id"] {
            if let Some(value) = request.headers().get(key).and_then(|v| v.to_str().ok()) { upstream = upstream.set(key, value); }
        }
        let result = if request.body().is_empty() { upstream.call() } else { upstream.send_bytes(request.body()) };
        let upstream = match result {
            Ok(r) | Err(ureq::Error::Status(_, r)) => r,
            Err(_) => {
                *response.status_mut() = StatusCode::BAD_GATEWAY;
                response.headers_mut().insert(header::CONTENT_TYPE, header::HeaderValue::from_static("application/json"));
                *response.body_mut() = Cow::Borrowed(br#"{"errorKey":"service_unavailable","message":"Desktop API unavailable"}"#);
                return;
            }
        };
        *response.status_mut() = StatusCode::from_u16(upstream.status()).unwrap_or(StatusCode::BAD_GATEWAY);
        for key in ["content-type", "cache-control", "x-request-id"] {
            if let Some(value) = upstream.header(key).and_then(|v| header::HeaderValue::from_str(v).ok()) {
                response.headers_mut().insert(header::HeaderName::from_bytes(key.as_bytes()).unwrap(), value);
            }
        }
        if let Some(cookie) = upstream.header("set-cookie") {
            if let Some(value) = cookie.split(';').next().and_then(|v| v.strip_prefix("dgos_session=")) {
                let saved = if value.is_empty() { keychain_delete(&keychain_service(), &account) }
                    else { keychain_set(&keychain_service(), &account, value.as_bytes()) };
                if saved.is_err() {
                    *response.status_mut() = StatusCode::BAD_GATEWAY;
                    *response.body_mut() = Cow::Borrowed(br#"{"errorKey":"service_unavailable","message":"Desktop session storage unavailable"}"#);
                    return;
                }
            }
        }
        let mut bytes = Vec::new();
        if upstream.into_reader().take(16 * 1024 * 1024 + 1).read_to_end(&mut bytes).is_ok() && bytes.len() <= 16 * 1024 * 1024 {
            if request.uri().path() == SESSION_PATH && request.method() == "GET" {
                if response.status().is_success() {
                    let subject = serde_json::from_slice::<serde_json::Value>(&bytes).ok()
                        .and_then(|v| v.get("principalId").and_then(|s| s.as_str()).map(str::to_owned));
                    *self.subject.lock().unwrap() = subject;
                } else { *self.subject.lock().unwrap() = None; }
            }
            if (request.uri().path() == "/api/v1/identity/admin/login" || request.uri().path() == "/api/v1/identity/admin/bootstrap")
                && response.status().is_success() {
                if let Some(subject) = serde_json::from_slice::<serde_json::Value>(&bytes).ok()
                    .and_then(|v| v.get("principalId").and_then(|s| s.as_str()).map(str::to_owned)) {
                    *self.subject.lock().unwrap() = Some(subject);
                }
            }
            *response.body_mut() = Cow::Owned(bytes);
        } else {
            *response.status_mut() = StatusCode::BAD_GATEWAY;
            *response.body_mut() = Cow::Borrowed(b"upstream response unavailable");
        }
    }

    fn account(&self) -> String { format!("{}:{}", self.origin.host_str().unwrap_or("127.0.0.1"), self.origin.port_or_known_default().unwrap_or(3000)) }

    pub fn probe_session(&self) -> Option<String> {
        let cookie = keychain_get(&keychain_service(), &self.account()).ok()?;
        let cookie = String::from_utf8(cookie).ok()?;
        let url = self.origin.join(SESSION_PATH.trim_start_matches('/')).ok()?;
        let result = ureq::AgentBuilder::new().timeout(Duration::from_secs(5)).redirects(0).build()
            .get(url.as_str()).set("Cookie", &format!("dgos_session={cookie}"))
            .set("Origin", &self.origin.origin().ascii_serialization())
            .set("X-DGOS-CSRF", "desktop").call().ok()?;
        let body: serde_json::Value = serde_json::from_reader(result.into_reader()).ok()?;
        let subject = body.get("principalId")?.as_str()?.to_owned();
        *self.subject.lock().unwrap() = Some(subject.clone());
        Some(subject)
    }

    pub fn authenticated_subject(&self) -> Option<String> {
        self.probe_session()
    }

    pub fn authorize_app(&self, app_id: &str) -> Result<(), String> {
        let cookie = keychain_get(&keychain_service(), &self.account()).map_err(|_| "desktop session unavailable")?;
        let cookie = String::from_utf8(cookie).map_err(|_| "invalid desktop session")?;
        let url = self.origin.join(&format!("api/v1/apps/{app_id}/launch")).map_err(|e| e.to_string())?;
        ureq::AgentBuilder::new().timeout(Duration::from_secs(5)).redirects(0).build()
            .post(url.as_str()).set("Cookie", &format!("dgos_session={cookie}"))
            .set("Origin", &self.origin.origin().ascii_serialization()).set("X-DGOS-CSRF", "desktop")
            .set("Content-Type", "application/json")
            .send_string("{}").map_err(|_| "app launch was not authorized")?;
        Ok(())
    }
}

fn valid_test_service(value: &str) -> bool {
    value.starts_with("com.dgos.desktop.test.") && value.len() <= 120
        && value.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'-')
}


pub fn forget_session(api: &ApiProxy) -> Result<(), String> {
    *api.subject.lock().unwrap() = None;
    keychain_delete(&keychain_service(), &api.account()).map_err(|e| e.to_string())
}
