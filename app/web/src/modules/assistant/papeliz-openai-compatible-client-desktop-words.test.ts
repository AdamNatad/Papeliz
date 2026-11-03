import { describe, expect, it, vi } from 'vitest'
import { streamPapelizChatCompletion } from './papeliz-openai-compatible-client'

// This file runs as Papeliz for Windows does; the web build's message stays checked in
// papeliz-openai-compatible-client.test.ts.
vi.mock('virtual:papeliz-desktop-platform-availability', () => ({ isPapelizDesktopApp: true }))

describe('an unreachable provider in the desktop app', () => {
  it('asks whether the provider accepts calls from Papeliz, not from a browser', async () => {
    const providerErrorPromise = streamPapelizChatCompletion({
      providerConnection: { providerBaseUrl: 'https://provider.test/v1/', providerApiKey: 'test-key', providerModelName: 'test-model' },
      chatMessages: [{ role: 'user', content: 'Hi' }],
      fetchFunction: async () => {
        throw new TypeError('Failed to fetch')
      },
    })
    await expect(providerErrorPromise).rejects.toThrow(
      'Could not reach provider.test. Check the base URL and your connection, and that the provider accepts calls from Papeliz.',
    )
  })
})
