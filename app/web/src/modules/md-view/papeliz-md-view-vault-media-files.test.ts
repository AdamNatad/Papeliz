import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PapelizInMemoryVaultAdapter } from '../vault/papeliz-in-memory-vault-adapter'
import { findPapelizMdViewVaultMediaFile, holdPapelizMdViewVaultMediaUrl } from './papeliz-md-view-vault-media-files'

// A few bytes stand in for each file: MD View never looks inside a picture, it only types and shows it.
async function createTestVaultWithMedia(): Promise<PapelizInMemoryVaultAdapter> {
  const testVaultAdapter = new PapelizInMemoryVaultAdapter([{ vaultNoteRelativePath: 'Guides/Start.md', vaultNoteText: '# Start\n' }])
  await testVaultAdapter.createVaultAttachmentFile('Guides/pictures/plan.png', new Blob([new Uint8Array([137, 80, 78, 71])]))
  await testVaultAdapter.createVaultAttachmentFile('logo.svg', new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>']))
  await testVaultAdapter.createVaultAttachmentFile('Clips/demo.mp4', new Blob([new Uint8Array([0, 0, 0, 24])]))
  return testVaultAdapter
}

let createdTestObjectUrls: Blob[] = []

beforeEach(() => {
  createdTestObjectUrls = []
  vi.spyOn(URL, 'createObjectURL').mockImplementation((mediaBlob) => {
    createdTestObjectUrls.push(mediaBlob as Blob)
    return `blob:papeliz-test/${createdTestObjectUrls.length}`
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('finding a note’s vault pictures', () => {
  it('finds a file beside the note, from the vault’s top, and by name, as the exports do', async () => {
    const testVaultAdapter = await createTestVaultWithMedia()
    expect(await findPapelizMdViewVaultMediaFile(testVaultAdapter, 'pictures/plan.png', 'Guides/Start.md')).toBe('Guides/pictures/plan.png')
    expect(await findPapelizMdViewVaultMediaFile(testVaultAdapter, '../logo.svg', 'Guides/Start.md')).toBe('logo.svg')
    expect(await findPapelizMdViewVaultMediaFile(testVaultAdapter, 'PLAN.png', 'Start.md')).toBe('Guides/pictures/plan.png')
    expect(await findPapelizMdViewVaultMediaFile(testVaultAdapter, 'Clips/demo.mp4', null)).toBe('Clips/demo.mp4')
    expect(await findPapelizMdViewVaultMediaFile(testVaultAdapter, '../../outside.png', 'Guides/Start.md')).toBeNull()
  })

  it('reads the vault’s list again for a picture that wasn’t in it, at most every two seconds', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const testVaultAdapter = await createTestVaultWithMedia()
    const listingSpy = vi.spyOn(testVaultAdapter, 'listVaultAttachmentFileRelativePaths')
    expect(await findPapelizMdViewVaultMediaFile(testVaultAdapter, 'new.png', 'Guides/Start.md')).toBeNull()
    await testVaultAdapter.createVaultAttachmentFile('new.png', new Blob([new Uint8Array([1])]))
    // Read moments ago: not read again yet.
    expect(await findPapelizMdViewVaultMediaFile(testVaultAdapter, 'new.png', 'Guides/Start.md')).toBeNull()
    const listingCountBeforeWait = listingSpy.mock.calls.length
    vi.setSystemTime(Date.now() + 2_500)
    expect(await findPapelizMdViewVaultMediaFile(testVaultAdapter, 'new.png', 'Guides/Start.md')).toBe('new.png')
    expect(listingSpy.mock.calls.length).toBe(listingCountBeforeWait + 1)
  })
})

describe('holding a vault picture’s URL', () => {
  it('shows a picture or video from a blob: URL typed by its extension, shared while held, and frees it after the last release', async () => {
    vi.useFakeTimers()
    const testVaultAdapter = await createTestVaultWithMedia()
    const firstPictureHold = holdPapelizMdViewVaultMediaUrl(testVaultAdapter, 'pictures/plan.png', 'Guides/Start.md')
    const secondPictureHold = holdPapelizMdViewVaultMediaUrl(testVaultAdapter, 'plan.png', 'Guides/Start.md')
    const firstPictureUrl = await firstPictureHold.vaultMediaUrlPromise
    expect(firstPictureUrl).toBe('blob:papeliz-test/1')
    expect(await secondPictureHold.vaultMediaUrlPromise).toBe(firstPictureUrl)
    expect(createdTestObjectUrls.map((mediaBlob) => mediaBlob.type)).toEqual(['image/png'])

    firstPictureHold.releaseVaultMediaUrl()
    secondPictureHold.releaseVaultMediaUrl()
    secondPictureHold.releaseVaultMediaUrl()
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(20_000)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(firstPictureUrl)

    const videoHold = holdPapelizMdViewVaultMediaUrl(testVaultAdapter, 'Clips/demo.mp4', null)
    expect(await videoHold.vaultMediaUrlPromise).toBe('blob:papeliz-test/2')
    expect(createdTestObjectUrls[1]?.type).toBe('video/mp4')
    videoHold.releaseVaultMediaUrl()
  })

  it('keeps a URL that is held again before it would be freed', async () => {
    vi.useFakeTimers()
    const testVaultAdapter = await createTestVaultWithMedia()
    const firstPictureHold = holdPapelizMdViewVaultMediaUrl(testVaultAdapter, 'logo.svg', null)
    await firstPictureHold.vaultMediaUrlPromise
    firstPictureHold.releaseVaultMediaUrl()
    await vi.advanceTimersByTimeAsync(10_000)
    const againPictureHold = holdPapelizMdViewVaultMediaUrl(testVaultAdapter, 'logo.svg', null)
    expect(await againPictureHold.vaultMediaUrlPromise).toBe(await firstPictureHold.vaultMediaUrlPromise)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    againPictureHold.releaseVaultMediaUrl()
  })

  it('shows an SVG picture from a data: URL, never a blob: URL of the app’s origin', async () => {
    const testVaultAdapter = await createTestVaultWithMedia()
    const svgPictureHold = holdPapelizMdViewVaultMediaUrl(testVaultAdapter, 'logo.svg', null)
    const svgPictureUrl = await svgPictureHold.vaultMediaUrlPromise
    expect(svgPictureUrl).toBe(`data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg"/>')}`)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    svgPictureHold.releaseVaultMediaUrl()
  })

  it('gives null for a missing file, a file that isn’t a picture or video, and a file that can’t be read', async () => {
    const testVaultAdapter = await createTestVaultWithMedia()
    await testVaultAdapter.createVaultAttachmentFile('page.html', new Blob(['<script>alert(1)</script>']))
    expect(await holdPapelizMdViewVaultMediaUrl(testVaultAdapter, 'missing.png', null).vaultMediaUrlPromise).toBeNull()
    expect(await holdPapelizMdViewVaultMediaUrl(testVaultAdapter, 'page.html', null).vaultMediaUrlPromise).toBeNull()
    vi.spyOn(testVaultAdapter, 'readVaultAttachmentFileBlob').mockRejectedValueOnce(new Error('File In Use'))
    expect(await holdPapelizMdViewVaultMediaUrl(testVaultAdapter, 'Clips/demo.mp4', null).vaultMediaUrlPromise).toBeNull()
    // The next picture that shows it tries the file again.
    expect(await holdPapelizMdViewVaultMediaUrl(testVaultAdapter, 'Clips/demo.mp4', null).vaultMediaUrlPromise).toMatch(/^blob:/)
  })

  it('reads nothing for a picture released before its file was found', async () => {
    const testVaultAdapter = await createTestVaultWithMedia()
    const readSpy = vi.spyOn(testVaultAdapter, 'readVaultAttachmentFileBlob')
    const releasedPictureHold = holdPapelizMdViewVaultMediaUrl(testVaultAdapter, 'pictures/plan.png', 'Guides/Start.md')
    releasedPictureHold.releaseVaultMediaUrl()
    expect(await releasedPictureHold.vaultMediaUrlPromise).toBeNull()
    expect(readSpy).not.toHaveBeenCalled()
  })
})
