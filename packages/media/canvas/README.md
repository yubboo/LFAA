---
description: "Project canvas storage, graph validation and media execution."
kind: "package"
---

# @lfaa/canvas

English | [中文](README.zh.md)

## Summary

The Cordis Host service stores project canvases, versioned media and generation runs under the local LFAA canvas directory. The web host routes project-scoped requests to this service.

## Exports

- `.` provides the default Cordis plugin and the canvas service.
- `./contract` provides the browser-safe graph, scene and run types and port definitions.

## Development

The Host validates each graph and saves edits using document revisions. Video tasks persist the provider task ID for later status checks. Removing the plugin leaves stored canvases intact.
