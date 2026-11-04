// The phone's own save screen for exports and backups: Android's Create Document, through the Storage
// Access Framework plugin. The page hands over the built file; the screen opens here with its name and
// type filled in, and the file is written where the person picks. The page never gets the picked
// file's address, so it can write only the one file the person has just chosen.

use serde::Deserialize;
use tauri::{AppHandle, Runtime};

// Files the save screen makes in Android's Downloads, its first place, have addresses that start so.
#[cfg(any(target_os = "android", test))]
const ANDROID_DOWNLOADS_DOCUMENT_URI_START: &str = "content://com.android.providers.downloads.documents/";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PapelizMobileExportFileSaveRequest {
    suggested_mobile_file_name: String,
    mobile_file_media_type: String,
    // The file's bytes as base64 text. Android's web view hands every call to the app as JSON, where
    // raw bytes would become a list of numbers, about four characters a byte; base64 takes one and a
    // third.
    mobile_file_base64_text: String,
}

// True once the file is written where the person picked; false when they close the save screen.
#[tauri::command]
pub async fn save_papeliz_mobile_export_file<R: Runtime>(
    app_handle: AppHandle<R>,
    mobile_export_file_save_request: PapelizMobileExportFileSaveRequest,
) -> Result<bool, String> {
    let mobile_file_bytes = decode_papeliz_mobile_base64_text(&mobile_export_file_save_request.mobile_file_base64_text)?;
    save_papeliz_mobile_file_with_save_screen(
        &app_handle,
        &mobile_export_file_save_request.suggested_mobile_file_name,
        &mobile_export_file_save_request.mobile_file_media_type,
        mobile_file_bytes,
    )
    .await
}

#[cfg(target_os = "android")]
async fn save_papeliz_mobile_file_with_save_screen<R: Runtime>(
    app_handle: &AppHandle<R>,
    suggested_mobile_file_name: &str,
    mobile_file_media_type: &str,
    mobile_file_bytes: Vec<u8>,
) -> Result<bool, String> {
    use tauri_plugin_android_fs::{AndroidFsExt, FileAccessMode};

    let android_file_system = app_handle.android_fs_async();
    // Any place the screen offers, the phone's own folders or a cloud drive's.
    let chosen_mobile_file_uri = android_file_system
        .picker()
        .save_file(None, suggested_mobile_file_name, Some(mobile_file_media_type), false)
        .await
        .map_err(|save_screen_error| save_screen_error.to_string())?;
    let Some(chosen_mobile_file_uri) = chosen_mobile_file_uri else {
        return Ok(false);
    };
    android_file_system
        .write(&chosen_mobile_file_uri, mobile_file_bytes)
        .await
        .map_err(|file_write_error| file_write_error.to_string())?;
    // Downloads notes a file's size when the app lets go of it, and handing the picked file to Rust
    // counts as letting go before its first byte, so the phone's Files would list the export as 0 B.
    // Opening it once more to add nothing, then closing it, has Downloads note the finished size.
    // The file is already whole, so a refused reopen leaves only the listed size behind.
    if is_android_downloads_document_uri(&chosen_mobile_file_uri.uri) {
        let _ = android_file_system.open_file(&chosen_mobile_file_uri, FileAccessMode::WriteAppend).await;
    }
    Ok(true)
}

#[cfg(any(target_os = "android", test))]
fn is_android_downloads_document_uri(mobile_file_uri: &str) -> bool {
    mobile_file_uri.starts_with(ANDROID_DOWNLOADS_DOCUMENT_URI_START)
}

// The iPhone's save screen comes with the iOS app; this computer's run of the app (main.rs) has none.
#[cfg(not(target_os = "android"))]
async fn save_papeliz_mobile_file_with_save_screen<R: Runtime>(
    _app_handle: &AppHandle<R>,
    _suggested_mobile_file_name: &str,
    _mobile_file_media_type: &str,
    _mobile_file_bytes: Vec<u8>,
) -> Result<bool, String> {
    Err("Saving a file through the phone's save screen works only on Android for now.".to_string())
}

// Standard base64 (A–Z, a–z, 0–9, + and /), with or without its closing = padding, as the page's
// FileReader writes it.
fn decode_papeliz_mobile_base64_text(base64_text: &str) -> Result<Vec<u8>, String> {
    let unpadded_base64_text = base64_text.trim_end_matches('=');
    let mut decoded_bytes = Vec::with_capacity(unpadded_base64_text.len() / 4 * 3 + 3);
    let mut pending_bits: u32 = 0;
    let mut pending_bit_count: u32 = 0;
    for base64_character in unpadded_base64_text.bytes() {
        let six_bit_value = match base64_character {
            b'A'..=b'Z' => base64_character - b'A',
            b'a'..=b'z' => base64_character - b'a' + 26,
            b'0'..=b'9' => base64_character - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            _ => return Err("The file to save arrived damaged. Try again.".to_string()),
        };
        pending_bits = (pending_bits << 6) | u32::from(six_bit_value);
        pending_bit_count += 6;
        if pending_bit_count >= 8 {
            pending_bit_count -= 8;
            decoded_bytes.push((pending_bits >> pending_bit_count) as u8);
        }
    }
    Ok(decoded_bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base64_text_decodes_to_the_same_bytes_with_or_without_padding() {
        assert_eq!(decode_papeliz_mobile_base64_text("").unwrap(), b"");
        assert_eq!(decode_papeliz_mobile_base64_text("TQ==").unwrap(), b"M");
        assert_eq!(decode_papeliz_mobile_base64_text("TWE=").unwrap(), b"Ma");
        assert_eq!(decode_papeliz_mobile_base64_text("TWFu").unwrap(), b"Man");
        assert_eq!(decode_papeliz_mobile_base64_text("JVBERi0xLjc=").unwrap(), b"%PDF-1.7");
        assert_eq!(decode_papeliz_mobile_base64_text("JVBERi0xLjc").unwrap(), b"%PDF-1.7");
        assert_eq!(decode_papeliz_mobile_base64_text("AP8Q/+8=").unwrap(), [0x00, 0xff, 0x10, 0xff, 0xef]);
    }

    #[test]
    fn only_a_file_in_android_downloads_is_reopened_for_its_size() {
        assert!(is_android_downloads_document_uri("content://com.android.providers.downloads.documents/document/msf%3A19"));
        assert!(!is_android_downloads_document_uri(
            "content://com.android.externalstorage.documents/document/primary%3ADocuments%2FNotes.pdf"
        ));
        assert!(!is_android_downloads_document_uri("content://com.google.android.apps.docs.storage/document/acc%3D1"));
    }

    #[test]
    fn base64_text_with_any_other_character_is_refused() {
        assert!(decode_papeliz_mobile_base64_text("TW Fu").is_err());
        assert!(decode_papeliz_mobile_base64_text("data:,TWFu").is_err());
    }
}
