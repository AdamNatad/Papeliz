# Papeliz websites

- [`main/`](main/) — the public website (`@papeliz/site`), served at `/`.
- [`help/`](help/) — the help site with guides for every part of Papeliz (`@papeliz/help-site`),
  served at `/help/`.

Both are static Next.js exports with no server. From the repository root, use `pnpm site:dev`,
`site:build`, `site:typecheck`, `site:lint` and `site:verify` for the website, and `pnpm help:dev`,
`help:build`, `help:typecheck`, `help:lint` and `help:verify` for the help site, or the launchers
in `build_tools/site/` and `build_tools/site/help/`.
