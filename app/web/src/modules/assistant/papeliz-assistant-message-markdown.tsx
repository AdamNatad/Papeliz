import { useMemo } from 'react'
import { renderPapelizMdViewNote } from '../md-view/papeliz-md-view-render-pipeline'
import { renderPapelizMdViewHastToReact } from '../md-view/papeliz-md-view-rendered-page'
import { usePapelizVaultWikilinkActivation } from '../workspace/papeliz-vault-wikilink-activation'

interface PapelizAssistantMessageMarkdownProps {
  assistantMessageText: string
}

// An assistant answer, rendered with the same sanitizer as MD View, so its [[links]] open notes and
// nothing in it can run script.
export function PapelizAssistantMessageMarkdown({ assistantMessageText }: PapelizAssistantMessageMarkdownProps) {
  const { resolveWikilinkTarget, activateWikilink, activateRelativeNoteLink } = usePapelizVaultWikilinkActivation()
  const renderedAssistantMessage = useMemo(
    () =>
      renderPapelizMdViewHastToReact(
        renderPapelizMdViewNote(assistantMessageText, { resolveWikilinkTarget, fromVaultNoteRelativePath: null }).noteHastRoot,
        activateWikilink,
        activateRelativeNoteLink,
      ),
    [assistantMessageText, resolveWikilinkTarget, activateWikilink, activateRelativeNoteLink],
  )
  return <div className="papeliz-md-view-article papeliz-assistant-message-markdown">{renderedAssistantMessage}</div>
}
