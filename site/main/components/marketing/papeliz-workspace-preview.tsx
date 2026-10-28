import { PapelizMark } from '@/components/logo/papeliz-mark'

// A drawn preview of the Papeliz workspace (not a screenshot): the app's blue top bar with the
// MD Code | MD View switch, files, MD Code with an inline edit, and the docked assistant.
export function PapelizWorkspacePreview() {
  return (
    <div
      role="img"
      aria-label="Papeliz workspace: a file list, a Markdown note with an inline edit shown as a diff, and the assistant panel"
      className="overflow-hidden rounded-3xl border border-papeliz-line bg-papeliz-surface text-left shadow-papeliz-pop"
    >
      <div className="papeliz-site-selection-on-color grid h-11 grid-cols-[1fr_auto_1fr] items-center gap-2 bg-papeliz-topbar px-3 text-white">
        <span className="flex min-w-0 items-center gap-2">
          <PapelizMark size={22} papelizMarkTone="on-blue" className="flex-none" />
          <span className="min-w-0 truncate text-xs text-white/80 max-sm:hidden">Offline-first apps.md</span>
        </span>
        <span className="flex rounded-full bg-white/15 p-[3px] text-xs font-semibold whitespace-nowrap shadow-[inset_0_1px_2px_rgb(0_0_0/0.12)]">
          <span className="rounded-full bg-white px-3 py-1 text-papeliz-gradient-start shadow-sm">MD Code</span>
          <span className="px-3 py-1 text-white/85">MD View</span>
        </span>
        <span aria-hidden="true" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)_260px]">
        <div className="hidden border-r border-papeliz-line bg-papeliz-surface-soft p-3 text-[13px] md:block">
          <p className="px-2 pb-2 font-semibold">Field Notes</p>
          {['Daily', 'Ideas'].map((papelizPreviewFolder) => (
            <p key={papelizPreviewFolder} className="px-2 py-1 font-medium">{papelizPreviewFolder}</p>
          ))}
          <p className="ml-3 rounded-full bg-papeliz-blue-soft px-2 py-1 font-medium text-papeliz-blue">Offline-first apps</p>
          <p className="ml-3 px-2 py-1 text-papeliz-ink-muted">Local-first sync</p>
          <p className="px-2 py-1 font-medium">Reading</p>
          <p className="ml-3 px-2 py-1 text-papeliz-ink-muted">CRDT reading notes</p>
        </div>

        <div className="p-5 font-mono text-[12.5px] leading-7">
          <p><span className="text-papeliz-ink-subtle"># </span><b>Offline-first apps</b></p>
          <p className="mt-1">
            <span className="rounded bg-papeliz-selection">
              An app should keep working when the network drops, and catch up when it comes back.
            </span>
          </p>
          <div className="my-3 rounded-2xl border border-papeliz-blue-line bg-papeliz-surface p-3 font-sans text-[13px] leading-6 shadow-papeliz-pop">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {['Shorter', 'Rewrite', 'Fix grammar', 'Translate'].map((papelizPreviewChip, index) => (
                <span
                  key={papelizPreviewChip}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${index === 0 ? 'bg-papeliz-blue-soft text-papeliz-blue' : 'bg-papeliz-surface-gray'}`}
                >
                  {papelizPreviewChip}
                </span>
              ))}
            </div>
            <p>
              <span className="rounded bg-papeliz-diff-removed px-1 text-papeliz-diff-removed-ink line-through">
                An app should keep working when the network drops, and catch up when it comes back.
              </span>{' '}
              <span className="rounded bg-papeliz-diff-added px-1 text-papeliz-diff-added-ink">
                Offline-first means the app works without a network and syncs when it returns.
              </span>
            </p>
            <div className="mt-2 flex gap-2">
              <span className="rounded-full bg-linear-to-r from-papeliz-gradient-start to-papeliz-gradient-end px-3 py-1 text-xs font-medium text-white">Accept</span>
              <span className="rounded-full bg-papeliz-surface-gray px-3 py-1 text-xs font-medium">Reject</span>
            </div>
          </div>
          <p><span className="text-papeliz-ink-subtle">## </span><b>What I want</b></p>
          <p><span className="text-papeliz-ink-subtle">- [x] </span>Notes open instantly from disk</p>
          <p><span className="text-papeliz-ink-subtle">- [ ] </span>Two devices can edit the same note</p>
          <p>
            See <span className="text-papeliz-ink-subtle">[[</span>
            <span className="text-papeliz-blue">Local-first sync</span>
            <span className="text-papeliz-ink-subtle">]]</span>
          </p>
        </div>

        <div className="hidden border-l border-papeliz-line p-4 text-[13px] leading-6 md:block">
          <p className="mb-3 font-semibold">Assistant</p>
          <p className="mb-3 ml-auto w-fit max-w-[90%] rounded-2xl bg-papeliz-surface-gray px-3 py-2">
            What have I written about sync conflicts?
          </p>
          <p className="text-papeliz-ink">
            Three notes cover it. Start with last-writer-wins per note; you only need more once two
            people share a vault.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-papeliz-blue-soft px-2.5 py-0.5 text-xs font-medium text-papeliz-blue">Offline-first apps</span>
            <span className="rounded-full bg-papeliz-blue-soft px-2.5 py-0.5 text-xs font-medium text-papeliz-blue">CRDT reading notes</span>
          </div>
        </div>
      </div>
    </div>
  )
}
