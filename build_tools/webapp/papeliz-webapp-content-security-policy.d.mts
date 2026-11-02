// The built app's Content-Security-Policy (papeliz-webapp-content-security-policy.mjs).
export declare const papelizWebappContentSecurityPolicyDirectives: readonly string[]
export declare function buildPapelizWebappContentSecurityPolicy(): string
// Papeliz for Windows' policy: the web app's, plus Tauri's IPC address in connect-src.
export declare function buildPapelizDesktopContentSecurityPolicy(): string
