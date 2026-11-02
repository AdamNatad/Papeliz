import { PapelizAccountCardFrame, PapelizAccountCardMark, papelizAccountPrimaryButtonClassName } from './papeliz-account-card-frame'
import { papelizAccountAppPath } from './papeliz-account-config'

// In place of the sign-in and Create an account cards while signing in is closed
// (`isPapelizAccountSignInOpen`): a short Coming Soon, nothing to fill in, and no Clerk. A plan's
// Subscribe button on the website lands here too.
export function PapelizAccountSignInClosedNotice() {
  return (
    <PapelizAccountCardFrame>
      <PapelizAccountCardMark />
      <header className="text-center">
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em] text-balance">Coming Soon</h1>
        <p className="mx-auto mt-2 mb-[22px] max-w-[320px] text-xs leading-[1.6] text-balance text-papeliz-ink-muted">Accounts open when Sync launches.</p>
      </header>
      <a href={papelizAccountAppPath} className={papelizAccountPrimaryButtonClassName}>
        Open Papeliz
      </a>
    </PapelizAccountCardFrame>
  )
}
