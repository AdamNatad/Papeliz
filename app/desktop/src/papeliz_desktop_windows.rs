// Papeliz for Windows opens several windows, one vault each, like a code editor. A second launch or the
// page's New Window opens another window on the start screen, and a vault shown in one window is never
// opened in another, so two windows never write the same vault. Each window's page tells this registry
// which folder vault it shows, by the vault's id (the same id in every window, since the windows share
// one web profile); a window's entry goes when the window does.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;

use tauri::{AppHandle, Manager, Runtime, State, WebviewWindow, Window};

use crate::PapelizDesktopWindowPlacement;

// New windows are "papeliz-window-2", "papeliz-window-3" and so on; the first is "main". The capability
// file gives every one of them the same page commands (capabilities/papeliz-desktop-main-window.json).
const PAPELIZ_DESKTOP_NEW_WINDOW_LABEL_PREFIX: &str = "papeliz-window-";
static NEXT_PAPELIZ_DESKTOP_NEW_WINDOW_NUMBER: AtomicU32 = AtomicU32::new(2);
// How far down and to the right of the window in front a new window opens, in logical pixels.
const PAPELIZ_DESKTOP_NEW_WINDOW_CASCADE_OFFSET: f64 = 32.0;

#[derive(Default)]
pub struct PapelizDesktopWindowVaults {
    window_vault_claims: Mutex<PapelizDesktopWindowVaultClaims>,
}

#[derive(Default)]
struct PapelizDesktopWindowVaultClaims {
    papeliz_vault_ids_by_window_label: HashMap<String, String>,
}

impl PapelizDesktopWindowVaultClaims {
    // The window, other than the asking one, that shows this vault.
    fn find_other_window_showing_vault(&self, papeliz_vault_id: &str, asking_window_label: &str) -> Option<String> {
        self.papeliz_vault_ids_by_window_label
            .iter()
            .find(|(window_label, shown_papeliz_vault_id)| window_label.as_str() != asking_window_label && shown_papeliz_vault_id.as_str() == papeliz_vault_id)
            .map(|(window_label, _)| window_label.clone())
    }

    // The window now shows this vault, in place of the one it showed before; or Err with the window that
    // already shows it, and nothing changes.
    fn claim_vault_for_window(&mut self, window_label: &str, papeliz_vault_id: &str) -> Result<(), String> {
        if let Some(other_window_label) = self.find_other_window_showing_vault(papeliz_vault_id, window_label) {
            return Err(other_window_label);
        }
        self.papeliz_vault_ids_by_window_label.insert(window_label.to_owned(), papeliz_vault_id.to_owned());
        Ok(())
    }

    fn release_window_vault(&mut self, window_label: &str) {
        self.papeliz_vault_ids_by_window_label.remove(window_label);
    }
}

fn with_papeliz_desktop_window_vault_claims<R: Runtime, T>(
    app_handle: &AppHandle<R>,
    use_window_vault_claims: impl FnOnce(&mut PapelizDesktopWindowVaultClaims) -> T,
) -> T {
    let window_vaults = app_handle.state::<PapelizDesktopWindowVaults>();
    let mut window_vault_claims = window_vaults.window_vault_claims.lock().unwrap_or_else(|poisoned_lock| poisoned_lock.into_inner());
    use_window_vault_claims(&mut window_vault_claims)
}

fn bring_papeliz_desktop_window_forward<R: Runtime>(app_handle: &AppHandle<R>, window_label: &str) {
    if let Some(shown_window) = app_handle.get_webview_window(window_label) {
        let _ = shown_window.unminimize();
        let _ = shown_window.show();
        let _ = shown_window.set_focus();
    }
}

/// A new window on the start screen, down and to the right of the window in front and at its size,
/// or centered at the starting size when that wouldn't fit on its screen.
pub fn open_papeliz_desktop_new_window(app_handle: &AppHandle) -> tauri::Result<()> {
    let new_window_number = NEXT_PAPELIZ_DESKTOP_NEW_WINDOW_NUMBER.fetch_add(1, Ordering::Relaxed);
    let new_window_label = format!("{PAPELIZ_DESKTOP_NEW_WINDOW_LABEL_PREFIX}{new_window_number}");
    let new_window_placement = read_papeliz_desktop_new_window_placement(app_handle);
    let new_window = crate::create_papeliz_desktop_window(app_handle, &new_window_label, new_window_placement)?;
    let _ = new_window.set_focus();
    Ok(())
}

fn read_papeliz_desktop_new_window_placement(app_handle: &AppHandle) -> PapelizDesktopWindowPlacement {
    let open_windows = app_handle.webview_windows();
    let Some(front_window) = open_windows
        .values()
        .find(|open_window| open_window.is_focused().unwrap_or(false))
        .or_else(|| open_windows.values().next())
    else {
        return PapelizDesktopWindowPlacement::Centered;
    };
    if front_window.is_maximized().unwrap_or(false) || front_window.is_minimized().unwrap_or(false) {
        return PapelizDesktopWindowPlacement::Centered;
    }
    let (Ok(window_scale_factor), Ok(front_outer_position), Ok(front_outer_size), Ok(front_inner_size), Ok(Some(front_monitor))) = (
        front_window.scale_factor(),
        front_window.outer_position(),
        front_window.outer_size(),
        front_window.inner_size(),
        front_window.current_monitor(),
    ) else {
        return PapelizDesktopWindowPlacement::Centered;
    };
    let monitor_work_area = front_monitor.work_area();
    let cascaded_top_left = cascade_papeliz_desktop_new_window_top_left(
        PapelizDesktopPhysicalRect {
            left: front_outer_position.x,
            top: front_outer_position.y,
            width: front_outer_size.width,
            height: front_outer_size.height,
        },
        PapelizDesktopPhysicalRect {
            left: monitor_work_area.position.x,
            top: monitor_work_area.position.y,
            width: monitor_work_area.size.width,
            height: monitor_work_area.size.height,
        },
        (PAPELIZ_DESKTOP_NEW_WINDOW_CASCADE_OFFSET * window_scale_factor).round() as i32,
    );
    match cascaded_top_left {
        Some((cascaded_left, cascaded_top)) => PapelizDesktopWindowPlacement::BesideWindowInFront {
            logical_left: f64::from(cascaded_left) / window_scale_factor,
            logical_top: f64::from(cascaded_top) / window_scale_factor,
            logical_inner_width: f64::from(front_inner_size.width) / window_scale_factor,
            logical_inner_height: f64::from(front_inner_size.height) / window_scale_factor,
        },
        None => PapelizDesktopWindowPlacement::Centered,
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
struct PapelizDesktopPhysicalRect {
    left: i32,
    top: i32,
    width: u32,
    height: u32,
}

// The new window's top left, offset from the front window's, while the new window still fits inside the
// monitor's work area (the screen without the taskbar); None when it wouldn't.
fn cascade_papeliz_desktop_new_window_top_left(
    front_window_rect: PapelizDesktopPhysicalRect,
    monitor_work_area: PapelizDesktopPhysicalRect,
    cascade_offset_pixels: i32,
) -> Option<(i32, i32)> {
    let cascaded_left = front_window_rect.left.checked_add(cascade_offset_pixels)?;
    let cascaded_top = front_window_rect.top.checked_add(cascade_offset_pixels)?;
    let cascaded_right = i64::from(cascaded_left) + i64::from(front_window_rect.width);
    let cascaded_bottom = i64::from(cascaded_top) + i64::from(front_window_rect.height);
    let work_area_right = i64::from(monitor_work_area.left) + i64::from(monitor_work_area.width);
    let work_area_bottom = i64::from(monitor_work_area.top) + i64::from(monitor_work_area.height);
    let fits_in_work_area = cascaded_left >= monitor_work_area.left
        && cascaded_top >= monitor_work_area.top
        && cascaded_right <= work_area_right
        && cascaded_bottom <= work_area_bottom;
    fits_in_work_area.then_some((cascaded_left, cascaded_top))
}

/// The page's New Window and Ctrl+Shift+N. Async, so the new window is made off the page's own call:
/// on Windows a window made inside a synchronous command can hang.
#[tauri::command]
pub async fn open_papeliz_desktop_new_window_from_page(app_handle: AppHandle) -> Result<(), String> {
    open_papeliz_desktop_new_window(&app_handle).map_err(|new_window_error| new_window_error.to_string())
}

/// This window now shows that folder vault. False when another window already shows it: that window
/// comes forward instead, and this one should close the vault again.
#[tauri::command]
pub fn claim_papeliz_desktop_window_vault(window: WebviewWindow, window_vaults: State<'_, PapelizDesktopWindowVaults>, papeliz_vault_id: String) -> bool {
    let claim_result = window_vaults
        .window_vault_claims
        .lock()
        .unwrap_or_else(|poisoned_lock| poisoned_lock.into_inner())
        .claim_vault_for_window(window.label(), &papeliz_vault_id);
    match claim_result {
        Ok(()) => true,
        Err(other_window_label) => {
            bring_papeliz_desktop_window_forward(window.app_handle(), &other_window_label);
            false
        }
    }
}

/// This window shows no folder vault now: the start screen, the sample vault or a locked vault.
#[tauri::command]
pub fn release_papeliz_desktop_window_vault(window: WebviewWindow) {
    with_papeliz_desktop_window_vault_claims(window.app_handle(), |window_vault_claims| window_vault_claims.release_window_vault(window.label()));
}

/// Before a vault opens: true when another window already shows it, which then comes forward, so the
/// page opens nothing.
#[tauri::command]
pub fn bring_forward_papeliz_desktop_window_with_vault(window: WebviewWindow, papeliz_vault_id: String) -> bool {
    let other_window_label = with_papeliz_desktop_window_vault_claims(window.app_handle(), |window_vault_claims| {
        window_vault_claims.find_other_window_showing_vault(&papeliz_vault_id, window.label())
    });
    match other_window_label {
        Some(other_window_label) => {
            bring_papeliz_desktop_window_forward(window.app_handle(), &other_window_label);
            true
        }
        None => false,
    }
}

/// A closed window shows nothing any more.
pub fn forget_papeliz_desktop_closed_window_vault<R: Runtime>(closed_window: &Window<R>) {
    with_papeliz_desktop_window_vault_claims(closed_window.app_handle(), |window_vault_claims| {
        window_vault_claims.release_window_vault(closed_window.label())
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_vault_shown_in_one_window_is_refused_to_another_until_that_window_lets_it_go() {
        let mut window_vault_claims = PapelizDesktopWindowVaultClaims::default();
        assert_eq!(window_vault_claims.claim_vault_for_window("main", "vault-garden"), Ok(()));
        assert_eq!(window_vault_claims.claim_vault_for_window("papeliz-window-2", "vault-garden"), Err("main".to_owned()));
        assert_eq!(window_vault_claims.find_other_window_showing_vault("vault-garden", "papeliz-window-2"), Some("main".to_owned()));
        // The window that shows it may claim it again, and another vault takes its place.
        assert_eq!(window_vault_claims.claim_vault_for_window("main", "vault-garden"), Ok(()));
        assert_eq!(window_vault_claims.find_other_window_showing_vault("vault-garden", "main"), None);
        assert_eq!(window_vault_claims.claim_vault_for_window("main", "vault-research"), Ok(()));
        assert_eq!(window_vault_claims.claim_vault_for_window("papeliz-window-2", "vault-garden"), Ok(()));
        window_vault_claims.release_window_vault("papeliz-window-2");
        assert_eq!(window_vault_claims.find_other_window_showing_vault("vault-garden", "main"), None);
        assert_eq!(window_vault_claims.claim_vault_for_window("papeliz-window-3", "vault-research"), Err("main".to_owned()));
    }

    #[test]
    fn a_new_window_cascades_from_the_front_one_while_it_fits_the_screen() {
        let work_area = PapelizDesktopPhysicalRect { left: 0, top: 0, width: 2560, height: 1392 };
        let front_window = PapelizDesktopPhysicalRect { left: 100, top: 80, width: 1280, height: 820 };
        assert_eq!(cascade_papeliz_desktop_new_window_top_left(front_window, work_area, 64), Some((164, 144)));
        let front_window_at_bottom_right = PapelizDesktopPhysicalRect { left: 1250, top: 540, width: 1280, height: 820 };
        assert_eq!(cascade_papeliz_desktop_new_window_top_left(front_window_at_bottom_right, work_area, 64), None);
        // A second monitor to the left of the first, at negative coordinates.
        let left_monitor_work_area = PapelizDesktopPhysicalRect { left: -1920, top: 0, width: 1920, height: 1040 };
        let front_window_on_left_monitor = PapelizDesktopPhysicalRect { left: -1800, top: 40, width: 1280, height: 820 };
        assert_eq!(cascade_papeliz_desktop_new_window_top_left(front_window_on_left_monitor, left_monitor_work_area, 32), Some((-1768, 72)));
    }
}
