// The parts of the File System Access API that Chrome and Edge ship but TypeScript's DOM types
// leave out, because other browsers don't have them yet.

type PapelizFileSystemPermissionMode = 'read' | 'readwrite'

interface PapelizFileSystemHandlePermissionDescriptor {
  mode?: PapelizFileSystemPermissionMode
}

interface PapelizDirectoryPickerOptions {
  id?: string
  mode?: PapelizFileSystemPermissionMode
  startIn?: 'desktop' | 'documents' | 'downloads' | FileSystemHandle
}

interface PapelizFileSystemHandleRemoveOptions {
  recursive?: boolean
}

interface FileSystemHandle {
  queryPermission(permissionDescriptor?: PapelizFileSystemHandlePermissionDescriptor): Promise<PermissionState>
  requestPermission(permissionDescriptor?: PapelizFileSystemHandlePermissionDescriptor): Promise<PermissionState>
  // Erases the entry itself from the disk (Chrome and Edge only, so it may be missing).
  remove?(handleRemoveOptions?: PapelizFileSystemHandleRemoveOptions): Promise<void>
}

interface Window {
  showDirectoryPicker?: (directoryPickerOptions?: PapelizDirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>
}
