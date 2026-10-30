import { computePapelizCrc32 } from './papeliz-export-zip-file-writer'

// Reads a `.zip` file in the browser, for importing a vault: the list of files from the zip's
// central directory, and each file's bytes on demand, inflated with the browser's own
// `DecompressionStream('deflate-raw')`. Stored and deflated files only; encrypted zips and the 64-bit
// extension (over 65,535 files or 4 GB) are refused. Names are UTF-8 when the zip says so or when
// they read as UTF-8, else the old DOS code page (CP437). Paths that would leave the vault (absolute,
// a drive letter, `..`) are skipped and counted. Every file's size and CRC-32 are checked, and
// inflating stops at the size the zip declares, so a zip bomb goes no further.

export interface PapelizImportZipEntry {
  // A relative path with "/" between folders: "Ideas/Offline first.md".
  importZipEntryPath: string
  isImportZipEntryFolder: boolean
  // The file's size once inflated, as the zip declares it.
  importZipEntryByteCount: number
  readImportZipEntryBytes: () => Promise<Uint8Array>
}

export interface PapelizImportZipReadResult {
  importZipEntries: PapelizImportZipEntry[]
  // Entries left out because their path would leave the vault.
  skippedUnsafeZipEntryCount: number
}

// Why a zip can't be read, in the words a toast shows in brackets.
export class PapelizImportZipError extends Error {
  override readonly name = 'PapelizImportZipError'
}

const papelizZipLocalFileHeaderSignature = 0x04034b50
const papelizZipCentralDirectoryHeaderSignature = 0x02014b50
const papelizZipEndOfCentralDirectorySignature = 0x06054b50
const papelizZip64EndOfCentralDirectoryLocatorSignature = 0x07064b50
const papelizZipEncryptedFlag = 0x0001
const papelizZipUtf8FileNameFlag = 0x0800
const papelizZipStoredMethod = 0
const papelizZipDeflatedMethod = 8
const papelizZipEndOfCentralDirectoryByteCount = 22
const papelizZipLongestCommentByteCount = 0xffff

// Bytes 128 to 255 of the DOS code page zips used before UTF-8.
const papelizCp437UpperHalfCharacters =
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ '

export function decodePapelizCp437Bytes(cp437Bytes: Uint8Array): string {
  let decodedText = ''
  for (const cp437Byte of cp437Bytes) decodedText += cp437Byte < 0x80 ? String.fromCharCode(cp437Byte) : (papelizCp437UpperHalfCharacters[cp437Byte - 0x80] ?? '?')
  return decodedText
}

function decodeZipEntryName(zipEntryNameBytes: Uint8Array, zipEntryFlags: number): string {
  if ((zipEntryFlags & papelizZipUtf8FileNameFlag) !== 0) return new TextDecoder('utf-8').decode(zipEntryNameBytes)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(zipEntryNameBytes)
  } catch {
    return decodePapelizCp437Bytes(zipEntryNameBytes)
  }
}

// "Ideas\\Deep/Notes.md" -> "Ideas/Deep/Notes.md"; null for a path that would leave the vault.
export function normalizePapelizImportZipEntryPath(rawZipEntryPath: string): string | null {
  const slashedZipEntryPath = rawZipEntryPath.replaceAll('\\', '/')
  if (slashedZipEntryPath.startsWith('/') || /^[a-zA-Z]:/.test(slashedZipEntryPath)) return null
  const zipEntryPathSegments = slashedZipEntryPath.split('/').filter((zipEntryPathSegment) => zipEntryPathSegment.length > 0)
  if (zipEntryPathSegments.length === 0) return null
  if (zipEntryPathSegments.some((zipEntryPathSegment) => zipEntryPathSegment === '.' || zipEntryPathSegment === '..')) return null
  return zipEntryPathSegments.join('/')
}

function findEndOfCentralDirectoryOffset(zipFileView: DataView): number {
  const lastPossibleOffset = zipFileView.byteLength - papelizZipEndOfCentralDirectoryByteCount
  const firstPossibleOffset = Math.max(0, lastPossibleOffset - papelizZipLongestCommentByteCount)
  for (let candidateOffset = lastPossibleOffset; candidateOffset >= firstPossibleOffset; candidateOffset -= 1) {
    if (zipFileView.getUint32(candidateOffset, true) === papelizZipEndOfCentralDirectorySignature) return candidateOffset
  }
  throw new PapelizImportZipError('Not A Zip')
}

async function inflateZipEntryBytes(storedBytes: Uint8Array, declaredByteCount: number): Promise<Uint8Array> {
  const inflatedStreamReader = new Blob([storedBytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader()
  const inflatedBytes = new Uint8Array(declaredByteCount)
  let inflatedByteCount = 0
  try {
    for (;;) {
      const { done: isInflateDone, value: inflatedChunk } = await inflatedStreamReader.read()
      if (isInflateDone) break
      if (inflatedByteCount + inflatedChunk.length > declaredByteCount) throw new PapelizImportZipError('Zip Damaged')
      inflatedBytes.set(inflatedChunk, inflatedByteCount)
      inflatedByteCount += inflatedChunk.length
    }
  } catch (inflateError) {
    await inflatedStreamReader.cancel().catch(() => undefined)
    throw inflateError instanceof PapelizImportZipError ? inflateError : new PapelizImportZipError('Zip Damaged')
  }
  if (inflatedByteCount !== declaredByteCount) throw new PapelizImportZipError('Zip Damaged')
  return inflatedBytes
}

export function readPapelizImportZipFile(zipFileBytes: Uint8Array): PapelizImportZipReadResult {
  if (zipFileBytes.byteLength < papelizZipEndOfCentralDirectoryByteCount) throw new PapelizImportZipError('Not A Zip')
  const zipFileView = new DataView(zipFileBytes.buffer, zipFileBytes.byteOffset, zipFileBytes.byteLength)
  const endOfCentralDirectoryOffset = findEndOfCentralDirectoryOffset(zipFileView)
  const zip64LocatorOffset = endOfCentralDirectoryOffset - 20
  if (zip64LocatorOffset >= 0 && zipFileView.getUint32(zip64LocatorOffset, true) === papelizZip64EndOfCentralDirectoryLocatorSignature) {
    throw new PapelizImportZipError('Zip Not Supported')
  }
  const centralDirectoryEntryCount = zipFileView.getUint16(endOfCentralDirectoryOffset + 10, true)
  const centralDirectoryOffset = zipFileView.getUint32(endOfCentralDirectoryOffset + 16, true)
  if (centralDirectoryEntryCount === 0xffff || centralDirectoryOffset === 0xffffffff) throw new PapelizImportZipError('Zip Not Supported')

  const importZipEntries: PapelizImportZipEntry[] = []
  let skippedUnsafeZipEntryCount = 0
  let centralDirectoryEntryOffset = centralDirectoryOffset
  for (let centralDirectoryEntryIndex = 0; centralDirectoryEntryIndex < centralDirectoryEntryCount; centralDirectoryEntryIndex += 1) {
    if (centralDirectoryEntryOffset + 46 > zipFileBytes.byteLength) throw new PapelizImportZipError('Zip Damaged')
    if (zipFileView.getUint32(centralDirectoryEntryOffset, true) !== papelizZipCentralDirectoryHeaderSignature) throw new PapelizImportZipError('Zip Damaged')
    const zipEntryFlags = zipFileView.getUint16(centralDirectoryEntryOffset + 8, true)
    const zipEntryMethod = zipFileView.getUint16(centralDirectoryEntryOffset + 10, true)
    const zipEntryCrc32 = zipFileView.getUint32(centralDirectoryEntryOffset + 16, true)
    const zipEntryStoredByteCount = zipFileView.getUint32(centralDirectoryEntryOffset + 20, true)
    const zipEntryByteCount = zipFileView.getUint32(centralDirectoryEntryOffset + 24, true)
    const zipEntryNameByteCount = zipFileView.getUint16(centralDirectoryEntryOffset + 28, true)
    const zipEntryExtraByteCount = zipFileView.getUint16(centralDirectoryEntryOffset + 30, true)
    const zipEntryCommentByteCount = zipFileView.getUint16(centralDirectoryEntryOffset + 32, true)
    const zipEntryLocalHeaderOffset = zipFileView.getUint32(centralDirectoryEntryOffset + 42, true)
    const rawZipEntryPath = decodeZipEntryName(
      zipFileBytes.subarray(centralDirectoryEntryOffset + 46, centralDirectoryEntryOffset + 46 + zipEntryNameByteCount),
      zipEntryFlags,
    )
    centralDirectoryEntryOffset += 46 + zipEntryNameByteCount + zipEntryExtraByteCount + zipEntryCommentByteCount

    if ((zipEntryFlags & papelizZipEncryptedFlag) !== 0) throw new PapelizImportZipError('Zip Not Supported')
    if (zipEntryMethod !== papelizZipStoredMethod && zipEntryMethod !== papelizZipDeflatedMethod) throw new PapelizImportZipError('Zip Not Supported')
    if (zipEntryStoredByteCount === 0xffffffff || zipEntryByteCount === 0xffffffff) throw new PapelizImportZipError('Zip Not Supported')
    const importZipEntryPath = normalizePapelizImportZipEntryPath(rawZipEntryPath)
    if (importZipEntryPath === null) {
      skippedUnsafeZipEntryCount += 1
      continue
    }
    const isImportZipEntryFolder = rawZipEntryPath.endsWith('/') || rawZipEntryPath.endsWith('\\')

    importZipEntries.push({
      importZipEntryPath,
      isImportZipEntryFolder,
      importZipEntryByteCount: isImportZipEntryFolder ? 0 : zipEntryByteCount,
      readImportZipEntryBytes: async () => {
        if (isImportZipEntryFolder) return new Uint8Array(0)
        if (zipEntryLocalHeaderOffset + 30 > zipFileBytes.byteLength) throw new PapelizImportZipError('Zip Damaged')
        if (zipFileView.getUint32(zipEntryLocalHeaderOffset, true) !== papelizZipLocalFileHeaderSignature) throw new PapelizImportZipError('Zip Damaged')
        const localNameByteCount = zipFileView.getUint16(zipEntryLocalHeaderOffset + 26, true)
        const localExtraByteCount = zipFileView.getUint16(zipEntryLocalHeaderOffset + 28, true)
        const storedBytesOffset = zipEntryLocalHeaderOffset + 30 + localNameByteCount + localExtraByteCount
        if (storedBytesOffset + zipEntryStoredByteCount > zipFileBytes.byteLength) throw new PapelizImportZipError('Zip Damaged')
        const storedBytes = zipFileBytes.subarray(storedBytesOffset, storedBytesOffset + zipEntryStoredByteCount)
        const zipEntryBytes =
          zipEntryMethod === papelizZipStoredMethod ? storedBytes.slice() : await inflateZipEntryBytes(storedBytes, zipEntryByteCount)
        if (zipEntryBytes.length !== zipEntryByteCount || computePapelizCrc32(zipEntryBytes) !== zipEntryCrc32) throw new PapelizImportZipError('Zip Damaged')
        return zipEntryBytes
      },
    })
  }
  return { importZipEntries, skippedUnsafeZipEntryCount }
}
