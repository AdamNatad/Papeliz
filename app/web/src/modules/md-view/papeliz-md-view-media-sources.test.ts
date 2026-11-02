import { describe, expect, it } from 'vitest'
import {
  buildPapelizYouTubeNoCookieEmbedUrl,
  buildPapelizYouTubeWatchUrl,
  getPapelizMdViewVaultMediaType,
  readPapelizMdViewMediaSource,
  readPapelizMdViewVaultMediaSource,
  readPapelizMdViewWikilinkEmbedLabel,
  readPapelizYouTubeVideoId,
} from './papeliz-md-view-media-sources'

const youTubeTestVideoId = 'aBc_12-xYz9'

describe('YouTube addresses', () => {
  it('reads the video id from the watch, short, shorts, embed and live forms, and nothing else', () => {
    for (const youTubeAddress of [
      `https://www.youtube.com/watch?v=${youTubeTestVideoId}`,
      `https://youtube.com/watch?v=${youTubeTestVideoId}&t=90s&list=PL123&si=tracking`,
      `https://m.youtube.com/watch?feature=share&v=${youTubeTestVideoId}`,
      `http://www.youtube.com/watch?v=${youTubeTestVideoId}`,
      `https://youtu.be/${youTubeTestVideoId}`,
      `https://youtu.be/${youTubeTestVideoId}?t=12`,
      `https://www.youtube.com/shorts/${youTubeTestVideoId}`,
      `https://www.youtube.com/embed/${youTubeTestVideoId}`,
      `https://www.youtube.com/live/${youTubeTestVideoId}`,
      `  https://WWW.YouTube.com/watch?v=${youTubeTestVideoId}  `,
    ]) {
      expect(readPapelizYouTubeVideoId(youTubeAddress), youTubeAddress).toBe(youTubeTestVideoId)
    }
  })

  it('refuses look-alike hosts, other schemes, bad ids and other YouTube pages', () => {
    for (const notYouTubeAddress of [
      `https://youtube.com.evil.example/watch?v=${youTubeTestVideoId}`,
      `https://evil.example/youtu.be/${youTubeTestVideoId}`,
      `https://notyoutube.com/watch?v=${youTubeTestVideoId}`,
      `https://www.youtube.com.evil.example/embed/${youTubeTestVideoId}`,
      `https://user:secret@www.youtube.com/watch?v=${youTubeTestVideoId}`,
      `https://www.youtube.com:8443/watch?v=${youTubeTestVideoId}`,
      `javascript:alert(1)//https://youtu.be/${youTubeTestVideoId}`,
      `ftp://youtu.be/${youTubeTestVideoId}`,
      'https://www.youtube.com/watch?v=tooShort',
      `https://www.youtube.com/watch?v=${youTubeTestVideoId}x`,
      'https://youtu.be/aBc_12-xYz"',
      'https://youtu.be/%22onload%3D1',
      `https://youtu.be/${youTubeTestVideoId}/more`,
      `https://www.youtube.com/channel/${youTubeTestVideoId}`,
      `https://www.youtube.com/embed/${youTubeTestVideoId}/../../evil`,
      'https://www.youtube.com/',
      'not an address',
    ]) {
      expect(readPapelizYouTubeVideoId(notYouTubeAddress), notYouTubeAddress).toBeNull()
    }
  })

  it('builds only the privacy-enhanced player address, and the watch page, for a checked id', () => {
    expect(buildPapelizYouTubeNoCookieEmbedUrl(youTubeTestVideoId)).toBe(`https://www.youtube-nocookie.com/embed/${youTubeTestVideoId}?autoplay=1`)
    expect(buildPapelizYouTubeWatchUrl(youTubeTestVideoId)).toBe(`https://www.youtube.com/watch?v=${youTubeTestVideoId}`)
    expect(() => buildPapelizYouTubeNoCookieEmbedUrl('../../evil?x')).toThrow()
    expect(() => buildPapelizYouTubeWatchUrl('"><script>')).toThrow()
  })
})

describe('what a picture address points to', () => {
  it('takes https pictures and videos from the web, a picture without an extension too', () => {
    expect(readPapelizMdViewMediaSource('https://pictures.example.com/chart.png')).toEqual({ mediaSourceKind: 'web-picture', webMediaUrl: 'https://pictures.example.com/chart.png' })
    expect(readPapelizMdViewMediaSource('https://img.shields.io/badge/build-passing-green')).toMatchObject({ mediaSourceKind: 'web-picture' })
    expect(readPapelizMdViewMediaSource('https://cdn.example.com/clips/demo.MP4?quality=high')).toEqual({
      mediaSourceKind: 'web-video',
      webMediaUrl: 'https://cdn.example.com/clips/demo.MP4?quality=high',
    })
    expect(readPapelizMdViewMediaSource('<https://cdn.example.com/a b.webm>')).toMatchObject({ mediaSourceKind: 'web-video' })
    expect(readPapelizMdViewMediaSource(`https://youtu.be/${youTubeTestVideoId}`)).toEqual({ mediaSourceKind: 'youtube-video', youTubeVideoId: youTubeTestVideoId })
  })

  it('never loads another scheme, a host-relative address, a drive path or a web address with a sign-in', () => {
    for (const refusedAddress of [
      'javascript:alert(document.domain)',
      'JaVaScRiPt:alert(1)',
      ' javascript:alert(1)',
      'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+',
      'data:text/html,<script>alert(1)</script>',
      'blob:https://papeliz.com/6c2b1e9e-0000-4000-8000-000000000000',
      'http://pictures.example.com/chart.png',
      'file:///C:/Users/someone/picture.png',
      'vbscript:msgbox(1)',
      '//evil.example/picture.png',
      '\\\\server\\share\\picture.png',
      'C:\\pictures\\plan.png',
      'https://user:secret@pictures.example.com/chart.png',
      '',
      '   ',
    ]) {
      expect(readPapelizMdViewMediaSource(refusedAddress), refusedAddress).toEqual({ mediaSourceKind: 'not-shown' })
    }
  })

  it('takes a scheme-less address as a vault file, decoded, without its query or fragment', () => {
    expect(readPapelizMdViewMediaSource('pictures/plan.png')).toEqual({ mediaSourceKind: 'vault-picture', vaultMediaReference: 'pictures/plan.png' })
    expect(readPapelizMdViewMediaSource('my%20plan.PNG')).toEqual({ mediaSourceKind: 'vault-picture', vaultMediaReference: 'my plan.PNG' })
    expect(readPapelizMdViewMediaSource('<my plan.png>')).toEqual({ mediaSourceKind: 'vault-picture', vaultMediaReference: 'my plan.png' })
    expect(readPapelizMdViewMediaSource('../logo.svg#icon')).toEqual({ mediaSourceKind: 'vault-picture', vaultMediaReference: '../logo.svg' })
    expect(readPapelizMdViewMediaSource('100%.png')).toEqual({ mediaSourceKind: 'vault-picture', vaultMediaReference: '100%.png' })
    expect(readPapelizMdViewMediaSource('clips/demo.webm?t=3')).toEqual({ mediaSourceKind: 'vault-video', vaultMediaReference: 'clips/demo.webm' })
    expect(readPapelizMdViewMediaSource('brief.pdf')).toEqual({ mediaSourceKind: 'not-shown' })
    expect(readPapelizMdViewMediaSource('clips/demo.mov')).toEqual({ mediaSourceKind: 'not-shown' })
  })

  it('types a vault file by its extension', () => {
    expect(getPapelizMdViewVaultMediaType('a/plan.PNG')).toBe('image/png')
    expect(getPapelizMdViewVaultMediaType('logo.svg')).toBe('image/svg+xml')
    expect(getPapelizMdViewVaultMediaType('clip.mp4')).toBe('video/mp4')
    expect(getPapelizMdViewVaultMediaType('clip.webm')).toBe('video/webm')
    expect(getPapelizMdViewVaultMediaType('page.html')).toBeNull()
    expect(getPapelizMdViewVaultMediaType('plan.png.html')).toBeNull()
  })
})

describe('`![[embed]]` targets and labels', () => {
  it('embeds vault pictures and videos only', () => {
    expect(readPapelizMdViewVaultMediaSource('plan.png')).toEqual({ mediaSourceKind: 'vault-picture', vaultMediaReference: 'plan.png' })
    expect(readPapelizMdViewVaultMediaSource('Clips/demo.mp4')).toEqual({ mediaSourceKind: 'vault-video', vaultMediaReference: 'Clips/demo.mp4' })
    expect(readPapelizMdViewVaultMediaSource('Other note')).toEqual({ mediaSourceKind: 'not-shown' })
    expect(readPapelizMdViewVaultMediaSource('javascript:alert(1).png')).toEqual({ mediaSourceKind: 'not-shown' })
  })

  it('reads a size, or else a description, after the `|`', () => {
    expect(readPapelizMdViewWikilinkEmbedLabel(null)).toEqual({ mediaAlternativeText: null, mediaWidthPixels: null, mediaHeightPixels: null })
    expect(readPapelizMdViewWikilinkEmbedLabel('300')).toEqual({ mediaAlternativeText: null, mediaWidthPixels: 300, mediaHeightPixels: null })
    expect(readPapelizMdViewWikilinkEmbedLabel('300x200')).toEqual({ mediaAlternativeText: null, mediaWidthPixels: 300, mediaHeightPixels: 200 })
    expect(readPapelizMdViewWikilinkEmbedLabel('The garden plan')).toEqual({ mediaAlternativeText: 'The garden plan', mediaWidthPixels: null, mediaHeightPixels: null })
    expect(readPapelizMdViewWikilinkEmbedLabel('99999')).toMatchObject({ mediaAlternativeText: '99999', mediaWidthPixels: null })
  })
})
