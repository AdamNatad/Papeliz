// What the web view may use when the page asks for a device or a browser permission. Android's WebView
// and iOS's WKWebView pass the request here before the phone's own prompt, which still asks the person
// once for the microphone.
//
// Only Papeliz's own page gets the microphone, which it asks for when the assistant's Record is
// pressed, to transcribe speech. The camera, location and every other device or sensor are refused,
// as is any request while the web view shows anything but Papeliz's own page. Frames inside the page
// never reach the microphone either: the Permissions-Policy header in tauri.conf.json limits it to the
// page itself, as the web app's own header does.
//
// The page shown is the one the web view last started loading (PapelizMobileShownPage), not the web
// view's own `url()`: on Android, asking the web view for its address from inside this request
// aborts the app (wry 0.57's main pipe answers after the request has given up waiting).

use std::sync::{Arc, Mutex};

use tauri::webview::{PermissionKind, PermissionResponse};
use tauri::{AppHandle, Runtime, Url};

// The address of the page the web view last started loading, kept by the window's page-load handler.
#[derive(Clone, Default)]
pub struct PapelizMobileShownPage {
    shown_page_url: Arc<Mutex<Option<Url>>>,
}

impl PapelizMobileShownPage {
    pub fn remember_shown_page_url(&self, started_page_url: &Url) {
        if let Ok(mut shown_page_url) = self.shown_page_url.lock() {
            *shown_page_url = Some(started_page_url.clone());
        }
    }

    fn read_shown_page_url(&self) -> Option<Url> {
        self.shown_page_url.lock().ok().and_then(|shown_page_url| shown_page_url.clone())
    }
}

pub fn answer_papeliz_mobile_webview_permission_request<R: Runtime>(
    app_handle: &AppHandle<R>,
    papeliz_mobile_shown_page: &PapelizMobileShownPage,
    requested_permission_kind: PermissionKind,
) -> PermissionResponse {
    let is_requested_from_papeliz_page = papeliz_mobile_shown_page
        .read_shown_page_url()
        .map(|shown_page_url| crate::is_papeliz_mobile_app_origin(app_handle, &shown_page_url))
        .unwrap_or(false);

    choose_papeliz_mobile_webview_permission_response(requested_permission_kind, is_requested_from_papeliz_page)
}

fn choose_papeliz_mobile_webview_permission_response(
    requested_permission_kind: PermissionKind,
    is_requested_from_papeliz_page: bool,
) -> PermissionResponse {
    if !is_requested_from_papeliz_page {
        return PermissionResponse::Deny;
    }

    match requested_permission_kind {
        PermissionKind::Microphone => PermissionResponse::Allow,
        // Left to the web view: Paste in the note's menu reads the clipboard right after a tap, and a
        // video in a note may play and decrypt.
        PermissionKind::ClipboardRead | PermissionKind::Autoplay | PermissionKind::MediaKeySystemAccess => {
            PermissionResponse::Default
        }
        // The camera, location, notifications, sensors, MIDI and any kind added later.
        _ => PermissionResponse::Deny,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_papeliz_own_page_gets_the_microphone() {
        assert_eq!(
            choose_papeliz_mobile_webview_permission_response(PermissionKind::Microphone, true),
            PermissionResponse::Allow
        );
        assert_eq!(
            choose_papeliz_mobile_webview_permission_response(PermissionKind::Microphone, false),
            PermissionResponse::Deny
        );
    }

    #[test]
    fn the_camera_and_location_are_refused() {
        assert_eq!(choose_papeliz_mobile_webview_permission_response(PermissionKind::Camera, true), PermissionResponse::Deny);
        assert_eq!(
            choose_papeliz_mobile_webview_permission_response(PermissionKind::Geolocation, true),
            PermissionResponse::Deny
        );
    }

    #[test]
    fn the_shown_page_is_the_last_one_started() {
        let papeliz_mobile_shown_page = PapelizMobileShownPage::default();
        assert_eq!(papeliz_mobile_shown_page.read_shown_page_url(), None);
        let papeliz_page_url = Url::parse("https://tauri.localhost/app/").unwrap();
        papeliz_mobile_shown_page.remember_shown_page_url(&papeliz_page_url);
        assert_eq!(papeliz_mobile_shown_page.read_shown_page_url(), Some(papeliz_page_url));
    }
}
