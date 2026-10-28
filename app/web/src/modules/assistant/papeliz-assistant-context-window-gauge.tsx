import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { usePapelizAssistantConversationStore } from './papeliz-assistant-conversation-store'
import { findPapelizAssistantModelContextWindowTokenCount } from './papeliz-assistant-provider-presets'
import { usePapelizAssistantProviderSettingsStore } from './papeliz-assistant-provider-settings-store'
import { readPapelizAssistantContextWindowGauge, type PapelizAssistantContextWindowFillLevel } from './papeliz-assistant-token-usage'

const papelizContextWindowFillLevelClassNames: Record<PapelizAssistantContextWindowFillLevel, string> = {
  roomy: 'text-papeliz-ink-muted',
  filling: 'text-papeliz-warning-ink',
  'nearly-full': 'text-papeliz-diff-removed-ink',
}

const papelizContextWindowRingRadius = 6.5
const papelizContextWindowRingCircumference = 2 * Math.PI * papelizContextWindowRingRadius

// Beside the model chip: how full the model's context window is for this chat, after the last
// answer (that request's input plus its output). A ring when the model's window size is known; the
// token count alone when it is not. Hidden until the chat has made a request, so New chat clears it.
export function PapelizAssistantContextWindowGauge() {
  const chatSessionContextTokenCount = usePapelizAssistantConversationStore(
    (conversationState) => conversationState.chatSessionTokenUsage.chatSessionContextTokenCount,
  )
  const isChatSessionContextTokenCountEstimated = usePapelizAssistantConversationStore(
    (conversationState) => conversationState.chatSessionTokenUsage.isChatSessionContextTokenCountEstimated,
  )
  const activeProviderModelName = usePapelizAssistantProviderSettingsStore(
    (settingsState) => settingsState.providerSettingsByProviderId[settingsState.activeAssistantProviderId]?.providerModelName ?? '',
  )
  if (chatSessionContextTokenCount <= 0) return null

  const contextWindowGaugeReading = readPapelizAssistantContextWindowGauge(
    chatSessionContextTokenCount,
    isChatSessionContextTokenCountEstimated,
    findPapelizAssistantModelContextWindowTokenCount(activeProviderModelName),
  )
  if (contextWindowGaugeReading.contextWindowFilledFraction === null) {
    return (
      <span
        title={contextWindowGaugeReading.contextWindowGaugeDescription}
        className="flex h-[30px] flex-none items-center px-1 text-xs font-medium text-papeliz-ink-subtle tabular-nums"
      >
        <span aria-hidden="true">{contextWindowGaugeReading.contextWindowGaugeShortLabel}</span>
        <span className="sr-only">{contextWindowGaugeReading.contextWindowGaugeDescription}</span>
      </span>
    )
  }

  const shownFilledFraction = Math.min(1, contextWindowGaugeReading.contextWindowFilledFraction)
  return (
    <span
      role="meter"
      aria-label="Context window"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(shownFilledFraction * 100)}
      aria-valuetext={contextWindowGaugeReading.contextWindowGaugeDescription}
      title={contextWindowGaugeReading.contextWindowGaugeDescription}
      className={joinPapelizClassNames(
        'grid size-[30px] flex-none place-items-center',
        papelizContextWindowFillLevelClassNames[contextWindowGaugeReading.contextWindowFillLevel],
      )}
    >
      <svg viewBox="0 0 18 18" className="size-[18px] -rotate-90" aria-hidden="true">
        <circle cx="9" cy="9" r={papelizContextWindowRingRadius} fill="none" strokeWidth="2.5" className="stroke-papeliz-line-strong" />
        <circle
          cx="9"
          cy="9"
          r={papelizContextWindowRingRadius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={papelizContextWindowRingCircumference}
          strokeDashoffset={papelizContextWindowRingCircumference * (1 - shownFilledFraction)}
          className="transition-[stroke-dashoffset] duration-300"
        />
      </svg>
    </span>
  )
}
