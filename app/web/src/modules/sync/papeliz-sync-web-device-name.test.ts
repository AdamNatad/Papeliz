import { describe, expect, it } from 'vitest'
import { createPapelizSyncFakeEngine } from './papeliz-sync-fake-engine'
import { describePapelizSyncWebDeviceName, nameThisPapelizSyncWebDeviceWhenUnnamed } from './papeliz-sync-web-device-name'

const chromeOnWindowsUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

async function readFakeThisDeviceName(papelizSyncFakeEngine: ReturnType<typeof createPapelizSyncFakeEngine>): Promise<string | null | undefined> {
  const syncDevicesOutcome = await papelizSyncFakeEngine.listSyncDevices()
  if (syncDevicesOutcome.syncActionOutcome !== 'done') throw new Error('The fake engine didn’t list its devices')
  return syncDevicesOutcome.syncActionDoneValue.find((syncDevice) => syncDevice.isThisSyncDevice)?.syncDeviceName
}

describe('the web device’s name', () => {
  it('names the browser and the system, from client hints where the browser has them', () => {
    expect(
      describePapelizSyncWebDeviceName({
        userAgentData: { brands: [{ brand: 'Not)A;Brand' }, { brand: 'Microsoft Edge' }, { brand: 'Chromium' }], platform: 'Windows' },
        userAgent: chromeOnWindowsUserAgent,
      }),
    ).toBe('Edge on Windows')
    expect(describePapelizSyncWebDeviceName({ userAgentData: { brands: [{ brand: 'Google Chrome' }, { brand: 'Chromium' }], platform: 'Chrome OS' } })).toBe('Chrome on ChromeOS')
    // Client hints with an unknown platform fall back to the user agent's.
    expect(describePapelizSyncWebDeviceName({ userAgentData: { brands: [{ brand: 'Google Chrome' }], platform: '' }, userAgent: chromeOnWindowsUserAgent })).toBe('Chrome on Windows')
  })

  it('reads the user agent where there are no client hints', () => {
    expect(describePapelizSyncWebDeviceName({ userAgent: chromeOnWindowsUserAgent })).toBe('Chrome on Windows')
    expect(describePapelizSyncWebDeviceName({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:132.0) Gecko/20100101 Firefox/132.0' })).toBe('Firefox on macOS')
    expect(
      describePapelizSyncWebDeviceName({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      }),
    ).toBe('Safari on iPhone')
    expect(describePapelizSyncWebDeviceName({ userAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' })).toBe(
      'Chrome on Android',
    )
  })

  it('gives no name when nothing readable comes out', () => {
    expect(describePapelizSyncWebDeviceName({ userAgent: 'Node.js/22' })).toBeNull()
    expect(describePapelizSyncWebDeviceName({})).toBeNull()
    expect(describePapelizSyncWebDeviceName(undefined)).toBeNull()
  })

  it('names this device after a sign-in only when it has no name', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'on' })
    expect(await readFakeThisDeviceName(papelizSyncFakeEngine)).toBeNull()
    expect(await nameThisPapelizSyncWebDeviceWhenUnnamed(papelizSyncFakeEngine, null)).toBe(false)
    expect(await readFakeThisDeviceName(papelizSyncFakeEngine)).toBeNull()
    expect(await nameThisPapelizSyncWebDeviceWhenUnnamed(papelizSyncFakeEngine, 'Chrome on Windows')).toBe(true)
    expect(await readFakeThisDeviceName(papelizSyncFakeEngine)).toBe('Chrome on Windows')
    // A name set already, by hand or by an earlier sign-in, stays.
    await papelizSyncFakeEngine.nameThisSyncDevice('Work laptop')
    expect(await nameThisPapelizSyncWebDeviceWhenUnnamed(papelizSyncFakeEngine, 'Firefox on Linux')).toBe(false)
    expect(await readFakeThisDeviceName(papelizSyncFakeEngine)).toBe('Work laptop')
  })

  it('does nothing when the devices can’t be read', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'signed-out' })
    expect(await nameThisPapelizSyncWebDeviceWhenUnnamed(papelizSyncFakeEngine, 'Chrome on Windows')).toBe(false)
    expect(papelizSyncFakeEngine.fakeEngineCallNames).not.toContain('nameThisSyncDevice')
  })
})
