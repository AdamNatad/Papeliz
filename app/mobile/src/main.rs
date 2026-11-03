// Phones start the app from the library's mobile entry point (lib.rs); this binary only lets the same
// shell run on this computer while it is built and checked.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    papeliz_mobile_lib::run_papeliz_mobile_app()
}
