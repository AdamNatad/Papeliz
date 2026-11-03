# Papeliz for Android and iOS

The Papeliz web app (`app/web/`) in a [Tauri 2](https://tauri.app) shell, one app for both phones.
Android comes first; iOS builds on a Mac or GitHub's macOS runner later. It uses the phone's own web
view: Android's WebView (Chrome's engine) and iOS's WKWebView.

## What you need

- Node.js and pnpm, as for the rest of the repository.
- Rust, from [rustup.rs](https://rustup.rs) (1.90 or later), with the Android targets:
  `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`.
- Android Studio's SDK with "NDK (Side by side)" and "Android SDK Command-line Tools", from its SDK
  Manager, and `ANDROID_HOME` set to the SDK folder. `NDK_HOME` is optional: without it the build uses
  the newest NDK in the SDK.
- Java 17 or later; Android Studio's own runtime works (`JAVA_HOME`).
- On Windows, Developer Mode, which the Android build needs for its links.

## Run and build

| | Windows | Any OS |
| --- | --- | --- |
| Run on a phone or emulator | `build_tools\mobile\windows\start.bat` | `pnpm mobile:android:dev` |
| Build the APK | `build_tools\mobile\windows\build.bat` | `pnpm mobile:android:build` |

- `mobile:android:dev` starts the webapp's Vite server on port 14208 and opens the app on the phone
  or emulator that `adb devices` lists.
- `mobile:android:build` builds the webapp into `app/mobile/papeliz-mobile-webapp-build/`, then the
  release APK, `gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk`.
  Android installs only signed apps, so a copy is signed with this computer's Android debug key,
  `app-universal-release-debug-signed.apk` beside it, for testing on a phone. Store releases are
  signed with Papeliz's own upload key instead.
- `pnpm mobile:android:build --webapp-from <repository copy>` builds the webapp from another copy of
  the repository instead, such as a clean `git archive` of a commit, so the APK wraps a known version
  of `app/web`.
- Both run through `build_tools/mobile/papeliz-mobile-tauri-command.mjs`, which gives Tauri the
  webapp's own Content-Security-Policy (`build_tools/webapp/papeliz-webapp-content-security-policy.mjs`)
  plus Tauri's IPC address, as the desktop app's command does.

To put the APK on a phone: turn on USB debugging (Settings, About phone, tap Build number seven
times, then Developer options), plug the phone in, allow this computer, and run
`adb install -r <the debug-signed APK>`. Or copy the APK to the phone and open it there, allowing
installs from that app when Android asks.

## The phone layout

Once a vault is open, the app draws its own layout, the same on Android and iOS:
- **the blue top bar on every place:** the mark, Papeliz, and the note's or vault's name under it. On
  Note it ends with MD Code | MD View and More (⋯), which holds Export and the note's menu.
- **the bottom bar:** Files, Note, Assistant and Settings.

It lives in `papeliz-mobile-layout/` and reuses the web app's own panels. The web app gets it only
through `virtual:papeliz-mobile-platform` (`app/web/src/modules/mobile/`), which the mobile build
resolves to `papeliz-mobile-platform/papeliz-mobile-platform-tauri.ts`. The web build resolves it to a
stand-in with no layout, so papeliz.com, its phone view included, is unchanged.

`pnpm mobile:check-web-dist` checks that a web build carries no Tauri and none of the phone layout.

## Vaults

App Storage keeps each vault as a folder inside Papeliz's own data folder (`<app data>/Vaults`), which
the phone removes with the app. The page reaches that folder through Tauri's fs plugin and nothing
else (`capabilities/papeliz-mobile-main-window.json`). The page's side of it is
`papeliz-mobile-platform/papeliz-mobile-platform-tauri.ts`, for the web app's
`virtual:papeliz-mobile-platform`.

## Layout

```text
app/mobile/
├─ tauri.conf.json              the app: name, identifier (com.papeliz.mobile), version
├─ Cargo.toml, build.rs         the Rust crate (papeliz-mobile)
├─ src/                         the shell: the web view, its permissions, links opening in the browser
├─ capabilities/                what the page may ask of the shell
├─ papeliz-mobile-platform/     the web app's mobile side, built into the app only
├─ papeliz-mobile-layout/       the phone layout: the top bar, the bottom bar, More and Settings
├─ icons/                       made from branding/logo/svg/papeliz-logo-scroll-spark-traced-app-tile.svg
└─ gen/android/                 the Android project Tauri made (tauri android init), with the mic permission
```
