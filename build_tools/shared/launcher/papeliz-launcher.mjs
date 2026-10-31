#!/usr/bin/env node
// Papeliz launcher. The per-OS scripts in build_tools/<webapp|site|site/help>/<os>/ call this file:
//   node build_tools/shared/launcher/papeliz-launcher.mjs <webapp|site|help> <start|build> <windows|macos|linux|auto> [target] [options]
// It checks Node.js and pnpm, installs workspace dependencies when needed, then starts or builds
// Papeliz on a fixed loopback port, mirroring the output to a log in test_trash/logs/.

import { spawn, spawnSync } from 'node:child_process'
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import { createRequire } from 'node:module'
import { createServer as createNetServer } from 'node:net'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { papelizSyncLocalWorkersOriginVariableName, papelizSyncSignInPageDevServerOriginVariableName } from '../../webapp/papeliz-sync-engine-vite-plugin.mjs'

const papelizRepositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const papelizLoopbackHost = '127.0.0.1'
const papelizLauncherLogDirectory = path.join(papelizRepositoryRoot, 'test_trash', 'logs')

const papelizMinimumNodeMajor = 22
const papelizRecommendedNodeMajor = 24
const papelizRecommendedPnpmMajor = 10
const pnpmExecutable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm'

// When pnpm comes from Corepack, it downloads the version pinned in package.json on first use;
// without this, Corepack waits for a yes on a prompt nobody sees.
const papelizChildEnvironment = { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' }

// Vite and Next.js name their host and port flags differently.
const viteServerArguments = (port) => ['--host', papelizLoopbackHost, '--port', String(port), '--strictPort']
const nextServerArguments = (port) => ['--hostname', papelizLoopbackHost, '--port', String(port)]

// Each surface has one start target and one build target. Extra targets are reachable by name only
// (`hiddenFromMenu`), for tools such as the desktop app's preview panel.
const papelizLauncherSurfaces = {
  webapp: {
    title: 'Papeliz Webapp',
    missingScriptHint: 'It arrives with the webapp skeleton.',
    start: [
      { name: 'webapp', label: 'Run the Webapp', rootScript: 'webapp:dev', port: 14201, serverArguments: viteServerArguments },
      { name: 'mockups', label: 'Design Mockups', staticDirectory: 'test_trash/mockups', port: 14200, hiddenFromMenu: true },
      // The real Papeliz Sync engine against the real Account and Sync Workers on this computer, with
      // the site's /account/ sign-in page on the app's origin. Its own port, so the plain webapp can run
      // beside it and their browser vaults stay apart.
      {
        name: 'sync-local',
        label: 'Webapp with Papeliz Sync against local Workers',
        rootScript: 'webapp:dev',
        port: 14202,
        serverArguments: viteServerArguments,
        isSyncLocalWorkersTarget: true,
        hiddenFromMenu: true,
      },
    ],
    build: [{ name: 'webapp', label: 'Build the Webapp', rootScript: 'webapp:build' }],
  },
  site: {
    title: 'Papeliz Site',
    missingScriptHint: 'Check the root package.json "site:*" scripts.',
    start: [
      { name: 'site', label: 'Run the Site', rootScript: 'site:dev', port: 14203, serverArguments: nextServerArguments },
      {
        name: 'preview',
        label: 'Static Build Preview',
        staticDirectory: 'site/main/out',
        missingDirectoryHint: 'Build the site first with build_tools/site/<os>/build.',
        port: 14204,
        hiddenFromMenu: true,
      },
      // One domain: the site at /, the webapp at /app/, the help site at /help/.
      {
        name: 'deploy',
        label: 'Deploy Folder Preview (site, /app/, /help/)',
        staticDirectory: 'deploy',
        missingDirectoryHint: 'Assemble it first with build_tools/site/<os>/build deploy.',
        port: 14206,
        hiddenFromMenu: true,
      },
    ],
    build: [
      { name: 'site', label: 'Build the Static Site', rootScript: 'site:build' },
      { name: 'deploy', label: 'Assemble the Deploy Folder (site, /app/, /help/)', rootScript: 'deploy:assemble', hiddenFromMenu: true },
    ],
  },
  // The help site is exported under the /help base path, so its dev server answers there.
  help: {
    title: 'Papeliz Help',
    missingScriptHint: 'Check the root package.json "help:*" scripts.',
    start: [
      { name: 'help', label: 'Run the Help Site', rootScript: 'help:dev', port: 14205, urlPath: '/help/', serverArguments: nextServerArguments },
    ],
    build: [{ name: 'help', label: 'Build the Static Help Site', rootScript: 'help:build' }],
  },
}

class PapelizLauncherError extends Error {
  constructor(message, exitCode = 1) {
    super(message)
    this.exitCode = exitCode
  }
}

function papelizLauncherUsage() {
  return 'Usage: papeliz-launcher.mjs <webapp|site|help> <start|build> <windows|macos|linux|auto> [target] [--help] [--dry-run] [--no-open]'
}

function detectPapelizPlatform() {
  if (process.platform === 'win32') return 'windows'
  if (process.platform === 'darwin') return 'macos'
  return 'linux'
}

function parsePapelizLauncherArguments(argv) {
  const [surfaceName, action, platformArgument, ...rest] = argv
  if (!Object.hasOwn(papelizLauncherSurfaces, surfaceName ?? '')) {
    throw new PapelizLauncherError(`Unknown launcher surface: ${surfaceName ?? '(none)'}\n${papelizLauncherUsage()}`, 2)
  }
  if (action !== 'start' && action !== 'build') {
    throw new PapelizLauncherError(`Unknown launcher action: ${action ?? '(none)'}\n${papelizLauncherUsage()}`, 2)
  }
  const platform = platformArgument === 'auto' ? detectPapelizPlatform() : platformArgument
  if (!['windows', 'macos', 'linux'].includes(platform)) {
    throw new PapelizLauncherError(`Unknown platform: ${platformArgument ?? '(none)'}\n${papelizLauncherUsage()}`, 2)
  }

  const launcherRequest = { surfaceName, action, platform, help: false, dryRun: false, openBrowser: true, target: null }
  for (const argument of rest) {
    if (argument === '--help' || argument === '-h') launcherRequest.help = true
    else if (argument === '--dry-run') launcherRequest.dryRun = true
    else if (argument === '--no-open') launcherRequest.openBrowser = false
    else if (argument.startsWith('-')) throw new PapelizLauncherError(`Unknown option: ${argument}`, 2)
    else if (launcherRequest.target === null) launcherRequest.target = argument
    else throw new PapelizLauncherError('Only one launcher target may be given.', 2)
  }
  return launcherRequest
}

function launcherTargetsFor({ surfaceName, action }) {
  return papelizLauncherSurfaces[surfaceName][action]
}

function resolvePapelizLauncherTarget(launcherRequest, value) {
  const launcherTargets = launcherTargetsFor(launcherRequest)
  const byNumber = /^\d+$/.test(value) ? launcherTargets[Number(value) - 1] : undefined
  const launcherTarget = byNumber ?? launcherTargets.find((candidate) => candidate.name === value)
  if (!launcherTarget) {
    const choices = launcherTargets.map((candidate, index) => `${index + 1} ${candidate.name}`).join(', ')
    throw new PapelizLauncherError(`Unknown ${launcherRequest.action} target: ${value}. Choose one of: ${choices}`, 2)
  }
  return launcherTarget
}

function launcherTargetUrl(launcherTarget) {
  return launcherTarget.port ? `http://${papelizLoopbackHost}:${launcherTarget.port}${launcherTarget.urlPath ?? '/'}` : null
}

async function chooseLauncherTargetFromMenu(launcherRequest) {
  const launcherTargets = launcherTargetsFor(launcherRequest).filter((launcherTarget) => !launcherTarget.hiddenFromMenu)
  if (launcherTargets.length === 1 || !process.stdin.isTTY || !process.stdout.isTTY) return launcherTargets[0]

  console.log('\n ============================================')
  console.log(`  ${papelizLauncherSurfaces[launcherRequest.surfaceName].title}`)
  console.log(' ============================================\n')
  launcherTargets.forEach((launcherTarget, index) => {
    const url = launcherTargetUrl(launcherTarget)
    console.log(`  ${index + 1} - ${launcherTarget.label.padEnd(52)}${url ?? ''}`)
  })
  console.log('')
  const terminal = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = (await terminal.question('  Enter choice [Default: 1]: ')).trim()
    return resolvePapelizLauncherTarget(launcherRequest, answer || '1')
  } finally {
    terminal.close()
  }
}

function launcherWrapperPath({ surfaceName, action, platform }) {
  return platform === 'windows'
    ? `build_tools\\${surfaceName}\\windows\\${action}.bat`
    : `build_tools/${surfaceName}/${platform}/${action}.sh`
}

function printPapelizLauncherHelp(launcherRequest) {
  const { surfaceName, action, platform } = launcherRequest
  console.log(`${papelizLauncherSurfaces[surfaceName].title}: ${action} (${platform})`)
  console.log(`Usage: ${launcherWrapperPath(launcherRequest)} [target] [--help] [--dry-run] [--no-open]`)
  console.log('Targets:')
  launcherTargetsFor(launcherRequest).forEach((launcherTarget) => {
    const url = launcherTargetUrl(launcherTarget)
    const defaultNote = launcherTarget.hiddenFromMenu ? '' : ' (default)'
    console.log(`  ${launcherTarget.name.padEnd(10)} ${launcherTarget.label}${defaultNote}${url ? `  ${url}` : ''}`)
  })
  console.log('Options: --dry-run prints the plan without running it; --no-open leaves the browser closed.')
}

// Windows cannot spawn .cmd files directly; run them through cmd.exe with an exact command line.
function commandSpawnSpecification(command, args) {
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(command)) {
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', `"${[command, ...args].join(' ')}"`], verbatim: true }
  }
  return { command, args, verbatim: false }
}

function readCommandVersion(command) {
  const specification = commandSpawnSpecification(command, ['--version'])
  const result = spawnSync(specification.command, specification.args, {
    cwd: papelizRepositoryRoot,
    env: papelizChildEnvironment,
    encoding: 'utf8',
    windowsHide: true,
    windowsVerbatimArguments: specification.verbatim,
  })
  if (result.error || result.status !== 0) return null
  return result.stdout.trim().split(/\s+/).pop() || null
}

function runForeground(command, args, { cwd = papelizRepositoryRoot, extraEnvironment = {} } = {}) {
  const specification = commandSpawnSpecification(command, args)
  return new Promise((resolve) => {
    const child = spawn(specification.command, specification.args, {
      cwd,
      env: { ...papelizChildEnvironment, ...extraEnvironment },
      stdio: 'inherit',
      windowsVerbatimArguments: specification.verbatim,
    })
    child.on('error', (error) => {
      console.error(` [error] ${error.message}`)
      resolve(1)
    })
    child.on('exit', (code) => resolve(code ?? 1))
  })
}

async function askYesNo(question) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false
  const terminal = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return /^y(es)?$/i.test((await terminal.question(question)).trim())
  } finally {
    terminal.close()
  }
}

function checkNodeVersion() {
  const nodeMajor = Number(process.versions.node.split('.')[0])
  if (nodeMajor < papelizMinimumNodeMajor) {
    throw new PapelizLauncherError(
      `Node.js ${process.versions.node} is too old. Install Node.js ${papelizRecommendedNodeMajor} LTS from https://nodejs.org.`,
    )
  }
  if (nodeMajor < papelizRecommendedNodeMajor) {
    console.log(` [note] Node.js ${process.versions.node} works, but Papeliz targets Node.js ${papelizRecommendedNodeMajor} LTS.`)
  } else {
    console.log(` [ready] Node.js ${process.versions.node}`)
  }
}

async function ensurePnpm({ dryRun }) {
  console.log(' [check] pnpm (the first run may download the version pinned in package.json)...')
  let pnpmVersion = readCommandVersion(pnpmExecutable)
  if (!pnpmVersion) {
    const installCommand = `npm install --global pnpm@${papelizRecommendedPnpmMajor}`
    if (dryRun) {
      console.log(` [plan] pnpm is missing; the launcher would offer to run: ${installCommand}`)
      return
    }
    const installNow = await askYesNo(` pnpm is not installed. Install pnpm ${papelizRecommendedPnpmMajor} now with "${installCommand}"? [y/N]: `)
    if (!installNow) throw new PapelizLauncherError(`pnpm is required. Install it with: ${installCommand}`)
    if (await runForeground(npmExecutable, ['install', '--global', `pnpm@${papelizRecommendedPnpmMajor}`]) !== 0) {
      throw new PapelizLauncherError('Installing pnpm failed.')
    }
    pnpmVersion = readCommandVersion(pnpmExecutable)
    if (!pnpmVersion) {
      throw new PapelizLauncherError('pnpm was installed but is not on PATH yet. Open a new terminal and run the launcher again.')
    }
  }
  const pnpmMajor = Number(pnpmVersion.split('.')[0])
  if (pnpmMajor < papelizRecommendedPnpmMajor) {
    console.log(` [note] pnpm ${pnpmVersion} works, but Papeliz targets pnpm ${papelizRecommendedPnpmMajor}.`)
  } else {
    console.log(` [ready] pnpm ${pnpmVersion}`)
  }
}

async function ensureWorkspaceDependencies({ dryRun }) {
  const rootPackageJsonPath = path.join(papelizRepositoryRoot, 'package.json')
  if (!existsSync(rootPackageJsonPath)) {
    console.log(' [note] No root package.json yet.')
    return null
  }
  const rootPackageJson = JSON.parse(readFileSync(rootPackageJsonPath, 'utf8'))
  const lockfilePath = path.join(papelizRepositoryRoot, 'pnpm-lock.yaml')
  const installStatePath = path.join(papelizRepositoryRoot, 'node_modules', '.modules.yaml')
  const dependenciesNeedInstall = !existsSync(installStatePath)
    || (existsSync(lockfilePath) && statSync(lockfilePath).mtimeMs > statSync(installStatePath).mtimeMs)
  if (!dependenciesNeedInstall) {
    console.log(' [ready] Workspace dependencies')
    return rootPackageJson
  }

  const installArguments = existsSync(lockfilePath) ? ['install', '--frozen-lockfile'] : ['install']
  if (dryRun) {
    console.log(` [plan] pnpm ${installArguments.join(' ')}`)
    return rootPackageJson
  }
  console.log(' [deps] Installing workspace dependencies...')
  if (await runForeground(pnpmExecutable, installArguments) !== 0) {
    throw new PapelizLauncherError('Installing workspace dependencies failed.')
  }
  return rootPackageJson
}

function isLoopbackPortFree(port) {
  return new Promise((resolve) => {
    const portProbe = createNetServer()
    portProbe.once('error', () => resolve(false))
    portProbe.once('listening', () => portProbe.close(() => resolve(true)))
    portProbe.listen(port, papelizLoopbackHost)
  })
}

async function requireFreePort(launcherTarget) {
  if (await isLoopbackPortFree(launcherTarget.port)) return
  throw new PapelizLauncherError(
    `Port ${launcherTarget.port} is already in use. Papeliz may already be running at ${launcherTargetUrl(launcherTarget)}`,
  )
}

function openUrlInBrowser(url) {
  const specification = process.platform === 'win32'
    ? { command: 'cmd.exe', args: ['/d', '/c', `start "" ${url}`], verbatim: true }
    : { command: process.platform === 'darwin' ? 'open' : 'xdg-open', args: [url], verbatim: false }
  const opener = spawn(specification.command, specification.args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    windowsVerbatimArguments: specification.verbatim,
  })
  opener.on('error', () => console.log(` [note] Open ${url} in your browser.`))
  opener.unref()
}

async function waitForUrl(url, isStillRunning) {
  const giveUpAt = Date.now() + 120_000
  while (Date.now() < giveUpAt && isStillRunning()) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(2_000) })
      return true
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  return false
}

// Runs a dev or preview server, mirroring its output to the console and to a log file.
function runLoggedServer(command, args, { launcherRequest, launcherTarget }) {
  mkdirSync(papelizLauncherLogDirectory, { recursive: true })
  const logFilePath = path.join(
    papelizLauncherLogDirectory,
    `papeliz-launcher-${launcherRequest.surfaceName}-${launcherTarget.name}.log`,
  )
  const logStream = createWriteStream(logFilePath, { flags: 'a' })
  logStream.write(`\n=== ${new Date().toISOString()} ${command} ${args.join(' ')}\n`)
  console.log(` [log] ${path.relative(papelizRepositoryRoot, logFilePath)}`)

  const specification = commandSpawnSpecification(command, args)
  const child = spawn(specification.command, specification.args, {
    cwd: papelizRepositoryRoot,
    stdio: ['inherit', 'pipe', 'pipe'],
    windowsVerbatimArguments: specification.verbatim,
    env: { ...papelizChildEnvironment, FORCE_COLOR: '1' },
  })
  let childIsRunning = true
  child.stdout.on('data', (chunk) => { process.stdout.write(chunk); logStream.write(chunk) })
  child.stderr.on('data', (chunk) => { process.stderr.write(chunk); logStream.write(chunk) })

  // Ctrl+C reaches the child from the same console; the launcher only waits for it to finish.
  let stopRequested = false
  const onStopRequest = () => { stopRequested = true }
  process.on('SIGINT', onStopRequest)

  const url = launcherTargetUrl(launcherTarget)
  waitForUrl(url, () => childIsRunning).then((serverAnswered) => {
    if (!serverAnswered) return
    console.log(` [ready] Papeliz is running at ${url}  (Ctrl+C to stop)`)
    if (launcherRequest.openBrowser) openUrlInBrowser(url)
  })

  return new Promise((resolve) => {
    child.on('error', (error) => {
      console.error(` [error] ${error.message}`)
      childIsRunning = false
      resolve(1)
    })
    child.on('exit', (code) => {
      childIsRunning = false
      process.off('SIGINT', onStopRequest)
      logStream.end()
      resolve(stopRequested ? 0 : (code ?? 1))
    })
  })
}

const papelizStaticContentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

// Serves a folder on loopback only, without caching, so edits show on reload. A folder's
// index.html answers for the folder; a 404.html, when present, answers for missing files.
function serveStaticDirectory(launcherTarget, { openBrowser }) {
  const staticDirectory = path.join(papelizRepositoryRoot, launcherTarget.staticDirectory)
  if (!existsSync(staticDirectory)) {
    throw new PapelizLauncherError(
      `${launcherTarget.staticDirectory} does not exist. ${launcherTarget.missingDirectoryHint ?? ''}`.trim(),
    )
  }
  const notFoundPagePath = path.join(staticDirectory, '404.html')

  const staticServer = createHttpServer((request, response) => {
    let requestedPath
    try {
      requestedPath = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
    } catch {
      response.writeHead(400).end('Bad request')
      return
    }
    let filePath = path.resolve(staticDirectory, `.${requestedPath}`)
    if (filePath !== staticDirectory && !filePath.startsWith(staticDirectory + path.sep)) {
      response.writeHead(403).end('Forbidden')
      return
    }
    if (existsSync(filePath) && statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html')
    let statusCode = 200
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      if (!existsSync(notFoundPagePath)) {
        response.writeHead(404).end('Not found')
        return
      }
      filePath = notFoundPagePath
      statusCode = 404
    }
    response.writeHead(statusCode, {
      'Content-Type': papelizStaticContentTypes[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    createReadStream(filePath).pipe(response)
  })

  return new Promise((resolve, reject) => {
    staticServer.once('error', reject)
    staticServer.listen(launcherTarget.port, papelizLoopbackHost, () => {
      const url = launcherTargetUrl(launcherTarget)
      console.log(` [ready] ${launcherTarget.label}: ${url}  (Ctrl+C to stop)`)
      if (openBrowser) openUrlInBrowser(url)
    })
    const stopStaticServer = () => staticServer.close(() => resolve(0))
    process.once('SIGINT', stopStaticServer)
    process.once('SIGTERM', stopStaticServer)
  })
}

// ---- webapp start sync-local --------------------------------------------------------------------
// One `wrangler dev` runs the real Account Worker and Sync Worker, from their own wrangler.jsonc, behind
// the router Worker (build_tools/webapp/papeliz-sync-local-workers-router.mjs), with their local D1,
// Durable Objects and R2 kept in a Git-ignored folder across runs. The site's dev server serves
// /account/, and the webapp's dev server serves the real engine and puts both on the app's origin
// (papeliz-sync-engine-vite-plugin.mjs). Nothing reaches Cloudflare; /account/ signs in with the
// sign-in provider's development instance.

const papelizSyncLocalWorkersStateDirectory = path.join(papelizRepositoryRoot, '.papeliz-sync-local-workers')
const papelizSyncLocalWranglerStateDirectory = path.join(papelizSyncLocalWorkersStateDirectory, 'wrangler-state')
const papelizSyncLocalWorkersRouterPort = 14209
const papelizSyncSignInPageDevServerPort = 14203
// The development instance /account/ signs in with away from papeliz.com
// (site/main/app/account/papeliz-account-config.ts): the Account Worker checks its tokens.
const papelizSyncLocalSignInProviderOrigin = 'https://certain-cub-9360.clerk.accounts.dev'
const papelizSyncLocalGrantSigningKeyId = 'papeliz-sync-local-workers-grant-key'
// Made-up R2 signing values: the router answers the links they sign, and nothing is sent to R2.
const papelizSyncLocalR2SigningSettings = {
  PAPELIZ_SYNC_R2_CLOUDFLARE_ACCOUNT_ID: '00000000000000000000000000000000',
  PAPELIZ_SYNC_R2_ACCESS_KEY_ID: 'papeliz-sync-local-workers-r2-access-key-id',
  PAPELIZ_SYNC_R2_SECRET_ACCESS_KEY: 'papeliz-sync-local-workers-r2-secret-access-key',
}

// Made on the first run and kept, so device sessions and their grants outlast a restart.
async function readOrCreatePapelizSyncLocalGrantSigningKey() {
  const grantSigningKeyFilePath = path.join(papelizSyncLocalWorkersStateDirectory, 'papeliz-sync-local-grant-signing-key.json')
  if (existsSync(grantSigningKeyFilePath)) return JSON.parse(readFileSync(grantSigningKeyFilePath, 'utf8'))
  const grantKeyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
  const grantSigningKey = {
    grantSigningPrivateJwk: { ...(await crypto.subtle.exportKey('jwk', grantKeyPair.privateKey)), kid: papelizSyncLocalGrantSigningKeyId },
    grantVerifyingPublicJwk: { ...(await crypto.subtle.exportKey('jwk', grantKeyPair.publicKey)), kid: papelizSyncLocalGrantSigningKeyId, alg: 'EdDSA', use: 'sig' },
  }
  writeFileSync(grantSigningKeyFilePath, `${JSON.stringify(grantSigningKey, null, 2)}\n`)
  return grantSigningKey
}

// A Worker's generated wrangler.json and, beside it, the .dev.vars that `wrangler dev` reads for it.
function writePapelizSyncLocalWorkerFiles(workerFolderName, workerConfig, workerDevVars) {
  const workerFolder = path.join(papelizSyncLocalWorkersStateDirectory, workerFolderName)
  mkdirSync(workerFolder, { recursive: true })
  const workerConfigFilePath = path.join(workerFolder, 'wrangler.json')
  writeFileSync(workerConfigFilePath, `${JSON.stringify(workerConfig, null, 2)}\n`)
  const devVarsLines = Object.entries(workerDevVars).map(([devVarName, devVarValue]) => `${devVarName}='${devVarValue}'`)
  writeFileSync(path.join(workerFolder, '.dev.vars'), `${devVarsLines.join('\n')}\n`)
  return workerConfigFilePath
}

// `wrangler dev` gives settings and secrets only to its first Worker, and reads every other Worker's
// from a .dev.vars beside that Worker's config. So each Worker runs from a copy of its own
// wrangler.jsonc, made again on every start (its paths made absolute, its Cloudflare routes left out),
// with local settings beside it; the Workers' own folders are never written to.
async function preparePapelizSyncLocalWorkers(webappSyncLocalOrigin) {
  const syncWorkspaceRoot = path.join(papelizRepositoryRoot, 'sync')
  const accountWorkerFolder = path.join(syncWorkspaceRoot, 'papeliz-sync-account-worker')
  const vaultWorkerFolder = path.join(syncWorkspaceRoot, 'papeliz-sync-vault-worker')
  if (!existsSync(path.join(accountWorkerFolder, 'wrangler.jsonc')) || !existsSync(path.join(vaultWorkerFolder, 'wrangler.jsonc'))) {
    throw new PapelizLauncherError('This checkout has no Papeliz Sync Workers (sync/), so there is nothing to run locally.')
  }
  if (!existsSync(path.join(syncWorkspaceRoot, 'node_modules'))) throw new PapelizLauncherError("Papeliz Sync's packages aren't installed. Run: pnpm --dir sync install")
  const requireFromAccountWorker = createRequire(path.join(accountWorkerFolder, 'package.json'))
  const wranglerPackageJsonPath = requireFromAccountWorker.resolve('wrangler/package.json')
  const wranglerCommandFilePath = path.join(path.dirname(wranglerPackageJsonPath), JSON.parse(readFileSync(wranglerPackageJsonPath, 'utf8')).bin.wrangler)
  const { experimental_readRawConfig: readWranglerRawConfig } = await import(pathToFileURL(requireFromAccountWorker.resolve('wrangler')).href)
  const readWorkerConfigForLocalRun = (workerFolder) => {
    const { routes: _cloudflareRoutes, ...workerConfig } = readWranglerRawConfig({ config: path.join(workerFolder, 'wrangler.jsonc') }).rawConfig
    return { ...workerConfig, main: path.resolve(workerFolder, workerConfig.main) }
  }
  const accountWorkerConfig = readWorkerConfigForLocalRun(accountWorkerFolder)
  accountWorkerConfig.d1_databases = (accountWorkerConfig.d1_databases ?? []).map((d1Database) => ({
    ...d1Database,
    migrations_dir: path.resolve(accountWorkerFolder, d1Database.migrations_dir ?? 'migrations'),
  }))
  const vaultWorkerConfig = readWorkerConfigForLocalRun(vaultWorkerFolder)
  const accountDirectoryDatabase = accountWorkerConfig.d1_databases.find((d1Database) => d1Database.binding === 'PAPELIZ_SYNC_ACCOUNT_DIRECTORY')
  if (!accountDirectoryDatabase) throw new PapelizLauncherError("The Account Worker's wrangler.jsonc has no PAPELIZ_SYNC_ACCOUNT_DIRECTORY database.")

  mkdirSync(papelizSyncLocalWorkersStateDirectory, { recursive: true })
  const { grantSigningPrivateJwk, grantVerifyingPublicJwk } = await readOrCreatePapelizSyncLocalGrantSigningKey()
  const grantPublicKeySetText = JSON.stringify({ keys: [grantVerifyingPublicJwk] })
  const routerConfigFilePath = writePapelizSyncLocalWorkerFiles(
    'papeliz-sync-local-workers-router',
    {
      name: 'papeliz-sync-local-workers-router',
      main: path.join(papelizRepositoryRoot, 'build_tools', 'webapp', 'papeliz-sync-local-workers-router.mjs'),
      compatibility_date: vaultWorkerConfig.compatibility_date,
      services: [
        { binding: 'PAPELIZ_SYNC_ACCOUNT_WORKER', service: accountWorkerConfig.name },
        { binding: 'PAPELIZ_SYNC_VAULT_WORKER', service: vaultWorkerConfig.name },
      ],
      durable_objects: { bindings: [{ name: 'PAPELIZ_SYNC_ACCOUNT_DURABLE_OBJECT', class_name: 'PapelizSyncAccountDurableObject', script_name: accountWorkerConfig.name }] },
      d1_databases: [accountDirectoryDatabase],
      r2_buckets: vaultWorkerConfig.r2_buckets,
    },
    {},
  )
  const accountWorkerConfigFilePath = writePapelizSyncLocalWorkerFiles(accountWorkerConfig.name, accountWorkerConfig, {
    PAPELIZ_SYNC_GRANT_SIGNING_PRIVATE_KEY: JSON.stringify(grantSigningPrivateJwk),
    PAPELIZ_SYNC_GRANT_PUBLIC_KEY_SET: grantPublicKeySetText,
    PAPELIZ_SYNC_ALLOWED_SIGN_IN_ORIGINS: webappSyncLocalOrigin,
    PAPELIZ_SYNC_SIGN_IN_TOKEN_ISSUER: papelizSyncLocalSignInProviderOrigin,
    PAPELIZ_SYNC_SIGN_IN_JWKS_URL: `${papelizSyncLocalSignInProviderOrigin}/.well-known/jwks.json`,
    PAPELIZ_SYNC_CHECKOUT_SUCCESS_URL: `${webappSyncLocalOrigin}/`,
    PAPELIZ_SYNC_LOCAL_RUNTIME_WITHOUT_JURISDICTIONS: 'true',
  })
  const vaultWorkerConfigFilePath = writePapelizSyncLocalWorkerFiles(vaultWorkerConfig.name, vaultWorkerConfig, {
    PAPELIZ_SYNC_GRANT_PUBLIC_KEY_SET: grantPublicKeySetText,
    ...papelizSyncLocalR2SigningSettings,
    PAPELIZ_SYNC_LOCAL_RUNTIME_WITHOUT_JURISDICTIONS: 'true',
  })
  return {
    wranglerCommandFilePath,
    accountDirectoryDatabaseName: accountDirectoryDatabase.database_name,
    accountWorkerConfigFilePath,
    workerConfigFilePaths: [routerConfigFilePath, accountWorkerConfigFilePath, vaultWorkerConfigFilePath],
  }
}

// One of sync-local's three servers: its output goes to the console, each line marked with its name,
// and to its own log.
function startPapelizSyncLocalServer({ serverName, command, args, cwd, extraEnvironment = {} }) {
  mkdirSync(papelizLauncherLogDirectory, { recursive: true })
  const logFilePath = path.join(papelizLauncherLogDirectory, `papeliz-launcher-webapp-sync-local-${serverName}.log`)
  const logStream = createWriteStream(logFilePath, { flags: 'a' })
  logStream.write(`\n=== ${new Date().toISOString()} ${command} ${args.join(' ')}\n`)
  console.log(` [log] ${path.relative(papelizRepositoryRoot, logFilePath)}`)
  const specification = commandSpawnSpecification(command, args)
  const childProcess = spawn(specification.command, specification.args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsVerbatimArguments: specification.verbatim,
    env: { ...papelizChildEnvironment, FORCE_COLOR: '1', ...extraEnvironment },
  })
  for (const [childOutputStream, consoleStream] of [[childProcess.stdout, process.stdout], [childProcess.stderr, process.stderr]]) {
    createInterface({ input: childOutputStream }).on('line', (outputLine) => {
      consoleStream.write(`[${serverName}] ${outputLine}\n`)
      logStream.write(`${outputLine}\n`)
    })
  }
  const serverExit = new Promise((resolve) => {
    childProcess.on('error', (error) => {
      console.error(` [error] ${serverName}: ${error.message}`)
      resolve(1)
    })
    childProcess.on('exit', (code) => {
      logStream.end()
      resolve(code ?? 1)
    })
  })
  return { serverName, childProcess, serverExit }
}

function stopPapelizSyncLocalServers(syncLocalServers) {
  for (const { childProcess } of syncLocalServers) {
    if (childProcess.exitCode !== null || childProcess.pid === undefined) continue
    // pnpm and wrangler each start their own server process; stop the whole tree.
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(childProcess.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true })
    else childProcess.kill('SIGTERM')
  }
}

async function runPapelizSyncLocalWorkersTarget(launcherRequest, launcherTarget, webappScriptArguments) {
  const webappSyncLocalOrigin = `http://${papelizLoopbackHost}:${launcherTarget.port}`
  const localWorkersRouterOrigin = `http://${papelizLoopbackHost}:${papelizSyncLocalWorkersRouterPort}`
  const signInPageDevServerOrigin = `http://${papelizLoopbackHost}:${papelizSyncSignInPageDevServerPort}`
  const stateDirectoryForDisplay = path.relative(papelizRepositoryRoot, papelizSyncLocalWorkersStateDirectory)
  if (launcherRequest.dryRun) {
    console.log(` [plan] Write each Worker's local config and .dev.vars into ${stateDirectoryForDisplay}/ (Git-ignored)`)
    console.log(` [plan] wrangler d1 migrations apply <account directory> --local, then wrangler dev with the router, Account and Sync Workers on ${localWorkersRouterOrigin}`)
    console.log(` [plan] pnpm run site:dev ${nextServerArguments(papelizSyncSignInPageDevServerPort).join(' ')} (unless a server already answers on ${papelizSyncSignInPageDevServerPort})`)
    console.log(` [plan] pnpm ${webappScriptArguments.join(' ')}, with the real Sync engine and its proxy to ${localWorkersRouterOrigin} and ${signInPageDevServerOrigin}`)
    return 0
  }
  await requireFreePort(launcherTarget)
  if (!(await isLoopbackPortFree(papelizSyncLocalWorkersRouterPort))) {
    throw new PapelizLauncherError(`Port ${papelizSyncLocalWorkersRouterPort} is already in use. The local Sync Workers may already be running at ${localWorkersRouterOrigin}`)
  }
  const preparedLocalWorkers = await preparePapelizSyncLocalWorkers(webappSyncLocalOrigin)
  console.log(` [ready] Local Workers' configs and settings in ${stateDirectoryForDisplay}/`)
  // CI makes wrangler apply the migrations without asking first.
  const migrationsExitCode = await runForeground(
    process.execPath,
    [preparedLocalWorkers.wranglerCommandFilePath, 'd1', 'migrations', 'apply', preparedLocalWorkers.accountDirectoryDatabaseName, '--local', '--persist-to', papelizSyncLocalWranglerStateDirectory, '-c', preparedLocalWorkers.accountWorkerConfigFilePath],
    { cwd: papelizSyncLocalWorkersStateDirectory, extraEnvironment: { CI: 'true' } },
  )
  if (migrationsExitCode !== 0) throw new PapelizLauncherError("Applying the account directory's migrations to the local D1 failed.")

  const syncLocalServers = []
  const stopSyncLocalServers = () => stopPapelizSyncLocalServers(syncLocalServers)
  process.once('exit', stopSyncLocalServers)
  // Ctrl+C reaches every server from the same console; the launcher waits for them to finish.
  let stopRequested = false
  process.once('SIGINT', () => { stopRequested = true })
  process.once('SIGTERM', () => {
    stopRequested = true
    stopSyncLocalServers()
  })

  const localWorkersServer = startPapelizSyncLocalServer({
    serverName: 'workers',
    command: process.execPath,
    args: [
      preparedLocalWorkers.wranglerCommandFilePath,
      'dev',
      ...preparedLocalWorkers.workerConfigFilePaths.flatMap((workerConfigFilePath) => ['-c', workerConfigFilePath]),
      '--ip', papelizLoopbackHost,
      '--port', String(papelizSyncLocalWorkersRouterPort),
      '--persist-to', papelizSyncLocalWranglerStateDirectory,
      '--show-interactive-dev-session=false',
    ],
    cwd: papelizSyncLocalWorkersStateDirectory,
    extraEnvironment: { WRANGLER_SEND_METRICS: 'false' },
  })
  syncLocalServers.push(localWorkersServer)
  if (!(await waitForUrl(localWorkersRouterOrigin, () => localWorkersServer.childProcess.exitCode === null))) {
    stopSyncLocalServers()
    throw new PapelizLauncherError('The local Sync Workers did not start; see the workers log.')
  }
  console.log(` [ready] Local Account and Sync Workers at ${localWorkersRouterOrigin}`)

  if (await isLoopbackPortFree(papelizSyncSignInPageDevServerPort)) {
    syncLocalServers.push(startPapelizSyncLocalServer({
      serverName: 'site',
      command: pnpmExecutable,
      args: ['run', 'site:dev', ...nextServerArguments(papelizSyncSignInPageDevServerPort)],
      cwd: papelizRepositoryRoot,
    }))
  } else {
    console.log(` [note] A server already answers on ${papelizSyncSignInPageDevServerPort}; /account/ comes from it (the site's dev server).`)
  }
  const webappServer = startPapelizSyncLocalServer({
    serverName: 'webapp',
    command: pnpmExecutable,
    args: webappScriptArguments,
    cwd: papelizRepositoryRoot,
    extraEnvironment: {
      [papelizSyncLocalWorkersOriginVariableName]: localWorkersRouterOrigin,
      [papelizSyncSignInPageDevServerOriginVariableName]: signInPageDevServerOrigin,
    },
  })
  syncLocalServers.push(webappServer)
  const webappUrl = launcherTargetUrl(launcherTarget)
  waitForUrl(webappUrl, () => webappServer.childProcess.exitCode === null).then((webappAnswered) => {
    if (!webappAnswered) return
    console.log(` [ready] Papeliz with Sync against local Workers: ${webappUrl}  (Ctrl+C to stop)`)
    console.log(` [ready] Sign-in page on the app's origin: ${webappSyncLocalOrigin}/account/`)
    console.log(` [note] Plans: GET ${webappSyncLocalOrigin}/papeliz-sync-local-workers/account-plan lists the local accounts;`)
    console.log('        POST {"syncPlanName":"standard"} to it gives every local account a plan (plus, pro, or null for none).')
    if (launcherRequest.openBrowser) openUrlInBrowser(webappUrl)
  })

  const { stoppedServerName, stoppedServerExitCode } = await Promise.race(
    syncLocalServers.map(({ serverName, serverExit }) => serverExit.then((serverExitCode) => ({ stoppedServerName: serverName, stoppedServerExitCode: serverExitCode }))),
  )
  if (!stopRequested) console.log(` [note] The ${stoppedServerName} server stopped (exit ${stoppedServerExitCode}); stopping the others.`)
  stopSyncLocalServers()
  return stopRequested ? 0 : stoppedServerExitCode
}

async function runPapelizLauncher(argv) {
  const launcherRequest = parsePapelizLauncherArguments(argv)
  if (launcherRequest.help) {
    printPapelizLauncherHelp(launcherRequest)
    return 0
  }

  const launcherTarget = launcherRequest.target
    ? resolvePapelizLauncherTarget(launcherRequest, launcherRequest.target)
    : launcherRequest.dryRun
      ? launcherTargetsFor(launcherRequest)[0]
      : await chooseLauncherTargetFromMenu(launcherRequest)
  const dryRunNote = launcherRequest.dryRun ? ' · dry run' : ''
  console.log(
    `\n Papeliz · ${launcherRequest.surfaceName} · ${launcherRequest.action} · ${launcherTarget.name} · ${launcherRequest.platform}${dryRunNote}\n`,
  )

  checkNodeVersion()

  if (launcherTarget.staticDirectory) {
    if (launcherRequest.dryRun) {
      console.log(` [plan] Serve ${launcherTarget.staticDirectory} at ${launcherTargetUrl(launcherTarget)}`)
      return 0
    }
    await requireFreePort(launcherTarget)
    return serveStaticDirectory(launcherTarget, launcherRequest)
  }

  await ensurePnpm(launcherRequest)
  const rootPackageJson = await ensureWorkspaceDependencies(launcherRequest)
  const rootScriptArguments = ['run', launcherTarget.rootScript]
  if (launcherTarget.port) rootScriptArguments.push(...launcherTarget.serverArguments(launcherTarget.port))
  const rootScriptIsReady = Boolean(rootPackageJson?.scripts?.[launcherTarget.rootScript])
  if (launcherTarget.isSyncLocalWorkersTarget && rootScriptIsReady) return runPapelizSyncLocalWorkersTarget(launcherRequest, launcherTarget, rootScriptArguments)

  if (launcherRequest.dryRun) {
    console.log(` [plan] pnpm ${rootScriptArguments.join(' ')}`)
    if (!rootScriptIsReady) console.log(` [note] The root package.json has no "${launcherTarget.rootScript}" script yet.`)
    return 0
  }
  if (!rootScriptIsReady) {
    throw new PapelizLauncherError(
      `Not set up yet: the root package.json has no "${launcherTarget.rootScript}" script.\n`
      + ` ${papelizLauncherSurfaces[launcherRequest.surfaceName].missingScriptHint}`,
    )
  }
  if (!launcherTarget.port) return runForeground(pnpmExecutable, rootScriptArguments)

  await requireFreePort(launcherTarget)
  return runLoggedServer(pnpmExecutable, rootScriptArguments, { launcherRequest, launcherTarget })
}

runPapelizLauncher(process.argv.slice(2)).then(
  (exitCode) => process.exit(exitCode),
  (error) => {
    console.error(`\n [error] ${error.message}`)
    process.exit(error instanceof PapelizLauncherError ? error.exitCode : 1)
  },
)
