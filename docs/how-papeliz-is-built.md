# How Papeliz is built

Papeliz has no server. The app, the website and the help site are static files. Your notes stay
in a folder on your disk, and the assistant talks straight from your browser to the AI provider
you choose, with your own key.

## The pieces

| Folder | What it is | Built with |
| --- | --- | --- |
| `app/web/` | The app, served at `/app/` | Vite, React, TypeScript, Tailwind CSS, zustand |
| `site/main/` | The website, served at `/` | Next.js static export |
| `site/help/` | The help site, served at `/help/` | Next.js static export |
| `build_tools/` | Launchers for every OS, the deploy-folder assembly, image tools | Node.js, no packages |
| `branding/` | The logo and the link-preview banner | |

One pnpm workspace ties them together (`package.json`, `pnpm-workspace.yaml`).

## Inside the app

- **Your vault.** In Chrome and Edge, Papeliz opens a folder on your disk through the File System
  Access API. Notes are plain `.md` files, written back as they are. The folder's handle is kept
  in the browser's IndexedDB so Papeliz can reopen it, after asking you again.
- **MD Code** (`src/modules/md-code/`) is the raw Markdown in CodeMirror 6, with syntax colors,
  line numbers and `[[` link completion.
- **MD View** (`src/modules/md-view/`) renders the note with unified (remark and rehype) and
  sanitizes the result, so a note can never run a script. Wikilinks, tags and callouts are
  Papeliz's own plugins.
- **Links and search** (`src/modules/links/`, `src/modules/search/`) index the vault's wikilinks
  and text; search runs in a Web Worker.
- **The assistant** (`src/modules/assistant/`) uses one OpenAI-compatible client over `fetch`.
  Provider presets fill in the base URL; your key is stored in this browser's IndexedDB and is
  sent only to that provider. Edits the assistant proposes are shown as diffs you accept or
  reject.
- **App data** (`src/modules/browser-database/`) is one IndexedDB database behind a small typed
  wrapper: settings, opened folders and provider keys. Notes never live there.

Tests sit beside the code they test (`*.test.ts`, Vitest).

## One domain

`pnpm deploy:assemble` builds all three and puts them in one folder, `deploy/`: the website at the
root, the app in `app/` and the help site in `help/`. That folder is what a static host serves.

## Run it

You need Node.js 24 LTS and pnpm (the version in `package.json`, `packageManager`).

```bash
pnpm install
pnpm webapp:dev
```

`webapp:*`, `site:*` and `help:*` scripts build, test, lint and type-check each piece; the
launchers in `build_tools/<webapp|site>/<windows|macos|linux>/` do the same with one command.
