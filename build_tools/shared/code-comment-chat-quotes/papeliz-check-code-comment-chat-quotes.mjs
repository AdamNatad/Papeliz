#!/usr/bin/env node
// Papeliz chat quote check. Code and its comments say what the code does and why, never who asked
// for it, when, in what words, or which option was picked. This finds such chat quotes in code and
// configuration files (Markdown and plain text are never read):
//   node build_tools/shared/code-comment-chat-quotes/papeliz-check-code-comment-chat-quotes.mjs [<file or folder>...]
// With no path it checks every file Git tracks or would track, skipping dependencies, builds,
// test_trash/ and the paths listed in the repository's .papeliz-code-comment-chat-quotes-ignore. `--staged` checks only the lines the next commit adds; the Git pre-commit hook runs it
// (installed by papeliz-strip-image-metadata.mjs --install-git-hook). Each quote is reported as
// file:line and the exit code is 1. The patterns live in papeliz-code-comment-chat-quote-patterns.mjs.
// Node.js only, no packages.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  findPapelizCodeChatQuoteKind,
  findPapelizCodeChatQuotesInText,
  isPapelizCodeChatQuoteCheckedPath,
  papelizCodeChatQuoteIgnoreFileName,
  readPapelizCodeChatQuoteIgnoredPaths,
} from './papeliz-code-comment-chat-quote-patterns.mjs'

const papelizCodeChatQuoteCheckUsage = `Papeliz chat quote check

Usage:
  node build_tools/shared/code-comment-chat-quotes/papeliz-check-code-comment-chat-quotes.mjs [<file or folder>...]
  node build_tools/shared/code-comment-chat-quotes/papeliz-check-code-comment-chat-quotes.mjs --staged

Finds comments and strings in code that quote or retell a conversation: an attribution to the
owner with a date, quoted chat words, or which option the owner picked or asked for. Code says
what it does and why instead. Markdown, plain text, dependencies, builds and test_trash/ are skipped,
with the paths listed in ${papelizCodeChatQuoteIgnoreFileName} at the repository root.

Options:
  --staged  Check only the lines the next commit adds (the Git pre-commit hook runs this)
  --help    Show this help

Exits 1 when a quote is found, with each one as file:line.
`

const papelizCodeChatQuoteReportedTextLength = 140

function runGitCommand(gitArguments) {
  const gitResult = spawnSync('git', gitArguments, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  if (gitResult.status !== 0) throw new Error(`git ${gitArguments.join(' ')} failed: ${(gitResult.stderr || '').trim()}`)
  return gitResult.stdout
}

const splitGitPathList = (gitOutput) => gitOutput.split('\0').filter(Boolean)

// Every checked file under the given paths (the whole repository when none), as repository paths.
function listPapelizCodeChatQuoteCheckedFiles(absoluteInputPaths, ignoredRepositoryPaths) {
  const listedPaths = splitGitPathList(runGitCommand(['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...absoluteInputPaths]))
  return [...new Set(listedPaths)].filter((listedPath) => isPapelizCodeChatQuoteCheckedPath(listedPath, ignoredRepositoryPaths) && existsSync(listedPath))
}

function findPapelizCodeChatQuotesInFiles(repositoryPaths) {
  const fileChatQuotes = []
  for (const repositoryPath of repositoryPaths) {
    for (const codeChatQuote of findPapelizCodeChatQuotesInText(readFileSync(repositoryPath, 'utf8'))) {
      fileChatQuotes.push({ repositoryPath, ...codeChatQuote })
    }
  }
  return fileChatQuotes
}

// The lines the next commit adds to checked files, read from the staged diff with no context lines.
// A `+++` line is a file header only before its first hunk; inside a hunk it is an added line.
function findPapelizCodeChatQuotesInStagedLines(ignoredRepositoryPaths) {
  const stagedDiffText = runGitCommand([
    '-c', 'core.quotePath=false', 'diff', '--cached', '--unified=0', '--no-color', '--no-ext-diff',
    '--src-prefix=a/', '--dst-prefix=b/', '--diff-filter=ACMR',
  ])
  const fileChatQuotes = []
  let stagedFilePath = null
  let isStagedFileChecked = false
  let isInsideFileHeader = false
  let nextAddedLineNumber = 0
  for (const stagedDiffLine of stagedDiffText.split('\n')) {
    if (stagedDiffLine.startsWith('diff --git ')) {
      isInsideFileHeader = true
      stagedFilePath = null
      isStagedFileChecked = false
    } else if (isInsideFileHeader && stagedDiffLine.startsWith('+++ ')) {
      const headerPath = stagedDiffLine.slice(4).replace(/^"|"$/g, '')
      stagedFilePath = headerPath.startsWith('b/') ? headerPath.slice(2) : null
      isStagedFileChecked = stagedFilePath !== null && isPapelizCodeChatQuoteCheckedPath(stagedFilePath, ignoredRepositoryPaths)
    } else if (stagedDiffLine.startsWith('@@')) {
      isInsideFileHeader = false
      nextAddedLineNumber = Number(/\+(\d+)/.exec(stagedDiffLine)?.[1] ?? 0)
    } else if (!isInsideFileHeader && stagedDiffLine.startsWith('+')) {
      const codeLineText = stagedDiffLine.slice(1).replace(/\r$/, '')
      const codeChatQuoteKind = isStagedFileChecked ? findPapelizCodeChatQuoteKind(codeLineText) : null
      if (codeChatQuoteKind) fileChatQuotes.push({ repositoryPath: stagedFilePath, codeLineNumber: nextAddedLineNumber, codeLineText, codeChatQuoteKind })
      nextAddedLineNumber++
    }
  }
  return fileChatQuotes
}

function reportPapelizCodeChatQuotes(fileChatQuotes, checkedSourceLabel) {
  for (const { repositoryPath, codeLineNumber, codeLineText, codeChatQuoteKind } of fileChatQuotes) {
    const trimmedLineText = codeLineText.trim()
    const reportedLineText = trimmedLineText.length > papelizCodeChatQuoteReportedTextLength ? `${trimmedLineText.slice(0, papelizCodeChatQuoteReportedTextLength)}…` : trimmedLineText
    console.log(`  ${repositoryPath}:${codeLineNumber}  (${codeChatQuoteKind})  ${reportedLineText}`)
  }
  const quotedFileCount = new Set(fileChatQuotes.map(({ repositoryPath }) => repositoryPath)).size
  if (fileChatQuotes.length === 0) {
    console.log(`  No chat quotes in ${checkedSourceLabel}.`)
    return
  }
  console.log(`\n  ${fileChatQuotes.length} chat quote(s) in ${quotedFileCount} file(s) of ${checkedSourceLabel}.`)
  console.log('  Rewrite each so it says what the code does and why: no quoted chat, no names or dates of a conversation.')
  process.exitCode = 1
}

function runPapelizCodeChatQuoteCheck() {
  const commandLineArguments = process.argv.slice(2)
  const knownOptions = new Set(['--staged', '--help', '-h'])
  const unknownOptions = commandLineArguments.filter((commandLineArgument) => commandLineArgument.startsWith('-') && !knownOptions.has(commandLineArgument))
  if (unknownOptions.length) throw new Error(`Unknown option ${unknownOptions[0]}`)
  if (commandLineArguments.includes('--help') || commandLineArguments.includes('-h')) {
    process.stdout.write(papelizCodeChatQuoteCheckUsage)
    return
  }
  // Paths are read from the repository root, so given paths are made absolute first.
  const absoluteInputPaths = commandLineArguments.filter((commandLineArgument) => !commandLineArgument.startsWith('-')).map((inputPath) => path.resolve(inputPath))
  process.chdir(runGitCommand(['rev-parse', '--show-toplevel']).trim())
  const ignoredRepositoryPaths = readPapelizCodeChatQuoteIgnoredPaths(process.cwd())
  if (commandLineArguments.includes('--staged')) {
    reportPapelizCodeChatQuotes(findPapelizCodeChatQuotesInStagedLines(ignoredRepositoryPaths), 'the staged lines')
    return
  }
  const checkedFilePaths = listPapelizCodeChatQuoteCheckedFiles(absoluteInputPaths, ignoredRepositoryPaths)
  reportPapelizCodeChatQuotes(findPapelizCodeChatQuotesInFiles(checkedFilePaths), `${checkedFilePaths.length} checked files`)
}

try {
  runPapelizCodeChatQuoteCheck()
} catch (codeChatQuoteCheckError) {
  console.error(` [error] ${codeChatQuoteCheckError.message}`)
  process.exitCode = 1
}
