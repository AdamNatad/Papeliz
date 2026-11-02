import { getPapelizHtmlExportPictureMediaType } from '../html-export/papeliz-html-export-vault-files'

// What a picture or video address in a note points to, as MD View shows it. A web address is shown
// only over https; every other scheme (javascript:, data:, blob:, file:, http:) is never loaded. An
// address with no scheme is a file in the vault. A YouTube address gives MD View only its video id,
// and the player is loaded from youtube-nocookie.com only when play is pressed.

export type PapelizMdViewMediaSource =
  | { mediaSourceKind: 'web-picture'; webMediaUrl: string }
  | { mediaSourceKind: 'web-video'; webMediaUrl: string }
  | { mediaSourceKind: 'vault-picture'; vaultMediaReference: string }
  | { mediaSourceKind: 'vault-video'; vaultMediaReference: string }
  | { mediaSourceKind: 'youtube-video'; youTubeVideoId: string }
  // An address MD View never loads (another scheme, a file that isn't a picture or video).
  | { mediaSourceKind: 'not-shown' }

const papelizMdViewVideoMediaTypesByExtension: Readonly<Record<string, string>> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
}

function readFileExtension(filePath: string): string {
  return /\.([^./]+)$/.exec(filePath)?.[1]?.toLowerCase() ?? ''
}

// "clips/demo.MP4" -> "video/mp4"; null for a file MD View doesn't play.
export function getPapelizMdViewVideoMediaType(filePath: string): string | null {
  return papelizMdViewVideoMediaTypesByExtension[readFileExtension(filePath)] ?? null
}

export function getPapelizMdViewVaultMediaType(vaultFileRelativePath: string): string | null {
  return getPapelizHtmlExportPictureMediaType(vaultFileRelativePath) ?? getPapelizMdViewVideoMediaType(vaultFileRelativePath)
}

const papelizYouTubeVideoIdPattern = /^[A-Za-z0-9_-]{11}$/
const papelizYouTubeWatchHostNames = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com'])
const papelizYouTubeVideoPathKinds = new Set(['shorts', 'embed', 'live'])

// The video id of a YouTube address: `youtube.com/watch?v=<id>`, `youtu.be/<id>`, and
// `youtube.com/shorts|embed|live/<id>`. Anything else in the address (a start time, a playlist, a
// tracking parameter) is left behind. Null for any other address.
export function readPapelizYouTubeVideoId(youTubeAddress: string): string | null {
  let parsedYouTubeUrl: URL
  try {
    parsedYouTubeUrl = new URL(youTubeAddress.trim())
  } catch {
    return null
  }
  if (parsedYouTubeUrl.protocol !== 'https:' && parsedYouTubeUrl.protocol !== 'http:') return null
  if (parsedYouTubeUrl.username !== '' || parsedYouTubeUrl.password !== '' || parsedYouTubeUrl.port !== '') return null
  const youTubeHostName = parsedYouTubeUrl.hostname.toLowerCase()
  const youTubePathSegments = parsedYouTubeUrl.pathname.split('/').filter((youTubePathSegment) => youTubePathSegment.length > 0)
  let youTubeVideoIdCandidate: string | null = null
  if (youTubeHostName === 'youtu.be') {
    youTubeVideoIdCandidate = youTubePathSegments.length === 1 ? (youTubePathSegments[0] ?? null) : null
  } else if (papelizYouTubeWatchHostNames.has(youTubeHostName)) {
    if (parsedYouTubeUrl.pathname === '/watch') youTubeVideoIdCandidate = parsedYouTubeUrl.searchParams.get('v')
    else if (youTubePathSegments.length === 2 && papelizYouTubeVideoPathKinds.has(youTubePathSegments[0] ?? '')) youTubeVideoIdCandidate = youTubePathSegments[1] ?? null
  }
  return youTubeVideoIdCandidate !== null && papelizYouTubeVideoIdPattern.test(youTubeVideoIdCandidate) ? youTubeVideoIdCandidate : null
}

export const papelizYouTubeNoCookieOrigin = 'https://www.youtube-nocookie.com'

// The one address MD View ever frames: YouTube's privacy-enhanced player for a checked video id,
// started at once, since it loads only when play was pressed.
export function buildPapelizYouTubeNoCookieEmbedUrl(youTubeVideoId: string): string {
  if (!papelizYouTubeVideoIdPattern.test(youTubeVideoId)) throw new Error('Not a YouTube video id')
  return `${papelizYouTubeNoCookieOrigin}/embed/${youTubeVideoId}?autoplay=1`
}

export function buildPapelizYouTubeWatchUrl(youTubeVideoId: string): string {
  if (!papelizYouTubeVideoIdPattern.test(youTubeVideoId)) throw new Error('Not a YouTube video id')
  return `https://www.youtube.com/watch?v=${youTubeVideoId}`
}

// "my%20plan.png" -> "my plan.png", as a note's Markdown or the rendered tree writes a vault file's
// address. A `?…` or `#…` after it is not part of the file's name.
function decodeVaultMediaReference(vaultMediaAddress: string): string {
  const vaultMediaPath = vaultMediaAddress.replace(/[?#].*$/, '')
  try {
    return decodeURIComponent(vaultMediaPath)
  } catch {
    return vaultMediaPath
  }
}

// A picture's address as the note writes it (`![alt](address)`), or as the sanitized tree gives it.
export function readPapelizMdViewMediaSource(mediaAddress: string): PapelizMdViewMediaSource {
  const trimmedMediaAddress = mediaAddress.trim().replace(/^<(.*)>$/, '$1').trim()
  if (trimmedMediaAddress.length === 0) return { mediaSourceKind: 'not-shown' }
  const youTubeVideoId = readPapelizYouTubeVideoId(trimmedMediaAddress)
  if (youTubeVideoId !== null) return { mediaSourceKind: 'youtube-video', youTubeVideoId }
  // A scheme ("https:", "javascript:", "C:"), or `//host/…`, which goes to a host.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmedMediaAddress) || trimmedMediaAddress.startsWith('//') || trimmedMediaAddress.startsWith('\\\\')) {
    let parsedWebMediaUrl: URL
    try {
      parsedWebMediaUrl = new URL(trimmedMediaAddress)
    } catch {
      return { mediaSourceKind: 'not-shown' }
    }
    if (parsedWebMediaUrl.protocol !== 'https:' || parsedWebMediaUrl.username !== '' || parsedWebMediaUrl.password !== '') return { mediaSourceKind: 'not-shown' }
    // A web picture's address often has no extension (a badge, a picture service), so any https
    // address is a picture unless it names a video file.
    return getPapelizMdViewVideoMediaType(parsedWebMediaUrl.pathname) === null
      ? { mediaSourceKind: 'web-picture', webMediaUrl: parsedWebMediaUrl.href }
      : { mediaSourceKind: 'web-video', webMediaUrl: parsedWebMediaUrl.href }
  }
  return readPapelizMdViewVaultMediaSource(decodeVaultMediaReference(trimmedMediaAddress))
}

// A file in the vault by its name or path (`plan.png`, `../pictures/plan.png`, `![[plan.png]]`'s
// target): a picture, a video, or nothing MD View shows.
export function readPapelizMdViewVaultMediaSource(vaultMediaReference: string): PapelizMdViewMediaSource {
  const trimmedVaultMediaReference = vaultMediaReference.trim()
  if (trimmedVaultMediaReference.length === 0 || /^[a-z][a-z0-9+.-]*:/i.test(trimmedVaultMediaReference)) return { mediaSourceKind: 'not-shown' }
  if (getPapelizHtmlExportPictureMediaType(trimmedVaultMediaReference) !== null) return { mediaSourceKind: 'vault-picture', vaultMediaReference: trimmedVaultMediaReference }
  if (getPapelizMdViewVideoMediaType(trimmedVaultMediaReference) !== null) return { mediaSourceKind: 'vault-video', vaultMediaReference: trimmedVaultMediaReference }
  return { mediaSourceKind: 'not-shown' }
}

// `![[plan.png|300]]` and `![[plan.png|300x200]]` set the width (and height) in pixels, as most
// Markdown vault apps read them; any other text after the `|` is the picture's description.
export interface PapelizMdViewWikilinkEmbedLabel {
  mediaAlternativeText: string | null
  mediaWidthPixels: number | null
  mediaHeightPixels: number | null
}

export function readPapelizMdViewWikilinkEmbedLabel(wikilinkLabel: string | null): PapelizMdViewWikilinkEmbedLabel {
  const mediaSizeMatch = wikilinkLabel === null ? null : /^(\d{1,4})(?:x(\d{1,4}))?$/.exec(wikilinkLabel.trim())
  if (mediaSizeMatch === null) return { mediaAlternativeText: wikilinkLabel, mediaWidthPixels: null, mediaHeightPixels: null }
  const mediaWidthPixels = Number(mediaSizeMatch[1])
  const mediaHeightPixels = mediaSizeMatch[2] === undefined ? null : Number(mediaSizeMatch[2])
  return { mediaAlternativeText: null, mediaWidthPixels: mediaWidthPixels > 0 ? mediaWidthPixels : null, mediaHeightPixels: mediaHeightPixels !== null && mediaHeightPixels > 0 ? mediaHeightPixels : null }
}
