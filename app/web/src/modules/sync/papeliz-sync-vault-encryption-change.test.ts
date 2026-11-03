import { describe, expect, it } from 'vitest'
import { createPapelizSyncFakeEngine, type PapelizSyncFakeEngine } from './papeliz-sync-fake-engine'
import { turnPapelizSyncOnForNewVaultWhenWaiting, waitToTurnPapelizSyncOnForNewVault } from './papeliz-sync-new-vault-turn-on'
import {
  changePapelizSyncVaultEncryption,
  readPapelizSyncVaultOtherEncryptionKind,
  turnPapelizSyncOnAgainWithOtherEncryption,
  type PapelizSyncVaultEncryptionChangeStep,
} from './papeliz-sync-vault-encryption-change'

// Change Encryption, against the fake engine: the synced copy deleted, then Sync on again with the
// other kind; where it stops when a step fails, and Try Again's second step alone. Then New Vault's
// "Sync This Vault", turned on once the new vault is attached.

const goodTestPassphrase = 'maple river cloud lantern'

async function turnTestVaultSyncOnAsStandard(papelizSyncFakeEngine: PapelizSyncFakeEngine): Promise<string> {
  const syncTurnOnOutcome = await papelizSyncFakeEngine.turnSyncOnForVault('vault-notes', { syncVaultEncryptionKind: 'standard' })
  if (syncTurnOnOutcome.syncActionOutcome !== 'done') throw new Error('Sync didn’t turn on for the test vault.')
  return syncTurnOnOutcome.syncActionDoneValue.papelizSyncVaultId
}

function readTestVaultEncryptionKind(papelizSyncFakeEngine: PapelizSyncFakeEngine) {
  return papelizSyncFakeEngine.getSyncEngineSnapshot().syncLocalVaults.find((syncLocalVault) => syncLocalVault.papelizVaultId === 'vault-notes')?.syncVaultEncryptionKind
}

describe('Change Encryption', () => {
  it('names the other kind', () => {
    expect(readPapelizSyncVaultOtherEncryptionKind('standard')).toBe('end-to-end')
    expect(readPapelizSyncVaultOtherEncryptionKind('end-to-end')).toBe('standard')
  })

  it('deletes the synced copy, then turns Sync on again End-to-end with the passphrase', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'nothing-synced-yet' })
    const papelizSyncVaultId = await turnTestVaultSyncOnAsStandard(papelizSyncFakeEngine)
    papelizSyncFakeEngine.fakeEngineCallNames.length = 0
    const changeSteps: PapelizSyncVaultEncryptionChangeStep[] = []
    const syncVaultEncryptionChangeOutcome = await changePapelizSyncVaultEncryption(
      papelizSyncFakeEngine,
      { papelizVaultId: 'vault-notes', papelizSyncVaultId, newSyncVaultEncryptionChoice: { syncVaultEncryptionKind: 'end-to-end', syncVaultPassphrase: goodTestPassphrase } },
      (changeStep) => changeSteps.push(changeStep),
    )
    expect(syncVaultEncryptionChangeOutcome.syncVaultEncryptionChangeOutcome).toBe('changed')
    expect(changeSteps).toEqual(['deleting-synced-copy', 'turning-sync-on'])
    expect(papelizSyncFakeEngine.fakeEngineCallNames).toEqual(['deleteSyncedVaultFromAccount', 'turnSyncOnForVault'])
    expect(papelizSyncFakeEngine.fakeTurnedOnSyncVaultEncryptionChoices.at(-1)).toEqual({
      papelizVaultId: 'vault-notes',
      syncVaultEncryptionChoice: { syncVaultEncryptionKind: 'end-to-end', syncVaultPassphrase: goodTestPassphrase },
    })
    expect(readTestVaultEncryptionKind(papelizSyncFakeEngine)).toBe('end-to-end')
  })

  it('changes nothing when the synced copy can’t be deleted', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'nothing-synced-yet' })
    const papelizSyncVaultId = await turnTestVaultSyncOnAsStandard(papelizSyncFakeEngine)
    await papelizSyncFakeEngine.signOutOfSync()
    papelizSyncFakeEngine.fakeEngineCallNames.length = 0
    const syncVaultEncryptionChangeOutcome = await changePapelizSyncVaultEncryption(
      papelizSyncFakeEngine,
      { papelizVaultId: 'vault-notes', papelizSyncVaultId, newSyncVaultEncryptionChoice: { syncVaultEncryptionKind: 'end-to-end', syncVaultPassphrase: goodTestPassphrase } },
      () => undefined,
    )
    expect(syncVaultEncryptionChangeOutcome).toMatchObject({
      syncVaultEncryptionChangeOutcome: 'failed',
      failedSyncVaultEncryptionChangeStep: 'deleting-synced-copy',
      failedSyncActionOutcome: { syncActionFailureKind: 'signed-out' },
    })
    expect(papelizSyncFakeEngine.fakeEngineCallNames).toEqual(['deleteSyncedVaultFromAccount'])
  })

  it('says where it stopped when Sync doesn’t turn on again, and Try Again runs only that step', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'nothing-synced-yet' })
    const papelizSyncVaultId = await turnTestVaultSyncOnAsStandard(papelizSyncFakeEngine)
    const syncVaultEncryptionChangeOutcome = await changePapelizSyncVaultEncryption(
      papelizSyncFakeEngine,
      { papelizVaultId: 'vault-notes', papelizSyncVaultId, newSyncVaultEncryptionChoice: { syncVaultEncryptionKind: 'end-to-end', syncVaultPassphrase: 'too short' } },
      () => undefined,
    )
    expect(syncVaultEncryptionChangeOutcome).toMatchObject({
      syncVaultEncryptionChangeOutcome: 'failed',
      failedSyncVaultEncryptionChangeStep: 'turning-sync-on',
      failedSyncActionOutcome: { syncActionFailureKind: 'passphrase-too-short' },
    })
    // The synced copy is gone, so the vault doesn't sync until Sync is on again.
    expect(readTestVaultEncryptionKind(papelizSyncFakeEngine)).toBeUndefined()
    papelizSyncFakeEngine.fakeEngineCallNames.length = 0
    const retriedChangeOutcome = await turnPapelizSyncOnAgainWithOtherEncryption(
      papelizSyncFakeEngine,
      'vault-notes',
      { syncVaultEncryptionKind: 'end-to-end', syncVaultPassphrase: goodTestPassphrase },
      () => undefined,
    )
    expect(retriedChangeOutcome.syncVaultEncryptionChangeOutcome).toBe('changed')
    expect(papelizSyncFakeEngine.fakeEngineCallNames).toEqual(['turnSyncOnForVault'])
    expect(readTestVaultEncryptionKind(papelizSyncFakeEngine)).toBe('end-to-end')
  })

  it('goes back to Standard with no passphrase', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'nothing-synced-yet' })
    const endToEndTurnOnOutcome = await papelizSyncFakeEngine.turnSyncOnForVault('vault-notes', { syncVaultEncryptionKind: 'end-to-end', syncVaultPassphrase: goodTestPassphrase })
    if (endToEndTurnOnOutcome.syncActionOutcome !== 'done') throw new Error('Sync didn’t turn on for the test vault.')
    const syncVaultEncryptionChangeOutcome = await changePapelizSyncVaultEncryption(
      papelizSyncFakeEngine,
      { papelizVaultId: 'vault-notes', papelizSyncVaultId: endToEndTurnOnOutcome.syncActionDoneValue.papelizSyncVaultId, newSyncVaultEncryptionChoice: { syncVaultEncryptionKind: 'standard' } },
      () => undefined,
    )
    expect(syncVaultEncryptionChangeOutcome.syncVaultEncryptionChangeOutcome).toBe('changed')
    expect(readTestVaultEncryptionKind(papelizSyncFakeEngine)).toBe('standard')
  })
})

describe('New Vault’s "Sync This Vault"', () => {
  it('turns Sync on once, with the kind picked, when the new vault is attached', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'nothing-synced-yet' })
    waitToTurnPapelizSyncOnForNewVault('vault-new', { syncVaultEncryptionKind: 'end-to-end', syncVaultPassphrase: goodTestPassphrase })
    expect(turnPapelizSyncOnForNewVaultWhenWaiting(papelizSyncFakeEngine, 'vault-other')).toBeNull()
    const newVaultSyncTurnOnOutcome = await turnPapelizSyncOnForNewVaultWhenWaiting(papelizSyncFakeEngine, 'vault-new')
    expect(newVaultSyncTurnOnOutcome?.syncActionOutcome).toBe('done')
    expect(papelizSyncFakeEngine.fakeTurnedOnSyncVaultEncryptionChoices).toEqual([
      { papelizVaultId: 'vault-new', syncVaultEncryptionChoice: { syncVaultEncryptionKind: 'end-to-end', syncVaultPassphrase: goodTestPassphrase } },
    ])
    // Taken once: attaching the vault again turns nothing on.
    expect(turnPapelizSyncOnForNewVaultWhenWaiting(papelizSyncFakeEngine, 'vault-new')).toBeNull()
  })
})
