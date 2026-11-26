---
description: "Unified connector center for MCP servers and declarative CLI tools."
kind: "package"
---

# @lfaa/connectors

English | [中文](README.zh.md)

## Usage

The Host aggregates MCP servers (read-only view) and CLI connectors into one list for Settings → Integrations → Connectors. A CLI connector declares an executable plus actions (argv template with typed parameters); each action becomes a `cli__<connector>__<action>` tool with approval, project scope, timeout, and output cap. Commands always run as an argv array without a shell.

Connector settings are encrypted in `~/.lfaa/connectors.json` with a separate local key. `env` values support `${env:NAME}` references so credentials stay in the host environment instead of the configuration file.

Built-in templates (`gh`, `docker`, `pnpm`) only prefill configuration; they never install binaries.