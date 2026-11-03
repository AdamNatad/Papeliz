import { describe, expect, it } from 'vitest'
import { describePapelizAssistantModelShortName, listPapelizAssistantModelNameHyphenCuts } from './papeliz-assistant-model-short-names'

describe('the model chip’s shorter names', () => {
  it('drops Meta’s "muse-" and a provider’s prefix, and tags a Contributor id', () => {
    expect(describePapelizAssistantModelShortName('muse-spark-1.3')).toEqual({ modelShortName: 'spark-1.3', isContributorModel: false })
    expect(describePapelizAssistantModelShortName('muse-spark-1.3-contributor')).toEqual({ modelShortName: 'spark-1.3', isContributorModel: true })
    expect(describePapelizAssistantModelShortName('meta/muse-spark-1.2-contributor')).toEqual({ modelShortName: 'spark-1.2', isContributorModel: true })
    expect(describePapelizAssistantModelShortName('openai/gpt-oss-120b')).toEqual({ modelShortName: 'gpt-oss-120b', isContributorModel: false })
    expect(describePapelizAssistantModelShortName('my-local-model-7b')).toEqual({ modelShortName: 'my-local-model-7b', isContributorModel: false })
    expect(describePapelizAssistantModelShortName('-contributor')).toEqual({ modelShortName: '-contributor', isContributorModel: false })
  })

  it('cuts a long name after whole hyphen parts, never inside a word', () => {
    expect(listPapelizAssistantModelNameHyphenCuts('my-local-model-7b')).toEqual(['my-local-model…', 'my-local…', 'my…'])
    expect(listPapelizAssistantModelNameHyphenCuts('spark-1.3')).toEqual(['spark…'])
    expect(listPapelizAssistantModelNameHyphenCuts('llama3')).toEqual([])
  })
})
