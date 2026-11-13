<a id="readme-top"></a>

# LFAA-Harness: AI Agent Workspace and Application Platform

[简体中文](README.md) · [Documentation](docs/README.md) · [Development docs](docs/development/README.md)

**LFAA is a self-hosted AI Agent workspace and application platform.** Users describe a goal; the configured model selects currently available tools, Skills, and domain capabilities as needed. The responsible service validates and executes each action, then returns its real result. LFAA ships its own Runtime, capability packages, and application services; a separate DeepSeek Harness installation is not required.

## Quick start

```sh
git clone https://github.com/yubboo/LFAA.git lfaa
cd lfaa
pnpm install
pnpm run build
pnpm lfaa web
```

Open `http://127.0.0.1:3000`. Create an administrator account when prompted on first use. The administrator can configure a Provider, API key, and active model under **Settings → AI & Models**. Provider requests may incur charges. See the [CLI guide](docs/user/cli.md) for installation, data directories, and deployment options.

## How the product works

- `/work` is the general chat and project development workspace.
- `/canvas` is the system canvas. After an App is selected, the canvas uses capabilities registered by that App.
- Domain Apps provide manual operation screens. Manual actions and the Agent share the relevant domain service, data, and permission owners.
- When a task needs host access, an authenticated Daemon executes it on the target node and returns the result.

Available models and tools depend on the active Profile, account configuration, permissions, Provider, and node status. A source directory alone does not mean a capability is assembled or runnable. See the [development plan](docs/开发计划.md) for current status and gaps, and the [capability package inventory](docs/harness-packages.md) for package status.

## Capability areas

| Area | Description |
|---|---|
| General Agent | Handle conversations and project work in `/work`; discover tools as needed and use results from real Owners. |
| Games and runtimes | Manage Minecraft and runtimes such as Java. See the current plan for game library and SteamCMD integration status. |
| Writing and AI video | Manage projects and content through their domain services. Generation depends on configured, available model providers. |
| Game connectivity | Existing networking and node capabilities are being expanded; full invitations, voice, collaboration, and cross-network acceptance are not yet delivered. |

## Build commands

Run commands from the repository root:

| Target | Command | Output |
|---|---|---|
| Web frontend | `pnpm run build:web` | `dist/apps/web/`; does not include a standalone Control Plane |
| Control Plane | `pnpm run build:control-plane` | `dist/apps/control-plane/` |
| Full Web runtime tree | `pnpm run build` | Harness, Web, Control Plane, and CLI; then run `pnpm lfaa web` |
| Windows desktop installer | `pnpm run build:desktop:win` | Windows x64 Electron NSIS under `dist/apps/desktop-electron/` |

Electron is the Windows desktop mainline. macOS/Linux desktop and Android have not been delivered. Tauri commands remain for compatibility. See the [Electron guide](apps/desktop-electron/README.md) for packaging, updates, and platform limits. Build artifacts belong under the repository root `dist/`.

For development, run `pnpm dev`. Requirements: Node.js `>=24.15.0` and pnpm `11.17.0`. Windows desktop builds also require the Rust stable MSVC toolchain; Web builds do not require Rust.

## Data and permissions

- Administrators configure the Provider, models, and API key in Settings. The backend protects keys and does not send them to the browser. Runtime preferences remain account-scoped.
- Each Owner stores its own user, session, and domain data. Changing the data directory does not migrate existing data. Read the [storage guide](docs/subsystems/storage.md) first.
- Tool actions use the permission mode configured in Settings and are still validated for identity, parameters, data scope, and target node at execution time. Full access does not mean operating-system sandboxing.
- Before public deployment, configure a strong `JWT_SECRET` and a persistent data directory. See [CLI configuration](docs/user/cli.md#configuration-and-data).

## Documentation

| Find | Read |
|---|---|
| Installation, startup, configuration, and data | [CLI guide](docs/user/cli.md) |
| Current system structure and Owners | [System architecture](docs/系统总体架构.md) |
| Implemented capabilities, gaps, and priorities | [Current development plan](docs/开发计划.md) |
| Repository change and delivery rules | [Development rules](开发规范.md) · [AGENTS](AGENTS.md) |
| Package responsibilities and app assembly | [Package rules](docs/development/package-responsibilities.md) · [Entry assembly map](docs/workspace-entry-map.md) |
| Goal and acceptance record for a task | [Task contract index](docs/PROMPTS.md) |
| Product versions and release notes | [Release log](docs/updata-log.md) |

[Back to top](#readme-top)
