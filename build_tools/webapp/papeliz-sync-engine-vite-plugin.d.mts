import type { Plugin } from 'vite'

// The webapp's `virtual:papeliz-sync-engine` module (papeliz-sync-engine-vite-plugin.mjs).
export declare function papelizSyncEnginePlugin(): Plugin

// The dev server's switch to the real engine against the local Workers (`webapp start sync-local`).
export declare const papelizSyncLocalWorkersOriginVariableName: 'PAPELIZ_WEBAPP_DEV_SYNC_LOCAL_WORKERS_ORIGIN'
export declare const papelizSyncSignInPageDevServerOriginVariableName: 'PAPELIZ_WEBAPP_DEV_SYNC_SIGN_IN_PAGE_DEV_SERVER_ORIGIN'
