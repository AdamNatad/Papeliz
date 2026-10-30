import { createPapelizFakeVaultFolder } from './papeliz-fake-file-system-access.test-support'
import { describePapelizDirectoryHandleVaultAdapterCases, papelizDirectoryHandleTestVaultFiles } from './papeliz-directory-handle-vault-adapter.test-support'
import { PapelizFolderOnDiskVaultAdapter } from './papeliz-folder-on-disk-vault-adapter'

describePapelizDirectoryHandleVaultAdapterCases('a folder on disk', async () => {
  const fakeVaultRootHandle = await createPapelizFakeVaultFolder('Field Notes', papelizDirectoryHandleTestVaultFiles)
  return { fakeVaultRootHandle, directoryHandleVaultAdapter: new PapelizFolderOnDiskVaultAdapter(fakeVaultRootHandle.asFileSystemDirectoryHandle()) }
})
