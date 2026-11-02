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
// Usage: node build_tools/desktop/papeliz-desktop-tauri-command.mjs <dev|build> [Tauri CLI options]
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
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

const [tauriCommandName, ...tauriCommandOptions] = process.argv.slice(2)
if (tauriCommandName !== 'dev' && tauriCommandName !== 'build') {
  console.error('Usage: node build_tools/desktop/papeliz-desktop-tauri-command.mjs <dev|build> [Tauri CLI options]')
  process.exit(1)
}

const isUpdateSigningKeyPresent = Boolean(process.env.TAURI_SIGNING_PRIVATE_KEY)
const desktopGeneratedTauriConfig = {
  app: { security: { csp: buildPapelizDesktopContentSecurityPolicy() } },
  ...(tauriCommandName === 'build' && isUpdateSigningKeyPresent ? { bundle: { createUpdaterArtifacts: true } } : {}),
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
  if (!isUpdateSigningKeyPresent) {
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
  ...tauriCommandOptions,
])
