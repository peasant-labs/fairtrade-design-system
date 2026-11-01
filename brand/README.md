# app icons

Fairtrade owns the static favicon family. Its source is `app-icons.json`, based
on the website header's `components/mark.tsx`: the 18×22 mark, stem, square caps
and 1.6 stroke are preserved. The source repository, revision and SHA-256 are
recorded there. The fourth pair extends that same branch shape down the stem.
Existing `WHEAT_LOGO`, header symbols and share-card marks keep their geometry.

The only difference between apps is the number of branch pairs:

| app | branch pairs | generated SVG |
| --- | --- | --- |
| peasant local | 1 | `public/brand/peasant.svg` |
| village online | 2 | `public/brand/village.svg` |
| website, including docs | 3 | `public/brand/website.svg` |
| fairtrade docs and demo | 4 | `public/brand/fairtrade.svg` |

Every icon uses the same square 32×32 canvas, placement and stroke. Colors are
read from the dark and light `--canvas` and `--amber` tokens in `src/index.css`.
SVGs follow `prefers-color-scheme`; the Apple launcher PNG uses the dark palette.
The manifest and favicon links keep their existing routes.

Run `pnpm icons:generate` after changing the family or its colors. This writes
all four SVGs, Fairtrade's `public/favicon.svg`, the 180×180 Apple icon and
`public/brand/provenance.json` with source and output hashes. PNG generation
uses the project's Playwright Chromium installation. `pnpm icons:check` verifies
the committed assets without launching a browser and runs in the app build.
`scripts/gen-og.mjs` delegates icon generation to this same generator.

Consumers copy their generated SVG bytes into their existing Next app icon
file (`app/icon.svg` on the website, `web/src/app/icon.svg` in Peasant,
`frontend/src/app/icon.svg` in Village). Static copying needs no library release
or npm dependency change. Never edit copied geometry or derive a local variant.
Each copied SVG embeds its app identity and source digest.

Optional local checks can inspect any checkout without making another repository
a CI dependency:

```sh
node scripts/gen-app-icons.mjs --check \
  --header /path/to/website/components/mark.tsx \
  --copy-check website /path/to/website/app/icon.svg \
  --copy-check peasant /path/to/peasant/web/src/app/icon.svg \
  --copy-check village /path/to/village/frontend/src/app/icon.svg
```

The header check compares its view box, stroke, caps and exact ordered paths.
The copy checks compare whole SVG bytes against the canonical generator.
