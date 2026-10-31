import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test, type Browser, type Page } from '@playwright/test'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

// PDF export in real browser engines (Edge and WebKit): Export › PDF on the Export page writes the
// file itself, with no print window, on the paper chosen there, and pdf.js reads it back. The scripts
// test note's every line comes back as text: in WebKit and in an Edge that asks first, through
// pictures of the characters with the text over them; in an Edge allowed the computer's fonts, as text
// in those fonts. The save dialog can't be answered here, so every export downloads, as it does in
// browsers without one.

const scriptsAndEmojiNoteText = await readFile(new URL('../src/modules/export-print-style/papeliz-export-test-notes/papeliz-export-test-note-scripts-and-emoji.md', import.meta.url), 'utf8')

async function prepareExportPage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true, writable: true })
    const pageWithPrintCount = window as Window & { papelizPrintCallCount?: number }
    pageWithPrintCount.papelizPrintCallCount = 0
    window.print = () => {
      pageWithPrintCount.papelizPrintCallCount = (pageWithPrintCount.papelizPrintCallCount ?? 0) + 1
    }
  })
  await page.goto('/')
  await page.getByText('Try Sample').first().click()
  await expect(page.locator('.cm-content, .papeliz-md-view-article').first()).toBeVisible()
}

async function openExportPageWithPdf(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click()
  await page.getByRole('navigation', { name: 'Settings' }).getByRole('button', { name: 'Export' }).click()
  await page.getByRole('radio', { name: 'PDF' }).click()
}

// A new note in the sample vault holding this text.
async function addSampleVaultNote(page: Page, noteName: string, noteText: string): Promise<void> {
  await page.getByRole('button', { name: 'New note' }).first().click()
  await page.waitForFunction(() => document.activeElement instanceof HTMLInputElement)
  await page.keyboard.press('Control+a')
  await page.keyboard.type(noteName)
  await page.keyboard.press('Enter')
  await expect(page.locator('.cm-content').first()).toBeVisible()
  await page.evaluate((pastedNoteText) => {
    const noteEditorContent = Array.from(document.querySelectorAll<HTMLElement>('.cm-content')).filter((editorContent) => editorContent.offsetParent !== null).at(-1)
    if (noteEditorContent === undefined) throw new Error('No note editor')
    noteEditorContent.focus()
    const pastedData = new DataTransfer()
    pastedData.setData('text/plain', pastedNoteText)
    noteEditorContent.dispatchEvent(new ClipboardEvent('paste', { clipboardData: pastedData, bubbles: true, cancelable: true }))
  }, noteText)
}

// Presses Export and keeps the downloaded file; answers the computer-fonts question when it comes.
async function exportAndDownload(page: Page, computerFontsAnswer: 'Print them as pictures' | null = null): Promise<{ exportFileName: string; exportFileBytes: Uint8Array }> {
  const exportDownload = page.waitForEvent('download', { timeout: 120_000 })
  await page.getByRole('button', { name: /^Export (all notes |\d+ notes )?as PDF/ }).click()
  if (computerFontsAnswer !== null) {
    const computerFontsQuestion = page.getByText('Papeliz can use fonts on this computer. Nothing leaves your computer.')
    const isQuestionAsked = await computerFontsQuestion.waitFor({ timeout: 30_000 }).then(
      () => true,
      () => false,
    )
    if (isQuestionAsked) await page.getByRole('button', { name: computerFontsAnswer }).click()
  }
  const finishedDownload = await exportDownload
  const downloadedFilePath = await finishedDownload.path()
  return { exportFileName: finishedDownload.suggestedFilename(), exportFileBytes: new Uint8Array(await readFile(downloadedFilePath)) }
}

async function readPdfFile(pdfFileBytes: Uint8Array): Promise<{ pdfPageCount: number; pdfPageSize: [number, number]; pdfText: string }> {
  const pdfLoadingTask = getDocument({ data: pdfFileBytes.slice(), verbosity: 0, useSystemFonts: false, disableFontFace: true })
  const pdfDocument = await pdfLoadingTask.promise
  try {
    const pdfTextParts: string[] = []
    let pdfPageSize: [number, number] = [0, 0]
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const pdfPage = await pdfDocument.getPage(pageNumber)
      if (pageNumber === 1) pdfPageSize = [pdfPage.view[2] ?? 0, pdfPage.view[3] ?? 0]
      const textContent = await pdfPage.getTextContent()
      pdfTextParts.push((textContent.items as Array<{ str?: string }>).map((textItem) => textItem.str ?? '').join(''))
    }
    return { pdfPageCount: pdfDocument.numPages, pdfPageSize, pdfText: pdfTextParts.join('') }
  } finally {
    await pdfLoadingTask.destroy()
  }
}

function removeWhitespace(textWithWhitespace: string): string {
  return textWithWhitespace.replace(/\s+/g, '')
}

test('exports the open note as a PDF on the chosen paper, with no print window, and remembers the paper', async ({ page }) => {
  await prepareExportPage(page)
  await openExportPageWithPdf(page)
  await page.getByRole('radiogroup', { name: 'Paper' }).getByRole('radio', { name: 'Letter' }).click()
  const { exportFileName, exportFileBytes } = await exportAndDownload(page)
  expect(exportFileName).toBe('Start here.pdf')
  expect(new TextDecoder('latin1').decode(exportFileBytes.subarray(0, 8))).toBe('%PDF-1.7')
  await expect(page.getByText('Downloaded “Start here.pdf”.')).toBeVisible()
  const { pdfPageCount, pdfPageSize, pdfText } = await readPdfFile(exportFileBytes)
  expect(pdfPageCount).toBeGreaterThan(0)
  expect(pdfPageSize).toEqual([612, 792])
  expect(removeWhitespace(pdfText)).toContain('Starthere')
  expect(await page.evaluate(() => (window as Window & { papelizPrintCallCount?: number }).papelizPrintCallCount)).toBe(0)
  // A4 this time; after a reload the Export page still has it.
  await page.getByRole('radiogroup', { name: 'Paper' }).getByRole('radio', { name: 'A4' }).click()
  const { exportFileBytes: a4FileBytes } = await exportAndDownload(page)
  expect((await readPdfFile(a4FileBytes)).pdfPageSize).toEqual([595.28, 841.89])
  await page.reload()
  await page.getByText('Try Sample').first().click()
  await openExportPageWithPdf(page)
  await expect(page.getByRole('radiogroup', { name: 'Paper' }).getByRole('radio', { name: 'A4' })).toHaveAttribute('aria-checked', 'true')
})

test('prints every line of the scripts note as text, through pictures of the characters', async ({ page }) => {
  await prepareExportPage(page)
  await addSampleVaultNote(page, 'Scripts and emoji', scriptsAndEmojiNoteText)
  await openExportPageWithPdf(page)
  const { exportFileName, exportFileBytes } = await exportAndDownload(page, 'Print them as pictures')
  expect(exportFileName).toBe('Scripts and emoji.pdf')
  const { pdfText } = await readPdfFile(exportFileBytes)
  // Every line reads back in reading order, Arabic and Hebrew included.
  for (const scriptLine of scriptsAndEmojiNoteText.split('\n').filter((noteLine) => noteLine.trim().length > 0 && !noteLine.startsWith('#'))) {
    expect(removeWhitespace(pdfText), scriptLine).toContain(removeWhitespace(scriptLine))
  }
})

async function createPageWithComputerFonts(browser: Browser): Promise<Page> {
  const fontsContext = await browser.newContext({ permissions: ['local-fonts'] })
  return fontsContext.newPage()
}

test('uses the computer’s fonts without asking where the browser already allows them (Edge)', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'Only Chrome and Edge have Local Font Access.')
  const page = await createPageWithComputerFonts(browser)
  await prepareExportPage(page)
  await addSampleVaultNote(page, 'Scripts and emoji', scriptsAndEmojiNoteText)
  await openExportPageWithPdf(page)
  const { exportFileBytes } = await exportAndDownload(page)
  await expect(page.getByText('Papeliz can use fonts on this computer.')).toHaveCount(0)
  const { pdfText } = await readPdfFile(exportFileBytes)
  for (const scriptLine of scriptsAndEmojiNoteText.split('\n').filter((noteLine) => /^(Chinese|Japanese|Korean|Arabic|Hebrew):/.test(noteLine))) {
    expect(removeWhitespace(pdfText), scriptLine).toContain(removeWhitespace(scriptLine))
  }
  // A face of a font on this computer is embedded, where the computer has one Papeliz looks for.
  const hasKnownCjkFamily = await page.evaluate(async () => {
    const pageWithLocalFonts = window as Window & { queryLocalFonts?: () => Promise<Array<{ family: string }>> }
    const localFonts = (await pageWithLocalFonts.queryLocalFonts?.()) ?? []
    return localFonts.some((localFont) => ['Microsoft YaHei', 'Yu Gothic', 'Malgun Gothic', 'PingFang SC', 'Noto Sans CJK SC', 'Hiragino Sans'].includes(localFont.family))
  })
  const embeddedFontNames = Array.from(new TextDecoder('latin1').decode(exportFileBytes).matchAll(/\/BaseFont \/[A-Z]{6}\+([^\s/]+)/g), (fontNameMatch) => fontNameMatch[1] ?? '')
  if (hasKnownCjkFamily) expect(embeddedFontNames.some((embeddedFontName) => !/^(Figtree|NotoSans|PapelizCharacterPictures|CharisSIL|JetBrainsMono)/.test(embeddedFontName))).toBe(true)
  await page.context().close()
})

// For veraPDF's PDF/UA-1 check (`verapdf --flavour ua1 <folder>`, once the .zip is unpacked): the
// sample vault with every export test note added, exported from the Export page into the folder
// PAPELIZ_PDF_EXPORT_VERAPDF_FOLDER names. Skipped when it isn't set.
const pdfExportVerapdfFolderPath = process.env.PAPELIZ_PDF_EXPORT_VERAPDF_FOLDER ?? ''

async function exportEveryNoteForVerapdf(page: Page, verapdfZipFileName: string, computerFontsAnswer: 'Print them as pictures' | null): Promise<void> {
  await prepareExportPage(page)
  const exportTestNotesFolderUrl = new URL('../src/modules/export-print-style/papeliz-export-test-notes/', import.meta.url)
  for (const testNoteFileName of (await readdir(exportTestNotesFolderUrl)).sort()) {
    const testNoteNameSlug = /^papeliz-export-test-note-([\w-]+)\.md$/.exec(testNoteFileName)?.[1]
    if (testNoteNameSlug === undefined || testNoteNameSlug === 'empty') continue
    const testNoteName = testNoteNameSlug.charAt(0).toUpperCase() + testNoteNameSlug.slice(1).replace(/-/g, ' ')
    await addSampleVaultNote(page, testNoteName, await readFile(new URL(testNoteFileName, exportTestNotesFolderUrl), 'utf8'))
  }
  await openExportPageWithPdf(page)
  await page.getByRole('button', { name: 'Select all' }).click()
  const { exportFileBytes } = await exportAndDownload(page, computerFontsAnswer)
  await mkdir(pdfExportVerapdfFolderPath, { recursive: true })
  await writeFile(join(pdfExportVerapdfFolderPath, verapdfZipFileName), exportFileBytes)
}

test('writes every note as a PDF for veraPDF, with pictures of the characters', async ({ page, browserName }) => {
  test.skip(pdfExportVerapdfFolderPath === '', 'Set PAPELIZ_PDF_EXPORT_VERAPDF_FOLDER to write the files.')
  test.setTimeout(300_000)
  await exportEveryNoteForVerapdf(page, `${browserName} character pictures.zip`, 'Print them as pictures')
})

test('writes every note as a PDF for veraPDF, in the computer’s fonts (Edge)', async ({ browser, browserName }) => {
  test.skip(pdfExportVerapdfFolderPath === '', 'Set PAPELIZ_PDF_EXPORT_VERAPDF_FOLDER to write the files.')
  test.skip(browserName !== 'chromium', 'Only Chrome and Edge have Local Font Access.')
  test.setTimeout(300_000)
  const page = await createPageWithComputerFonts(browser)
  await exportEveryNoteForVerapdf(page, `${browserName} computer fonts.zip`, null)
  await page.context().close()
})
