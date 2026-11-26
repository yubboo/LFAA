---
description: "Liquid-glass theme presets, accent colours, CSS variable injection, and the appearance settings view."
kind: "package"
---

# @lfaa/ui-theme

English | [中文](README.zh.md)

## Summary

Liquid-glass theme presets, accent colours, CSS variable injection, and the appearance settings view.

This package lives in `packages/ui/theme`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./contract` | `./lib/types/contract/index.js` | Public contract with no Node or DOM dependency |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./client` | `./client/index.tsx` | Browser entry consumed by Vite |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/ui-layout`
- `@lfaa/ui-primitives`

## Dev Note

### Theme preview kit

`./client` also exports the two building blocks behind the appearance page's live preview, so any surface that lets a user pick a look can reuse them instead of drawing its own mock:

- `ThemePreview` renders a miniature workspace (rail, session sidebar, chat column, composer) from a `ThemePreviewSample` — background, foreground, accent, glass flag. Colors are injected as `--pv-*` CSS variables and every element transitions on `background-color` / `color` (260ms), so switching samples morphs smoothly instead of cross-fading a screenshot. Pass `secondarySample` to render two halves (used for "System" = light | dark). `variant="tile"` produces the compact thumbnail used in the grid.
- `ThemeGallery` renders the picker grid: hovering or focusing a tile only reports `onPreview(id)`, clicking reports `onSelect(id)`. The caller owns the preview state, so the same gallery can drive a big panel, a side panel, or nothing at all.

The appearance page puts two tabs at the top: `预设` (Presets) and `高级设置` (Advanced settings); the selected tab is stored under `lfaa:appearance-tab`. The presets tab holds the colour-mode grid and a single Theme wall; the advanced tab holds theme details (preset import/copy, accent, background/foreground, UI font) plus font size, typography, theme & display and motion & cursor. There is no persistent preview panel: hovering a card floats a live preview next to the cursor and swaps the system pointer for a “Preview” badge, and nothing is written until a card is clicked.

### Theme wall (palette + backdrop in one card)

A theme is the complete look: its palette (light/dark colours, accent, glass) plus either a solid backdrop or a background image. The wall lists the five solid themes first, then every built-in background as its own theme, then personal images. One click applies both the palette and the backdrop to the workspace and the settings center; hovering any card floats that look at the cursor without writing anything. There is no separate background control.

- **Built-in images** live in `client/assets/backgrounds/`: `index.ts` uses `import.meta.glob` for discovery, so adding an image never requires touching component code. Chinese names, display order and the palette each image uses as a theme go in `manifest.json` (`preset`); unregistered files fall back to a humanised filename and the Liquid Glass palette. Ship WebP, 16:9, ≤400KB each.
- **Personal images** live in `~/.lfaa/backgrounds/` (or are uploaded from the Theme wall header): the Host scans the directory, so dropping in a PNG/JPG/WebP also lists it as a theme card, with no rebuild. Upload/delete use `/api/backgrounds`; a personal theme uses the default Liquid Glass palette and its delete button needs a second click.
- **Agent rule**: when the current workspace is the LFAA source repo and the owner wants the image shipped, add it to the built-in folder and register its label + `preset` in `manifest.json`; in any other project, with no source, or for local-only use, put it in the personal folder. Both accept png/jpg/webp directly; the built-in folder should be WebP to keep the bundle small. The same rule is injected into the agent system prompt.
- Config stores only `default | builtin | custom` plus the image id — never the hashed Vite URL; applying a theme writes the same background to both targets, and deleting a personal image falls back to the LFAA solid theme.

### Theme presets and Sakura

Presets live in `THEME_PRESETS` inside `contract/index.ts` (no DOM dependency, shared by Host and Client). Each one supplies a light and a dark background/foreground pair plus an accent. Adding a preset takes two steps:

1. Append an entry to `THEME_PRESETS` (`id` / `labelZh` / `labelEn` / `glassEnabled` / `light` / `dark`); if it needs a new accent, register the same id in `ACCENT_PRESETS`.
2. If it needs its own glass tint, add two blocks to `client/tokens.css` — `html[data-preset="<id>"][data-resolved-theme="light|dark"]` — overriding only the tint triplets.

The gallery grid, preset dropdown and `applyThemeLook` are all driven by `THEME_PRESETS`, so no UI code changes are needed; `appearance-store` writes `data-preset` to the root element on boot, which is why dialogs and portalled popovers inherit the same palette.

Sakura is the fifth preset: light is a misted sakura white (`#FFF6F8`) with deep plum-brown text (`#3B2A33`, 12.6:1), dark is a plum-wine ground (`#1D1418`) with pale pink text (`#F4E6ED`, 14.9:1); both share the sakura accent (`#C9558A`). Glass tints are defined as paired `--tint-*` tokens, body and muted text both stay at or above 4.5:1, and `tests/sakura-preset.test.ts` guards that line. The preset grid now derives its column count from the preset total (5 columns on desktop with five presets, 3 on medium widths, 2 on phones).
