# Repository layout

[简体中文](repository-layout.zh.md) · [Documentation](../README.md)

LFAA keeps its current Harness package layout. DSH informs documentation organization; its business implementation is not copied and does not create additional LFAA owners.

| Path | Responsibility |
|---|---|
| `apps/` | CLI, Web, node, primary Electron and compatibility Tauri entries |
| `packages/<domain>/<package>/` | First-party services, capabilities, UI and Profile/Bundle composition |
| `native/` | Native Windows Sandbox Host |
| `scripts/` | Workspace generation, validation, builds, startup and publishing tools |
| `docs/` | Topic guides, authoritative contracts, generated inventory and archives |
| `.agents/`, `.codex/` | Repository Agent skills and configuration |
| `.github/` | Issue/PR templates and continuous checks |
| `data/` | Runtime data; the effective root comes from configuration and is excluded from releases |
| `dist/` | All build, package and backup outputs, separated by responsibility |

There are no root `frontend/` or `server/` source entries. Legacy outputs such as `dist/frontend` and `dist/server` are not current assembly inputs. They are retained until active use can be ruled out. Previous installers and formal backups are preserved.

The [generated inventory](../harness-packages.md) distinguishes packages from placeholders. Package presence does not prove runtime integration or DSH feature parity. Requested upstream placeholders remain; redundant markers inside implemented packages may be removed.
