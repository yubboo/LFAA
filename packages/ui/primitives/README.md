---
description: "Shared UI atoms: modal dialog, popover card, step slider, accent scroll area, the common motion vocabulary, and the settings-center controls/surface."
kind: "package"
---

# @lfaa/ui-primitives

English | [中文](README.zh.md)

## Summary

Shared UI atoms: modal dialog, popover card, step slider, accent scroll area, the common motion vocabulary, and the settings-center controls/surface.

This package lives in `packages/ui/primitives`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./contract` | `./lib/types/contract/index.js` | Public contract with no Node or DOM dependency |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./client` | `./client/index.tsx` | Browser entry consumed by Vite |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

No workspace dependencies.

## Dev Note

Shared collapse interaction, reused by any panel (evidence: `packages/ui/layout` left and right columns). Both pieces consume the `@lfaa/ui-theme` motion tokens, so they stop animating when reduced motion is on.

- `PanelToggleButton`: accessible expand/collapse button. The divider line slides and fades between states; `side="right"` mirrors the same glyph, so both columns share one implementation.

  ```tsx
  <PanelToggleButton side="left" expanded={open} label={open ? collapseLabel : expandLabel} onClick={toggle} />
  ```

- `CollapsePane` (with `usePanePresence`): keeps a panel mounted until its close transition ends, clips the overflowing content instead of squeezing it, and marks a closing pane `inert` / `aria-hidden`. The caller animates the container width (the shell animates its grid track); the pane only owns presence and clipping.

  ```tsx
  <CollapsePane open={open} side="left" className={styles.leftPane}>{children}</CollapsePane>
  ```

Breakpoints can override `--panel-toggle-size` and `--panel-toggle-radius`; the default is a 2rem square.

## Scroll area

`ScrollArea` is the single scroll viewport for the shell, dialogs and lists. It replaces the browser's grey track with a transparent one and paints an inset, rounded, accent-tinted pill thumb: idle thumbs are the accent mixed with muted text, and they deepen toward the accent while scrolling or when hovered. Both colors come from `@lfaa/ui-theme` tokens (`--color-scrollbar-thumb`, `--color-scrollbar-thumb-hover`), so changing the accent color in settings restyles every scrollbar at once.

```tsx
<ScrollArea stableGutter className={styles.panelBody} ref={bodyRef}>
  {children}
</ScrollArea>
```

- `axis="y" | "x" | "both"` sets the default scroll direction. Defaults live in `:where()`, so a consumer class can still override the direction at a breakpoint (e.g. the settings catalog turns horizontal on phones).
- `stableGutter` keeps `scrollbar-gutter: stable`, so pages that grow past the dialog height do not shift horizontally.
- `ref` points at the scroll viewport itself, so callers can read or reset `scrollTop`.
- Chromium and Safari are styled through `::-webkit-scrollbar`; Firefox gets `scrollbar-width` / `scrollbar-color` behind `@supports not selector(::-webkit-scrollbar)`, because those standard properties would switch the custom thumb off in Chromium.

## Settings surface

Every settings page is a configuration list, not a layout showcase, so the shell lives here once and pages only compose it (rules: `docs/standards/settings-ui.md`).

| Component | Purpose |
|---|---|
| `SettingsPage` | Page shell: title, optional description, optional page-level `actions`, and the group rhythm. |
| `SettingGroup` | A titled group with an optional description. No border, background, radius or shadow: groups are separated by whitespace only. |
| `SettingRow` | One setting per row: name and description on the left, control on the right, right-aligned. |
| `SettingSwitch` / `SettingSegmented` / `SettingSelect` / `SettingMultiSelect` | Boolean, short enum, long enum with search, and multi-select controls. |
| `SettingFormField` / `SettingFormBlock` / `SettingFormActions` | Stacked form layout (label above, control below) for forms that are filled in order. Never use the row layout there. |
| `SettingDangerGroup` | Delete / clear / reset actions, always last on the page and coloured with the danger tokens. |

`settingsStyles` merges the layout layer (`SettingsSurface.module.css`) and the control layer (`SettingsControls.module.css`), so pages still import a single class map for inputs, buttons and read-only values.

## Base UI Primitives

Headless `@base-ui/react` primitives wrapped with CSS Modules and `@lfaa/ui-theme` semantic tokens (zero Tailwind):

- `DropdownMenu` (`DropdownMenuItem`, `DropdownMenuCheckboxItem`, `DropdownMenuSeparator`): viewport-aware popup menu with keyboard navigation and focus restoration.
- `UiSwitch`: accessible tactile toggle switch.
- `UiSelect`: keyboard-navigable dropdown select with collision-aware positioning.
- `UiTabs`: segmented tab list with smooth indicator and arrow-key navigation.
- `UiTooltip`: hover-debounced tooltip with automatic placement.
