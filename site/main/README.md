# Papeliz website

`site/main/` (`@papeliz/site`) is the public website for Papeliz: what it is, its features, the
roadmap and changelog, and the privacy, terms and license pages. It is a Next.js App Router site
with `output: 'export'`: `next build` writes plain static files to `out/`, with no server, API
routes or environment variables.

## Pages

| Path | Page |
| --- | --- |
| `/` | Home: the hero, features, the assistant, AI providers, privacy, open source |
| `/features/` | Everything in the launch build, and what comes after |
| `/roadmap/` | Milestones and phases, in order, without dates |
| `/changelog/` | What has been built, newest first |
| `/about/` | Why Papeliz exists and who makes it |
| `/adam-natad/` | Adam Natad, who makes Papeliz: kept as on his other site, in Papeliz blue |
| `/community/` | Where to talk about Papeliz and help build it: Discord, GitHub Discussions, Issues, contributing |
| `/privacy/`, `/terms/` | Plain-language privacy and terms (drafts until launch) |
| `/license/` | The MIT License, read from the repository's root `LICENSE` at build time |

`robots.txt` and `sitemap.xml` are generated too; the sitemap lists pages once
`papelizSiteCanonicalOrigin` is set.

## Run it

From the repository root:

```sh
pnpm site:dev        # http://127.0.0.1:14203 through the launcher: build_tools/site/<os>/start
pnpm site:build      # static export into site/main/out (build_tools/site/<os>/build)
pnpm site:typecheck
pnpm site:lint
pnpm site:verify     # after a build: pages, links, license text and wording in out/
```

## Layout

```text
app/          routes: home, features, roadmap, changelog, about, adam-natad, community, privacy,
              terms, license, 404, robots.ts, sitemap.ts; globals.css holds the blue-and-white Tailwind theme
components/   header/, footer/, logo/ (the Papeliz mark; the GitHub and Discord marks),
              marketing/ (sections, buttons, the workspace preview), legal/ (the privacy, terms
              and license layout)
lib/          papeliz-site-config.ts (name, URLs, copyright), navigation, SEO and JSON-LD helpers,
              and the features, roadmap, changelog and community content
public/       favicon.svg, _headers (response headers for the static host) and images/adam-natad/
scripts/      verify-papeliz-site-export.mjs
wrangler.jsonc  static-assets config for the host (no route until the domain is chosen)
```

## Launch values

`lib/papeliz-site-config.ts` holds the values that are still open: the public origin, the app's
address, the GitHub repository, the Discord invite and the help site's address. While one is
`null`, the site shows "Coming soon" or hides the link.

## Deploying

One domain serves the website at `/`, the help site (`site/help/`) at `/help/` and the webapp
at `/app/`; the assembly step copies their builds into one folder.

MIT License, copyright Natad Corporation.
