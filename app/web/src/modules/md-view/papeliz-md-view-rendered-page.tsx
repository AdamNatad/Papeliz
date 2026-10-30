import type { Element as HastElement, Root as HastRoot } from 'hast'
import { toJsxRuntime, type Components } from 'hast-util-to-jsx-runtime'
import {
  BookOpen,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Flame,
  Info,
  Lightbulb,
  List,
  ListChecks,
  OctagonAlert,
  Quote,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, type ComponentProps, type MouseEvent, type ReactNode } from 'react'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import type { PapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { PapelizNoteFrontmatterPropertyChips } from './papeliz-note-frontmatter-property-chips'
import { readPapelizNoteFrontmatterProperties } from './papeliz-note-frontmatter-properties'
import { mountPapelizMermaidDiagram, unmountPapelizMermaidDiagram } from './papeliz-md-view-mermaid-diagrams'
import { renderPapelizMdViewNote } from './papeliz-md-view-render-pipeline'
import { papelizMdViewCalloutTitleClassName } from './papeliz-remark-callouts'

interface PapelizMdViewRenderedPageProps {
  vaultNoteText: string
  vaultNoteRelativePath: string
  resolveWikilinkTarget: PapelizWikilinkTargetResolver
  onWikilinkActivate: (wikilinkTargetNoteName: string) => void
  onRelativeNoteLinkActivate: (linkHref: string) => void
}

const papelizCalloutIconsByKind: Record<string, LucideIcon> = {
  note: Info,
  info: Info,
  abstract: BookOpen,
  summary: BookOpen,
  tip: Lightbulb,
  hint: Lightbulb,
  important: CircleAlert,
  success: CircleCheck,
  check: CircleCheck,
  done: CircleCheck,
  todo: ListChecks,
  question: CircleHelp,
  help: CircleHelp,
  faq: CircleHelp,
  warning: TriangleAlert,
  caution: TriangleAlert,
  attention: TriangleAlert,
  danger: OctagonAlert,
  error: OctagonAlert,
  failure: OctagonAlert,
  bug: Flame,
  example: List,
  quote: Quote,
  cite: Quote,
}

function getHastStringProperty(hastElement: HastElement | undefined, hastPropertyName: string): string | null {
  const hastPropertyValue = hastElement?.properties?.[hastPropertyName]
  return typeof hastPropertyValue === 'string' ? hastPropertyValue : null
}

function isExternalLinkHref(linkHref: string): boolean {
  return /^(https?:|mailto:)/i.test(linkHref)
}

function collectHastElementText(hastElement: HastElement): string {
  return hastElement.children.map((hastChild) => (hastChild.type === 'text' ? hastChild.value : hastChild.type === 'element' ? collectHastElementText(hastChild) : '')).join('')
}

// The source of a ```mermaid block (`<pre><code class="language-mermaid">`), or null for other code.
function readMermaidDiagramSource(hastPreElement: HastElement | undefined): string | null {
  const hastCodeElement = hastPreElement?.children.find((hastChild): hastChild is HastElement => hastChild.type === 'element' && hastChild.tagName === 'code')
  const codeClassNames = hastCodeElement?.properties['className']
  if (hastCodeElement === undefined || !Array.isArray(codeClassNames) || !codeClassNames.includes('language-mermaid')) return null
  return collectHastElementText(hastCodeElement).replace(/\n$/, '')
}

function PapelizMdViewMermaidDiagram({ mermaidDiagramSource }: { mermaidDiagramSource: string }) {
  const mermaidDiagramElementRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const mermaidDiagramElement = mermaidDiagramElementRef.current
    if (mermaidDiagramElement === null) return
    mountPapelizMermaidDiagram(mermaidDiagramElement, mermaidDiagramSource)
    return () => unmountPapelizMermaidDiagram(mermaidDiagramElement)
  }, [mermaidDiagramSource])
  return <div ref={mermaidDiagramElementRef} className="papeliz-mermaid-diagram" />
}

// Turns the sanitized tree into React elements. Wikilinks and links to other `.md` files open
// inside Papeliz; web links open in a new tab. Also used for the assistant's answers, which keep
// ```mermaid blocks as code (`drawsMermaidDiagrams` off): an answer still arriving is often not yet
// a whole diagram.
export function renderPapelizMdViewHastToReact(
  noteHastRoot: HastRoot,
  onWikilinkActivate: (wikilinkTargetNoteName: string) => void,
  onRelativeNoteLinkActivate: (linkHref: string) => void,
  drawsMermaidDiagrams = false,
): ReactNode {
  const papelizMdViewRenderedPageComponents: Components = {
    pre: ({ node: hastPreElement, children, ...preProps }: ComponentProps<'pre'> & { node?: HastElement }) => {
      const mermaidDiagramSource = drawsMermaidDiagrams ? readMermaidDiagramSource(hastPreElement) : null
      if (mermaidDiagramSource !== null) return <PapelizMdViewMermaidDiagram mermaidDiagramSource={mermaidDiagramSource} />
      return <pre {...preProps}>{children}</pre>
    },
    a: ({ node: hastAnchorElement, href, children, ...anchorProps }: ComponentProps<'a'> & { node?: HastElement }) => {
      const wikilinkTargetNoteName = getHastStringProperty(hastAnchorElement, 'dataPapelizWikilinkTarget')
      if (wikilinkTargetNoteName !== null) {
        return (
          <a
            {...anchorProps}
            href="#"
            title={anchorProps.className?.includes('unresolved') ? `Create “${wikilinkTargetNoteName}”` : undefined}
            onClick={(clickEvent: MouseEvent<HTMLAnchorElement>) => {
              clickEvent.preventDefault()
              onWikilinkActivate(wikilinkTargetNoteName)
            }}
          >
            {children}
          </a>
        )
      }
      if (href !== undefined && !isExternalLinkHref(href) && !href.startsWith('#')) {
        return (
          <a
            {...anchorProps}
            href="#"
            onClick={(clickEvent: MouseEvent<HTMLAnchorElement>) => {
              clickEvent.preventDefault()
              onRelativeNoteLinkActivate(href)
            }}
          >
            {children}
          </a>
        )
      }
      return (
        <a {...anchorProps} href={href} target={href?.startsWith('#') ? undefined : '_blank'} rel="noopener noreferrer">
          {children}
        </a>
      )
    },
    div: ({ node: hastDivElement, children, ...divProps }: ComponentProps<'div'> & { node?: HastElement }) => {
      if (divProps.className?.includes(papelizMdViewCalloutTitleClassName)) {
        const papelizCalloutKind = getHastStringProperty(hastDivElement, 'dataPapelizCalloutKind') ?? 'note'
        const PapelizCalloutIcon = papelizCalloutIconsByKind[papelizCalloutKind] ?? Info
        return (
          <div {...divProps}>
            <PapelizCalloutIcon className="size-4 flex-none" aria-hidden="true" />
            <span>{children}</span>
          </div>
        )
      }
      return <div {...divProps}>{children}</div>
    },
    img: ({ node: _hastImageElement, src, alt }: ComponentProps<'img'> & { node?: HastElement }) => {
      if (typeof src === 'string' && /^https:/i.test(src)) {
        return <img src={src} alt={alt ?? ''} loading="lazy" referrerPolicy="no-referrer" />
      }
      // Images stored in the vault arrive with attachments in a later version.
      return <span className="papeliz-md-view-image-placeholder">Image: {alt || src || 'untitled'}</span>
    },
  }
  return toJsxRuntime(noteHastRoot, {
    Fragment,
    jsx,
    jsxs,
    components: papelizMdViewRenderedPageComponents,
    passNode: true,
    ignoreInvalidStyle: true,
  })
}

// The rendered, sanitized note: MD View with the lock on.
export function PapelizMdViewRenderedPage({
  vaultNoteText,
  vaultNoteRelativePath,
  resolveWikilinkTarget,
  onWikilinkActivate,
  onRelativeNoteLinkActivate,
}: PapelizMdViewRenderedPageProps) {
  const renderedNote = useMemo(
    () => renderPapelizMdViewNote(vaultNoteText, { resolveWikilinkTarget, fromVaultNoteRelativePath: vaultNoteRelativePath }),
    [vaultNoteText, vaultNoteRelativePath, resolveWikilinkTarget],
  )
  const noteFrontmatterProperties = useMemo(
    () => (renderedNote.noteFrontmatterText === null ? [] : readPapelizNoteFrontmatterProperties(renderedNote.noteFrontmatterText)),
    [renderedNote.noteFrontmatterText],
  )

  const renderedNoteBody = useMemo(
    () => renderPapelizMdViewHastToReact(renderedNote.noteHastRoot, onWikilinkActivate, onRelativeNoteLinkActivate, true),
    [renderedNote.noteHastRoot, onWikilinkActivate, onRelativeNoteLinkActivate],
  )

  return (
    <article className="papeliz-md-view-article" aria-label="MD View">
      {noteFrontmatterProperties.length > 0 && <PapelizNoteFrontmatterPropertyChips noteFrontmatterProperties={noteFrontmatterProperties} />}
      {renderedNoteBody}
      {vaultNoteText.trim().length === 0 && <p className="papeliz-md-view-empty-note">This note is empty. Unlock editing to write in it.</p>}
    </article>
  )
}
