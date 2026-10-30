import type { ReactNode } from 'react'
import { PapelizAccountBrand, PapelizAccountCardFrame, PapelizAccountCardMark, papelizAccountPrimaryButtonClassName } from './papeliz-account-card-frame'
import papelizAccountStyles from './papeliz-account.module.css'

type PapelizAccountStateScreenProps = {
  // `loading` is the sign-in card's frame and mark with a moving bar, `error` the red card, `done`
  // a plain card.
  papelizAccountStateKind: 'loading' | 'error' | 'done'
  papelizAccountStateTitle: string
  papelizAccountStateText?: ReactNode
  papelizAccountStateActionLabel?: string
  onPapelizAccountStateAction?: () => void
  papelizAccountStateActionHref?: string
}

// A whole-page state. Loading sits in the sign-in card's own frame, so the card is already in place
// when the page is ready. Errors and endings show the brand, one card, then the action.
export function PapelizAccountStateScreen({
  papelizAccountStateKind,
  papelizAccountStateTitle,
  papelizAccountStateText,
  papelizAccountStateActionLabel,
  onPapelizAccountStateAction,
  papelizAccountStateActionHref,
}: PapelizAccountStateScreenProps) {
  const papelizAccountStateIsError = papelizAccountStateKind === 'error'
  if (papelizAccountStateKind === 'loading') {
    return (
      <PapelizAccountCardFrame>
        <div role="status" className="flex flex-col items-center text-center">
          <PapelizAccountCardMark />
          <h1 className="text-xl leading-tight font-semibold tracking-[-0.01em] text-balance">{papelizAccountStateTitle}</h1>
          {papelizAccountStateText && <p className="mt-1.5 text-sm text-balance text-papeliz-ink-muted">{papelizAccountStateText}</p>}
          <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-papeliz-surface-gray" aria-hidden="true">
            <i className={`block h-full w-[38%] rounded-full bg-papeliz-gradient-start ${papelizAccountStyles.papelizAccountLoadingBar}`} />
          </div>
        </div>
      </PapelizAccountCardFrame>
    )
  }
  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-[360px] flex-col items-center gap-3.5">
        <PapelizAccountBrand />
        <div
          role={papelizAccountStateIsError ? 'alert' : 'status'}
          className={`w-full rounded-[10px] border px-[18px] py-4 text-center ${
            papelizAccountStateIsError
              ? 'border-papeliz-diff-removed-ink/40 bg-papeliz-diff-removed text-papeliz-diff-removed-ink'
              : 'border-papeliz-line bg-papeliz-surface'
          }`}
        >
          <h1 className="mb-1.5 text-lg font-bold text-balance">{papelizAccountStateTitle}</h1>
          {papelizAccountStateText && (
            <p className={`text-sm text-balance ${papelizAccountStateIsError ? '' : 'text-papeliz-ink-muted'}`}>{papelizAccountStateText}</p>
          )}
        </div>
        {papelizAccountStateActionLabel &&
          (papelizAccountStateActionHref ? (
            <a href={papelizAccountStateActionHref} className={papelizAccountPrimaryButtonClassName}>
              {papelizAccountStateActionLabel}
            </a>
          ) : (
            <button type="button" onClick={onPapelizAccountStateAction} className={papelizAccountPrimaryButtonClassName}>
              {papelizAccountStateActionLabel}
            </button>
          ))}
      </div>
    </div>
  )
}
