// The patterns of the Papeliz chat quote check. Code and its comments say what the code does and
// why, never who asked for it, when, in what words, or which option was picked. These patterns
// find such chat quotes in a line of code; papeliz-check-code-comment-chat-quotes.mjs runs them on
// files and on the lines a commit adds, and agent or editor hooks import them to check text before
// it is written. The project's own credits ("by Adam Natad", GitHub ids like AdamNatad/Papeliz)
// match none of them. Node.js only, no packages.

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

// Each pattern with what it catches. A quote split over two comment lines is caught on either line:
// the name and date on one, the quoted words on the next.
export const papelizCodeChatQuotePatterns = [
  // An attribution in parentheses: an opening parenthesis and the owner's name, then a comma, a
  // colon, a closing parenthesis or the end of the line.
  { codeChatQuoteKind: 'owner attribution', codeChatQuotePattern: /\(\s*Adam\s*(?:[,;:)]|$)/ },
  // The owner's name with a date close after it, in the same sentence.
  { codeChatQuoteKind: 'owner attribution with a date', codeChatQuotePattern: /\bAdam\b[^.;]{0,40}?\b20\d\d-\d\d-\d\d\b/ },
  // The owner's words introduced by the name and a colon.
  { codeChatQuoteKind: 'owner quote', codeChatQuotePattern: /\bAdam:\s*["“]/ },
  // A date, then a colon or comma and quoted words: the second line of an attribution whose name
  // ends the line before. A record cited by its upper-case name and date, with its title, is not chat.
  { codeChatQuoteKind: 'dated quote', codeChatQuotePattern: /(?<![A-Z]{3,} )\b20\d\d-\d\d-\d\d\)?\s*[:,]\s*["“‘]/ },
  // A design option named by a capital letter and a middle dot, as offered in a list of choices.
  { codeChatQuoteKind: 'picked design option', codeChatQuotePattern: /["“][A-H] · \S/ },
  // What the owner picked, asked for or said, by name.
  {
    codeChatQuoteKind: 'owner pick or request',
    codeChatQuotePattern: /\bAdam(?:'s|’s)?\s+(?:own\s+)?(?:pick|picks|picked|asks|asked|said|says|wants|wanted|chose|choice|request|requested|words|wording|casing)\b/,
  },
  // The same told with "his" or "he".
  { codeChatQuoteKind: 'owner pick or words, unnamed', codeChatQuotePattern: /\bhis\s+(?:own\s+)?(?:pick|picks|words|wording|choice|casing|request)\b/i },
  { codeChatQuoteKind: 'owner request, unnamed', codeChatQuotePattern: /\bhe\s+(?:asked|picked|chose|said|wanted|requested)\b/i },
]

// File kinds that hold code or configuration with comments. Markdown and plain text are documents,
// never read.
const papelizCodeChatQuoteCheckedFileExtensions = new Set([
  '.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs',
  '.css', '.scss', '.sass', '.less', '.html', '.htm', '.astro', '.vue', '.svelte', '.svg', '.xml',
  '.sh', '.bash', '.zsh', '.bat', '.cmd', '.ps1', '.psm1',
  '.py', '.rs', '.go', '.java', '.kt', '.swift', '.c', '.h', '.cc', '.cpp', '.hpp', '.cs', '.sql',
  '.json', '.jsonc', '.json5', '.yml', '.yaml', '.toml', '.ini',
])
const papelizCodeChatQuoteCheckedFileNames = new Set(['.gitignore', '.gitattributes', '.editorconfig', '.npmrc', 'Dockerfile', 'Makefile'])
const papelizCodeChatQuoteSkippedFileNames = new Set(['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'])
// Generated output, dependencies and caches, at any depth.
const papelizCodeChatQuoteSkippedFolderNames = new Set([
  'node_modules', '.git', '.next', 'out', 'dist', 'build', 'coverage', '.turbo', '.wrangler', '.vite', '.cache',
  'playwright-report', 'test-results', 'blob-report',
])
// Scratch work and assembled output at the repository root.
const papelizCodeChatQuoteSkippedRootFolders = ['test_trash/', 'deploy/', '.papeliz-sync-local-workers/']

// A repository may list more paths to skip in this file at its root, one per line: a folder ends in
// "/", anything else is one file, and "#" starts a comment. A missing file skips nothing more.
export const papelizCodeChatQuoteIgnoreFileName = '.papeliz-code-comment-chat-quotes-ignore'

export function readPapelizCodeChatQuoteIgnoredPaths(repositoryRootPath) {
  const ignoreFilePath = path.join(repositoryRootPath, papelizCodeChatQuoteIgnoreFileName)
  if (!existsSync(ignoreFilePath)) return []
  return readFileSync(ignoreFilePath, 'utf8')
    .split(/\r?\n/)
    .map((ignoreFileLine) => ignoreFileLine.replace(/#.*$/, '').trim().replace(/\\/g, '/').replace(/^\.\//, ''))
    .filter(Boolean)
}

// Whether the check reads this file, by its repository-relative path, given the paths the
// repository's ignore file lists.
export function isPapelizCodeChatQuoteCheckedPath(repositoryRelativePath, ignoredRepositoryPaths = []) {
  const forwardSlashPath = repositoryRelativePath.replace(/\\/g, '/')
  if (papelizCodeChatQuoteSkippedRootFolders.some((skippedRootFolder) => forwardSlashPath.startsWith(skippedRootFolder))) return false
  const isIgnoredPath = ignoredRepositoryPaths.some((ignoredRepositoryPath) =>
    ignoredRepositoryPath.endsWith('/') ? forwardSlashPath.startsWith(ignoredRepositoryPath) : forwardSlashPath === ignoredRepositoryPath,
  )
  if (isIgnoredPath) return false
  const pathSegments = forwardSlashPath.split('/')
  const fileName = pathSegments.pop() ?? ''
  if (pathSegments.some((folderName) => papelizCodeChatQuoteSkippedFolderNames.has(folderName))) return false
  if (papelizCodeChatQuoteSkippedFileNames.has(fileName)) return false
  if (papelizCodeChatQuoteCheckedFileNames.has(fileName)) return true
  const extensionStart = fileName.lastIndexOf('.')
  return extensionStart > 0 && papelizCodeChatQuoteCheckedFileExtensions.has(fileName.slice(extensionStart).toLowerCase())
}

// The kind of chat quote a line holds, or null for a clean line.
export function findPapelizCodeChatQuoteKind(codeLineText) {
  for (const { codeChatQuoteKind, codeChatQuotePattern } of papelizCodeChatQuotePatterns) {
    if (codeChatQuotePattern.test(codeLineText)) return codeChatQuoteKind
  }
  return null
}

// Every chat quote in a text, with its 1-based line number.
export function findPapelizCodeChatQuotesInText(codeText) {
  const codeChatQuotes = []
  codeText.split(/\r?\n/).forEach((codeLineText, codeLineIndex) => {
    const codeChatQuoteKind = findPapelizCodeChatQuoteKind(codeLineText)
    if (codeChatQuoteKind) codeChatQuotes.push({ codeLineNumber: codeLineIndex + 1, codeLineText, codeChatQuoteKind })
  })
  return codeChatQuotes
}
