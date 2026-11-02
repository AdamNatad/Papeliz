import type { Element as HastElement, ElementContent as HastElementContent, Root as HastRoot } from 'hast'

// A picture in an assistant answer whose address is on the web (`http:` or `https:`) waits behind a
// Show button: an answer can be steered by a note the user didn't write, and a picture's address can
// carry the text of other notes to whoever serves it. Until Show is pressed the answer holds no `img`
// for it, so nothing is fetched. A picture kept in the vault (a relative path) is left as it is.

// The Show button's data attribute, in the tree and in the page: the picture's place among the
// answer's web pictures.
const papelizAssistantWebPictureIndexPropertyName = 'dataPapelizAssistantWebPictureIndex'
export const papelizAssistantWebPictureShowButtonAttributeName = 'data-papeliz-assistant-web-picture-index'

export function isPapelizAssistantWebPictureSource(pictureSource: string): boolean {
  return /^https?:/i.test(pictureSource)
}

// Show reveals one picture: this place in the answer, with this exact address.
export function createPapelizAssistantWebPictureRevealKey(webPictureIndex: number, webPictureSource: string): string {
  return `${webPictureIndex} ${webPictureSource}`
}

export interface PapelizAssistantAnswerWithWebPicturePlaceholders {
  answerHastRoot: HastRoot
  // Every web picture's address, by its place in the answer (the Show button's index).
  webPictureSources: string[]
}

function readWebPictureHostName(webPictureSource: string): string | null {
  try {
    return new URL(webPictureSource).hostname || null
  } catch {
    return null
  }
}

function createPlaceholderTextHastElement(placeholderTextClassNames: string[], placeholderText: string): HastElement {
  return { type: 'element', tagName: 'span', properties: { className: placeholderTextClassNames }, children: [{ type: 'text', value: placeholderText }] }
}

// MD View's label for a picture it doesn't show ("Image: alt"), with the picture's host and Show.
function createWebPicturePlaceholderHastElement(webPictureIndex: number, webPictureSource: string, webPictureAltText: string): HastElement {
  const webPictureHostName = readWebPictureHostName(webPictureSource)
  const placeholderChildren: HastElementContent[] = [createPlaceholderTextHastElement(['min-w-0', 'truncate'], `Image: ${webPictureAltText || 'untitled'}`)]
  if (webPictureHostName !== null) placeholderChildren.push(createPlaceholderTextHastElement(['min-w-0', 'truncate', 'text-papeliz-ink-subtle'], webPictureHostName))
  placeholderChildren.push({
    type: 'element',
    tagName: 'button',
    properties: {
      type: 'button',
      className: ['flex-none', 'font-semibold', 'text-papeliz-blue', 'hover:underline'],
      ariaLabel: webPictureHostName === null ? 'Show the picture' : `Show the picture from ${webPictureHostName}`,
      [papelizAssistantWebPictureIndexPropertyName]: String(webPictureIndex),
    },
    children: [{ type: 'text', value: 'Show' }],
  })
  return {
    type: 'element',
    tagName: 'span',
    properties: { className: ['papeliz-md-view-image-placeholder', 'papeliz-assistant-web-picture-placeholder', 'max-w-full', 'items-center', 'gap-2', 'align-middle'] },
    children: placeholderChildren,
  }
}

// A copy of the sanitized answer where each web picture not yet revealed is a placeholder. A revealed
// `http:` picture loads over `https:`: the app's content policy allows only `https:` pictures, and
// MD View shows no other.
export function placePapelizAssistantWebPicturePlaceholders(
  answerHastRoot: HastRoot,
  revealedWebPictureKeys: ReadonlySet<string>,
): PapelizAssistantAnswerWithWebPicturePlaceholders {
  const webPictureSources: string[] = []
  function placeWebPicturePlaceholders(hastNode: HastElementContent): HastElementContent {
    if (hastNode.type !== 'element') return hastNode
    const pictureSource = hastNode.tagName === 'img' ? hastNode.properties['src'] : undefined
    if (typeof pictureSource !== 'string' || !isPapelizAssistantWebPictureSource(pictureSource)) {
      return { ...hastNode, children: hastNode.children.map(placeWebPicturePlaceholders) }
    }
    const webPictureIndex = webPictureSources.push(pictureSource) - 1
    if (revealedWebPictureKeys.has(createPapelizAssistantWebPictureRevealKey(webPictureIndex, pictureSource))) {
      return { ...hastNode, properties: { ...hastNode.properties, src: pictureSource.replace(/^http:/i, 'https:') } }
    }
    const pictureAltText = hastNode.properties['alt']
    return createWebPicturePlaceholderHastElement(webPictureIndex, pictureSource, typeof pictureAltText === 'string' ? pictureAltText : '')
  }
  return {
    answerHastRoot: {
      ...answerHastRoot,
      children: answerHastRoot.children.map((hastRootChild) => (hastRootChild.type === 'doctype' ? hastRootChild : placeWebPicturePlaceholders(hastRootChild))),
    },
    webPictureSources,
  }
}
