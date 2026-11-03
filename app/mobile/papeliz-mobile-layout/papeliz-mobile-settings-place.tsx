import { Accessibility, ArrowLeft, ChevronRight, LogOut, Settings, WandSparkles } from 'lucide-react'
import { lazy, Suspense, useState, type ReactNode } from 'react'
import { PapelizSettingsGearAccessibilityPage, PapelizSettingsGearSettingsPage } from '../../web/src/modules/workspace/papeliz-settings-gear-pages'
import { usePapelizWorkspaceStore } from '../../web/src/modules/workspace/papeliz-workspace-store'
import { usePapelizMobileBackStep } from './papeliz-mobile-back-steps'

const PapelizAssistantProviderSettingsPage = lazy(() =>
  import('../../web/src/modules/assistant/papeliz-assistant-provider-settings-page').then((providerSettingsPageModule) => ({
    default: providerSettingsPageModule.PapelizAssistantProviderSettingsPage,
  })),
)

type PapelizMobileSettingsPage = 'settings' | 'accessibility' | 'ai-provider'

const papelizMobileSettingsPageChoices: ReadonlyArray<{ mobileSettingsPage: PapelizMobileSettingsPage; mobileSettingsPageLabel: string; MobileSettingsPageIcon: typeof Settings }> = [
  { mobileSettingsPage: 'settings', mobileSettingsPageLabel: 'Settings', MobileSettingsPageIcon: Settings },
  { mobileSettingsPage: 'accessibility', mobileSettingsPageLabel: 'Accessibility', MobileSettingsPageIcon: Accessibility },
  { mobileSettingsPage: 'ai-provider', mobileSettingsPageLabel: 'AI Provider', MobileSettingsPageIcon: WandSparkles },
]

function renderPapelizMobileSettingsPage(mobileSettingsPage: PapelizMobileSettingsPage): ReactNode {
  if (mobileSettingsPage === 'settings') return <PapelizSettingsGearSettingsPage />
  if (mobileSettingsPage === 'accessibility') return <PapelizSettingsGearAccessibilityPage areVaultNoteSettingsShown />
  return (
    <Suspense fallback={null}>
      <PapelizAssistantProviderSettingsPage />
    </Suspense>
  )
}

// Settings on the bottom bar: the gear's list as a page, and each of the web app's own Settings pages
// opening over it with a back arrow. The stores update the app, so there is no Updates page.
export function PapelizMobileSettingsPlace() {
  const [openMobileSettingsPage, setOpenMobileSettingsPage] = useState<PapelizMobileSettingsPage | null>(null)
  const setVaultCloseConfirmationShown = usePapelizWorkspaceStore((workspaceState) => workspaceState.setVaultCloseConfirmationShown)
  // Back from one of the pages goes back to the list.
  usePapelizMobileBackStep(openMobileSettingsPage !== null, () => setOpenMobileSettingsPage(null))

  if (openMobileSettingsPage !== null) {
    const openPageLabel = papelizMobileSettingsPageChoices.find((pageChoice) => pageChoice.mobileSettingsPage === openMobileSettingsPage)?.mobileSettingsPageLabel
    return (
      <div className="papeliz-mobile-settings-place">
        <header className="papeliz-mobile-settings-page-head">
          <button type="button" className="papeliz-mobile-settings-back" aria-label="Back to Settings" onClick={() => setOpenMobileSettingsPage(null)}>
            <ArrowLeft aria-hidden="true" />
          </button>
          <h2>{openPageLabel}</h2>
        </header>
        <div className="papeliz-mobile-settings-page-body">{renderPapelizMobileSettingsPage(openMobileSettingsPage)}</div>
      </div>
    )
  }

  return (
    <div className="papeliz-mobile-settings-place">
      <h2 className="papeliz-mobile-settings-title">Settings</h2>
      <div className="papeliz-mobile-settings-group">
        {papelizMobileSettingsPageChoices.map(({ mobileSettingsPage, mobileSettingsPageLabel, MobileSettingsPageIcon }) => (
          <button key={mobileSettingsPage} type="button" className="papeliz-mobile-settings-row" onClick={() => setOpenMobileSettingsPage(mobileSettingsPage)}>
            <span className="papeliz-mobile-settings-row-icon">
              <MobileSettingsPageIcon aria-hidden="true" />
            </span>
            <span className="papeliz-mobile-settings-row-label">{mobileSettingsPageLabel}</span>
            <ChevronRight aria-hidden="true" className="papeliz-mobile-settings-row-chevron" />
          </button>
        ))}
      </div>
      <div className="papeliz-mobile-settings-group">
        <button type="button" className="papeliz-mobile-settings-row" onClick={() => setVaultCloseConfirmationShown(true)}>
          <span className="papeliz-mobile-settings-row-icon">
            <LogOut aria-hidden="true" />
          </span>
          <span className="papeliz-mobile-settings-row-label">Close Vault</span>
        </button>
      </div>
    </div>
  )
}
