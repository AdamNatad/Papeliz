import { isPapelizSiteTemplatesOpen } from './papeliz-site-config'
import { readPapelizSiteTemplatesSnapshot, type PapelizSiteTemplatesSnapshot } from './papeliz-site-templates'

// The Templates list the site build turns into pages, read once per build process. Only the build
// reads it; no page carries where it came from.
//
// Where from, in order:
// 1. PAPELIZ_SITE_TEMPLATES_SNAPSHOT_URL, when set: the deploy build points it at
//    https://papeliz.com/api/templates/gallery once the Templates Worker answers there.
// 2. The Templates Worker on this computer, behind the launcher's local Workers.
// 3. When neither answers with a list, the stand-in below, so the build still has the pages to check.

const papelizSiteTemplatesSnapshotUrlVariableName = 'PAPELIZ_SITE_TEMPLATES_SNAPSHOT_URL'
// The launcher's router for the local Sync and Templates Workers (`webapp start sync-local`).
const papelizSiteLocalTemplatesWorkerSnapshotUrl = 'http://127.0.0.1:14209/api/templates/gallery'
const papelizSiteTemplatesSnapshotReadTimeoutMilliseconds = 4000

// The stand-in: only the first template, P1-Workflow, with what is already decided about it (its
// repository, manifest, license and its agent hooks, which run commands). It knows no commit, file
// count, date or vote, so its page shows none.
const papelizSiteTemplatesStandInSnapshot: PapelizSiteTemplatesSnapshot = {
  templateGallerySnapshotBuiltAt: null,
  featuredPapelizTemplateGalleryIds: ['AdamNatad/P1-Workflow'],
  templateGallerySnapshotRows: [
    {
      papelizTemplateGalleryId: 'AdamNatad/P1-Workflow',
      templateRepositoryOwner: 'AdamNatad',
      templateRepositoryName: 'P1-Workflow',
      templateCommitSha: null,
      templateName: 'P1-Workflow',
      templateDescription:
        'Your personal knowledge base that grows as you build your project: one folder of plain Markdown that holds the plan, the tasks, the decisions and the rules every AI coding agent follows.',
      templateTags: ['coding', 'project-workflow', 'ai-agents'],
      templateLicenseId: 'MIT',
      templateIncludedFileCount: null,
      templateIncludedByteCount: null,
      isTemplateRunningCommands: true,
      isTemplateFeatured: true,
      templateListedAt: null,
      templateCheckedAt: null,
      templateUpVoteCount: 0,
      templateDownVoteCount: 0,
      templateTopRank: null,
    },
  ],
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

async function readPapelizSiteTemplatesBuildSnapshotOnce(): Promise<PapelizSiteTemplatesSnapshot> {
  // Closed Templates read no Worker, so a build made beside the local test Workers never takes their list.
  if (!isPapelizSiteTemplatesOpen) {
    console.log(` [templates] Templates are closed in this build; it uses its stand-in list (P1-Workflow).`)
    return papelizSiteTemplatesStandInSnapshot
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
  console.log(` [templates] The Templates Worker didn't answer; the build uses its stand-in list (P1-Workflow).`)
  return papelizSiteTemplatesStandInSnapshot
}

let papelizSiteTemplatesBuildSnapshotPromise: Promise<PapelizSiteTemplatesSnapshot> | null = null

export function readPapelizSiteTemplatesBuildSnapshot(): Promise<PapelizSiteTemplatesSnapshot> {
  papelizSiteTemplatesBuildSnapshotPromise ??= readPapelizSiteTemplatesBuildSnapshotOnce()
  return papelizSiteTemplatesBuildSnapshotPromise
}
