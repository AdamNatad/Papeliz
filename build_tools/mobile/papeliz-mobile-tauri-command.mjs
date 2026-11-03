// Runs the Tauri CLI for the Papeliz mobile app (app/mobile) with the settings that live elsewhere in
// the repository:
// - the Content-Security-Policy, from the webapp's own module (the desktop's, which adds Tauri's IPC
//   address to the web app's), so the web, desktop and mobile apps keep one policy;
// - the Android NDK: NDK_HOME when it is set, otherwise the newest NDK in the Android SDK
//   (ANDROID_HOME or ANDROID_SDK_ROOT, `<sdk>/ndk/<version>`).
//
// `build` first builds the webapp into app/mobile/papeliz-mobile-webapp-build/app/, apart from the
// webapp's own dist/, so a mobile build never touches what the web deploy uses. Both `dev` and `build`
// hand the webapp the mobile app's side of its mobile seam (PAPELIZ_WEBAPP_MOBILE_PLATFORM_ENTRY): the
// phone layout and App Storage, from the same copy of the repository as the webapp. Then Tauri builds the
// release APK, which Android leaves unsigned; until Papeliz has its own upload key, a copy is signed
// with this computer's Android debug key so it installs on a phone for testing
// (app-universal-release-debug-signed.apk, beside the unsigned one).
//
// Usage: node build_tools/mobile/papeliz-mobile-tauri-command.mjs android <dev|build> [--webapp-from <repository copy>] [Tauri CLI options]
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { papelizMobilePlatformEntryVariableName } from '../webapp/papeliz-mobile-platform-vite-plugin.mjs'
import { buildPapelizDesktopContentSecurityPolicy } from '../webapp/papeliz-webapp-content-security-policy.mjs'

const repositoryRootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const mobileAppDirectory = path.join(repositoryRootDirectory, 'app', 'mobile')
const mobileWebappBuildDirectory = path.join(mobileAppDirectory, 'papeliz-mobile-webapp-build', 'app')
const mobileGeneratedTauriConfigFile = path.join(mobileAppDirectory, 'papeliz-mobile-tauri-generated.conf.json')
const mobileAndroidApkFolder = path.join(mobileAppDirectory, 'gen', 'android', 'app', 'build', 'outputs', 'apk', 'universal', 'release')
const mobileAndroidUnsignedApkFile = path.join(mobileAndroidApkFolder, 'app-universal-release-unsigned.apk')
const mobileAndroidDebugSignedApkFile = path.join(mobileAndroidApkFolder, 'app-universal-release-debug-signed.apk')

function quoteWindowsCommandLineArgument(commandArgument) {
  return /[\s"]/.test(commandArgument) ? `"${commandArgument.replaceAll('"', '\\"')}"` : commandArgument
}

function runPapelizMobileStep(commandName, commandArguments) {
  // pnpm and the Android SDK's tools are .cmd or .bat files on Windows, which only a shell starts, so
  // each gets one quoted command line.
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

function readAndroidSdkDirectory() {
  const androidSdkDirectory = process.env.ANDROID_HOME?.trim() || process.env.ANDROID_SDK_ROOT?.trim() || ''
  if (androidSdkDirectory.length === 0 || !existsSync(androidSdkDirectory)) {
    console.error('Set ANDROID_HOME to the Android SDK folder (Android Studio, SDK Manager, "Android SDK Location").')
    process.exit(1)
  }
  return androidSdkDirectory
}

// The SDK's NDK and build-tools folders are named by version, which sort by their numbers:
// 30.0.16248370 is newer than 29.0.14206865.
function compareAndroidPackageVersions(firstPackageVersion, secondPackageVersion) {
  const firstPackageVersionNumbers = firstPackageVersion.split('.').map(Number)
  const secondPackageVersionNumbers = secondPackageVersion.split('.').map(Number)
  for (let packageVersionPartIndex = 0; packageVersionPartIndex < Math.max(firstPackageVersionNumbers.length, secondPackageVersionNumbers.length); packageVersionPartIndex += 1) {
    const packageVersionPartDifference = (firstPackageVersionNumbers[packageVersionPartIndex] ?? 0) - (secondPackageVersionNumbers[packageVersionPartIndex] ?? 0)
    if (packageVersionPartDifference !== 0) return packageVersionPartDifference
  }
  return 0
}

function ensureAndroidNdkHome(androidSdkDirectory) {
  if (process.env.NDK_HOME?.trim()) return
  const androidNdkParentDirectory = path.join(androidSdkDirectory, 'ndk')
  const installedAndroidNdkVersions = existsSync(androidNdkParentDirectory)
    ? readdirSync(androidNdkParentDirectory).filter((ndkFolderName) => /^\d+(\.\d+)*$/.test(ndkFolderName)).sort(compareAndroidPackageVersions)
    : []
  const newestAndroidNdkVersion = installedAndroidNdkVersions.at(-1)
  if (newestAndroidNdkVersion === undefined) {
    console.error('No Android NDK found. Install "NDK (Side by side)" from Android Studio\'s SDK Manager, or set NDK_HOME.')
    process.exit(1)
  }
  process.env.NDK_HOME = path.join(androidNdkParentDirectory, newestAndroidNdkVersion)
  console.log(`NDK_HOME: the Android SDK's NDK ${newestAndroidNdkVersion}`)
}

function findNewestAndroidBuildToolsDirectory(androidSdkDirectory) {
  const androidBuildToolsParentDirectory = path.join(androidSdkDirectory, 'build-tools')
  const stableAndroidBuildToolsVersions = readdirSync(androidBuildToolsParentDirectory)
    .filter((buildToolsFolderName) => /^\d+(\.\d+)*$/.test(buildToolsFolderName))
    .sort(compareAndroidPackageVersions)
  const newestAndroidBuildToolsVersion = stableAndroidBuildToolsVersions.at(-1)
  if (newestAndroidBuildToolsVersion === undefined) {
    console.error('No Android build tools found. Install "Android SDK Build-Tools" from Android Studio\'s SDK Manager.')
    process.exit(1)
  }
  return path.join(androidBuildToolsParentDirectory, newestAndroidBuildToolsVersion)
}

// Android's own user folder, where Android Studio keeps the debug key: ANDROID_USER_HOME, or the older
// ANDROID_SDK_HOME (which some setups point at the `.android` folder itself), or <home>/.android.
function readAndroidUserDirectoryCandidates() {
  const androidUserHome = process.env.ANDROID_USER_HOME?.trim()
  const androidSdkHome = process.env.ANDROID_SDK_HOME?.trim()
  return [
    ...(androidUserHome ? [androidUserHome] : []),
    ...(androidSdkHome ? [androidSdkHome, path.join(androidSdkHome, '.android')] : []),
    path.join(homedir(), '.android'),
  ]
}

// The debug key every Android build on this computer shares (debug.keystore in Android's user folder),
// made the way Android's own tools make it when it isn't there yet.
function ensureAndroidDebugKeystore() {
  const androidUserDirectoryCandidates = readAndroidUserDirectoryCandidates()
  const existingAndroidDebugKeystoreFile = androidUserDirectoryCandidates
    .map((androidUserDirectory) => path.join(androidUserDirectory, 'debug.keystore'))
    .find((androidDebugKeystoreCandidateFile) => existsSync(androidDebugKeystoreCandidateFile))
  if (existingAndroidDebugKeystoreFile !== undefined) return existingAndroidDebugKeystoreFile
  const androidUserDirectory = androidUserDirectoryCandidates[0] ?? path.join(homedir(), '.android')
  const androidDebugKeystoreFile = path.join(androidUserDirectory, 'debug.keystore')
  mkdirSync(androidUserDirectory, { recursive: true })
  runPapelizMobileStep('keytool', [
    '-genkeypair',
    '-keystore',
    androidDebugKeystoreFile,
    '-storepass',
    'android',
    '-alias',
    'androiddebugkey',
    '-keypass',
    'android',
    '-keyalg',
    'RSA',
    '-keysize',
    '2048',
    '-validity',
    '10000',
    '-dname',
    'CN=Android Debug,O=Android,C=US',
  ])
  return androidDebugKeystoreFile
}

function signAndroidApkWithDebugKey(androidSdkDirectory) {
  if (!existsSync(mobileAndroidUnsignedApkFile)) return
  const androidBuildToolsDirectory = findNewestAndroidBuildToolsDirectory(androidSdkDirectory)
  const windowsScriptExtension = process.platform === 'win32' ? '.bat' : ''
  const zipalignExecutable = path.join(androidBuildToolsDirectory, process.platform === 'win32' ? 'zipalign.exe' : 'zipalign')
  const apksignerExecutable = path.join(androidBuildToolsDirectory, `apksigner${windowsScriptExtension}`)
  const alignedUnsignedApkFile = path.join(mobileAndroidApkFolder, 'app-universal-release-aligned-unsigned.apk')
  runPapelizMobileStep(zipalignExecutable, ['-f', '-p', '4', mobileAndroidUnsignedApkFile, alignedUnsignedApkFile])
  runPapelizMobileStep(apksignerExecutable, [
    'sign',
    '--ks',
    ensureAndroidDebugKeystore(),
    '--ks-pass',
    'pass:android',
    '--ks-key-alias',
    'androiddebugkey',
    '--key-pass',
    'pass:android',
    '--out',
    mobileAndroidDebugSignedApkFile,
    alignedUnsignedApkFile,
  ])
  console.log(`Debug-signed APK for testing on a phone: ${path.relative(repositoryRootDirectory, mobileAndroidDebugSignedApkFile)}`)
}

const papelizMobileCommandUsage =
  'Usage: node build_tools/mobile/papeliz-mobile-tauri-command.mjs android <dev|build> [--webapp-from <repository copy>] [Tauri CLI options]'
const [mobilePlatformName, tauriCommandName, ...mobileCommandOptions] = process.argv.slice(2)
if (mobilePlatformName !== 'android' || (tauriCommandName !== 'dev' && tauriCommandName !== 'build')) {
  console.error(papelizMobileCommandUsage)
  process.exit(1)
}

// `--webapp-from` builds the web app from another copy of the repository, such as a clean export of a
// commit, instead of this working tree, so the APK can wrap a known version of app/web.
const webappFromOptionIndex = mobileCommandOptions.indexOf('--webapp-from')
const webappRepositoryDirectory =
  webappFromOptionIndex === -1 ? repositoryRootDirectory : path.resolve(mobileCommandOptions[webappFromOptionIndex + 1] ?? '')
const tauriCommandOptions =
  webappFromOptionIndex === -1 ? mobileCommandOptions : mobileCommandOptions.filter((_mobileCommandOption, optionIndex) => optionIndex !== webappFromOptionIndex && optionIndex !== webappFromOptionIndex + 1)
if (!existsSync(path.join(webappRepositoryDirectory, 'app', 'web', 'package.json'))) {
  console.error(`No app/web in ${webappRepositoryDirectory}.\n${papelizMobileCommandUsage}`)
  process.exit(1)
}

// The phone layout imports the webapp's own modules by relative path, so its entry comes from the same
// copy of the repository as the webapp: one module graph, one React.
const mobilePlatformEntryFile = path.join(webappRepositoryDirectory, 'app', 'mobile', 'papeliz-mobile-platform', 'papeliz-mobile-platform-tauri.ts')
if (!existsSync(mobilePlatformEntryFile)) {
  console.error(`No mobile platform entry at ${mobilePlatformEntryFile}: the copy needs app/mobile/ too.`)
  process.exit(1)
}
process.env[papelizMobilePlatformEntryVariableName] = mobilePlatformEntryFile

const androidSdkDirectory = readAndroidSdkDirectory()
ensureAndroidNdkHome(androidSdkDirectory)

const mobileGeneratedTauriConfig = { app: { security: { csp: buildPapelizDesktopContentSecurityPolicy() } } }
writeFileSync(mobileGeneratedTauriConfigFile, `${JSON.stringify(mobileGeneratedTauriConfig, null, 2)}\n`)

if (tauriCommandName === 'build') {
  if (webappRepositoryDirectory !== repositoryRootDirectory) console.log(`The web app from ${webappRepositoryDirectory}`)
  runPapelizMobileStep('pnpm', [
    '--dir',
    webappRepositoryDirectory,
    '--filter',
    '@papeliz/webapp',
    'exec',
    'vite',
    'build',
    '--outDir',
    mobileWebappBuildDirectory,
    '--emptyOutDir',
  ])
}

runPapelizMobileStep('pnpm', [
  '--filter',
  '@papeliz/mobile',
  'exec',
  'tauri',
  mobilePlatformName,
  tauriCommandName,
  '--config',
  mobileGeneratedTauriConfigFile,
  ...tauriCommandOptions,
])

if (tauriCommandName === 'build') signAndroidApkWithDebugKey(androidSdkDirectory)
