# Papeliz

**Making Notes Simple.**

Papeliz is a free, open-source, cross-platform Markdown editor and AI-powered note-taking app for
building your personal knowledge base. Create, edit, organize, and connect your notes and ideas in
MD Code and MD View, with a built-in AI assistant that runs on your own API key — no account, and
no Papeliz server in between. Available on the web, Windows, macOS, Linux, Android, iOS, and
HarmonyOS.

[![License: MIT](https://img.shields.io/badge/license-MIT-0064D4.svg)](LICENSE)
![Status: early development](https://img.shields.io/badge/status-early%20development-5B70FF.svg)

> **Status:** Papeliz is in early development. The first build is in progress, and the checklist
> under [Roadmap](#roadmap) shows what works today. Nothing here is ready for daily use yet.

<!-- A screenshot goes here once the first build runs. -->

## Why Papeliz

- **Your files stay yours.** Notes are plain `.md` files in a folder on your disk. No proprietary
  format, no lock-in. Existing Markdown folders open as they are.
- **Use it anywhere, no account.** Papeliz runs on the web, Windows, macOS, Linux, Android, iOS
  and HarmonyOS. Open a folder of notes and start writing.
- **Your key, your provider.** The assistant talks straight from your device to the AI provider
  you choose. Papeliz has no server, so it never sees your key or your notes.
- **An assistant that edits, with you in charge.** It rewrites a selection, proposes changes as a
  diff you accept or reject, and suggests links and tags across your notes. Nothing changes until
  you say so.
- **Free and open source.** MIT licensed.

## What it looks like

- **Files on the left, the note in the middle, the assistant on the right.**
- **One switch, two views:** **MD Code** shows the raw Markdown with syntax colors and line
  numbers; **MD View** shows the rendered note.
- **Inline edits:** select text and ask for Shorter, Rewrite, Fix grammar or Translate; the change
  appears in place as a diff.
- **Focus mode** (`Ctrl+Shift+F`): only your note and a floating prompt box.

## Bring your own AI provider

Papeliz speaks the OpenAI-compatible API format, so one connection works with many providers.
Pick a preset or enter any compatible URL, paste your key, choose a model, and test it.

### Recommended: Muse Spark on the Meta Model API

Papeliz's assistant is built first around Meta's **Muse Spark** models, and the Meta Model API is
the preset selected out of the box.

| Setting | Value |
| --- | --- |
| Base URL | `https://api.meta.ai/v1` |
| Model | `muse-spark-1.3` (also `muse-spark-1.1`) |
| API key | From the [Model API dashboard](https://dev.meta.ai/) → API keys → Create API key |
| Docs | [Meta Model API quickstart](https://dev.meta.ai/docs/quickstart) |

Muse Spark reads long context (up to about a million tokens), so the assistant can work across
many notes at once. The API accepts calls straight from the app, so no proxy sits between you
and Meta.

### Other providers

| Kind | Examples |
| --- | --- |
| Hosted | OpenAI, OpenRouter, Groq, Together, Fireworks, Google Gemini (OpenAI-compatible endpoint) |
| Local | Ollama, LM Studio |
| Anything else | Custom base URL for any OpenAI-compatible API |

Your key is stored only on your device and is sent only to the provider you picked. Using a
provider is subject to that provider's own terms and pricing.

## Privacy and security

- **No Papeliz server.** Papeliz runs on your device. There is no backend, no account, no
  analytics on your notes.
- **Notes stay on your device.** Papeliz reads and writes the folder you open (on the web, through
  the File System Access API). It never writes inside a vault's hidden folders, and deleted notes go to the vault's
  `.trash/` folder.
- **You choose what the assistant sees.** Each message shows which notes are shared with your
  provider, and nothing is sent until you send it.
- **Safe rendering.** Notes are sanitized before display, and the app ships a strict
  Content-Security-Policy, so a note can't run code in the page that holds your keys.

## Browser support

| Browser | Support |
| --- | --- |
| Chrome, Edge | Open real folders on your disk |
| Firefox, Safari | Planned: a vault stored in the browser, with zip import and export |

## Roadmap

**Available now: Papeliz 1.0**

- [x] Open a folder of Markdown notes or a sample vault; create, rename and delete notes
- [x] MD Code with autosave, and MD View, behind one switch
- [x] Wikilinks (`[[note]]`), backlinks, outline and full-text search
- [x] Bring-your-own-key settings: Muse Spark preset first, then any OpenAI-compatible provider
- [x] Assistant chat that cites your notes as links
- [x] Proposed edits as diffs; inline edits on a selection
- [x] Link and tag suggestions across notes
- [x] Focus mode
- [x] Web, Windows, macOS, Linux, Android, iOS and HarmonyOS

**Up next: Papeliz Sync**

- [ ] Keep your vaults in sync across web, desktop and mobile
- [ ] Edits from two devices merge instead of overwriting each other
- [ ] End-to-end encrypted, so Papeliz still never sees your notes
- [ ] Optional: Papeliz itself stays free, with no account needed

**Later**

- [ ] Graph view and canvas
- [ ] Passphrase lock for stored keys
- [ ] Translations
- [ ] Math, diagrams and code highlighting in MD View
- [ ] Firefox and Safari on the web

## Built with

Papeliz stands on these open-source projects:

| Project | Used for | License |
| --- | --- | --- |
| [Vite](https://vite.dev) | Build and dev server | MIT |
| [React](https://react.dev) | User interface | MIT |
| [TypeScript](https://www.typescriptlang.org) | Language | Apache-2.0 |
| [Tailwind CSS](https://tailwindcss.com) | Styling | MIT |
| [CodeMirror](https://codemirror.net) | MD Code | MIT |
| [unified](https://unifiedjs.com) (remark, rehype) | Parsing and rendering Markdown | MIT |
| [MiniSearch](https://lucaong.github.io/minisearch/) | Full-text search | MIT |
| [zustand](https://zustand.docs.pmnd.rs) | App state | MIT |
| [Lucide](https://lucide.dev) | Icons | ISC |
| [Next.js](https://nextjs.org) | The website (static export) | MIT |
| [Figtree](https://fonts.google.com/specimen/Figtree) via [Fontsource](https://fontsource.org) | Typeface | OFL-1.1 |

## Run it locally

The app arrives in `app/web/` with the first build; this section gets its exact commands then.
You will need [Node.js](https://nodejs.org) 24 LTS and [pnpm](https://pnpm.io) 12.

## Contributing

Issues and pull requests are welcome once the first build lands. Please:

- keep notes as plain Markdown — no format that only Papeliz can read;
- never add a server that sees users' keys or notes;
- contribute only code you have the right to share under the MIT License.

## License

[MIT](LICENSE) © 2026 Natad Corporation
