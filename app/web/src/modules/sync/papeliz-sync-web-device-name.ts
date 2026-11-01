import type { PapelizSyncEngine } from './papeliz-sync-engine-contract'

// The name a web device gets when it signs in through the sign-in page without one, as Devices lists
// it: "Chrome on Windows". Read from the browser's own client hints (`navigator.userAgentData`) where it
// has them, else from its user agent. Nothing readable leaves the device unnamed, and a device that
// has a name keeps it.

export interface PapelizSyncWebDeviceBrowserReading {
  userAgentData?: { brands?: readonly { brand: string }[]; platform?: string } | undefined
  userAgent?: string | undefined
}

// Client hint brands, most specific first; "Chromium" alone names a browser built on it.
const papelizSyncWebBrowserNamesByClientHintBrand: readonly (readonly [string, string])[] = [
  ['Microsoft Edge', 'Edge'],
  ['Opera', 'Opera'],
  ['Brave', 'Brave'],
  ['Google Chrome', 'Chrome'],
  ['Chromium', 'Chromium'],
]

const papelizSyncWebBrowserNamesByUserAgentPattern: readonly (readonly [RegExp, string])[] = [
  [/\bEdg(?:e|A|iOS)?\//, 'Edge'],
  [/\bOPR\/|\bOpera\b/, 'Opera'],
  [/\bSamsungBrowser\//, 'Samsung Internet'],
  [/\bFirefox\/|\bFxiOS\//, 'Firefox'],
  [/\bChrome\/|\bCriOS\//, 'Chrome'],
  [/\bVersion\/[\d.]+.*\bSafari\//, 'Safari'],
]

const papelizSyncWebPlatformNamesByClientHintPlatform: Readonly<Record<string, string>> = {
  Windows: 'Windows',
  macOS: 'macOS',
  Linux: 'Linux',
  Android: 'Android',
  'Chrome OS': 'ChromeOS',
  ChromeOS: 'ChromeOS',
  'Chromium OS': 'ChromeOS',
  iOS: 'iOS',
}

// Android before Linux, and iPhone and iPad before macOS: their user agents name both.
const papelizSyncWebPlatformNamesByUserAgentPattern: readonly (readonly [RegExp, string])[] = [
  [/\bWindows\b/, 'Windows'],
  [/\bAndroid\b/, 'Android'],
  [/\biPhone\b/, 'iPhone'],
  [/\biPad\b/, 'iPad'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bMac OS X\b|\bMacintosh\b/, 'macOS'],
  [/\bLinux\b/, 'Linux'],
]

function findPapelizSyncNameByUserAgentPattern(userAgent: string, namesByUserAgentPattern: readonly (readonly [RegExp, string])[]): string | null {
  return namesByUserAgentPattern.find(([userAgentPattern]) => userAgentPattern.test(userAgent))?.[1] ?? null
}

export function describePapelizSyncWebDeviceName(browserReading: PapelizSyncWebDeviceBrowserReading | undefined): string | null {
  const userAgent = browserReading?.userAgent ?? ''
  const clientHintBrands = browserReading?.userAgentData?.brands?.map((clientHintBrand) => clientHintBrand.brand) ?? []
  const webBrowserName =
    papelizSyncWebBrowserNamesByClientHintBrand.find(([clientHintBrand]) => clientHintBrands.includes(clientHintBrand))?.[1] ??
    findPapelizSyncNameByUserAgentPattern(userAgent, papelizSyncWebBrowserNamesByUserAgentPattern)
  const webPlatformName =
    papelizSyncWebPlatformNamesByClientHintPlatform[browserReading?.userAgentData?.platform ?? ''] ??
    findPapelizSyncNameByUserAgentPattern(userAgent, papelizSyncWebPlatformNamesByUserAgentPattern)
  if (webBrowserName !== null && webPlatformName !== null) return `${webBrowserName} on ${webPlatformName}`
  if (webBrowserName !== null) return webBrowserName
  if (webPlatformName !== null) return `Browser on ${webPlatformName}`
  return null
}

// After a sign-in through the sign-in page. True when it named this device; false when it has a name
// already, nothing readable came out, or a request failed (offline, say: the next sign-in tries again).
export async function nameThisPapelizSyncWebDeviceWhenUnnamed(papelizSyncEngine: PapelizSyncEngine, readableWebDeviceName: string | null): Promise<boolean> {
  if (readableWebDeviceName === null) return false
  const syncDevicesOutcome = await papelizSyncEngine.listSyncDevices()
  if (syncDevicesOutcome.syncActionOutcome !== 'done') return false
  const thisSyncDevice = syncDevicesOutcome.syncActionDoneValue.find((syncDevice) => syncDevice.isThisSyncDevice)
  if (thisSyncDevice === undefined || (thisSyncDevice.syncDeviceName ?? '').trim() !== '') return false
  const nameOutcome = await papelizSyncEngine.nameThisSyncDevice(readableWebDeviceName)
  return nameOutcome.syncActionOutcome === 'done'
}
