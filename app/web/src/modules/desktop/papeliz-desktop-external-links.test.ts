import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PapelizDesktopPlatform } from './papeliz-desktop-platform-contract'
import { sendPapelizDesktopExternalLinksToSystemBrowser } from './papeliz-desktop-external-links'

// The tests run without a page, so the window, the document and a link are small stand-ins.
const testAppOrigin = 'https://tauri.localhost'

class TestElement {
  closest(_linkSelector: string): TestElement | null {
    return null
  }
}

class TestLinkElement extends TestElement {
  constructor(
    readonly href: string,
    readonly origin: string,
  ) {
    super()
  }

  override closest(): TestElement {
    return this
  }
}

interface TestLinkPress {
  target: TestElement
  defaultPrevented: boolean
  preventDefault: () => void
}

function createTestLinkPress(linkAddress: string): TestLinkPress {
  const linkOrigin = /^https?:\/\//i.test(linkAddress) ? new URL(linkAddress).origin : 'null'
  const testLinkPress: TestLinkPress = {
    target: new TestLinkElement(linkAddress, linkOrigin),
    defaultPrevented: false,
    preventDefault: () => {
      testLinkPress.defaultPrevented = true
    },
  }
  return testLinkPress
}

describe('web links in Papeliz for Windows', () => {
  const pageLinkPressListeners = new Map<string, (testLinkPress: TestLinkPress) => void>()
  const pageWindowOpen = vi.fn(() => null)
  const openedSystemBrowserAddresses: string[] = []
  const papelizDesktopPlatform = {
    openLinkInSystemBrowser: async (externalLinkUrl: string) => {
      openedSystemBrowserAddresses.push(externalLinkUrl)
    },
  } as unknown as PapelizDesktopPlatform
  let stopSendingExternalLinks: () => void = () => undefined

  const pressTestLink = (linkAddress: string) => {
    const testLinkPress = createTestLinkPress(linkAddress)
    pageLinkPressListeners.get('click')?.(testLinkPress)
    return testLinkPress
  }

  beforeEach(() => {
    vi.stubGlobal('Element', TestElement)
    vi.stubGlobal('HTMLAnchorElement', TestLinkElement)
    vi.stubGlobal('window', { open: pageWindowOpen, location: { origin: testAppOrigin } })
    vi.stubGlobal('document', {
      addEventListener: (pageEventName: string, pageEventListener: (testLinkPress: TestLinkPress) => void) => pageLinkPressListeners.set(pageEventName, pageEventListener),
      removeEventListener: (pageEventName: string) => pageLinkPressListeners.delete(pageEventName),
    })
    stopSendingExternalLinks = sendPapelizDesktopExternalLinksToSystemBrowser(papelizDesktopPlatform)
  })

  afterEach(() => {
    stopSendingExternalLinks()
    vi.unstubAllGlobals()
    pageLinkPressListeners.clear()
    pageWindowOpen.mockClear()
    openedSystemBrowserAddresses.length = 0
  })

  it('open in the person’s own browser, and never take the app’s own window away', () => {
    expect(pressTestLink('https://papeliz.com/help/').defaultPrevented).toBe(true)
    expect(pressTestLink('http://example.com/page').defaultPrevented).toBe(true)
    expect(openedSystemBrowserAddresses).toEqual(['https://papeliz.com/help/', 'http://example.com/page'])
    expect(pageLinkPressListeners.has('auxclick')).toBe(true)
  })

  it('leave links inside the app and addresses that aren’t on the web alone', () => {
    expect(pressTestLink(`${testAppOrigin}/app/#note`).defaultPrevented).toBe(false)
    expect(pressTestLink('mailto:someone@example.com').defaultPrevented).toBe(false)
    expect(openedSystemBrowserAddresses).toEqual([])
  })

  it('send the page’s own window.open for a web address there too, and stop when asked', () => {
    expect(window.open('https://example.com/', '_blank', 'noopener,noreferrer')).toBeNull()
    expect(openedSystemBrowserAddresses).toEqual(['https://example.com/'])
    expect(pageWindowOpen).not.toHaveBeenCalled()
    stopSendingExternalLinks()
    stopSendingExternalLinks = () => undefined
    window.open('https://example.com/other', '_blank')
    expect(pageWindowOpen).toHaveBeenCalledTimes(1)
    expect(pageLinkPressListeners.size).toBe(0)
  })
})
