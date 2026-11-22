---
description: "Colored file and folder type icons plus extension-to-icon mapping shared by the workspace tree, file tabs, breadcrumbs and change lists."
kind: "package"
---

# @lfaa/ui-icons

English | [中文](README.zh.md)

## Summary

Colored file and folder type icons plus extension-to-icon mapping shared by the workspace tree, file tabs, breadcrumbs and change lists.

This package lives in `packages/ui/icons`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry re-exporting the mapping contract |
| `./contract` | `./lib/types/contract/index.js` | Public mapping contract with no Node or DOM dependency |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./client` | `./client/index.tsx` | Browser entry exposing `FileTypeIcon` |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `react`

## Assets And License

Icon glyphs are extracted from `@iconify-json/vscode-icons@1.2.30` (vscode-icons, MIT). The original license text is kept in `LICENSES/vscode-icons-LICENSE.txt`; only the glyphs used by the file tree are bundled.

## Dev Note

Run `node scripts/test.mjs --filter ui/icons` to verify the mapping and rendering.