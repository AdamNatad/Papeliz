// Runs the Tauri CLI for the Papeliz desktop app (app/desktop) with the settings that live elsewhere
// in the repository:
// - the desktop Content-Security-Policy, from the webapp's own module (one source for the web, the
//   desktop page's <meta> and the desktop app's header);
// - the updater's files, only when an update signing key is in the environment
//   (TAURI_SIGNING_PRIVATE_KEY), so a plain local build needs no key.
//
// `build` first builds the webapp into app/desktop/papeliz-desktop-webapp-build/app/, apart from the
// webapp's own dist/, so a desktop build never touches what the web deploy uses. Both `dev` and `build`
// hand the webapp the desktop app's side of its desktop contract (PAPELIZ_WEBAPP_DESKTOP_PLATFORM_ENTRY).
//
// `build-recording-devtools` is `build` for filming only: the app with DevTools (the Cargo feature
// papeliz-recording-devtools), compiled apart in app/desktop/target/papeliz-recording-devtools/, with
// no updater files even when a signing key is set, and its installer renamed
// `<name>-recording-devtools-setup.exe`. It is never published; `build` always leaves DevTools out.
//
// Usage: node build_tools/desktop/papeliz-desktop-tauri-command.mjs <dev|build|build-recording-devtools> [Tauri CLI options]
import { spawnSync } from 'node:child_process'
import { readdirSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { papelizDesktopPlatformEntryVariableName } from '../webapp/papeliz-desktop-platform-vite-plugin.mjs'
import { buildPapelizDesktopContentSecurityPolicy } from '../webapp/papeliz-webapp-content-security-policy.mjs'

const repositoryRootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const desktopAppDirectory = path.join(repositoryRootDirectory, 'app', 'desktop')
const desktopWebappBuildDirectory = path.join(desktopAppDirectory, 'papeliz-desktop-webapp-build', 'app')
const desktopGeneratedTauriConfigFile = path.join(desktopAppDirectory, 'papeliz-desktop-tauri-generated.conf.json')
// The webapp's Vite build and dev server read this to resolve `virtual:papeliz-desktop-platform` to the
// desktop app's side (build_tools/webapp/papeliz-desktop-platform-vite-plugin.mjs).
const desktopPlatformEntryFile = path.join(desktopAppDirectory, 'papeliz-desktop-platform', 'papeliz-desktop-platform-tauri.ts')
process.env[papelizDesktopPlatformEntryVariableName] = desktopPlatformEntryFile

function quoteWindowsCommandLineArgument(commandArgument) {
  return /[\s"]/.test(commandArgument) ? `"${commandArgument.replaceAll('"', '\\"')}"` : commandArgument
}

function runPapelizDesktopStep(commandName, commandArguments) {
  // pnpm is a .cmd file on Windows, which only a shell starts, so it gets one quoted command line.
  const stepResult =
    process.platform === 'win32'
      ? spawnSync([commandName, ...commandArguments].map(quoteWindowsCommandLineArgument).join(' '), {
          cwd: repositoryRootDirectory,
          stdio: 'inherit',
          shell: true,
        })
      : spawnSync(commandName, commandArguments, { cwd: repositoryRootDirectory, stdio: 'inherit' })
  if (stepResult.status !== 0) process.exit(stepResult.status ?? 1)
}

const [papelizDesktopCommandName, ...tauriCommandOptions] = process.argv.slice(2)
if (papelizDesktopCommandName !== 'dev' && papelizDesktopCommandName !== 'build' && papelizDesktopCommandName !== 'build-recording-devtools') {
  console.error('Usage: node build_tools/desktop/papeliz-desktop-tauri-command.mjs <dev|build|build-recording-devtools> [Tauri CLI options]')
  process.exit(1)
}
const isRecordingDevtoolsBuild = papelizDesktopCommandName === 'build-recording-devtools'
const tauriCommandName = isRecordingDevtoolsBuild ? 'build' : papelizDesktopCommandName

// Its own Cargo target folder, so target/release/ always holds the build without DevTools, which the
// MSIX packs (papeliz-desktop-msix-pack.mjs).
const recordingDevtoolsTargetDirectory = path.join(desktopAppDirectory, 'target', 'papeliz-recording-devtools')
const recordingDevtoolsInstallerDirectory = path.join(recordingDevtoolsTargetDirectory, 'release', 'bundle', 'nsis')
const recordingDevtoolsTauriOptions = ['--features', 'papeliz-recording-devtools', '--bundles', 'nsis']
if (isRecordingDevtoolsBuild) process.env.CARGO_TARGET_DIR = recordingDevtoolsTargetDirectory

const isUpdateSigningKeyPresent = Boolean(process.env.TAURI_SIGNING_PRIVATE_KEY)
const desktopGeneratedTauriConfig = {
  app: { security: { csp: buildPapelizDesktopContentSecurityPolicy() } },
  ...(papelizDesktopCommandName === 'build' && isUpdateSigningKeyPresent ? { bundle: { createUpdaterArtifacts: true } } : {}),
}
writeFileSync(desktopGeneratedTauriConfigFile, `${JSON.stringify(desktopGeneratedTauriConfig, null, 2)}\n`)

if (tauriCommandName === 'build') {
  runPapelizDesktopStep('pnpm', [
    '--filter',
    '@papeliz/webapp',
    'exec',
    'vite',
    'build',
    '--outDir',
    desktopWebappBuildDirectory,
    '--emptyOutDir',
  ])
  if (isRecordingDevtoolsBuild) {
    console.log('Recording build: DevTools on, no updater files. Never publish it.')
  } else if (!isUpdateSigningKeyPresent) {
    console.log('No TAURI_SIGNING_PRIVATE_KEY: building without the updater files.')
  }
}

runPapelizDesktopStep('pnpm', [
  '--filter',
  '@papeliz/desktop',
  'exec',
  'tauri',
  tauriCommandName,
  '--config',
  desktopGeneratedTauriConfigFile,
  ...(isRecordingDevtoolsBuild ? recordingDevtoolsTauriOptions : []),
  ...tauriCommandOptions,
])

// `Papeliz_0.1.0_x64-setup.exe` becomes `Papeliz_0.1.0_x64-recording-devtools-setup.exe`, replacing the
// last recording build's, so it can't be taken for the release installer.
if (isRecordingDevtoolsBuild) {
  for (const recordingDevtoolsInstallerName of readdirSync(recordingDevtoolsInstallerDirectory)) {
    if (!recordingDevtoolsInstallerName.endsWith('-setup.exe') || recordingDevtoolsInstallerName.endsWith('-recording-devtools-setup.exe')) continue
    const renamedRecordingDevtoolsInstallerFile = path.join(
      recordingDevtoolsInstallerDirectory,
      recordingDevtoolsInstallerName.replace(/-setup\.exe$/, '-recording-devtools-setup.exe'),
    )
    renameSync(path.join(recordingDevtoolsInstallerDirectory, recordingDevtoolsInstallerName), renamedRecordingDevtoolsInstallerFile)
    console.log(`Recording build installer: ${path.relative(repositoryRootDirectory, renamedRecordingDevtoolsInstallerFile)}`)
  }
}
