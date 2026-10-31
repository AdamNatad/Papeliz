// The local Workers' front door for `webapp start sync-local` (papeliz-launcher.mjs). One `wrangler dev`
// runs this Worker first, beside the real Account Worker and Sync Worker; only the first Worker of a
// `wrangler dev` answers on its port, so this one hands each request on:
// - `/api/account/*` to the Account Worker and `/api/sync/*` (the live connection included) to the
//   Sync Worker, by service binding;
// - `/papeliz-sync-local-r2-storage/<bucket>/<object key>` to R2's local stand-in. The Sync Worker
//   signs its upload and download links for R2's S3 host, which the local runtime has no copy of, so
//   this Worker rewrites those links in the Sync Worker's replies to point here, on the app's own
//   origin, and answers them from the same local buckets the Sync Worker binds;
// - `/papeliz-sync-local-workers/account-plan`: GET lists the local accounts and their plans; POST
//   gives them a plan, as the payment provider's webhook will once billing is built.
// It never runs on Cloudflare. The webapp's dev server proxies these paths here
// (papeliz-sync-engine-vite-plugin.mjs).
import papelizSyncR2StorageStandIn from '../../sync/papeliz-sync-client/test/end-to-end/papeliz-sync-test-storage-and-sign-in-stand-in.mjs'

const papelizSyncLocalR2StoragePathPrefix = '/papeliz-sync-local-r2-storage'
const papelizSyncLocalAccountPlanPath = '/papeliz-sync-local-workers/account-plan'
// R2's S3 host, with `.eu` before `r2.cloudflarestorage.com` for a bucket in the EU jurisdiction.
const papelizSyncR2S3OriginPattern = /https:\/\/[0-9a-f]{32}(?:\.eu)?\.r2\.cloudflarestorage\.com\//g
const papelizSyncLocalPlanNames = ['standard', 'plus', 'pro']

// The Sync Worker's reply, with every R2 link turned into this origin's local storage path.
async function rewritePapelizSyncR2LinksInVaultReply(vaultWorkerResponse, papelizSyncLocalOrigin) {
  if (!(vaultWorkerResponse.headers.get('content-type') ?? '').includes('application/json')) return vaultWorkerResponse
  const vaultReplyText = await vaultWorkerResponse.text()
  const rewrittenVaultReplyHeaders = new Headers(vaultWorkerResponse.headers)
  rewrittenVaultReplyHeaders.delete('content-length')
  return new Response(vaultReplyText.replace(papelizSyncR2S3OriginPattern, `${papelizSyncLocalOrigin}${papelizSyncLocalR2StoragePathPrefix}/`), {
    status: vaultWorkerResponse.status,
    statusText: vaultWorkerResponse.statusText,
    headers: rewrittenVaultReplyHeaders,
  })
}

// The local accounts, from the Account Worker's directory (the same local D1 database).
async function listPapelizSyncLocalAccounts(routerBindings) {
  const { results: localAccountRows } = await routerBindings.PAPELIZ_SYNC_ACCOUNT_DIRECTORY.prepare(
    'SELECT papeliz_sync_account_id, sync_plan_name, sync_subscription_state FROM papeliz_sync_account_directory_entries ORDER BY sync_account_created_at',
  ).all()
  return localAccountRows.map((localAccountRow) => ({
    papelizSyncAccountId: localAccountRow.papeliz_sync_account_id,
    syncPlanName: localAccountRow.sync_plan_name,
    syncSubscriptionState: localAccountRow.sync_subscription_state,
  }))
}

// `{ "syncPlanName": "standard" | "plus" | "pro" | null, "papelizSyncAccountId"?: "pzacct_…" }`: an
// active subscription renewing in 30 days, or none, for the one account or else every local account.
async function setPapelizSyncLocalAccountPlan(localAccountPlanRequest, routerBindings) {
  const { papelizSyncAccountId, syncPlanName } = await localAccountPlanRequest.json().catch(() => ({}))
  if (syncPlanName !== null && !papelizSyncLocalPlanNames.includes(syncPlanName)) {
    return Response.json({ localAccountPlanError: `syncPlanName must be one of ${papelizSyncLocalPlanNames.join(', ')}, or null` }, { status: 400 })
  }
  if (papelizSyncAccountId !== undefined && (typeof papelizSyncAccountId !== 'string' || !/^pzacct_[a-z]+_[a-z2-7]{26}$/.test(papelizSyncAccountId))) {
    return Response.json({ localAccountPlanError: 'papelizSyncAccountId, when given, must be an account ID (pzacct_…)' }, { status: 400 })
  }
  const papelizSyncAccountIds =
    papelizSyncAccountId === undefined ? (await listPapelizSyncLocalAccounts(routerBindings)).map((localAccount) => localAccount.papelizSyncAccountId) : [papelizSyncAccountId]
  // The local runtime has no jurisdictions, so every Account Durable Object is named by its account ID.
  const accountDurableObjectNamespace = routerBindings.PAPELIZ_SYNC_ACCOUNT_DURABLE_OBJECT
  const nowAt = Date.now()
  const localAccountPlanOutcomes = {}
  for (const papelizSyncLocalAccountId of papelizSyncAccountIds) {
    localAccountPlanOutcomes[papelizSyncLocalAccountId] = await accountDurableObjectNamespace
      .get(accountDurableObjectNamespace.idFromName(papelizSyncLocalAccountId))
      .applyPapelizSyncSubscriptionChange({
        syncPlanName,
        syncSubscriptionState: syncPlanName === null ? 'not-subscribed' : 'active',
        syncSubscriptionRenewsAt: syncPlanName === null ? null : nowAt + 30 * 86_400_000,
        syncSubscriptionEndsAt: null,
        syncReadOnlyUntil: null,
        syncSyncedCopyDeletedAt: null,
        isSyncDiscountApplied: false,
        papelizSyncRequestedAt: nowAt,
      })
  }
  return Response.json(localAccountPlanOutcomes)
}

export default {
  async fetch(routerRequest, routerBindings) {
    const routerRequestUrl = new URL(routerRequest.url)
    const routerRequestPath = routerRequestUrl.pathname
    if (routerRequestPath.startsWith('/api/account/')) return routerBindings.PAPELIZ_SYNC_ACCOUNT_WORKER.fetch(routerRequest)
    if (routerRequestPath.startsWith('/api/sync/')) {
      const vaultWorkerResponse = await routerBindings.PAPELIZ_SYNC_VAULT_WORKER.fetch(routerRequest)
      if (vaultWorkerResponse.webSocket) return vaultWorkerResponse
      return rewritePapelizSyncR2LinksInVaultReply(vaultWorkerResponse, routerRequestUrl.origin)
    }
    if (routerRequestPath.startsWith(`${papelizSyncLocalR2StoragePathPrefix}/`)) {
      const storageStandInUrl = new URL(routerRequestUrl)
      storageStandInUrl.pathname = routerRequestPath.slice(papelizSyncLocalR2StoragePathPrefix.length)
      return papelizSyncR2StorageStandIn.fetch(new Request(storageStandInUrl, routerRequest), routerBindings)
    }
    if (routerRequestPath === papelizSyncLocalAccountPlanPath && routerRequest.method === 'GET') return Response.json(await listPapelizSyncLocalAccounts(routerBindings))
    if (routerRequestPath === papelizSyncLocalAccountPlanPath && routerRequest.method === 'POST') return setPapelizSyncLocalAccountPlan(routerRequest, routerBindings)
    return new Response('Not a Papeliz Sync path', { status: 404 })
  },
}
