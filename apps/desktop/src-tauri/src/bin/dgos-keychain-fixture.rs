use std::io::{self, Read, Write};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = std::env::args().skip(1);
    let action = args.next().ok_or("missing action")?;
    let service = args.next().ok_or("missing service")?;
    let account = args.next().ok_or("missing account")?;
    let valid_account = account.strip_prefix("127.0.0.1:").and_then(|port| port.parse::<u16>().ok()).is_some();
    if !service.starts_with("com.dgos.desktop.test.") || service.len() > 120
        || !service.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'-')
        || !valid_account {
        return Err("fixture keychain scope rejected".into());
    }
    let options = || {
        security_framework::passwords::PasswordOptions::new_generic_password(&service, &account)
    };
    match action.as_str() {
        "put" => {
            let mut secret = Vec::new();
            io::stdin().take(4096).read_to_end(&mut secret)?;
            if secret.is_empty() { return Err("empty fixture token".into()); }
            security_framework::passwords::set_generic_password_options(&secret, options())?;
        }
        "get" => {
            let secret = security_framework::passwords::generic_password(options())?;
            io::stdout().write_all(&secret)?;
        }
        "delete" => { security_framework::passwords::delete_generic_password_options(options())?; }
        _ => return Err("unsupported fixture action".into()),
    }
    Ok(())
}
