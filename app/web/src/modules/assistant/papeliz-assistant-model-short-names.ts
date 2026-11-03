// The model chip's shorter names, for a chat box's row too narrow for the whole id
// (papeliz-assistant-composer-row-fit.ts):
// - The short name drops a provider's "vendor/" prefix, and Meta's "muse-": `spark-1.3`.
// - A Contributor id (`…-contributor`) drops that word for a small C tag beside the name, since in
//   Contributor mode what is sent may be used for training.
// - Last, a long name the person typed is cut after a whole hyphen part, never inside a word:
//   `my-local-model…`, `my-local…`, `my…`.

export interface PapelizAssistantModelShortName {
  modelShortName: string
  isContributorModel: boolean
}

const papelizContributorModelNameSuffix = '-contributor'

export function describePapelizAssistantModelShortName(providerModelName: string): PapelizAssistantModelShortName {
  const trimmedProviderModelName = providerModelName.trim()
  const unprefixedProviderModelName = trimmedProviderModelName.slice(trimmedProviderModelName.lastIndexOf('/') + 1)
  const isContributorModel =
    unprefixedProviderModelName.length > papelizContributorModelNameSuffix.length && unprefixedProviderModelName.toLowerCase().endsWith(papelizContributorModelNameSuffix)
  const modelNameWithoutContributor = isContributorModel ? unprefixedProviderModelName.slice(0, -papelizContributorModelNameSuffix.length) : unprefixedProviderModelName
  return {
    modelShortName: /^muse-spark-/i.test(modelNameWithoutContributor) ? modelNameWithoutContributor.slice('muse-'.length) : modelNameWithoutContributor,
    isContributorModel,
  }
}

// Shorter and shorter cuts of a name, each after a whole hyphen part: "my-local-model-7b" gives
// "my-local-model…", "my-local…" and "my…". A name with no hyphen gives none.
export function listPapelizAssistantModelNameHyphenCuts(modelShortName: string): string[] {
  const modelNameParts = modelShortName.split('-')
  const modelNameHyphenCuts: string[] = []
  for (let keptModelNamePartCount = modelNameParts.length - 1; keptModelNamePartCount >= 1; keptModelNamePartCount--) {
    const keptModelNameText = modelNameParts.slice(0, keptModelNamePartCount).join('-')
    if (keptModelNameText.length > 0) modelNameHyphenCuts.push(`${keptModelNameText}…`)
  }
  return modelNameHyphenCuts
}
