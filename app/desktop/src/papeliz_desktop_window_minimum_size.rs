// The window's minimum size on Windows, held on the page rather than on the whole window.
//
// A frameless window with a shadow keeps invisible resize borders outside the page: the frame's width on
// its left, right and bottom, and a pixel or two at the top on Windows 11. tao counts them when it sets
// the window's starting size, but answers Windows' minimum size question (WM_GETMINMAXINFO) with the
// page's minimum alone. A drag would then stop with the page short by those borders, about 384 × 291 at
// 100 % scale instead of 400 × 300. This module answers that question after tao and adds the borders the
// window has at that moment, so a drag stops when the page itself reaches the minimum.

/// A size in the window's own (physical) pixels.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
struct PapelizDesktopWindowPixelSize {
    width: i32,
    height: i32,
}

/// The smallest whole window a drag may reach: the page's minimum in the window's pixels, rounded the
/// way tao rounds a logical size, plus the borders around the page.
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
fn papeliz_desktop_minimum_window_track_size(
    minimum_inner_logical_width: f64,
    minimum_inner_logical_height: f64,
    window_scale_factor: f64,
    window_border_size: PapelizDesktopWindowPixelSize,
) -> PapelizDesktopWindowPixelSize {
    PapelizDesktopWindowPixelSize {
        width: (minimum_inner_logical_width * window_scale_factor).round() as i32 + window_border_size.width.max(0),
        height: (minimum_inner_logical_height * window_scale_factor).round() as i32 + window_border_size.height.max(0),
    }
}

/// Runs the answer for this window from here on. Windows only: elsewhere the window's own minimum
/// already applies to the page.
pub fn hold_papeliz_desktop_window_minimum_size_to_its_page(papeliz_window: &tauri::WebviewWindow) -> tauri::Result<()> {
    #[cfg(target_os = "windows")]
    {
        let papeliz_window_hwnd = papeliz_window.hwnd()?;
        let papeliz_window_hwnd_value = papeliz_window_hwnd.0 as isize;
        // A subclass is set from the thread that owns the window.
        papeliz_window.run_on_main_thread(move || {
            papeliz_desktop_window_minimum_track_size_answer::answer_papeliz_desktop_window_minimum_track_size(
                windows::Win32::Foundation::HWND(papeliz_window_hwnd_value as *mut core::ffi::c_void),
            );
        })?;
    }
    #[cfg(not(target_os = "windows"))]
    let _ = papeliz_window;

    Ok(())
}

#[cfg(target_os = "windows")]
mod papeliz_desktop_window_minimum_track_size_answer {
    use super::{papeliz_desktop_minimum_window_track_size, PapelizDesktopWindowPixelSize};
    use crate::{PAPELIZ_DESKTOP_WINDOW_MINIMUM_INNER_HEIGHT, PAPELIZ_DESKTOP_WINDOW_MINIMUM_INNER_WIDTH};
    use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, POINT, RECT, WPARAM};
    use windows::Win32::UI::HiDpi::GetDpiForWindow;
    use windows::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass};
    use windows::Win32::UI::WindowsAndMessaging::{
        GetClientRect, GetWindowRect, IsIconic, IsZoomed, MINMAXINFO, WM_GETMINMAXINFO, WM_NCDESTROY,
    };

    // Any number of Papeliz's own that no other subclass of this window uses.
    const PAPELIZ_DESKTOP_WINDOW_MINIMUM_SIZE_SUBCLASS_ID: usize = 0x5041_5045;

    /// Runs on the main thread.
    pub(super) fn answer_papeliz_desktop_window_minimum_track_size(papeliz_window_hwnd: HWND) {
        // SAFETY: the window belongs to this thread, and the subclass is removed when it's destroyed.
        let _ = unsafe {
            SetWindowSubclass(
                papeliz_window_hwnd,
                Some(papeliz_desktop_window_minimum_size_subclass_procedure),
                PAPELIZ_DESKTOP_WINDOW_MINIMUM_SIZE_SUBCLASS_ID,
                0,
            )
        };
    }

    /// The borders around the page while the window is a normal, restored window. Maximized and
    /// minimized windows keep tao's answer: no drag happens then.
    fn read_papeliz_desktop_window_border_size(papeliz_window_hwnd: HWND) -> Option<PapelizDesktopWindowPixelSize> {
        // SAFETY: plain Win32 reads of a window of this thread.
        unsafe {
            if IsZoomed(papeliz_window_hwnd).as_bool() || IsIconic(papeliz_window_hwnd).as_bool() {
                return None;
            }
            let mut window_rect = RECT::default();
            let mut client_rect = RECT::default();
            GetWindowRect(papeliz_window_hwnd, &mut window_rect).ok()?;
            GetClientRect(papeliz_window_hwnd, &mut client_rect).ok()?;
            Some(PapelizDesktopWindowPixelSize {
                width: (window_rect.right - window_rect.left) - (client_rect.right - client_rect.left),
                height: (window_rect.bottom - window_rect.top) - (client_rect.bottom - client_rect.top),
            })
        }
    }

    unsafe extern "system" fn papeliz_desktop_window_minimum_size_subclass_procedure(
        papeliz_window_hwnd: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        _subclass_id: usize,
        _subclass_reference_data: usize,
    ) -> LRESULT {
        if message == WM_NCDESTROY {
            // SAFETY: removes this subclass from its own window before the window goes.
            unsafe {
                let _ = RemoveWindowSubclass(
                    papeliz_window_hwnd,
                    Some(papeliz_desktop_window_minimum_size_subclass_procedure),
                    PAPELIZ_DESKTOP_WINDOW_MINIMUM_SIZE_SUBCLASS_ID,
                );
                return DefSubclassProc(papeliz_window_hwnd, message, wparam, lparam);
            }
        }

        // tao answers first; only its minimum is replaced afterwards.
        // SAFETY: passes the message on unchanged.
        let tao_result = unsafe { DefSubclassProc(papeliz_window_hwnd, message, wparam, lparam) };
        if message == WM_GETMINMAXINFO && lparam.0 != 0 {
            if let Some(window_border_size) = read_papeliz_desktop_window_border_size(papeliz_window_hwnd) {
                // SAFETY: plain Win32 read of a window of this thread.
                let window_scale_factor = f64::from(unsafe { GetDpiForWindow(papeliz_window_hwnd) }) / 96.0;
                if window_scale_factor > 0.0 {
                    let minimum_window_track_size = papeliz_desktop_minimum_window_track_size(
                        PAPELIZ_DESKTOP_WINDOW_MINIMUM_INNER_WIDTH,
                        PAPELIZ_DESKTOP_WINDOW_MINIMUM_INNER_HEIGHT,
                        window_scale_factor,
                        window_border_size,
                    );
                    // SAFETY: for WM_GETMINMAXINFO, lparam points to the MINMAXINFO Windows reads back.
                    unsafe {
                        (*(lparam.0 as *mut MINMAXINFO)).ptMinTrackSize =
                            POINT { x: minimum_window_track_size.width, y: minimum_window_track_size.height };
                    }
                }
            }
        }
        tao_result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn papeliz_desktop_window_pixel_size_for_test(width: i32, height: i32) -> PapelizDesktopWindowPixelSize {
        PapelizDesktopWindowPixelSize { width, height }
    }

    #[test]
    fn the_borders_are_added_to_the_page_minimum_at_each_scale() {
        // Windows 11's frameless borders: 8 px on the left, right and bottom and 1 px at the top at 100 %,
        // 13 px and 2 px at 200 %.
        assert_eq!(
            papeliz_desktop_minimum_window_track_size(400.0, 300.0, 1.0, papeliz_desktop_window_pixel_size_for_test(16, 9)),
            papeliz_desktop_window_pixel_size_for_test(416, 309)
        );
        assert_eq!(
            papeliz_desktop_minimum_window_track_size(400.0, 300.0, 2.0, papeliz_desktop_window_pixel_size_for_test(26, 15)),
            papeliz_desktop_window_pixel_size_for_test(826, 615)
        );
    }

    #[test]
    fn the_page_minimum_rounds_like_a_logical_size() {
        assert_eq!(
            papeliz_desktop_minimum_window_track_size(400.0, 300.0, 1.25, papeliz_desktop_window_pixel_size_for_test(0, 0)),
            papeliz_desktop_window_pixel_size_for_test(500, 375)
        );
        assert_eq!(
            papeliz_desktop_minimum_window_track_size(400.0, 300.0, 1.75, papeliz_desktop_window_pixel_size_for_test(0, 0)),
            papeliz_desktop_window_pixel_size_for_test(700, 525)
        );
    }

    #[test]
    fn a_window_without_borders_keeps_the_page_minimum() {
        // A negative reading can't make the window smaller than the page's minimum.
        assert_eq!(
            papeliz_desktop_minimum_window_track_size(400.0, 300.0, 1.5, papeliz_desktop_window_pixel_size_for_test(-3, -1)),
            papeliz_desktop_window_pixel_size_for_test(600, 450)
        );
    }
}
