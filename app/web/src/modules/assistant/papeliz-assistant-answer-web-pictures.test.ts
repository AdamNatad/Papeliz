import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createPapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { renderPapelizMdViewNote } from '../md-view/papeliz-md-view-render-pipeline'
import { renderPapelizMdViewHastToReact } from '../md-view/papeliz-md-view-rendered-page'
import {
  createPapelizAssistantWebPictureRevealKey,
  papelizAssistantWebPictureShowButtonAttributeName,
  placePapelizAssistantWebPicturePlaceholders,
} from './papeliz-assistant-answer-web-pictures'

const testAnswerRenderOptions = { resolveWikilinkTarget: createPapelizWikilinkTargetResolver(['Start here.md']), fromVaultNoteRelativePath: null }

// An answer as the Assistant panel draws it: MD View's pipeline, the web picture placeholders with
// the pictures revealed so far, and MD View's React rendering.
function renderTestAnswer(assistantMessageText: string, revealedWebPictureKeys: ReadonlySet<string> = new Set()) {
  const answerHastRoot = renderPapelizMdViewNote(assistantMessageText, testAnswerRenderOptions).noteHastRoot
  const answerWithWebPicturePlaceholders = placePapelizAssistantWebPicturePlaceholders(answerHastRoot, revealedWebPictureKeys)
  const renderedAnswerMarkup = renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      renderPapelizMdViewHastToReact(
        answerWithWebPicturePlaceholders.answerHastRoot,
        () => undefined,
        () => undefined,
      ),
    ),
  )
  return { ...answerWithWebPicturePlaceholders, renderedAnswerMarkup }
}

const chartPictureAddress = 'https://pictures.example.com/chart.png?quarter=3'
const chartAnswerText = `Here is the chart:\n\n![Quarterly chart](${chartPictureAddress})`

describe('web pictures in assistant answers', () => {
  it('shows a web picture as a placeholder with its alt text, its host and Show, and fetches nothing', () => {
    const { renderedAnswerMarkup, webPictureSources } = renderTestAnswer(chartAnswerText)
    expect(webPictureSources).toEqual([chartPictureAddress])
    expect(renderedAnswerMarkup).toContain('papeliz-assistant-web-picture-placeholder')
    expect(renderedAnswerMarkup).toContain('Image: Quarterly chart')
    expect(renderedAnswerMarkup).toContain('pictures.example.com')
    expect(renderedAnswerMarkup).toContain(`<button type="button"`)
    expect(renderedAnswerMarkup).toContain(`aria-label="Show the picture from pictures.example.com"`)
    expect(renderedAnswerMarkup).toContain(`${papelizAssistantWebPictureShowButtonAttributeName}="0"`)
    expect(renderedAnswerMarkup).toContain('>Show</button>')
    // No picture, preload, srcset or background: the address itself is nowhere in the page.
    expect(renderedAnswerMarkup).not.toContain('<img')
    expect(renderedAnswerMarkup).not.toContain('/chart.png')
    expect(renderedAnswerMarkup).not.toMatch(/srcset|preload|background|url\(/i)
  })

  it('holds back http: pictures too, and names an untitled one', () => {
    const { renderedAnswerMarkup } = renderTestAnswer('![](http://plain.example.net/dot.gif)')
    expect(renderedAnswerMarkup).toContain('Image: untitled')
    expect(renderedAnswerMarkup).toContain('plain.example.net')
    expect(renderedAnswerMarkup).not.toContain('<img')
    expect(renderedAnswerMarkup).not.toContain('dot.gif')
  })

  it('loads the one picture whose Show was pressed, and leaves the others waiting', () => {
    const secondPictureAddress = 'https://other.example.org/map.png'
    const twoPictureAnswerText = `${chartAnswerText}\n\nAnd a map: ![Map](${secondPictureAddress})`
    const { webPictureSources } = renderTestAnswer(twoPictureAnswerText)
    const { renderedAnswerMarkup } = renderTestAnswer(twoPictureAnswerText, new Set([createPapelizAssistantWebPictureRevealKey(0, webPictureSources[0] ?? '')]))
    expect(renderedAnswerMarkup).toContain(`<img src="${chartPictureAddress.replace('&', '&amp;')}" alt="Quarterly chart" loading="lazy" referrerPolicy="no-referrer"/>`)
    expect(renderedAnswerMarkup).not.toContain('Image: Quarterly chart')
    expect(renderedAnswerMarkup).toContain('Image: Map')
    expect(renderedAnswerMarkup).not.toContain('map.png')
  })

  it('loads a revealed http: picture over https:', () => {
    const { renderedAnswerMarkup } = renderTestAnswer('![Dot](http://plain.example.net/dot.gif)', new Set([createPapelizAssistantWebPictureRevealKey(0, 'http://plain.example.net/dot.gif')]))
    expect(renderedAnswerMarkup).toContain('<img src="https://plain.example.net/dot.gif" alt="Dot"')
  })

  it('reveals a picture only at its place and with its exact address', () => {
    const { renderedAnswerMarkup } = renderTestAnswer(chartAnswerText, new Set([createPapelizAssistantWebPictureRevealKey(0, 'https://pictures.example.com/other.png')]))
    expect(renderedAnswerMarkup).not.toContain('<img')
    expect(renderedAnswerMarkup).toContain('Image: Quarterly chart')
  })

  it('leaves a picture kept in the vault as MD View shows it, with no Show button', () => {
    const vaultPictureAnswer = renderTestAnswer('The plan: ![Floor plan](Attachments/floor%20plan.png)')
    const vaultPictureHastRoot = renderPapelizMdViewNote('The plan: ![Floor plan](Attachments/floor%20plan.png)', testAnswerRenderOptions).noteHastRoot
    expect(vaultPictureAnswer.webPictureSources).toEqual([])
    expect(vaultPictureAnswer.answerHastRoot).toEqual(vaultPictureHastRoot)
    expect(vaultPictureAnswer.renderedAnswerMarkup).toContain('<span class="papeliz-md-view-image-placeholder">Image: Floor plan</span>')
    expect(vaultPictureAnswer.renderedAnswerMarkup).not.toContain('<button')
  })

  it('keeps a web picture inside a link behind Show, and the link around it', () => {
    const { renderedAnswerMarkup } = renderTestAnswer(`[![Badge](https://badges.example.com/build.svg)](https://example.com/build)`)
    expect(renderedAnswerMarkup).toMatch(/<a href="https:\/\/example\.com\/build"[^>]*><span class="papeliz-md-view-image-placeholder papeliz-assistant-web-picture-placeholder/)
    expect(renderedAnswerMarkup).not.toContain('build.svg')
  })
})
