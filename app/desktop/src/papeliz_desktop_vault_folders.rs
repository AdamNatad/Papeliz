// The folders the person picked for vaults. The page's file calls (Tauri's fs plugin) reach only
// these folders and what is inside them.
// - A folder picked in the system's own folder dialog, opened here in Rust, is allowed for this
//   session.
// - New Vault's default place, <Documents>\Papeliz, is allowed for this session once the page asks
//   for its path, as if it were picked. Only that folder: never the rest of Documents.
// - A vault folder the page asks to remember (the picked folder for Open Vault, or the folder New
//   Vault made inside the picked one) is allowed again at every start, so a recent vault reopens by
//   its path. Only a folder inside one picked in this session can be remembered, so a parent picked
//   for New Vault, like Documents, is never allowed again.
// The page can't widen what it reaches.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{AppHandle, Manager, Runtime, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::FsExt;

const PAPELIZ_DESKTOP_VAULT_FOLDERS_FILE_NAME: &str = "papeliz-desktop-vault-folders.json";
const PAPELIZ_DESKTOP_NEW_VAULT_DEFAULT_PARENT_FOLDER_NAME: &str = "Papeliz";

// The folders picked in this session, resolved (no `..`, the disk's own letter case), so a vault folder
// is remembered only inside one of them.
#[derive(Default)]
pub struct PapelizDesktopPickedVaultFolders(Mutex<Vec<PathBuf>>);

// Path::starts_with compares whole folder names, so "C:\Notes 2" is not inside "C:\Notes".
fn is_vault_folder_inside_an_allowed_folder(resolved_vault_folder_path: &Path, resolved_allowed_folder_paths: &[PathBuf]) -> bool {
    resolved_allowed_folder_paths
        .iter()
        .any(|resolved_allowed_folder_path| resolved_vault_folder_path.starts_with(resolved_allowed_folder_path))
}

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
// cancels. The folder is allowed for this session; the page remembers a vault folder separately.
#[tauri::command]
pub async fn pick_papeliz_desktop_vault_folder<R: Runtime>(
    app_handle: AppHandle<R>,
    picked_vault_folders: State<'_, PapelizDesktopPickedVaultFolders>,
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
    let resolved_picked_folder_path = std::fs::canonicalize(&picked_folder_path).map_err(|error| error.to_string())?;
    picked_vault_folders
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .push(resolved_picked_folder_path);
    Ok(Some(picked_folder_path.to_string_lossy().into_owned()))
}

// New Vault's default place, inside a Documents folder.
// - `new_vault_default_parent_folder_path`: as the page shows it and the file calls use it.
// - `resolved_new_vault_default_parent_folder_path`: resolved like a picked folder, so a vault made
//   inside is remembered. The Papeliz folder may not exist yet, so its Documents folder is resolved and
//   the name joined.
// None when the Documents folder isn't on disk, or when Papeliz there is a link to somewhere else,
// which the app must not reach in its place.
#[derive(Debug, PartialEq)]
struct PapelizDesktopNewVaultDefaultParentFolder {
    new_vault_default_parent_folder_path: PathBuf,
    resolved_new_vault_default_parent_folder_path: PathBuf,
}

fn find_new_vault_default_parent_folder(documents_folder_path: &Path) -> Option<PapelizDesktopNewVaultDefaultParentFolder> {
    let resolved_documents_folder_path = std::fs::canonicalize(documents_folder_path)
        .ok()
        .filter(|resolved_documents_folder_path| resolved_documents_folder_path.is_dir())?;
    let joined_new_vault_default_parent_folder_path =
        resolved_documents_folder_path.join(PAPELIZ_DESKTOP_NEW_VAULT_DEFAULT_PARENT_FOLDER_NAME);
    // An existing folder resolves to the disk's own letter case; a link resolves to where it points.
    let resolved_new_vault_default_parent_folder_path = match std::fs::canonicalize(&joined_new_vault_default_parent_folder_path) {
        Ok(resolved_existing_folder_path) => resolved_existing_folder_path,
        Err(_) => joined_new_vault_default_parent_folder_path,
    };
    if resolved_new_vault_default_parent_folder_path.parent() != Some(resolved_documents_folder_path.as_path()) {
        return None;
    }
    Some(PapelizDesktopNewVaultDefaultParentFolder {
        new_vault_default_parent_folder_path: documents_folder_path.join(PAPELIZ_DESKTOP_NEW_VAULT_DEFAULT_PARENT_FOLDER_NAME),
        resolved_new_vault_default_parent_folder_path,
    })
}

// New Vault's default place: <Documents>\Papeliz, in Windows' own Documents folder (the known folder,
// wherever it was moved, OneDrive included), or None when there's no Documents folder. From here on,
// the page reaches that folder for this session, and a vault made inside it can be remembered. Nothing
// is made here: the page makes Papeliz and the vault folder when Create Vault is pressed.
#[tauri::command]
pub fn read_papeliz_desktop_new_vault_default_parent_folder_path<R: Runtime>(
    app_handle: AppHandle<R>,
    picked_vault_folders: State<'_, PapelizDesktopPickedVaultFolders>,
) -> Result<Option<String>, String> {
    let Some(new_vault_default_parent_folder) = app_handle
        .path()
        .document_dir()
        .ok()
        .and_then(|documents_folder_path| find_new_vault_default_parent_folder(&documents_folder_path))
    else {
        return Ok(None);
    };

    allow_vault_folder_for_file_calls(&app_handle, &new_vault_default_parent_folder.new_vault_default_parent_folder_path)?;
    let mut resolved_picked_folder_paths = picked_vault_folders.0.lock().map_err(|error| error.to_string())?;
    if !resolved_picked_folder_paths.contains(&new_vault_default_parent_folder.resolved_new_vault_default_parent_folder_path) {
        resolved_picked_folder_paths.push(new_vault_default_parent_folder.resolved_new_vault_default_parent_folder_path);
    }
    Ok(Some(
        new_vault_default_parent_folder
            .new_vault_default_parent_folder_path
            .to_string_lossy()
            .into_owned(),
    ))
}

// Remembers a vault folder for every later start. Refused, as a forbidden path, unless the folder is
// one picked in this session or inside one, or already remembered (so asking again is harmless).
#[tauri::command]
pub fn remember_papeliz_desktop_vault_folder<R: Runtime>(
    app_handle: AppHandle<R>,
    picked_vault_folders: State<'_, PapelizDesktopPickedVaultFolders>,
    vault_folder_path: String,
) -> Result<(), String> {
    let remembered_vault_folder_path = PathBuf::from(&vault_folder_path);
    let resolved_vault_folder_path = std::fs::canonicalize(&remembered_vault_folder_path)
        .ok()
        .filter(|resolved_vault_folder_path| resolved_vault_folder_path.is_dir());
    let mut resolved_allowed_folder_paths = picked_vault_folders.0.lock().map_err(|error| error.to_string())?.clone();
    resolved_allowed_folder_paths.extend(
        read_remembered_vault_folder_paths(&app_handle)
            .iter()
            .filter_map(|remembered_folder_path| std::fs::canonicalize(remembered_folder_path).ok()),
    );
    let is_vault_folder_allowed = resolved_vault_folder_path.as_deref().is_some_and(|resolved_vault_folder_path| {
        is_vault_folder_inside_an_allowed_folder(resolved_vault_folder_path, &resolved_allowed_folder_paths)
    });
    if !is_vault_folder_allowed {
        return Err(format!("forbidden path: {vault_folder_path}"));
    }

    allow_vault_folder_for_file_calls(&app_handle, &remembered_vault_folder_path)?;
    let mut remembered_vault_folder_paths = read_remembered_vault_folder_paths(&app_handle);
    if !remembered_vault_folder_paths.contains(&remembered_vault_folder_path) {
        remembered_vault_folder_paths.push(remembered_vault_folder_path);
        write_remembered_vault_folder_paths(&app_handle, &remembered_vault_folder_paths)?;
    }
    Ok(())
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_vault_folder_is_allowed_inside_or_at_a_picked_folder_only() {
        let picked_folder_paths = vec![PathBuf::from(r"C:\Users\someone\Documents")];
        assert!(is_vault_folder_inside_an_allowed_folder(Path::new(r"C:\Users\someone\Documents"), &picked_folder_paths));
        assert!(is_vault_folder_inside_an_allowed_folder(
            Path::new(r"C:\Users\someone\Documents\Garden vault"),
            &picked_folder_paths
        ));
        assert!(!is_vault_folder_inside_an_allowed_folder(Path::new(r"C:\Users\someone"), &picked_folder_paths));
        assert!(!is_vault_folder_inside_an_allowed_folder(
            Path::new(r"C:\Users\someone\Documents 2"),
            &picked_folder_paths
        ));
        assert!(!is_vault_folder_inside_an_allowed_folder(Path::new(r"C:\Windows"), &[]));
    }

    // Folders on disk for these tests, under the build's own target folder. They're made once and
    // reused, and never deleted here.
    fn vault_folder_test_documents_folder(vault_folder_test_case_name: &str) -> PathBuf {
        let documents_folder_path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join("papeliz-desktop-vault-folder-tests")
            .join(vault_folder_test_case_name)
            .join("Documents");
        std::fs::create_dir_all(&documents_folder_path).expect("the test's Documents folder could be made");
        documents_folder_path
    }

    #[test]
    fn the_new_vault_default_parent_is_papeliz_inside_documents_before_it_exists() {
        let documents_folder_path = vault_folder_test_documents_folder("papeliz-not-made-yet");
        let new_vault_default_parent_folder =
            find_new_vault_default_parent_folder(&documents_folder_path).expect("a Documents folder gives a default parent");
        assert_eq!(new_vault_default_parent_folder.new_vault_default_parent_folder_path, documents_folder_path.join("Papeliz"));
        assert_eq!(
            new_vault_default_parent_folder.resolved_new_vault_default_parent_folder_path,
            std::fs::canonicalize(&documents_folder_path).unwrap().join("Papeliz")
        );
        assert!(!new_vault_default_parent_folder.new_vault_default_parent_folder_path.exists(), "nothing is made");
    }

    #[test]
    fn an_existing_papeliz_folder_resolves_to_itself() {
        let documents_folder_path = vault_folder_test_documents_folder("papeliz-already-made");
        std::fs::create_dir_all(documents_folder_path.join("Papeliz")).unwrap();
        let new_vault_default_parent_folder = find_new_vault_default_parent_folder(&documents_folder_path).unwrap();
        assert_eq!(
            new_vault_default_parent_folder.resolved_new_vault_default_parent_folder_path,
            std::fs::canonicalize(documents_folder_path.join("Papeliz")).unwrap()
        );
    }

    #[test]
    fn no_documents_folder_gives_no_default_parent() {
        let missing_documents_folder_path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join("papeliz-desktop-vault-folder-tests")
            .join("no-documents-folder-here")
            .join("Documents");
        assert_eq!(find_new_vault_default_parent_folder(&missing_documents_folder_path), None);
    }

    #[test]
    fn only_the_papeliz_folder_is_reachable_never_the_rest_of_documents() {
        let documents_folder_path = vault_folder_test_documents_folder("papeliz-scope");
        let new_vault_default_parent_folder = find_new_vault_default_parent_folder(&documents_folder_path).unwrap();
        // The one folder the file calls are allowed: Papeliz, directly inside Documents.
        assert_eq!(
            new_vault_default_parent_folder.new_vault_default_parent_folder_path.parent(),
            Some(documents_folder_path.as_path())
        );
        assert_ne!(new_vault_default_parent_folder.new_vault_default_parent_folder_path, documents_folder_path);

        let resolved_documents_folder_path = std::fs::canonicalize(&documents_folder_path).unwrap();
        let resolved_allowed_folder_paths = [new_vault_default_parent_folder.resolved_new_vault_default_parent_folder_path];
        let is_remembered_inside = |resolved_vault_folder_path: PathBuf| {
            is_vault_folder_inside_an_allowed_folder(&resolved_vault_folder_path, &resolved_allowed_folder_paths)
        };
        assert!(is_remembered_inside(resolved_documents_folder_path.join("Papeliz").join("Garden vault")));
        assert!(!is_remembered_inside(resolved_documents_folder_path.clone()));
        assert!(!is_remembered_inside(resolved_documents_folder_path.join("Taxes")));
        assert!(!is_remembered_inside(resolved_documents_folder_path.join("Papeliz 2")));
    }

    // A Papeliz that is a link (here a directory junction, which needs no admin) to another folder is
    // not followed: there's no default parent, and the person picks a place with Browse.
    #[cfg(windows)]
    #[test]
    fn a_papeliz_link_to_another_folder_is_not_followed() {
        let documents_folder_path = vault_folder_test_documents_folder("papeliz-is-a-link");
        let elsewhere_folder_path = documents_folder_path.parent().unwrap().join("Elsewhere");
        std::fs::create_dir_all(&elsewhere_folder_path).unwrap();
        let papeliz_link_path = documents_folder_path.join("Papeliz");
        if std::fs::symlink_metadata(&papeliz_link_path).is_err() {
            let junction_made = std::process::Command::new("cmd")
                .arg("/C")
                .arg("mklink")
                .arg("/J")
                .arg(&papeliz_link_path)
                .arg(&elsewhere_folder_path)
                .output()
                .expect("cmd could run mklink");
            assert!(junction_made.status.success(), "the test's junction could be made");
        }
        assert_eq!(find_new_vault_default_parent_folder(&documents_folder_path), None);
    }
}
