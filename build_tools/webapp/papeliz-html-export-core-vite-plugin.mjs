// The webapp's `virtual:papeliz-html-export-core` module: the HTML export's core
// (app/web/src/modules/html-export/papeliz-html-export-core-entry.ts) bundled by Vite into one
// self-contained ES module for Node, as text, with the licenses of everything in it. An exported
// website's Astro project carries the bundle, so `npm run build` there renders the notes with the
// same code Papeliz used, needing no package but Astro. It is bundled again whenever the webapp
// starts, builds or tests, so it never goes stale.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const papelizHtmlExportCoreModuleId = 'virtual:papeliz-html-export-core'
const papelizHtmlExportCoreResolvedModuleId = `\0${papelizHtmlExportCoreModuleId}`
// Lucide's icon shapes are copied into the export's own icon table rather than imported.
const papelizHtmlExportCoreCopiedPackageNames = ['lucide-react']

// "…/node_modules/.pnpm/unified@11.0.5/node_modules/unified/lib/index.js" -> its package's folder.
function findPackageFolder(moduleFilePath) {
  const normalizedModuleFilePath = moduleFilePath.replace(/\\/g, '/')
  const nodeModulesIndex = normalizedModuleFilePath.lastIndexOf('/node_modules/')
  if (nodeModulesIndex === -1) return null
  const packagePathSegments = normalizedModuleFilePath.slice(nodeModulesIndex + '/node_modules/'.length).split('/')
  const packageNameSegmentCount = packagePathSegments[0]?.startsWith('@') ? 2 : 1
  return `${normalizedModuleFilePath.slice(0, nodeModulesIndex)}/node_modules/${packagePathSegments.slice(0, packageNameSegmentCount).join('/')}`
}

function readPackageLicenseText(packageFolder) {
  const licenseFileName = readdirSync(packageFolder).find((packageFileName) => /^licen[cs]e(\.(md|txt))?$/i.test(packageFileName))
  return licenseFileName === undefined ? null : readFileSync(join(packageFolder, licenseFileName), 'utf8').trim()
}

function describePackageLicense(packageFolder, packageNote) {
  const packageManifest = JSON.parse(readFileSync(join(packageFolder, 'package.json'), 'utf8'))
  const packageLicenseText = readPackageLicenseText(packageFolder) ?? `Licensed under ${packageManifest.license ?? 'its own terms'}; see https://www.npmjs.com/package/${packageManifest.name}.`
  return `## ${packageManifest.name} ${packageManifest.version} (${packageManifest.license ?? 'see below'})${packageNote}\n\n${packageLicenseText}`
}

async function bundlePapelizHtmlExportCore(buildWithVite, webappRootFolder) {
  const coreBuildOutput = await buildWithVite({
    configFile: false,
    root: webappRootFolder,
    logLevel: 'warn',
    // A build for Node, with every package inside: some packages have a browser version that needs
    // a page (`document`), which Astro's build doesn't have. Always their production version, even
    // while testing: the development versions check themselves with Node's `assert`.
    ssr: { noExternal: true, target: 'node', resolve: { conditions: ['module', 'node', 'production'] } },
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      write: false,
      target: 'node22',
      minify: true,
      ssr: join(webappRootFolder, 'src/modules/html-export/papeliz-html-export-core-entry.ts'),
      rolldownOptions: { output: { format: 'es', entryFileNames: 'papeliz-html-export-core.mjs' } },
    },
  })
  const coreChunks = (Array.isArray(coreBuildOutput) ? coreBuildOutput : [coreBuildOutput]).flatMap((buildResult) => buildResult.output).filter((buildFile) => buildFile.type === 'chunk')
  if (coreChunks.length !== 1) throw new Error(`The HTML export core should bundle to one file, not ${coreChunks.length}.`)
  const coreChunk = coreChunks[0]

  const requireFromWebapp = createRequire(join(webappRootFolder, 'package.json'))
  const bundledPackageFolders = [...new Set(coreChunk.moduleIds.map(findPackageFolder).filter((packageFolder) => packageFolder !== null))].sort()
  const copiedPackageFolders = papelizHtmlExportCoreCopiedPackageNames.map((packageName) => dirname(requireFromWebapp.resolve(`${packageName}/package.json`)))
  const papelizLicensePath = join(webappRootFolder, '../../LICENSE')
  const coreLicensesText = [
    '# Licenses of papeliz-html-export-core.mjs',
    '',
    'This file bundles Papeliz’s own code with the open-source packages listed below, each under its own license.',
    '',
    `## Papeliz (MIT)\n\n${existsSync(papelizLicensePath) ? readFileSync(papelizLicensePath, 'utf8').trim() : 'MIT License, Copyright (c) 2026 Natad Corporation.'}`,
    ...bundledPackageFolders.map((packageFolder) => describePackageLicense(packageFolder, '')),
    ...copiedPackageFolders.map((packageFolder) => describePackageLicense(packageFolder, ', its icon shapes')),
  ].join('\n\n')
  return {
    coreText: coreChunk.code,
    coreLicensesText: `${coreLicensesText}\n`,
    coreSourceFilePaths: coreChunk.moduleIds.filter((moduleId) => !moduleId.includes('/node_modules/') && !moduleId.includes('\\node_modules\\') && !moduleId.startsWith('\0')),
  }
}

// `buildWithVite` is Vite's own `build`, passed in by the webapp's config, so the core is bundled by the
// same Vite as the webapp.
export function papelizHtmlExportCorePlugin(buildWithVite) {
  let webappRootFolder = ''
  return {
    name: 'papeliz-html-export-core',
    configResolved(resolvedViteConfig) {
      webappRootFolder = resolvedViteConfig.root
    },
    resolveId(importedModuleId) {
      return importedModuleId === papelizHtmlExportCoreModuleId ? papelizHtmlExportCoreResolvedModuleId : undefined
    },
    async load(loadedModuleId) {
      if (loadedModuleId !== papelizHtmlExportCoreResolvedModuleId) return undefined
      const { coreText, coreLicensesText, coreSourceFilePaths } = await bundlePapelizHtmlExportCore(buildWithVite, webappRootFolder)
      for (const coreSourceFilePath of coreSourceFilePaths) this.addWatchFile(coreSourceFilePath)
      return `export const papelizHtmlExportCoreText = ${JSON.stringify(coreText)}\nexport const papelizHtmlExportCoreLicensesText = ${JSON.stringify(coreLicensesText)}\n`
    },
  }
}
