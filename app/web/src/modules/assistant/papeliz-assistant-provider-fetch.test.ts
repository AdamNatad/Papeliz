import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PapelizDesktopPlatform } from '../desktop/papeliz-desktop-platform-contract'
import { usePapelizDesktopPlatformStore } from '../desktop/papeliz-desktop-platform-store'
import { fetchFromPapelizProviderAddress } from './papeliz-assistant-provider-fetch'

function setTestDesktopPlatformNativeFetch(desktopNativeFetch: typeof fetch): void {
  usePapelizDesktopPlatformStore.setState({ papelizDesktopPlatform: { fetchFromDesktopNativeSide: desktopNativeFetch } as unknown as PapelizDesktopPlatform })
}

describe('a provider call', () => {
  afterEach(() => {
    usePapelizDesktopPlatformStore.setState({ papelizDesktopPlatform: null })
    vi.unstubAllGlobals()
  })

  it('keeps the page’s own fetch in the web app, for every provider', async () => {
    const pageFetch = vi.fn(async () => new Response('page'))
    vi.stubGlobal('fetch', pageFetch)
    await fetchFromPapelizProviderAddress('https://ollama.com/v1/models', { method: 'GET' })
    await fetchFromPapelizProviderAddress('https://api.openai.com/v1/models', { method: 'GET' })
    expect(pageFetch).toHaveBeenCalledTimes(2)
  })

  it('goes through the desktop app’s native side only for the providers a web page can’t reach', async () => {
    const pageFetch = vi.fn(async () => new Response('page'))
    const desktopNativeFetch = vi.fn(async () => new Response('native'))
    vi.stubGlobal('fetch', pageFetch)
    setTestDesktopPlatformNativeFetch(desktopNativeFetch)
    await fetchFromPapelizProviderAddress('https://ollama.com/v1/chat/completions', { method: 'POST' })
    await fetchFromPapelizProviderAddress('https://opencode.ai/zen/v1/chat/completions', { method: 'POST' })
    await fetchFromPapelizProviderAddress('https://opencode.ai/zen/go/v1/models', { method: 'GET' })
    expect(desktopNativeFetch).toHaveBeenCalledTimes(3)
    await fetchFromPapelizProviderAddress('https://api.openai.com/v1/models', { method: 'GET' })
    await fetchFromPapelizProviderAddress('http://ollama.com/v1/models', { method: 'GET' })
    await fetchFromPapelizProviderAddress('http://localhost:11434/v1/models', { method: 'GET' })
    expect(pageFetch).toHaveBeenCalledTimes(3)
    expect(desktopNativeFetch).toHaveBeenCalledTimes(3)
  })
})
