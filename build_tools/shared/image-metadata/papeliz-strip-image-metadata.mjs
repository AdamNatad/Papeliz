#!/usr/bin/env node
// Papeliz image metadata remover. The per-OS scripts in build_tools/design/<os>/ call this file:
//   node build_tools/shared/image-metadata/papeliz-strip-image-metadata.mjs <file or folder>... [--check]
// It removes metadata from PNG, JPEG, WebP and SVG files in place: C2PA content credentials, EXIF,
// XMP, IPTC, text chunks, comments and editor data. Pixels and color profiles stay exactly as they
// were: a file is rewritten only after its image data is checked to be byte-identical. Folders are
// searched recursively, skipping dependencies, builds and Git. `--staged` cleans the images being
// committed and re-stages them; the Git pre-commit hook (`--install-git-hook`) runs it on every
// commit. Node.js only, no packages.

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const papelizStripImageMetadataUsage = `Papeliz image metadata remover

Usage:
  node build_tools/shared/image-metadata/papeliz-strip-image-metadata.mjs <file or folder>... [--check]
  node build_tools/shared/image-metadata/papeliz-strip-image-metadata.mjs --staged
  node build_tools/shared/image-metadata/papeliz-strip-image-metadata.mjs --install-git-hook

Removes C2PA content credentials, EXIF, XMP, IPTC, text chunks, comments and editor data from
PNG, JPEG, WebP and SVG files, in place. Pixels and color profiles are kept unchanged.

Options:
  --check             Report which files carry metadata without changing them (exits 1 if any do)
  --staged            Clean the images staged for the next commit and stage the cleaned files
  --install-git-hook  Install the Git pre-commit hook that runs --staged on every commit
  --help              Show this help
`

const papelizStripImageMetadataScriptPath = 'build_tools/shared/image-metadata/papeliz-strip-image-metadata.mjs'
const papelizMetadataPreCommitHookText = `#!/bin/sh
# Papeliz hard rule: no image enters Git with metadata (C2PA, EXIF, XMP and the like). Cleans every
# staged PNG, JPEG, WebP and SVG and stages the cleaned file. Local hook (.git/hooks), installed by:
#   node ${papelizStripImageMetadataScriptPath} --install-git-hook

if ! command -v node >/dev/null 2>&1; then
  echo "Papeliz: Node.js was not found, so image metadata could not be checked; commit refused." >&2
  exit 1
fi
exec node ${papelizStripImageMetadataScriptPath} --staged
`

const skippedFolderNames = new Set(['node_modules', '.git', '.next', 'out', 'dist', 'build', 'coverage', '.turbo'])
const imageFormatByExtension = { '.png': 'png', '.jpg': 'jpeg', '.jpeg': 'jpeg', '.webp': 'webp', '.svg': 'svg' }
const unsupportedImageExtensions = new Set(['.gif', '.ico', '.avif', '.heic', '.heif', '.tif', '.tiff', '.bmp'])

// ---------------------------------------------------------------- PNG

// Chunks that draw the picture or set its color; every other chunk (tEXt, zTXt, iTXt, eXIf, tIME,
// caBX for C2PA, and anything unknown) is metadata.
const pngImageChunkTypes = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT', 'pHYs', 'bKGD', 'acTL', 'fcTL', 'fdAT'])

function stripPngMetadata(pngFileBytes) {
  const pngSignatureBytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  if (!pngFileBytes.subarray(0, 8).equals(pngSignatureBytes)) throw new Error('not a PNG file')
  const keptParts = [pngSignatureBytes]
  const removedMetadataNames = []
  const originalImageDataParts = []
  let chunkOffset = 8
  while (chunkOffset < pngFileBytes.length) {
    const chunkLength = pngFileBytes.readUInt32BE(chunkOffset)
    const chunkType = pngFileBytes.toString('latin1', chunkOffset + 4, chunkOffset + 8)
    const wholeChunk = pngFileBytes.subarray(chunkOffset, chunkOffset + 12 + chunkLength)
    if (pngImageChunkTypes.has(chunkType)) {
      keptParts.push(wholeChunk)
      if (chunkType === 'IDAT' || chunkType === 'fdAT') originalImageDataParts.push(wholeChunk)
    } else {
      removedMetadataNames.push(chunkType === 'caBX' ? 'C2PA (caBX)' : chunkType)
    }
    chunkOffset += 12 + chunkLength
    if (chunkType === 'IEND') break
  }
  const strippedBytes = Buffer.concat(keptParts)
  return { strippedBytes, removedMetadataNames, imageDataCheck: () => readPngImageData(strippedBytes).equals(Buffer.concat(originalImageDataParts)) }
}

function readPngImageData(pngFileBytes) {
  const imageDataParts = []
  let chunkOffset = 8
  while (chunkOffset < pngFileBytes.length) {
    const chunkLength = pngFileBytes.readUInt32BE(chunkOffset)
    const chunkType = pngFileBytes.toString('latin1', chunkOffset + 4, chunkOffset + 8)
    if (chunkType === 'IDAT' || chunkType === 'fdAT') imageDataParts.push(pngFileBytes.subarray(chunkOffset, chunkOffset + 12 + chunkLength))
    chunkOffset += 12 + chunkLength
  }
  return Buffer.concat(imageDataParts)
}

// ---------------------------------------------------------------- JPEG

// Segments before the scan are kept unless they are metadata: APP1 (EXIF, XMP), APP11 (JUMBF, where
// C2PA lives), APP13 (IPTC), COM comments and other APPn. Kept APPn: JFIF/JFXX (APP0), the ICC color
// profile (APP2) and Adobe color transform (APP14). Everything from the first scan on is copied as is.
function jpegAppSegmentIsImageData(markerByte, segmentPayload) {
  const segmentSignature = segmentPayload.toString('latin1', 0, 12)
  if (markerByte === 0xe0) return segmentSignature.startsWith('JFIF\0') || segmentSignature.startsWith('JFXX\0')
  if (markerByte === 0xe2) return segmentSignature.startsWith('ICC_PROFILE\0')
  if (markerByte === 0xee) return segmentSignature.startsWith('Adobe')
  return false
}

function describeJpegMetadataSegment(markerByte, segmentPayload) {
  const segmentSignature = segmentPayload.toString('latin1', 0, 32)
  if (markerByte === 0xfe) return 'comment'
  if (markerByte === 0xe1 && segmentSignature.startsWith('Exif')) return 'EXIF'
  if (markerByte === 0xe1 && segmentSignature.includes('ns.adobe.com/xap')) return 'XMP'
  if (markerByte === 0xeb) return 'C2PA (JUMBF)'
  if (markerByte === 0xed) return 'IPTC'
  return `APP${markerByte - 0xe0}`
}

function stripJpegMetadata(jpegFileBytes) {
  if (jpegFileBytes[0] !== 0xff || jpegFileBytes[1] !== 0xd8) throw new Error('not a JPEG file')
  const keptParts = [jpegFileBytes.subarray(0, 2)]
  const removedMetadataNames = []
  let segmentOffset = 2
  let scanStartOffset = -1
  while (segmentOffset < jpegFileBytes.length) {
    if (jpegFileBytes[segmentOffset] !== 0xff) throw new Error(`unexpected byte at ${segmentOffset}`)
    let markerOffset = segmentOffset
    while (jpegFileBytes[markerOffset + 1] === 0xff) markerOffset++ // fill bytes
    const markerByte = jpegFileBytes[markerOffset + 1]
    if (markerByte === 0xda) {
      scanStartOffset = markerOffset
      break
    }
    if (markerByte === 0xd9 || (markerByte >= 0xd0 && markerByte <= 0xd7) || markerByte === 0x01) {
      keptParts.push(jpegFileBytes.subarray(markerOffset, markerOffset + 2))
      segmentOffset = markerOffset + 2
      continue
    }
    const segmentLength = jpegFileBytes.readUInt16BE(markerOffset + 2)
    const wholeSegment = jpegFileBytes.subarray(markerOffset, markerOffset + 2 + segmentLength)
    const segmentPayload = jpegFileBytes.subarray(markerOffset + 4, markerOffset + 2 + segmentLength)
    const isMetadataSegment = markerByte === 0xfe || (markerByte >= 0xe0 && markerByte <= 0xef && !jpegAppSegmentIsImageData(markerByte, segmentPayload))
    if (isMetadataSegment) removedMetadataNames.push(describeJpegMetadataSegment(markerByte, segmentPayload))
    else keptParts.push(wholeSegment)
    segmentOffset = markerOffset + 2 + segmentLength
  }
  if (scanStartOffset < 0) throw new Error('no image scan found')
  const originalScanBytes = jpegFileBytes.subarray(scanStartOffset)
  keptParts.push(originalScanBytes)
  const strippedBytes = Buffer.concat(keptParts)
  return {
    strippedBytes,
    removedMetadataNames,
    imageDataCheck: () => strippedBytes.subarray(strippedBytes.length - originalScanBytes.length).equals(originalScanBytes),
  }
}

// ---------------------------------------------------------------- WebP

// RIFF chunks EXIF, XMP and C2PA are metadata; the VP8X header's EXIF and XMP flags are cleared to match.
const webpImageChunkTypes = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF', 'ICCP'])

function stripWebpMetadata(webpFileBytes) {
  if (webpFileBytes.toString('latin1', 0, 4) !== 'RIFF' || webpFileBytes.toString('latin1', 8, 12) !== 'WEBP') throw new Error('not a WebP file')
  const keptChunks = []
  const removedMetadataNames = []
  const originalImageChunks = []
  let chunkOffset = 12
  while (chunkOffset + 8 <= webpFileBytes.length) {
    const chunkType = webpFileBytes.toString('latin1', chunkOffset, chunkOffset + 4)
    const chunkLength = webpFileBytes.readUInt32LE(chunkOffset + 4)
    const paddedChunkEnd = chunkOffset + 8 + chunkLength + (chunkLength % 2)
    const wholeChunk = Buffer.from(webpFileBytes.subarray(chunkOffset, paddedChunkEnd))
    if (webpImageChunkTypes.has(chunkType)) {
      if (chunkType === 'VP8X') wholeChunk[8] &= ~(0x08 | 0x04)
      keptChunks.push(wholeChunk)
      if (chunkType !== 'VP8X') originalImageChunks.push(wholeChunk)
    } else {
      removedMetadataNames.push(chunkType.trim() === 'C2PA' ? 'C2PA' : chunkType.trim())
    }
    chunkOffset = paddedChunkEnd
  }
  const riffHeader = Buffer.from(webpFileBytes.subarray(0, 12))
  const chunkBytes = Buffer.concat(keptChunks)
  riffHeader.writeUInt32LE(chunkBytes.length + 4, 4)
  const strippedBytes = Buffer.concat([riffHeader, chunkBytes])
  const keptImageBytes = Buffer.concat(originalImageChunks)
  return { strippedBytes, removedMetadataNames, imageDataCheck: () => strippedBytes.includes(keptImageBytes) }
}

// ---------------------------------------------------------------- SVG

// <metadata> blocks (where C2PA, RDF and licenses-as-data sit), comments, and Inkscape/Sodipodi
// editor views. The drawing itself is left untouched.
function stripSvgMetadata(svgFileBytes) {
  const svgText = svgFileBytes.toString('utf8')
  const removedMetadataNames = []
  const svgMetadataPatterns = [
    { metadataName: 'metadata', metadataPattern: /<metadata\b[^>]*\/>|<metadata\b[\s\S]*?<\/metadata>/gi },
    { metadataName: 'comment', metadataPattern: /<!--[\s\S]*?-->/g },
    { metadataName: 'editor view', metadataPattern: /<sodipodi:namedview\b[^>]*\/>|<sodipodi:namedview\b[\s\S]*?<\/sodipodi:namedview>/gi },
  ]
  let strippedText = svgText
  for (const { metadataName, metadataPattern } of svgMetadataPatterns) {
    strippedText = strippedText.replace(metadataPattern, () => {
      removedMetadataNames.push(metadataName)
      return ''
    })
  }
  const strippedBytes = Buffer.from(strippedText, 'utf8')
  return { strippedBytes, removedMetadataNames, imageDataCheck: () => /<svg\b/i.test(strippedText) }
}

const stripMetadataByImageFormat = { png: stripPngMetadata, jpeg: stripJpegMetadata, webp: stripWebpMetadata, svg: stripSvgMetadata }

// ---------------------------------------------------------------- files

async function collectImagePaths(inputPath, imagePaths, unsupportedImagePaths) {
  const inputStat = await stat(inputPath)
  if (inputStat.isDirectory()) {
    for (const directoryEntry of await readdir(inputPath, { withFileTypes: true })) {
      if (directoryEntry.isDirectory() && skippedFolderNames.has(directoryEntry.name)) continue
      if (directoryEntry.isDirectory() || directoryEntry.isFile()) {
        await collectImagePaths(path.join(inputPath, directoryEntry.name), imagePaths, unsupportedImagePaths)
      }
    }
    return
  }
  const imageExtension = path.extname(inputPath).toLowerCase()
  if (imageFormatByExtension[imageExtension]) imagePaths.push(inputPath)
  else if (unsupportedImageExtensions.has(imageExtension)) unsupportedImagePaths.push(inputPath)
}

function summarizeMetadataNames(removedMetadataNames) {
  const metadataCounts = new Map()
  for (const metadataName of removedMetadataNames) metadataCounts.set(metadataName, (metadataCounts.get(metadataName) ?? 0) + 1)
  return [...metadataCounts].map(([metadataName, metadataCount]) => (metadataCount > 1 ? `${metadataName} x${metadataCount}` : metadataName)).join(', ')
}

// ---------------------------------------------------------------- Git

function runGitCommand(gitArguments) {
  const gitResult = spawnSync('git', gitArguments, { encoding: 'utf8' })
  if (gitResult.status !== 0) throw new Error(`git ${gitArguments.join(' ')} failed: ${(gitResult.stderr || '').trim()}`)
  return gitResult.stdout
}

const splitGitPathList = (gitOutput) => gitOutput.split('\0').filter(Boolean)

// The images staged for the next commit (added, copied, modified or renamed), as repository paths.
function listStagedImagePaths() {
  return splitGitPathList(runGitCommand(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']))
    .filter((stagedPath) => imageFormatByExtension[path.extname(stagedPath).toLowerCase()])
}

async function installPapelizMetadataGitHook() {
  const repositoryRoot = runGitCommand(['rev-parse', '--show-toplevel']).trim()
  const gitHooksFolder = path.resolve(repositoryRoot, runGitCommand(['-C', repositoryRoot, 'rev-parse', '--git-path', 'hooks']).trim())
  const preCommitHookPath = path.join(gitHooksFolder, 'pre-commit')
  if (existsSync(preCommitHookPath)) {
    const existingHookText = await readFile(preCommitHookPath, 'utf8')
    if (existingHookText === papelizMetadataPreCommitHookText) {
      console.log(`  already installed: ${preCommitHookPath}`)
      return
    }
    if (!existingHookText.includes(`${papelizStripImageMetadataScriptPath} --staged`)) {
      throw new Error(`${preCommitHookPath} already exists. Add this line to it instead: node ${papelizStripImageMetadataScriptPath} --staged`)
    }
  }
  await mkdir(gitHooksFolder, { recursive: true })
  await writeFile(preCommitHookPath, papelizMetadataPreCommitHookText, { mode: 0o755 })
  console.log(`  installed: ${preCommitHookPath}`)
}

// ---------------------------------------------------------------- run

async function runPapelizStripImageMetadata() {
  const commandLineArguments = process.argv.slice(2)
  const knownOptions = new Set(['--check', '--staged', '--install-git-hook', '--help', '-h'])
  const unknownOptions = commandLineArguments.filter((commandLineArgument) => commandLineArgument.startsWith('-') && !knownOptions.has(commandLineArgument))
  if (unknownOptions.length) throw new Error(`Unknown option ${unknownOptions[0]}`)
  const isCheckOnly = commandLineArguments.includes('--check')
  const isStagedRun = commandLineArguments.includes('--staged')
  const inputPaths = commandLineArguments.filter((commandLineArgument) => !commandLineArgument.startsWith('-'))
  if (commandLineArguments.includes('--install-git-hook')) {
    await installPapelizMetadataGitHook()
    return
  }
  if (commandLineArguments.includes('--help') || commandLineArguments.includes('-h') || (inputPaths.length === 0 && !isStagedRun)) {
    process.stdout.write(papelizStripImageMetadataUsage)
    process.exitCode = commandLineArguments.includes('--help') || commandLineArguments.includes('-h') ? 0 : 1
    return
  }

  const imagePaths = []
  const unsupportedImagePaths = []
  if (isStagedRun) {
    // Re-staging a file with unstaged edits would commit those edits too, so such a file stops the commit.
    const unstagedPaths = new Set(splitGitPathList(runGitCommand(['diff', '--name-only', '-z'])))
    for (const stagedImagePath of listStagedImagePaths()) {
      if (unstagedPaths.has(stagedImagePath)) {
        console.error(`  failed    ${stagedImagePath}  (it also has unstaged changes; stage or discard them, then commit again)`)
        process.exitCode = 1
      } else {
        imagePaths.push(stagedImagePath)
      }
    }
    if (process.exitCode === 1) return
    if (imagePaths.length === 0) return
  } else {
    for (const inputPath of inputPaths) await collectImagePaths(inputPath, imagePaths, unsupportedImagePaths)
  }

  const strippedImagePaths = []
  let strippedFileCount = 0
  let cleanFileCount = 0
  let failedFileCount = 0
  for (const imagePath of imagePaths) {
    const imageFormat = imageFormatByExtension[path.extname(imagePath).toLowerCase()]
    try {
      const originalBytes = await readFile(imagePath)
      const { strippedBytes, removedMetadataNames, imageDataCheck } = stripMetadataByImageFormat[imageFormat](originalBytes)
      if (removedMetadataNames.length === 0) {
        cleanFileCount++
        console.log(`  clean     ${imagePath}`)
        continue
      }
      const metadataSummary = summarizeMetadataNames(removedMetadataNames)
      if (isCheckOnly) {
        strippedFileCount++
        console.log(`  metadata  ${imagePath}  (${metadataSummary})`)
        continue
      }
      if (!imageDataCheck()) throw new Error('image data would change; left as it was')
      // Write beside the file, then swap it in, so a failure never leaves a half-written image.
      const temporaryImagePath = `${imagePath}.papeliz-strip-metadata.tmp`
      await writeFile(temporaryImagePath, strippedBytes)
      await rename(temporaryImagePath, imagePath)
      strippedImagePaths.push(imagePath)
      strippedFileCount++
      console.log(`  stripped  ${imagePath}  (removed ${metadataSummary}; ${originalBytes.length.toLocaleString('en-US')} -> ${strippedBytes.length.toLocaleString('en-US')} bytes)`)
    } catch (stripError) {
      failedFileCount++
      console.error(`  failed    ${imagePath}  (${stripError.message})`)
    }
  }
  for (const unsupportedImagePath of unsupportedImagePaths) console.log(`  skipped   ${unsupportedImagePath}  (format not supported)`)
  if (isStagedRun && strippedImagePaths.length > 0) runGitCommand(['add', '--', ...strippedImagePaths])
  const strippedLabel = isCheckOnly ? 'with metadata' : 'stripped'
  const runLabel = isStagedRun ? 'staged images' : 'images'
  console.log(`\n  ${imagePaths.length} ${runLabel}: ${strippedFileCount} ${strippedLabel}, ${cleanFileCount} clean, ${failedFileCount} failed, ${unsupportedImagePaths.length} skipped`)
  if (failedFileCount > 0 || (isCheckOnly && strippedFileCount > 0)) process.exitCode = 1
}

runPapelizStripImageMetadata().catch((stripImageMetadataError) => {
  console.error(` [error] ${stripImageMetadataError.message}`)
  process.exitCode = 1
})
