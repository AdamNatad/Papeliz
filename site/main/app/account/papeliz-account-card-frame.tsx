import { CircleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { PapelizMark } from '@/components/logo/papeliz-mark'
import papelizAccountStyles from './papeliz-account.module.css'

// The account page's shared pieces: the blue frame around the white card, the brand, and the
// button and field styles every card uses.

export const papelizAccountPrimaryButtonClassName =
  'flex min-h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-[9px] bg-papeliz-gradient-start px-4 text-sm font-semibold text-white shadow-[inset_0_1px_0_#ffffff1f,0_2px_3px_rgb(0_40_100/0.18)] transition-[filter,scale] hover:brightness-110 active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papeliz-blue'

// The blue button at row size, for a row's main action.
export const papelizAccountCompactPrimaryButtonClassName =
  'inline-flex min-h-[38px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-papeliz-gradient-start px-3.5 text-[13px] font-semibold whitespace-nowrap text-white shadow-[inset_0_1px_0_#ffffff1f,0_2px_3px_rgb(0_40_100/0.18)] transition-[filter,scale] hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papeliz-blue'

// The red button at row size, for deleting.
export const papelizAccountCompactDangerButtonClassName =
  'inline-flex min-h-[38px] shrink-0 cursor-pointer items-center justify-center rounded-lg bg-papeliz-diff-removed-ink px-3.5 text-[13px] font-semibold whitespace-nowrap text-papeliz-surface shadow-[inset_0_1px_0_#ffffff1f,0_2px_3px_rgb(100_20_20/0.18)] transition-[filter,scale] hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papeliz-diff-removed-ink'

// A row's action button on a computer: wide enough that a column of them lines up.
export const papelizAccountRowActionWidthClassName = 'min-w-[84px] md:min-w-[112px]'

// The white button, such as Cancel and Close, with an outline strong enough to read as a button.
// Hovered, it turns soft blue with a blue outline and blue text, not gray.
export const papelizAccountSecondaryButtonClassName =
  'inline-flex min-h-[38px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-papeliz-line-strong bg-papeliz-surface px-3.5 text-[13px] font-semibold whitespace-nowrap text-papeliz-ink shadow-[0_1px_2px_rgb(16_24_40/0.08)] transition-colors enabled:hover:border-papeliz-blue-line enabled:hover:bg-papeliz-blue-soft enabled:hover:text-papeliz-blue disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papeliz-blue'
// A field marked `aria-invalid` turns red, with a soft red ring, focused or not; the site's blue focus
// outline (`globals.css`) gives way to it there, so the red ring alone shows focus.
export const papelizAccountTextFieldClassName =
  'block min-h-[42px] w-full rounded-[9px] border border-papeliz-line-strong bg-papeliz-surface px-3 text-sm text-papeliz-ink outline-none transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-papeliz-ink-subtle focus:border-papeliz-blue focus:shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-papeliz-blue)_25%,transparent)] aria-invalid:border-papeliz-diff-removed-ink aria-invalid:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-papeliz-diff-removed-ink)_16%,transparent)] aria-invalid:focus:border-papeliz-diff-removed-ink aria-invalid:focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-papeliz-diff-removed-ink)_24%,transparent)] aria-invalid:outline-none!'

// A field's own error, in red under it with an alert mark, in place of the browser's own bubble; the
// field itself turns red too. Its field points at it with `aria-describedby` and is `aria-invalid`.
export function PapelizAccountFieldError({ papelizAccountFieldErrorId, children }: { papelizAccountFieldErrorId: string; children: ReactNode }) {
  return (
    <p
      id={papelizAccountFieldErrorId}
      role="alert"
      className={`${papelizAccountStyles.papelizAccountNoticeEnter} mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug font-medium text-papeliz-diff-removed-ink`}
    >
      <CircleAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

export const papelizAccountFieldLabelClassName = 'mb-2 block text-[10.5px] font-bold tracking-[0.12em] text-papeliz-ink-subtle uppercase'

// Text links take the sliding underline; hover darkens, never lightens.
export const papelizAccountTextLinkClassName = `${papelizAccountStyles.papelizAccountSlidingUnderline} inline-block cursor-pointer font-semibold text-papeliz-ink disabled:cursor-not-allowed disabled:opacity-60`

const papelizAccountLegalLinkClassName = `${papelizAccountStyles.papelizAccountSlidingUnderline} inline-block font-medium text-papeliz-ink-muted transition-colors hover:text-papeliz-ink`

// Papeliz's mark on its own, at the top of every card.
export function PapelizAccountCardMark() {
  return (
    <span
      className={`${papelizAccountStyles.papelizAccountMorphMark} mx-auto mb-4 grid size-14 place-items-center rounded-[14px] bg-linear-to-br from-papeliz-gradient-start to-papeliz-gradient-end shadow-[0_6px_16px_rgb(0_64_160/0.22)]`}
    >
      <PapelizMark size={40} papelizMarkTone="on-blue" />
    </span>
  )
}

// The mark and the name, linking home. Every link off this page is a plain one, a full page load,
// so Clerk, which only this page loads, never stays running on another page.
export function PapelizAccountBrand({ papelizAccountBrandSize = 'large' }: { papelizAccountBrandSize?: 'large' | 'small' }) {
  const papelizAccountBrandIsSmall = papelizAccountBrandSize === 'small'
  return (
    // eslint-disable-next-line @next/next/no-html-link-for-pages -- a full page load leaves Clerk behind on this page
    <a
      href="/"
      aria-label="Papeliz home"
      className={`flex w-fit items-center gap-2.5 font-bold tracking-[-0.02em] text-papeliz-ink ${papelizAccountBrandIsSmall ? 'text-xl' : 'text-2xl'}`}
    >
      <span
        className={`grid shrink-0 place-items-center rounded-[8px] bg-linear-to-br from-papeliz-gradient-start to-papeliz-gradient-end ${papelizAccountBrandIsSmall ? 'size-7' : 'size-[34px]'}`}
      >
        <PapelizMark size={papelizAccountBrandIsSmall ? 20 : 24} papelizMarkTone="on-blue" />
      </span>
      Papeliz
    </a>
  )
}

// The signed-out page: one card in the blue frame, centered, with nothing outside it.
export function PapelizAccountCardFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center px-3 py-7 sm:px-6 sm:py-10">
      <div
        className={`${papelizAccountStyles.papelizAccountMorphCard} w-full max-w-[456px] rounded-[22px] border border-black/10 bg-papeliz-topbar p-2 shadow-[0_10px_28px_rgb(0_40_100/0.12)]`}
      >
        <div className="rounded-[14px] border border-papeliz-line bg-papeliz-surface px-[18px] pt-[26px] pb-5 sm:px-[30px] sm:pt-8 sm:pb-6">{children}</div>
      </div>
    </div>
  )
}

// A message under the fields: an error, or a blue notice, centered under the button.
export function PapelizAccountCardNotice({ papelizAccountNoticeTone, children }: { papelizAccountNoticeTone: 'error' | 'notice'; children: ReactNode }) {
  return (
    <p
      role={papelizAccountNoticeTone === 'error' ? 'alert' : 'status'}
      className={`${papelizAccountStyles.papelizAccountNoticeEnter} mt-3 rounded-[9px] border px-3 py-2 text-[13px] leading-snug text-pretty ${
        papelizAccountNoticeTone === 'error'
          ? 'border-papeliz-diff-removed-ink/40 bg-papeliz-diff-removed text-papeliz-diff-removed-ink'
          : 'border-papeliz-blue-line bg-papeliz-blue-soft text-center text-papeliz-blue'
      }`}
    >
      {children}
    </p>
  )
}

export function PapelizAccountLegalLine() {
  return (
    <p
      className={`${papelizAccountStyles.papelizAccountMorphLegal} mx-auto mt-[26px] max-w-[330px] text-center text-xs leading-relaxed text-balance text-papeliz-ink-subtle`}
    >
      By continuing, you agree to our{' '}
      <a href="/terms/" className={papelizAccountLegalLinkClassName}>
        Terms of Service
      </a>{' '}
      and{' '}
      <a href="/privacy/" className={papelizAccountLegalLinkClassName}>
        Privacy Policy
      </a>
      .
    </p>
  )
}
