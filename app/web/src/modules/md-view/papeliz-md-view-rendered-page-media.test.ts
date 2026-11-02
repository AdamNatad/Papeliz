import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { PapelizInMemoryVaultAdapter } from '../vault/papeliz-in-memory-vault-adapter'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { papelizYouTubePlayerAllowedFeatures, papelizYouTubePlayerSandbox } from './papeliz-md-view-media'
import { renderPapelizMdViewNote } from './papeliz-md-view-render-pipeline'
import { renderPapelizMdViewHastToReact } from './papeliz-md-view-rendered-page'

// The locked MD View's pictures and videos, as the page first draws them. A vault file shows as its
// placeholder until it is read, which needs a browser (papeliz-md-view-pictures-and-video.browser-test.ts).

const youTubeTestVideoId = 'aBc_12-xYz9'
const testResolveWikilinkTarget = createPapelizWikilinkTargetResolver(['README.md', 'Other note.md'])

function renderLockedNote(vaultNoteText: string, isVaultNote = true): string {
  const { noteHastRoot } = renderPapelizMdViewNote(vaultNoteText, { resolveWikilinkTarget: testResolveWikilinkTarget, fromVaultNoteRelativePath: 'README.md' })
  return renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      renderPapelizMdViewHastToReact(noteHastRoot, () => undefined, () => undefined, true, null, isVaultNote ? { fromVaultNoteRelativePath: 'README.md' } : null),
    ),
  )
}

beforeEach(() => {
  usePapelizWorkspaceStore.setState({
    openVault: { papelizVaultId: 'media-test-vault', papelizVaultDisplayName: 'Media Test', papelizVaultAdapter: new PapelizInMemoryVaultAdapter([]) },
  })
})

afterEach(() => {
  usePapelizWorkspaceStore.setState({ openVault: null })
})

describe('pictures on the locked MD View page', () => {
  it('shows P1-Workflow’s README picture inside its link', () => {
    const renderedMarkup = renderLockedNote('[![P1-Workflow: your personal knowledge base.](p1-workflow-social-preview.png)](https://papeliz.com/templates/p1-workflow/)\n\n# P1-Workflow')
    expect(renderedMarkup).toMatch(
      /^<p><a href="https:\/\/papeliz\.com\/templates\/p1-workflow\/" target="_blank" rel="noopener noreferrer"><span class="papeliz-md-view-media-waiting" role="img" aria-label="Picture: P1-Workflow: your personal knowledge base\."><\/span><\/a><\/p>/,
    )
    expect(renderedMarkup).not.toContain('![')
  })

  it('shows a web picture without a referrer, and an `![[embed]]` of a vault picture', () => {
    expect(renderLockedNote('![Chart](https://pictures.example.com/chart.png "Quarter 3")')).toContain(
      '<img class="papeliz-md-view-picture" src="https://pictures.example.com/chart.png" alt="Chart" title="Quarter 3" loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable="false"/>',
    )
    expect(renderLockedNote('![[plan.png|The plan]]')).toContain('<span class="papeliz-md-view-media-waiting" role="img" aria-label="Picture: The plan"></span>')
    expect(renderLockedNote('![[plan.png|320]]')).toContain('aria-label="Picture: plan.png"')
    // Any other embed stays a link to its note.
    expect(renderLockedNote('![[Other note]]')).toContain('class="papeliz-md-view-wikilink"')
  })

  it('never loads a javascript:, data:, http: or host-relative picture', () => {
    const renderedMarkup = renderLockedNote(
      [
        '![one](javascript:alert(document.domain))',
        '![two](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+)',
        '![three](http://plain.example.net/dot.gif)',
        '![four](//evil.example/dot.gif)',
      ].join('\n\n'),
    )
    expect(renderedMarkup).not.toMatch(/<img|<video|<iframe|javascript:|data:|plain\.example|evil\.example/)
    expect(renderedMarkup).toContain('Picture: one')
    expect(renderedMarkup).toContain('Picture: three')
    // An embed named like a scheme is no picture: it stays a link that opens nothing outside.
    const schemeEmbedMarkup = renderLockedNote('![[javascript:alert(1).png]]')
    expect(schemeEmbedMarkup).toContain('href="#"')
    expect(schemeEmbedMarkup).not.toMatch(/<img|src=|href="javascript/)
  })

  it('drops raw HTML pictures, videos, frames and handlers before anything draws', () => {
    const renderedMarkup = renderLockedNote(
      [
        '<img src="https://evil.example/a.png" onerror="alert(1)">',
        '<video src="https://evil.example/a.mp4" autoplay></video>',
        '<iframe src="https://evil.example/"></iframe>',
        '<iframe src="https://www.youtube-nocookie.com/embed/aBc_12-xYz9"></iframe>',
        '<object data="https://evil.example/a.swf"></object>',
      ].join('\n\n'),
    )
    expect(renderedMarkup).not.toMatch(/<img|<video|<iframe|<object|onerror|autoplay|evil\.example|youtube/)
  })

  it('keeps the old rules where a note isn’t the vault’s: only web pictures show', () => {
    expect(renderLockedNote('![Plan](plan.png)', false)).toBe('<p><span class="papeliz-md-view-image-placeholder">Image: Plan</span></p>')
    expect(renderLockedNote(`[Tour](https://youtu.be/${youTubeTestVideoId})`, false)).toBe(
      `<p><a href="https://youtu.be/${youTubeTestVideoId}" target="_blank" rel="noopener noreferrer">Tour</a></p>`,
    )
  })
})

describe('videos on the locked MD View page', () => {
  it('plays a web video only from its controls', () => {
    const renderedMarkup = renderLockedNote('![Demo](https://cdn.example.com/clips/demo.webm)')
    expect(renderedMarkup).toContain('<video class="papeliz-md-view-video" src="https://cdn.example.com/clips/demo.webm" title="Demo" aria-label="Demo" controls="" preload="metadata" playsInline="">')
    expect(renderedMarkup).not.toMatch(/autoplay|loop|muted/i)
  })

  it('waits to read a vault video like a vault picture', () => {
    expect(renderLockedNote('![[Clips/demo.mp4]]')).toContain('<span class="papeliz-md-view-media-waiting" role="img" aria-label="Video: demo.mp4"></span>')
  })

  it('draws a YouTube link alone on its line as a poster, with nothing loaded from YouTube', () => {
    for (const [youTubeParagraph, posterTitle] of [
      [`[Garden tour](https://www.youtube.com/watch?v=${youTubeTestVideoId}&t=30&si=tracking)`, 'Garden tour'],
      [`https://youtu.be/${youTubeTestVideoId}`, 'YouTube video'],
      [`![Garden tour](https://youtu.be/${youTubeTestVideoId})`, 'Garden tour'],
    ] as const) {
      const renderedMarkup = renderLockedNote(youTubeParagraph)
      expect(renderedMarkup, youTubeParagraph).toContain(`<span class="papeliz-md-view-youtube" data-papeliz-youtube-video-id="${youTubeTestVideoId}">`)
      expect(renderedMarkup).toContain(`aria-label="Play “${posterTitle}” from YouTube"`)
      expect(renderedMarkup).toContain(`<a class="papeliz-md-view-youtube-open-link" href="https://www.youtube.com/watch?v=${youTubeTestVideoId}" target="_blank" rel="noopener noreferrer">Open on YouTube</a>`)
      // No frame, no thumbnail and no YouTube address but the plain link to the video's page.
      expect(renderedMarkup).not.toMatch(/<iframe|<img|ytimg|youtube-nocookie|si=tracking|t=30/)
    }
  })

  it('leaves a YouTube link inside a sentence as a link', () => {
    expect(renderLockedNote(`Watch [the tour](https://youtu.be/${youTubeTestVideoId}) first.`)).toBe(
      `<p>Watch <a href="https://youtu.be/${youTubeTestVideoId}" target="_blank" rel="noopener noreferrer">the tour</a> first.</p>`,
    )
  })

  it('lets the YouTube player run only its own scripts in its own origin', () => {
    expect(papelizYouTubePlayerSandbox).toBe('allow-scripts allow-same-origin')
    expect(papelizYouTubePlayerAllowedFeatures).toBe('autoplay; encrypted-media; fullscreen; picture-in-picture')
  })
})
