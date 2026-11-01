import { describe, expect, it } from 'vitest'
import { createPapelizFakeBrowserVaultEnvironment, getPapelizFakeBrowserVaultFolder } from '../vault/papeliz-fake-browser-vault-environment.test-support'
import { PapelizFakeDirectoryHandle, addPapelizFakeVaultFiles } from '../vault/papeliz-fake-file-system-access.test-support'
import { createPapelizBrowserVault } from '../vault/papeliz-browser-vaults'
import type { PapelizTemplateSourceFile } from './papeliz-template-gallery-contract'
import { createJpegPictureWithMetadata, createJpegPictureWithoutMetadata, createPngPictureWithMetadata, createPngPictureWithoutMetadata } from './papeliz-template-gallery-fixtures.test-support'
import {
  createPapelizTemplateSourceVaultFile,
  makePapelizTemplateBrowserVault,
  makePapelizTemplateFolderVault,
  preparePapelizTemplateVaultFiles,
  type PapelizTemplateVaultFile,
} from './papeliz-template-gallery-vault-maker'

const gardenJournalSourceFile: PapelizTemplateSourceFile = {
  papelizTemplateSourceFileVersion: 1,
  papelizTemplateGalleryId: 'garden-notes/Garden-Journal',
  templateSourceCommitSha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
  templateSourceName: 'Garden Journal',
  templateSourceAuthor: 'garden-notes',
  templateSourceLicenseId: 'MIT',
  templateSourceVaultMadeAt: '2026-11-02T09:30:00.000Z',
}

function createIncludedTemplateFiles(): Map<string, Uint8Array> {
  return new Map<string, Uint8Array>([
    ['Start here.md', new TextEncoder().encode('# Start here\n')],
    ['Crops/Tomatoes.md', new TextEncoder().encode('# Tomatoes\n')],
    ['beds.png', createPngPictureWithMetadata()],
    ['Photos/harvest.jpg', createJpegPictureWithMetadata()],
    // Named a WebP, but cut short: it can't be stripped.
    ['Photos/broken.webp', new TextEncoder().encode('RIFF\u0004\u0000\u0000\u0000WEBP')],
    ['.gitignore', new TextEncoder().encode('drafts/\n')],
    ['.claude/settings.json', new TextEncoder().encode('{}')],
    ['.papeliz/file-list-order.json', new TextEncoder().encode('{"order":[]}')],
  ])
}

function prepareGardenJournalVaultFiles(): { templateVaultFiles: PapelizTemplateVaultFile[]; preparedTemplateVaultFiles: ReturnType<typeof preparePapelizTemplateVaultFiles> } {
  const preparedTemplateVaultFiles = preparePapelizTemplateVaultFiles(createIncludedTemplateFiles())
  return { preparedTemplateVaultFiles, templateVaultFiles: [...preparedTemplateVaultFiles.preparedTemplateVaultFiles, createPapelizTemplateSourceVaultFile(gardenJournalSourceFile)] }
}

// Every file in a fake folder, by path, as bytes.
async function readFakeFolderFileBytes(fakeFolderHandle: PapelizFakeDirectoryHandle, fakeFolderPrefix = ''): Promise<Map<string, Uint8Array>> {
  const fakeFileBytesByRelativePath = new Map<string, Uint8Array>()
  for (const [fakeChildEntryName, fakeChildEntryHandle] of fakeFolderHandle.fakeChildHandles) {
    if (fakeChildEntryHandle.kind === 'directory') {
      for (const [nestedRelativePath, nestedFileBytes] of await readFakeFolderFileBytes(fakeChildEntryHandle, `${fakeFolderPrefix}${fakeChildEntryName}/`)) fakeFileBytesByRelativePath.set(nestedRelativePath, nestedFileBytes)
    } else {
      fakeFileBytesByRelativePath.set(`${fakeFolderPrefix}${fakeChildEntryName}`, new Uint8Array(await fakeChildEntryHandle.fakeFileContents.arrayBuffer()))
    }
  }
  return fakeFileBytesByRelativePath
}

describe('template vault maker', () => {
  it('strips every picture, leaves out one that can’t be, and names the hidden files Sync won’t carry', () => {
    const { preparedTemplateVaultFiles } = prepareGardenJournalVaultFiles()
    const preparedBytesByRelativePath = new Map(preparedTemplateVaultFiles.preparedTemplateVaultFiles.map(({ templateFileRelativePath, templateFileBytes }) => [templateFileRelativePath, templateFileBytes]))
    expect(preparedBytesByRelativePath.get('beds.png')).toEqual(createPngPictureWithoutMetadata())
    expect(preparedBytesByRelativePath.get('Photos/harvest.jpg')).toEqual(createJpegPictureWithoutMetadata())
    expect(preparedBytesByRelativePath.has('Photos/broken.webp')).toBe(false)
    expect(preparedTemplateVaultFiles.templateLeftOutPictureRelativePaths).toEqual(['Photos/broken.webp'])
    expect(preparedTemplateVaultFiles.templateHiddenFileRelativePaths).toEqual(['.claude/settings.json', '.gitignore'])
  })

  it('makes a browser vault with the template’s files and its source file, and opens it', async () => {
    const { browserVaultEnvironment, fakeOriginPrivateFileSystemRoot } = createPapelizFakeBrowserVaultEnvironment()
    const { templateVaultFiles } = prepareGardenJournalVaultFiles()
    const writeProgressSteps: string[] = []
    const openVaultResult = await makePapelizTemplateBrowserVault('My Garden', templateVaultFiles, {
      browserVaultEnvironment,
      onTemplateVaultWriteProgress: (templateWrittenFileCount, templateFileCount) => writeProgressSteps.push(`${templateWrittenFileCount}/${templateFileCount}`),
    })
    if (openVaultResult.openVaultOutcome !== 'opened') throw new Error(`The vault wasn’t opened: ${JSON.stringify(openVaultResult)}`)
    expect(openVaultResult.papelizOpenVault.papelizVaultDisplayName).toBe('My Garden')
    expect(openVaultResult.papelizOpenVault.papelizVaultAdapter.papelizVaultKind).toBe('browser-vault-in-opfs')
    expect(writeProgressSteps.at(-1)).toBe('8/8')
    const madeVaultFiles = await readFakeFolderFileBytes(await getPapelizFakeBrowserVaultFolder(fakeOriginPrivateFileSystemRoot, openVaultResult.papelizOpenVault.papelizVaultId))
    expect([...madeVaultFiles.keys()].sort()).toEqual([
      '.claude/settings.json',
      '.gitignore',
      '.papeliz/browser-vault.json',
      '.papeliz/file-list-order.json',
      '.papeliz/template-source.json',
      'Crops/Tomatoes.md',
      'Photos/harvest.jpg',
      'Start here.md',
      'beds.png',
    ])
    expect(madeVaultFiles.get('beds.png')).toEqual(createPngPictureWithoutMetadata())
    expect(JSON.parse(new TextDecoder().decode(madeVaultFiles.get('.papeliz/template-source.json')))).toEqual(gardenJournalSourceFile)
    openVaultResult.papelizOpenVault.papelizVaultAdapter.closeVaultAdapter?.()
  })

  it('says a taken browser vault name in a sentence, and makes nothing', async () => {
    const { browserVaultEnvironment, fakeBrowserVaultRecordsById } = createPapelizFakeBrowserVaultEnvironment()
    await createPapelizBrowserVault('My Garden', browserVaultEnvironment)
    const openVaultResult = await makePapelizTemplateBrowserVault('my garden', prepareGardenJournalVaultFiles().templateVaultFiles, { browserVaultEnvironment })
    expect(openVaultResult).toEqual({ openVaultOutcome: 'failed', openVaultFailureMessage: 'Couldn’t make “my garden”. A vault named “my garden” already exists. Pick another name.' })
    expect(fakeBrowserVaultRecordsById.size).toBe(1)
  })

  it('makes a folder vault inside the folder picked, and opens it', async () => {
    const pickedPlaceFolder = new PapelizFakeDirectoryHandle('Documents')
    const openVaultResult = await makePapelizTemplateFolderVault('My Garden', prepareGardenJournalVaultFiles().templateVaultFiles, {
      pickTemplateVaultPlaceFolder: async () => ({ vaultFolderPickOutcome: 'picked', papelizVaultFolderHandle: pickedPlaceFolder.asFileSystemDirectoryHandle() }),
    })
    if (openVaultResult.openVaultOutcome !== 'opened') throw new Error(`The vault wasn’t opened: ${JSON.stringify(openVaultResult)}`)
    expect(openVaultResult.papelizOpenVault.papelizVaultDisplayName).toBe('My Garden')
    expect(openVaultResult.papelizOpenVault.papelizVaultAdapter.papelizVaultKind).toBe('folder-on-disk')
    const madeVaultFiles = await readFakeFolderFileBytes(await pickedPlaceFolder.getDirectoryHandle('My Garden'))
    expect(madeVaultFiles.get('Photos/harvest.jpg')).toEqual(createJpegPictureWithoutMetadata())
    expect(madeVaultFiles.has('.papeliz/template-source.json')).toBe(true)
    expect(madeVaultFiles.has('.papeliz/browser-vault.json')).toBe(false)
  })

  it('turns down a place that already has a folder of that name with files in it, and a closed folder window', async () => {
    const pickedPlaceFolder = new PapelizFakeDirectoryHandle('Documents')
    await addPapelizFakeVaultFiles(pickedPlaceFolder, { 'My Garden/Old.md': '# old' })
    const takenResult = await makePapelizTemplateFolderVault('My Garden', prepareGardenJournalVaultFiles().templateVaultFiles, {
      pickTemplateVaultPlaceFolder: async () => ({ vaultFolderPickOutcome: 'picked', papelizVaultFolderHandle: pickedPlaceFolder.asFileSystemDirectoryHandle() }),
    })
    expect(takenResult).toEqual({ openVaultOutcome: 'failed', openVaultFailureMessage: 'A folder named “My Garden” is already there. Pick another name or another place.' })
    const cancelledResult = await makePapelizTemplateFolderVault('My Garden', prepareGardenJournalVaultFiles().templateVaultFiles, {
      pickTemplateVaultPlaceFolder: async () => ({ openVaultOutcome: 'cancelled' }),
    })
    expect(cancelledResult).toEqual({ openVaultOutcome: 'cancelled' })
  })

  it('says how far a folder vault got when its writing stops partway', async () => {
    const pickedPlaceFolder = new PapelizFakeDirectoryHandle('Documents')
    let writtenFileCount = 0
    const openVaultResult = await makePapelizTemplateFolderVault('My Garden', prepareGardenJournalVaultFiles().templateVaultFiles, {
      pickTemplateVaultPlaceFolder: async () => ({ vaultFolderPickOutcome: 'picked', papelizVaultFolderHandle: pickedPlaceFolder.asFileSystemDirectoryHandle() }),
      folderVaultFileContentsWriter: async () => {
        writtenFileCount += 1
        if (writtenFileCount === 3) throw new DOMException('Full.', 'QuotaExceededError')
      },
    })
    expect(openVaultResult).toEqual({
      openVaultOutcome: 'failed',
      openVaultFailureMessage: 'Couldn’t finish “My Garden”. The disk is full. Free some space, then try again. The 2 files written so far stay in its folder.',
    })
  })
})
