import { useState } from 'react'
import { PapelizPillButton, papelizMainActionButtonColorClassName } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { usePapelizSyncFlowStore } from './papeliz-sync-flow-store'
import { PapelizSyncFailureLine } from './papeliz-sync-page-parts'

// When the browser blocked the sign-in tab: Copy Sign-In URL to Clipboard, for pasting the address into a
// tab of their own, and, on the right as in every footer, a Sign In link the person presses themselves (a
// browser opens a link that is pressed, where it blocks a tab opened for it). The sign-in waits for that
// page as for a tab that opened, and this goes once it ends. Nothing shows while no sign-in is blocked.

type PapelizSyncSignInAddressCopyState = 'not-copied' | 'copied' | 'copy-failed'

type PapelizSyncSignInLinksAlignment = 'centered' | 'from-left-edge'

interface PapelizSyncSignInLinksProps {
  signInLinksAlignment?: PapelizSyncSignInLinksAlignment
  className?: string
}

export function PapelizSyncBlockedSignInLinks({ signInLinksAlignment, className }: PapelizSyncSignInLinksProps) {
  const blockedSyncSignInPageUrl = usePapelizSyncFlowStore((syncFlowState) => syncFlowState.blockedSyncSignInPageUrl)
  return blockedSyncSignInPageUrl === null ? null : (
    <PapelizSyncSignInPageLinks syncSignInPageUrl={blockedSyncSignInPageUrl} signInLinksAlignment={signInLinksAlignment} className={className} />
  )
}

export function PapelizSyncSignInPageLinks({ syncSignInPageUrl, signInLinksAlignment = 'centered', className }: PapelizSyncSignInLinksProps & { syncSignInPageUrl: string }) {
  const isSignInLinksCentered = signInLinksAlignment === 'centered'
  // Kept with the address it is about, so a newer sign-in starts uncopied.
  const [signInAddressCopy, setSignInAddressCopy] = useState<{ copiedSyncSignInPageUrl: string; signInAddressCopyState: PapelizSyncSignInAddressCopyState } | null>(null)
  const signInAddressCopyState = signInAddressCopy?.copiedSyncSignInPageUrl === syncSignInPageUrl ? signInAddressCopy.signInAddressCopyState : 'not-copied'

  const copySignInAddress = () => {
    void navigator.clipboard
      .writeText(syncSignInPageUrl)
      .then(
        () => 'copied' as const,
        () => 'copy-failed' as const,
      )
      .then((nextSignInAddressCopyState) => setSignInAddressCopy({ copiedSyncSignInPageUrl: syncSignInPageUrl, signInAddressCopyState: nextSignInAddressCopyState }))
  }

  return (
    <div className={joinPapelizClassNames('flex flex-col gap-2', isSignInLinksCentered ? 'items-center text-center' : 'items-start text-left', className)}>
      <p className="max-w-[300px] text-[12.5px] leading-[1.45] text-papeliz-ink-muted">Your browser blocked the sign-in tab. Open it from here, or copy its address into a new tab.</p>
      <div className={joinPapelizClassNames('flex flex-wrap gap-2', isSignInLinksCentered && 'justify-center')}>
        <PapelizPillButton pillButtonVariant="line" pillButtonSize="small" onClick={copySignInAddress}>
          Copy Sign-In URL to Clipboard
        </PapelizPillButton>
        <a
          href={syncSignInPageUrl}
          target="_blank"
          rel="noopener"
          className={joinPapelizClassNames(
            'inline-flex h-[30px] flex-none items-center justify-center rounded-full px-3 text-[13px] font-medium whitespace-nowrap transition-[filter] duration-150 hover:brightness-110',
            papelizMainActionButtonColorClassName,
          )}
        >
          Sign In
        </a>
      </div>
      {signInAddressCopyState === 'copied' && (
        <p role="status" className="text-[12px] text-papeliz-ink-subtle">
          Copied. Paste it into a new tab to sign in.
        </p>
      )}
      {signInAddressCopyState === 'copy-failed' && <PapelizSyncFailureLine>Your browser didn’t allow copying. Use Sign In instead.</PapelizSyncFailureLine>}
    </div>
  )
}
