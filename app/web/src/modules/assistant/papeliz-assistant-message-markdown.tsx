import { useMemo, useState, type MouseEvent } from 'react'
import { renderPapelizMdViewNote } from '../md-view/papeliz-md-view-render-pipeline'
import { renderPapelizMdViewHastToReact } from '../md-view/papeliz-md-view-rendered-page'
import { usePapelizVaultWikilinkActivation } from '../workspace/papeliz-vault-wikilink-activation'
import {
  createPapelizAssistantWebPictureRevealKey,
  papelizAssistantWebPictureShowButtonAttributeName,
  placePapelizAssistantWebPicturePlaceholders,
} from './papeliz-assistant-answer-web-pictures'

interface PapelizAssistantMessageMarkdownProps {
  assistantMessageText: string
}

// An assistant answer, rendered with the same sanitizer as MD View, so its [[links]] open notes and
// nothing in it can run script. Its web pictures wait behind Show (papeliz-assistant-answer-web-pictures.ts).
export function PapelizAssistantMessageMarkdown({ assistantMessageText }: PapelizAssistantMessageMarkdownProps) {
  const { resolveWikilinkTarget, activateWikilink, activateRelativeNoteLink } = usePapelizVaultWikilinkActivation()
  const [revealedWebPictureKeys, setRevealedWebPictureKeys] = useState<ReadonlySet<string>>(() => new Set())
  const answerHastRoot = useMemo(
    () => renderPapelizMdViewNote(assistantMessageText, { resolveWikilinkTarget, fromVaultNoteRelativePath: null }).noteHastRoot,
    [assistantMessageText, resolveWikilinkTarget],
  )
  const answerWithWebPicturePlaceholders = useMemo(
    () => placePapelizAssistantWebPicturePlaceholders(answerHastRoot, revealedWebPictureKeys),
    [answerHastRoot, revealedWebPictureKeys],
  )
  const renderedAssistantMessage = useMemo(
    () => renderPapelizMdViewHastToReact(answerWithWebPicturePlaceholders.answerHastRoot, activateWikilink, activateRelativeNoteLink),
    [answerWithWebPicturePlaceholders, activateWikilink, activateRelativeNoteLink],
  )

  // The Show buttons are part of the rendered tree, so one listener here reveals the picture pressed.
  function revealWebPictureOnShow(clickEvent: MouseEvent<HTMLDivElement>): void {
    if (!(clickEvent.target instanceof Element)) return
    const webPictureShowButton = clickEvent.target.closest(`button[${papelizAssistantWebPictureShowButtonAttributeName}]`)
    if (webPictureShowButton === null || !clickEvent.currentTarget.contains(webPictureShowButton)) return
    // A picture inside a link: Show doesn't also follow the link.
    clickEvent.preventDefault()
    const webPictureIndex = Number(webPictureShowButton.getAttribute(papelizAssistantWebPictureShowButtonAttributeName))
    const webPictureSource = answerWithWebPicturePlaceholders.webPictureSources[webPictureIndex]
    if (webPictureSource === undefined) return
    setRevealedWebPictureKeys((previousRevealedWebPictureKeys) =>
      new Set(previousRevealedWebPictureKeys).add(createPapelizAssistantWebPictureRevealKey(webPictureIndex, webPictureSource)),
    )
  }

  return (
    <div className="papeliz-md-view-article papeliz-assistant-message-markdown" onClick={revealWebPictureOnShow}>
      {renderedAssistantMessage}
    </div>
  )
}
