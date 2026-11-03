// What the window's web view may use when the page asks for a device or a browser permission.
// WebView2 raises the request before Windows' own privacy settings are checked; without an answer
// it shows its own prompt for "tauri.localhost".
//
// Only Papeliz's own page gets the microphone, which it asks for when the assistant's Record is
// pressed, to transcribe speech. The camera, location and every other device or sensor are
// refused. A request while the window shows anything but Papeliz's own page is refused outright.
// Frames inside the page never reach the microphone either: the Permissions-Policy header in
// tauri.conf.json limits it to the page itself, as the web app's own header does.

use tauri::webview::{PermissionKind, PermissionResponse};
use tauri::{Manager, Runtime, Webview};

pub fn answer_papeliz_desktop_webview_permission_request<R: Runtime>(
    requesting_webview: Webview<R>,
    requested_permission_kind: PermissionKind,
) -> PermissionResponse {
    let is_requested_from_papeliz_page = requesting_webview
        .url()
        .map(|requesting_page_url| {
            crate::is_papeliz_desktop_app_origin(requesting_webview.app_handle(), &requesting_page_url)
        })
        .unwrap_or(false);

    choose_papeliz_desktop_webview_permission_response(requested_permission_kind, is_requested_from_papeliz_page)
}

fn choose_papeliz_desktop_webview_permission_response(
    requested_permission_kind: PermissionKind,
    is_requested_from_papeliz_page: bool,
) -> PermissionResponse {
    if !is_requested_from_papeliz_page {
        return PermissionResponse::Deny;
    }

    match requested_permission_kind {
        PermissionKind::Microphone => PermissionResponse::Allow,
        // Left to WebView2, which handles these as Chrome does: Paste in the note's menu reads the
        // clipboard and PDF export lists the computer's fonts, both right after a click; a YouTube
        // player in a note may autoplay and decrypt; several downloads in a row are asked about.
        PermissionKind::ClipboardRead
        | PermissionKind::LocalFonts
        | PermissionKind::Autoplay
        | PermissionKind::MediaKeySystemAccess
        | PermissionKind::AutomaticDownloads => PermissionResponse::Default,
        // The camera, location, notifications, screen capture, sensors, MIDI, window placement,
        // pointer lock, File System Access (the desktop app saves through its own commands) and
        // any kind added later.
        _ => PermissionResponse::Deny,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_papeliz_own_page_gets_the_microphone() {
        assert_eq!(
            choose_papeliz_desktop_webview_permission_response(PermissionKind::Microphone, true),
            PermissionResponse::Allow
        );
        assert_eq!(
            choose_papeliz_desktop_webview_permission_response(PermissionKind::Microphone, false),
            PermissionResponse::Deny
        );
    }

    #[test]
    fn the_camera_location_and_other_devices_stay_refused() {
        for refused_permission_kind in [
            PermissionKind::Camera,
            PermissionKind::Geolocation,
            PermissionKind::Notifications,
            PermissionKind::DisplayCapture,
            PermissionKind::Midi,
            PermissionKind::Sensors,
            PermissionKind::WindowManagement,
            PermissionKind::PointerLock,
            PermissionKind::FileSystemAccess,
            PermissionKind::Other,
        ] {
            assert_eq!(
                choose_papeliz_desktop_webview_permission_response(refused_permission_kind, true),
                PermissionResponse::Deny,
                "{refused_permission_kind} should be refused"
            );
        }
    }

    #[test]
    fn what_the_page_already_uses_stays_with_webview2_on_papeliz_own_page_only() {
        for webview2_permission_kind in [
            PermissionKind::ClipboardRead,
            PermissionKind::LocalFonts,
            PermissionKind::Autoplay,
            PermissionKind::MediaKeySystemAccess,
            PermissionKind::AutomaticDownloads,
        ] {
            assert_eq!(
                choose_papeliz_desktop_webview_permission_response(webview2_permission_kind, true),
                PermissionResponse::Default
            );
            assert_eq!(
                choose_papeliz_desktop_webview_permission_response(webview2_permission_kind, false),
                PermissionResponse::Deny
            );
        }
    }
}
