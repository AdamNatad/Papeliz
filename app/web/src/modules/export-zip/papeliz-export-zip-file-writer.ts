// Writes a `.zip` file in the browser for Papeliz's exports (a website of notes, several PDFs):
// each file compressed with the browser's own `CompressionStream('deflate-raw')`, or stored as it
// is when that doesn't make it smaller (pictures, fonts). File names are UTF-8, so "Café.md" stays
// "Café.md". Plain zip without the 64-bit extension: up to 65,535 files and 4 GB.

export interface PapelizExportZipEntry {
  // A relative path with "/" between folders: "projects/launch-plan.html".
  zipEntryPath: string
  zipEntryBytes: Uint8Array
}

export interface PapelizExportZipFileOptions {
  // The modified date every file gets; the same date gives the same bytes.
  zipEntryModifiedDate: Date
}

const papelizZipLocalFileHeaderSignature = 0x04034b50
const papelizZipCentralDirectoryHeaderSignature = 0x02014b50
const papelizZipEndOfCentralDirectorySignature = 0x06054b50
const papelizZipVersionNeeded = 20
const papelizZipUtf8FileNameFlag = 0x0800
const papelizZipStoredMethod = 0
const papelizZipDeflatedMethod = 8
const papelizZipLargestEntryCount = 0xffff
const papelizZipLargestByteCount = 0xffffffff

const papelizCrc32Table = (() => {
  const crc32Table = new Uint32Array(256)
  for (let tableIndex = 0; tableIndex < 256; tableIndex += 1) {
    let crc32Value = tableIndex
    for (let bitIndex = 0; bitIndex < 8; bitIndex += 1) crc32Value = crc32Value & 1 ? 0xedb88320 ^ (crc32Value >>> 1) : crc32Value >>> 1
    crc32Table[tableIndex] = crc32Value >>> 0
  }
  return crc32Table
})()

export function computePapelizCrc32(fileBytes: Uint8Array): number {
  let crc32Value = 0xffffffff
  for (const fileByte of fileBytes) crc32Value = (papelizCrc32Table[(crc32Value ^ fileByte) & 0xff] ?? 0) ^ (crc32Value >>> 8)
  return (crc32Value ^ 0xffffffff) >>> 0
}

async function deflatePapelizZipEntryBytes(fileBytes: Uint8Array): Promise<Uint8Array> {
  const deflatedStream = new Blob([fileBytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(deflatedStream).arrayBuffer())
}

// The date and time as a zip stores them (MS-DOS format, local time, two-second steps).
function encodePapelizZipDosDateTime(zipEntryModifiedDate: Date): { dosTime: number; dosDate: number } {
  const zipYear = Math.min(2107, Math.max(1980, zipEntryModifiedDate.getFullYear()))
  return {
    dosTime: (zipEntryModifiedDate.getHours() << 11) | (zipEntryModifiedDate.getMinutes() << 5) | Math.floor(zipEntryModifiedDate.getSeconds() / 2),
    dosDate: ((zipYear - 1980) << 9) | ((zipEntryModifiedDate.getMonth() + 1) << 5) | zipEntryModifiedDate.getDate(),
  }
}

function checkPapelizZipEntryPath(zipEntryPath: string, writtenZipEntryPaths: ReadonlySet<string>): void {
  const zipEntryPathSegments = zipEntryPath.split('/')
  const isPathSafe =
    zipEntryPath.length > 0 &&
    !zipEntryPath.includes('\\') &&
    zipEntryPathSegments.every((zipEntryPathSegment) => zipEntryPathSegment.length > 0 && zipEntryPathSegment !== '.' && zipEntryPathSegment !== '..')
  if (!isPathSafe) throw new Error(`“${zipEntryPath}” can’t be a path inside a zip file.`)
  if (writtenZipEntryPaths.has(zipEntryPath)) throw new Error(`“${zipEntryPath}” is in the zip file twice.`)
}

class PapelizZipByteWriter {
  readonly zipFileParts: Uint8Array[] = []
  zipFileByteCount = 0

  writeRecord(recordFieldWriter: (recordView: DataView) => void, recordByteCount: number, recordTailBytes: Uint8Array): void {
    const recordBytes = new Uint8Array(recordByteCount)
    recordFieldWriter(new DataView(recordBytes.buffer))
    this.writeBytes(recordBytes)
    this.writeBytes(recordTailBytes)
  }

  writeBytes(zipFileBytes: Uint8Array): void {
    this.zipFileParts.push(zipFileBytes)
    this.zipFileByteCount += zipFileBytes.length
  }
}

export async function writePapelizExportZipFile(zipEntries: readonly PapelizExportZipEntry[], zipFileOptions: PapelizExportZipFileOptions): Promise<Blob> {
  if (zipEntries.length > papelizZipLargestEntryCount) throw new Error('A zip file can hold at most 65,535 files.')
  const { dosTime, dosDate } = encodePapelizZipDosDateTime(zipFileOptions.zipEntryModifiedDate)
  const zipByteWriter = new PapelizZipByteWriter()
  const writtenZipEntryPaths = new Set<string>()
  const centralDirectoryRecords: Array<{ zipEntryNameBytes: Uint8Array; zipMethod: number; crc32Value: number; storedByteCount: number; fileByteCount: number; localHeaderOffset: number }> = []
  const utf8Encoder = new TextEncoder()

  for (const { zipEntryPath, zipEntryBytes } of zipEntries) {
    checkPapelizZipEntryPath(zipEntryPath, writtenZipEntryPaths)
    writtenZipEntryPaths.add(zipEntryPath)
    const zipEntryNameBytes = utf8Encoder.encode(zipEntryPath)
    const deflatedBytes = await deflatePapelizZipEntryBytes(zipEntryBytes)
    const isDeflatedSmaller = deflatedBytes.length < zipEntryBytes.length
    const zipMethod = isDeflatedSmaller ? papelizZipDeflatedMethod : papelizZipStoredMethod
    const storedBytes = isDeflatedSmaller ? deflatedBytes : zipEntryBytes
    const crc32Value = computePapelizCrc32(zipEntryBytes)
    const localHeaderOffset = zipByteWriter.zipFileByteCount
    if (localHeaderOffset + storedBytes.length > papelizZipLargestByteCount) throw new Error('A zip file can hold at most 4 GB.')

    zipByteWriter.writeRecord(
      (recordView) => {
        recordView.setUint32(0, papelizZipLocalFileHeaderSignature, true)
        recordView.setUint16(4, papelizZipVersionNeeded, true)
        recordView.setUint16(6, papelizZipUtf8FileNameFlag, true)
        recordView.setUint16(8, zipMethod, true)
        recordView.setUint16(10, dosTime, true)
        recordView.setUint16(12, dosDate, true)
        recordView.setUint32(14, crc32Value, true)
        recordView.setUint32(18, storedBytes.length, true)
        recordView.setUint32(22, zipEntryBytes.length, true)
        recordView.setUint16(26, zipEntryNameBytes.length, true)
        recordView.setUint16(28, 0, true)
      },
      30,
      zipEntryNameBytes,
    )
    zipByteWriter.writeBytes(storedBytes)
    centralDirectoryRecords.push({ zipEntryNameBytes, zipMethod, crc32Value, storedByteCount: storedBytes.length, fileByteCount: zipEntryBytes.length, localHeaderOffset })
  }

  const centralDirectoryOffset = zipByteWriter.zipFileByteCount
  for (const centralDirectoryRecord of centralDirectoryRecords) {
    zipByteWriter.writeRecord(
      (recordView) => {
        recordView.setUint32(0, papelizZipCentralDirectoryHeaderSignature, true)
        recordView.setUint16(4, papelizZipVersionNeeded, true)
        recordView.setUint16(6, papelizZipVersionNeeded, true)
        recordView.setUint16(8, papelizZipUtf8FileNameFlag, true)
        recordView.setUint16(10, centralDirectoryRecord.zipMethod, true)
        recordView.setUint16(12, dosTime, true)
        recordView.setUint16(14, dosDate, true)
        recordView.setUint32(16, centralDirectoryRecord.crc32Value, true)
        recordView.setUint32(20, centralDirectoryRecord.storedByteCount, true)
        recordView.setUint32(24, centralDirectoryRecord.fileByteCount, true)
        recordView.setUint16(28, centralDirectoryRecord.zipEntryNameBytes.length, true)
        // Extra field, comment, disk number, internal and external attributes: none.
        recordView.setUint32(42, centralDirectoryRecord.localHeaderOffset, true)
      },
      46,
      centralDirectoryRecord.zipEntryNameBytes,
    )
  }
  const centralDirectoryByteCount = zipByteWriter.zipFileByteCount - centralDirectoryOffset
  if (zipByteWriter.zipFileByteCount > papelizZipLargestByteCount) throw new Error('A zip file can hold at most 4 GB.')

  zipByteWriter.writeRecord(
    (recordView) => {
      recordView.setUint32(0, papelizZipEndOfCentralDirectorySignature, true)
      recordView.setUint16(8, centralDirectoryRecords.length, true)
      recordView.setUint16(10, centralDirectoryRecords.length, true)
      recordView.setUint32(12, centralDirectoryByteCount, true)
      recordView.setUint32(16, centralDirectoryOffset, true)
    },
    22,
    new Uint8Array(0),
  )
  return new Blob(zipByteWriter.zipFileParts as Uint8Array<ArrayBuffer>[], { type: 'application/zip' })
}
