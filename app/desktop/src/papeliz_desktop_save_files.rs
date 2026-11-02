// The Save dialog for exports. It opens here in Rust, and the page may then write only the file the
// person chose and the file a save writes beside it first (`<name>.papeliz-saving`, which then moves
// over the chosen file), so a save is whole or not at all there too. The page can't widen what it
// reaches.

use std::ffi::OsString;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Runtime};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::FsExt;

// The same suffix as papelizDesktopSavingFileSuffix in the web app's desktop contract
// (app/web/src/modules/desktop/papeliz-desktop-platform-contract.ts).
const PAPELIZ_DESKTOP_SAVING_FILE_SUFFIX: &str = ".papeliz-saving";

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PapelizDesktopSaveFileTypeFilter {
    desktop_file_type_name: String,
    desktop_file_extensions: Vec<String>,
}

fn papeliz_desktop_saving_file_path(chosen_save_file_path: &Path) -> PathBuf {
    let mut saving_file_path: OsString = chosen_save_file_path.as_os_str().to_owned();
    saving_file_path.push(PAPELIZ_DESKTOP_SAVING_FILE_SUFFIX);
    PathBuf::from(saving_file_path)
}

// Gives back the chosen file's absolute path, or None when the person cancels.
#[tauri::command]
pub async fn pick_papeliz_desktop_save_file_path<R: Runtime>(
    app_handle: AppHandle<R>,
    suggested_desktop_file_name: String,
    desktop_file_type_filters: Vec<PapelizDesktopSaveFileTypeFilter>,
) -> Result<Option<String>, String> {
    let dialog_app_handle = app_handle.clone();
    // The dialog blocks until the person answers, so it waits off the main thread.
    let chosen_save_file = tauri::async_runtime::spawn_blocking(move || {
        let mut save_file_dialog = dialog_app_handle.dialog().file().set_file_name(suggested_desktop_file_name);
        for desktop_file_type_filter in &desktop_file_type_filters {
            let desktop_file_extensions: Vec<&str> =
                desktop_file_type_filter.desktop_file_extensions.iter().map(String::as_str).collect();
            save_file_dialog =
                save_file_dialog.add_filter(&desktop_file_type_filter.desktop_file_type_name, &desktop_file_extensions);
        }
        save_file_dialog.blocking_save_file()
    })
    .await
    .map_err(|error| error.to_string())?;

    let Some(chosen_save_file) = chosen_save_file else {
        return Ok(None);
    };
    let chosen_save_file_path = chosen_save_file.into_path().map_err(|error| error.to_string())?;

    let fs_scope = app_handle.fs_scope();
    fs_scope.allow_file(&chosen_save_file_path).map_err(|error| error.to_string())?;
    fs_scope
        .allow_file(papeliz_desktop_saving_file_path(&chosen_save_file_path))
        .map_err(|error| error.to_string())?;
    Ok(Some(chosen_save_file_path.to_string_lossy().into_owned()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_saving_file_sits_beside_the_chosen_file_with_the_suffix() {
        assert_eq!(
            papeliz_desktop_saving_file_path(Path::new(r"C:\Users\someone\Downloads\Garden plan.pdf")),
            PathBuf::from(r"C:\Users\someone\Downloads\Garden plan.pdf.papeliz-saving")
        );
    }
}
