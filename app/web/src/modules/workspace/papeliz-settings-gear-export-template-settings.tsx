import { useId, useState } from 'react'
import {
  formatPapelizTemplateTagDisplayName,
  papelizTemplateCategoryTags,
  papelizTemplateLicenseDisplayNames,
  papelizTemplateLicenseIds,
  type PapelizTemplateCategoryTag,
  type PapelizTemplateLicenseId,
} from '../template-gallery/papeliz-template-gallery-contract'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizListboxSelect } from '../ui/papeliz-listbox-select'
import { PapelizSlidingChoiceGroup } from '../ui/papeliz-sliding-choice-group'

// Export › Template's settings (papeliz-settings-gear-export-page.tsx), in the dialog Template's gear
// opens: Details (the name, description, category, first note and license the template's manifest
// gets) and Files (each ticked note Recommended or Optional). Every change is kept at once.

export interface PapelizSettingsGearTemplateExportSettings {
  templateExportName: string
  templateExportDescription: string
  templateExportCategoryTag: PapelizTemplateCategoryTag | null
  templateExportFirstNotePath: string | null
  templateExportLicenseId: PapelizTemplateLicenseId
  // Ticked notes that come only with All, not with Recommended.
  templateExportOptionalNoteRelativePaths: string[]
}

type PapelizSettingsGearTemplateSettingsTab = 'details' | 'files'

const papelizTemplateSettingsFieldClassName = 'mt-1.5 h-9 w-full rounded-full border border-papeliz-line-strong bg-papeliz-surface px-3.5 text-[13px] text-papeliz-ink'
const papelizTemplateSettingsLabelClassName = 'mt-3 block text-[12.5px] font-medium'

interface PapelizSettingsGearExportTemplateSettingsProps {
  templateExportSettings: PapelizSettingsGearTemplateExportSettings
  onTemplateExportSettingsChange: (changedTemplateExportSettings: PapelizSettingsGearTemplateExportSettings) => void
  // In the tree's order.
  tickedExportNoteRelativePaths: readonly string[]
  // The first note the template opens, as the Export page reads it (the setting, or the first ticked note).
  shownTemplateFirstNotePath: string | null
}

export function PapelizSettingsGearExportTemplateSettings({
  templateExportSettings,
  onTemplateExportSettingsChange,
  tickedExportNoteRelativePaths,
  shownTemplateFirstNotePath,
}: PapelizSettingsGearExportTemplateSettingsProps) {
  const [chosenTemplateSettingsTab, setChosenTemplateSettingsTab] = useState<PapelizSettingsGearTemplateSettingsTab>('details')
  const templateSettingsFieldIdPrefix = useId()
  const changeTemplateExportSettings = (changedSettings: Partial<PapelizSettingsGearTemplateExportSettings>) => onTemplateExportSettingsChange({ ...templateExportSettings, ...changedSettings })
  const optionalNoteRelativePaths = new Set(templateExportSettings.templateExportOptionalNoteRelativePaths)
  const setNoteOptional = (vaultNoteRelativePath: string, isNoteOptional: boolean) => {
    const changedOptionalNoteRelativePaths = new Set(optionalNoteRelativePaths)
    if (isNoteOptional) changedOptionalNoteRelativePaths.add(vaultNoteRelativePath)
    else changedOptionalNoteRelativePaths.delete(vaultNoteRelativePath)
    changeTemplateExportSettings({ templateExportOptionalNoteRelativePaths: [...changedOptionalNoteRelativePaths] })
  }

  return (
    <div>
      <PapelizSlidingChoiceGroup<PapelizSettingsGearTemplateSettingsTab>
        slidingChoiceGroupLabel="Template Settings"
        slidingChoiceGroupRole="tablist"
        slidingChoiceGroupTone="solid-blue"
        slidingChoices={[
          { slidingChoiceValue: 'details', slidingChoiceContent: 'Details' },
          { slidingChoiceValue: 'files', slidingChoiceContent: 'Files' },
        ]}
        chosenSlidingChoiceValue={chosenTemplateSettingsTab}
        onSlidingChoiceSelect={setChosenTemplateSettingsTab}
      />

      <div role="tabpanel" aria-label={chosenTemplateSettingsTab === 'details' ? 'Details' : 'Files'}>
        {chosenTemplateSettingsTab === 'details' ? (
          <>
            <label className={papelizTemplateSettingsLabelClassName} htmlFor={`${templateSettingsFieldIdPrefix}-name`}>
              Name
            </label>
            <input
              id={`${templateSettingsFieldIdPrefix}-name`}
              type="text"
              maxLength={80}
              value={templateExportSettings.templateExportName}
              onChange={(changeEvent) => changeTemplateExportSettings({ templateExportName: changeEvent.target.value })}
              className={papelizTemplateSettingsFieldClassName}
            />
            <label className={papelizTemplateSettingsLabelClassName} htmlFor={`${templateSettingsFieldIdPrefix}-description`}>
              Description
            </label>
            <textarea
              id={`${templateSettingsFieldIdPrefix}-description`}
              rows={3}
              maxLength={300}
              placeholder="A sentence or two on what it's for"
              value={templateExportSettings.templateExportDescription}
              onChange={(changeEvent) => changeTemplateExportSettings({ templateExportDescription: changeEvent.target.value })}
              className="mt-1.5 w-full resize-none rounded-2xl border border-papeliz-line-strong bg-papeliz-surface px-3.5 py-2 text-[13px] leading-snug text-papeliz-ink placeholder:text-papeliz-ink-subtle"
            />
            <label id={`${templateSettingsFieldIdPrefix}-category-label`} className={papelizTemplateSettingsLabelClassName} htmlFor={`${templateSettingsFieldIdPrefix}-category`}>
              Category
            </label>
            <PapelizListboxSelect
              listboxSelectTriggerId={`${templateSettingsFieldIdPrefix}-category`}
              listboxSelectLabelId={`${templateSettingsFieldIdPrefix}-category-label`}
              listboxSelectOptions={papelizTemplateCategoryTags.map((templateCategoryTag) => ({
                listboxOptionValue: templateCategoryTag,
                listboxOptionLabel: formatPapelizTemplateTagDisplayName(templateCategoryTag),
              }))}
              chosenListboxOptionValue={templateExportSettings.templateExportCategoryTag ?? ''}
              listboxSelectPlaceholder="Choose a category"
              onListboxOptionChoose={(chosenCategoryTag) => {
                const templateCategoryTag = papelizTemplateCategoryTags.find((categoryTag) => categoryTag === chosenCategoryTag)
                if (templateCategoryTag !== undefined) changeTemplateExportSettings({ templateExportCategoryTag: templateCategoryTag })
              }}
              className="mt-1.5"
            />
            <label id={`${templateSettingsFieldIdPrefix}-first-note-label`} className={papelizTemplateSettingsLabelClassName} htmlFor={`${templateSettingsFieldIdPrefix}-first-note`}>
              First Note
            </label>
            <PapelizListboxSelect
              listboxSelectTriggerId={`${templateSettingsFieldIdPrefix}-first-note`}
              listboxSelectLabelId={`${templateSettingsFieldIdPrefix}-first-note-label`}
              listboxSelectOptions={tickedExportNoteRelativePaths.map((tickedNoteRelativePath) => ({ listboxOptionValue: tickedNoteRelativePath, listboxOptionLabel: tickedNoteRelativePath }))}
              chosenListboxOptionValue={shownTemplateFirstNotePath ?? ''}
              listboxSelectPlaceholder="Tick a note to export first"
              isListboxSelectDisabled={tickedExportNoteRelativePaths.length === 0}
              onListboxOptionChoose={(chosenFirstNotePath) => changeTemplateExportSettings({ templateExportFirstNotePath: chosenFirstNotePath })}
              className="mt-1.5"
            />
            <p className="mt-1.5 text-[11.5px] leading-snug text-papeliz-ink-subtle">Opens first in a vault made from it, and always comes.</p>
            <label id={`${templateSettingsFieldIdPrefix}-license-label`} className={papelizTemplateSettingsLabelClassName} htmlFor={`${templateSettingsFieldIdPrefix}-license`}>
              License
            </label>
            <PapelizListboxSelect
              listboxSelectTriggerId={`${templateSettingsFieldIdPrefix}-license`}
              listboxSelectLabelId={`${templateSettingsFieldIdPrefix}-license-label`}
              listboxSelectOptions={papelizTemplateLicenseIds.map((templateLicenseId) => ({ listboxOptionValue: templateLicenseId, listboxOptionLabel: papelizTemplateLicenseDisplayNames[templateLicenseId] }))}
              chosenListboxOptionValue={templateExportSettings.templateExportLicenseId}
              onListboxOptionChoose={(chosenLicenseId) => {
                const templateLicenseId = papelizTemplateLicenseIds.find((licenseId) => licenseId === chosenLicenseId)
                if (templateLicenseId !== undefined) changeTemplateExportSettings({ templateExportLicenseId: templateLicenseId })
              }}
              className="mt-1.5"
            />
            <p className="mt-1.5 text-[11.5px] leading-snug text-papeliz-ink-subtle">
              {templateExportSettings.templateExportLicenseId === 'MIT' ? 'The .zip includes its LICENSE file.' : 'Add its LICENSE file on GitHub before you submit.'}
            </p>
          </>
        ) : (
          <>
            <p className="mt-3 mb-1.5 text-[12px] leading-snug text-papeliz-ink-muted">Recommended files always come. Optional ones come with All, or ticked one by one. Pictures follow their notes.</p>
            {tickedExportNoteRelativePaths.length === 0 ? (
              <p className="text-[12px] text-papeliz-ink-subtle">No notes ticked.</p>
            ) : (
              <ul className="rounded-xl border border-papeliz-line bg-papeliz-surface p-1">
                {tickedExportNoteRelativePaths.map((tickedNoteRelativePath) => {
                  const isFirstNote = tickedNoteRelativePath === shownTemplateFirstNotePath
                  const isNoteOptional = !isFirstNote && optionalNoteRelativePaths.has(tickedNoteRelativePath)
                  return (
                    <li key={tickedNoteRelativePath} className="flex min-h-8 items-center gap-2 rounded-lg px-1.5 py-1">
                      <span className="min-w-0 flex-1 truncate text-[12.5px]" title={tickedNoteRelativePath}>
                        {tickedNoteRelativePath}
                      </span>
                      <span
                        role="radiogroup"
                        aria-label={tickedNoteRelativePath}
                        title={isFirstNote ? 'The first note always comes' : undefined}
                        className="inline-grid flex-none grid-cols-2 rounded-full bg-papeliz-press p-0.5"
                      >
                        {([false, true] as const).map((isOptionalChoice) => {
                          const isChoiceChosen = isNoteOptional === isOptionalChoice
                          return (
                            <button
                              key={isOptionalChoice ? 'optional' : 'recommended'}
                              type="button"
                              role="radio"
                              aria-checked={isChoiceChosen}
                              disabled={isFirstNote}
                              onClick={() => setNoteOptional(tickedNoteRelativePath, isOptionalChoice)}
                              className={joinPapelizClassNames(
                                'rounded-full px-2 py-0.5 text-[11px] transition-colors disabled:cursor-default',
                                isChoiceChosen ? 'bg-papeliz-surface font-semibold text-papeliz-blue shadow-[0_1px_2px_rgb(16_24_40/0.12)]' : 'text-papeliz-ink-muted enabled:hover:text-papeliz-ink',
                              )}
                            >
                              {isOptionalChoice ? 'Optional' : 'Recommended'}
                            </button>
                          )
                        })}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
