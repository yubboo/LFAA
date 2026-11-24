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

The appearance page composes them as: preview stage at the top, `全部主题` grid below, fine-tuning rows after. Hover previews never touch the real theme, so leaving a tile returns to the applied theme.
