import { isVaultNoteFileName } from './papeliz-vault-relative-paths'

// Which files besides `.md` notes the file list shows and opens: plain-text files such as JSON,
// YAML, `.gitignore`, scripts and `LICENSE`. They open as text, never as notes, and nothing in them
// ever runs. Pictures and other binary files stay out of the list, as before.

// What a file's name alone says: a note, a text file, a file left out (a picture, an archive), or one
// whose first bytes decide.
export type PapelizVaultFileNameKind = 'vault-note' | 'vault-text-file' | 'vault-other-file' | 'vault-file-needing-byte-check'

// How much of the start of a file the byte check reads.
export const papelizVaultFileByteCheckLength = 4096

const papelizVaultTextFileExtensions: ReadonlySet<string> = new Set([
  'json', 'jsonc', 'json5', 'txt', 'text', 'log', 'csv', 'tsv',
  'yml', 'yaml', 'toml', 'ini', 'cfg', 'conf', 'properties', 'env', 'xml',
  'html', 'htm', 'css', 'scss', 'sass', 'less',
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx', 'vue', 'svelte', 'astro',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'kts', 'swift', 'c', 'h', 'cpp', 'cc', 'hpp', 'cs', 'php', 'pl', 'lua', 'r', 'sql',
  'sh', 'bash', 'zsh', 'fish', 'ps1', 'psm1', 'psd1', 'bat', 'cmd',
  'graphql', 'gql', 'proto', 'diff', 'patch', 'tex', 'bib', 'rst', 'adoc', 'org', 'mdx', 'markdown',
])

// Pictures (SVG too: it is a picture to Papeliz), media, archives, documents, fonts and programs.
const papelizVaultOtherFileExtensions: ReadonlySet<string> = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'tif', 'tiff', 'heic', 'heif', 'svg', 'psd',
  'mp3', 'mp4', 'm4a', 'm4v', 'wav', 'ogg', 'oga', 'flac', 'aac', 'mov', 'avi', 'mkv', 'webm',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'epub', 'rtf',
  'zip', 'gz', 'tgz', 'bz2', 'xz', '7z', 'rar', 'tar', 'jar', 'war', 'iso', 'dmg',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'exe', 'dll', 'so', 'dylib', 'bin', 'wasm', 'class', 'o', 'a', 'pyc', 'sqlite', 'db',
])

// Text files known by their whole name: dotfiles and the usual extensionless files of a project.
const papelizVaultTextFileNames: ReadonlySet<string> = new Set([
  '.gitignore', '.gitattributes', '.gitmodules', '.gitkeep', '.mailmap', '.editorconfig', '.env', '.npmrc', '.nvmrc', '.node-version',
  '.python-version', '.tool-versions', '.prettierrc', '.prettierignore', '.eslintrc', '.eslintignore', '.babelrc', '.dockerignore', '.htaccess',
  'license', 'licence', 'copying', 'notice', 'authors', 'contributors', 'codeowners', 'readme', 'changelog',
  'makefile', 'dockerfile', 'procfile', 'gemfile', 'rakefile', 'brewfile', 'vagrantfile', 'jenkinsfile',
])

// "settings.json" -> "json"; "LICENSE" and ".gitignore" have none; ".env.example" -> "example".
function getVaultFileExtension(vaultFileName: string): string {
  const extensionDotIndex = vaultFileName.lastIndexOf('.')
  return extensionDotIndex > 0 ? vaultFileName.slice(extensionDotIndex + 1).toLowerCase() : ''
}

export function classifyVaultFileByName(vaultFileName: string): PapelizVaultFileNameKind {
  if (isVaultNoteFileName(vaultFileName)) return 'vault-note'
  if (papelizVaultTextFileNames.has(vaultFileName.toLowerCase())) return 'vault-text-file'
  const vaultFileExtension = getVaultFileExtension(vaultFileName)
  if (papelizVaultTextFileExtensions.has(vaultFileExtension)) return 'vault-text-file'
  if (papelizVaultOtherFileExtensions.has(vaultFileExtension)) return 'vault-other-file'
  return 'vault-file-needing-byte-check'
}

// The byte check for a name that doesn't say: the file's first bytes are text when they hold no zero
// byte, read as UTF-8 (a character cut off at the end of the sample aside), and are almost free of
// control characters other than tab, line breaks, form feed and escape.
export function isVaultFileSampleBytesPlainText(vaultFileSampleBytes: Uint8Array): boolean {
  if (vaultFileSampleBytes.includes(0)) return false
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(vaultFileSampleBytes, { stream: true })
  } catch {
    return false
  }
  let controlByteCount = 0
  for (const vaultFileByte of vaultFileSampleBytes) {
    const isAllowedControlByte = vaultFileByte === 0x09 || vaultFileByte === 0x0a || vaultFileByte === 0x0c || vaultFileByte === 0x0d || vaultFileByte === 0x1b
    if ((vaultFileByte < 0x20 || vaultFileByte === 0x7f) && !isAllowedControlByte) controlByteCount += 1
  }
  return controlByteCount <= vaultFileSampleBytes.length * 0.02
}

// A `.json` file: MD Code colors, folds and checks it. JSON with comments (`.jsonc`, `.json5`)
// opens as plain text.
export function isVaultJsonFileName(vaultFileName: string): boolean {
  return getVaultFileExtension(vaultFileName) === 'json'
}
