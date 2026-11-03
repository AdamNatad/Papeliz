import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PapelizInMemoryVaultAdapter } from '../vault/papeliz-in-memory-vault-adapter'
import type { PapelizLockedEndToEndVault } from '../vault/papeliz-vault-encryption'
import { PapelizEndToEndVaultUnlockPanel, type PapelizEndToEndVaultUnlockReason } from './papeliz-end-to-end-vault-unlock-panel'
import { PapelizNewVaultEncryptionPart } from './papeliz-new-vault-form'
import type { PapelizNewVaultEncryptionPick } from './papeliz-new-vault-form-rules'
import { PapelizVaultEncryptionChangeDialog, type PapelizVaultEncryptionChange } from './papeliz-vault-encryption-change-dialog'
import { PapelizEndToEndVaultBadge, PapelizVaultLetterTile } from './papeliz-vault-encryption-parts'
import { formatPapelizVaultFileCount, formatPapelizVaultFileCountTitle } from './papeliz-vault-encryption-screen-words'

// The screens for a vault's encryption, as markup: New Vault's Encryption part, Unlock as each way of reaching it shows it, the letter and badge of an End-to-end vault's row,
// and the three dialogs of Settings › Vault › Encryption before anything is typed.

function renderNewVaultEncryptionPart(newVaultEncryptionPick: PapelizNewVaultEncryptionPick): string {
  return renderToStaticMarkup(
    createElement(PapelizNewVaultEncryptionPart, {
      newVaultEncryptionHeadingId: 'test-encryption-heading',
      newVaultEncryptionPick,
      onNewVaultEncryptionKindChoose: () => undefined,
      onNewVaultPassphraseType: () => undefined,
      onNewVaultPassphraseRepeat: () => undefined,
    }),
  )
}

describe('New Vault’s Encryption part', () => {
  it('asks Standard or End-to-end, Standard first, with one line for each and no passphrase yet', () => {
    const standardPartMarkup = renderNewVaultEncryptionPart({ chosenNewVaultEncryptionKind: 'standard', typedNewVaultPassphrase: '', repeatedNewVaultPassphrase: '' })
    expect(standardPartMarkup).toContain('>Encryption</h3>')
    expect(standardPartMarkup).toContain('>Standard<')
    expect(standardPartMarkup).toContain('Plain Markdown files any app can open.')
    expect(standardPartMarkup).toContain('>End-to-end<')
    expect(standardPartMarkup).toContain('Encrypted with a passphrase only you know.')
    expect(standardPartMarkup).toMatch(/checked="" value="standard"/)
    expect(standardPartMarkup).not.toMatch(/checked="" value="end-to-end"/)
    expect(standardPartMarkup).toContain('lucide-file-text')
    // The passphrase waits shut under the tiles, inert, ready to open.
    expect(standardPartMarkup).toMatch(/<div inert=""[^>]*data-papeliz-new-vault-passphrase-part-open="false"[^>]*grid-rows-\[0fr\] opacity-0/)
  })

  it('asks End-to-end’s passphrase in place, twice, with the warning that it can’t be recovered', () => {
    const endToEndPartMarkup = renderNewVaultEncryptionPart({ chosenNewVaultEncryptionKind: 'end-to-end', typedNewVaultPassphrase: '', repeatedNewVaultPassphrase: '' })
    expect(endToEndPartMarkup).toMatch(/checked="" value="end-to-end"/)
    expect(endToEndPartMarkup).toMatch(/data-papeliz-new-vault-passphrase-part-open="true"[^>]*grid-rows-\[1fr\] opacity-100/)
    expect(endToEndPartMarkup).not.toContain('inert=""')
    expect(endToEndPartMarkup).toContain('>Vault passphrase</label>')
    expect(endToEndPartMarkup).toContain('>Type it again</label>')
    expect(endToEndPartMarkup).toContain('At least 12 characters.')
    expect(endToEndPartMarkup).toContain(
      'Keep your passphrase safe, as neither Papeliz nor any third party can reset or recover it. If you lose or forget it, your encrypted data may become permanently inaccessible. Your passphrase works exclusively across Papeliz Apps.',
    )
  })
})

const testLockedEndToEndVault: PapelizLockedEndToEndVault = {
  papelizVaultId: 'test-vault',
  papelizVaultDisplayName: 'My Notes',
  papelizEncryptedVaultId: 'pzvault_testtesttesttesttesttesttes',
  unfinishedVaultEncryptionKindChange: null,
  lockedStoredVaultAdapter: new PapelizInMemoryVaultAdapter([]),
}

function renderUnlockPanel(endToEndVaultUnlockReason: PapelizEndToEndVaultUnlockReason, endToEndVaultUnlockNoticeLine: string | null = null): string {
  return renderToStaticMarkup(
    createElement(PapelizEndToEndVaultUnlockPanel, {
      endToEndVaultUnlockPanelHeadingId: 'test-unlock-heading',
      papelizLockedEndToEndVault: testLockedEndToEndVault,
      endToEndVaultPlaceLine: 'Folder Storage',
      endToEndVaultUnlockReason,
      endToEndVaultUnlockNoticeLine,
      onEndToEndVaultUnlocked: () => undefined,
      onEndToEndVaultUnlockCancel: () => undefined,
    }),
  )
}

describe('Unlock', () => {
  it('names the vault, where it is and its badge, asks the passphrase, and offers Remember on This Device off at first', () => {
    const unlockPanelMarkup = renderUnlockPanel('opened-from-recent-vaults')
    expect(unlockPanelMarkup).toContain('Unlock My Notes</h2>')
    expect(unlockPanelMarkup).toContain('Folder Storage')
    expect(unlockPanelMarkup).toContain('End-to-End Encryption')
    expect(unlockPanelMarkup).toContain('>Passphrase</label>')
    expect(unlockPanelMarkup).toContain('autoComplete="current-password"')
    expect(unlockPanelMarkup).toContain('Remember on This Device')
    expect(unlockPanelMarkup).not.toMatch(/type="checkbox"[^>]*checked=""/)
    expect(unlockPanelMarkup).toContain('This browser then opens it without the passphrase, for anyone who uses it.')
    // Changing the passphrase needs the current one, so a device that remembers the vault can only open it.
    expect(unlockPanelMarkup).toContain('Forgot it? Papeliz can’t recover it. A device that remembers this vault still opens it, so you can copy your notes out there.')
    expect(unlockPanelMarkup).not.toContain('set a new one')
    expect(unlockPanelMarkup).toContain('href="https://papeliz.com/help/end-to-end-vaults/"')
    expect(unlockPanelMarkup).toContain('aria-label="Help: End-to-end vaults"')
    // Unlock waits for a passphrase.
    expect(unlockPanelMarkup).toMatch(/<button type="submit" disabled=""[^>]*>.*Unlock<\/button>/)
  })

  it('says how it came to show: nothing more from a row, the folder found from Open Vault, the vault locked after Lock Now', () => {
    expect(renderUnlockPanel('opened-from-recent-vaults')).not.toContain('is locked')
    expect(renderUnlockPanel('found-by-open-vault')).toContain('This folder is a Papeliz vault, encrypted End-to-end. Enter its passphrase to open it.')
    expect(renderUnlockPanel('locked-now')).toContain('My Notes is locked. Every note was saved, then cleared from memory with the key.')
    expect(renderUnlockPanel('opened-from-recent-vaults', 'The key this device remembered no longer opens it.')).toContain('The key this device remembered no longer opens it.')
  })
})

describe('an End-to-end vault’s row', () => {
  it('has a lock on its letter and the purple badge; a Standard vault’s letter has none', () => {
    expect(renderToStaticMarkup(createElement(PapelizVaultLetterTile, { papelizVaultDisplayName: 'journal', isEndToEndVault: true }))).toContain('lucide-lock')
    expect(renderToStaticMarkup(createElement(PapelizVaultLetterTile, { papelizVaultDisplayName: 'journal', isEndToEndVault: false }))).not.toContain('lucide-lock')
    expect(renderToStaticMarkup(createElement(PapelizVaultLetterTile, { papelizVaultDisplayName: 'journal', isEndToEndVault: false }))).toContain('>J<')
    expect(renderToStaticMarkup(createElement(PapelizEndToEndVaultBadge))).toContain('End-to-End Encryption')
  })
})

function renderEncryptionChangeDialog(vaultEncryptionChange: PapelizVaultEncryptionChange): string {
  return renderToStaticMarkup(
    createElement(PapelizVaultEncryptionChangeDialog, {
      changedOpenVault: { papelizVaultId: 'test-vault', papelizVaultDisplayName: 'My Notes', papelizVaultAdapter: new PapelizInMemoryVaultAdapter([]) },
      vaultEncryptionChange,
      listedVaultFileCount: 3210,
      onVaultEncryptionChangeDialogClose: () => undefined,
    }),
  )
}

describe('Settings › Vault › Encryption’s dialogs', () => {
  it('Change to End-to-end asks the passphrase twice, with both warnings, and counts the files on its button', () => {
    const toEndToEndDialogMarkup = renderEncryptionChangeDialog('to-end-to-end')
    expect(toEndToEndDialogMarkup).toContain('Change My Notes to End-to-end</h2>')
    expect(toEndToEndDialogMarkup).toContain('Papeliz encrypts all 3,210 files in this vault on this device')
    expect(toEndToEndDialogMarkup).toContain('>Vault passphrase</label>')
    expect(toEndToEndDialogMarkup).toContain('>Type it again</label>')
    expect(toEndToEndDialogMarkup).toContain('neither Papeliz nor any third party can reset or recover it.')
    expect(toEndToEndDialogMarkup).toContain('Copies made before stay readable')
    expect(toEndToEndDialogMarkup).toMatch(/disabled=""[^>]*>Encrypt 3,210 Files<\/button>/)
  })

  it('Change to Standard asks the passphrase again, with what other apps will see', () => {
    const toStandardDialogMarkup = renderEncryptionChangeDialog('to-standard')
    expect(toStandardDialogMarkup).toContain('Change My Notes to Standard</h2>')
    expect(toStandardDialogMarkup).toContain('back to plain Markdown')
    expect(toStandardDialogMarkup).toContain('>Enter the passphrase to go on</label>')
    expect(toStandardDialogMarkup).not.toContain('Type it again')
    expect(toStandardDialogMarkup).toContain('The key remembered on this device is dropped.')
    expect(toStandardDialogMarkup).toMatch(/disabled=""[^>]*>Decrypt 3,210 Files<\/button>/)
  })

  it('Change Passphrase asks the current one and the new one twice, and rewrites no file', () => {
    const passphraseDialogMarkup = renderEncryptionChangeDialog('change-passphrase')
    expect(passphraseDialogMarkup).toContain('Change Passphrase</h2>')
    expect(passphraseDialogMarkup).toContain('so no file is rewritten')
    expect(passphraseDialogMarkup).toContain('>Current passphrase</label>')
    expect(passphraseDialogMarkup).toContain('>New passphrase</label>')
    expect(passphraseDialogMarkup).toContain('>Type it again</label>')
  })

  it('counts files as the screens say them', () => {
    expect(formatPapelizVaultFileCount(3210)).toBe('3,210 files')
    expect(formatPapelizVaultFileCount(1)).toBe('1 file')
    expect(formatPapelizVaultFileCountTitle(3210)).toBe('3,210 Files')
    expect(formatPapelizVaultFileCountTitle(1)).toBe('1 File')
  })
})
