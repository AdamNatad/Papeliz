// An End-to-end vault's key, remembered on this device when the person turns on Remember on This Device.
// On Windows it is a generic credential in Windows Credential Manager, kept for this user on this computer
// and never roamed to another one: the credential's name names the vault, and the key's bytes are its
// secret. Nothing here logs a key, and no error names the vault.

const PAPELIZ_DESKTOP_VAULT_ENCRYPTION_KEY_CREDENTIAL_NAME_PREFIX: &str = "Papeliz/vault-encryption-key/";

// A vault id is a UUID; anything longer, or with other characters, is refused, so the page can name
// only credentials of this one pattern.
const PAPELIZ_DESKTOP_VAULT_ID_MAXIMUM_LENGTH: usize = 128;

// Credential Manager's limit for a credential's secret (CRED_MAX_CREDENTIAL_BLOB_SIZE).
const PAPELIZ_DESKTOP_VAULT_ENCRYPTION_KEY_MAXIMUM_BYTE_COUNT: usize = 2560;

fn papeliz_desktop_vault_encryption_key_credential_name(papeliz_vault_id: &str) -> Result<String, String> {
    let is_papeliz_vault_id_usable = !papeliz_vault_id.is_empty()
        && papeliz_vault_id.len() <= PAPELIZ_DESKTOP_VAULT_ID_MAXIMUM_LENGTH
        && papeliz_vault_id
            .chars()
            .all(|vault_id_character| vault_id_character.is_ascii_alphanumeric() || vault_id_character == '-' || vault_id_character == '_');
    if !is_papeliz_vault_id_usable {
        return Err("A vault id is 1 to 128 letters, digits, hyphens or underscores.".into());
    }
    Ok(format!("{PAPELIZ_DESKTOP_VAULT_ENCRYPTION_KEY_CREDENTIAL_NAME_PREFIX}{papeliz_vault_id}"))
}

fn check_papeliz_desktop_vault_encryption_key_byte_count(vault_encryption_key_bytes: &[u8]) -> Result<(), String> {
    if vault_encryption_key_bytes.is_empty()
        || vault_encryption_key_bytes.len() > PAPELIZ_DESKTOP_VAULT_ENCRYPTION_KEY_MAXIMUM_BYTE_COUNT
    {
        return Err("A vault key is 1 to 2560 bytes.".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn remember_papeliz_desktop_vault_encryption_key(
    papeliz_vault_id: String,
    vault_encryption_key_bytes: Vec<u8>,
) -> Result<(), String> {
    let vault_encryption_key_credential_name = papeliz_desktop_vault_encryption_key_credential_name(&papeliz_vault_id)?;
    check_papeliz_desktop_vault_encryption_key_byte_count(&vault_encryption_key_bytes)?;
    papeliz_desktop_vault_encryption_key_credentials::write_vault_encryption_key_credential(
        &vault_encryption_key_credential_name,
        &vault_encryption_key_bytes,
    )
}

// Null when this device remembers no key for the vault.
#[tauri::command]
pub async fn read_remembered_papeliz_desktop_vault_encryption_key(papeliz_vault_id: String) -> Result<Option<Vec<u8>>, String> {
    let vault_encryption_key_credential_name = papeliz_desktop_vault_encryption_key_credential_name(&papeliz_vault_id)?;
    papeliz_desktop_vault_encryption_key_credentials::read_vault_encryption_key_credential(&vault_encryption_key_credential_name)
}

// Forgetting a key this device doesn't remember does nothing.
#[tauri::command]
pub async fn forget_remembered_papeliz_desktop_vault_encryption_key(papeliz_vault_id: String) -> Result<(), String> {
    let vault_encryption_key_credential_name = papeliz_desktop_vault_encryption_key_credential_name(&papeliz_vault_id)?;
    papeliz_desktop_vault_encryption_key_credentials::delete_vault_encryption_key_credential(&vault_encryption_key_credential_name)
}

#[cfg(target_os = "windows")]
mod papeliz_desktop_vault_encryption_key_credentials {
    use windows::core::{PCWSTR, PWSTR};
    use windows::Win32::Foundation::ERROR_NOT_FOUND;
    use windows::Win32::Security::Credentials::{
        CredDeleteW, CredFree, CredReadW, CredWriteW, CREDENTIALW, CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC,
    };

    fn wide_null_terminated(credential_name: &str) -> Vec<u16> {
        credential_name.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn is_missing_credential_error(credential_error: &windows::core::Error) -> bool {
        credential_error.code() == ERROR_NOT_FOUND.to_hresult()
    }

    // The message carries Windows' error code only, never the credential's name or secret.
    fn credential_failure_message(credential_action: &str, credential_error: &windows::core::Error) -> String {
        format!("Windows Credential Manager couldn't {credential_action} the vault key (error {:#010x}).", credential_error.code().0)
    }

    pub(super) fn write_vault_encryption_key_credential(credential_name: &str, vault_encryption_key_bytes: &[u8]) -> Result<(), String> {
        let mut wide_credential_name = wide_null_terminated(credential_name);
        let vault_encryption_key_credential = CREDENTIALW {
            Type: CRED_TYPE_GENERIC,
            TargetName: PWSTR(wide_credential_name.as_mut_ptr()),
            // At most PAPELIZ_DESKTOP_VAULT_ENCRYPTION_KEY_MAXIMUM_BYTE_COUNT, checked before this call.
            CredentialBlobSize: vault_encryption_key_bytes.len() as u32,
            // Windows only reads the secret.
            CredentialBlob: vault_encryption_key_bytes.as_ptr().cast_mut(),
            Persist: CRED_PERSIST_LOCAL_MACHINE,
            ..Default::default()
        };
        // SAFETY: the name and the secret outlive the call, which copies both. Writing a name that exists
        // replaces its secret.
        unsafe { CredWriteW(&vault_encryption_key_credential, 0) }
            .map_err(|credential_error| credential_failure_message("keep", &credential_error))
    }

    pub(super) fn read_vault_encryption_key_credential(credential_name: &str) -> Result<Option<Vec<u8>>, String> {
        let wide_credential_name = wide_null_terminated(credential_name);
        let mut read_credential: *mut CREDENTIALW = std::ptr::null_mut();
        // SAFETY: the name is null-terminated and outlives the call; on success Windows hands back a
        // credential that is freed below with CredFree.
        let credential_read_result =
            unsafe { CredReadW(PCWSTR(wide_credential_name.as_ptr()), CRED_TYPE_GENERIC, None, &mut read_credential) };
        match credential_read_result {
            Err(credential_error) if is_missing_credential_error(&credential_error) => Ok(None),
            Err(credential_error) => Err(credential_failure_message("read", &credential_error)),
            Ok(()) => {
                // SAFETY: CredReadW succeeded, so the credential and its secret are Windows' until CredFree.
                let vault_encryption_key_bytes = unsafe {
                    let read_credential_fields = &*read_credential;
                    let vault_encryption_key_bytes = if read_credential_fields.CredentialBlob.is_null() {
                        Vec::new()
                    } else {
                        std::slice::from_raw_parts(read_credential_fields.CredentialBlob, read_credential_fields.CredentialBlobSize as usize)
                            .to_vec()
                    };
                    CredFree(read_credential.cast());
                    vault_encryption_key_bytes
                };
                // A credential of this name with no secret isn't a key Papeliz kept.
                Ok(Some(vault_encryption_key_bytes).filter(|vault_encryption_key_bytes| !vault_encryption_key_bytes.is_empty()))
            }
        }
    }

    pub(super) fn delete_vault_encryption_key_credential(credential_name: &str) -> Result<(), String> {
        let wide_credential_name = wide_null_terminated(credential_name);
        // SAFETY: the name is null-terminated and outlives the call.
        match unsafe { CredDeleteW(PCWSTR(wide_credential_name.as_ptr()), CRED_TYPE_GENERIC, None) } {
            Err(credential_error) if is_missing_credential_error(&credential_error) => Ok(()),
            credential_delete_result => {
                credential_delete_result.map_err(|credential_error| credential_failure_message("forget", &credential_error))
            }
        }
    }
}

// Only Windows keeps a vault key for now.
#[cfg(not(target_os = "windows"))]
mod papeliz_desktop_vault_encryption_key_credentials {
    const PAPELIZ_DESKTOP_VAULT_ENCRYPTION_KEY_STORE_MISSING_MESSAGE: &str =
        "This system has no place for Papeliz to remember a vault key yet.";

    pub(super) fn write_vault_encryption_key_credential(_credential_name: &str, _vault_encryption_key_bytes: &[u8]) -> Result<(), String> {
        Err(PAPELIZ_DESKTOP_VAULT_ENCRYPTION_KEY_STORE_MISSING_MESSAGE.into())
    }

    pub(super) fn read_vault_encryption_key_credential(_credential_name: &str) -> Result<Option<Vec<u8>>, String> {
        Err(PAPELIZ_DESKTOP_VAULT_ENCRYPTION_KEY_STORE_MISSING_MESSAGE.into())
    }

    pub(super) fn delete_vault_encryption_key_credential(_credential_name: &str) -> Result<(), String> {
        Err(PAPELIZ_DESKTOP_VAULT_ENCRYPTION_KEY_STORE_MISSING_MESSAGE.into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Read and forgotten only, never written: no test leaves a credential behind.
    #[cfg(target_os = "windows")]
    const PAPELIZ_DESKTOP_VAULT_ID_NO_TEST_REMEMBERS: &str = "papeliz-desktop-test-vault-never-remembered-0b8f1c2e";

    #[test]
    fn the_credential_name_is_papeliz_vault_key_and_the_vault_id() {
        assert_eq!(
            papeliz_desktop_vault_encryption_key_credential_name("5f0c1e2a-7d3b-4c9e-8a61-2b4d6f8e0a13"),
            Ok("Papeliz/vault-encryption-key/5f0c1e2a-7d3b-4c9e-8a61-2b4d6f8e0a13".to_string())
        );
    }

    #[test]
    fn a_vault_id_that_could_name_another_credential_is_refused() {
        for unusable_papeliz_vault_id in ["", "../other", "vault/inner", "vault*", "vault id", "vault\0id", "é"] {
            assert!(papeliz_desktop_vault_encryption_key_credential_name(unusable_papeliz_vault_id).is_err());
        }
        assert!(papeliz_desktop_vault_encryption_key_credential_name(&"a".repeat(PAPELIZ_DESKTOP_VAULT_ID_MAXIMUM_LENGTH)).is_ok());
        assert!(papeliz_desktop_vault_encryption_key_credential_name(&"a".repeat(PAPELIZ_DESKTOP_VAULT_ID_MAXIMUM_LENGTH + 1)).is_err());
    }

    #[test]
    fn a_vault_key_is_between_1_and_2560_bytes() {
        assert!(check_papeliz_desktop_vault_encryption_key_byte_count(&[]).is_err());
        assert!(check_papeliz_desktop_vault_encryption_key_byte_count(&[7; 32]).is_ok());
        assert!(check_papeliz_desktop_vault_encryption_key_byte_count(&[7; PAPELIZ_DESKTOP_VAULT_ENCRYPTION_KEY_MAXIMUM_BYTE_COUNT]).is_ok());
        assert!(check_papeliz_desktop_vault_encryption_key_byte_count(&[7; PAPELIZ_DESKTOP_VAULT_ENCRYPTION_KEY_MAXIMUM_BYTE_COUNT + 1]).is_err());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn a_vault_key_this_device_never_remembered_reads_as_none() {
        let vault_encryption_key_credential_name =
            papeliz_desktop_vault_encryption_key_credential_name(PAPELIZ_DESKTOP_VAULT_ID_NO_TEST_REMEMBERS).unwrap();
        assert_eq!(
            papeliz_desktop_vault_encryption_key_credentials::read_vault_encryption_key_credential(&vault_encryption_key_credential_name),
            Ok(None)
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn forgetting_a_vault_key_this_device_never_remembered_does_nothing() {
        let vault_encryption_key_credential_name =
            papeliz_desktop_vault_encryption_key_credential_name(PAPELIZ_DESKTOP_VAULT_ID_NO_TEST_REMEMBERS).unwrap();
        assert_eq!(
            papeliz_desktop_vault_encryption_key_credentials::delete_vault_encryption_key_credential(&vault_encryption_key_credential_name),
            Ok(())
        );
    }
}
