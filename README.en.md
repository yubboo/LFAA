# LFAA-Harness

[简体中文](README.md) · [Documentation](docs/README.md)

LFAA is an application workbench for local and remote hosts. Its first-party Harness runtime combines Profiles and Bundles through Cordis. Web and desktop share the client UI; execution remains with the existing authorization, Session, App and Daemon owners.

The current product includes AI tool execution and domain integrations. Feature availability depends on the selected Profile and actual node capabilities. A directory or successful build does not establish runtime integration. See the [architecture overview](docs/subsystems/architecture.md), [current plan](docs/开发计划.md) and [review evidence](docs/development/workspace-audit-20261008.md).

Use Node.js 24.15.0 or later and the pnpm version declared in root `package.json`:

```sh
pnpm install
pnpm run build
pnpm lfaa web
```

Web serves the UI, API and Socket.IO from one origin, normally `http://127.0.0.1:3000`. Windows local mode can manage a local Daemon; `--no-local-daemon` disables that behavior. Production public listeners require an explicit strong JWT secret and persistent absolute data directory. Initial account creation is never bypassed.

Windows node preparation uses `pnpm run build:windows-sandbox-host`. `pnpm dev` is the development entry. The primary Windows desktop command is `pnpm run build:desktop:win` for Electron; Tauri retains the explicit `build:desktop:tauri:win` compatibility entry. macOS packaging and real desktop acceptance remain separate work.

All generated outputs belong in root `dist/`. Runtime data is excluded from releases. Packaging does not authorize publishing or installation. See [CLI guidance](docs/user/cli.md), [repository layout](docs/reference/repository-layout.md) and [contributor workflow](docs/development/guide.md).
