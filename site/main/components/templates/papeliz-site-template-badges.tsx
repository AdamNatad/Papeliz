import { Star, Terminal } from 'lucide-react'
import {
  isPapelizSiteTemplateNew,
  describePapelizSiteTemplateLicenseName,
  readPapelizSiteTemplateCategoryNames,
  type PapelizSiteTemplatesSnapshotRow,
} from '@/lib/papeliz-site-templates'

const papelizSiteTemplateBadgeClassName = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs leading-5 font-semibold whitespace-nowrap'

// A template's Category and subcategory, "Coding › Project Workflow", as one blue chip.
export function PapelizSiteTemplateCategoryBadge({ papelizSiteTemplateRow }: { papelizSiteTemplateRow: PapelizSiteTemplatesSnapshotRow }) {
  const { templateCategoryDisplayName, templateSubcategoryDisplayName } = readPapelizSiteTemplateCategoryNames(papelizSiteTemplateRow)
  return (
    <span className={`${papelizSiteTemplateBadgeClassName} bg-papeliz-blue-soft text-papeliz-blue`}>
      {templateCategoryDisplayName}
      {templateSubcategoryDisplayName !== null && (
        <>
          <span aria-hidden="true">›</span>
          <span className="sr-only">, </span>
          {templateSubcategoryDisplayName}
        </>
      )}
    </span>
  )
}

// Featured, New and Contains Scripts, the marks a template's row and page carry in the app too.
export function PapelizSiteTemplateStatusBadges({
  papelizSiteTemplateRow,
  templateGallerySnapshotBuiltAt,
}: {
  papelizSiteTemplateRow: PapelizSiteTemplatesSnapshotRow
  templateGallerySnapshotBuiltAt: number | null
}) {
  return (
    <>
      {papelizSiteTemplateRow.isTemplateFeatured && (
        <span className={`${papelizSiteTemplateBadgeClassName} bg-papeliz-surface-gray text-papeliz-ink`}>
          <Star className="size-3 fill-current" aria-hidden="true" />
          Featured
        </span>
      )}
      {isPapelizSiteTemplateNew(papelizSiteTemplateRow, templateGallerySnapshotBuiltAt) && (
        <span className={`${papelizSiteTemplateBadgeClassName} bg-papeliz-diff-added text-papeliz-diff-added-ink`}>New</span>
      )}
      {papelizSiteTemplateRow.isTemplateRunningCommands && (
        <span className={`${papelizSiteTemplateBadgeClassName} bg-papeliz-diff-removed text-papeliz-diff-removed-ink`}>
          <Terminal className="size-3" aria-hidden="true" />
          Contains Scripts
        </span>
      )}
    </>
  )
}

export function PapelizSiteTemplateLicenseBadge({ papelizSiteTemplateRow }: { papelizSiteTemplateRow: PapelizSiteTemplatesSnapshotRow }) {
  return (
    <span className={`${papelizSiteTemplateBadgeClassName} border border-papeliz-line text-papeliz-ink-muted`}>
      {describePapelizSiteTemplateLicenseName(papelizSiteTemplateRow.templateLicenseId)}
    </span>
  )
}

// The tile in place of a picture: the name's first letter, as the app shows a template with none.
// The website shows no README picture, so a visit asks no other site for one.
export function PapelizSiteTemplateLetterTile({ papelizSiteTemplateRow, papelizSiteTemplateLetterTileSize }: {
  papelizSiteTemplateRow: PapelizSiteTemplatesSnapshotRow
  papelizSiteTemplateLetterTileSize: 'row' | 'page'
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-2xl bg-papeliz-blue-soft font-semibold text-papeliz-blue ${
        papelizSiteTemplateLetterTileSize === 'page' ? 'size-20 text-4xl' : 'size-14 text-2xl'
      }`}
    >
      {Array.from(papelizSiteTemplateRow.templateName.trim())[0]?.toUpperCase() ?? ''}
    </span>
  )
}
