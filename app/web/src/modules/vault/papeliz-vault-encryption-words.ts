// What people read when vault encryption fails, one sentence per code (the codes are listed with
// `PapelizVaultEncryptionFailureCode` in papeliz-vault-encryption.ts). The screens show these and never
// write their own; any other code is a vault code with its sentence in papeliz-failure-code-words.ts.

const papelizVaultEncryptionFailureSentencesByCode: Readonly<Record<string, string>> = {
  'Passphrase Too Short': 'The passphrase needs 12 characters or more.',
  'Passphrases Differ': 'The two passphrases don’t match. Type the same passphrase in both.',
  'Encryption Settings Damaged':
    'This vault’s encryption file, .papeliz/vault-encryption.json, was changed or damaged, so Papeliz can’t open the vault. Put the file back from a backup, then try again.',
  'Made By Newer Papeliz': 'A newer version of Papeliz encrypted this vault. Update Papeliz, then open it again.',
  'Encrypted File Damaged': 'This file was changed or damaged outside Papeliz, so it no longer opens with the vault’s key.',
  'Remembered Key Wrong': 'The key this device remembered no longer opens this vault, so it was forgotten. Type the passphrase to unlock it.',
  'Remember Not Available': 'Papeliz couldn’t keep the key on this device, as in a private window, so it will ask for the passphrase next time.',
  'Vault Locked': 'The vault is locked. Unlock it, then try again.',
  'Vault Not Empty': 'This vault already holds notes. Change it to End-to-end in Settings › Vault › Encryption instead.',
  'Already End-to-end': 'This vault is already End-to-end.',
  'Already Standard': 'This vault is already Standard.',
  'Encryption Not Supported': 'This vault can’t be encrypted. Make a vault of your own in a folder or in Browser Storage for that.',
  'Plain Write Refused': 'This vault is End-to-end, and Papeliz won’t write plain files into it. Unlock it first.',
  'Kind Change Stopped': 'The change stopped before it finished. What was done is kept, and it carries on when you try again.',
}

export function describePapelizVaultEncryptionFailureCode(vaultEncryptionFailureCode: string): string | null {
  return papelizVaultEncryptionFailureSentencesByCode[vaultEncryptionFailureCode] ?? null
}

// "Couldn’t open “My Notes”. This vault’s encryption file …"; a code without a sentence here gets the
// headline alone, for the caller's own words to follow.
export function describePapelizVaultEncryptionFailureMessage(failureHeadline: string, vaultEncryptionFailureCode: string): string {
  const vaultEncryptionFailureSentence = describePapelizVaultEncryptionFailureCode(vaultEncryptionFailureCode)
  return vaultEncryptionFailureSentence === null ? `${failureHeadline}.` : `${failureHeadline}. ${vaultEncryptionFailureSentence}`
}

export function describePapelizWrongVaultPassphrase(papelizVaultDisplayName: string): string {
  return `That passphrase doesn’t open ${papelizVaultDisplayName}.`
}
