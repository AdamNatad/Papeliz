import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  findPapelizAssistantImageAspectRatioDisplay,
  listPapelizAssistantImageAspectRatioChoices,
  papelizAssistantImageAspectRatioDisplays,
  readPapelizAssistantImageAspectRatio,
  resolvePapelizAssistantImageAspectRatioChoice,
} from './papeliz-assistant-image-aspect-ratios'
import { findPapelizAssistantImageGenerationPreset } from './papeliz-assistant-media-provider-presets'

// The Imagine menu's aspect ratios: which each provider's picture models make and what is sent for
// each, the shape a picture is made in, and the shapes chosen before the menu named ratios.

function listOfferedShapesAndSizes(papelizAssistantProviderId: string, imageModelName: string): Array<[string, string | null]> {
  return listPapelizAssistantImageAspectRatioChoices(findPapelizAssistantImageGenerationPreset(papelizAssistantProviderId), imageModelName).map((imageAspectRatioChoice) => [
    imageAspectRatioChoice.imageAspectRatio,
    imageAspectRatioChoice.imageSizeValue,
  ])
}

describe('the aspect ratios each provider’s picture models make', () => {
  it('lists the menu as Auto, 1:1, 2:3, 3:2, 16:9 and 9:16', () => {
    expect(papelizAssistantImageAspectRatioDisplays.map((imageAspectRatioDisplay) => imageAspectRatioDisplay.imageAspectRatioLabel)).toEqual(['Auto', '1:1', '2:3', '3:2', '16:9', '9:16'])
  })

  it('gives the Meta Model API every ratio, sent as a width x height it reads as the shape', () => {
    expect(listOfferedShapesAndSizes('meta-model-api', 'muse-image-1.0')).toEqual([
      ['auto', 'auto'],
      ['1:1', '1024x1024'],
      ['2:3', '1024x1536'],
      ['3:2', '1536x1024'],
      ['16:9', '1536x864'],
      ['9:16', '864x1536'],
    ])
  })

  it('gives 16:9 and 9:16 only to OpenAI models that take any size', () => {
    expect(listOfferedShapesAndSizes('openai', 'gpt-image-2')).toEqual([
      ['auto', 'auto'],
      ['1:1', '1024x1024'],
      ['2:3', '1024x1536'],
      ['3:2', '1536x1024'],
      ['16:9', '1536x864'],
      ['9:16', '864x1536'],
    ])
    expect(listOfferedShapesAndSizes('openai', 'gpt-image-2.5-flare').map(([imageAspectRatio]) => imageAspectRatio)).toContain('16:9')
    expect(listOfferedShapesAndSizes('openai', 'chatgpt-image-latest')).toEqual([
      ['auto', 'auto'],
      ['1:1', '1024x1024'],
      ['2:3', '1024x1536'],
      ['3:2', '1536x1024'],
    ])
  })

  it('sends OpenRouter the ratio itself, and Together a width and height for each, with no Auto', () => {
    expect(findPapelizAssistantImageGenerationPreset('openrouter')?.imageSizeFieldStyle).toBe('aspect-ratio')
    expect(listOfferedShapesAndSizes('openrouter', 'black-forest-labs/flux.2-pro')).toEqual([
      ['auto', 'auto'],
      ['1:1', '1:1'],
      ['2:3', '2:3'],
      ['3:2', '3:2'],
      ['16:9', '16:9'],
      ['9:16', '9:16'],
    ])
    expect(findPapelizAssistantImageGenerationPreset('together')?.imageSizeFieldStyle).toBe('width-and-height')
    expect(listOfferedShapesAndSizes('together', 'black-forest-labs/FLUX.2-pro')).toEqual([
      ['1:1', '1024x1024'],
      ['2:3', '832x1248'],
      ['3:2', '1248x832'],
      ['16:9', '1280x720'],
      ['9:16', '720x1280'],
    ])
  })

  it('offers Google Gemini no shape, and a typed Custom model the standard three with Auto sending none', () => {
    expect(listOfferedShapesAndSizes('google-gemini', 'gemini-2.5-flash-image')).toEqual([])
    expect(listOfferedShapesAndSizes('custom', 'my-image-model')).toEqual([
      ['auto', null],
      ['1:1', '1024x1024'],
      ['2:3', '1024x1536'],
      ['3:2', '1536x1024'],
    ])
  })

  it('makes every size it sends in its true ratio', () => {
    for (const papelizAssistantProviderId of ['meta-model-api', 'openai', 'together', 'custom']) {
      for (const imageAspectRatioChoice of findPapelizAssistantImageGenerationPreset(papelizAssistantProviderId)?.imageAspectRatioChoices ?? []) {
        const imageSizeMatch = /^(\d+)x(\d+)$/.exec(imageAspectRatioChoice.imageSizeValue ?? '')
        if (imageSizeMatch === null) continue
        const [ratioWidth, ratioHeight] = imageAspectRatioChoice.imageAspectRatio.split(':').map(Number)
        expect(Number(imageSizeMatch[1]) * ratioHeight!).toBe(Number(imageSizeMatch[2]) * ratioWidth!)
      }
    }
  })
})

describe('the shape a picture is made in', () => {
  const metaPreset = findPapelizAssistantImageGenerationPreset('meta-model-api')
  const openAiPreset = findPapelizAssistantImageGenerationPreset('openai')

  it('is the chosen ratio when the model makes it, else 1:1', () => {
    expect(resolvePapelizAssistantImageAspectRatioChoice(metaPreset, 'muse-image-1.0', null)).toEqual({ imageAspectRatio: '1:1', imageSizeValue: '1024x1024' })
    expect(resolvePapelizAssistantImageAspectRatioChoice(metaPreset, 'muse-image-1.0', '16:9')).toEqual({ imageAspectRatio: '16:9', imageSizeValue: '1536x864' })
    expect(resolvePapelizAssistantImageAspectRatioChoice(openAiPreset, 'chatgpt-image-latest', '16:9')).toEqual({ imageAspectRatio: '1:1', imageSizeValue: '1024x1024' })
    expect(resolvePapelizAssistantImageAspectRatioChoice(findPapelizAssistantImageGenerationPreset('together'), 'black-forest-labs/FLUX.2-pro', 'auto')?.imageAspectRatio).toBe('1:1')
  })

  it('is none, with no size sent, for a model that offers no shape', () => {
    expect(resolvePapelizAssistantImageAspectRatioChoice(findPapelizAssistantImageGenerationPreset('google-gemini'), 'gemini-2.5-flash-image', '16:9')).toBeNull()
    expect(resolvePapelizAssistantImageAspectRatioChoice(null, 'muse-image-1.0', '1:1')).toBeNull()
  })
})

describe('shapes chosen before the menu named ratios', () => {
  it('reads Square, Landscape and Portrait, and their old sizes, as 1:1, 3:2 and 2:3', () => {
    expect(['Square', 'Landscape', 'Portrait'].map(readPapelizAssistantImageAspectRatio)).toEqual(['1:1', '3:2', '2:3'])
    expect(['1024x1024', '1536x1024', '1024x1536', '1344x768', '768x1344'].map(readPapelizAssistantImageAspectRatio)).toEqual(['1:1', '3:2', '2:3', '3:2', '2:3'])
    expect(['16:9', 'Auto', ' 9:16 '].map(readPapelizAssistantImageAspectRatio)).toEqual(['16:9', 'auto', '9:16'])
    expect(['Panorama', '', null].map(readPapelizAssistantImageAspectRatio)).toEqual([null, null, null])
  })

  it('makes an old Landscape choice in 3:2', () => {
    expect(resolvePapelizAssistantImageAspectRatioChoice(findPapelizAssistantImageGenerationPreset('meta-model-api'), 'muse-image-1.0', 'Landscape')).toEqual({
      imageAspectRatio: '3:2',
      imageSizeValue: '1536x1024',
    })
  })
})

describe('each ratio’s icon', () => {
  it('draws 1:1 as lucide’s square and 16:9 as an outline 18 wide and 10.125 tall', () => {
    const readOutline = (imageAspectRatio: '1:1' | '16:9' | '9:16') =>
      /<rect[^>]*>/.exec(renderToStaticMarkup(createElement(findPapelizAssistantImageAspectRatioDisplay(imageAspectRatio).ImageAspectRatioIcon)))?.[0] ?? ''
    expect(readOutline('1:1')).toMatch(/width="18" height="18" x="3" y="3"/)
    expect(readOutline('16:9')).toMatch(/width="18" height="10.125" x="3" y="6.9375"/)
    expect(readOutline('9:16')).toMatch(/width="10.125" height="18" x="6.9375" y="3"/)
  })
})
