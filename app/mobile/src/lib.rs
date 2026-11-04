// Papeliz for Android and iOS: the Papeliz web app (app/web) in one full-screen web view (Android's
// WebView, iOS's WKWebView). The page reaches only the commands its capability file allows
// (capabilities/papeliz-mobile-main-window.json).

mod papeliz_mobile_export_file_save;
mod papeliz_mobile_webview_permission_requests;

use papeliz_mobile_webview_permission_requests::PapelizMobileShownPage;
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Runtime, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

const PAPELIZ_MOBILE_MAIN_WINDOW_LABEL: &str = "main";

// The built web app is served at https://tauri.localhost/app/, the same /app/ path as on papeliz.com
// and in the desktop app, so the build needs no other base path. The https scheme is fixed for good:
// changing it later would start the app with empty settings, keys and recent vaults.
const PAPELIZ_MOBILE_APP_HOST: &str = "tauri.localhost";
const PAPELIZ_MOBILE_APP_START_PATH: &str = "app/";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run_papeliz_mobile_app() {
    tauri::Builder::default()
        // App Storage: the page reads and writes its vaults inside the app's own data folder, which
        // the capability file scopes it to.
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        // Android's own save screen for exports and backups. The page reaches none of the plugin's
        // commands, only Papeliz's own save command below.
        .plugin(tauri_plugin_android_fs::init())
        .invoke_handler(tauri::generate_handler![papeliz_mobile_export_file_save::save_papeliz_mobile_export_file])
        .setup(|app| {
            create_papeliz_mobile_main_window(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Papeliz could not start");
}

fn create_papeliz_mobile_main_window(app_handle: &AppHandle) -> tauri::Result<()> {
    let navigation_app_handle = app_handle.clone();
    let permission_app_handle = app_handle.clone();
    let papeliz_mobile_shown_page = PapelizMobileShownPage::default();
    let page_load_shown_page = papeliz_mobile_shown_page.clone();

    WebviewWindowBuilder::new(
        app_handle,
        PAPELIZ_MOBILE_MAIN_WINDOW_LABEL,
        WebviewUrl::App(PAPELIZ_MOBILE_APP_START_PATH.into()),
    )
    .use_https_scheme(true)
    .on_page_load(move |_webview_window, page_load_payload| {
        if page_load_payload.event() == PageLoadEvent::Started {
            page_load_shown_page.remember_shown_page_url(page_load_payload.url());
        }
    })
    // The microphone for Papeliz's own page only; the camera, location and the rest stay refused.
    // The phone still asks the person once, the first time.
    .on_permission_request(move |_requesting_webview, requested_permission_kind| {
        papeliz_mobile_webview_permission_requests::answer_papeliz_mobile_webview_permission_request(
            &permission_app_handle,
            &papeliz_mobile_shown_page,
            requested_permission_kind,
        )
    })
    // Links that leave Papeliz open in the phone's own browser, never inside Papeliz.
    .on_navigation(move |navigation_url| {
        if is_papeliz_mobile_app_url(&navigation_app_handle, navigation_url) {
            return true;
        }
        open_url_in_system_browser(&navigation_app_handle, navigation_url);
        false
    })
    .build()?;

    Ok(())
}

fn is_papeliz_mobile_app_url<R: Runtime>(app_handle: &AppHandle<R>, candidate_url: &Url) -> bool {
    match candidate_url.scheme() {
        "about" => return true,
        // A blob made by the page itself: blob:https://tauri.localhost/<id>.
        "blob" => {
            return Url::parse(candidate_url.path())
                .map(|blob_origin_url| is_papeliz_mobile_app_url(app_handle, &blob_origin_url))
                .unwrap_or(false)
        }
        _ => {}
    }

    is_papeliz_mobile_app_origin(app_handle, candidate_url)
}

// Papeliz's own page: the built app at https://tauri.localhost, or the dev server during development.
fn is_papeliz_mobile_app_origin<R: Runtime>(app_handle: &AppHandle<R>, candidate_url: &Url) -> bool {
    if is_papeliz_mobile_built_app_origin(candidate_url) {
        return true;
    }

    // `pnpm mobile:android:dev` serves the web app from the Vite dev server named in tauri.conf.json.
    match &app_handle.config().build.dev_url {
        Some(development_server_url) if tauri::is_dev() => {
            candidate_url.origin() == development_server_url.origin()
        }
        _ => false,
    }
}

fn is_papeliz_mobile_built_app_origin(candidate_url: &Url) -> bool {
    candidate_url.scheme() == "https" && candidate_url.host_str() == Some(PAPELIZ_MOBILE_APP_HOST)
}

fn open_url_in_system_browser<R: Runtime>(app_handle: &AppHandle<R>, external_url: &Url) {
    if matches!(external_url.scheme(), "https" | "http" | "mailto") {
        let _ = app_handle.opener().open_url(external_url.as_str(), None::<&str>);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_built_app_is_papeliz_own_page_only_over_https() {
        let papeliz_page_url = Url::parse("https://tauri.localhost/app/").unwrap();
        let plain_http_page_url = Url::parse("http://tauri.localhost/app/").unwrap();
        let other_site_url = Url::parse("https://example.com/app/").unwrap();
        assert!(is_papeliz_mobile_built_app_origin(&papeliz_page_url));
        assert!(!is_papeliz_mobile_built_app_origin(&plain_http_page_url));
        assert!(!is_papeliz_mobile_built_app_origin(&other_site_url));
    }
}
