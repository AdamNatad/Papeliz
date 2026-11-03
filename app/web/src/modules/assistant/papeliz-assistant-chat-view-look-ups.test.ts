import { describe, expect, it } from 'vitest'
import { describePapelizAssistantToolActivityFold, groupPapelizAssistantConversationChatEntries } from './papeliz-assistant-chat-view'
import type { PapelizAssistantChatEntry } from './papeliz-assistant-conversation-store'

type PapelizTestToolActivityEntry = Extract<PapelizAssistantChatEntry, { chatEntryKind: 'tool-activity' }>

function buildToolActivityEntry(chatEntryId: string, toolActivityKind: PapelizTestToolActivityEntry['toolActivityKind'], toolActivityLabel: string, toolActivityVaultNoteRelativePaths: string[] = []) {
  return { chatEntryId, chatEntryKind: 'tool-activity', toolActivityKind, toolActivityLabel, toolActivityVaultNoteRelativePaths } as PapelizTestToolActivityEntry
}

describe('the look-ups of one answer, folded into one line', () => {
  it('says how many notes were read or looked at, and how many steps failed', () => {
    expect(describePapelizAssistantToolActivityFold([buildToolActivityEntry('1', 'read', 'Read Inbox', ['Inbox.md'])])).toBe('Read 1 note')
    expect(
      describePapelizAssistantToolActivityFold([
        buildToolActivityEntry('1', 'read', 'Read Inbox', ['Inbox.md']),
        buildToolActivityEntry('2', 'read', 'Read Garden plan', ['Projects/Garden plan.md']),
        buildToolActivityEntry('3', 'read', 'Read Inbox again', ['Inbox.md']),
      ]),
    ).toBe('Read 2 notes')
    expect(
      describePapelizAssistantToolActivityFold([
        buildToolActivityEntry('1', 'searched', 'Searched for “garden”', ['Projects/Garden plan.md', 'Inbox.md']),
        buildToolActivityEntry('2', 'read', 'Read Garden plan', ['Projects/Garden plan.md']),
        buildToolActivityEntry('3', 'failed', 'Couldn’t read Old plan'),
      ]),
    ).toBe('Looked at 2 notes · 1 failed')
    // With no note, one step says itself, and several are counted.
    expect(describePapelizAssistantToolActivityFold([buildToolActivityEntry('1', 'searched', 'Searched for “zebra”')])).toBe('Searched for “zebra”')
    expect(describePapelizAssistantToolActivityFold([buildToolActivityEntry('1', 'failed', 'Couldn’t list the vault')])).toBe('Couldn’t list the vault')
    expect(
      describePapelizAssistantToolActivityFold([buildToolActivityEntry('1', 'searched', 'Searched for “zebra”'), buildToolActivityEntry('2', 'failed', 'Couldn’t list the vault')]),
    ).toBe('2 steps · 1 failed')
  })

  it('gathers each run of look-ups into one fold, and leaves out what a plan’s build drew under its steps', () => {
    const chatEntries = [
      { chatEntryId: 'u1', chatEntryKind: 'user-message', userMessageText: 'What did I plan?' },
      buildToolActivityEntry('t1', 'searched', 'Searched for “plan”', ['Plans/A.md']),
      buildToolActivityEntry('t2', 'read', 'Read A', ['Plans/A.md']),
      { chatEntryId: 'a1', chatEntryKind: 'assistant-message', assistantMessageText: 'A plan.' },
      { ...buildToolActivityEntry('t3', 'read', 'Read B', ['B.md']), assistantPlanStepRun: { planChatEntryId: 'p', planStepId: 's' } },
      buildToolActivityEntry('t4', 'read', 'Read C', ['C.md']),
    ] as unknown as PapelizAssistantChatEntry[]
    expect(
      groupPapelizAssistantConversationChatEntries(chatEntries).map((chatEntryGroup) =>
        chatEntryGroup.chatEntryGroupKind === 'chat-entry'
          ? chatEntryGroup.chatEntry.chatEntryId
          : chatEntryGroup.toolActivityEntries.map((toolActivityEntry) => toolActivityEntry.chatEntryId).join('+'),
      ),
    ).toEqual(['u1', 't1+t2', 'a1', 't4'])
  })
})
