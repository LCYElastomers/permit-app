mod store;

use std::sync::Mutex;

use tauri::Manager;

struct AppStore {
    inner: Mutex<Option<store::LocalDatabase>>,
}

fn command_code(error: store::StoreError) -> String {
    match error {
        store::StoreError::InvalidCatalog => "invalid-area-catalog".to_string(),
        store::StoreError::InvalidPhase => "invalid-sync-phase".to_string(),
        store::StoreError::InvalidChange | store::StoreError::Unavailable => "local-store-unavailable".to_string(),
    }
}

fn with_store<T>(
    store: &AppStore,
    operation: impl FnOnce(&mut store::LocalDatabase) -> Result<T, store::StoreError>,
) -> Result<T, String> {
    let mut guard = store.inner.lock().map_err(|_| "local-store-unavailable".to_string())?;
    let Some(database) = guard.as_mut() else {
        return Err("local-store-unavailable".to_string());
    };
    operation(database).map_err(|error| {
        log::error!("local store command failed: {error}");
        command_code(error)
    })
}

fn open_database(app: &tauri::AppHandle) -> Result<store::LocalDatabase, store::StoreError> {
    let directory = app.path().app_data_dir().map_err(|error| {
        log::error!("app data directory unavailable: {error}");
        store::StoreError::Unavailable
    })?;
    std::fs::create_dir_all(&directory).map_err(|error| {
        log::error!("app data directory create failed: {error}");
        store::StoreError::Unavailable
    })?;
    store::LocalDatabase::open(directory.join(store::DATABASE_FILE_NAME))
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowsAccount {
    domain: Option<String>,
    username: String,
}

fn split_windows_account(raw: &str, domain: Option<String>) -> WindowsAccount {
    let mut domain = domain.filter(|value| !value.trim().is_empty());
    let username = if let Some((account_domain, account_user)) = raw.split_once('\\') {
        if !account_domain.trim().is_empty() {
            domain = Some(account_domain.to_string());
        }
        account_user.to_string()
    } else {
        raw.to_string()
    };
    WindowsAccount { domain, username }
}

#[tauri::command]
fn current_windows_account() -> WindowsAccount {
    split_windows_account(
        &std::env::var("USERNAME").unwrap_or_default(),
        std::env::var("USERDOMAIN").ok(),
    )
}

#[tauri::command]
fn local_status(store: tauri::State<AppStore>) -> Result<store::LocalStatus, String> {
    with_store(&store, |database| database.status())
}

#[tauri::command]
fn list_reference_areas(store: tauri::State<AppStore>) -> Result<Vec<store::AreaRow>, String> {
    with_store(&store, |database| database.list_areas())
}

#[tauri::command]
fn replace_reference_areas(store: tauri::State<AppStore>, areas: Vec<store::AreaInput>) -> Result<(), String> {
    with_store(&store, |database| database.replace_areas(&areas))
}

#[tauri::command]
fn list_reference_catalog(store: tauri::State<AppStore>, catalog: String) -> Result<Vec<store::CatalogRow>, String> {
    with_store(&store, |database| database.list_catalog(&catalog))
}

#[tauri::command]
fn replace_reference_catalog(store: tauri::State<AppStore>, catalog: String, rows: Vec<store::CatalogInput>) -> Result<(), String> {
    with_store(&store, |database| database.replace_catalog(&catalog, &rows))
}

#[tauri::command]
fn note_sync_cycle(store: tauri::State<AppStore>, phase: String) -> Result<store::LocalStatus, String> {
    with_store(&store, |database| database.note_sync_cycle(&phase))
}

#[tauri::command]
fn note_plant_contact(store: tauri::State<AppStore>) -> Result<store::LocalStatus, String> {
    with_store(&store, |database| database.note_plant_contact())
}

#[tauri::command]
fn submit_permit_for_review(
    store: tauri::State<AppStore>,
    permit_id: String,
    event_id: String,
    outbox_id: String,
    user_id: Option<String>,
) -> Result<store::DraftRecord, String> {
    with_store(&store, |database| database.submit_for_review(&permit_id, &event_id, &outbox_id, user_id.as_deref()))
}

#[tauri::command]
fn list_local_drafts(store: tauri::State<AppStore>) -> Result<Vec<store::DraftRecord>, String> {
    with_store(&store, |database| database.list_drafts())
}

#[tauri::command]
fn save_general_work_draft(
    store: tauri::State<AppStore>,
    draft: store::GeneralWorkDraftInput,
) -> Result<store::DraftRecord, String> {
    with_store(&store, |database| database.save_general_work_draft(draft))
}

#[tauri::command]
fn list_pushable_permit_creates(store: tauri::State<AppStore>) -> Result<Vec<store::PushablePermitCreate>, String> {
    with_store(&store, |database| database.list_pushable_permit_creates())
}

#[tauri::command]
fn list_pushable_permit_submissions(
    store: tauri::State<AppStore>,
) -> Result<Vec<store::PushablePermitSubmission>, String> {
    with_store(&store, |database| database.list_pushable_permit_submissions())
}

#[tauri::command]
fn acknowledge_permit_submitted(
    store: tauri::State<AppStore>,
    outbox_id: String,
    event_id: String,
    permit_id: String,
    permit_number: String,
) -> Result<store::DraftRecord, String> {
    with_store(&store, |database| {
        database.acknowledge_permit_submitted(&outbox_id, &event_id, &permit_id, &permit_number)
    })
}

#[tauri::command]
fn acknowledge_permit_created(
    store: tauri::State<AppStore>,
    outbox_id: String,
    event_id: String,
    permit_id: String,
    permit_number: String,
) -> Result<store::DraftRecord, String> {
    with_store(&store, |database| {
        database.acknowledge_permit_created(&outbox_id, &event_id, &permit_id, &permit_number)
    })
}

#[tauri::command]
fn mark_outbox_attention(store: tauri::State<AppStore>, outbox_id: String, error_code: String) -> Result<(), String> {
    with_store(&store, |database| database.mark_outbox_attention(&outbox_id, &error_code))
}

#[tauri::command]
fn note_push_deferred(store: tauri::State<AppStore>, outbox_id: String) -> Result<store::LocalStatus, String> {
    with_store(&store, |database| database.note_push_deferred(&outbox_id))
}

#[tauri::command]
fn open_permit_pdf(app: tauri::AppHandle, filename: String, bytes: Vec<u8>) -> Result<(), String> {
    if bytes.len() < 5 || &bytes[..5] != b"%PDF-" {
        return Err("pdf-open-failed".to_string());
    }
    let directory = app.path().app_cache_dir().map_err(|error| {
        log::error!("permit pdf cache directory unavailable: {error}");
        "pdf-open-failed".to_string()
    })?;
    std::fs::create_dir_all(&directory).map_err(|error| {
        log::error!("permit pdf cache directory create failed: {error}");
        "pdf-open-failed".to_string()
    })?;
    let path = directory.join(pdf_download_name(&filename));
    std::fs::write(&path, &bytes).map_err(|error| {
        log::error!("permit pdf write failed: {error}");
        "pdf-open-failed".to_string()
    })?;
    open::that(&path).map_err(|error| {
        log::error!("permit pdf open failed: {error}");
        "pdf-open-failed".to_string()
    })
}

fn pdf_download_name(filename: &str) -> String {
    let base = filename.rsplit(['/', '\\']).next().unwrap_or("permit.pdf");
    let mut clean: String = base
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '.' || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect();
    if !clean.to_ascii_lowercase().ends_with(".pdf") {
        clean.push_str(".pdf");
    }
    if clean == ".pdf" || clean.is_empty() {
        "permit.pdf".to_string()
    } else {
        clean
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            let database = match open_database(app.handle()) {
                Ok(database) => Some(database),
                Err(error) => {
                    log::error!("local store unavailable: {error}");
                    None
                }
            };
            app.manage(AppStore {
                inner: Mutex::new(database),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            current_windows_account,
            local_status,
            list_reference_areas,
            replace_reference_areas,
            list_reference_catalog,
            replace_reference_catalog,
            note_sync_cycle,
            note_plant_contact,
            list_local_drafts,
            submit_permit_for_review,
            save_general_work_draft,
            list_pushable_permit_creates,
            list_pushable_permit_submissions,
            acknowledge_permit_created,
            acknowledge_permit_submitted,
            mark_outbox_attention,
            note_push_deferred,
            open_permit_pdf
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}

#[cfg(test)]
mod windows_account_tests {
    use super::split_windows_account;

    #[test]
    fn splits_a_domain_qualified_windows_account() {
        let account = split_windows_account(r"LCY\bobby.fitzgerald", None);
        assert_eq!(account.domain.as_deref(), Some("LCY"));
        assert_eq!(account.username, "bobby.fitzgerald");
    }

    #[test]
    fn keeps_a_bare_username_and_optional_domain() {
        let account = split_windows_account("bobby.fitzgerald", Some("LCY".to_string()));
        assert_eq!(account.domain.as_deref(), Some("LCY"));
        assert_eq!(account.username, "bobby.fitzgerald");
        let bare = split_windows_account("bobby.fitzgerald", Some(" ".to_string()));
        assert_eq!(bare.domain, None);
    }
}

#[cfg(test)]
mod pdf_name_tests {
    use super::pdf_download_name;

    #[test]
    fn keeps_a_server_download_name_and_drops_path_characters() {
        assert_eq!(
            pdf_download_name("PTW-2026-00001-General-Work-Rev-01.pdf"),
            "PTW-2026-00001-General-Work-Rev-01.pdf"
        );
        assert_eq!(pdf_download_name("../srv/permit.pdf"), "permit.pdf");
        assert_eq!(pdf_download_name("draft"), "draft.pdf");
    }
}
