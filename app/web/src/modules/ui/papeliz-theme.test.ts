import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadPapelizThemePreference, papelizThemePreferenceStorageKey, pickPapelizThemePreferenceInReadOrder, readSharedPapelizThemePreference } from './papeliz-theme'

function stubSharedThemeStorage(storedSharedThemePreference: string | null | 'storage-blocked') {
  const sharedThemeStorageWrites: Array<[string, string]> = []
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (storageKey: string) => {
        if (storedSharedThemePreference === 'storage-blocked') throw new DOMException('Storage is blocked.', 'SecurityError')
        return storageKey === papelizThemePreferenceStorageKey ? storedSharedThemePreference : null
      },
      setItem: (storageKey: string, storageValue: string) => {
        sharedThemeStorageWrites.push([storageKey, storageValue])
      },
    },
  })
  return sharedThemeStorageWrites
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the theme shared with the website', () => {
  it('reads the shared choice first, then the app’s own setting, then Light', () => {
    expect(pickPapelizThemePreferenceInReadOrder('dark', 'system')).toBe('dark')
    expect(pickPapelizThemePreferenceInReadOrder('system', 'dark')).toBe('system')
    expect(pickPapelizThemePreferenceInReadOrder(null, 'dark')).toBe('dark')
    expect(pickPapelizThemePreferenceInReadOrder('purple', 'system')).toBe('system')
    expect(pickPapelizThemePreferenceInReadOrder(undefined, 'purple')).toBe('light')
    expect(pickPapelizThemePreferenceInReadOrder(null, null)).toBe('light')
  })

  it('takes the website’s choice at startup, without waiting for the app’s settings', async () => {
    const sharedThemeStorageWrites = stubSharedThemeStorage('dark')
    expect(await loadPapelizThemePreference()).toBe('dark')
    expect(sharedThemeStorageWrites).toEqual([])
  })

  it('treats an unknown or blocked shared choice as none, and falls back to Light', async () => {
    stubSharedThemeStorage('purple')
    expect(readSharedPapelizThemePreference()).toBeNull()
    expect(await loadPapelizThemePreference()).toBe('light')
    stubSharedThemeStorage('storage-blocked')
    expect(readSharedPapelizThemePreference()).toBeNull()
    expect(await loadPapelizThemePreference()).toBe('light')
  })
})
