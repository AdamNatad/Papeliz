// A release build opens no console window beside Papeliz on Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    papeliz_desktop_lib::run_papeliz_desktop_app()
}
