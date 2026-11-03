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
import { requestPapelizFileExplorerSearch } from '../workspace/papeliz-file-explorer-search-request-store'
import { PapelizNoteFrontmatterPropertyChips } from './papeliz-note-frontmatter-property-chips'
import { readPapelizNoteFrontmatterProperties } from './papeliz-note-frontmatter-properties'
import { PapelizMdViewMedia } from './papeliz-md-view-media'
import {
  readPapelizMdViewMediaSource,
  readPapelizMdViewVaultMediaSource,
  readPapelizMdViewWikilinkEmbedLabel,
  readPapelizYouTubeVideoId,
} from './papeliz-md-view-media-sources'
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

// A picture's `width` or `height` in whole pixels, or null when it has none.
function readPictureSizePixels(pictureSizeValue: string | number | undefined): number | null {
  const pictureSizePixels = Number(pictureSizeValue)
  return pictureSizeValue !== undefined && Number.isInteger(pictureSizePixels) && pictureSizePixels > 0 ? pictureSizePixels : null
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

// On the locked page a tag is a button: a click, or Enter, searches the vault for it.
function searchPapelizMdViewRenderedPageTag(papelizTagName: string): void {
  requestPapelizFileExplorerSearch(`#${papelizTagName}`)
}

// A note of the vault shows its own pictures and videos (papeliz-md-view-media.tsx): its vault files,
// `![[picture.png]]` embeds, web videos, and YouTube links as posters. Elsewhere (an assistant
// answer, a template's page) pictures keep their own rules: only web pictures show.
export interface PapelizMdViewMediaRenderOptions {
  fromVaultNoteRelativePath: string | null
}

// The YouTube video a paragraph is, when it holds nothing but one link to one: a link alone on its
// line, as `[title](https://youtu.be/…)` or the bare address.
function readLoneYouTubeLink(hastParagraphElement: HastElement | undefined): { youTubeVideoId: string; youTubeLinkText: string } | null {
  const hastParagraphChildren = (hastParagraphElement?.children ?? []).filter((hastChild) => !(hastChild.type === 'text' && hastChild.value.trim().length === 0))
  const hastLinkElement = hastParagraphChildren[0]
  if (hastParagraphChildren.length !== 1 || hastLinkElement?.type !== 'element' || hastLinkElement.tagName !== 'a') return null
  const linkHref = getHastStringProperty(hastLinkElement, 'href')
  const youTubeVideoId = linkHref === null ? null : readPapelizYouTubeVideoId(linkHref)
  if (youTubeVideoId === null) return null
  const youTubeLinkText = collectHastElementText(hastLinkElement).trim()
  return { youTubeVideoId, youTubeLinkText: youTubeLinkText === linkHref ? '' : youTubeLinkText }
}

// Turns the sanitized tree into React elements. Wikilinks and links to other `.md` files open
// inside Papeliz; web links open in a new tab; tags search the vault when `onTagSearch` is given.
// Also used for the assistant's answers, which keep ```mermaid blocks as code
// (`drawsMermaidDiagrams` off): an answer still arriving is often not yet a whole diagram.
export function renderPapelizMdViewHastToReact(
  noteHastRoot: HastRoot,
  onWikilinkActivate: (wikilinkTargetNoteName: string) => void,
  onRelativeNoteLinkActivate: (linkHref: string) => void,
  drawsMermaidDiagrams = false,
  onTagSearch: ((papelizTagName: string) => void) | null = null,
  mdViewMediaOptions: PapelizMdViewMediaRenderOptions | null = null,
): ReactNode {
  const papelizMdViewRenderedPageComponents: Components = {
    pre: ({ node: hastPreElement, children, ...preProps }: ComponentProps<'pre'> & { node?: HastElement }) => {
      const mermaidDiagramSource = drawsMermaidDiagrams ? readMermaidDiagramSource(hastPreElement) : null
      if (mermaidDiagramSource !== null) return <PapelizMdViewMermaidDiagram mermaidDiagramSource={mermaidDiagramSource} />
      return <pre {...preProps}>{children}</pre>
    },
    p: ({ node: hastParagraphElement, children, ...paragraphProps }: ComponentProps<'p'> & { node?: HastElement }) => {
      const loneYouTubeLink = mdViewMediaOptions === null ? null : readLoneYouTubeLink(hastParagraphElement)
      if (loneYouTubeLink !== null) {
        return (
          <p {...paragraphProps}>
            <PapelizMdViewMedia
              mdViewMediaSource={{ mediaSourceKind: 'youtube-video', youTubeVideoId: loneYouTubeLink.youTubeVideoId }}
              mediaAlternativeText={loneYouTubeLink.youTubeLinkText}
              mediaTitle={null}
              mediaWidthPixels={null}
              mediaHeightPixels={null}
              fromVaultNoteRelativePath={null}
            />
          </p>
        )
      }
      return <p {...paragraphProps}>{children}</p>
    },
    a: ({ node: hastAnchorElement, href, children, ...anchorProps }: ComponentProps<'a'> & { node?: HastElement }) => {
      const wikilinkTargetNoteName = getHastStringProperty(hastAnchorElement, 'dataPapelizWikilinkTarget')
      // `![[picture.png]]` and `![[clip.mp4]]` show the vault file itself.
      if (wikilinkTargetNoteName !== null && mdViewMediaOptions !== null && getHastStringProperty(hastAnchorElement, 'dataPapelizWikilinkEmbed') === 'true') {
        const embeddedMediaSource = readPapelizMdViewVaultMediaSource(wikilinkTargetNoteName)
        if (embeddedMediaSource.mediaSourceKind !== 'not-shown') {
          const wikilinkEmbedLabel = readPapelizMdViewWikilinkEmbedLabel(hastAnchorElement === undefined ? null : collectHastElementText(hastAnchorElement))
          return (
            <PapelizMdViewMedia
              mdViewMediaSource={embeddedMediaSource}
              mediaAlternativeText={wikilinkEmbedLabel.mediaAlternativeText ?? wikilinkTargetNoteName}
              mediaTitle={null}
              mediaWidthPixels={wikilinkEmbedLabel.mediaWidthPixels}
              mediaHeightPixels={wikilinkEmbedLabel.mediaHeightPixels}
              fromVaultNoteRelativePath={mdViewMediaOptions.fromVaultNoteRelativePath}
            />
          )
        }
      }
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
    span: ({ node: hastSpanElement, children, ...spanProps }: ComponentProps<'span'> & { node?: HastElement }) => {
      const papelizTagName = getHastStringProperty(hastSpanElement, 'dataPapelizTagName')
      if (papelizTagName !== null && onTagSearch !== null) {
        return (
          <button
            type="button"
            className={spanProps.className}
            data-papeliz-tag-name={papelizTagName}
            title={`Search notes for #${papelizTagName}`}
            onClick={() => onTagSearch(papelizTagName)}
          >
            {children}
          </button>
        )
      }
      return <span {...spanProps}>{children}</span>
    },
    img: ({ node: _hastImageElement, src, alt, title, width, height }: ComponentProps<'img'> & { node?: HastElement }) => {
      // `![description|300](…)`'s width, put on the picture by remarkPapelizPictureWidths.
      const pictureWidthPixels = readPictureSizePixels(width)
      const pictureHeightPixels = readPictureSizePixels(height)
      if (mdViewMediaOptions !== null) {
        return (
          <PapelizMdViewMedia
            mdViewMediaSource={readPapelizMdViewMediaSource(typeof src === 'string' ? src : '')}
            mediaAlternativeText={alt ?? ''}
            mediaTitle={title ?? null}
            mediaWidthPixels={pictureWidthPixels}
            mediaHeightPixels={pictureHeightPixels}
            fromVaultNoteRelativePath={mdViewMediaOptions.fromVaultNoteRelativePath}
          />
        )
      }
      if (typeof src === 'string' && /^https:/i.test(src)) {
        return <img src={src} alt={alt ?? ''} width={pictureWidthPixels ?? undefined} height={pictureHeightPixels ?? undefined} loading="lazy" referrerPolicy="no-referrer" />
      }
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
    () =>
      renderPapelizMdViewHastToReact(renderedNote.noteHastRoot, onWikilinkActivate, onRelativeNoteLinkActivate, true, searchPapelizMdViewRenderedPageTag, {
        fromVaultNoteRelativePath: vaultNoteRelativePath,
      }),
    [renderedNote.noteHastRoot, onWikilinkActivate, onRelativeNoteLinkActivate, vaultNoteRelativePath],
  )

  return (
    <article className="papeliz-md-view-article" aria-label="MD View">
      {noteFrontmatterProperties.length > 0 && <PapelizNoteFrontmatterPropertyChips noteFrontmatterProperties={noteFrontmatterProperties} />}
      {renderedNoteBody}
      {vaultNoteText.trim().length === 0 && <p className="papeliz-md-view-empty-note">This note is empty. Unlock editing to write in it.</p>}
    </article>
  )
}
