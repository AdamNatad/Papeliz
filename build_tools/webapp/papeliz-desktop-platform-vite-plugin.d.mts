import type { Plugin } from 'vite'

// The webapp's `virtual:papeliz-desktop-platform` module (papeliz-desktop-platform-vite-plugin.mjs).
export declare function papelizDesktopPlatformPlugin(): Plugin

// The desktop build's switch: the absolute path of Papeliz for Windows' platform entry.
export declare const papelizDesktopPlatformEntryVariableName: 'PAPELIZ_WEBAPP_DESKTOP_PLATFORM_ENTRY'
export declare function readPapelizDesktopPlatformEntryFilePath(): string | null
