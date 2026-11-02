'use client'

import { useState, type Ref } from 'react'
import { papelizAccountClerkErrorCodes, readPapelizAccountClerkError } from './papeliz-account-clerk-errors'
import papelizAccountStyles from './papeliz-account.module.css'

export const papelizAccountEmailCodeLength = 6

// The code's own errors, the same wherever a code is asked for.
export const papelizAccountEmailCodeIncompleteMessage = `Enter the ${papelizAccountEmailCodeLength}-digit code.`

// A wrong or expired code from Clerk, in this page's words; null for any other error.
export function readPapelizAccountEmailCodeFieldErrorMessage(emailCodeError: unknown): string | null {
  const { clerkErrorCode } = readPapelizAccountClerkError(emailCodeError)
  if (clerkErrorCode === papelizAccountClerkErrorCodes.codeIncorrect) return 'That code isn’t right. Check it and try again.'
  if (clerkErrorCode === papelizAccountClerkErrorCodes.codeExpired) return 'That code has expired. Send a new one.'
  return null
}

type PapelizAccountCodeBoxesProps = {
  papelizAccountCodeBoxesClassName?: string
  papelizAccountEmailCodeInputId: string
  papelizAccountEmailCodeInputRef?: Ref<HTMLInputElement>
  papelizAccountEmailCode: string
  // The code's error line, while one shows: the boxes turn red, like a text field marked invalid.
  papelizAccountEmailCodeErrorId?: string | null
  onPapelizAccountEmailCodeChange: (nextEmailCode: string) => void
}

// The 6-digit code as six boxes. One real input lies over them, so typing, pasting all six digits
// and the phone's one-time-code suggestion all work; the sixth digit signs in.
export function PapelizAccountCodeBoxes({
  papelizAccountCodeBoxesClassName = '',
  papelizAccountEmailCodeInputId,
  papelizAccountEmailCodeInputRef,
  papelizAccountEmailCode,
  papelizAccountEmailCodeErrorId = null,
  onPapelizAccountEmailCodeChange,
}: PapelizAccountCodeBoxesProps) {
  const [emailCodeInputIsFocused, setEmailCodeInputIsFocused] = useState(false)
  const emailCodeCurrentBoxIndex = Math.min(papelizAccountEmailCode.length, papelizAccountEmailCodeLength - 1)
  const emailCodeIsInvalid = papelizAccountEmailCodeErrorId !== null
  return (
    <div className={`${papelizAccountStyles.papelizAccountCodeBoxes} ${papelizAccountCodeBoxesClassName}`}>
      {Array.from({ length: papelizAccountEmailCodeLength }, (_, emailCodeBoxIndex) => {
        const emailCodeBoxIsCurrent = emailCodeInputIsFocused && emailCodeBoxIndex === emailCodeCurrentBoxIndex
        return (
          <span
            key={emailCodeBoxIndex}
            aria-hidden="true"
            className={`grid h-[50px] place-items-center rounded-[9px] border bg-papeliz-surface font-mono transition-[border-color,box-shadow] duration-150 ease-out text-[21px] font-semibold ${
              emailCodeIsInvalid
                ? `border-papeliz-diff-removed-ink ${
                    emailCodeBoxIsCurrent
                      ? 'shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-papeliz-diff-removed-ink)_24%,transparent)]'
                      : 'shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-papeliz-diff-removed-ink)_16%,transparent)]'
                  }`
                : emailCodeBoxIsCurrent
                  ? 'border-papeliz-blue shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-papeliz-blue)_25%,transparent)]'
                  : 'border-papeliz-line-strong'
            }`}
          >
            {papelizAccountEmailCode[emailCodeBoxIndex] && (
              <span key={papelizAccountEmailCode[emailCodeBoxIndex]} className={papelizAccountStyles.papelizAccountCodeDigitEnter}>
                {papelizAccountEmailCode[emailCodeBoxIndex]}
              </span>
            )}
          </span>
        )
      })}
      <input
        ref={papelizAccountEmailCodeInputRef}
        id={papelizAccountEmailCodeInputId}
        className={papelizAccountStyles.papelizAccountCodeInput}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={papelizAccountEmailCodeLength}
        required
        autoFocus
        value={papelizAccountEmailCode}
        aria-invalid={emailCodeIsInvalid ? true : undefined}
        aria-describedby={papelizAccountEmailCodeErrorId ?? undefined}
        onFocus={() => setEmailCodeInputIsFocused(true)}
        onBlur={() => setEmailCodeInputIsFocused(false)}
        onChange={(changeEvent) => onPapelizAccountEmailCodeChange(changeEvent.target.value.replace(/\D/g, '').slice(0, papelizAccountEmailCodeLength))}
      />
    </div>
  )
}
