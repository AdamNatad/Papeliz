import type { Plugin } from 'vite'

// The webapp's `virtual:papeliz-mobile-platform` module (papeliz-mobile-platform-vite-plugin.mjs).
export declare function papelizMobilePlatformPlugin(): Plugin

// The mobile build's switch: the absolute path of the Android and iOS app's platform entry.
export declare const papelizMobilePlatformEntryVariableName: 'PAPELIZ_WEBAPP_MOBILE_PLATFORM_ENTRY'
export declare function readPapelizMobilePlatformEntryFilePath(): string | null
