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

The appearance page puts two tabs at the top: `预设` (Presets) and `高级设置` (Advanced settings); the selected tab is stored under `lfaa:appearance-tab`. The presets tab holds the colour-mode grid, theme-style grid and background images; the advanced tab holds theme details (preset with import/copy, accent, background/foreground, UI font) plus font size, typography, theme & display and motion & cursor. Both share the live preview above: hover previews never touch the real theme, so leaving a tile returns to the applied theme.

### Background images (built-in and personal)

The "Background images" group at the bottom of the presets tab offers Solid (follow the theme), built-in images and personal images. The workspace and the settings center store separate choices, and the chosen image fills the whole four-column shell.

- **Built-in images** live in `client/assets/backgrounds/`: `index.ts` uses `import.meta.glob` for discovery, so adding an image never requires touching component code. Chinese names and display order go in `manifest.json`; unregistered files fall back to a humanised filename and sort last. Ship WebP, 16:9, ≤400KB each.
- **Personal images** live in `~/.lfaa/backgrounds/` (or are uploaded in Settings): the Host scans the directory, so dropping in a PNG/JPG/WebP also lists it under "My images" on the next settings refresh, with no rebuild. Upload/delete use `/api/backgrounds`.
- **Agent rule**: when the current workspace is the LFAA source repo and the owner wants the image shipped, add it to the built-in folder and register it in `manifest.json`; in any other project, with no source, or for local-only use, put it in the personal folder. Both accept png/jpg/webp directly; the built-in folder should be WebP to keep the bundle small. The same rule is injected into the agent system prompt.
- Config stores only `default | builtin | custom` plus the image id — never the hashed Vite URL; deleting a personal image falls back to Solid for whichever target used it.

### Theme presets and Sakura

Presets live in `THEME_PRESETS` inside `contract/index.ts` (no DOM dependency, shared by Host and Client). Each one supplies a light and a dark background/foreground pair plus an accent. Adding a preset takes two steps:

1. Append an entry to `THEME_PRESETS` (`id` / `labelZh` / `labelEn` / `glassEnabled` / `light` / `dark`); if it needs a new accent, register the same id in `ACCENT_PRESETS`.
2. If it needs its own glass tint, add two blocks to `client/tokens.css` — `html[data-preset="<id>"][data-resolved-theme="light|dark"]` — overriding only the tint triplets.

The gallery grid, preset dropdown and `applyPreset` are all driven by `THEME_PRESETS`, so no UI code changes are needed; `appearance-store` writes `data-preset` to the root element on boot, which is why dialogs and portalled popovers inherit the same palette.

Sakura is the fifth preset: light is a misted sakura white (`#FFF6F8`) with deep plum-brown text (`#3B2A33`, 12.6:1), dark is a plum-wine ground (`#1D1418`) with pale pink text (`#F4E6ED`, 14.9:1); both share the sakura accent (`#C9558A`). Glass tints are defined as paired `--tint-*` tokens, body and muted text both stay at or above 4.5:1, and `tests/sakura-preset.test.ts` guards that line. The preset grid now derives its column count from the preset total (5 columns on desktop with five presets, 3 on medium widths, 2 on phones).
