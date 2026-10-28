'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Search } from 'lucide-react'
import { searchPapelizHelpArticles, type PapelizHelpSearchResult } from '@/lib/papeliz-help-search'

function describeHelpSearchResultHref(papelizHelpSearchResult: PapelizHelpSearchResult): string {
  const articleHref = `/${papelizHelpSearchResult.papelizHelpArticleSlug}/`
  return papelizHelpSearchResult.matchedSectionAnchor ? `${articleHref}#${papelizHelpSearchResult.matchedSectionAnchor}` : articleHref
}

function isTypingInAField(keyboardEventTarget: EventTarget | null): boolean {
  if (!(keyboardEventTarget instanceof HTMLElement)) return false
  return keyboardEventTarget.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(keyboardEventTarget.tagName)
}

// The guide search in the header: `/` focuses it, arrows move through the results, Enter opens
// one and Esc closes the list.
export function PapelizHelpSearch({ onHelpSearchResultOpen }: { onHelpSearchResultOpen?: () => void }) {
  const router = useRouter()
  const helpSearchListId = useId()
  const helpSearchInputRef = useRef<HTMLInputElement>(null)
  const helpSearchBoxRef = useRef<HTMLDivElement>(null)
  const [helpSearchQueryText, setHelpSearchQueryText] = useState('')
  const [isHelpSearchListOpen, setHelpSearchListOpen] = useState(false)
  const [highlightedHelpSearchResultIndex, setHighlightedHelpSearchResultIndex] = useState(0)

  const papelizHelpSearchResults = useMemo(() => searchPapelizHelpArticles(helpSearchQueryText), [helpSearchQueryText])
  const isHelpSearchListShown = isHelpSearchListOpen && helpSearchQueryText.trim().length > 0

  useEffect(() => {
    const focusSearchOnSlash = (keyboardEvent: globalThis.KeyboardEvent) => {
      if (keyboardEvent.key !== '/' || keyboardEvent.ctrlKey || keyboardEvent.metaKey || keyboardEvent.altKey) return
      if (isTypingInAField(keyboardEvent.target)) return
      keyboardEvent.preventDefault()
      helpSearchInputRef.current?.focus()
    }
    const closeOnOutsidePointer = (pointerEvent: PointerEvent) => {
      if (helpSearchBoxRef.current && pointerEvent.target instanceof Node && !helpSearchBoxRef.current.contains(pointerEvent.target)) {
        setHelpSearchListOpen(false)
      }
    }
    window.addEventListener('keydown', focusSearchOnSlash)
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => {
      window.removeEventListener('keydown', focusSearchOnSlash)
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
    }
  }, [])

  const openHelpSearchResult = (papelizHelpSearchResult: PapelizHelpSearchResult) => {
    router.push(describeHelpSearchResultHref(papelizHelpSearchResult))
    setHelpSearchQueryText('')
    setHelpSearchListOpen(false)
    helpSearchInputRef.current?.blur()
    onHelpSearchResultOpen?.()
  }

  const handleHelpSearchKeyDown = (keyboardEvent: KeyboardEvent<HTMLInputElement>) => {
    if (keyboardEvent.key === 'Escape') {
      if (isHelpSearchListShown) setHelpSearchListOpen(false)
      else helpSearchInputRef.current?.blur()
      return
    }
    if (!isHelpSearchListShown || papelizHelpSearchResults.length === 0) return
    if (keyboardEvent.key === 'ArrowDown') {
      keyboardEvent.preventDefault()
      setHighlightedHelpSearchResultIndex((currentIndex) => (currentIndex + 1) % papelizHelpSearchResults.length)
    } else if (keyboardEvent.key === 'ArrowUp') {
      keyboardEvent.preventDefault()
      setHighlightedHelpSearchResultIndex((currentIndex) => (currentIndex - 1 + papelizHelpSearchResults.length) % papelizHelpSearchResults.length)
    } else if (keyboardEvent.key === 'Enter') {
      keyboardEvent.preventDefault()
      openHelpSearchResult(papelizHelpSearchResults[highlightedHelpSearchResultIndex] ?? papelizHelpSearchResults[0])
    }
  }

  const highlightedHelpSearchResultId =
    isHelpSearchListShown && papelizHelpSearchResults.length > 0 ? `${helpSearchListId}-${highlightedHelpSearchResultIndex}` : undefined

  return (
    <div ref={helpSearchBoxRef} className="relative w-full">
      {/* A translucent white track on the blue top bar, like the app's view switch. */}
      <label className="flex h-10 items-center gap-2 rounded-full bg-white/15 px-3.5 shadow-[inset_0_1px_2px_rgb(0_0_0/0.12)] transition-colors focus-within:bg-white/20 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white hover:bg-white/20">
        <Search className="size-4 flex-none text-white/80" aria-hidden="true" />
        <span className="sr-only">Search the guides</span>
        <input
          ref={helpSearchInputRef}
          type="search"
          role="combobox"
          aria-expanded={isHelpSearchListShown}
          aria-controls={helpSearchListId}
          aria-autocomplete="list"
          aria-activedescendant={highlightedHelpSearchResultId}
          value={helpSearchQueryText}
          placeholder="Search the guides"
          autoComplete="off"
          spellCheck={false}
          onChange={(changeEvent) => {
            setHelpSearchQueryText(changeEvent.target.value)
            setHighlightedHelpSearchResultIndex(0)
            setHelpSearchListOpen(true)
          }}
          onFocus={() => setHelpSearchListOpen(true)}
          onKeyDown={handleHelpSearchKeyDown}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/70 [&::-webkit-search-cancel-button]:hidden"
        />
        <kbd className="hidden rounded-md border border-white/30 px-1.5 font-mono text-[12px] leading-5 text-white/80 sm:inline">/</kbd>
      </label>

      {isHelpSearchListShown && (
        <div className="papeliz-help-selection-on-surface papeliz-pop-enter absolute inset-x-0 top-12 z-50 overflow-hidden rounded-2xl border border-papeliz-line bg-papeliz-surface text-papeliz-ink shadow-papeliz-pop">
          {papelizHelpSearchResults.length === 0 ? (
            <p className="px-4 py-3 text-[14px] text-papeliz-ink-muted">No guide matches “{helpSearchQueryText.trim()}”.</p>
          ) : (
            <ul id={helpSearchListId} role="listbox" aria-label="Matching guides" className="max-h-[60vh] overflow-y-auto py-1.5">
              {papelizHelpSearchResults.map((papelizHelpSearchResult, resultIndex) => (
                <li
                  key={papelizHelpSearchResult.papelizHelpArticleSlug}
                  id={`${helpSearchListId}-${resultIndex}`}
                  role="option"
                  aria-selected={resultIndex === highlightedHelpSearchResultIndex}
                  onPointerEnter={() => setHighlightedHelpSearchResultIndex(resultIndex)}
                  onClick={() => openHelpSearchResult(papelizHelpSearchResult)}
                  className={`mx-1.5 cursor-pointer rounded-xl px-3 py-2 ${resultIndex === highlightedHelpSearchResultIndex ? 'bg-papeliz-blue-soft' : ''}`}
                >
                  <span className="block text-[12px] text-papeliz-ink-subtle">
                    {papelizHelpSearchResult.groupTitle}
                    {papelizHelpSearchResult.matchedSectionHeading && ` · ${papelizHelpSearchResult.matchedSectionHeading}`}
                  </span>
                  <span className="block font-medium text-papeliz-ink">{papelizHelpSearchResult.articleTitle}</span>
                  <span className="block truncate text-[13px] text-papeliz-ink-muted">{papelizHelpSearchResult.articleSummary}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
