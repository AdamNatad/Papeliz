#!/usr/bin/env node
// Repairs the site's static export after a Windows build.
//
// Next.js 16 writes one prefetch file per route segment, named like `__next.privacy.__PAGE__.txt`.
// It builds the segment path with the operating system's separator and then turns only "/" into
// ".", so on Windows the backslash survives and the file lands in a folder instead:
// `privacy/__next.privacy/__PAGE__.txt`. The browser requests the dot-joined name and gets a 404.
// This copies every file found under such a folder to the dot-joined name beside the folder. On
// Linux and macOS the export has no such folders, and this does nothing.
//
// Usage: node build_tools/site/papeliz-site-repair-windows-segment-files.mjs [exportDirectory]
// (default: site/main/out)

import { copyFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const papelizRepositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const siteExportDirectory = path.resolve(papelizRepositoryRoot, process.argv[2] ?? 'site/main/out')
const misplacedSegmentFolderPrefix = '__next.'

// Returns every file below `directory` as its list of path parts, relative to `directory`.
function listFilePartsBelow(directory) {
  const filePartsList = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      for (const childParts of listFilePartsBelow(path.join(directory, entry.name))) {
        filePartsList.push([entry.name, ...childParts])
      }
    } else if (entry.isFile()) {
      filePartsList.push([entry.name])
    }
  }
  return filePartsList
}

// `privacy/__next.privacy/__PAGE__.txt` → `privacy/__next.privacy.__PAGE__.txt`
function repairMisplacedSegmentFolder(misplacedSegmentFolderPath) {
  const segmentFileDirectory = path.dirname(misplacedSegmentFolderPath)
  const segmentFileNamePrefix = path.basename(misplacedSegmentFolderPath)
  const repairedSegmentFileNames = []
  for (const fileParts of listFilePartsBelow(misplacedSegmentFolderPath)) {
    const segmentFileName = [segmentFileNamePrefix, ...fileParts].join('.')
    copyFileSync(path.join(misplacedSegmentFolderPath, ...fileParts), path.join(segmentFileDirectory, segmentFileName))
    repairedSegmentFileNames.push(path.relative(siteExportDirectory, path.join(segmentFileDirectory, segmentFileName)))
  }
  return repairedSegmentFileNames
}

function repairSiteExport(directory) {
  const repairedSegmentFileNames = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const entryPath = path.join(directory, entry.name)
    if (entry.name.startsWith(misplacedSegmentFolderPrefix)) {
      repairedSegmentFileNames.push(...repairMisplacedSegmentFolder(entryPath))
    } else {
      repairedSegmentFileNames.push(...repairSiteExport(entryPath))
    }
  }
  return repairedSegmentFileNames
}

if (!existsSync(siteExportDirectory)) {
  console.error(` [error] ${path.relative(papelizRepositoryRoot, siteExportDirectory)} does not exist; build the site first.`)
  process.exit(1)
}

const repairedSegmentFileNames = repairSiteExport(siteExportDirectory)
if (repairedSegmentFileNames.length === 0) {
  console.log(' [ready] Static export: no misplaced segment files.')
} else {
  console.log(` [fixed] Static export: copied ${repairedSegmentFileNames.length} segment file(s) to the names the browser requests:`)
  for (const repairedSegmentFileName of repairedSegmentFileNames) console.log(`   ${repairedSegmentFileName.split(path.sep).join('/')}`)
}
