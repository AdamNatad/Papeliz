#!/usr/bin/env node
// Assembles the deploy folder: one static folder for one domain.
//
//   deploy/        the website's export (site/main/out), served at /
//   deploy/app/    the webapp's build (app/web/dist/app), served at /app/
//   deploy/help/   the help site's export (site/help/out), served at /help/
//
// Run the builds first; the root `deploy:assemble` script runs them, then this. A deploy folder
// left from an earlier run goes to the Trash or Recycle Bin through the `trash` command
// (trash-cli); when that is missing or fails, the old folder is kept and this stops.
//
// Usage: node build_tools/shared/deploy-folder/papeliz-deploy-folder-assemble.mjs

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const papelizRepositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const siteExportDirectory = path.join(papelizRepositoryRoot, 'site', 'main', 'out')
const deployFolderDirectory = path.join(papelizRepositoryRoot, 'deploy')

// The builds served below the site, each under its own path. Each must load its own files from
// that path (Vite `base`, Next.js `basePath`), or its pages would ask for them at the site's root.
const papelizDeployFolderNestedBuilds = [
  {
    nestedBuildTitle: 'webapp',
    nestedBuildDirectory: path.join(papelizRepositoryRoot, 'app', 'web', 'dist', 'app'),
    nestedBuildDeployPathSegment: 'app',
    nestedBuildAssetPathPrefix: '/app/assets/',
    nestedBuildRootScript: 'webapp:build',
  },
  {
    nestedBuildTitle: 'help site',
    nestedBuildDirectory: path.join(papelizRepositoryRoot, 'site', 'help', 'out'),
    nestedBuildDeployPathSegment: 'help',
    nestedBuildAssetPathPrefix: '/help/_next/',
    nestedBuildRootScript: 'help:build',
  },
]

class PapelizDeployFolderError extends Error {}

function repositoryRelativePath(absolutePath) {
  return path.relative(papelizRepositoryRoot, absolutePath).split(path.sep).join('/')
}

function countFilesBelow(directory) {
  let fileCount = 0
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) fileCount += countFilesBelow(path.join(directory, entry.name))
    else if (entry.isFile()) fileCount += 1
  }
  return fileCount
}

function requireSiteExport() {
  if (!existsSync(path.join(siteExportDirectory, 'index.html'))) {
    throw new PapelizDeployFolderError(`${repositoryRelativePath(siteExportDirectory)} has no index.html; build the site first (pnpm run site:build).`)
  }
  // A site page at a nested build's path would be overwritten.
  for (const { nestedBuildTitle, nestedBuildDeployPathSegment } of papelizDeployFolderNestedBuilds) {
    if (existsSync(path.join(siteExportDirectory, nestedBuildDeployPathSegment))) {
      throw new PapelizDeployFolderError(`The site export already has a ${nestedBuildDeployPathSegment}/ folder, which the ${nestedBuildTitle} needs.`)
    }
  }
}

function requireNestedBuildForDeployPath(papelizDeployFolderNestedBuild) {
  const { nestedBuildTitle, nestedBuildDirectory, nestedBuildAssetPathPrefix, nestedBuildRootScript } = papelizDeployFolderNestedBuild
  const nestedBuildIndexHtmlPath = path.join(nestedBuildDirectory, 'index.html')
  if (!existsSync(nestedBuildIndexHtmlPath)) {
    throw new PapelizDeployFolderError(`${repositoryRelativePath(nestedBuildDirectory)} has no index.html; build the ${nestedBuildTitle} first (pnpm run ${nestedBuildRootScript}).`)
  }
  if (!readFileSync(nestedBuildIndexHtmlPath, 'utf8').includes(`"${nestedBuildAssetPathPrefix}`)) {
    throw new PapelizDeployFolderError(`${repositoryRelativePath(nestedBuildIndexHtmlPath)} does not load its files from ${nestedBuildAssetPathPrefix}; rebuild it with pnpm run ${nestedBuildRootScript}.`)
  }
}

// Windows runs trash-cli's trash.cmd through cmd.exe; macOS and Linux run `trash` directly.
function moveEarlierDeployFolderToTrash() {
  if (!existsSync(deployFolderDirectory)) return
  const deployFolderTrashPath = deployFolderDirectory.split(path.sep).join('/')
  const trashCommand = process.platform === 'win32'
    ? { command: 'cmd.exe', args: ['/d', '/s', '/c', `"trash "${deployFolderTrashPath}""`], verbatim: true }
    : { command: 'trash', args: [deployFolderTrashPath], verbatim: false }
  console.log(` [trash] Moving the earlier ${repositoryRelativePath(deployFolderDirectory)}/ to the Trash...`)
  const trashResult = spawnSync(trashCommand.command, trashCommand.args, {
    stdio: 'inherit',
    windowsHide: true,
    windowsVerbatimArguments: trashCommand.verbatim,
  })
  if (trashResult.error || trashResult.status !== 0 || existsSync(deployFolderDirectory)) {
    throw new PapelizDeployFolderError(
      `${repositoryRelativePath(deployFolderDirectory)}/ from an earlier run is still there, so it was kept. `
      + 'Install trash-cli (npm install --global trash-cli) or move the folder to the Trash yourself, then run this again.',
    )
  }
}

function assembleDeployFolder() {
  requireSiteExport()
  for (const papelizDeployFolderNestedBuild of papelizDeployFolderNestedBuilds) requireNestedBuildForDeployPath(papelizDeployFolderNestedBuild)
  moveEarlierDeployFolderToTrash()

  cpSync(siteExportDirectory, deployFolderDirectory, { recursive: true })
  console.log(` [ready] ${repositoryRelativePath(deployFolderDirectory)}/ assembled:`)
  console.log(`   /        ${repositoryRelativePath(siteExportDirectory)} (${countFilesBelow(siteExportDirectory)} files)`)
  for (const { nestedBuildDirectory, nestedBuildDeployPathSegment } of papelizDeployFolderNestedBuilds) {
    cpSync(nestedBuildDirectory, path.join(deployFolderDirectory, nestedBuildDeployPathSegment), { recursive: true })
    console.log(`   ${`/${nestedBuildDeployPathSegment}/`.padEnd(8)} ${repositoryRelativePath(nestedBuildDirectory)} (${countFilesBelow(nestedBuildDirectory)} files)`)
  }
}

try {
  assembleDeployFolder()
} catch (error) {
  console.error(` [error] ${error.message}`)
  process.exit(1)
}
