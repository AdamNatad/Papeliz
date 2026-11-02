// Packs the Papeliz desktop app as an unsigned MSIX for the Microsoft Store, which signs what it
// accepts. The package holds the same papeliz-desktop.exe as the NSIS installer (Tauri embeds the web
// app in it), the manifest and logos from app/desktop/msix/, and nothing else.
//
// 1. Stages the exe, the manifest (as AppxManifest.xml) and its Assets/ into
//    app/desktop/target/papeliz-desktop-msix-stage/. That folder is also a loose layout that
//    `Add-AppxPackage -Register` can install for a test, with Developer Mode on.
// 2. Runs Microsoft's winapp CLI (`winget install microsoft.winappcli --source winget`):
//    `winapp package <stage> --no-sign`, into app/desktop/target/.
//
// It never builds the exe (run `pnpm desktop:build` first), never signs and never installs anything.
//
// Usage: node build_tools/desktop/papeliz-desktop-msix-pack.mjs
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const desktopAppDirectory = path.join(repositoryRootDirectory, 'app', 'desktop')
const desktopTargetDirectory = path.join(desktopAppDirectory, 'target')
const desktopReleaseExecutableFile = path.join(desktopTargetDirectory, 'release', 'papeliz-desktop.exe')
const desktopMsixSourceDirectory = path.join(desktopAppDirectory, 'msix')
const desktopMsixSourceManifestFile = path.join(desktopMsixSourceDirectory, 'Package.appxmanifest')
const desktopMsixSourceAssetsDirectory = path.join(desktopMsixSourceDirectory, 'Assets')
const desktopMsixStageDirectory = path.join(desktopTargetDirectory, 'papeliz-desktop-msix-stage')
const desktopMsixStagedManifestFileName = 'AppxManifest.xml'
const desktopMsixStagedExecutableFileName = 'papeliz-desktop.exe'
const desktopMsixStagedAssetsDirectoryName = 'Assets'

function stopPapelizDesktopMsixPack(failureMessage) {
  console.error(`MSIX pack stopped: ${failureMessage}`)
  process.exit(1)
}

function readPapelizDesktopMsixIdentity(manifestText) {
  const identityElementMatch = manifestText.match(/<Identity\b[^>]*\/>/)
  if (!identityElementMatch) stopPapelizDesktopMsixPack('the manifest has no <Identity> element.')
  const readIdentityAttribute = (attributeName) =>
    identityElementMatch[0].match(new RegExp(`\\b${attributeName}="([^"]*)"`))?.[1] ?? ''
  return {
    msixIdentityName: readIdentityAttribute('Name'),
    msixIdentityPublisher: readIdentityAttribute('Publisher'),
    msixIdentityVersion: readIdentityAttribute('Version'),
    msixIdentityProcessorArchitecture: readIdentityAttribute('ProcessorArchitecture') || 'neutral',
  }
}

// The Store takes Major.Minor.Build.Revision with a first part above 0, and keeps Revision for itself.
function checkPapelizDesktopMsixVersion(msixIdentityVersion) {
  const versionParts = msixIdentityVersion.split('.')
  const isFourNumbers = versionParts.length === 4 && versionParts.every((versionPart) => /^\d+$/.test(versionPart))
  if (!isFourNumbers) stopPapelizDesktopMsixPack(`Version "${msixIdentityVersion}" is not Major.Minor.Build.Revision.`)
  if (Number(versionParts[0]) === 0) stopPapelizDesktopMsixPack(`Version "${msixIdentityVersion}" starts with 0.`)
  if (Number(versionParts[3]) !== 0) stopPapelizDesktopMsixPack(`Version "${msixIdentityVersion}" must end in .0.`)
}

// Windows adds this folder to a layout registered with `Add-AppxPackage -Register` and leaves it,
// empty, after the package is removed. An empty folder is not packed; a full one means the test
// package is still registered from the stage.
const windowsPackageRegistrationMetadataDirectoryName = 'microsoft.system.package.metadata'

// The stage folder is reused and only overwritten, never cleared by this script. A file left over
// from an older layout (or an AppX folder from `winapp run`) would ride into the package, so stop.
function findPapelizDesktopMsixStageLeftovers(expectedStageRelativePaths) {
  const stageLeftoverRelativePaths = []
  const visitStageFolder = (stageFolder) => {
    for (const stageEntry of readdirSync(stageFolder, { withFileTypes: true })) {
      const stageEntryPath = path.join(stageFolder, stageEntry.name)
      const stageEntryRelativePath = path.relative(desktopMsixStageDirectory, stageEntryPath).split(path.sep).join('/')
      if (stageEntry.isDirectory()) {
        if (stageEntryRelativePath === desktopMsixStagedAssetsDirectoryName) visitStageFolder(stageEntryPath)
        else if (stageEntryRelativePath === windowsPackageRegistrationMetadataDirectoryName && readdirSync(stageEntryPath).length === 0) continue
        else stageLeftoverRelativePaths.push(`${stageEntryRelativePath}/`)
      } else if (!expectedStageRelativePaths.has(stageEntryRelativePath)) {
        stageLeftoverRelativePaths.push(stageEntryRelativePath)
      }
    }
  }
  if (existsSync(desktopMsixStageDirectory)) visitStageFolder(desktopMsixStageDirectory)
  return stageLeftoverRelativePaths
}

// winapp is a Windows App Execution Alias; a shell opened before it was installed may not have it
// on PATH yet, so fall back to the alias folder itself.
function findPapelizDesktopWinappCommand() {
  const winappOnPathResult = spawnSync('winapp', ['--version'], {
    encoding: 'utf8',
    env: { ...process.env, WINAPP_CLI_TELEMETRY_OPTOUT: '1' },
  })
  if (!winappOnPathResult.error && winappOnPathResult.status === 0) return 'winapp'
  const winappAliasFile = path.join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'WindowsApps', 'winapp.exe')
  if (process.env.LOCALAPPDATA && existsSync(winappAliasFile)) return winappAliasFile
  return stopPapelizDesktopMsixPack('winapp was not found. Install it: winget install microsoft.winappcli --source winget')
}

if (process.platform !== 'win32') stopPapelizDesktopMsixPack('an MSIX is packed on Windows only.')
if (!existsSync(desktopReleaseExecutableFile)) {
  stopPapelizDesktopMsixPack(`${path.relative(repositoryRootDirectory, desktopReleaseExecutableFile)} is missing. Build it first: pnpm desktop:build`)
}

const desktopMsixManifestText = readFileSync(desktopMsixSourceManifestFile, 'utf8')
const desktopMsixIdentity = readPapelizDesktopMsixIdentity(desktopMsixManifestText)
checkPapelizDesktopMsixVersion(desktopMsixIdentity.msixIdentityVersion)

const desktopMsixAssetFileNames = readdirSync(desktopMsixSourceAssetsDirectory).filter((assetFileName) =>
  statSync(path.join(desktopMsixSourceAssetsDirectory, assetFileName)).isFile(),
)
const expectedStageRelativePaths = new Set([
  desktopMsixStagedManifestFileName,
  desktopMsixStagedExecutableFileName,
  ...desktopMsixAssetFileNames.map((assetFileName) => `${desktopMsixStagedAssetsDirectoryName}/${assetFileName}`),
])
const stageLeftoverRelativePaths = findPapelizDesktopMsixStageLeftovers(expectedStageRelativePaths)
if (stageLeftoverRelativePaths.length > 0) {
  stopPapelizDesktopMsixPack(
    `${path.relative(repositoryRootDirectory, desktopMsixStageDirectory)} holds files that are not part of the package:\n` +
      stageLeftoverRelativePaths.map((leftoverRelativePath) => `  ${leftoverRelativePath}`).join('\n') +
      '\nRemove a test registration from the stage first (Remove-AppxPackage), then trash the stage folder and run this again.',
  )
}

mkdirSync(path.join(desktopMsixStageDirectory, desktopMsixStagedAssetsDirectoryName), { recursive: true })
copyFileSync(desktopReleaseExecutableFile, path.join(desktopMsixStageDirectory, desktopMsixStagedExecutableFileName))
copyFileSync(desktopMsixSourceManifestFile, path.join(desktopMsixStageDirectory, desktopMsixStagedManifestFileName))
for (const assetFileName of desktopMsixAssetFileNames) {
  copyFileSync(
    path.join(desktopMsixSourceAssetsDirectory, assetFileName),
    path.join(desktopMsixStageDirectory, desktopMsixStagedAssetsDirectoryName, assetFileName),
  )
}

const desktopMsixOutputFile = path.join(
  desktopTargetDirectory,
  `papeliz-desktop-${desktopMsixIdentity.msixIdentityVersion}-${desktopMsixIdentity.msixIdentityProcessorArchitecture}-unsigned.msix`,
)
const winappCommand = findPapelizDesktopWinappCommand()
const winappPackageResult = spawnSync(
  winappCommand,
  [
    'package',
    desktopMsixStageDirectory,
    '--manifest',
    path.join(desktopMsixStageDirectory, desktopMsixStagedManifestFileName),
    '--no-sign',
    '--output',
    desktopMsixOutputFile,
  ],
  {
    cwd: repositoryRootDirectory,
    stdio: 'inherit',
    // winapp sends usage data unless this is set.
    env: { ...process.env, WINAPP_CLI_TELEMETRY_OPTOUT: '1' },
  },
)
if (winappPackageResult.error) stopPapelizDesktopMsixPack(`winapp could not start: ${winappPackageResult.error.message}`)
if (winappPackageResult.status !== 0) stopPapelizDesktopMsixPack(`winapp package exited with ${winappPackageResult.status}.`)

console.log(`\nUnsigned MSIX: ${path.relative(repositoryRootDirectory, desktopMsixOutputFile)}`)
console.log(`Identity: ${desktopMsixIdentity.msixIdentityName}, ${desktopMsixIdentity.msixIdentityPublisher}, ${desktopMsixIdentity.msixIdentityVersion}`)
if (/placeholder/i.test(`${desktopMsixIdentity.msixIdentityName} ${desktopMsixIdentity.msixIdentityPublisher}`)) {
  console.log('The identity is still a placeholder: copy Name, Publisher and PublisherDisplayName from Partner Center')
  console.log('into app/desktop/msix/Package.appxmanifest before a Store submission.')
}
