// Papeliz for the desktop: the Papeliz web app (app/web) in a window per vault, with the system's web
// view (WebView2 on Windows). Every window's page reaches only the commands its capability file allows
// (capabilities/papeliz-desktop-main-window.json).

mod papeliz_desktop_app_distribution;
mod papeliz_desktop_save_files;
mod papeliz_desktop_snap_layouts;
mod papeliz_desktop_vault_encryption_key_store;
mod papeliz_desktop_vault_folders;
mod papeliz_desktop_webview_permission_requests;
mod papeliz_desktop_window_minimum_size;
mod papeliz_desktop_windows;

use papeliz_desktop_app_distribution::{detect_papeliz_desktop_app_distribution, PapelizDesktopAppDistribution};
use tauri::webview::NewWindowResponse;
use tauri::{AppHandle, Runtime, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_opener::OpenerExt;

// The window Papeliz opens at start; later ones are named in papeliz_desktop_windows.rs.
const PAPELIZ_DESKTOP_MAIN_WINDOW_LABEL: &str = "main";
// A window's title before its page sets one, and whenever the page's title is empty.
const PAPELIZ_DESKTOP_WINDOW_DEFAULT_TITLE: &str = "Papeliz";

// The built web app is served at https://tauri.localhost/app/, the same /app/ path as on papeliz.com,
// so the build needs no other base path. The https scheme is fixed for good: changing it later would
// start the app with empty settings, keys and recent vaults.
const PAPELIZ_DESKTOP_APP_HOST: &str = "tauri.localhost";
const PAPELIZ_DESKTOP_APP_START_PATH: &str = "app/";

// The first window opens at 1280 × 820, and every window shrinks to 400 × 300 at the least, the narrowest
// width the title bar is laid out for (app/web). Logical pixels, so the page gets the same CSS width at
// every display scale.
const PAPELIZ_DESKTOP_WINDOW_STARTING_INNER_WIDTH: f64 = 1280.0;
const PAPELIZ_DESKTOP_WINDOW_STARTING_INNER_HEIGHT: f64 = 820.0;
const PAPELIZ_DESKTOP_WINDOW_MINIMUM_INNER_WIDTH: f64 = 400.0;
const PAPELIZ_DESKTOP_WINDOW_MINIMUM_INNER_HEIGHT: f64 = 300.0;

// Where a window opens: the first centered at the starting size, a later one down and to the right of
// the window in front, at its size (papeliz_desktop_windows.rs).
pub(crate) enum PapelizDesktopWindowPlacement {
    Centered,
    BesideWindowInFront {
        logical_left: f64,
        logical_top: f64,
        logical_inner_width: f64,
        logical_inner_height: f64,
    },
}

pub fn run_papeliz_desktop_app() {
    let mut papeliz_desktop_app_builder = tauri::Builder::default()
        // First, so a second launch (Start, the taskbar, a shortcut) opens another window of this copy
        // on the start screen instead of starting another copy.
        .plugin(tauri_plugin_single_instance::init(|app_handle, _arguments, _working_directory| {
            let _ = papeliz_desktop_windows::open_papeliz_desktop_new_window(app_handle);
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
        .manage(papeliz_desktop_windows::PapelizDesktopWindowVaults::default())
        // Closing a window closes only it, after its page saved every note; the last one quits.
        .on_window_event(|window, window_event| {
            if let WindowEvent::Destroyed = window_event {
                papeliz_desktop_windows::forget_papeliz_desktop_closed_window_vault(window);
            }
        })
        .invoke_handler(tauri::generate_handler![
            papeliz_desktop_app_distribution::get_papeliz_desktop_app_distribution,
            papeliz_desktop_vault_folders::pick_papeliz_desktop_vault_folder,
            papeliz_desktop_vault_folders::remember_papeliz_desktop_vault_folder,
            papeliz_desktop_vault_folders::forget_papeliz_desktop_vault_folder,
            papeliz_desktop_vault_folders::read_papeliz_desktop_new_vault_default_parent_folder_path,
            papeliz_desktop_save_files::pick_papeliz_desktop_save_file_path,
            papeliz_desktop_snap_layouts::set_papeliz_desktop_maximize_button_bounds,
            papeliz_desktop_vault_encryption_key_store::remember_papeliz_desktop_vault_encryption_key,
            papeliz_desktop_vault_encryption_key_store::read_remembered_papeliz_desktop_vault_encryption_key,
            papeliz_desktop_vault_encryption_key_store::forget_remembered_papeliz_desktop_vault_encryption_key,
            papeliz_desktop_windows::open_papeliz_desktop_new_window_from_page,
            papeliz_desktop_windows::claim_papeliz_desktop_window_vault,
            papeliz_desktop_windows::release_papeliz_desktop_window_vault,
            papeliz_desktop_windows::bring_forward_papeliz_desktop_window_with_vault,
        ])
        .setup(|app| {
            papeliz_desktop_vault_folders::allow_remembered_papeliz_desktop_vault_folders(app.handle());
            // The next start opens one window on the start screen, as the first start does.
            create_papeliz_desktop_window(app.handle(), PAPELIZ_DESKTOP_MAIN_WINDOW_LABEL, PapelizDesktopWindowPlacement::Centered)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Papeliz could not start");
}

// Every window is made here alike: its own page on the start screen, its own title, Snap Layouts on its
// maximize button (set by its page) and its own minimum size.
pub(crate) fn create_papeliz_desktop_window(
    app_handle: &AppHandle,
    window_label: &str,
    window_placement: PapelizDesktopWindowPlacement,
) -> tauri::Result<WebviewWindow> {
    let navigation_app_handle = app_handle.clone();
    let new_window_app_handle = app_handle.clone();

    let papeliz_window_builder = WebviewWindowBuilder::new(app_handle, window_label, WebviewUrl::App(PAPELIZ_DESKTOP_APP_START_PATH.into()))
        .title(PAPELIZ_DESKTOP_WINDOW_DEFAULT_TITLE)
        .min_inner_size(PAPELIZ_DESKTOP_WINDOW_MINIMUM_INNER_WIDTH, PAPELIZ_DESKTOP_WINDOW_MINIMUM_INNER_HEIGHT);
    let papeliz_window_builder = match window_placement {
        PapelizDesktopWindowPlacement::Centered => papeliz_window_builder
            .inner_size(PAPELIZ_DESKTOP_WINDOW_STARTING_INNER_WIDTH, PAPELIZ_DESKTOP_WINDOW_STARTING_INNER_HEIGHT)
            .center(),
        PapelizDesktopWindowPlacement::BesideWindowInFront {
            logical_left,
            logical_top,
            logical_inner_width,
            logical_inner_height,
        } => papeliz_window_builder
            .inner_size(logical_inner_width, logical_inner_height)
            .position(logical_left, logical_top),
    };
    let papeliz_window = papeliz_window_builder
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
        // The page names the open vault in its title ("<vault> · Papeliz"); the window takes the same title,
        // so the taskbar, Alt+Tab and Task View name the vault too.
        .on_document_title_changed(|titled_window, page_document_title| {
            let _ = titled_window.set_title(papeliz_desktop_window_title(&page_document_title));
        })
        .build()?;
    // On Windows, the minimum holds for the page, not the frameless window's invisible borders around it.
    papeliz_desktop_window_minimum_size::hold_papeliz_desktop_window_minimum_size_to_its_page(&papeliz_window)?;
    // The recording build opens DevTools in its own window beside each window. Once closed, WebView2's
    // own F12 and Ctrl+Shift+I open it again; the app's right-click menu has no Inspect.
    #[cfg(feature = "papeliz-recording-devtools")]
    papeliz_window.open_devtools();

    Ok(papeliz_window)
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

fn papeliz_desktop_window_title(page_document_title: &str) -> &str {
    let trimmed_page_document_title = page_document_title.trim();
    if trimmed_page_document_title.is_empty() {
        PAPELIZ_DESKTOP_WINDOW_DEFAULT_TITLE
    } else {
        trimmed_page_document_title
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_window_takes_its_page_title_and_says_papeliz_when_it_is_empty() {
        assert_eq!(papeliz_desktop_window_title("Field Notes · Papeliz"), "Field Notes · Papeliz");
        assert_eq!(papeliz_desktop_window_title("  Papeliz \n"), "Papeliz");
        assert_eq!(papeliz_desktop_window_title(""), "Papeliz");
        assert_eq!(papeliz_desktop_window_title(" \t "), "Papeliz");
    }

    #[test]
    fn the_first_window_opens_at_1280_by_820_and_every_window_shrinks_to_400_by_300() {
        let window_minimum_inner_size = (PAPELIZ_DESKTOP_WINDOW_MINIMUM_INNER_WIDTH, PAPELIZ_DESKTOP_WINDOW_MINIMUM_INNER_HEIGHT);
        let window_starting_inner_size = (PAPELIZ_DESKTOP_WINDOW_STARTING_INNER_WIDTH, PAPELIZ_DESKTOP_WINDOW_STARTING_INNER_HEIGHT);
        assert_eq!(window_minimum_inner_size, (400.0, 300.0));
        assert_eq!(window_starting_inner_size, (1280.0, 820.0));
    }
}
