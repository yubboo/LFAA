---
description: "Right workbench infinite canvas, media nodes and 3D previs."
kind: "package"
---

# @lfaa/client-ui-canvas

English | [中文](README.zh.md)

## Summary

The browser plugin adds Infinite canvas to the right workbench's new tab. It hosts the project graph editor and the 3D previs editor.

Double-click blank space to create a node or import an asset. Right-click blank space to add a node, fit the canvas, paste, or upload. New nodes and imported assets are placed at the pointer.

Drag an image or video from the asset library onto the canvas to create a reference node at the drop point. Click an asset to insert it without dragging. Moving one or more selected nodes can be undone or redone.

The canvas toolbar opens the node list, template gallery, shared library, add-node panel, searchable tools, and clip editor. Image tools crop, rotate, resize, annotate, split the grid, or compose a contact sheet. Video tools capture frames, sample a clip, crop the picture, resize, trim, or split audio from video. Images and videos become new canvas assets. Audio downloads locally. Video export depends on browser recording support.

## Exports

- `./client` provides the browser Cordis plugin.
- `.` is the package's empty build entry.

## Development

React Flow manages editing and typed handles. Three.js loads when the user opens a previs node. Both the graph and exported media use the canvas project's authenticated Host endpoint.
