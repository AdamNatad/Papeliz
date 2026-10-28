# Papeliz Help

`site/help/` (package `@papeliz/help-site`) is the help website for Papeliz: a welcome page and
guides for writing, files, the assistant, privacy, and keyboard shortcuts. It is a static
Next.js App Router export with no server and no environment variables.

## Routes

| Route | Page |
| --- | --- |
| `/help/` | Help home: start here, then every guide by group |
| `/help/<slug>/` | One guide, such as `/help/open-a-folder/` |
| anything else | The 404 page |

`basePath: '/help'` puts every page and every `_next` asset under `/help/`. The help site is served
at `/help/` on the same domain as the website, which is at `/`, and the webapp, which is at `/app/`. To
assemble the deployed folder, copy `site/help/out/` into its `help/` folder.

## Commands

From the repository root:

```sh
pnpm help:dev        # http://127.0.0.1:14205/help/
pnpm help:build      # static export into site/help/out/
pnpm help:typecheck
pnpm help:lint
pnpm help:verify     # after a build: every guide page, internal links and assets, page text
```

The launchers are `build_tools/site/help/<windows|macos|linux>/start` and `build`. On Windows the
build is followed by `build_tools/site/papeliz-site-repair-windows-segment-files.mjs site/help/out`,
which puts route prefetch files where the browser asks for them; `help:verify` fails if that
step was skipped.

## Layout

```text
app/          layout, help home, [papelizHelpArticleSlug]/ guide pages, 404, globals.css
components/   shell (header, guide list, phone drawer), guide view, search, inline text, mark
lib/          the guide catalog (papeliz-help-content.ts and one file per group), search
scripts/      verify-papeliz-help-export.mjs
public/       favicon
```

## Writing guides

Guides live in `lib/papeliz-help-articles-<group>.ts`; add a guide there and every page, the
sidebar, search and previous/next pick it up. Article text may use `code`, **bold**, and
`[[guide-slug]]` or `[[guide-slug|label]]` to link another guide. A link or related guide that
names an unknown slug fails the build.

Describe only what the app does today. Mark a guide `in-development` when the feature isn't
finished; its page then says so. Only the provider guide (`choose-a-provider`) names the
recommended provider preset.

Copyright (c) 2026 Natad Corporation. Released under the MIT License.
