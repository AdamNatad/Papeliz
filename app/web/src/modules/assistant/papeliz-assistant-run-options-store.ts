import { create } from 'zustand'
import { papelizAssistantRunOptionsSettingName, readPapelizUserSetting, writePapelizUserSetting } from '../settings/papeliz-user-settings'

// How the AI Assistant answers: its mode, how hard it thinks, and whether its changes wait for the
// user. The mode and the effort are kept in the browser's settings; Bypass permission is not, so a
// reload always starts back at Review changes.

// Ask answers and changes nothing. Plan writes a plan to carry out later. Write changes notes,
// each change waiting for the user unless Bypass permission is on.
export type PapelizAssistantMode = 'ask' | 'plan' | 'write'

// Sent as the request's `reasoning_effort`.
export type PapelizAssistantReasoningEffort = 'low' | 'medium' | 'high'

export type PapelizAssistantChangePermission = 'review-changes' | 'bypass-permission'

interface PapelizAssistantRunOptionsSetting {
  assistantMode: PapelizAssistantMode
  assistantReasoningEffort: PapelizAssistantReasoningEffort
}

interface PapelizAssistantRunOptionsState extends PapelizAssistantRunOptionsSetting {
  assistantChangePermission: PapelizAssistantChangePermission
  // Models whose server refused `reasoning_effort` since this page loaded: the effort chip hides
  // for them, and it is not sent again.
  providerModelNamesRefusingReasoningEffort: string[]

  loadAssistantRunOptions: () => Promise<void>
  setAssistantMode: (assistantMode: PapelizAssistantMode) => void
  setAssistantReasoningEffort: (assistantReasoningEffort: PapelizAssistantReasoningEffort) => void
  setAssistantChangePermission: (assistantChangePermission: PapelizAssistantChangePermission) => void
  rememberProviderModelRefusingReasoningEffort: (providerModelName: string) => void
}

const papelizAssistantModes: readonly PapelizAssistantMode[] = ['ask', 'plan', 'write']
const papelizAssistantReasoningEfforts: readonly PapelizAssistantReasoningEffort[] = ['low', 'medium', 'high']

export const usePapelizAssistantRunOptionsStore = create<PapelizAssistantRunOptionsState>()((setRunOptionsState, getRunOptionsState) => {
  const saveAssistantRunOptions = () => {
    const { assistantMode, assistantReasoningEffort } = getRunOptionsState()
    void writePapelizUserSetting<PapelizAssistantRunOptionsSetting>(papelizAssistantRunOptionsSettingName, { assistantMode, assistantReasoningEffort }).catch(
      () => undefined,
    )
  }
  return {
    assistantMode: 'ask',
    assistantReasoningEffort: 'medium',
    assistantChangePermission: 'review-changes',
    providerModelNamesRefusingReasoningEffort: [],

    loadAssistantRunOptions: async () => {
      const savedRunOptions = await readPapelizUserSetting<Partial<PapelizAssistantRunOptionsSetting> | null>(papelizAssistantRunOptionsSettingName, null)
      setRunOptionsState({
        assistantMode: papelizAssistantModes.find((assistantMode) => assistantMode === savedRunOptions?.assistantMode) ?? 'ask',
        assistantReasoningEffort:
          papelizAssistantReasoningEfforts.find((assistantReasoningEffort) => assistantReasoningEffort === savedRunOptions?.assistantReasoningEffort) ?? 'medium',
      })
    },
    setAssistantMode: (assistantMode) => {
      setRunOptionsState({ assistantMode })
      saveAssistantRunOptions()
    },
    setAssistantReasoningEffort: (assistantReasoningEffort) => {
      setRunOptionsState({ assistantReasoningEffort })
      saveAssistantRunOptions()
    },
    setAssistantChangePermission: (assistantChangePermission) => setRunOptionsState({ assistantChangePermission }),
    rememberProviderModelRefusingReasoningEffort: (providerModelName) =>
      setRunOptionsState((runOptionsState) =>
        runOptionsState.providerModelNamesRefusingReasoningEffort.includes(providerModelName)
          ? runOptionsState
          : { providerModelNamesRefusingReasoningEffort: [...runOptionsState.providerModelNamesRefusingReasoningEffort, providerModelName] },
      ),
  }
})
