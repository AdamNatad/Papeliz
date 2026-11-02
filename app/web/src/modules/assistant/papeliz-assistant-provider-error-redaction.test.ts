import { describe, expect, it } from 'vitest'
import { papelizHiddenProviderSecretText, redactPapelizAssistantProviderErrorText } from './papeliz-assistant-provider-error-redaction'

// Every key here is fake, and says so.
const fakeOpenRouterApiKey = 'sk-or-v1-papeliz-fake-test-key-0000000000000000'
const fakeCustomProxyApiKey = 'papeliz/fake+proxy=key-0000'

describe('provider error text cleaning', () => {
  it('hides every copy of the saved key, also as it reads in an address', () => {
    const customProxyErrorText = `Key ${fakeCustomProxyApiKey} is not active (sent as ${encodeURIComponent(fakeCustomProxyApiKey)}).`
    expect(redactPapelizAssistantProviderErrorText(customProxyErrorText, `  ${fakeCustomProxyApiKey}  `)).toBe('Key [hidden] is not active (sent as [hidden]).')
  })

  it('leaves a short placeholder key alone in ordinary words', () => {
    expect(redactPapelizAssistantProviderErrorText('The local server is not running.', 'local')).toBe('The local server is not running.')
  })

  it('hides Bearer tokens and Authorization or x-api-key header values', () => {
    const proxyHeaderEchoText = [
      'upstream refused the request',
      `authorization: Bearer ${fakeOpenRouterApiKey}`,
      'x-api-key: papelizFakeHeaderKey0000',
      'x-goog-api-key: papeliz-fake-goog-key-0000',
    ].join('\n')
    expect(redactPapelizAssistantProviderErrorText(proxyHeaderEchoText, '')).toBe(
      ['upstream refused the request', 'authorization: Bearer [hidden]', 'x-api-key: [hidden]', 'x-goog-api-key: [hidden]'].join('\n'),
    )
    expect(
      redactPapelizAssistantProviderErrorText('{"headers":{"Authorization":"Bearer papeliz-fake-token-0000","api_key":"papeliz-fake-0000"}}', ''),
    ).toBe('{"headers":{"Authorization":"Bearer [hidden]","api_key":"[hidden]"}}')
    expect(redactPapelizAssistantProviderErrorText('Token rejected: Bearer papeliz.fake.jwt0000.', '')).toBe('Token rejected: Bearer [hidden].')
  })

  it('hides key, api_key and token values in an address', () => {
    expect(
      redactPapelizAssistantProviderErrorText('Request to https://generativelanguage.googleapis.com/v1beta/openai/models?key=papeliz-fake-0000&alt=json failed', ''),
    ).toBe('Request to https://generativelanguage.googleapis.com/v1beta/openai/models?key=[hidden]&alt=json failed')
    expect(redactPapelizAssistantProviderErrorText('Refused https://proxy.example/v1/chat?api_key=abc&token=xyz.', '')).toBe(
      'Refused https://proxy.example/v1/chat?api_key=[hidden]&token=[hidden].',
    )
  })

  it('hides sk-… and other prefixed keys, and long key-like tokens', () => {
    expect(
      redactPapelizAssistantProviderErrorText(
        'Key sk-proj-PAPELIZ_FAKE_0000 was revoked; gsk_papeliz_fake_test_0000 too; also AIzaPapelizFakeTestKey_0000000 and 0123456789abcdef0123456789abcdef.',
        '',
      ),
    ).toBe('Key [hidden] was revoked; [hidden] too; also [hidden] and [hidden].')
  })

  it('leaves ordinary provider errors unchanged', () => {
    const ordinaryProviderErrorTexts = [
      // A key the provider already masked keeps the last characters that tell the user which one it was.
      'Incorrect API key provided: sk-proj-************************abcd. You can find your API key at https://platform.openai.com/account/api-keys.',
      'This model’s maximum context length is 128000 tokens. However, your messages resulted in 131072 tokens. Please reduce the length of the messages.',
      'Unrecognized request argument supplied: stream_options',
      'API key not valid. Please pass a valid API key.',
      'Missing Authorization header. Send your key as Bearer auth.',
      'Rate limit reached for requests per minute (RPM): Limit 30, Used 30, Requested 1. Please try again in 2s.',
      'The model `gpt-4o-mini` does not exist or you do not have access to it.',
    ]
    for (const ordinaryProviderErrorText of ordinaryProviderErrorTexts) {
      expect(redactPapelizAssistantProviderErrorText(ordinaryProviderErrorText, fakeOpenRouterApiKey)).toBe(ordinaryProviderErrorText)
    }
  })

  it('cleans text it already cleaned the same way', () => {
    const proxyHeaderEchoText = `Authorization: Bearer ${fakeOpenRouterApiKey} and ?key=${fakeCustomProxyApiKey}`
    const redactedErrorText = redactPapelizAssistantProviderErrorText(proxyHeaderEchoText, fakeOpenRouterApiKey)
    expect(redactedErrorText).not.toContain('papeliz')
    expect(redactedErrorText.split(papelizHiddenProviderSecretText)).toHaveLength(3)
    expect(redactPapelizAssistantProviderErrorText(redactedErrorText, fakeOpenRouterApiKey)).toBe(redactedErrorText)
  })
})
