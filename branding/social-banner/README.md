# Papeliz social banner

The banner shown when a Papeliz link is shared: the app tile, the Papeliz name and "Making Notes
Simple." on the Papeliz blue (`#0064D4`), with "Made with ❤️" at the lower left and "by Adam
Natad" at the lower right.

```text
branding/social-banner/
├── README.md
├── papeliz-social-banner-1200x630.png / .webp     link previews (1.91 : 1); the site uses the PNG
├── papeliz-social-banner-2400x1260.png / .webp    link previews at double resolution
├── papeliz-social-banner-1920x1080.png / .webp    16 : 9, 1080p
├── papeliz-social-banner-3840x2160.png / .webp    16 : 9, 4K
└── source/
    └── papeliz-social-banner-source.html          the banner page every size is rendered from
```

Every file is lossless: the PNG and WebP copies of a size hold exactly the same pixels. The WebP
copies are smaller, for pages that show the banner. Link previews use the PNG, because some social
sites still do not accept WebP. No file carries metadata.

## Which one to use

- **Link previews** (Open Graph, X): `papeliz-social-banner-1200x630.png`, the copy in
  `site/main/public/`.
- **A page that shows the banner**: the `.webp` of the size you need.
- **Video, slides, a 16 : 9 screen**: the 1080p or 4K copy.

## Rebuilding

The banner is drawn by `source/papeliz-social-banner-source.html` with the site's Figtree font
(`site/main` must have its packages installed) and the app tile from `branding/logo/svg/`. Render it
in a Chromium browser with a 1200-pixel-wide window and a device scale factor: 1200 × 630 at 1× and
2×, and 1200 × 675 at 1.6× (1080p) and 3.2× (4K). For example, with Edge on Windows:

```text
msedge --headless=new --hide-scrollbars --window-size=1200,630 --force-device-scale-factor=2 --screenshot=papeliz-social-banner-2400x1260.png branding/social-banner/source/papeliz-social-banner-source.html
```

Then compress each picture losslessly (PNG and lossless WebP), copy the 1200 × 630 PNG into
`site/main/public/`, and strip every new picture:

```text
node build_tools/shared/image-metadata/papeliz-strip-image-metadata.mjs branding/social-banner site/main/public
```
