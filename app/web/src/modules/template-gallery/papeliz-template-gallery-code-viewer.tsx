import { Code, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { PapelizIconButton } from '../ui/papeliz-buttons'
import { givePapelizFocusBackWithTitleHeldBack } from '../ui/papeliz-focus-back-with-title-held-back'
import { describePapelizTemplateHiddenCharacter, splitPapelizTemplateTextAtHiddenCharacters } from './papeliz-template-gallery-checks'

// A template's text with every hidden character shown as a small amber mark with its code ("U+202E")
// in its place, so nothing in it is invisible or turned around.
export function PapelizTemplateGalleryMarkedText({ templateText }: { templateText: string }) {
  return (
    <>
      {splitPapelizTemplateTextAtHiddenCharacters(templateText).map((templateTextPiece, templateTextPieceIndex) =>
        templateTextPiece.isTemplateTextPieceHiddenCharacter ? (
          <mark
            key={templateTextPieceIndex}
            title={`A hidden character, ${describePapelizTemplateHiddenCharacter(templateTextPiece.templateTextPieceText)}`}
            className="mx-px rounded-[3px] bg-papeliz-warning px-[3px] font-sans text-[10px] leading-none font-bold text-papeliz-warning-ink"
          >
            {describePapelizTemplateHiddenCharacter(templateTextPiece.templateTextPieceText)}
          </mark>
        ) : (
          <span key={templateTextPieceIndex}>{templateTextPiece.templateTextPieceText}</span>
        ),
      )}
    </>
  )
}

// A file's lines as the viewer numbers them: split at each line end (a Windows one included), without
// the empty line after a last line end.
export function listPapelizTemplateCodeViewerLines(templateFileText: string): string[] {
  const templateFileLines = templateFileText.split(/\r?\n/)
  if (templateFileLines.length > 1 && templateFileLines.at(-1) === '') templateFileLines.pop()
  return templateFileLines
}

// View Code: opens a file in the code viewer, from Preview's file and from each line of the scripts
// a template contains. Its name says which file.
export function PapelizTemplateGalleryViewCodeButton({ viewCodeTemplateFileRelativePath, onViewCodePress }: { viewCodeTemplateFileRelativePath: string; onViewCodePress: () => void }) {
  return (
    <button
      type="button"
      aria-label={`View Code, ${viewCodeTemplateFileRelativePath}`}
      onClick={onViewCodePress}
      className="inline-flex h-6 flex-none items-center gap-1 justify-self-start rounded-full border border-papeliz-line px-2 text-[11.5px] font-semibold whitespace-nowrap text-papeliz-ink-muted transition-colors hover:border-papeliz-blue-line hover:bg-papeliz-blue-soft hover:text-papeliz-blue pointer-coarse:h-9 pointer-coarse:px-3"
    >
      <Code className="size-3" aria-hidden="true" />
      View Code
    </button>
  )
}

interface PapelizTemplateGalleryCodeViewerProps {
  // The file's path in the template, shown as the title.
  codeViewerTemplateFileRelativePath: string
  codeViewerTemplateFileText: string
  onCodeViewerClose: () => void
}

// A template file's text, read-only, in a modal over the page: its path as the title, numbered lines
// that never wrap (a long one scrolls sideways), and hidden characters marked. The text is the one
// already read at the template's commit; the viewer reads nothing. Esc, × or a press outside closes it,
// and focus goes back to what opened it.
export function PapelizTemplateGalleryCodeViewer({ codeViewerTemplateFileRelativePath, codeViewerTemplateFileText, onCodeViewerClose }: PapelizTemplateGalleryCodeViewerProps) {
  const codeViewerDialogRef = useRef<HTMLDialogElement>(null)
  const codeViewerTitleId = useId()
  // What focus goes back to: read once, before the viewer takes focus.
  const [focusedBeforeCodeViewer] = useState(() => (document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null))
  const codeViewerLines = useMemo(() => listPapelizTemplateCodeViewerLines(codeViewerTemplateFileText), [codeViewerTemplateFileText])

  useEffect(() => {
    const codeViewerDialogElement = codeViewerDialogRef.current
    if (codeViewerDialogElement === null) return
    codeViewerDialogElement.showModal()
    return () => {
      const giveFocusBack = () => {
        codeViewerDialogElement.close()
        if (focusedBeforeCodeViewer?.isConnected && (document.activeElement === null || document.activeElement === document.body)) focusedBeforeCodeViewer.focus()
      }
      if (focusedBeforeCodeViewer?.isConnected) givePapelizFocusBackWithTitleHeldBack(focusedBeforeCodeViewer, giveFocusBack)
      else giveFocusBack()
    }
  }, [focusedBeforeCodeViewer])

  return (
    <dialog
      ref={codeViewerDialogRef}
      aria-labelledby={codeViewerTitleId}
      onCancel={(cancelEvent) => {
        cancelEvent.preventDefault()
        onCodeViewerClose()
      }}
      onKeyDown={(keyboardEvent) => {
        // Handled here, before the page's own Esc, which then stays open.
        if (keyboardEvent.key !== 'Escape' || keyboardEvent.defaultPrevented) return
        keyboardEvent.preventDefault()
        onCodeViewerClose()
      }}
      onClick={(clickEvent) => {
        if (clickEvent.target === codeViewerDialogRef.current) onCodeViewerClose()
      }}
      className="papeliz-dialog-enter m-auto h-[min(640px,calc(100dvh-32px))] w-[min(880px,calc(100vw-32px))] flex-col overflow-hidden rounded-3xl border border-papeliz-line bg-papeliz-surface p-0 text-papeliz-ink shadow-papeliz-pop backdrop:bg-papeliz-backdrop open:flex"
    >
      <div className="flex flex-none items-center gap-3 border-b border-papeliz-line py-3 pr-3 pl-[18px] sm:pl-6">
        <h2 id={codeViewerTitleId} title={codeViewerTemplateFileRelativePath} dir="ltr" className="min-w-0 flex-1 truncate font-mono text-[13.5px] font-semibold">
          <PapelizTemplateGalleryMarkedText templateText={codeViewerTemplateFileRelativePath} />
        </h2>
        <span className="flex-none text-[12px] text-papeliz-ink-subtle">Read-only</span>
        <PapelizIconButton iconButtonLabel="Close" iconButtonSize="small" onClick={onCodeViewerClose}>
          <X className="size-4" aria-hidden="true" />
        </PapelizIconButton>
      </div>
      {/* Focusable, so the keys scroll it. The numbers stay at the left while a long line scrolls. */}
      <div role="region" aria-label={`${codeViewerTemplateFileRelativePath}, read-only`} tabIndex={0} className="min-h-0 flex-1 overflow-auto focus-visible:outline-none">
        <div dir="ltr" className="flex min-w-max py-3 font-mono text-[12.5px] leading-[1.65]">
          <pre aria-hidden="true" className="sticky left-0 flex-none bg-papeliz-surface pr-3 pl-[18px] text-right text-papeliz-ink-subtle tabular-nums select-none sm:pl-6">
            {codeViewerLines.map((_codeViewerLine, codeViewerLineIndex) => codeViewerLineIndex + 1).join('\n')}
          </pre>
          <pre className="papeliz-selectable-text flex-none pr-6 pl-2 whitespace-pre [unicode-bidi:isolate]">
            <code>
              <PapelizTemplateGalleryMarkedText templateText={codeViewerLines.join('\n')} />
            </code>
          </pre>
        </div>
      </div>
    </dialog>
  )
}
