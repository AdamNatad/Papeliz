#!/usr/bin/env node
// Papeliz launcher. The per-OS scripts in build_tools/<webapp|site|site/help>/<os>/ call this file:
//   node build_tools/shared/launcher/papeliz-launcher.mjs <webapp|site|help> <start|build> <windows|macos|linux|auto> [target] [options]
// It checks Node.js and pnpm, installs workspace dependencies when needed, then starts or builds
// Papeliz on a fixed loopback port, mirroring the output to a log in test_trash/logs/.

import { spawn, spawnSync } from 'node:child_process'
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import { createServer as createNetServer } from 'node:net'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

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
    console.log(`  ${launcherTarget.name.padEnd(8)} ${launcherTarget.label}${defaultNote}${url ? `  ${url}` : ''}`)
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

function runForeground(command, args) {
  const specification = commandSpawnSpecification(command, args)
  return new Promise((resolve) => {
    const child = spawn(specification.command, specification.args, {
      cwd: papelizRepositoryRoot,
      env: papelizChildEnvironment,
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
