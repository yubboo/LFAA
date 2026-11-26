---
description: "Connector settings for MCP servers and declarative CLI tools."
kind: "package"
---

# @lfaa/client-ui-connectors

English | [中文](README.zh.md)

## Usage

Registers the Connectors view in Settings → Integrations. One page manages two kinds of connectors: MCP servers (connection, project scope, tool approval) and CLI tools (executable, actions, parameter schema, approval). The CLI editor prefills from the built-in `gh` / `docker` / `pnpm` templates and probes the executable before saving.

The page talks to the authenticated Host API only; it never executes commands itself.