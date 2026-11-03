import { describe, expect, it } from 'vitest'
import { isPapelizMobileApp } from 'virtual:papeliz-mobile-platform-availability'
import { loadPapelizMobilePlatform, PapelizMobileWorkspaceLayout } from 'virtual:papeliz-mobile-platform'

// The web build resolves the mobile seam to its stand-in: no mobile app, and no phone layout, so
// papeliz.com keeps its own layout, its phone view included.
describe('the mobile seam in the web build', () => {
  it('says this is not the mobile app', async () => {
    expect(isPapelizMobileApp).toBe(false)
    expect(await loadPapelizMobilePlatform()).toEqual({ papelizMobilePlatformAvailability: 'not-in-this-build' })
  })

  it('has no phone layout, so the workspace keeps the web one', () => {
    expect(PapelizMobileWorkspaceLayout).toBeNull()
  })
})
