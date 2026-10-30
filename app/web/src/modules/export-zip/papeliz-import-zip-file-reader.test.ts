import { describe, expect, it } from 'vitest'
import { writePapelizExportZipFile } from './papeliz-export-zip-file-writer'
import {
  decodePapelizCp437Bytes,
  normalizePapelizImportZipEntryPath,
  readPapelizImportZipFile,
  type PapelizImportZipEntry,
} from './papeliz-import-zip-file-reader'

const utf8Encoder = new TextEncoder()
const utf8Decoder = new TextDecoder()

async function writeTestZipBytes(zipEntryTextsByPath: Record<string, string>): Promise<Uint8Array> {
  const zipFileBlob = await writePapelizExportZipFile(
    Object.entries(zipEntryTextsByPath).map(([zipEntryPath, zipEntryText]) => ({ zipEntryPath, zipEntryBytes: utf8Encoder.encode(zipEntryText) })),
    { zipEntryModifiedDate: new Date(2026, 9, 30, 14, 41) },
  )
  return new Uint8Array(await zipFileBlob.arrayBuffer())
}

async function readAllImportZipEntryTexts(importZipEntries: readonly PapelizImportZipEntry[]): Promise<Record<string, string>> {
  const importZipEntryTextsByPath: Record<string, string> = {}
  for (const importZipEntry of importZipEntries) importZipEntryTextsByPath[importZipEntry.importZipEntryPath] = utf8Decoder.decode(await importZipEntry.readImportZipEntryBytes())
  return importZipEntryTextsByPath
}

// A zip of one entry written by hand: the name's bytes as given, stored, with chosen flags.
function writeHandMadeZipBytes(zipEntryNameBytes: Uint8Array, zipEntryFlags: number, zipEntryBytes: Uint8Array = new Uint8Array(0)): Uint8Array {
  const localHeaderBytes = new Uint8Array(30 + zipEntryNameBytes.length)
  const localHeaderView = new DataView(localHeaderBytes.buffer)
  localHeaderView.setUint32(0, 0x04034b50, true)
  localHeaderView.setUint16(6, zipEntryFlags, true)
  localHeaderView.setUint32(18, zipEntryBytes.length, true)
  localHeaderView.setUint32(22, zipEntryBytes.length, true)
  localHeaderView.setUint16(26, zipEntryNameBytes.length, true)
  localHeaderBytes.set(zipEntryNameBytes, 30)
  const centralDirectoryBytes = new Uint8Array(46 + zipEntryNameBytes.length)
  const centralDirectoryView = new DataView(centralDirectoryBytes.buffer)
  centralDirectoryView.setUint32(0, 0x02014b50, true)
  centralDirectoryView.setUint16(8, zipEntryFlags, true)
  centralDirectoryView.setUint32(20, zipEntryBytes.length, true)
  centralDirectoryView.setUint32(24, zipEntryBytes.length, true)
  centralDirectoryView.setUint16(28, zipEntryNameBytes.length, true)
  centralDirectoryBytes.set(zipEntryNameBytes, 46)
  const endOfCentralDirectoryBytes = new Uint8Array(22)
  const endOfCentralDirectoryView = new DataView(endOfCentralDirectoryBytes.buffer)
  endOfCentralDirectoryView.setUint32(0, 0x06054b50, true)
  endOfCentralDirectoryView.setUint16(8, 1, true)
  endOfCentralDirectoryView.setUint16(10, 1, true)
  endOfCentralDirectoryView.setUint32(12, centralDirectoryBytes.length, true)
  endOfCentralDirectoryView.setUint32(16, localHeaderBytes.length + zipEntryBytes.length, true)
  const handMadeZipBytes = new Uint8Array(localHeaderBytes.length + zipEntryBytes.length + centralDirectoryBytes.length + endOfCentralDirectoryBytes.length)
  handMadeZipBytes.set(localHeaderBytes, 0)
  handMadeZipBytes.set(zipEntryBytes, localHeaderBytes.length)
  handMadeZipBytes.set(centralDirectoryBytes, localHeaderBytes.length + zipEntryBytes.length)
  handMadeZipBytes.set(endOfCentralDirectoryBytes, localHeaderBytes.length + zipEntryBytes.length + centralDirectoryBytes.length)
  return handMadeZipBytes
}

describe('reading a zip to import', () => {
  it('reads back what Papeliz’s own zip writer wrote, stored and deflated, with UTF-8 names', async () => {
    const zipEntryTextsByPath = {
      'Field Notes/Inbox.md': '# Inbox\n\n' + 'kale '.repeat(200),
      'Field Notes/Ideas/Café.md': '# Café',
      'Field Notes/attachments/a.txt': 'x',
    }
    const { importZipEntries, skippedUnsafeZipEntryCount } = readPapelizImportZipFile(await writeTestZipBytes(zipEntryTextsByPath))
    expect(skippedUnsafeZipEntryCount).toBe(0)
    expect(importZipEntries.map((importZipEntry) => [importZipEntry.importZipEntryPath, importZipEntry.isImportZipEntryFolder])).toEqual([
      ['Field Notes/Inbox.md', false],
      ['Field Notes/Ideas/Café.md', false],
      ['Field Notes/attachments/a.txt', false],
    ])
    expect(await readAllImportZipEntryTexts(importZipEntries)).toEqual(zipEntryTextsByPath)
  })

  it('reads an old name in the DOS code page, and a UTF-8 name a zip forgot to flag', () => {
    expect(decodePapelizCp437Bytes(new Uint8Array([0x43, 0x61, 0x66, 0x82, 0x2e, 0x6d, 0x64]))).toBe('Café.md')
    const cp437ZipBytes = writeHandMadeZipBytes(new Uint8Array([0x43, 0x61, 0x66, 0x82, 0x2e, 0x6d, 0x64]), 0)
    expect(readPapelizImportZipFile(cp437ZipBytes).importZipEntries[0]?.importZipEntryPath).toBe('Café.md')
    const unflaggedUtf8ZipBytes = writeHandMadeZipBytes(utf8Encoder.encode('Ñandú.md'), 0)
    expect(readPapelizImportZipFile(unflaggedUtf8ZipBytes).importZipEntries[0]?.importZipEntryPath).toBe('Ñandú.md')
  })

  it('has the whole upper half of the DOS code page', () => {
    expect(decodePapelizCp437Bytes(new Uint8Array(Array.from({ length: 128 }, (_, byteIndex) => 128 + byteIndex)))).toHaveLength(128)
  })

  it('skips paths that would leave the vault, and keeps folder entries', () => {
    expect(normalizePapelizImportZipEntryPath('Ideas\\Deep/Notes.md')).toBe('Ideas/Deep/Notes.md')
    expect(normalizePapelizImportZipEntryPath('../outside.md')).toBeNull()
    expect(normalizePapelizImportZipEntryPath('Ideas/../../outside.md')).toBeNull()
    expect(normalizePapelizImportZipEntryPath('/etc/passwd')).toBeNull()
    expect(normalizePapelizImportZipEntryPath('C:/Windows/notes.md')).toBeNull()
    const unsafeZipBytes = writeHandMadeZipBytes(utf8Encoder.encode('../outside.md'), 0x0800)
    expect(readPapelizImportZipFile(unsafeZipBytes)).toMatchObject({ importZipEntries: [], skippedUnsafeZipEntryCount: 1 })
    const folderZipBytes = writeHandMadeZipBytes(utf8Encoder.encode('Empty folder/'), 0x0800)
    expect(readPapelizImportZipFile(folderZipBytes).importZipEntries[0]).toMatchObject({ importZipEntryPath: 'Empty folder', isImportZipEntryFolder: true })
  })

  it('refuses what isn’t a zip, an encrypted zip, and the 64-bit extension', () => {
    expect(() => readPapelizImportZipFile(utf8Encoder.encode('# just a note, not a zip at all'))).toThrow('Not A Zip')
    expect(() => readPapelizImportZipFile(writeHandMadeZipBytes(utf8Encoder.encode('secret.md'), 0x0001))).toThrow('Zip Not Supported')
    const zip64Bytes = writeHandMadeZipBytes(utf8Encoder.encode('big.md'), 0x0800)
    new DataView(zip64Bytes.buffer).setUint32(zip64Bytes.length - 22 + 16, 0xffffffff, true)
    expect(() => readPapelizImportZipFile(zip64Bytes)).toThrow('Zip Not Supported')
  })

  it('catches a damaged file by its CRC-32', async () => {
    const damagedZipBytes = writeHandMadeZipBytes(utf8Encoder.encode('note.md'), 0x0800, utf8Encoder.encode('hello'))
    const [damagedZipEntry] = readPapelizImportZipFile(damagedZipBytes).importZipEntries
    await expect(damagedZipEntry!.readImportZipEntryBytes()).rejects.toThrow('Zip Damaged')
  })

  it('stops inflating at the size the zip declares', async () => {
    const zipBytes = await writeTestZipBytes({ 'big.md': 'a'.repeat(5000) })
    const zipView = new DataView(zipBytes.buffer)
    // Shrink the declared size in the central directory, as a zip bomb would understate it.
    const endOfCentralDirectoryOffset = zipBytes.length - 22
    const centralDirectoryOffset = zipView.getUint32(endOfCentralDirectoryOffset + 16, true)
    zipView.setUint32(centralDirectoryOffset + 24, 100, true)
    const [shrunkZipEntry] = readPapelizImportZipFile(zipBytes).importZipEntries
    await expect(shrunkZipEntry!.readImportZipEntryBytes()).rejects.toThrow('Zip Damaged')
  })
})
