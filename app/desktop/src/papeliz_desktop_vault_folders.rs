// The folders the person picked as vaults. The page's file calls (Tauri's fs plugin) reach only
// these folders and what is inside them, and they are allowed again at every start, so a recent
// vault reopens by its path. Only a folder picked in the system's own folder dialog, opened here in
// Rust, is ever added: the page can't widen what it reaches.

use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::FsExt;

const PAPELIZ_DESKTOP_VAULT_FOLDERS_FILE_NAME: &str = "papeliz-desktop-vault-folders.json";

fn remembered_vault_folders_file_path<R: Runtime>(app_handle: &AppHandle<R>) -> Option<PathBuf> {
    app_handle
        .path()
        .app_data_dir()
        .ok()
        .map(|app_data_directory| app_data_directory.join(PAPELIZ_DESKTOP_VAULT_FOLDERS_FILE_NAME))
}

fn read_remembered_vault_folder_paths<R: Runtime>(app_handle: &AppHandle<R>) -> Vec<PathBuf> {
    remembered_vault_folders_file_path(app_handle)
        .and_then(|vault_folders_file_path| std::fs::read_to_string(vault_folders_file_path).ok())
        // A file saved by hand in a Windows editor may start with a byte-order mark.
        .and_then(|vault_folders_json| {
            serde_json::from_str::<Vec<PathBuf>>(vault_folders_json.trim_start_matches('\u{feff}')).ok()
        })
        .unwrap_or_default()
}

fn write_remembered_vault_folder_paths<R: Runtime>(
    app_handle: &AppHandle<R>,
    remembered_vault_folder_paths: &[PathBuf],
) -> Result<(), String> {
    let vault_folders_file_path = remembered_vault_folders_file_path(app_handle)
        .ok_or_else(|| "The app's data folder is not known.".to_string())?;
    if let Some(app_data_directory) = vault_folders_file_path.parent() {
        std::fs::create_dir_all(app_data_directory).map_err(|error| error.to_string())?;
    }
    let vault_folders_json =
        serde_json::to_string_pretty(remembered_vault_folder_paths).map_err(|error| error.to_string())?;
    std::fs::write(vault_folders_file_path, vault_folders_json).map_err(|error| error.to_string())
}

fn allow_vault_folder_for_file_calls<R: Runtime>(app_handle: &AppHandle<R>, vault_folder_path: &Path) -> Result<(), String> {
    app_handle
        .fs_scope()
        .allow_directory(vault_folder_path, true)
        .map_err(|error| error.to_string())
}

// At start: every remembered folder still on disk is allowed again. One that has gone stays
// remembered, so a drive that comes back later works again.
pub fn allow_remembered_papeliz_desktop_vault_folders<R: Runtime>(app_handle: &AppHandle<R>) {
    for remembered_vault_folder_path in read_remembered_vault_folder_paths(app_handle) {
        if remembered_vault_folder_path.is_dir() {
            let _ = allow_vault_folder_for_file_calls(app_handle, &remembered_vault_folder_path);
        }
    }
}

// The system folder dialog. Gives back the picked folder's absolute path, or None when the person
// cancels.
#[tauri::command]
pub async fn pick_papeliz_desktop_vault_folder<R: Runtime>(
    app_handle: AppHandle<R>,
    folder_picker_title: String,
) -> Result<Option<String>, String> {
    let dialog_app_handle = app_handle.clone();
    // The dialog blocks until the person answers, so it waits off the main thread.
    let picked_folder = tauri::async_runtime::spawn_blocking(move || {
        dialog_app_handle
            .dialog()
            .file()
            .set_title(folder_picker_title)
            .blocking_pick_folder()
    })
    .await
    .map_err(|error| error.to_string())?;

    let Some(picked_folder) = picked_folder else {
        return Ok(None);
    };
    let picked_folder_path = picked_folder.into_path().map_err(|error| error.to_string())?;

    allow_vault_folder_for_file_calls(&app_handle, &picked_folder_path)?;
    let mut remembered_vault_folder_paths = read_remembered_vault_folder_paths(&app_handle);
    if !remembered_vault_folder_paths.contains(&picked_folder_path) {
        remembered_vault_folder_paths.push(picked_folder_path.clone());
        write_remembered_vault_folder_paths(&app_handle, &remembered_vault_folder_paths)?;
    }
    Ok(Some(picked_folder_path.to_string_lossy().into_owned()))
}

// Removing a recent vault: the folder is no longer allowed at the next start. It stays allowed until
// then, since nothing in this session is still using a removed vault.
#[tauri::command]
pub fn forget_papeliz_desktop_vault_folder<R: Runtime>(
    app_handle: AppHandle<R>,
    vault_folder_path: String,
) -> Result<(), String> {
    let forgotten_vault_folder_path = PathBuf::from(vault_folder_path);
    let remembered_vault_folder_paths: Vec<PathBuf> = read_remembered_vault_folder_paths(&app_handle)
        .into_iter()
        .filter(|remembered_vault_folder_path| *remembered_vault_folder_path != forgotten_vault_folder_path)
        .collect();
    write_remembered_vault_folder_paths(&app_handle, &remembered_vault_folder_paths)
}
