# Build tools

Launchers for developing and building Papeliz. Each operating system gets a thin script that hands
off to one shared Node launcher, so the behavior is the same everywhere.

```text
build_tools/
├── webapp/           the webapp
│   ├── windows/      start.bat, build.bat
│   ├── macos/        start.sh,  build.sh
│   └── linux/        start.sh,  build.sh
├── site/             the public website (same layout)
│   └── help/         the help site (same layout)
├── design/           design tools
│   ├── windows/      image-to-svg.bat, strip-image-metadata.bat
│   ├── macos/        image-to-svg.sh,  strip-image-metadata.sh
│   └── linux/        image-to-svg.sh,  strip-image-metadata.sh
└── shared/
    ├── launcher/       papeliz-launcher.mjs
    ├── image-to-svg/   papeliz-image-to-svg.mjs
    ├── image-metadata/ papeliz-strip-image-metadata.mjs
    └── deploy-folder/  papeliz-deploy-folder-assemble.mjs
```

| Product · action | Windows | macOS / Linux | Address |
| --- | --- | --- | --- |
| Webapp · start | `build_tools\webapp\windows\start.bat` | `build_tools/webapp/<macos\|linux>/start.sh` | http://127.0.0.1:14201 |
| Webapp · build | `build_tools\webapp\windows\build.bat` | `build_tools/webapp/<macos\|linux>/build.sh` | — |
| Site · start | `build_tools\site\windows\start.bat` | `build_tools/site/<macos\|linux>/start.sh` | http://127.0.0.1:14203 |
| Site · build | `build_tools\site\windows\build.bat` | `build_tools/site/<macos\|linux>/build.sh` | — |
| Help · start | `build_tools\site\help\windows\start.bat` | `build_tools/site/help/<macos\|linux>/start.sh` | http://127.0.0.1:14205/help/ |
| Help · build | `build_tools\site\help\windows\build.bat` | `build_tools/site/help/<macos\|linux>/build.sh` | — |

Options: `--help`, `--dry-run` (print the plan, run nothing), `--no-open` (don't open the browser).

The deploy folder puts the site at `/`, the webapp at `/app/` and the help site at `/help/`, as
they will be hosted. Pass `deploy` to the site launchers: `build_tools\site\windows\build.bat deploy` builds all three and
assembles `deploy/`, and `build_tools\site\windows\start.bat deploy` serves it at
http://127.0.0.1:14206. A `deploy/` folder from an earlier run goes to the Trash through
[trash-cli](https://github.com/sindresorhus/trash-cli); without it, move the folder to the Trash
yourself first.

## What the launcher does

1. Checks Node.js (24 LTS recommended) and pnpm (10.34.7, pinned in `package.json`); offers to
   install pnpm if it is missing.
2. Installs workspace dependencies when `node_modules` is missing or older than `pnpm-lock.yaml`.
3. Runs the matching root script on its fixed loopback port, refusing to start if the port is taken.
4. Opens the browser once the server answers, and mirrors the output to
   `test_trash/logs/papeliz-launcher-<surface>-<target>.log`.

## Image to SVG

`papeliz-image-to-svg.mjs` turns a flat, one-color logo or icon picture (PNG: a colored mark on a
plain or transparent background) into a real vector. It follows the anti-aliased edge between
pixels, fits smooth cubic curves with sharp corners kept, and places the result on the 28 × 28 grid
of the Papeliz mark. Node.js only, no packages.

```text
build_tools\design\windows\image-to-svg.bat <picture.png> <output folder> [--name <name>]
build_tools/design/<macos|linux>/image-to-svg.sh <picture.png> <output folder> [--name <name>]
```

It writes five SVGs: the mark in the blue gradient, in white for the topbar, in `currentColor`,
and the app tile in both tones. `--help` lists the tuning options (padding, tile mark size, curve
tolerance, corner angle, speck size).

## Image metadata remover

`papeliz-strip-image-metadata.mjs` removes metadata from PNG, JPEG, WebP and SVG files in place:
C2PA content credentials, EXIF, XMP, IPTC, text chunks, comments and editor data. Pixels and color
profiles stay byte-for-byte the same; a file is rewritten only after that is checked. Folders are
searched recursively, skipping `node_modules`, builds and `.git`. Node.js only, no packages.

```text
build_tools\design\windows\strip-image-metadata.bat <file or folder>... [--check]
build_tools/design/<macos|linux>/strip-image-metadata.sh <file or folder>... [--check]
```

`--check` only reports which files carry metadata (exit code 1 if any do). Run it on the whole
repository (`.`) before adding a picture to `branding/`, `app/web/public/` or `site/*/public/`.

The Git pre-commit hook runs it on every commit: images staged for the commit are cleaned and
staged again, and a commit stops if a staged image also has unstaged edits. Install the hook once
per clone (it lives in `.git/hooks/`, which Git does not track):

```text
node build_tools/shared/image-metadata/papeliz-strip-image-metadata.mjs --install-git-hook
```
