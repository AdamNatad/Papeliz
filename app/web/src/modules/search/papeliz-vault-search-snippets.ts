// Words and snippets for vault search. Words are split on spaces, punctuation and symbols such as
// ` + = | < > ~ ^, so a word written in code (`mermaid`, Ctrl+E) is found like any other word.
// Snippets are the note's text as it reads, without front matter or Markdown marks, starting a few
// words before the match so the matched word shows in a short two-line result.

const papelizVaultSearchWordSeparatorPattern = /[\n\r\p{Z}\p{P}\p{Sm}\p{Sk}\p{Sc}]+/u
// How far before the match a snippet starts, and how long it runs.
const papelizSearchSnippetLeadCharacters = 28
const papelizSearchSnippetLengthCharacters = 170

export function splitVaultSearchTextIntoWords(vaultSearchText: string): string[] {
  return vaultSearchText.split(papelizVaultSearchWordSeparatorPattern).filter((vaultSearchWord) => vaultSearchWord.length > 0)
}

const vaultNoteFrontMatterPattern = /^\uFEFF?---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/
const vaultNoteLineMarkPatterns: readonly RegExp[] = [
  // A fence keeps its language ("```mermaid" reads "mermaid").
  /^\s*(?:`{3,}|~{3,})\s*/,
  /^\s{0,3}#{1,6}\s+/,
  /^\s*(?:>\s?)+/,
  /^\[![\w-]+\][+-]?\s*/,
  /^\s*(?:[-*+]|\d+[.)])\s+/,
  /^\[[ xX]\]\s+/,
]
const vaultNoteMarkOnlyLinePattern = /^\s*(?:\|?\s*:?-{3,}:?\s*)+\|?\s*$|^\s*([-*_])(?:\s*\1){2,}\s*$/

// "## Plan\n- [ ] Buy **seeds** for [[Garden plan|the garden]]" -> "Plan Buy seeds for the garden"
export function convertVaultNoteTextToSearchSnippetText(vaultNoteText: string): string {
  const vaultNoteLines = vaultNoteText.replace(vaultNoteFrontMatterPattern, '').split(/\r?\n/)
  const readableLines = vaultNoteLines.map((vaultNoteLine) => {
    if (vaultNoteMarkOnlyLinePattern.test(vaultNoteLine)) return ''
    return vaultNoteLineMarkPatterns.reduce((lineWithoutMarks, vaultNoteLineMarkPattern) => lineWithoutMarks.replace(vaultNoteLineMarkPattern, ''), vaultNoteLine)
  })
  return readableLines
    .join(' ')
    .replace(/!?\[\[([^\]|#]*)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (_wikilinkText, wikilinkTarget: string, wikilinkAlias: string | undefined) =>
      wikilinkAlias ?? wikilinkTarget,
    )
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<\/?[A-Za-z][^>]*>/g, '')
    .replace(/\*+|~~|==|`+/g, '')
    .replace(/(^|[^\p{L}\p{N}_])_+|_+(?=[^\p{L}\p{N}_]|$)/gu, '$1')
    .replace(/\s*\|\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeForRegularExpression(literalText: string): string {
  return literalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// The matched words as whole words, ignoring case.
function createMatchedWordsPattern(matchedVaultSearchWords: readonly string[]): RegExp | null {
  const searchableMatchedWords = matchedVaultSearchWords.filter((matchedVaultSearchWord) => matchedVaultSearchWord.length > 0)
  if (searchableMatchedWords.length === 0) return null
  const matchedWordAlternatives = [...searchableMatchedWords].sort((firstWord, secondWord) => secondWord.length - firstWord.length).map(escapeForRegularExpression)
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${matchedWordAlternatives.join('|')})(?![\\p{L}\\p{N}])`, 'giu')
}

// A passage of `searchSnippetText` that starts a few words before the first matched word.
export function buildVaultSearchSnippet(searchSnippetText: string, matchedVaultSearchWords: readonly string[]): string {
  const firstMatchIndex = createMatchedWordsPattern(matchedVaultSearchWords)?.exec(searchSnippetText)?.index ?? 0
  let snippetStart = Math.max(0, firstMatchIndex - papelizSearchSnippetLeadCharacters)
  if (snippetStart > 0) {
    // Start at a word, not in the middle of one.
    const nextSpaceIndex = searchSnippetText.indexOf(' ', snippetStart - 1)
    snippetStart = nextSpaceIndex === -1 || nextSpaceIndex >= firstMatchIndex ? firstMatchIndex : nextSpaceIndex + 1
  }
  let snippetEnd = Math.min(searchSnippetText.length, snippetStart + papelizSearchSnippetLengthCharacters)
  if (snippetEnd < searchSnippetText.length) {
    const lastSpaceIndex = searchSnippetText.lastIndexOf(' ', snippetEnd)
    if (lastSpaceIndex > firstMatchIndex) snippetEnd = lastSpaceIndex
  }
  const snippetText = searchSnippetText.slice(snippetStart, snippetEnd).trim()
  return `${snippetStart > 0 ? '…' : ''}${snippetText}${snippetEnd < searchSnippetText.length ? '…' : ''}`
}

export interface PapelizVaultSearchSnippetPart {
  snippetPartText: string
  isMatchedWord: boolean
}

// A snippet cut into its matched words and the text between them, for the result list to bold them.
export function splitVaultSearchSnippetAtMatchedWords(
  searchResultSnippet: string,
  matchedVaultSearchWords: readonly string[],
): PapelizVaultSearchSnippetPart[] {
  const matchedWordsPattern = createMatchedWordsPattern(matchedVaultSearchWords)
  if (matchedWordsPattern === null) return [{ snippetPartText: searchResultSnippet, isMatchedWord: false }]
  const snippetParts: PapelizVaultSearchSnippetPart[] = []
  let unmatchedTextStart = 0
  for (const matchedWord of searchResultSnippet.matchAll(matchedWordsPattern)) {
    if (matchedWord.index > unmatchedTextStart) {
      snippetParts.push({ snippetPartText: searchResultSnippet.slice(unmatchedTextStart, matchedWord.index), isMatchedWord: false })
    }
    snippetParts.push({ snippetPartText: matchedWord[0], isMatchedWord: true })
    unmatchedTextStart = matchedWord.index + matchedWord[0].length
  }
  if (unmatchedTextStart < searchResultSnippet.length) snippetParts.push({ snippetPartText: searchResultSnippet.slice(unmatchedTextStart), isMatchedWord: false })
  return snippetParts
}
