import { readFileSync } from 'node:fs'
import path from 'node:path'
import { isPapelizSiteTemplatesWorkerSwitchedOn } from './papeliz-site-config'
import { readPapelizSiteTemplatesSnapshot, type PapelizSiteTemplatesSnapshot } from './papeliz-site-templates'

// The Templates list the site build turns into pages, read once per build process. Only the build
// reads it; no page carries where it came from.
//
// Where from:
// - While the Templates Worker is switched off (isPapelizSiteTemplatesWorkerSwitchedOn), only the
//   templates built into Papeliz: the app's static list, the same file its gallery lists.
// - Switched on, in order: PAPELIZ_SITE_TEMPLATES_SNAPSHOT_URL when set (the deploy build points it at
//   https://papeliz.com/api/templates/gallery), then the Templates Worker on this computer, behind the
//   launcher's local Workers, then the static list when neither answers with a list.

const papelizSiteTemplatesSnapshotUrlVariableName = 'PAPELIZ_SITE_TEMPLATES_SNAPSHOT_URL'
// The launcher's router for the local Sync and Templates Workers (`webapp start sync-local`).
const papelizSiteLocalTemplatesWorkerSnapshotUrl = 'http://127.0.0.1:14209/api/templates/gallery'
const papelizSiteTemplatesSnapshotReadTimeoutMilliseconds = 4000

// The app's static list, in the Templates Worker's own snapshot shape, from this site's folder
// (site/main/), as the build and the tests run.
export const papelizSiteTemplatesStaticListFilePath = path.join(process.cwd(), '..', '..', 'app', 'web', 'src', 'modules', 'template-gallery', 'papeliz-template-gallery-static-list.json')

// The static list's text, read the way a Worker's list is. One that doesn't read stops the build, since
// every page would be missing its templates.
export function parsePapelizSiteTemplatesStaticList(papelizSiteTemplatesStaticListText: string): PapelizSiteTemplatesSnapshot {
  const papelizSiteTemplatesStaticList = readPapelizSiteTemplatesSnapshot(JSON.parse(papelizSiteTemplatesStaticListText))
  if (papelizSiteTemplatesStaticList === null || papelizSiteTemplatesStaticList.templateGallerySnapshotRows.length === 0) {
    throw new Error(`The Templates static list (${papelizSiteTemplatesStaticListFilePath}) isn't a list of templates.`)
  }
  return papelizSiteTemplatesStaticList
}

export function readPapelizSiteTemplatesStaticList(): PapelizSiteTemplatesSnapshot {
  return parsePapelizSiteTemplatesStaticList(readFileSync(papelizSiteTemplatesStaticListFilePath, 'utf8'))
}

async function readPapelizSiteTemplatesSnapshotFrom(papelizSiteTemplatesSnapshotUrl: string): Promise<PapelizSiteTemplatesSnapshot | null> {
  try {
    // No cache option: "no-store" would make Next treat the page as dynamic, which a static export
    // can't build, and a cached read could carry one build's list into the next.
    const snapshotResponse = await fetch(papelizSiteTemplatesSnapshotUrl, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(papelizSiteTemplatesSnapshotReadTimeoutMilliseconds),
    })
    if (!snapshotResponse.ok) return null
    return readPapelizSiteTemplatesSnapshot(await snapshotResponse.json())
  } catch {
    return null
  }
}

export async function readPapelizSiteTemplatesBuildSnapshotOnce(): Promise<PapelizSiteTemplatesSnapshot> {
  if (!isPapelizSiteTemplatesWorkerSwitchedOn) {
    const papelizSiteTemplatesStaticList = readPapelizSiteTemplatesStaticList()
    console.log(` [templates] ${papelizSiteTemplatesStaticList.templateGallerySnapshotRows.length} template(s) from the static list; the Templates Worker is switched off.`)
    return papelizSiteTemplatesStaticList
  }
  const papelizSiteTemplatesSnapshotUrls = [process.env[papelizSiteTemplatesSnapshotUrlVariableName], papelizSiteLocalTemplatesWorkerSnapshotUrl].filter(
    (papelizSiteTemplatesSnapshotUrl): papelizSiteTemplatesSnapshotUrl is string => typeof papelizSiteTemplatesSnapshotUrl === 'string' && papelizSiteTemplatesSnapshotUrl !== '',
  )
  for (const papelizSiteTemplatesSnapshotUrl of papelizSiteTemplatesSnapshotUrls) {
    const papelizSiteTemplatesSnapshot = await readPapelizSiteTemplatesSnapshotFrom(papelizSiteTemplatesSnapshotUrl)
    if (papelizSiteTemplatesSnapshot !== null) {
      console.log(` [templates] ${papelizSiteTemplatesSnapshot.templateGallerySnapshotRows.length} template(s) from ${papelizSiteTemplatesSnapshotUrl}`)
      return papelizSiteTemplatesSnapshot
    }
  }
  console.log(` [templates] The Templates Worker didn't answer; the build uses the static list.`)
  return readPapelizSiteTemplatesStaticList()
}

let papelizSiteTemplatesBuildSnapshotPromise: Promise<PapelizSiteTemplatesSnapshot> | null = null

export function readPapelizSiteTemplatesBuildSnapshot(): Promise<PapelizSiteTemplatesSnapshot> {
  papelizSiteTemplatesBuildSnapshotPromise ??= readPapelizSiteTemplatesBuildSnapshotOnce()
  return papelizSiteTemplatesBuildSnapshotPromise
}
