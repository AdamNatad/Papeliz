import { describe, expect, it } from 'vitest'
import { computePapelizCrc32, writePapelizExportZipFile, type PapelizExportZipEntry } from './papeliz-export-zip-file-writer'

interface ReadTestZipEntry {
  zipEntryPath: string
  zipEntryText: string
  zipMethod: number
  usesUtf8FileName: boolean
}

async function inflateTestZipEntryBytes(storedBytes: Uint8Array): Promise<Uint8Array> {
  const inflatedStream = new Blob([storedBytes.slice()]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(inflatedStream).arrayBuffer())
}

// Reads a zip the way an unzip tool does: from the end record to the central directory, then each
// file's local header, checking every size and checksum on the way.
async function readTestZipFile(zipFileBytes: Uint8Array): Promise<ReadTestZipEntry[]> {
  const zipView = new DataView(zipFileBytes.buffer, zipFileBytes.byteOffset, zipFileBytes.byteLength)
  const endRecordOffset = zipFileBytes.length - 22
  expect(zipView.getUint32(endRecordOffset, true)).toBe(0x06054b50)
  const zipEntryCount = zipView.getUint16(endRecordOffset + 10, true)
  let centralDirectoryCursor = zipView.getUint32(endRecordOffset + 16, true)
  expect(centralDirectoryCursor + zipView.getUint32(endRecordOffset + 12, true)).toBe(endRecordOffset)
  const readZipEntries: ReadTestZipEntry[] = []
  for (let zipEntryIndex = 0; zipEntryIndex < zipEntryCount; zipEntryIndex += 1) {
    expect(zipView.getUint32(centralDirectoryCursor, true)).toBe(0x02014b50)
    const zipFlags = zipView.getUint16(centralDirectoryCursor + 8, true)
    const zipMethod = zipView.getUint16(centralDirectoryCursor + 10, true)
    const crc32Value = zipView.getUint32(centralDirectoryCursor + 16, true)
    const storedByteCount = zipView.getUint32(centralDirectoryCursor + 20, true)
    const fileByteCount = zipView.getUint32(centralDirectoryCursor + 24, true)
    const zipEntryNameByteCount = zipView.getUint16(centralDirectoryCursor + 28, true)
    const localHeaderOffset = zipView.getUint32(centralDirectoryCursor + 42, true)
    const zipEntryPath = new TextDecoder().decode(zipFileBytes.subarray(centralDirectoryCursor + 46, centralDirectoryCursor + 46 + zipEntryNameByteCount))
    expect(zipView.getUint32(localHeaderOffset, true)).toBe(0x04034b50)
    expect(zipView.getUint32(localHeaderOffset + 14, true)).toBe(crc32Value)
    const storedBytesOffset = localHeaderOffset + 30 + zipView.getUint16(localHeaderOffset + 26, true) + zipView.getUint16(localHeaderOffset + 28, true)
    const storedBytes = zipFileBytes.subarray(storedBytesOffset, storedBytesOffset + storedByteCount)
    const fileBytes = zipMethod === 8 ? await inflateTestZipEntryBytes(storedBytes) : storedBytes
    expect(fileBytes.length).toBe(fileByteCount)
    expect(computePapelizCrc32(fileBytes)).toBe(crc32Value)
    readZipEntries.push({ zipEntryPath, zipEntryText: new TextDecoder().decode(fileBytes), zipMethod, usesUtf8FileName: (zipFlags & 0x0800) !== 0 })
    centralDirectoryCursor += 46 + zipEntryNameByteCount
  }
  return readZipEntries
}

const testZipFileOptions = { zipEntryModifiedDate: new Date(2026, 9, 30, 14, 30, 10) }

function createTextZipEntry(zipEntryPath: string, zipEntryText: string): PapelizExportZipEntry {
  return { zipEntryPath, zipEntryBytes: new TextEncoder().encode(zipEntryText) }
}

async function writeTestZipFile(zipEntries: PapelizExportZipEntry[]): Promise<Uint8Array> {
  return new Uint8Array(await (await writePapelizExportZipFile(zipEntries, testZipFileOptions)).arrayBuffer())
}

describe('the export zip writer', () => {
  it('computes the standard CRC-32', () => {
    expect(computePapelizCrc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
    expect(computePapelizCrc32(new Uint8Array(0))).toBe(0)
  })

  it('writes files an unzip tool reads back, in folders, with UTF-8 names', async () => {
    const pageText = '<!doctype html><p>Launch plan</p>\n'.repeat(40)
    const readZipEntries = await readTestZipFile(
      await writeTestZipFile([
        createTextZipEntry('index.html', pageText),
        createTextZipEntry('projects/café-notes.md', '# Café\n'),
        createTextZipEntry('empty.txt', ''),
      ]),
    )
    expect(readZipEntries.map((readZipEntry) => readZipEntry.zipEntryPath)).toEqual(['index.html', 'projects/café-notes.md', 'empty.txt'])
    expect(readZipEntries[0]?.zipEntryText).toBe(pageText)
    expect(readZipEntries[1]?.zipEntryText).toBe('# Café\n')
    expect(readZipEntries[2]?.zipEntryText).toBe('')
    expect(readZipEntries.every((readZipEntry) => readZipEntry.usesUtf8FileName)).toBe(true)
  })

  it('compresses text and stores what doesn’t get smaller', async () => {
    const randomBytes = new Uint8Array(4096)
    let randomSeed = 7
    for (let byteIndex = 0; byteIndex < randomBytes.length; byteIndex += 1) {
      randomSeed = (randomSeed * 1103515245 + 12345) >>> 0
      randomBytes[byteIndex] = randomSeed >>> 24
    }
    const readZipEntries = await readTestZipFile(
      await writeTestZipFile([createTextZipEntry('page.html', 'Garden plan. '.repeat(200)), { zipEntryPath: 'fonts/figtree.woff2', zipEntryBytes: randomBytes }]),
    )
    expect(readZipEntries.map((readZipEntry) => readZipEntry.zipMethod)).toEqual([8, 0])
  })

  it('stores the export date and gives the same bytes for the same files', async () => {
    const firstZipBytes = await writeTestZipFile([createTextZipEntry('a.txt', 'one')])
    const secondZipBytes = await writeTestZipFile([createTextZipEntry('a.txt', 'one')])
    expect(secondZipBytes).toEqual(firstZipBytes)
    const zipView = new DataView(firstZipBytes.buffer)
    expect(zipView.getUint16(10, true)).toBe((14 << 11) | (30 << 5) | 5)
    expect(zipView.getUint16(12, true)).toBe(((2026 - 1980) << 9) | (10 << 5) | 30)
  })

  it('refuses paths that could land outside the unzipped folder, and repeats', async () => {
    for (const unsafeZipEntryPath of ['../outside.html', '/root.html', 'a//b.html', 'a\\b.html', 'a/./b.html', '']) {
      await expect(writeTestZipFile([createTextZipEntry(unsafeZipEntryPath, 'x')])).rejects.toThrow(/can’t be a path/)
    }
    await expect(writeTestZipFile([createTextZipEntry('a.html', 'x'), createTextZipEntry('a.html', 'y')])).rejects.toThrow(/twice/)
  })
})
