import {
  isPapelizBrowserDatabaseAvailable,
  papelizUserSettingsStoreName,
  putPapelizBrowserDatabaseRecord,
  readPapelizBrowserDatabaseRecord,
} from '../browser-database/papeliz-browser-database'

// One row of the IndexedDB store `papelizUserSettings`: a setting's name and its value.
interface PapelizUserSettingRecord<PapelizUserSettingValue> {
  papelizUserSettingName: string
  papelizUserSettingValue: PapelizUserSettingValue
}

export const papelizThemePreferenceSettingName = 'papelizThemePreference'
export const papelizActiveAssistantProviderSettingName = 'papelizActiveAssistantProviderId'
export const papelizWorkspacePanelWidthsSettingName = 'papelizWorkspacePanelWidths'
// The note's font, size and width (papeliz-note-typography-store.ts).
export const papelizNoteTypographySettingName = 'papelizNoteTypography'
// The note's zoom, from the status bar or Ctrl+scroll (papeliz-note-typography-store.ts).
export const papelizNoteZoomPercentSettingName = 'papelizNoteZoomPercent'
// Whether the file list shows hidden folders and notes (papeliz-workspace-store.ts).
export const papelizHiddenVaultEntriesShownSettingName = 'papelizHiddenVaultEntriesShown'
// The open-notes strip: one scrolling row, or rows that stack (papeliz-note-tabs-layout-store.ts).
export const papelizNoteTabsLayoutSettingName = 'papelizNoteTabsLayout'
// The shortcuts changed in Key Bindings; the others keep their defaults (papeliz-key-bindings-store.ts).
export const papelizKeyBindingsSettingName = 'papelizKeyBindings'
// This note under the file list: folded or not, and Outline or Backlinks (papeliz-file-list-this-note-store.ts).
export const papelizFileListThisNoteSectionSettingName = 'papelizFileListThisNoteSection'
// The AI Assistant's mode (Ask, Plan, Write) and effort (papeliz-assistant-run-options-store.ts).
export const papelizAssistantRunOptionsSettingName = 'papelizAssistantRunOptions'
// Prices per model that the user typed over Papeliz's own (papeliz-assistant-model-prices.ts).
export const papelizAssistantModelPricesSettingName = 'papelizAssistantModelPrices'

const papelizUserSettingReadTimeoutMilliseconds = 400

// Reads a setting, or gives back the fallback when there is none, the database is unavailable, or
// it answers too slowly to hold up the first paint.
export async function readPapelizUserSetting<PapelizUserSettingValue>(
  papelizUserSettingName: string,
  fallbackUserSettingValue: PapelizUserSettingValue,
): Promise<PapelizUserSettingValue> {
  if (!isPapelizBrowserDatabaseAvailable()) return fallbackUserSettingValue
  const settingRead = readPapelizBrowserDatabaseRecord<PapelizUserSettingRecord<PapelizUserSettingValue>>(papelizUserSettingsStoreName, papelizUserSettingName)
    .then((userSettingRecord) => userSettingRecord?.papelizUserSettingValue ?? fallbackUserSettingValue)
    .catch(() => fallbackUserSettingValue)
  const settingReadTimeout = new Promise<PapelizUserSettingValue>((resolveWithFallback) =>
    setTimeout(() => resolveWithFallback(fallbackUserSettingValue), papelizUserSettingReadTimeoutMilliseconds),
  )
  return Promise.race([settingRead, settingReadTimeout])
}

export async function writePapelizUserSetting<PapelizUserSettingValue>(
  papelizUserSettingName: string,
  papelizUserSettingValue: PapelizUserSettingValue,
): Promise<void> {
  if (!isPapelizBrowserDatabaseAvailable()) return
  const userSettingRecord: PapelizUserSettingRecord<PapelizUserSettingValue> = { papelizUserSettingName, papelizUserSettingValue }
  await putPapelizBrowserDatabaseRecord(papelizUserSettingsStoreName, userSettingRecord)
}
