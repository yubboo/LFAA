---
description: Real PTY terminal service for the host (node-pty sessions, resize, lifecycle, WebSocket protocol)
kind: package
---

# @lfaa/terminal

Host-side real terminal service. One PTY per chat session, driven by `node-pty` (ConPTY on Windows) and exposed to the browser through a WebSocket at `/api/terminal`.

## Responsibility

- Owns PTY processes: shell allowlist, `cwd` clamped to the project root, bounded replay buffer.
- Streams output / accepts input / applies resize over `ws`; disconnects keep the process alive so a page refresh reattaches.
- Kills processes on tab close, session switch and plugin unload.

## Not in scope

- Rendering (see `@lfaa/client-ui-terminal`) and the bottom/right panel layout (see `@lfaa/ui-layout`).
- Running one-off commands (that is `@lfaa/jobs`).

## API

- `TerminalService`: `open / write / resize / subscribe / kill / disposeAll`.
- `createTerminalUpgradeHandler({ getService, token, resolveCwd })`: returns a `server.on("upgrade")` handler; returns `false` for non-terminal paths so other upgrade handlers (e.g. Vite HMR) still work.