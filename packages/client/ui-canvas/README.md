---
description: "Right workbench infinite canvas, media nodes and 3D previs."
kind: "package"
---

# @lfaa/client-ui-canvas

English | [中文](README.zh.md)

## Summary

The browser plugin adds Infinite canvas to the right workbench's new tab. It hosts the project graph editor and the 3D previs editor.

## Exports

- `./client` provides the browser Cordis plugin.
- `.` is the package's empty build entry.

## Development

React Flow manages editing and typed handles. Three.js loads when the user opens a previs node. Both the graph and exported media use the canvas project's authenticated Host endpoint.
