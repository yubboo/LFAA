---
description: Real terminal UI for the browser (xterm.js rendering, WebSocket I/O, theme-aware sizing)
kind: package
---

# @lfaa/client-ui-terminal

Browser side of the real terminal: renders PTY output with `xterm.js`, wires keyboard input and resize to the Host over a WebSocket, and follows the active light/dark theme.

## Responsibility

- `TerminalPane`: mounts xterm + fit addon into the right workbench tab (and, later, the bottom panel); reconnects on remount so the Host-side PTY survives a refresh.
- `connectTerminal`: opens `/api/terminal?sessionId=…` with the one-time API token, sends `open / data / resize / kill`, receives `ready / data / exit / error`.
- Theme colours are read from `@lfaa/ui-theme` semantic variables at mount time, never hard-coded.

## Not in scope

- PTY process management and shell policy (see `@lfaa/terminal`).
- Panel placement / bottom dock layout (see `@lfaa/ui-layout`).