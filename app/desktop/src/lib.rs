// Papeliz for the desktop: the Papeliz web app (app/web) in one window, with the system's web view
// (WebView2 on Windows). The page reaches only the commands its capability file allows
// (capabilities/papeliz-desktop-main-window.json).

mod papeliz_desktop_app_distribution;
mod papeliz_desktop_save_files;
mod papeliz_desktop_snap_layouts;
mod papeliz_desktop_vault_folders;
mod papeliz_desktop_webview_permission_requests;

use papeliz_desktop_app_distribution::{detect_papeliz_desktop_app_distribution, PapelizDesktopAppDistribution};
use tauri::webview::NewWindowResponse;
use tauri::{AppHandle, Manager, Runtime, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

const PAPELIZ_DESKTOP_MAIN_WINDOW_LABEL: &str = "main";

// The built web app is served at https://tauri.localhost/app/, the same /app/ path as on papeliz.com,
// so the build needs no other base path. The https scheme is fixed for good: changing it later would
// start the app with empty settings, keys and recent vaults.
const PAPELIZ_DESKTOP_APP_HOST: &str = "tauri.localhost";
const PAPELIZ_DESKTOP_APP_START_PATH: &str = "app/";

pub fn run_papeliz_desktop_app() {
    let mut papeliz_desktop_app_builder = tauri::Builder::default()
        // First, so a second launch shows the open window instead of starting another copy.
        .plugin(tauri_plugin_single_instance::init(|app_handle, _arguments, _working_directory| {
            show_papeliz_desktop_main_window(app_handle);
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init());

    // Only the Microsoft Store updates its own package, so the Store copy carries no updater.
    if detect_papeliz_desktop_app_distribution() == PapelizDesktopAppDistribution::DirectDownload {
        papeliz_desktop_app_builder = papeliz_desktop_app_builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    papeliz_desktop_app_builder
        .manage(papeliz_desktop_vault_folders::PapelizDesktopPickedVaultFolders::default())
        .invoke_handler(tauri::generate_handler![
            papeliz_desktop_app_distribution::get_papeliz_desktop_app_distribution,
            papeliz_desktop_vault_folders::pick_papeliz_desktop_vault_folder,
            papeliz_desktop_vault_folders::remember_papeliz_desktop_vault_folder,
            papeliz_desktop_vault_folders::forget_papeliz_desktop_vault_folder,
            papeliz_desktop_vault_folders::read_papeliz_desktop_new_vault_default_parent_folder_path,
            papeliz_desktop_save_files::pick_papeliz_desktop_save_file_path,
            papeliz_desktop_snap_layouts::set_papeliz_desktop_maximize_button_bounds,
        ])
        .setup(|app| {
            papeliz_desktop_vault_folders::allow_remembered_papeliz_desktop_vault_folders(app.handle());
            create_papeliz_desktop_main_window(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Papeliz could not start");
}

fn create_papeliz_desktop_main_window(app_handle: &AppHandle) -> tauri::Result<()> {
    let navigation_app_handle = app_handle.clone();
    let new_window_app_handle = app_handle.clone();

    WebviewWindowBuilder::new(
        app_handle,
        PAPELIZ_DESKTOP_MAIN_WINDOW_LABEL,
        WebviewUrl::App(PAPELIZ_DESKTOP_APP_START_PATH.into()),
    )
    .title("Papeliz")
    .inner_size(1280.0, 820.0)
    .min_inner_size(720.0, 480.0)
    .center()
    // No Windows title bar: Papeliz's own blue bar is the title bar, with the window buttons at its
    // right end (app/web), so the note starts right below it. The shadow keeps Windows 11's outline
    // and rounded corners on the frameless window.
    .decorations(false)
    .shadow(true)
    .use_https_scheme(true)
    // The page takes files dropped from Windows itself (the Assistant's composer).
    .disable_drag_drop_handler()
    // The microphone for Papeliz's own page only; the camera, location and the rest stay refused.
    .on_permission_request(papeliz_desktop_webview_permission_requests::answer_papeliz_desktop_webview_permission_request)
    // Links that leave Papeliz open in the person's own browser, never in a Papeliz window.
    .on_navigation(move |navigation_url| {
        if is_papeliz_desktop_app_url(&navigation_app_handle, navigation_url) {
            return true;
        }
        open_url_in_system_browser(&navigation_app_handle, navigation_url);
        false
    })
    .on_new_window(move |new_window_url, _new_window_features| {
        open_url_in_system_browser(&new_window_app_handle, &new_window_url);
        NewWindowResponse::Deny
    })
    .build()?;

    Ok(())
}

fn show_papeliz_desktop_main_window(app_handle: &AppHandle) {
    if let Some(main_window) = app_handle.get_webview_window(PAPELIZ_DESKTOP_MAIN_WINDOW_LABEL) {
        let _ = main_window.unminimize();
        let _ = main_window.show();
        let _ = main_window.set_focus();
    }
}

fn is_papeliz_desktop_app_url(app_handle: &AppHandle, candidate_url: &Url) -> bool {
    match candidate_url.scheme() {
        "about" => return true,
        // A blob made by the page itself: blob:https://tauri.localhost/<id>.
        "blob" => {
            return Url::parse(candidate_url.path())
                .map(|blob_origin_url| is_papeliz_desktop_app_url(app_handle, &blob_origin_url))
                .unwrap_or(false)
        }
        _ => {}
    }

    is_papeliz_desktop_app_origin(app_handle, candidate_url)
}

// Papeliz's own page: the built app at https://tauri.localhost, or the dev server during development.
fn is_papeliz_desktop_app_origin<R: Runtime>(app_handle: &AppHandle<R>, candidate_url: &Url) -> bool {
    if candidate_url.scheme() == "https" && candidate_url.host_str() == Some(PAPELIZ_DESKTOP_APP_HOST) {
        return true;
    }

    // `pnpm desktop:dev` serves the web app from the Vite dev server named in tauri.conf.json.
    match &app_handle.config().build.dev_url {
        Some(development_server_url) if tauri::is_dev() => {
            candidate_url.origin() == development_server_url.origin()
        }
        _ => false,
    }
}

fn open_url_in_system_browser(app_handle: &AppHandle, external_url: &Url) {
    if matches!(external_url.scheme(), "https" | "http" | "mailto") {
        let _ = app_handle.opener().open_url(external_url.as_str(), None::<&str>);
    }
}
