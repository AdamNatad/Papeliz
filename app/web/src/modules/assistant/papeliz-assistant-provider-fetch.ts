import { usePapelizDesktopPlatformStore } from '../desktop/papeliz-desktop-platform-store'
import { findPapelizAssistantProviderPreset, papelizBrowserBlockedAssistantProviderIds } from './papeliz-assistant-provider-presets'

// The hosts of the providers whose servers refuse calls from a web page (papeliz-assistant-provider-presets.ts).
const papelizBrowserBlockedProviderHosts: ReadonlySet<string> = new Set(
  papelizBrowserBlockedAssistantProviderIds.map((browserBlockedProviderId) => new URL(findPapelizAssistantProviderPreset(browserBlockedProviderId).providerBaseUrl).host),
)

function isPapelizBrowserBlockedProviderAddress(providerRequestUrl: string): boolean {
  try {
    const providerRequestAddress = new URL(providerRequestUrl)
    return providerRequestAddress.protocol === 'https:' && papelizBrowserBlockedProviderHosts.has(providerRequestAddress.host)
  } catch {
    return false
  }
}

// Every provider call's fetch. In Papeliz for Windows, a call to one of those providers goes through
// the app's native side, which no browser rule applies to and which answers only for their hosts; the
// key goes from this device straight to that provider, as with any other. Every other call, and every
// call in the web app, keeps the page's own fetch.
export function fetchFromPapelizProviderAddress(providerRequestUrl: string, providerRequestInit: RequestInit): Promise<Response> {
  const papelizDesktopPlatform = usePapelizDesktopPlatformStore.getState().papelizDesktopPlatform
  if (papelizDesktopPlatform !== null && isPapelizBrowserBlockedProviderAddress(providerRequestUrl)) {
    return papelizDesktopPlatform.fetchFromDesktopNativeSide(providerRequestUrl, providerRequestInit)
  }
  return fetch(providerRequestUrl, providerRequestInit)
}
