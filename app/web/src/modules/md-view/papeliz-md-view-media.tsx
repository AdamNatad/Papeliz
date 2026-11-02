import { Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import './papeliz-md-view-media.css'
import { buildPapelizYouTubeNoCookieEmbedUrl, buildPapelizYouTubeWatchUrl, type PapelizMdViewMediaSource } from './papeliz-md-view-media-sources'
import { holdPapelizMdViewVaultMediaUrl, papelizMdViewVaultMediaRetryAfterMilliseconds, readPapelizMdViewOpenVaultAdapter } from './papeliz-md-view-vault-media-files'

// A note's pictures and videos, the same in both MD Views: the locked page draws these components
// in place of the sanitized tree's pictures, and the editable view mounts them in its widgets.
//
// - A web picture or video loads from its https address, a picture without a referrer.
// - A vault file is read through the vault adapter once it is near the screen, and shown from a URL
//   held only while it shows (papeliz-md-view-vault-media-files.ts).
// - A video never plays by itself; its controls start it.
// - A YouTube video is a poster drawn here, with nothing loaded from YouTube. Pressing play loads
//   YouTube's privacy-enhanced player for its video id, in a frame that may run its own scripts in its
//   own origin and nothing more.

export interface PapelizMdViewMediaProps {
  mdViewMediaSource: PapelizMdViewMediaSource
  // The picture's description (`![description](…)`), or a YouTube link's text.
  mediaAlternativeText: string
  mediaTitle: string | null
  mediaWidthPixels: number | null
  mediaHeightPixels: number | null
  // The note the address starts from, for a file in the vault.
  fromVaultNoteRelativePath: string | null
  // A picture loaded or failed, a video learned its size: the editable view measures its lines again.
  onMediaSizeChange?: () => void
}

function PapelizMdViewMediaPlaceholder({ placeholderText, placeholderTitle }: { placeholderText: string; placeholderTitle?: string }) {
  return (
    <span className="papeliz-md-view-media-placeholder" title={placeholderTitle}>
      {placeholderText}
    </span>
  )
}

interface PapelizMdViewShownPictureProps {
  pictureUrl: string
  pictureAlternativeText: string
  pictureTitle: string | null
  pictureWidthPixels: number | null
  pictureHeightPixels: number | null
  onMediaSizeChange?: () => void
}

function PapelizMdViewShownPicture({ pictureUrl, pictureAlternativeText, pictureTitle, pictureWidthPixels, pictureHeightPixels, onMediaSizeChange }: PapelizMdViewShownPictureProps) {
  const [hasPictureFailed, setHasPictureFailed] = useState(false)
  if (hasPictureFailed) return <PapelizMdViewMediaPlaceholder placeholderText={`Picture not shown: ${pictureAlternativeText || 'untitled'}`} />
  return (
    <img
      className="papeliz-md-view-picture"
      src={pictureUrl}
      alt={pictureAlternativeText}
      title={pictureTitle ?? undefined}
      width={pictureWidthPixels ?? undefined}
      height={pictureHeightPixels ?? undefined}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      draggable={false}
      onLoad={onMediaSizeChange}
      onError={() => {
        setHasPictureFailed(true)
        onMediaSizeChange?.()
      }}
    />
  )
}

interface PapelizMdViewShownVideoProps {
  videoUrl: string
  videoAlternativeText: string
  videoTitle: string | null
  videoWidthPixels: number | null
  onMediaSizeChange?: () => void
}

function PapelizMdViewShownVideo({ videoUrl, videoAlternativeText, videoTitle, videoWidthPixels, onMediaSizeChange }: PapelizMdViewShownVideoProps) {
  const [hasVideoFailed, setHasVideoFailed] = useState(false)
  if (hasVideoFailed) return <PapelizMdViewMediaPlaceholder placeholderText={`Video not shown: ${videoAlternativeText || 'untitled'}`} />
  return (
    <video
      className="papeliz-md-view-video"
      src={videoUrl}
      title={videoTitle ?? (videoAlternativeText || undefined)}
      aria-label={videoAlternativeText || 'Video'}
      width={videoWidthPixels ?? undefined}
      controls
      preload="metadata"
      playsInline
      onLoadedMetadata={onMediaSizeChange}
      onError={() => {
        setHasVideoFailed(true)
        onMediaSizeChange?.()
      }}
    />
  )
}

// The note scrolls inside its own pane, which would clip a picture lower down out of sight however
// far ahead the window looks; looking ahead inside the pane reads it before it scrolls in.
function findScrollingAncestorElement(mediaElement: Element): Element | null {
  for (let ancestorElement = mediaElement.parentElement; ancestorElement !== null; ancestorElement = ancestorElement.parentElement) {
    if (/(auto|scroll|overlay)/.test(getComputedStyle(ancestorElement).overflowY)) return ancestorElement
  }
  return null
}

type PapelizMdViewVaultMediaUrlState = { vaultMediaUrlStatus: 'waiting' } | { vaultMediaUrlStatus: 'shown'; vaultMediaUrl: string } | { vaultMediaUrlStatus: 'missing' }

// A vault file's URL, read once its placeholder is near the screen and held until the media goes.
// One that isn't found looks once more, after the vault's list is read again.
function PapelizMdViewVaultMedia({ mediaKind, ...mediaProps }: PapelizMdViewMediaProps & { mediaKind: 'picture' | 'video'; vaultMediaReference: string }) {
  const { vaultMediaReference, fromVaultNoteRelativePath, onMediaSizeChange } = mediaProps
  const [vaultAdapter] = useState(readPapelizMdViewOpenVaultAdapter)
  const [vaultMediaUrlState, setVaultMediaUrlState] = useState<PapelizMdViewVaultMediaUrlState>({ vaultMediaUrlStatus: 'waiting' })
  const waitingMediaElementRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (vaultAdapter === null) return
    let isVaultMediaEffectOver = false
    let releaseHeldVaultMediaUrl: (() => void) | null = null
    let vaultMediaRetryTimer: ReturnType<typeof setTimeout> | null = null
    let nearScreenObserver: IntersectionObserver | null = null

    const holdVaultMediaUrl = (isRetry: boolean) => {
      const vaultMediaUrlHold = holdPapelizMdViewVaultMediaUrl(vaultAdapter, vaultMediaReference, fromVaultNoteRelativePath)
      releaseHeldVaultMediaUrl = vaultMediaUrlHold.releaseVaultMediaUrl
      void vaultMediaUrlHold.vaultMediaUrlPromise.then((vaultMediaUrl) => {
        if (isVaultMediaEffectOver) return
        if (vaultMediaUrl !== null) {
          setVaultMediaUrlState({ vaultMediaUrlStatus: 'shown', vaultMediaUrl })
          return
        }
        setVaultMediaUrlState({ vaultMediaUrlStatus: 'missing' })
        onMediaSizeChange?.()
        if (isRetry) return
        vaultMediaRetryTimer = setTimeout(() => {
          vaultMediaUrlHold.releaseVaultMediaUrl()
          holdVaultMediaUrl(true)
        }, papelizMdViewVaultMediaRetryAfterMilliseconds)
      })
    }

    const waitingMediaElement = waitingMediaElementRef.current
    if (typeof IntersectionObserver === 'undefined' || waitingMediaElement === null) holdVaultMediaUrl(false)
    else {
      nearScreenObserver = new IntersectionObserver(
        (observedEntries) => {
          if (!observedEntries.some((observedEntry) => observedEntry.isIntersecting)) return
          nearScreenObserver?.disconnect()
          nearScreenObserver = null
          holdVaultMediaUrl(false)
        },
        { root: findScrollingAncestorElement(waitingMediaElement), rootMargin: '800px 0px' },
      )
      nearScreenObserver.observe(waitingMediaElement)
    }

    return () => {
      isVaultMediaEffectOver = true
      nearScreenObserver?.disconnect()
      if (vaultMediaRetryTimer !== null) clearTimeout(vaultMediaRetryTimer)
      releaseHeldVaultMediaUrl?.()
    }
  }, [vaultAdapter, vaultMediaReference, fromVaultNoteRelativePath, onMediaSizeChange])

  const mediaKindWord = mediaKind === 'picture' ? 'Picture' : 'Video'
  if (vaultAdapter === null || vaultMediaUrlState.vaultMediaUrlStatus === 'missing') {
    return <PapelizMdViewMediaPlaceholder placeholderText={`${mediaKindWord} not found: ${vaultMediaReference}`} placeholderTitle="No file with this name in the vault" />
  }
  if (vaultMediaUrlState.vaultMediaUrlStatus === 'waiting') {
    return <span ref={waitingMediaElementRef} className="papeliz-md-view-media-waiting" role="img" aria-label={`${mediaKindWord}: ${mediaProps.mediaAlternativeText || vaultMediaReference}`} />
  }
  return mediaKind === 'picture' ? (
    <PapelizMdViewShownPicture
      pictureUrl={vaultMediaUrlState.vaultMediaUrl}
      pictureAlternativeText={mediaProps.mediaAlternativeText}
      pictureTitle={mediaProps.mediaTitle}
      pictureWidthPixels={mediaProps.mediaWidthPixels}
      pictureHeightPixels={mediaProps.mediaHeightPixels}
      onMediaSizeChange={onMediaSizeChange}
    />
  ) : (
    <PapelizMdViewShownVideo
      videoUrl={vaultMediaUrlState.vaultMediaUrl}
      videoAlternativeText={mediaProps.mediaAlternativeText}
      videoTitle={mediaProps.mediaTitle}
      videoWidthPixels={mediaProps.mediaWidthPixels}
      onMediaSizeChange={onMediaSizeChange}
    />
  )
}

// The frame's permissions: YouTube's player runs its own scripts in its own origin (it needs both to
// play), and may autoplay, decrypt and go full screen. No popups, forms, top navigation or downloads.
export const papelizYouTubePlayerSandbox = 'allow-scripts allow-same-origin'
export const papelizYouTubePlayerAllowedFeatures = 'autoplay; encrypted-media; fullscreen; picture-in-picture'

function PapelizMdViewYouTubeVideo({ youTubeVideoId, youTubeVideoTitle, onMediaSizeChange }: { youTubeVideoId: string; youTubeVideoTitle: string; onMediaSizeChange?: () => void }) {
  const [isYouTubePlayerLoaded, setIsYouTubePlayerLoaded] = useState(false)
  return (
    <span className="papeliz-md-view-youtube" data-papeliz-youtube-video-id={youTubeVideoId}>
      {isYouTubePlayerLoaded ? (
        <iframe
          className="papeliz-md-view-youtube-player"
          src={buildPapelizYouTubeNoCookieEmbedUrl(youTubeVideoId)}
          title={`${youTubeVideoTitle} (YouTube)`}
          sandbox={papelizYouTubePlayerSandbox}
          allow={papelizYouTubePlayerAllowedFeatures}
          allowFullScreen
          // YouTube's player refuses to play without knowing which site embeds it; it gets only the
          // app's address (papeliz.com), never the note's.
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={onMediaSizeChange}
        />
      ) : (
        <>
          <button
            type="button"
            className="papeliz-md-view-youtube-poster"
            aria-label={`Play “${youTubeVideoTitle}” from YouTube`}
            onClick={(playClickEvent) => {
              // Inside a link, play doesn't also follow the link.
              playClickEvent.preventDefault()
              setIsYouTubePlayerLoaded(true)
            }}
          >
            <span className="papeliz-md-view-youtube-play-circle">
              <Play fill="currentColor" aria-hidden="true" />
            </span>
            <span className="papeliz-md-view-youtube-title">{youTubeVideoTitle}</span>
            <span className="papeliz-md-view-youtube-note">YouTube loads when you press play</span>
          </button>
          <a className="papeliz-md-view-youtube-open-link" href={buildPapelizYouTubeWatchUrl(youTubeVideoId)} target="_blank" rel="noopener noreferrer">
            Open on YouTube
          </a>
        </>
      )}
    </span>
  )
}

// One picture, video or YouTube video, by what its address points to.
export function PapelizMdViewMedia(mediaProps: PapelizMdViewMediaProps) {
  const { mdViewMediaSource, mediaAlternativeText } = mediaProps
  switch (mdViewMediaSource.mediaSourceKind) {
    case 'web-picture':
      return (
        <PapelizMdViewShownPicture
          key={mdViewMediaSource.webMediaUrl}
          pictureUrl={mdViewMediaSource.webMediaUrl}
          pictureAlternativeText={mediaAlternativeText}
          pictureTitle={mediaProps.mediaTitle}
          pictureWidthPixels={mediaProps.mediaWidthPixels}
          pictureHeightPixels={mediaProps.mediaHeightPixels}
          onMediaSizeChange={mediaProps.onMediaSizeChange}
        />
      )
    case 'web-video':
      return (
        <PapelizMdViewShownVideo
          key={mdViewMediaSource.webMediaUrl}
          videoUrl={mdViewMediaSource.webMediaUrl}
          videoAlternativeText={mediaAlternativeText}
          videoTitle={mediaProps.mediaTitle}
          videoWidthPixels={mediaProps.mediaWidthPixels}
          onMediaSizeChange={mediaProps.onMediaSizeChange}
        />
      )
    case 'vault-picture':
    case 'vault-video':
      return (
        <PapelizMdViewVaultMedia
          key={`${mdViewMediaSource.vaultMediaReference}\n${mediaProps.fromVaultNoteRelativePath ?? ''}`}
          {...mediaProps}
          mediaKind={mdViewMediaSource.mediaSourceKind === 'vault-picture' ? 'picture' : 'video'}
          vaultMediaReference={mdViewMediaSource.vaultMediaReference}
        />
      )
    case 'youtube-video':
      return (
        <PapelizMdViewYouTubeVideo
          key={mdViewMediaSource.youTubeVideoId}
          youTubeVideoId={mdViewMediaSource.youTubeVideoId}
          youTubeVideoTitle={mediaAlternativeText || 'YouTube video'}
          onMediaSizeChange={mediaProps.onMediaSizeChange}
        />
      )
    case 'not-shown':
      return (
        <PapelizMdViewMediaPlaceholder
          placeholderText={`Picture: ${mediaAlternativeText || 'untitled'}`}
          placeholderTitle="Only https pictures and pictures in the vault are shown"
        />
      )
  }
}
