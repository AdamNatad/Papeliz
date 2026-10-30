// The links a Papeliz PDF may hold. A web link is only an `https:`, `http:` or `mailto:` address that
// passes the check below; every other link points at a named place inside the same file. Names of
// places are plain ASCII, so every PDF reader finds them. Used on the main thread (which links a note
// gets) and in the worker (the page layout plan's check), so both agree.

const papelizPdfExportWebLinkAddressLength = 8_192
// C0 and C1 control characters (U+0000–U+001F, U+007F–U+009F), written as they are or percent-encoded
// (C1 as UTF-8: %C2%80–%C2%9F).
const papelizPdfExportControlCharacterPattern = /\p{Cc}/u
const papelizPdfExportEncodedControlCharacterPattern = /%(?:[01][0-9a-f]|7f|c2%[89][0-9a-f])/i

export const papelizPdfExportDestinationNamePattern = /^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/
const papelizPdfExportDestinationNameLength = 128

// "https://Example.com/a b" -> "https://example.com/a%20b"; null for an address the PDF won't link:
// another kind of address, a user name or password, control characters, no host, or no recipient.
export function checkPapelizPdfExportWebLinkAddress(linkHref: string): string | null {
  if (papelizPdfExportControlCharacterPattern.test(linkHref)) return null
  let linkUrl: URL
  try {
    linkUrl = new URL(linkHref)
  } catch {
    return null
  }
  const webLinkAddress = linkUrl.href
  if (webLinkAddress.length > papelizPdfExportWebLinkAddressLength) return null
  if (papelizPdfExportControlCharacterPattern.test(webLinkAddress) || papelizPdfExportEncodedControlCharacterPattern.test(webLinkAddress)) return null
  if (linkUrl.username !== '' || linkUrl.password !== '') return null
  if (linkUrl.protocol === 'https:' || linkUrl.protocol === 'http:') return linkUrl.hostname === '' ? null : webLinkAddress
  if (linkUrl.protocol === 'mailto:') return linkUrl.pathname.trim() === '' ? null : webLinkAddress
  return null
}

// "Ünïcödé heading" -> "unicode-heading": letters without their accents, everything else a hyphen.
function toPapelizPdfExportAsciiNamePart(namePartText: string): string {
  return namePartText
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// "heading-3-launch-plan": unique by the heading's place in the note, readable after the number.
export function createPapelizPdfExportHeadingDestinationName(headingNumber: number, headingId: string): string {
  const destinationNamePrefix = `heading-${headingNumber}`
  const asciiHeadingId = toPapelizPdfExportAsciiNamePart(headingId)
  return (asciiHeadingId.length > 0 ? `${destinationNamePrefix}-${asciiHeadingId}` : destinationNamePrefix).slice(0, papelizPdfExportDestinationNameLength).replace(/-+$/, '')
}

export function createPapelizPdfExportFootnoteDestinationName(footnoteNumber: number): string {
  return `footnote-${footnoteNumber}`
}

export function createPapelizPdfExportFootnoteReferenceDestinationName(footnoteReferenceNumber: number): string {
  return `footnote-reference-${footnoteReferenceNumber}`
}
