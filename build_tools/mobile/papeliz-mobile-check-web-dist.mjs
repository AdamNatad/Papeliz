// Checks that a web build carries nothing of the Android and iOS app: no Tauri, and none of the phone
// layout, whose class names all start with `papeliz-mobile-` (app/mobile/papeliz-mobile-layout/). The
// web build resolves the mobile seam to its stand-in, so papeliz.com, its phone view included, keeps the
// web's own layout.
//
// Usage: node build_tools/mobile/papeliz-mobile-check-web-dist.mjs [web build folder, default app/web/dist]
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const webDistDirectory = path.resolve(process.argv[2] ?? path.join(repositoryRootDirectory, 'app', 'web', 'dist'))
const mobileOnlyMarkers = ['tauri', 'papeliz-mobile-']

function listWebDistFiles(webDistFolder) {
  return readdirSync(webDistFolder).flatMap((webDistEntryName) => {
    const webDistEntryPath = path.join(webDistFolder, webDistEntryName)
    return statSync(webDistEntryPath).isDirectory() ? listWebDistFiles(webDistEntryPath) : [webDistEntryPath]
  })
}

const webDistFiles = listWebDistFiles(webDistDirectory)
const mobileMarkerFindings = webDistFiles.flatMap((webDistFile) => {
  const webDistFileText = readFileSync(webDistFile, 'latin1').toLowerCase()
  return mobileOnlyMarkers.filter((mobileOnlyMarker) => webDistFileText.includes(mobileOnlyMarker)).map((mobileOnlyMarker) => `${path.relative(webDistDirectory, webDistFile)}: "${mobileOnlyMarker}"`)
})

if (webDistFiles.length === 0) {
  console.error(`No files in ${webDistDirectory}: build the web app first.`)
  process.exit(1)
}
if (mobileMarkerFindings.length > 0) {
  console.error(`The web build carries mobile code:\n${mobileMarkerFindings.join('\n')}`)
  process.exit(1)
}
console.log(`The web build carries no mobile code: ${webDistFiles.length} files in ${path.relative(repositoryRootDirectory, webDistDirectory) || webDistDirectory}.`)
