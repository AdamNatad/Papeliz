// How this copy of Papeliz reached the computer: the direct download (the NSIS installer from GitHub
// Releases), which updates itself with Tauri's updater, or the Microsoft Store package (MSIX), which
// only the Store updates. A Store copy runs with a package identity; a direct download has none.

#[derive(Clone, Copy, PartialEq, Eq, Debug, serde::Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PapelizDesktopAppDistribution {
    DirectDownload,
    MicrosoftStore,
}

#[cfg(target_os = "windows")]
pub fn detect_papeliz_desktop_app_distribution() -> PapelizDesktopAppDistribution {
    // Windows' own answer: GetCurrentPackageFullName fails with APPMODEL_ERROR_NO_PACKAGE when the
    // process has no package identity.
    const APPMODEL_ERROR_NO_PACKAGE: i32 = 15700;
    #[link(name = "kernel32")]
    extern "system" {
        fn GetCurrentPackageFullName(package_full_name_length: *mut u32, package_full_name: *mut u16) -> i32;
    }
    let mut package_full_name_length: u32 = 0;
    // SAFETY: a zero length with a null buffer only asks for the length the name needs.
    let package_lookup_result =
        unsafe { GetCurrentPackageFullName(&mut package_full_name_length, std::ptr::null_mut()) };
    if package_lookup_result == APPMODEL_ERROR_NO_PACKAGE {
        PapelizDesktopAppDistribution::DirectDownload
    } else {
        PapelizDesktopAppDistribution::MicrosoftStore
    }
}

#[cfg(not(target_os = "windows"))]
pub fn detect_papeliz_desktop_app_distribution() -> PapelizDesktopAppDistribution {
    PapelizDesktopAppDistribution::DirectDownload
}

#[tauri::command]
pub fn get_papeliz_desktop_app_distribution() -> PapelizDesktopAppDistribution {
    detect_papeliz_desktop_app_distribution()
}
