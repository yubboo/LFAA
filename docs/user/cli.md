# CLI and startup

[简体中文](cli.zh.md) · [Documentation](../README.md)

Use Node.js >=24.15.0 and pnpm 11.17.0. Root `package.json` defines the commands; [the Chinese source](cli.zh.md) includes historical verification records.

```sh
pnpm install
pnpm run build
pnpm lfaa web
```

Web runs the compiled Harness and frontend on one origin, normally `http://127.0.0.1:3000`. Host and port come from configuration. Windows x64 local mode manages a Daemon unless a remote connection is configured or `--no-local-daemon` is specified. Ctrl+C unloads the runtime and releases storage locks. Standalone node preparation uses `pnpm run build:windows-sandbox-host`, then `pnpm lfaa daemon`.

On Windows, `lfaa.bat` opens the workbench: 1 installs declared dependencies; 2 opens startup choices; 3 builds the Electron installer; 4 checks the environment; 5 creates a source backup; 6 performs a normal confirmed Git push; 7 checks npm login and version availability, then confirms and publishes the CLI package; 8 safely updates local source; 0 exits. The force-push entry has been removed. First-time Web use is 1 → 2 → Enter; startup checks source/build fingerprints and builds stale artifacts.

The Vite choice waits for the existing control plane and uses port 5173 without restarting services. `pnpm dev` starts the complete development runtime. Unknown port owners are not terminated.

In the startup submenu, 1 or Enter starts the complete Web service. Choice 2 starts only a standalone Daemon and requires an absolute `LFAA_DATA_DIR`. Choice 4 starts only the Vite frontend and waits for an already running control plane.

`pnpm run pack:cli` assembles the npm candidate under `dist/npm/`; online `npx @yubboo/lfaa web` requires a published version. Menu choice 7 publishes the version from `apps/cli/package.json` to the official npm registry after confirmation and preflight checks. Electron candidates are versioned under `dist/apps/desktop-electron/`. Packaging does not publish, install or restart the product. Preserve data, backups and previous releases.
