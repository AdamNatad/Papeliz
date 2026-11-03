# Papeliz for the desktop

The Papeliz web app (`app/web/`) in a [Tauri 2](https://tauri.app) shell, for Windows first. On
Windows it uses WebView2, the Edge engine that comes with Windows 11 and nearly every Windows 10 PC,
so the installer stays small.

## What you need

- Node.js and pnpm, as for the rest of the repository.
- Rust, from [rustup.rs](https://rustup.rs) (1.90 or later).
- On Windows, Visual Studio's C++ build tools ("Desktop development with C++").

## Run and build

| | Windows | Any OS |
| --- | --- | --- |
| Run with live reload | `build_tools\desktop\windows\start.bat` | `pnpm desktop:dev` |
| Build the installer | `build_tools\desktop\windows\build.bat` | `pnpm desktop:build` |

- `desktop:dev` starts the webapp's Vite server on port 14207 and opens the app window on it.
- `desktop:build` builds the webapp into `app/desktop/papeliz-desktop-webapp-build/`, then the
  unsigned installer: `app/desktop/target/release/bundle/nsis/Papeliz_<version>_x64-setup.exe`. It
  installs for the current user only, with no admin prompt.
- Both run through `build_tools/desktop/papeliz-desktop-tauri-command.mjs`. It gives Tauri the
  webapp's own Content-Security-Policy (`build_tools/webapp/papeliz-webapp-content-security-policy.mjs`)
  plus Tauri's IPC address, so the web app and the desktop app keep one policy.
- `pnpm desktop:build:recording-devtools` builds a copy with DevTools, for recording the app's network
  calls: the Cargo feature `papeliz-recording-devtools`, built in
  `app/desktop/target/papeliz-recording-devtools/`, with no update files. Its installer is
  `Papeliz_<version>_x64-recording-devtools-setup.exe`. DevTools opens in its own window at start, and F12
  or Ctrl+Shift+I opens it again. It installs over the regular copy, keeping its vaults and settings;
  installing the regular installer again goes back. Never publish it: `desktop:build` always leaves
  DevTools out.

## Updates

The app checks for updates with Tauri's updater, which only installs an update signed with the
Papeliz update key. To build a release with its update files, set `TAURI_SIGNING_PRIVATE_KEY`
(and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`) before `pnpm desktop:build`. The matching public key is
`plugins.updater.pubkey` in `tauri.conf.json`. Without the key, the build simply leaves the update
files out.

## Microsoft Store

`pnpm desktop:msix` packs the built `papeliz-desktop.exe` as an unsigned MSIX from
`app/desktop/msix/`, with Microsoft's [winapp CLI](https://learn.microsoft.com/windows/apps/dev-tools/winapp-cli/).
The Microsoft Store signs the MSIX itself when it accepts it.

## Layout

```text
app/desktop/
├─ tauri.conf.json          the app: name, identifier, installer, updater
├─ Cargo.toml, build.rs     the Rust crate (papeliz-desktop)
├─ src/                     the shell: the window, plugins, links opening in the system browser
├─ capabilities/            what the page may ask of the shell
├─ icons/                   made from branding/logo/svg/papeliz-logo-scroll-spark-traced-app-tile.svg
└─ msix/                    the Microsoft Store package's manifest and logos
```
