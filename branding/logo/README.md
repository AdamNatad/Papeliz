# Papeliz logo

The Papeliz logo is a paper scroll unrolling, with a four-point spark for the assistant, in the
Papeliz blue gradient (`#0064D4` to `#5B70FF`).

```text
branding/logo/
├── README.md
├── source/
│   └── papeliz-logo-scroll-spark-source.png    the 1024 × 1024 source picture
├── png/
│   └── papeliz-logo-scroll-spark-apple-touch-icon-180.png   the app tile filled edge to edge, 180 × 180,
│                                                            for phone home screens (apple-touch-icon)
└── svg/    traced from the source: one path each, on the 28 × 28 grid of the Papeliz mark
    ├── papeliz-logo-scroll-spark-traced-mark-gradient.svg        the mark in the blue gradient, for white grounds
    ├── papeliz-logo-scroll-spark-traced-mark-on-blue.svg         the mark in white, for the blue topbar
    ├── papeliz-logo-scroll-spark-traced-mark-current-color.svg   the mark in currentColor
    ├── papeliz-logo-scroll-spark-traced-app-tile.svg             the white mark on the blue gradient tile
    └── papeliz-logo-scroll-spark-traced-app-tile-on-blue.svg     the gradient mark on a white tile, for the blue topbar
```

## Which one to use

- **The mark** (no tile): next to the Papeliz name — the app topbar, the site header, docs.
- **The app tile**: where the icon stands alone — the browser tab, the installed app, the home
  screen.
- **The home-screen PNG**: phones add their own rounded corners, so it fills the square. The app,
  the site and the help site each serve a copy as their apple-touch-icon.

When the app's mark component or the site favicon is updated, take the shapes from these files.
The social banner built from the app tile is in `branding/social-banner/`.

## Rebuilding the SVGs

The SVGs come from the source picture through the image-to-SVG tool (`build_tools/README.md`,
"Image to SVG"). After changing the source, run from the repository root:

```text
node build_tools/shared/image-to-svg/papeliz-image-to-svg.mjs branding/logo/source/papeliz-logo-scroll-spark-source.png branding/logo/svg --name papeliz-logo-scroll-spark
```
