import { describe, expect, it } from 'vitest'
import { classifyVaultFileByName, isVaultFileSampleBytesPlainText, isVaultJsonFileName } from './papeliz-vault-text-files'

const encodeVaultFileSampleText = (vaultFileSampleText: string) => new TextEncoder().encode(vaultFileSampleText)

describe('which files are text', () => {
  it('knows notes, text files and pictures by name, and leaves the rest to their bytes', () => {
    expect(classifyVaultFileByName('Inbox.md')).toBe('vault-note')
    for (const vaultTextFileName of ['settings.json', 'config.YAML', 'pyproject.toml', 'notes.txt', 'deploy.sh', 'build.ps1', 'tool.py', 'index.ts', '.gitignore', 'LICENSE', 'Dockerfile']) {
      expect(classifyVaultFileByName(vaultTextFileName), vaultTextFileName).toBe('vault-text-file')
    }
    for (const vaultOtherFileName of ['sketch.png', 'logo.svg', 'photo.JPEG', 'manual.pdf', 'backup.zip', 'font.woff2', 'tool.exe']) {
      expect(classifyVaultFileByName(vaultOtherFileName), vaultOtherFileName).toBe('vault-other-file')
    }
    for (const vaultUnknownFileName of ['.env.example', 'data.unknown', 'NOTES', '.weirdrc']) {
      expect(classifyVaultFileByName(vaultUnknownFileName), vaultUnknownFileName).toBe('vault-file-needing-byte-check')
    }
  })

  it('reads a file as text when its first bytes are UTF-8 with no zero byte and few control characters', () => {
    expect(isVaultFileSampleBytesPlainText(encodeVaultFileSampleText('API_KEY=\nDEBUG=false\n'))).toBe(true)
    expect(isVaultFileSampleBytesPlainText(encodeVaultFileSampleText('Grüße, 日本語, emoji 🌱\ttab\r\n\u001b[32mgreen\u001b[0m'))).toBe(true)
    expect(isVaultFileSampleBytesPlainText(new Uint8Array())).toBe(true)
    // A character cut off where the sample ends is still text.
    expect(isVaultFileSampleBytesPlainText(encodeVaultFileSampleText('naïve 日本').slice(0, -1))).toBe(true)
    expect(isVaultFileSampleBytesPlainText(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]))).toBe(false)
    expect(isVaultFileSampleBytesPlainText(encodeVaultFileSampleText('text\u0000with a zero byte'))).toBe(false)
    expect(isVaultFileSampleBytesPlainText(new Uint8Array([0x68, 0x69, 0xff, 0xfe, 0x68, 0x69]))).toBe(false)
    expect(isVaultFileSampleBytesPlainText(encodeVaultFileSampleText(`${'\u0001\u0002\u0003'.repeat(5)}mostly control bytes`))).toBe(false)
  })

  it('treats only .json as JSON; JSON with comments opens as plain text', () => {
    expect(isVaultJsonFileName('settings.json')).toBe(true)
    expect(isVaultJsonFileName('PACKAGE.JSON')).toBe(true)
    expect(isVaultJsonFileName('tsconfig.jsonc')).toBe(false)
    expect(isVaultJsonFileName('.json')).toBe(false)
    expect(isVaultJsonFileName('settings.json.bak')).toBe(false)
  })
})
