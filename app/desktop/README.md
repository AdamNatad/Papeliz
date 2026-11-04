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

## The installer

`desktop:build` makes the installer from `bundle` in `tauri.conf.json` and the files in `installer/`:

- `papeliz-installer.nsi` is Papeliz's copy of the bundler's installer template (Tauri CLI 2.12.4), with
  its changes marked `Papeliz:`. The setup file's description reads "Papeliz by Adam Natad", and the
  Welcome page names the developer. A new install goes to the user's own Programs folder,
  `%LOCALAPPDATA%\Programs\Papeliz`, while an existing install, such as one in `%LOCALAPPDATA%\Papeliz`,
  is updated where it is. The desktop shortcut is always made, so the Finish page only offers to run
  Papeliz. When the Tauri CLI is updated, compare the copy with the bundler's new template.
- `papeliz-installer-sidebar-blue.bmp` (164 × 314) is the Welcome and Finish pages' side picture, and
  `papeliz-installer-header-blue.bmp` (150 × 57) the header picture on the other pages, the uninstaller's
  included. Both are 24-bit BMPs with no metadata, drawn on Papeliz blue (`#0064d4`) with
  `branding/logo/svg/papeliz-logo-scroll-spark-traced-mark-on-blue.svg` and Windows' interface font.
  The side picture shows the version as text, "Version 1.0.0 Preview 1", so it is redrawn when the
  version changes.
- `papeliz-end-user-license-agreement.txt` is the End User License Agreement the License page shows
  (`bundle.licenseFile`).
- The setup file, its window and the uninstaller use the app's icon, `icons/icon.ico`.

## Windows

Papeliz opens a window per vault, like a code editor. A second launch, the gear's New Window or
Ctrl+Shift+N opens another window on the start screen. A vault already open in one window isn't opened
in another: that window comes forward instead, so two windows never write the same vault. Each window has
its own vault, tabs, title, size and place. Closing a window closes only it, after it saves its notes,
and closing the last one quits. The next start opens one window on the start screen.
`src/papeliz_desktop_windows.rs` keeps which vault each window shows.

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
├─ src/                     the shell: the windows, plugins, links opening in the system browser
├─ capabilities/            what the page may ask of the shell
├─ icons/                   made from branding/logo/svg/papeliz-logo-scroll-spark-traced-app-tile.svg
├─ installer/               the installer's template, pictures and End User License Agreement
└─ msix/                    the Microsoft Store package's manifest and logos
```
