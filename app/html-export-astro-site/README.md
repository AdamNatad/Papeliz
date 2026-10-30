# Your notes as a website

Papeliz exported your notes as a website, and this folder is the same website as an
[Astro](https://astro.build) project. The finished site sits one folder up and works as it is; use this
project when you want to change how it looks, edit notes and build it again.

## Build it

You need [Node.js](https://nodejs.org) 22.23.4 or newer.

```bash
npm install
npm run dev
```

`npm run dev` shows the site at http://localhost:4321 and updates it as you edit. To build it:

```bash
npm run build
```

The site lands in `dist/`. `npm run preview` shows the built site.

## Put it online

`dist/` is a plain static site: every link is relative and every page is its own `.html` file, so it
works on any static host and at any address, and opened straight from disk.

- **GitHub Pages:** push this folder to a repository and publish `dist/` with a GitHub Actions
  workflow, or push the contents of `dist/` to a `gh-pages` branch.
- **Cloudflare Pages or Netlify:** connect the repository, build command `npm run build`, output
  folder `dist`.
- **Any web server:** upload the contents of `dist/`.

## What's where

| Path | What it is |
| --- | --- |
| `vault/` | Your notes, as Markdown, in their folders. Edit, add or move notes here. |
| `public/attachments/` | The pictures and files your notes show or link to, in their vault folders. Add one here to use it in a note. |
| `src/layouts/PapelizSitePage.astro` | The page every note and the home page use: the top bar, the folder list, the note. |
| `public/papeliz-site/papeliz-site.css` | The site's look: the bar, the folder list, search. |
| `public/papeliz-site/papeliz-md-view.css` | How notes look, as in Papeliz's MD View, with the light and dark colors at the top. |
| `public/papeliz-site/papeliz-site.js` | The theme switch, the folder list and search. |
| `src/pages/` | The routes: the home page, one page per note, and the text files below. |
| `src/papeliz/` | Papeliz's part: the code that turns notes into pages, the site's settings and the diagrams. |

Each page has a Markdown twin beside it (`launch-plan.html` and `launch-plan.md`), and `llms.txt`
lists them, so search engines and AI tools can read your notes as Markdown.

## Make it yours

- Change the layout, the stylesheets and the script freely.
- Keep files the pages load in `public/` and link them with relative paths, as the layout does, so the
  site still opens from disk. Styles and scripts that Astro bundles (a `<style>` or `<script>` in a
  component) are written to `/_astro/` with paths from the site's root: they work on a host at the
  root of its address, but not from disk.
- The site's name is `htmlExportSiteName` in `src/papeliz/papeliz-site-settings.json`.

## Notes

- `[[Wikilinks]]`, `#tags`, callouts, tables, task lists and properties work as they do in Papeliz.
  A link to a note that wasn't exported reads as text.
- A note's `lang` property sets its page's language.
- `![[plan.png]]`, `![[plan.png|300]]` (300 pixels wide) and `![The plan](pictures/plan.png)` show a
  picture from `public/attachments/`, found the way a wikilink finds its note: beside the note, from
  the vault's root, then by name. `[[brief.pdf]]` links to a file there.
- Diagrams were drawn by Papeliz when it exported the site (`src/papeliz/papeliz-vault-diagrams.json`).
  A diagram that is new or changed since then shows its source until you export the website from
  Papeliz again.

## Papeliz's part

`src/papeliz/papeliz-html-export-core.mjs` is the code Papeliz itself uses to show notes, bundled
with the open-source packages it needs; their licenses are in
`src/papeliz/papeliz-html-export-core-licenses.md`. Leave it as it is: exporting from Papeliz again
gives you a new one. Papeliz is open source under the MIT License.
