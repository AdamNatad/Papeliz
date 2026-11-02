// A provider's error text, cleaned before Papeliz shows it or saves it in a chat file. A provider, or
// a proxy in front of one, may repeat the request back in its error: the key itself, the
// Authorization header, or an address with the key in its query. Each of those becomes "[hidden]",
// and so does anything else shaped like a key. Ordinary words stay as they are.

export const papelizHiddenProviderSecretText = '[hidden]'

// A saved key shorter than this is a local server's placeholder rather than a secret, and hiding
// every copy of it would hide ordinary words.
const papelizShortestHiddenProviderApiKeyLength = 6

// `Authorization: Bearer …`, `x-api-key: …`, `"api_key": "…"` and the like: as a header line, in
// JSON or in a dictionary, with or without a scheme word before the value.
const papelizProviderSecretHeaderPattern =
  /\b((?:proxy-)?authorization|(?:x-goog-|x-)?api[-_ ]?key|(?:x-)?(?:access|auth)[-_]token)(["']?[ \t]*[:=][ \t]*["']?)((?:bearer|basic|token)[ \t]+)?([^\s"'`,;&()<>[\]{}]+)/gi

const papelizProviderBearerTokenPattern = /\b(bearer[ \t]+)([A-Za-z0-9._~+/=-]+)/gi

// `?key=…`, `&api_key=…`, `access_token=…`: a query value is hidden whatever it looks like.
const papelizProviderSecretQueryValuePattern = /\b((?:[a-z0-9]+[-_])*(?:api[-_]?key|key|token|secret))=([^\s&#"'`<>()[\]{},;]+)/gi

// Keys their provider marks with a prefix: `sk-…` (with `sk-proj-…` and `sk-or-v1-…`), Groq's
// `gsk_…`, Fireworks' `fw_…`, Google's `AIza…` and a few others.
const papelizPrefixedProviderApiKeyPattern = /\b(?:sk|gsk|fw|xai|pplx|nvapi|tgp|hf)[-_][A-Za-z0-9_-]{12,}|\bAIza[A-Za-z0-9_-]{20,}/g

// Any other long run that reads as a key: somewhere in it, 24 letters and digits in a row, with both.
const papelizLongKeyLikeTokenPattern = /[A-Za-z0-9_+=.~-]{24,}/g
const papelizLongKeyLikeTokenPartPattern = /[A-Za-z0-9]{24,}/g

// The forms the saved key can take in an error: as sent, and as it reads inside an address or a
// JSON string. The key is sent trimmed, so a copy with its spaces holds a trimmed copy too.
function listProviderApiKeyForms(providerApiKey: string): string[] {
  const trimmedProviderApiKey = providerApiKey.trim()
  if (trimmedProviderApiKey.length < papelizShortestHiddenProviderApiKeyLength) return []
  const providerApiKeyForms = new Set([trimmedProviderApiKey, encodeURIComponent(trimmedProviderApiKey), JSON.stringify(trimmedProviderApiKey).slice(1, -1)])
  return [...providerApiKeyForms].sort((firstKeyForm, secondKeyForm) => secondKeyForm.length - firstKeyForm.length)
}

// A header or Bearer value that reads as a secret rather than a word: at least 8 characters, and
// either long or with a digit, symbol or capital letter after its first character.
function isProviderSecretLikeValue(candidateSecretValue: string): boolean {
  return candidateSecretValue.length >= 8 && (candidateSecretValue.length >= 20 || /[^a-z]/.test(candidateSecretValue.slice(1)))
}

function isLongKeyLikeToken(candidateTokenText: string): boolean {
  return (candidateTokenText.match(papelizLongKeyLikeTokenPartPattern) ?? []).some(
    (candidateTokenPart) => /\d/.test(candidateTokenPart) && /[A-Za-z]/.test(candidateTokenPart),
  )
}

// A sentence's full stop or colon after a value stays outside what is hidden.
function splitTrailingSentencePunctuation(matchedValueText: string): { valueText: string; trailingPunctuation: string } {
  const trailingPunctuation = /[.:!?]+$/.exec(matchedValueText)?.[0] ?? ''
  return { valueText: matchedValueText.slice(0, matchedValueText.length - trailingPunctuation.length), trailingPunctuation }
}

export function redactPapelizAssistantProviderErrorText(providerErrorText: string, providerApiKey: string): string {
  let redactedErrorText = providerErrorText
  for (const providerApiKeyForm of listProviderApiKeyForms(providerApiKey)) {
    redactedErrorText = redactedErrorText.replaceAll(providerApiKeyForm, papelizHiddenProviderSecretText)
  }
  return redactedErrorText
    .replace(
      papelizProviderSecretHeaderPattern,
      (headerMatchText, headerName: string, headerSeparator: string, headerScheme: string | undefined, headerValueText: string) => {
        const { valueText, trailingPunctuation } = splitTrailingSentencePunctuation(headerValueText)
        return isProviderSecretLikeValue(valueText) ? `${headerName}${headerSeparator}${headerScheme ?? ''}${papelizHiddenProviderSecretText}${trailingPunctuation}` : headerMatchText
      },
    )
    .replace(papelizProviderBearerTokenPattern, (bearerMatchText, bearerScheme: string, bearerTokenText: string) => {
      const { valueText, trailingPunctuation } = splitTrailingSentencePunctuation(bearerTokenText)
      return isProviderSecretLikeValue(valueText) ? `${bearerScheme}${papelizHiddenProviderSecretText}${trailingPunctuation}` : bearerMatchText
    })
    .replace(papelizProviderSecretQueryValuePattern, (queryMatchText, queryName: string, queryValueText: string) => {
      const { valueText, trailingPunctuation } = splitTrailingSentencePunctuation(queryValueText)
      return valueText.length > 0 ? `${queryName}=${papelizHiddenProviderSecretText}${trailingPunctuation}` : queryMatchText
    })
    .replace(papelizPrefixedProviderApiKeyPattern, papelizHiddenProviderSecretText)
    .replace(papelizLongKeyLikeTokenPattern, (tokenMatchText) => {
      const { valueText, trailingPunctuation } = splitTrailingSentencePunctuation(tokenMatchText)
      return isLongKeyLikeToken(valueText) ? `${papelizHiddenProviderSecretText}${trailingPunctuation}` : tokenMatchText
    })
}
