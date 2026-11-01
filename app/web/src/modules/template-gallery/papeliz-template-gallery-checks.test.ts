import { describe, expect, it } from 'vitest'
import {
  computePapelizTemplateFileGitBlobSha1Hex,
  computePapelizTemplateFileSha256Base64,
  computePapelizTemplateIncludedFileListDigest,
  convertPapelizTemplatePathPatternToRegExp,
  detectPapelizTemplateLicenseId,
  hasNoFailedPapelizTemplateCheck,
  listPapelizTemplateFirstLookRelativePaths,
  parsePapelizTemplateManifest,
  runPapelizTemplateChecks,
} from './papeliz-template-gallery-checks'
import type { PapelizTemplateCheckId, PapelizTemplateCheckReport, PapelizTemplateFileList } from './papeliz-template-gallery-contract'
import {
  createGardenJournalTemplateFiles,
  gardenJournalCc0LicenseText,
  gardenJournalCcByLicenseText,
  gardenJournalCcBySaLicenseText,
  gardenJournalManifest,
  gardenJournalMitLicenseText,
  gardenJournalOtherLicenseText,
  type PapelizFixtureTemplateFiles,
} from './papeliz-template-gallery-fixtures.test-support'

function toFixtureBytes(fixtureFileContents: string | Uint8Array): Uint8Array {
  return typeof fixtureFileContents === 'string' ? new TextEncoder().encode(fixtureFileContents) : fixtureFileContents
}

// A template's files as jsDelivr lists them, and every one of them read.
async function listTemplateFixture(templateFixtureFiles: PapelizFixtureTemplateFiles): Promise<{ templateFileList: PapelizTemplateFileList; templateFileBytesByRelativePath: Map<string, Uint8Array> }> {
  const templateFileBytesByRelativePath = new Map(Object.entries(templateFixtureFiles).map(([fixtureRelativePath, fixtureFileContents]) => [fixtureRelativePath, toFixtureBytes(fixtureFileContents)]))
  const templateFileListEntries = []
  for (const [fixtureRelativePath, fixtureFileBytes] of templateFileBytesByRelativePath) {
    templateFileListEntries.push({
      templateFileRelativePath: fixtureRelativePath,
      templateFileByteCount: fixtureFileBytes.length,
      templateFileSha256Base64: await computePapelizTemplateFileSha256Base64(fixtureFileBytes),
      templateFileGitBlobSha1Hex: null,
      templateFileGitMode: null,
    })
  }
  return { templateFileList: { templateFileListEntries, isTemplateFileListTruncated: false, templateFileListSource: 'jsdelivr' }, templateFileBytesByRelativePath }
}

async function checkTemplateFixture(templateFixtureFiles: PapelizFixtureTemplateFiles, expectedTemplateIncludedFileListDigest: string | null = null): Promise<PapelizTemplateCheckReport> {
  const { templateFileList, templateFileBytesByRelativePath } = await listTemplateFixture(templateFixtureFiles)
  return runPapelizTemplateChecks({ templateFileList, templateFileBytesByRelativePath, expectedTemplateIncludedFileListDigest })
}

// A first look: only the manifest and the license file read.
async function checkTemplateFixtureFirstLook(templateFixtureFiles: PapelizFixtureTemplateFiles): Promise<PapelizTemplateCheckReport> {
  const { templateFileList, templateFileBytesByRelativePath } = await listTemplateFixture(templateFixtureFiles)
  const firstLookRelativePaths = listPapelizTemplateFirstLookRelativePaths(templateFileList)
  return runPapelizTemplateChecks({
    templateFileList,
    templateFileBytesByRelativePath: new Map([...templateFileBytesByRelativePath].filter(([fixtureRelativePath]) => firstLookRelativePaths.includes(fixtureRelativePath))),
    expectedTemplateIncludedFileListDigest: null,
  })
}

function findCheckResult(templateCheckReport: PapelizTemplateCheckReport, templateCheckId: PapelizTemplateCheckId) {
  const templateCheckResult = templateCheckReport.templateCheckResults.find((checkResult) => checkResult.templateCheckId === templateCheckId)
  if (templateCheckResult === undefined) throw new Error(`No ${templateCheckId} result`)
  return templateCheckResult
}

function listFailedCheckIds(templateCheckReport: PapelizTemplateCheckReport): PapelizTemplateCheckId[] {
  return templateCheckReport.templateCheckResults.filter((checkResult) => checkResult.templateCheckOutcome === 'failed').map((checkResult) => checkResult.templateCheckId)
}

describe('template checks', () => {
  it('passes a good template, with every result a plain sentence', async () => {
    const templateCheckReport = await checkTemplateFixture(createGardenJournalTemplateFiles())
    expect(listFailedCheckIds(templateCheckReport)).toEqual([])
    expect(templateCheckReport.isEveryTemplateCheckPassed).toBe(true)
    expect(templateCheckReport.templateCheckResults).toHaveLength(13)
    expect(templateCheckReport.templateLicenseId).toBe('MIT')
    for (const templateCheckResult of templateCheckReport.templateCheckResults) {
      expect(templateCheckResult.templateCheckSentence, templateCheckResult.templateCheckId).toMatch(/^[A-Z“0-9].*\.$/)
      expect(templateCheckResult.templateCheckSentence, templateCheckResult.templateCheckId).not.toMatch(/\(/)
    }
    // The manifest, drafts/ (excluded) and nothing else stay out; LICENSE comes along.
    expect(templateCheckReport.templateIncludedFileRelativePaths).toEqual([
      '.claude/settings.json',
      '.gitignore',
      '.papeliz/file-list-order.json',
      'Crops/Seeds.md',
      'Crops/Tomatoes.md',
      'LICENSE',
      'README.md',
      'Start here.md',
      'beds.png',
    ])
    expect(templateCheckReport.templateRunCommands).toEqual([])
    expect(templateCheckReport.templateIncludedFileListDigest).toMatch(/^[A-Za-z0-9+/]{43}=$/)
  })

  it('records the fingerprint of the included files only, and refuses files that don’t give it back', async () => {
    const templateFixtureFiles = createGardenJournalTemplateFiles()
    const firstReport = await checkTemplateFixture(templateFixtureFiles)
    const firstDigest = firstReport.templateIncludedFileListDigest ?? ''
    // An excluded file changing changes nothing.
    expect((await checkTemplateFixture({ ...templateFixtureFiles, 'drafts/Unfinished.md': '# changed' })).templateIncludedFileListDigest).toBe(firstDigest)
    expect((await checkTemplateFixture(templateFixtureFiles, firstDigest)).isEveryTemplateCheckPassed).toBe(true)
    const changedReport = await checkTemplateFixture({ ...templateFixtureFiles, 'Crops/Seeds.md': '# Seeds, changed after the check\n' }, firstDigest)
    expect(listFailedCheckIds(changedReport)).toEqual(['included-file-list-digest'])
    expect(findCheckResult(changedReport, 'included-file-list-digest').templateCheckSentence).toBe('These files aren’t the ones Papeliz checked at this commit. Try again later.')
  })

  it('works out the fingerprint from sorted path and SHA-256 lines', async () => {
    const includedFileDigest = await computePapelizTemplateIncludedFileListDigest(new Map([['b.md', 'BBBB'], ['a.md', 'AAAA']]))
    expect(includedFileDigest).toBe(await computePapelizTemplateFileSha256Base64(new TextEncoder().encode('a.md\tAAAA\nb.md\tBBBB')))
    // Git's blob id, as `git hash-object` gives it for "hello\n".
    expect(await computePapelizTemplateFileGitBlobSha1Hex(new TextEncoder().encode('hello\n'))).toBe('ce013625030ba8dba906f756967f9e9ca394464a')
  })

  it('refuses a script tag in a note, but not one in a code block', async () => {
    const templateCheckReport = await checkTemplateFixture({ ...createGardenJournalTemplateFiles(), 'Crops/Beans.md': '# Beans\n\n<script src="x.js"></script>\n' })
    expect(listFailedCheckIds(templateCheckReport)).toEqual(['notes-safe'])
    expect(findCheckResult(templateCheckReport, 'notes-safe').templateCheckSentence).toBe(
      '“Crops/Beans.md” has a <script> tag. Notes in a template can’t hold scripts, frames, forms or script links; take them out.',
    )
  })

  it('refuses on… attributes and script links in notes', async () => {
    const eventAttributeReport = await checkTemplateFixture({ ...createGardenJournalTemplateFiles(), 'Crops/Beans.md': '<img src="beds.png" onerror="alert(1)">\n' })
    expect(findCheckResult(eventAttributeReport, 'notes-safe').templateCheckSentence).toContain('has an on… attribute')
    const scriptLinkReport = await checkTemplateFixture({ ...createGardenJournalTemplateFiles(), 'Crops/Beans.md': '[click](javascript:alert(1))\n' })
    expect(findCheckResult(scriptLinkReport, 'notes-safe').templateCheckSentence).toContain('has a javascript: link')
    const dataLinkReport = await checkTemplateFixture({ ...createGardenJournalTemplateFiles(), 'Crops/Beans.md': '<a href="data:text/html,hi">x</a>\n' })
    expect(findCheckResult(dataLinkReport, 'notes-safe').templateCheckSentence).toContain('has a data: link')
  })

  it('takes a picture with metadata (it is stripped as the vault is made), but not a file whose bytes aren’t its name’s', async () => {
    expect((await checkTemplateFixture(createGardenJournalTemplateFiles())).isEveryTemplateCheckPassed).toBe(true)
    const fakePictureReport = await checkTemplateFixture({ ...createGardenJournalTemplateFiles(), 'photo.png': '# I am text' })
    expect(listFailedCheckIds(fakePictureReport)).toEqual(['file-types'])
    expect(findCheckResult(fakePictureReport, 'file-types').templateCheckSentence).toBe('“photo.png” isn’t the picture its name says. A template holds only text and PNG, JPEG or WebP pictures.')
  })

  it('refuses a binary file, a program and an SVG picture', async () => {
    const templateCheckReport = await checkTemplateFixture({
      ...createGardenJournalTemplateFiles(),
      'tools/setup.exe': new Uint8Array([0x4d, 0x5a, 0x90, 0x00]),
      'data/blob.txt': new Uint8Array([0x00, 0xff, 0xfe, 0x01]),
      'diagram.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    })
    expect(listFailedCheckIds(templateCheckReport)).toEqual(['file-types'])
    expect(findCheckResult(templateCheckReport, 'file-types').templateCheckSentence).toBe(
      '“data/blob.txt” isn’t text; “diagram.svg” is a picture type templates don’t take; “tools/setup.exe” isn’t text. A template holds only text and PNG, JPEG or WebP pictures.',
    )
  })

  it('refuses a file over 2 MB before its files are read, and too many files', async () => {
    const firstLookReport = await checkTemplateFixtureFirstLook({ ...createGardenJournalTemplateFiles(), 'Crops/Huge.md': `# Huge\n${'a'.repeat(2 * 1024 * 1024)}` })
    expect(listFailedCheckIds(firstLookReport)).toEqual(['file-count-and-size'])
    expect(findCheckResult(firstLookReport, 'file-count-and-size').templateCheckSentence).toBe('“Crops/Huge.md” is over 2 MB, the most one file can be. Make it smaller or leave it out.')
    expect(findCheckResult(firstLookReport, 'notes-safe').templateCheckOutcome).toBe('not-checked')

    const manyFiles = Object.fromEntries(Array.from({ length: 301 }, (_unused, noteIndex) => [`Notes/Note ${noteIndex}.md`, `# ${noteIndex}`]))
    const manyFilesReport = await checkTemplateFixture({ ...createGardenJournalTemplateFiles(), ...manyFiles })
    expect(findCheckResult(manyFilesReport, 'file-count-and-size').templateCheckSentence).toBe('It includes 310 files, and a template can have 300. Leave some out with templateExcludedPaths.')
  })

  it('leaves the file checks for later on a first look that passes', async () => {
    const firstLookReport = await checkTemplateFixtureFirstLook(createGardenJournalTemplateFiles())
    expect(findCheckResult(firstLookReport, 'license-allowed').templateCheckOutcome).toBe('passed')
    expect(hasNoFailedPapelizTemplateCheck(firstLookReport)).toBe(true)
    expect(firstLookReport.isEveryTemplateCheckPassed).toBe(false)
    expect(findCheckResult(firstLookReport, 'file-types')).toMatchObject({ templateCheckOutcome: 'not-checked', templateCheckSentence: 'Checked once the files are read.' })
  })

  it('reads the license from the LICENSE file, on a first look, and refuses one off the list', async () => {
    const otherLicenseReport = await checkTemplateFixtureFirstLook({ ...createGardenJournalTemplateFiles(), LICENSE: gardenJournalOtherLicenseText })
    expect(listFailedCheckIds(otherLicenseReport)).toEqual(['license-allowed'])
    expect(findCheckResult(otherLicenseReport, 'license-allowed').templateCheckSentence).toBe(
      '“LICENSE” isn’t the text of CC0 1.0, CC BY 4.0 or MIT, the licenses a template can have. Put one of them in it, then check again.',
    )
    const { LICENSE: _license, ...filesWithoutLicense } = createGardenJournalTemplateFiles()
    const noLicenseReport = await checkTemplateFixture(filesWithoutLicense)
    expect(findCheckResult(noLicenseReport, 'license-allowed').templateCheckSentence).toBe('There’s no LICENSE file at the repository’s root. Add one with the text of CC0 1.0, CC BY 4.0 or MIT.')
    const ccByReport = await checkTemplateFixture({ ...filesWithoutLicense, 'LICENSE.md': gardenJournalCcByLicenseText })
    expect(findCheckResult(ccByReport, 'license-allowed').templateCheckSentence).toBe('Its license is CC BY 4.0.')
    expect(ccByReport.templateIncludedFileRelativePaths).toContain('LICENSE.md')
  })

  it('knows the three licenses by their standard text', () => {
    expect(detectPapelizTemplateLicenseId(gardenJournalMitLicenseText)).toBe('MIT')
    expect(detectPapelizTemplateLicenseId(`# MIT License\n\n${gardenJournalMitLicenseText.replace('MIT License', '')}`)).toBe('MIT')
    expect(detectPapelizTemplateLicenseId(gardenJournalMitLicenseText.replace('2026 Garden Notes', 'Garden Notes <notes@example.com> (https://example.com)'))).toBe('MIT')
    expect(detectPapelizTemplateLicenseId(gardenJournalCc0LicenseText)).toBe('CC0-1.0')
    expect(detectPapelizTemplateLicenseId(gardenJournalCcByLicenseText)).toBe('CC-BY-4.0')
    expect(detectPapelizTemplateLicenseId(gardenJournalCcBySaLicenseText)).toBeNull()
    expect(detectPapelizTemplateLicenseId(gardenJournalOtherLicenseText)).toBeNull()
    // MIT with a clause added, or without its notice paragraph (MIT No Attribution), isn't MIT.
    expect(detectPapelizTemplateLicenseId(`${gardenJournalMitLicenseText}\nThe Software may not be used for evil.\n`)).toBeNull()
    expect(detectPapelizTemplateLicenseId(gardenJournalMitLicenseText.replace(/The above copyright notice[\s\S]*?Software\.\n/, ''))).toBeNull()
  })

  it('lists a hook command, an MCP server and script files under “Runs commands”, and still passes', async () => {
    const templateCheckReport = await checkTemplateFixture({
      ...createGardenJournalTemplateFiles(),
      '.claude/settings.json': JSON.stringify({
        hooks: { PostToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'npm run lint' }] }] },
        statusLine: { type: 'command', command: 'bash .claude/status.sh' },
      }),
      '.mcp.json': JSON.stringify({ mcpServers: { notes: { command: 'npx', args: ['notes-server', '--port', '3000'] } } }),
      'scripts/plant.sh': 'echo planting\n',
      'tools/water': '#!/usr/bin/env python3\nprint("water")\n',
    })
    expect(templateCheckReport.isEveryTemplateCheckPassed).toBe(true)
    expect(templateCheckReport.templateRunCommands).toEqual([
      { templateRunCommandKind: 'agent-setting-command', templateRunCommandSourceRelativePath: '.claude/settings.json', templateRunCommandText: 'npm run lint' },
      { templateRunCommandKind: 'agent-setting-command', templateRunCommandSourceRelativePath: '.claude/settings.json', templateRunCommandText: 'bash .claude/status.sh' },
      { templateRunCommandKind: 'agent-setting-command', templateRunCommandSourceRelativePath: '.mcp.json', templateRunCommandText: 'npx notes-server --port 3000' },
      { templateRunCommandKind: 'script-file', templateRunCommandSourceRelativePath: 'scripts/plant.sh', templateRunCommandText: 'plant.sh' },
      { templateRunCommandKind: 'script-file', templateRunCommandSourceRelativePath: 'tools/water', templateRunCommandText: 'water' },
    ])
  })

  it('refuses a Git LFS pointer, a truncated list and broken JSON', async () => {
    const lfsReport = await checkTemplateFixture({ ...createGardenJournalTemplateFiles(), 'big.png': 'version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 9000000\n' })
    expect(listFailedCheckIds(lfsReport)).toEqual(['file-types', 'no-git-lfs-pointers'])
    const jsonReport = await checkTemplateFixture({ ...createGardenJournalTemplateFiles(), '.claude/settings.json': '{ "permissions": ' })
    expect(listFailedCheckIds(jsonReport)).toEqual(['json-files-parse'])
    expect(findCheckResult(jsonReport, 'json-files-parse').templateCheckSentence).toBe('“.claude/settings.json” isn’t valid JSON. Fix it, then check again.')
    const { templateFileList, templateFileBytesByRelativePath } = await listTemplateFixture(createGardenJournalTemplateFiles())
    const truncatedReport = await runPapelizTemplateChecks({
      templateFileList: { ...templateFileList, isTemplateFileListTruncated: true },
      templateFileBytesByRelativePath,
      expectedTemplateIncludedFileListDigest: null,
    })
    expect(listFailedCheckIds(truncatedReport)).toEqual(['file-list-complete'])
  })

  it('refuses names Windows refuses, names that differ only by case, and paths too deep', async () => {
    const templateCheckReport = await checkTemplateFixture({
      ...createGardenJournalTemplateFiles(),
      'Crops/con.md': '# con',
      'Crops/tomatoes.md': '# again',
      'a/b/c/d/e/f/g/h/i/Deep.md': '# deep',
    })
    expect(listFailedCheckIds(templateCheckReport)).toEqual(['file-paths'])
    expect(findCheckResult(templateCheckReport, 'file-paths').templateCheckSentence).toBe(
      '“Crops/con.md” has a name Windows refuses; “a/b/c/d/e/f/g/h/i/Deep.md” is 9 folders deep; “Crops/Tomatoes.md” and “Crops/tomatoes.md” differ only by case. Rename them, then check again.',
    )
  })

  it('refuses a missing manifest, and a first note that isn’t included', async () => {
    const { 'papeliz-template.json': _manifest, ...filesWithoutManifest } = createGardenJournalTemplateFiles()
    const noManifestReport = await checkTemplateFixture(filesWithoutManifest)
    expect(listFailedCheckIds(noManifestReport)).toEqual(['manifest-valid'])
    expect(findCheckResult(noManifestReport, 'manifest-valid').templateCheckSentence).toBe('There’s no papeliz-template.json at the repository’s root. Add one to make it a template.')
    expect(findCheckResult(noManifestReport, 'file-types').templateCheckOutcome).toBe('not-checked')
    const excludedFirstNoteReport = await checkTemplateFixture({
      ...createGardenJournalTemplateFiles(),
      'papeliz-template.json': JSON.stringify({ ...gardenJournalManifest, templateExcludedPaths: ['Start here.md'] }),
    })
    expect(listFailedCheckIds(excludedFirstNoteReport)).toEqual(['first-note-present'])
  })

  it('reads the manifest strictly', () => {
    expect(parsePapelizTemplateManifest(JSON.stringify(gardenJournalManifest)).templateManifest).toMatchObject({ templateName: 'Garden Journal', templateThumbnailPicturePath: null })
    expect(parsePapelizTemplateManifest(JSON.stringify({ ...gardenJournalManifest, templateIncludePaths: ['**'] })).templateManifestProblemSentence).toBe(
      'The manifest has a field Papeliz doesn’t know, “templateIncludePaths”. Check its spelling.',
    )
    expect(parsePapelizTemplateManifest('{ nope').templateManifestProblemSentence).toBe('The manifest, papeliz-template.json, isn’t valid JSON. Fix it, then check again.')
    expect(parsePapelizTemplateManifest(JSON.stringify({ ...gardenJournalManifest, papelizTemplateManifestVersion: 2 })).templateManifest).toBeNull()
    expect(parsePapelizTemplateManifest(JSON.stringify({ ...gardenJournalManifest, templateFirstNotePath: '../outside.md' })).templateManifest).toBeNull()
    expect(parsePapelizTemplateManifest(JSON.stringify({ ...gardenJournalManifest, templateExcludedPaths: ['/abs/**'] })).templateManifest).toBeNull()
    expect(parsePapelizTemplateManifest(JSON.stringify({ ...gardenJournalManifest, templateTags: ['Not A Tag'] })).templateManifest).toBeNull()
    const { templateIncludedPaths: _included, templateExcludedPaths: _excluded, ...manifestWithoutPaths } = gardenJournalManifest
    expect(parsePapelizTemplateManifest(JSON.stringify(manifestWithoutPaths)).templateManifest).toMatchObject({ templateIncludedPaths: ['**'], templateExcludedPaths: [] })
  })

  it('matches path patterns from the root', () => {
    expect(convertPapelizTemplatePathPatternToRegExp('.github/**').test('.github/workflows/ci.yml')).toBe(true)
    expect(convertPapelizTemplatePathPatternToRegExp('**/*.md').test('README.md')).toBe(true)
    expect(convertPapelizTemplatePathPatternToRegExp('**/*.md').test('Crops/Tomatoes.md')).toBe(true)
    expect(convertPapelizTemplatePathPatternToRegExp('*.md').test('Crops/Tomatoes.md')).toBe(false)
    expect(convertPapelizTemplatePathPatternToRegExp('Crops/?eeds.md').test('Crops/Seeds.md')).toBe(true)
    expect(convertPapelizTemplatePathPatternToRegExp('a+b(c).md').test('a+b(c).md')).toBe(true)
  })
})
