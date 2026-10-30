'use client'

import { useState } from 'react'
import papelizAccountStyles from './papeliz-account.module.css'

export const papelizAccountEmailCodeLength = 6

type PapelizAccountCodeBoxesProps = {
  papelizAccountCodeBoxesClassName?: string
  papelizAccountEmailCodeInputId: string
  papelizAccountEmailCode: string
  onPapelizAccountEmailCodeChange: (nextEmailCode: string) => void
}

// The 6-digit code as six boxes. One real input lies over them, so typing, pasting all six digits
// and the phone's one-time-code suggestion all work; the sixth digit signs in.
export function PapelizAccountCodeBoxes({
  papelizAccountCodeBoxesClassName = '',
  papelizAccountEmailCodeInputId,
  papelizAccountEmailCode,
  onPapelizAccountEmailCodeChange,
}: PapelizAccountCodeBoxesProps) {
  const [emailCodeInputIsFocused, setEmailCodeInputIsFocused] = useState(false)
  const emailCodeCurrentBoxIndex = Math.min(papelizAccountEmailCode.length, papelizAccountEmailCodeLength - 1)
  return (
    <div className={`${papelizAccountStyles.papelizAccountCodeBoxes} ${papelizAccountCodeBoxesClassName}`}>
      {Array.from({ length: papelizAccountEmailCodeLength }, (_, emailCodeBoxIndex) => (
        <span
          key={emailCodeBoxIndex}
          aria-hidden="true"
          className={`grid h-[50px] place-items-center rounded-[9px] border bg-papeliz-surface font-mono transition-[border-color,box-shadow] duration-150 ease-out text-[21px] font-semibold ${
            emailCodeInputIsFocused && emailCodeBoxIndex === emailCodeCurrentBoxIndex
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
      ))}
      <input
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
        onFocus={() => setEmailCodeInputIsFocused(true)}
        onBlur={() => setEmailCodeInputIsFocused(false)}
        onChange={(changeEvent) => onPapelizAccountEmailCodeChange(changeEvent.target.value.replace(/\D/g, '').slice(0, papelizAccountEmailCodeLength))}
      />
    </div>
  )
}
