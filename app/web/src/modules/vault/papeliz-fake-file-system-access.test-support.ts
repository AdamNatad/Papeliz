// Test support only: an in-memory stand-in for the File System Access API that Chrome gives a
// picked folder. Names compare without case, the way Windows and macOS folders do, so the tests
// exercise the same edge cases a real vault on those systems would.

type PapelizFakeEntryHandle = PapelizFakeFileHandle | PapelizFakeDirectoryHandle

export interface PapelizFakePermissionStates {
  queryPermissionState: PermissionState
  requestPermissionState: PermissionState
}

const papelizGrantedPermissionStates: PapelizFakePermissionStates = { queryPermissionState: 'granted', requestPermissionState: 'granted' }

function createFakeDomException(fakeErrorMessage: string, fakeErrorName: string): DOMException {
  return new DOMException(fakeErrorMessage, fakeErrorName)
}

abstract class PapelizFakeHandleBase {
  fakePermissionStates: PapelizFakePermissionStates = { ...papelizGrantedPermissionStates }
  requestPermissionCallCount = 0

  constructor(public name: string) {}

  async queryPermission(): Promise<PermissionState> {
    return this.fakePermissionStates.queryPermissionState
  }

  async requestPermission(): Promise<PermissionState> {
    this.requestPermissionCallCount += 1
    return this.fakePermissionStates.requestPermissionState
  }

  async isSameEntry(otherHandle: unknown): Promise<boolean> {
    return otherHandle === this
  }
}

export class PapelizFakeFileHandle extends PapelizFakeHandleBase {
  readonly kind = 'file' as const
  fakeFileContents: Blob = new Blob([])
  // When set, the next writable stream fails on close(), as a full disk or a locked file would.
  shouldFailNextWriteClose = false

  async getFile(): Promise<File> {
    return new File([this.fakeFileContents], this.name)
  }

  async createWritable() {
    let pendingFileContents: Blob = new Blob([])
    let isWritableStreamOpen = true
    return {
      write: async (writtenData: string | Blob) => {
        if (!isWritableStreamOpen) throw createFakeDomException('The stream is closed.', 'InvalidStateError')
        pendingFileContents = new Blob([pendingFileContents, writtenData])
      },
      close: async () => {
        isWritableStreamOpen = false
        if (this.shouldFailNextWriteClose) {
          this.shouldFailNextWriteClose = false
          throw createFakeDomException('The disk is full.', 'QuotaExceededError')
        }
        // Like Chrome: the new contents replace the old ones only when the stream closes.
        this.fakeFileContents = pendingFileContents
      },
      abort: async () => {
        isWritableStreamOpen = false
      },
    }
  }
}

export class PapelizFakeDirectoryHandle extends PapelizFakeHandleBase {
  readonly kind = 'directory' as const
  readonly fakeChildHandles = new Map<string, PapelizFakeEntryHandle>()

  private findFakeChildHandle(childEntryName: string): PapelizFakeEntryHandle | undefined {
    const lowerCaseChildEntryName = childEntryName.toLowerCase()
    for (const [existingChildName, existingChildHandle] of this.fakeChildHandles) {
      if (existingChildName.toLowerCase() === lowerCaseChildEntryName) return existingChildHandle
    }
    return undefined
  }

  async getDirectoryHandle(childDirectoryName: string, handleOptions: { create?: boolean } = {}): Promise<PapelizFakeDirectoryHandle> {
    const existingChildHandle = this.findFakeChildHandle(childDirectoryName)
    if (existingChildHandle?.kind === 'directory') return existingChildHandle
    if (existingChildHandle?.kind === 'file') throw createFakeDomException(`${childDirectoryName} is a file.`, 'TypeMismatchError')
    if (!handleOptions.create) throw createFakeDomException(`${childDirectoryName} was not found.`, 'NotFoundError')
    const createdDirectoryHandle = new PapelizFakeDirectoryHandle(childDirectoryName)
    this.fakeChildHandles.set(childDirectoryName, createdDirectoryHandle)
    return createdDirectoryHandle
  }

  async getFileHandle(childFileName: string, handleOptions: { create?: boolean } = {}): Promise<PapelizFakeFileHandle> {
    const existingChildHandle = this.findFakeChildHandle(childFileName)
    if (existingChildHandle?.kind === 'file') return existingChildHandle
    if (existingChildHandle?.kind === 'directory') throw createFakeDomException(`${childFileName} is a folder.`, 'TypeMismatchError')
    if (!handleOptions.create) throw createFakeDomException(`${childFileName} was not found.`, 'NotFoundError')
    const createdFileHandle = new PapelizFakeFileHandle(childFileName)
    this.fakeChildHandles.set(childFileName, createdFileHandle)
    return createdFileHandle
  }

  async removeEntry(childEntryName: string, removeOptions: { recursive?: boolean } = {}): Promise<void> {
    const existingChildHandle = this.findFakeChildHandle(childEntryName)
    if (existingChildHandle === undefined) throw createFakeDomException(`${childEntryName} was not found.`, 'NotFoundError')
    if (existingChildHandle.kind === 'directory' && existingChildHandle.fakeChildHandles.size > 0 && !removeOptions.recursive) {
      throw createFakeDomException(`${childEntryName} is not empty.`, 'InvalidModificationError')
    }
    this.fakeChildHandles.delete(existingChildHandle.name)
  }

  async *entries(): AsyncGenerator<[string, PapelizFakeEntryHandle]> {
    for (const childEntry of [...this.fakeChildHandles]) yield childEntry
  }

  async *keys(): AsyncGenerator<string> {
    for (const childEntryName of [...this.fakeChildHandles.keys()]) yield childEntryName
  }

  async *values(): AsyncGenerator<PapelizFakeEntryHandle> {
    for (const childEntryHandle of [...this.fakeChildHandles.values()]) yield childEntryHandle
  }

  asFileSystemDirectoryHandle(): FileSystemDirectoryHandle {
    return this as unknown as FileSystemDirectoryHandle
  }
}

// Builds a fake folder from paths: "Notes/Inbox.md" -> text. Paths ending in "/" are empty folders.
export async function createPapelizFakeVaultFolder(
  fakeVaultFolderName: string,
  fakeVaultFileContentsByRelativePath: Record<string, string>,
): Promise<PapelizFakeDirectoryHandle> {
  const fakeVaultRootHandle = new PapelizFakeDirectoryHandle(fakeVaultFolderName)
  for (const [fakeVaultRelativePath, fakeVaultFileContents] of Object.entries(fakeVaultFileContentsByRelativePath)) {
    const fakeVaultPathSegments = fakeVaultRelativePath.split('/')
    const fakeVaultFileName = fakeVaultPathSegments.pop() ?? ''
    let fakeVaultFolderHandle = fakeVaultRootHandle
    for (const fakeVaultPathSegment of fakeVaultPathSegments) {
      fakeVaultFolderHandle = await fakeVaultFolderHandle.getDirectoryHandle(fakeVaultPathSegment, { create: true })
    }
    if (fakeVaultFileName.length === 0) continue
    const fakeVaultFileHandle = await fakeVaultFolderHandle.getFileHandle(fakeVaultFileName, { create: true })
    fakeVaultFileHandle.fakeFileContents = new Blob([fakeVaultFileContents])
  }
  return fakeVaultRootHandle
}

// Reads the fake folder back as "path" -> text, folders as "path/", for easy comparisons.
export async function readPapelizFakeVaultFolder(fakeVaultRootHandle: PapelizFakeDirectoryHandle): Promise<Record<string, string>> {
  const fakeVaultFileContentsByRelativePath: Record<string, string> = {}
  const readFakeVaultFolder = async (fakeVaultFolderHandle: PapelizFakeDirectoryHandle, fakeVaultFolderPrefix: string) => {
    for (const [fakeChildEntryName, fakeChildEntryHandle] of fakeVaultFolderHandle.fakeChildHandles) {
      const fakeChildRelativePath = `${fakeVaultFolderPrefix}${fakeChildEntryName}`
      if (fakeChildEntryHandle.kind === 'directory') {
        fakeVaultFileContentsByRelativePath[`${fakeChildRelativePath}/`] = ''
        await readFakeVaultFolder(fakeChildEntryHandle, `${fakeChildRelativePath}/`)
      } else {
        fakeVaultFileContentsByRelativePath[fakeChildRelativePath] = await fakeChildEntryHandle.fakeFileContents.text()
      }
    }
  }
  await readFakeVaultFolder(fakeVaultRootHandle, '')
  return fakeVaultFileContentsByRelativePath
}
