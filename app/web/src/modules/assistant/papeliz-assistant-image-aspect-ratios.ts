import { createLucideIcon, Scan, Square, type LucideIcon } from 'lucide-react'
import type { PapelizAssistantImageAspectRatio, PapelizAssistantImageAspectRatioChoice, PapelizAssistantImageGenerationPreset } from './papeliz-assistant-media-provider-presets'

// The picture shapes the Imagine menu offers, each with its label and a small outline drawn at its own
// proportions, and which of them a picture model makes. The order here is the menu's order.

// An outline rectangle of width:height, as wide or tall as lucide's Square (18 of 24) and centred in
// the same stroke, so 1:1 is lucide's Square itself.
function createPapelizImageAspectRatioIcon(imageAspectRatio: PapelizAssistantImageAspectRatio, ratioWidth: number, ratioHeight: number): LucideIcon {
  const longestSide = 18
  const outlineWidth = ratioWidth >= ratioHeight ? longestSide : (longestSide * ratioWidth) / ratioHeight
  const outlineHeight = ratioHeight >= ratioWidth ? longestSide : (longestSide * ratioHeight) / ratioWidth
  return createLucideIcon({
    name: `papeliz-image-aspect-ratio-${imageAspectRatio.replace(':', '-')}`,
    size: 24,
    node: [['rect', { width: String(outlineWidth), height: String(outlineHeight), x: String(12 - outlineWidth / 2), y: String(12 - outlineHeight / 2), rx: '2', key: 'outline' }]],
  })
}

export const papelizAssistantImageAspectRatioDisplays: ReadonlyArray<{
  imageAspectRatio: PapelizAssistantImageAspectRatio
  imageAspectRatioLabel: string
  ImageAspectRatioIcon: LucideIcon
}> = [
  // Auto's frame corners: the provider fills the frame with the shape it picks.
  { imageAspectRatio: 'auto', imageAspectRatioLabel: 'Auto', ImageAspectRatioIcon: Scan },
  { imageAspectRatio: '1:1', imageAspectRatioLabel: '1:1', ImageAspectRatioIcon: Square },
  { imageAspectRatio: '2:3', imageAspectRatioLabel: '2:3', ImageAspectRatioIcon: createPapelizImageAspectRatioIcon('2:3', 2, 3) },
  { imageAspectRatio: '3:2', imageAspectRatioLabel: '3:2', ImageAspectRatioIcon: createPapelizImageAspectRatioIcon('3:2', 3, 2) },
  { imageAspectRatio: '16:9', imageAspectRatioLabel: '16:9', ImageAspectRatioIcon: createPapelizImageAspectRatioIcon('16:9', 16, 9) },
  { imageAspectRatio: '9:16', imageAspectRatioLabel: '9:16', ImageAspectRatioIcon: createPapelizImageAspectRatioIcon('9:16', 9, 16) },
]

export function findPapelizAssistantImageAspectRatioDisplay(imageAspectRatio: PapelizAssistantImageAspectRatio) {
  return papelizAssistantImageAspectRatioDisplays.find((imageAspectRatioDisplay) => imageAspectRatioDisplay.imageAspectRatio === imageAspectRatio)!
}

// Shapes chosen before the menu named ratios, by their old names and sizes, read as today's ratios.
const papelizAssistantImageAspectRatiosByOldShapeText: Readonly<Record<string, PapelizAssistantImageAspectRatio>> = {
  square: '1:1',
  landscape: '3:2',
  portrait: '2:3',
  '1024x1024': '1:1',
  '1536x1024': '3:2',
  '1024x1536': '2:3',
  '1344x768': '3:2',
  '768x1344': '2:3',
}

// A stored shape as a ratio: today's ratios as they are, and an older choice by what it meant.
export function readPapelizAssistantImageAspectRatio(storedImageShapeText: string | null): PapelizAssistantImageAspectRatio | null {
  if (storedImageShapeText === null) return null
  const trimmedImageShapeText = storedImageShapeText.trim().toLowerCase()
  const currentImageAspectRatio = papelizAssistantImageAspectRatioDisplays.find((imageAspectRatioDisplay) => imageAspectRatioDisplay.imageAspectRatio === trimmedImageShapeText)
  if (currentImageAspectRatio !== undefined) return currentImageAspectRatio.imageAspectRatio
  return Object.hasOwn(papelizAssistantImageAspectRatiosByOldShapeText, trimmedImageShapeText) ? (papelizAssistantImageAspectRatiosByOldShapeText[trimmedImageShapeText] ?? null) : null
}

// The shapes a picture model makes, in the menu's order; a shape only some of the provider's models
// make is left out for the others.
export function listPapelizAssistantImageAspectRatioChoices(
  imageGenerationPreset: PapelizAssistantImageGenerationPreset | null,
  imageModelName: string,
): PapelizAssistantImageAspectRatioChoice[] {
  if (imageGenerationPreset === null) return []
  return papelizAssistantImageAspectRatioDisplays.flatMap((imageAspectRatioDisplay) => {
    const imageAspectRatioChoice = imageGenerationPreset.imageAspectRatioChoices.find(
      (presetImageAspectRatioChoice) => presetImageAspectRatioChoice.imageAspectRatio === imageAspectRatioDisplay.imageAspectRatio,
    )
    if (imageAspectRatioChoice === undefined) return []
    return imageAspectRatioChoice.imageModelNamePattern === undefined || imageAspectRatioChoice.imageModelNamePattern.test(imageModelName) ? [imageAspectRatioChoice] : []
  })
}

// The shape a picture is made in: the one chosen when the model makes it, else 1:1, else the model's
// first; null when the model offers no shape and no size is sent.
export function resolvePapelizAssistantImageAspectRatioChoice(
  imageGenerationPreset: PapelizAssistantImageGenerationPreset | null,
  imageModelName: string,
  storedImageShapeText: string | null,
): PapelizAssistantImageAspectRatioChoice | null {
  const offeredImageAspectRatioChoices = listPapelizAssistantImageAspectRatioChoices(imageGenerationPreset, imageModelName)
  const chosenImageAspectRatio = readPapelizAssistantImageAspectRatio(storedImageShapeText)
  const findOfferedChoice = (imageAspectRatio: PapelizAssistantImageAspectRatio | null) =>
    offeredImageAspectRatioChoices.find((imageAspectRatioChoice) => imageAspectRatioChoice.imageAspectRatio === imageAspectRatio)
  return findOfferedChoice(chosenImageAspectRatio) ?? findOfferedChoice('1:1') ?? offeredImageAspectRatioChoices[0] ?? null
}
