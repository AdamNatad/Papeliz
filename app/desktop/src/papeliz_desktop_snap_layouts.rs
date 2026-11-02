// Snap Layouts for the maximize button that the page draws in Papeliz's own title bar (Windows 11).
//
// Windows offers Snap Layouts when the pointer rests on a window's maximize button, and it knows that
// button only by a window answering WM_NCHITTEST with HTMAXBUTTON. The page's button is drawn inside
// WebView2, whose windows take the pointer, so Windows never asks Papeliz. The page therefore tells
// this module where its button is, and a child window of Papeliz's own sits over that rectangle,
// above the web view, and answers as the maximize button. It never paints, so the page's button
// stays visible beneath it. Answering HTTRANSPARENT instead would not reach the main window: the
// web view covers the whole client area and would take the point.
//
// The pointer no longer reaches the page there, so the page paints its hover and pressed looks from
// the pointer-state event, and the click itself maximizes or restores the window here. Nothing is
// created until the page sends bounds; null bounds switch the piece off.

/// The page's maximize button in CSS pixels from the top-left corner of the window's client area,
/// which is what `getBoundingClientRect()` gives because the web view fills the client area.
#[derive(Clone, Copy, PartialEq, Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PapelizDesktopMaximizeButtonBounds {
    pub desktop_maximize_button_left: f64,
    pub desktop_maximize_button_top: f64,
    pub desktop_maximize_button_width: f64,
    pub desktop_maximize_button_height: f64,
}

/// What the native layer tells the page about the pointer over its maximize button.
#[derive(Clone, Copy, PartialEq, Eq, Debug, serde::Serialize)]
#[serde(rename_all = "kebab-case")]
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
enum PapelizDesktopMaximizeButtonPointerState {
    Idle,
    Hovered,
    Pressed,
}

#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
const PAPELIZ_DESKTOP_MAXIMIZE_BUTTON_POINTER_STATE_EVENT_NAME: &str = "papeliz-desktop-maximize-button-pointer-state";

/// The button in the window's physical pixels. Each edge is rounded on its own, so the rectangle
/// lands on the same pixels the page's button does, with no gap beside its neighbours.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
struct PapelizDesktopMaximizeButtonPhysicalRect {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

fn are_papeliz_desktop_maximize_button_bounds_usable(bounds: &PapelizDesktopMaximizeButtonBounds) -> bool {
    let every_value_is_finite = [
        bounds.desktop_maximize_button_left,
        bounds.desktop_maximize_button_top,
        bounds.desktop_maximize_button_width,
        bounds.desktop_maximize_button_height,
    ]
    .iter()
    .all(|bounds_value| bounds_value.is_finite());
    every_value_is_finite && bounds.desktop_maximize_button_width > 0.0 && bounds.desktop_maximize_button_height > 0.0
}

#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
fn papeliz_desktop_window_scale_factor_from_dpi(window_dpi: u32) -> f64 {
    f64::from(window_dpi) / 96.0
}

#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
fn papeliz_desktop_maximize_button_physical_rect(
    bounds: &PapelizDesktopMaximizeButtonBounds,
    window_scale_factor: f64,
) -> Option<PapelizDesktopMaximizeButtonPhysicalRect> {
    if !are_papeliz_desktop_maximize_button_bounds_usable(bounds)
        || !window_scale_factor.is_finite()
        || window_scale_factor <= 0.0
    {
        return None;
    }
    let to_physical_pixels = |css_pixels: f64| (css_pixels * window_scale_factor).round() as i32;
    let physical_rect = PapelizDesktopMaximizeButtonPhysicalRect {
        left: to_physical_pixels(bounds.desktop_maximize_button_left),
        top: to_physical_pixels(bounds.desktop_maximize_button_top),
        right: to_physical_pixels(bounds.desktop_maximize_button_left + bounds.desktop_maximize_button_width),
        bottom: to_physical_pixels(bounds.desktop_maximize_button_top + bounds.desktop_maximize_button_height),
    };
    (physical_rect.right > physical_rect.left && physical_rect.bottom > physical_rect.top).then_some(physical_rect)
}

#[tauri::command]
pub fn set_papeliz_desktop_maximize_button_bounds(
    window: tauri::WebviewWindow,
    desktop_maximize_button_bounds: Option<PapelizDesktopMaximizeButtonBounds>,
) -> Result<(), String> {
    if desktop_maximize_button_bounds
        .as_ref()
        .is_some_and(|bounds| !are_papeliz_desktop_maximize_button_bounds_usable(bounds))
    {
        return Err("The maximize button's bounds need finite numbers and a width and height above 0.".into());
    }

    #[cfg(target_os = "windows")]
    {
        // The hit target is a window of the main thread, so it is created and moved there.
        let main_window = window.clone();
        window
            .run_on_main_thread(move || {
                papeliz_desktop_maximize_button_hit_target::set_papeliz_desktop_maximize_button_hit_target_bounds(
                    &main_window,
                    desktop_maximize_button_bounds,
                );
            })
            .map_err(|error| error.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    let _ = (window, desktop_maximize_button_bounds);

    Ok(())
}

#[cfg(target_os = "windows")]
mod papeliz_desktop_maximize_button_hit_target {
    use super::{
        papeliz_desktop_maximize_button_physical_rect, papeliz_desktop_window_scale_factor_from_dpi,
        PapelizDesktopMaximizeButtonBounds, PapelizDesktopMaximizeButtonPointerState,
        PAPELIZ_DESKTOP_MAXIMIZE_BUTTON_POINTER_STATE_EVENT_NAME,
    };
    use tauri::{Emitter, WebviewWindow, WindowEvent};
    use windows::core::{w, PCWSTR};
    use windows::Win32::Foundation::{HINSTANCE, HWND, LPARAM, LRESULT, WPARAM};
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::UI::HiDpi::GetDpiForWindow;
    use windows::Win32::UI::Input::KeyboardAndMouse::{TrackMouseEvent, TME_LEAVE, TME_NONCLIENT, TRACKMOUSEEVENT};
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, FindWindowExW, GetWindowLongPtrW, IsZoomed, PostMessageW, RegisterClassExW,
        SetWindowLongPtrW, SetWindowPos, ShowWindow, GWLP_USERDATA, HTMAXBUTTON, HWND_TOP, SC_MAXIMIZE, SC_RESTORE,
        SWP_NOACTIVATE, SWP_SHOWWINDOW, SW_HIDE, WINDOW_EX_STYLE, WM_ERASEBKGND, WM_NCDESTROY, WM_NCHITTEST,
        WM_NCLBUTTONDBLCLK, WM_NCLBUTTONDOWN, WM_NCLBUTTONUP, WM_NCMOUSELEAVE, WM_NCMOUSEMOVE, WM_SYSCOMMAND,
        WNDCLASSEXW, WS_CHILD, WS_CLIPSIBLINGS,
    };

    const PAPELIZ_DESKTOP_MAXIMIZE_BUTTON_HIT_TARGET_WINDOW_CLASS: PCWSTR =
        w!("PapelizDesktopMaximizeButtonHitTarget");
    // Tauri's own child window that lets a frameless window be resized from its top edge.
    const TAURI_UNDECORATED_RESIZE_BORDERS_WINDOW_CLASS: PCWSTR = w!("TAURI_DRAG_RESIZE_BORDERS");

    struct PapelizDesktopMaximizeButtonHitTargetState {
        main_window: WebviewWindow,
        main_window_hwnd: HWND,
        desktop_maximize_button_bounds: Option<PapelizDesktopMaximizeButtonBounds>,
        pointer_flags: PapelizDesktopMaximizeButtonPointerFlags,
    }

    #[derive(Clone, Copy, Default)]
    struct PapelizDesktopMaximizeButtonPointerFlags {
        is_maximize_button_hovered: bool,
        is_maximize_button_pressed: bool,
    }

    impl PapelizDesktopMaximizeButtonPointerFlags {
        fn pointer_state(self) -> PapelizDesktopMaximizeButtonPointerState {
            if self.is_maximize_button_pressed {
                PapelizDesktopMaximizeButtonPointerState::Pressed
            } else if self.is_maximize_button_hovered {
                PapelizDesktopMaximizeButtonPointerState::Hovered
            } else {
                PapelizDesktopMaximizeButtonPointerState::Idle
            }
        }
    }

    /// Runs on the main thread.
    pub(super) fn set_papeliz_desktop_maximize_button_hit_target_bounds(
        main_window: &WebviewWindow,
        desktop_maximize_button_bounds: Option<PapelizDesktopMaximizeButtonBounds>,
    ) {
        let Ok(main_window_hwnd) = main_window.hwnd() else {
            return;
        };
        let hit_target_hwnd = match find_papeliz_desktop_maximize_button_hit_target(main_window_hwnd) {
            Some(hit_target_hwnd) => hit_target_hwnd,
            None if desktop_maximize_button_bounds.is_none() => return,
            None => match create_papeliz_desktop_maximize_button_hit_target(main_window, main_window_hwnd) {
                Some(hit_target_hwnd) => hit_target_hwnd,
                None => return,
            },
        };
        // SAFETY: main thread; the reference ends before the next Win32 call.
        if let Some(hit_target_state) = unsafe { papeliz_desktop_maximize_button_hit_target_state(hit_target_hwnd) } {
            hit_target_state.desktop_maximize_button_bounds = desktop_maximize_button_bounds;
        }
        place_papeliz_desktop_maximize_button_hit_target(hit_target_hwnd);
    }

    fn find_papeliz_desktop_maximize_button_hit_target(main_window_hwnd: HWND) -> Option<HWND> {
        // SAFETY: a lookup among the main window's own children.
        unsafe {
            FindWindowExW(
                Some(main_window_hwnd),
                None,
                PAPELIZ_DESKTOP_MAXIMIZE_BUTTON_HIT_TARGET_WINDOW_CLASS,
                PCWSTR::null(),
            )
        }
        .ok()
    }

    fn create_papeliz_desktop_maximize_button_hit_target(
        main_window: &WebviewWindow,
        main_window_hwnd: HWND,
    ) -> Option<HWND> {
        // SAFETY: plain Win32 window creation on the main thread; the state pointer is owned by the
        // new window from here on and freed in WM_NCDESTROY.
        unsafe {
            let module_instance = HINSTANCE(GetModuleHandleW(None).ok()?.0);
            let hit_target_window_class = WNDCLASSEXW {
                cbSize: std::mem::size_of::<WNDCLASSEXW>() as u32,
                lpfnWndProc: Some(papeliz_desktop_maximize_button_hit_target_window_procedure),
                hInstance: module_instance,
                lpszClassName: PAPELIZ_DESKTOP_MAXIMIZE_BUTTON_HIT_TARGET_WINDOW_CLASS,
                ..Default::default()
            };
            // Registering again after the first time fails harmlessly: the class already exists.
            RegisterClassExW(&hit_target_window_class);
            // A plain child that never paints: the web view's pixels show through it unchanged.
            let hit_target_hwnd = CreateWindowExW(
                WINDOW_EX_STYLE::default(),
                PAPELIZ_DESKTOP_MAXIMIZE_BUTTON_HIT_TARGET_WINDOW_CLASS,
                PCWSTR::null(),
                WS_CHILD | WS_CLIPSIBLINGS,
                0,
                0,
                0,
                0,
                Some(main_window_hwnd),
                None,
                Some(module_instance),
                None,
            )
            .ok()?;
            let hit_target_state = Box::new(PapelizDesktopMaximizeButtonHitTargetState {
                main_window: main_window.clone(),
                main_window_hwnd,
                desktop_maximize_button_bounds: None,
                pointer_flags: PapelizDesktopMaximizeButtonPointerFlags::default(),
            });
            SetWindowLongPtrW(hit_target_hwnd, GWLP_USERDATA, Box::into_raw(hit_target_state) as isize);

            // Windows doesn't move or scale child windows when the main window changes monitor DPI,
            // and the page's CSS bounds stay the same then, so the hit target is placed again here.
            let main_window_hwnd_value = main_window_hwnd.0 as isize;
            main_window.on_window_event(move |window_event| {
                if matches!(window_event, WindowEvent::ScaleFactorChanged { .. }) {
                    let main_window_hwnd = HWND(main_window_hwnd_value as *mut core::ffi::c_void);
                    if let Some(hit_target_hwnd) = find_papeliz_desktop_maximize_button_hit_target(main_window_hwnd) {
                        place_papeliz_desktop_maximize_button_hit_target(hit_target_hwnd);
                    }
                }
            });
            Some(hit_target_hwnd)
        }
    }

    fn place_papeliz_desktop_maximize_button_hit_target(hit_target_hwnd: HWND) {
        // SAFETY: main thread; the values are copied out before any Win32 call.
        let Some(hit_target_state) = (unsafe { papeliz_desktop_maximize_button_hit_target_state(hit_target_hwnd) })
        else {
            return;
        };
        let main_window_hwnd = hit_target_state.main_window_hwnd;
        let desktop_maximize_button_bounds = hit_target_state.desktop_maximize_button_bounds;
        // SAFETY: plain Win32 calls on windows of this thread.
        unsafe {
            let window_scale_factor = papeliz_desktop_window_scale_factor_from_dpi(GetDpiForWindow(main_window_hwnd));
            let Some(physical_rect) = desktop_maximize_button_bounds
                .and_then(|bounds| papeliz_desktop_maximize_button_physical_rect(&bounds, window_scale_factor))
            else {
                let _ = ShowWindow(hit_target_hwnd, SW_HIDE);
                change_papeliz_desktop_maximize_button_pointer_flags(hit_target_hwnd, |pointer_flags| {
                    *pointer_flags = PapelizDesktopMaximizeButtonPointerFlags::default();
                });
                return;
            };
            // Just below Tauri's top-edge resize strip of a frameless window, so the top edge still
            // resizes the window over the button too, and above the web view either way.
            let hit_target_insert_after = FindWindowExW(
                Some(main_window_hwnd),
                None,
                TAURI_UNDECORATED_RESIZE_BORDERS_WINDOW_CLASS,
                PCWSTR::null(),
            )
            .unwrap_or(HWND_TOP);
            let _ = SetWindowPos(
                hit_target_hwnd,
                Some(hit_target_insert_after),
                physical_rect.left,
                physical_rect.top,
                physical_rect.right - physical_rect.left,
                physical_rect.bottom - physical_rect.top,
                SWP_NOACTIVATE | SWP_SHOWWINDOW,
            );
        }
    }

    /// Applies one pointer change and tells the page when its look should change. Returns the
    /// flags from before the change.
    fn change_papeliz_desktop_maximize_button_pointer_flags(
        hit_target_hwnd: HWND,
        apply_pointer_change: impl FnOnce(&mut PapelizDesktopMaximizeButtonPointerFlags),
    ) -> Option<PapelizDesktopMaximizeButtonPointerFlags> {
        // SAFETY: main thread; the reference ends before the event goes out.
        let hit_target_state = unsafe { papeliz_desktop_maximize_button_hit_target_state(hit_target_hwnd) }?;
        let pointer_flags_before_change = hit_target_state.pointer_flags;
        apply_pointer_change(&mut hit_target_state.pointer_flags);
        let pointer_state_after_change = hit_target_state.pointer_flags.pointer_state();
        let main_window = hit_target_state.main_window.clone();
        if pointer_state_after_change != pointer_flags_before_change.pointer_state() {
            let _ = main_window.emit_to(
                main_window.label(),
                PAPELIZ_DESKTOP_MAXIMIZE_BUTTON_POINTER_STATE_EVENT_NAME,
                pointer_state_after_change,
            );
        }
        Some(pointer_flags_before_change)
    }

    /// SAFETY: call on the main thread, and let the reference end before any call that can send
    /// the hit target a message.
    unsafe fn papeliz_desktop_maximize_button_hit_target_state<'hit_target>(
        hit_target_hwnd: HWND,
    ) -> Option<&'hit_target mut PapelizDesktopMaximizeButtonHitTargetState> {
        unsafe {
            (GetWindowLongPtrW(hit_target_hwnd, GWLP_USERDATA) as *mut PapelizDesktopMaximizeButtonHitTargetState)
                .as_mut()
        }
    }

    unsafe extern "system" fn papeliz_desktop_maximize_button_hit_target_window_procedure(
        hit_target_hwnd: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        match message {
            // Windows asks only about points inside this window, which covers just the page's button.
            WM_NCHITTEST => return LRESULT(HTMAXBUTTON as isize),
            WM_ERASEBKGND => return LRESULT(1),
            WM_NCMOUSEMOVE => {
                let pointer_flags_before_change =
                    change_papeliz_desktop_maximize_button_pointer_flags(hit_target_hwnd, |pointer_flags| {
                        pointer_flags.is_maximize_button_hovered = true;
                    });
                if pointer_flags_before_change.is_some_and(|pointer_flags| !pointer_flags.is_maximize_button_hovered) {
                    let mut pointer_leave_tracking = TRACKMOUSEEVENT {
                        cbSize: std::mem::size_of::<TRACKMOUSEEVENT>() as u32,
                        dwFlags: TME_LEAVE | TME_NONCLIENT,
                        hwndTrack: hit_target_hwnd,
                        dwHoverTime: 0,
                    };
                    // SAFETY: the structure lives for the call.
                    let _ = unsafe { TrackMouseEvent(&mut pointer_leave_tracking) };
                }
            }
            WM_NCMOUSELEAVE => {
                change_papeliz_desktop_maximize_button_pointer_flags(hit_target_hwnd, |pointer_flags| {
                    *pointer_flags = PapelizDesktopMaximizeButtonPointerFlags::default();
                });
                return LRESULT(0);
            }
            // Never passed on: Windows' default handling would maximize this child window inside the
            // main window rather than Papeliz's window itself.
            WM_NCLBUTTONDOWN | WM_NCLBUTTONDBLCLK => {
                change_papeliz_desktop_maximize_button_pointer_flags(hit_target_hwnd, |pointer_flags| {
                    pointer_flags.is_maximize_button_pressed = true;
                });
                return LRESULT(0);
            }
            WM_NCLBUTTONUP => {
                let pointer_flags_before_change =
                    change_papeliz_desktop_maximize_button_pointer_flags(hit_target_hwnd, |pointer_flags| {
                        pointer_flags.is_maximize_button_pressed = false;
                    });
                let was_maximize_button_pressed =
                    pointer_flags_before_change.is_some_and(|pointer_flags| pointer_flags.is_maximize_button_pressed);
                // SAFETY: main thread; the value is copied out at once.
                let main_window_hwnd = unsafe { papeliz_desktop_maximize_button_hit_target_state(hit_target_hwnd) }
                    .map(|hit_target_state| hit_target_state.main_window_hwnd);
                if let (true, Some(main_window_hwnd)) = (was_maximize_button_pressed, main_window_hwnd) {
                    // SAFETY: posting to the main window, which handles it after this message returns.
                    unsafe {
                        let maximize_or_restore_command =
                            if IsZoomed(main_window_hwnd).as_bool() { SC_RESTORE } else { SC_MAXIMIZE };
                        let _ = PostMessageW(
                            Some(main_window_hwnd),
                            WM_SYSCOMMAND,
                            WPARAM(maximize_or_restore_command as usize),
                            LPARAM(0),
                        );
                    }
                }
                return LRESULT(0);
            }
            WM_NCDESTROY => {
                // SAFETY: the pointer was made by Box::into_raw in create and is cleared before it is
                // freed, so it is freed once.
                unsafe {
                    let hit_target_state_pointer = GetWindowLongPtrW(hit_target_hwnd, GWLP_USERDATA)
                        as *mut PapelizDesktopMaximizeButtonHitTargetState;
                    if !hit_target_state_pointer.is_null() {
                        SetWindowLongPtrW(hit_target_hwnd, GWLP_USERDATA, 0);
                        drop(Box::from_raw(hit_target_state_pointer));
                    }
                }
            }
            _ => {}
        }
        // SAFETY: the default handling for every other message.
        unsafe { DefWindowProcW(hit_target_hwnd, message, wparam, lparam) }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn papeliz_desktop_maximize_button_bounds_for_test(
        desktop_maximize_button_left: f64,
        desktop_maximize_button_top: f64,
        desktop_maximize_button_width: f64,
        desktop_maximize_button_height: f64,
    ) -> PapelizDesktopMaximizeButtonBounds {
        PapelizDesktopMaximizeButtonBounds {
            desktop_maximize_button_left,
            desktop_maximize_button_top,
            desktop_maximize_button_width,
            desktop_maximize_button_height,
        }
    }

    #[test]
    fn css_bounds_become_the_same_rectangle_at_a_scale_of_one() {
        let bounds = papeliz_desktop_maximize_button_bounds_for_test(1186.0, 0.0, 46.0, 48.0);
        assert_eq!(
            papeliz_desktop_maximize_button_physical_rect(&bounds, 1.0),
            Some(PapelizDesktopMaximizeButtonPhysicalRect { left: 1186, top: 0, right: 1232, bottom: 48 })
        );
    }

    #[test]
    fn css_bounds_scale_with_the_window_and_round_each_edge() {
        let bounds = papeliz_desktop_maximize_button_bounds_for_test(1234.5, 0.0, 46.0, 48.0);
        assert_eq!(
            papeliz_desktop_maximize_button_physical_rect(&bounds, 1.25),
            Some(PapelizDesktopMaximizeButtonPhysicalRect { left: 1543, top: 0, right: 1601, bottom: 60 })
        );
        let bounds = papeliz_desktop_maximize_button_bounds_for_test(1186.0, 0.0, 46.0, 48.0);
        assert_eq!(
            papeliz_desktop_maximize_button_physical_rect(&bounds, 2.0),
            Some(PapelizDesktopMaximizeButtonPhysicalRect { left: 2372, top: 0, right: 2464, bottom: 96 })
        );
    }

    #[test]
    fn neighbouring_buttons_share_an_edge_without_a_gap_or_an_overlap() {
        let minimize_button = papeliz_desktop_maximize_button_bounds_for_test(100.3, 0.0, 46.0, 48.0);
        let maximize_button = papeliz_desktop_maximize_button_bounds_for_test(146.3, 0.0, 46.0, 48.0);
        for window_scale_factor in [1.0, 1.25, 1.5, 1.75, 2.0, 2.25] {
            let minimize_rect = papeliz_desktop_maximize_button_physical_rect(&minimize_button, window_scale_factor);
            let maximize_rect = papeliz_desktop_maximize_button_physical_rect(&maximize_button, window_scale_factor);
            assert_eq!(minimize_rect.map(|rect| rect.right), maximize_rect.map(|rect| rect.left));
        }
    }

    #[test]
    fn unusable_bounds_or_scales_give_no_rectangle() {
        let usable_bounds = papeliz_desktop_maximize_button_bounds_for_test(10.0, 0.0, 46.0, 48.0);
        for unusable_bounds in [
            papeliz_desktop_maximize_button_bounds_for_test(f64::NAN, 0.0, 46.0, 48.0),
            papeliz_desktop_maximize_button_bounds_for_test(10.0, f64::INFINITY, 46.0, 48.0),
            papeliz_desktop_maximize_button_bounds_for_test(10.0, 0.0, 0.0, 48.0),
            papeliz_desktop_maximize_button_bounds_for_test(10.0, 0.0, 46.0, -1.0),
        ] {
            assert!(!are_papeliz_desktop_maximize_button_bounds_usable(&unusable_bounds));
            assert_eq!(papeliz_desktop_maximize_button_physical_rect(&unusable_bounds, 1.0), None);
        }
        assert!(are_papeliz_desktop_maximize_button_bounds_usable(&usable_bounds));
        assert_eq!(papeliz_desktop_maximize_button_physical_rect(&usable_bounds, 0.0), None);
        assert_eq!(papeliz_desktop_maximize_button_physical_rect(&usable_bounds, f64::NAN), None);
        // Thinner than half a physical pixel rounds to nothing, so nothing is placed.
        let sliver_bounds = papeliz_desktop_maximize_button_bounds_for_test(10.0, 0.0, 0.2, 48.0);
        assert_eq!(papeliz_desktop_maximize_button_physical_rect(&sliver_bounds, 1.0), None);
    }

    #[test]
    fn window_dpi_becomes_the_window_scale_factor() {
        assert_eq!(papeliz_desktop_window_scale_factor_from_dpi(96), 1.0);
        assert_eq!(papeliz_desktop_window_scale_factor_from_dpi(120), 1.25);
        assert_eq!(papeliz_desktop_window_scale_factor_from_dpi(144), 1.5);
        assert_eq!(papeliz_desktop_window_scale_factor_from_dpi(192), 2.0);
        // GetDpiForWindow answers 0 for a window it doesn't know: no rectangle is placed then.
        assert_eq!(papeliz_desktop_window_scale_factor_from_dpi(0), 0.0);
    }

    #[test]
    fn the_page_contract_reads_and_writes_the_agreed_names() {
        let bounds: PapelizDesktopMaximizeButtonBounds = serde_json::from_str(
            r#"{"desktopMaximizeButtonLeft":1186,"desktopMaximizeButtonTop":0,"desktopMaximizeButtonWidth":46,"desktopMaximizeButtonHeight":48}"#,
        )
        .expect("the page's bounds object");
        assert_eq!(bounds, papeliz_desktop_maximize_button_bounds_for_test(1186.0, 0.0, 46.0, 48.0));
        assert_eq!(serde_json::to_string(&PapelizDesktopMaximizeButtonPointerState::Idle).unwrap(), r#""idle""#);
        assert_eq!(serde_json::to_string(&PapelizDesktopMaximizeButtonPointerState::Hovered).unwrap(), r#""hovered""#);
        assert_eq!(serde_json::to_string(&PapelizDesktopMaximizeButtonPointerState::Pressed).unwrap(), r#""pressed""#);
        assert_eq!(PAPELIZ_DESKTOP_MAXIMIZE_BUTTON_POINTER_STATE_EVENT_NAME, "papeliz-desktop-maximize-button-pointer-state");
    }
}
