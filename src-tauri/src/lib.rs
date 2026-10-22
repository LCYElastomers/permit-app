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
    operation(database).map_err(command_code)
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
fn note_sync_cycle(store: tauri::State<AppStore>, phase: String) -> Result<store::LocalStatus, String> {
    with_store(&store, |database| database.note_sync_cycle(&phase))
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
            local_status,
            list_reference_areas,
            replace_reference_areas,
            note_sync_cycle
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
