import type { PapelizDesktopFileSystem, PapelizDesktopFileSystemEntry } from '../desktop/papeliz-desktop-platform-contract'

// Test support only: an in-memory stand-in for Papeliz for Windows' native file calls, on Windows
// absolute paths ("C:\Users\Ada\Field Notes\Inbox.md"). As on Windows, names compare without case,
// "\" and "/" both separate folders, "." and ".." move within the path, and a trailing dot or space
// is trimmed from a name. As in the desktop app, a call reaches only the folders picked in it, and a
// rename or copy fails when its target is taken. Every call is kept with its paths, so a test can see
// what the adapter asked for.

interface PapelizFakeDesktopFile {
  fakeDesktopEntryKind: 'file'
  fakeDesktopFileBytes: Uint8Array
  fakeDesktopFileModifiedAt: number
}

interface PapelizFakeDesktopFolder {
  fakeDesktopEntryKind: 'folder'
  // By name as it was made; names compare without case.
  fakeDesktopChildEntriesByName: Map<string, PapelizFakeDesktopEntry>
}

type PapelizFakeDesktopEntry = PapelizFakeDesktopFile | PapelizFakeDesktopFolder

export interface PapelizFakeDesktopCall {
  desktopCallName: keyof PapelizDesktopFileSystem
  desktopCallPaths: string[]
}

function createFakeDesktopFolder(): PapelizFakeDesktopFolder {
  return { fakeDesktopEntryKind: 'folder', fakeDesktopChildEntriesByName: new Map() }
}

function copyFakeDesktopEntry(fakeDesktopEntry: PapelizFakeDesktopEntry, fakeDesktopModifiedAt: number): PapelizFakeDesktopEntry {
  if (fakeDesktopEntry.fakeDesktopEntryKind === 'file') {
    return { fakeDesktopEntryKind: 'file', fakeDesktopFileBytes: fakeDesktopEntry.fakeDesktopFileBytes.slice(), fakeDesktopFileModifiedAt: fakeDesktopModifiedAt }
  }
  const copiedFakeDesktopFolder = createFakeDesktopFolder()
  for (const [fakeDesktopChildName, fakeDesktopChildEntry] of fakeDesktopEntry.fakeDesktopChildEntriesByName) {
    copiedFakeDesktopFolder.fakeDesktopChildEntriesByName.set(fakeDesktopChildName, copyFakeDesktopEntry(fakeDesktopChildEntry, fakeDesktopModifiedAt))
  }
  return copiedFakeDesktopFolder
}

// "C:\Users\Ada\..\Ada\Notes." -> ["C:", "Users", "Ada", "Notes"], as Windows reads it.
function splitFakeDesktopPath(desktopPath: string): string[] {
  const [desktopDriveName, ...desktopPathNames] = desktopPath.split(/[\\/]+/).filter((desktopPathName) => desktopPathName.length > 0)
  if (desktopDriveName === undefined || !/^[a-z]:$/i.test(desktopDriveName)) throw new Error(`Not an absolute path: ${desktopPath}`)
  const resolvedDesktopPathNames = [desktopDriveName.toUpperCase()]
  for (const desktopPathName of desktopPathNames) {
    if (desktopPathName === '..') {
      if (resolvedDesktopPathNames.length > 1) resolvedDesktopPathNames.pop()
      continue
    }
    const trimmedDesktopPathName = desktopPathName.replace(/[. ]+$/, '')
    if (trimmedDesktopPathName.length === 0) continue
    if (trimmedDesktopPathName.includes(':')) throw new Error(`Not a name Windows takes: ${desktopPathName}`)
    resolvedDesktopPathNames.push(trimmedDesktopPathName)
  }
  return resolvedDesktopPathNames
}

function isFakeDesktopPathInside(desktopPathNames: readonly string[], desktopFolderPathNames: readonly string[]): boolean {
  return (
    desktopFolderPathNames.length <= desktopPathNames.length &&
    desktopFolderPathNames.every((desktopFolderPathName, desktopPathNameIndex) => desktopFolderPathName.toLowerCase() === desktopPathNames[desktopPathNameIndex]?.toLowerCase())
  )
}

export class PapelizFakeDesktopFileSystem implements PapelizDesktopFileSystem {
  readonly fakeDesktopCalls: PapelizFakeDesktopCall[] = []
  // When false, entries give no size or last change, as a native side that doesn't know them would.
  isFakeDesktopFileStatKnown = true
  // When set, the next file write fails, as a full disk would, and leaves the file as it was.
  shouldFailNextDesktopFileWrite = false
  // Holds the drives ("C:"), and everything on them.
  private readonly fakeDesktopComputerFolder = createFakeDesktopFolder()
  private fakeDesktopClock = Date.UTC(2026, 10, 3)

  constructor(private readonly desktopPickedFolderPaths: readonly string[]) {}

  async listDesktopFolderEntries(desktopFolderPath: string): Promise<PapelizDesktopFileSystemEntry[]> {
    const fakeDesktopFolder = this.findFakeDesktopFolder(this.startFakeDesktopCall('listDesktopFolderEntries', desktopFolderPath)[0] ?? [], desktopFolderPath)
    return [...fakeDesktopFolder.fakeDesktopChildEntriesByName].map(([fakeDesktopChildName, fakeDesktopChildEntry]) => this.describeFakeDesktopEntry(fakeDesktopChildName, fakeDesktopChildEntry))
  }

  async readDesktopEntry(desktopEntryPath: string): Promise<PapelizDesktopFileSystemEntry | null> {
    const foundFakeDesktopEntry = this.findFakeDesktopEntry(this.startFakeDesktopCall('readDesktopEntry', desktopEntryPath)[0] ?? [])
    return foundFakeDesktopEntry === null ? null : this.describeFakeDesktopEntry(foundFakeDesktopEntry.fakeDesktopEntryName, foundFakeDesktopEntry.fakeDesktopEntry)
  }

  async readDesktopFileText(desktopFilePath: string): Promise<string> {
    return new TextDecoder().decode(this.findFakeDesktopFile(this.startFakeDesktopCall('readDesktopFileText', desktopFilePath)[0] ?? [], desktopFilePath).fakeDesktopFileBytes)
  }

  async readDesktopFileBytes(desktopFilePath: string): Promise<Uint8Array> {
    return this.findFakeDesktopFile(this.startFakeDesktopCall('readDesktopFileBytes', desktopFilePath)[0] ?? [], desktopFilePath).fakeDesktopFileBytes.slice()
  }

  async writeDesktopFileText(desktopFilePath: string, desktopFileText: string): Promise<void> {
    this.putFakeDesktopFile(this.startFakeDesktopCall('writeDesktopFileText', desktopFilePath)[0] ?? [], desktopFilePath, new TextEncoder().encode(desktopFileText))
  }

  async writeDesktopFileBytes(desktopFilePath: string, desktopFileBytes: Uint8Array): Promise<void> {
    this.putFakeDesktopFile(this.startFakeDesktopCall('writeDesktopFileBytes', desktopFilePath)[0] ?? [], desktopFilePath, desktopFileBytes.slice())
  }

  async makeDesktopFolder(desktopFolderPath: string): Promise<void> {
    this.makeFakeDesktopFolder(this.startFakeDesktopCall('makeDesktopFolder', desktopFolderPath)[0] ?? [], desktopFolderPath)
  }

  async renameDesktopEntry(fromDesktopEntryPath: string, toDesktopEntryPath: string): Promise<void> {
    const [fromDesktopPathNames = [], toDesktopPathNames = []] = this.startFakeDesktopCall('renameDesktopEntry', fromDesktopEntryPath, toDesktopEntryPath)
    const { fromFakeDesktopParentFolder, fromFakeDesktopEntryName, fromFakeDesktopEntry, toFakeDesktopParentFolder, toFakeDesktopEntryName } = this.prepareFakeDesktopMove(
      fromDesktopPathNames,
      toDesktopPathNames,
      fromDesktopEntryPath,
      toDesktopEntryPath,
    )
    fromFakeDesktopParentFolder.fakeDesktopChildEntriesByName.delete(fromFakeDesktopEntryName)
    toFakeDesktopParentFolder.fakeDesktopChildEntriesByName.set(toFakeDesktopEntryName, fromFakeDesktopEntry)
  }

  async copyDesktopEntry(fromDesktopEntryPath: string, toDesktopEntryPath: string): Promise<void> {
    const [fromDesktopPathNames = [], toDesktopPathNames = []] = this.startFakeDesktopCall('copyDesktopEntry', fromDesktopEntryPath, toDesktopEntryPath)
    const { fromFakeDesktopEntry, toFakeDesktopParentFolder, toFakeDesktopEntryName } = this.prepareFakeDesktopMove(fromDesktopPathNames, toDesktopPathNames, fromDesktopEntryPath, toDesktopEntryPath)
    toFakeDesktopParentFolder.fakeDesktopChildEntriesByName.set(toFakeDesktopEntryName, copyFakeDesktopEntry(fromFakeDesktopEntry, this.tickFakeDesktopClock()))
  }

  async removeDesktopEntry(desktopEntryPath: string): Promise<void> {
    const desktopPathNames = this.startFakeDesktopCall('removeDesktopEntry', desktopEntryPath)[0] ?? []
    const fakeDesktopParentFolder = this.findFakeDesktopFolder(desktopPathNames.slice(0, -1), desktopEntryPath)
    const foundFakeDesktopChild = this.findFakeDesktopChild(fakeDesktopParentFolder, desktopPathNames.at(-1) ?? '')
    if (foundFakeDesktopChild === null) throw new Error(`Nothing is there: ${desktopEntryPath}`)
    fakeDesktopParentFolder.fakeDesktopChildEntriesByName.delete(foundFakeDesktopChild.fakeDesktopEntryName)
  }

  joinDesktopPath(desktopFolderPath: string, ...desktopPathNames: string[]): string {
    return [desktopFolderPath.replace(/[\\/]+$/, ''), ...desktopPathNames].join('\\')
  }

  // Test set-up, not a native call: makes the folder, picked or not, and adds files and folders to it
  // from paths inside it ("Notes/Inbox.md" -> text). Paths ending in "/" are empty folders.
  addFakeDesktopFiles(desktopFolderPath: string, fakeDesktopFileTextsByRelativePath: Record<string, string>): void {
    this.makeFakeDesktopFolder(splitFakeDesktopPath(desktopFolderPath), desktopFolderPath)
    for (const [fakeDesktopRelativePath, fakeDesktopFileText] of Object.entries(fakeDesktopFileTextsByRelativePath)) {
      const desktopPathNames = splitFakeDesktopPath(this.joinDesktopPath(desktopFolderPath, ...fakeDesktopRelativePath.split('/')))
      if (fakeDesktopRelativePath.endsWith('/')) this.makeFakeDesktopFolder(desktopPathNames, desktopFolderPath)
      else {
        this.makeFakeDesktopFolder(desktopPathNames.slice(0, -1), desktopFolderPath)
        this.putFakeDesktopFile(desktopPathNames, desktopFolderPath, new TextEncoder().encode(fakeDesktopFileText))
      }
    }
  }

  // Test check, not a native call: the folder read back as "path" -> text, folders as "path/".
  readFakeDesktopFolder(desktopFolderPath: string): Record<string, string> {
    const fakeDesktopFileTextsByRelativePath: Record<string, string> = {}
    const readFakeDesktopFolderEntries = (fakeDesktopFolder: PapelizFakeDesktopFolder, fakeDesktopRelativePathPrefix: string) => {
      for (const [fakeDesktopChildName, fakeDesktopChildEntry] of fakeDesktopFolder.fakeDesktopChildEntriesByName) {
        const fakeDesktopChildRelativePath = `${fakeDesktopRelativePathPrefix}${fakeDesktopChildName}`
        if (fakeDesktopChildEntry.fakeDesktopEntryKind === 'folder') {
          fakeDesktopFileTextsByRelativePath[`${fakeDesktopChildRelativePath}/`] = ''
          readFakeDesktopFolderEntries(fakeDesktopChildEntry, `${fakeDesktopChildRelativePath}/`)
        } else {
          fakeDesktopFileTextsByRelativePath[fakeDesktopChildRelativePath] = new TextDecoder().decode(fakeDesktopChildEntry.fakeDesktopFileBytes)
        }
      }
    }
    readFakeDesktopFolderEntries(this.findFakeDesktopFolder(splitFakeDesktopPath(desktopFolderPath), desktopFolderPath), '')
    return fakeDesktopFileTextsByRelativePath
  }

  // Keeps the call, and gives back each path as Windows reads it, once it is inside a picked folder.
  private startFakeDesktopCall(desktopCallName: keyof PapelizDesktopFileSystem, ...desktopCallPaths: string[]): string[][] {
    this.fakeDesktopCalls.push({ desktopCallName, desktopCallPaths })
    return desktopCallPaths.map((desktopCallPath) => {
      const desktopPathNames = splitFakeDesktopPath(desktopCallPath)
      const isInsidePickedFolder = this.desktopPickedFolderPaths.some((desktopPickedFolderPath) => isFakeDesktopPathInside(desktopPathNames, splitFakeDesktopPath(desktopPickedFolderPath)))
      if (!isInsidePickedFolder) throw new Error(`Outside the picked folders: ${desktopCallPath}`)
      return desktopPathNames
    })
  }

  private tickFakeDesktopClock(): number {
    this.fakeDesktopClock += 1000
    return this.fakeDesktopClock
  }

  private describeFakeDesktopEntry(fakeDesktopEntryName: string, fakeDesktopEntry: PapelizFakeDesktopEntry): PapelizDesktopFileSystemEntry {
    const isFakeDesktopFileStatGiven = fakeDesktopEntry.fakeDesktopEntryKind === 'file' && this.isFakeDesktopFileStatKnown
    return {
      desktopEntryName: fakeDesktopEntryName,
      isDesktopEntryFolder: fakeDesktopEntry.fakeDesktopEntryKind === 'folder',
      desktopFileByteCount: isFakeDesktopFileStatGiven ? fakeDesktopEntry.fakeDesktopFileBytes.length : null,
      desktopEntryModifiedAt: isFakeDesktopFileStatGiven ? fakeDesktopEntry.fakeDesktopFileModifiedAt : null,
    }
  }

  private findFakeDesktopChild(fakeDesktopFolder: PapelizFakeDesktopFolder, fakeDesktopChildName: string): { fakeDesktopEntryName: string; fakeDesktopEntry: PapelizFakeDesktopEntry } | null {
    for (const [existingFakeDesktopChildName, existingFakeDesktopChildEntry] of fakeDesktopFolder.fakeDesktopChildEntriesByName) {
      if (existingFakeDesktopChildName.toLowerCase() === fakeDesktopChildName.toLowerCase()) {
        return { fakeDesktopEntryName: existingFakeDesktopChildName, fakeDesktopEntry: existingFakeDesktopChildEntry }
      }
    }
    return null
  }

  private findFakeDesktopEntry(desktopPathNames: readonly string[]): { fakeDesktopEntryName: string; fakeDesktopEntry: PapelizFakeDesktopEntry } | null {
    let foundFakeDesktopEntry: { fakeDesktopEntryName: string; fakeDesktopEntry: PapelizFakeDesktopEntry } | null = null
    let fakeDesktopFolder: PapelizFakeDesktopFolder | null = this.fakeDesktopComputerFolder
    for (const desktopPathName of desktopPathNames) {
      if (fakeDesktopFolder === null) return null
      foundFakeDesktopEntry = this.findFakeDesktopChild(fakeDesktopFolder, desktopPathName)
      if (foundFakeDesktopEntry === null) return null
      fakeDesktopFolder = foundFakeDesktopEntry.fakeDesktopEntry.fakeDesktopEntryKind === 'folder' ? foundFakeDesktopEntry.fakeDesktopEntry : null
    }
    return foundFakeDesktopEntry
  }

  private findFakeDesktopFolder(desktopPathNames: readonly string[], desktopPath: string): PapelizFakeDesktopFolder {
    const foundFakeDesktopEntry = this.findFakeDesktopEntry(desktopPathNames)
    if (foundFakeDesktopEntry?.fakeDesktopEntry.fakeDesktopEntryKind !== 'folder') throw new Error(`No folder is there: ${desktopPath}`)
    return foundFakeDesktopEntry.fakeDesktopEntry
  }

  private findFakeDesktopFile(desktopPathNames: readonly string[], desktopPath: string): PapelizFakeDesktopFile {
    const foundFakeDesktopEntry = this.findFakeDesktopEntry(desktopPathNames)
    if (foundFakeDesktopEntry?.fakeDesktopEntry.fakeDesktopEntryKind !== 'file') throw new Error(`No file is there: ${desktopPath}`)
    return foundFakeDesktopEntry.fakeDesktopEntry
  }

  private makeFakeDesktopFolder(desktopPathNames: readonly string[], desktopPath: string): void {
    let fakeDesktopFolder = this.fakeDesktopComputerFolder
    for (const desktopPathName of desktopPathNames) {
      const foundFakeDesktopChild = this.findFakeDesktopChild(fakeDesktopFolder, desktopPathName)
      if (foundFakeDesktopChild === null) {
        const madeFakeDesktopFolder = createFakeDesktopFolder()
        fakeDesktopFolder.fakeDesktopChildEntriesByName.set(desktopPathName, madeFakeDesktopFolder)
        fakeDesktopFolder = madeFakeDesktopFolder
      } else if (foundFakeDesktopChild.fakeDesktopEntry.fakeDesktopEntryKind === 'folder') {
        fakeDesktopFolder = foundFakeDesktopChild.fakeDesktopEntry
      } else {
        throw new Error(`A file is in the way: ${desktopPath}`)
      }
    }
  }

  private putFakeDesktopFile(desktopPathNames: readonly string[], desktopPath: string, fakeDesktopFileBytes: Uint8Array): void {
    const fakeDesktopParentFolder = this.findFakeDesktopFolder(desktopPathNames.slice(0, -1), desktopPath)
    if (this.shouldFailNextDesktopFileWrite) {
      this.shouldFailNextDesktopFileWrite = false
      throw new Error('The disk is full.')
    }
    const fakeDesktopFileName = desktopPathNames.at(-1) ?? ''
    const foundFakeDesktopChild = this.findFakeDesktopChild(fakeDesktopParentFolder, fakeDesktopFileName)
    if (foundFakeDesktopChild?.fakeDesktopEntry.fakeDesktopEntryKind === 'folder') throw new Error(`A folder is there: ${desktopPath}`)
    if (foundFakeDesktopChild === null) {
      fakeDesktopParentFolder.fakeDesktopChildEntriesByName.set(fakeDesktopFileName, { fakeDesktopEntryKind: 'file', fakeDesktopFileBytes, fakeDesktopFileModifiedAt: this.tickFakeDesktopClock() })
      return
    }
    foundFakeDesktopChild.fakeDesktopEntry.fakeDesktopFileBytes = fakeDesktopFileBytes
    foundFakeDesktopChild.fakeDesktopEntry.fakeDesktopFileModifiedAt = this.tickFakeDesktopClock()
  }

  // A rename's or a copy's checks: the source is there, the target's folder is there and its name is
  // free whatever the case (the source's own name counts), and a folder never goes inside itself.
  private prepareFakeDesktopMove(fromDesktopPathNames: readonly string[], toDesktopPathNames: readonly string[], fromDesktopEntryPath: string, toDesktopEntryPath: string) {
    const fromFakeDesktopParentFolder = this.findFakeDesktopFolder(fromDesktopPathNames.slice(0, -1), fromDesktopEntryPath)
    const foundFromFakeDesktopChild = this.findFakeDesktopChild(fromFakeDesktopParentFolder, fromDesktopPathNames.at(-1) ?? '')
    if (foundFromFakeDesktopChild === null) throw new Error(`Nothing is there: ${fromDesktopEntryPath}`)
    if (isFakeDesktopPathInside(toDesktopPathNames, fromDesktopPathNames)) throw new Error(`A folder can't go inside itself: ${toDesktopEntryPath}`)
    const toFakeDesktopParentFolder = this.findFakeDesktopFolder(toDesktopPathNames.slice(0, -1), toDesktopEntryPath)
    const toFakeDesktopEntryName = toDesktopPathNames.at(-1) ?? ''
    if (this.findFakeDesktopChild(toFakeDesktopParentFolder, toFakeDesktopEntryName) !== null) throw new Error(`The target is taken: ${toDesktopEntryPath}`)
    return {
      fromFakeDesktopParentFolder,
      fromFakeDesktopEntryName: foundFromFakeDesktopChild.fakeDesktopEntryName,
      fromFakeDesktopEntry: foundFromFakeDesktopChild.fakeDesktopEntry,
      toFakeDesktopParentFolder,
      toFakeDesktopEntryName,
    }
  }
}

// A stand-in with one picked folder, holding these files ("Notes/Inbox.md" -> text, "Empty/" a folder).
export function createPapelizFakeDesktopFileSystem(desktopPickedFolderPath: string, fakeDesktopFileTextsByRelativePath: Record<string, string>): PapelizFakeDesktopFileSystem {
  const fakeDesktopFileSystem = new PapelizFakeDesktopFileSystem([desktopPickedFolderPath])
  fakeDesktopFileSystem.addFakeDesktopFiles(desktopPickedFolderPath, fakeDesktopFileTextsByRelativePath)
  return fakeDesktopFileSystem
}
