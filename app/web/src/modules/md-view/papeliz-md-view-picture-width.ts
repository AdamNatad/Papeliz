import { readPapelizMdViewImageAltTextSize, readPapelizMdViewWikilinkEmbedLabel } from './papeliz-md-view-media-sources'

// A picture's width as MD View's handle writes it into the note's Markdown, in the forms other
// Markdown apps read: `![[plan.png|300]]` for an embed, `![Garden plan|300](plan.png)` for a picture
// link. A width replaces any size already there, height included, so the picture keeps its own
// proportions; no width puts the picture back to its own size.

// The smallest width the handle and the keys go to; a width typed in the Markdown may be smaller.
export const papelizMdViewPictureSmallestWidthPixels = 48

// A key press moves the width by a tenth of the note's column.
export const papelizMdViewPictureWidthStepsAcrossColumn = 10

// Whole pixels, from the smallest width up to the note's column.
export function clampPapelizMdViewPictureWidthPixels(requestedWidthPixels: number, noteColumnWidthPixels: number): number {
  const widestPictureWidthPixels = Math.max(papelizMdViewPictureSmallestWidthPixels, Math.floor(noteColumnWidthPixels))
  return Math.min(widestPictureWidthPixels, Math.max(papelizMdViewPictureSmallestWidthPixels, Math.round(requestedWidthPixels)))
}

// "Garden plan" + 300 -> "Garden plan|300"; "Garden plan|120x80" + 300 -> "Garden plan|300";
// "Garden plan|300" + null -> "Garden plan".
export function writePapelizMdViewImageAltTextWidth(imageAltText: string, pictureWidthPixels: number | null): string {
  const imageDescription = readPapelizMdViewImageAltTextSize(imageAltText).mediaAlternativeText
  return pictureWidthPixels === null ? imageDescription : `${imageDescription}|${pictureWidthPixels}`
}

// The text inside `![[ ]]`: "plan.png" + 300 -> "plan.png|300"; "plan.png|The plan" + 300 ->
// "plan.png|The plan|300"; "plan.png|300x200" + null -> "plan.png". The file's name is kept as typed.
export function writePapelizMdViewWikilinkEmbedInnerTextWidth(embedInnerText: string, pictureWidthPixels: number | null): string {
  const labelSeparatorIndex = embedInnerText.indexOf('|')
  const embedTargetText = labelSeparatorIndex === -1 ? embedInnerText : embedInnerText.slice(0, labelSeparatorIndex)
  const embedLabelText = labelSeparatorIndex === -1 ? null : embedInnerText.slice(labelSeparatorIndex + 1).trim()
  const embedDescription = readPapelizMdViewWikilinkEmbedLabel(embedLabelText === '' ? null : embedLabelText).mediaAlternativeText
  const writtenEmbedParts = [embedTargetText]
  if (embedDescription !== null) writtenEmbedParts.push(embedDescription)
  if (pictureWidthPixels !== null) writtenEmbedParts.push(String(pictureWidthPixels))
  return writtenEmbedParts.join('|')
}
