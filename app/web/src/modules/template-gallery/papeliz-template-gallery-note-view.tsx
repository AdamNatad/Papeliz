import type { Element as HastElement, Root as HastRoot, RootContent as HastRootContent } from 'hast'
import { useMemo } from 'react'
import type { PapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { renderPapelizMdViewNote } from '../md-view/papeliz-md-view-render-pipeline'
import { renderPapelizMdViewHastToReact } from '../md-view/papeliz-md-view-rendered-page'
import { PapelizNoteFrontmatterPropertyChips } from '../md-view/papeliz-note-frontmatter-property-chips'
import { readPapelizNoteFrontmatterProperties } from '../md-view/papeliz-note-frontmatter-properties'
import type { PapelizTemplateGalleryRow } from './papeliz-template-gallery-contract'
import { resolvePapelizTemplateNotePictureUrl } from './papeliz-template-gallery-picture-hosts'

// A template's note on its page and in Preview: MD View's own rendering, read-only, except that its
// pictures come only from where a template's may (papeliz-template-gallery-picture-hosts.ts): a
// picture in the repository shows from jsDelivr at the commit, one on GitHub's picture hosts as it
// is, and any other shows as its name. Diagrams show as their code, since a diagram can name a
// picture to load from anywhere. Tags are plain text: there's no vault to search yet.

// Takes every picture address in the rendered note to an allowed one, or away: an <img>'s `src`, and
// a <picture>'s other sources (`srcset`), which would load from anywhere.
function keepOnlyTemplatePictures(noteHastRoot: HastRoot, resolveNotePictureAddress: (notePictureAddress: string) => string | null): HastRoot {
  const pendingHastNodes: Array<HastRoot | HastRootContent> = [noteHastRoot]
  while (pendingHastNodes.length > 0) {
    const hastNode = pendingHastNodes.pop()
    if (hastNode === undefined || !('children' in hastNode)) continue
    if (hastNode.type === 'element') keepOnlyTemplateElementPicture(hastNode, resolveNotePictureAddress)
    for (const childHastNode of hastNode.children) pendingHastNodes.push(childHastNode)
  }
  return noteHastRoot
}

function keepOnlyTemplateElementPicture(hastElement: HastElement, resolveNotePictureAddress: (notePictureAddress: string) => string | null): void {
  const elementProperties = hastElement.properties
  const notePictureAddress = elementProperties['src']
  delete elementProperties['srcSet']
  delete elementProperties['poster']
  if (hastElement.tagName !== 'img') {
    delete elementProperties['src']
    return
  }
  const allowedPictureUrl = typeof notePictureAddress === 'string' ? resolveNotePictureAddress(notePictureAddress) : null
  if (allowedPictureUrl === null) delete elementProperties['src']
  else elementProperties['src'] = allowedPictureUrl
}

interface PapelizTemplateGalleryNoteViewProps {
  templateGalleryRow: PapelizTemplateGalleryRow
  templateNoteText: string
  templateNoteRelativePath: string
  // The files the template includes, once read; until then its own pictures show as their names.
  templateIncludedFileRelativePaths: ReadonlySet<string> | null
  // The gallery store's: a picture in the repository, from jsDelivr at the commit.
  buildTemplatePictureUrl: (templateGalleryRow: PapelizTemplateGalleryRow, templateFileRelativePath: string) => string
  resolveWikilinkTarget: PapelizWikilinkTargetResolver
  onWikilinkActivate: (wikilinkTargetNoteName: string) => void
  onRelativeNoteLinkActivate: (linkHref: string) => void
}

export function PapelizTemplateGalleryNoteView({
  templateGalleryRow,
  templateNoteText,
  templateNoteRelativePath,
  templateIncludedFileRelativePaths,
  buildTemplatePictureUrl,
  resolveWikilinkTarget,
  onWikilinkActivate,
  onRelativeNoteLinkActivate,
}: PapelizTemplateGalleryNoteViewProps) {
  const renderedTemplateNote = useMemo(() => {
    const renderedNote = renderPapelizMdViewNote(templateNoteText, { resolveWikilinkTarget, fromVaultNoteRelativePath: templateNoteRelativePath })
    return {
      noteFrontmatterText: renderedNote.noteFrontmatterText,
      noteHastRoot: keepOnlyTemplatePictures(renderedNote.noteHastRoot, (notePictureAddress) =>
        resolvePapelizTemplateNotePictureUrl(
          templateGalleryRow,
          templateNoteRelativePath,
          notePictureAddress,
          (templateFileRelativePath) => templateIncludedFileRelativePaths?.has(templateFileRelativePath) === true,
          (pictureRelativePath) => buildTemplatePictureUrl(templateGalleryRow, pictureRelativePath),
        ),
      ),
    }
  }, [templateNoteText, templateNoteRelativePath, resolveWikilinkTarget, templateGalleryRow, templateIncludedFileRelativePaths, buildTemplatePictureUrl])
  const noteFrontmatterProperties = useMemo(
    () => (renderedTemplateNote.noteFrontmatterText === null ? [] : readPapelizNoteFrontmatterProperties(renderedTemplateNote.noteFrontmatterText)),
    [renderedTemplateNote.noteFrontmatterText],
  )
  const renderedTemplateNoteBody = useMemo(
    () => renderPapelizMdViewHastToReact(renderedTemplateNote.noteHastRoot, onWikilinkActivate, onRelativeNoteLinkActivate),
    [renderedTemplateNote.noteHastRoot, onWikilinkActivate, onRelativeNoteLinkActivate],
  )
  return (
    <article className="papeliz-md-view-article" aria-label="MD View">
      {noteFrontmatterProperties.length > 0 && <PapelizNoteFrontmatterPropertyChips noteFrontmatterProperties={noteFrontmatterProperties} />}
      {renderedTemplateNoteBody}
      {templateNoteText.trim().length === 0 && <p className="papeliz-md-view-empty-note">This note is empty.</p>}
    </article>
  )
}
