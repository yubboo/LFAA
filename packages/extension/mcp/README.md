---
description: "Native MCP client and session tool registration."
kind: "package"
---

# @lfaa/mcp

English | [中文](README.zh.md)

## Usage

The Host connects to Stdio, Streamable HTTP and legacy SSE servers. It registers discovered tools and limits project connections to their sessions. Configure connections in Settings → Integrations → MCP or import a Claude Desktop/Cursor `mcpServers` object. Imports start disabled.

The Host encrypts connection settings in `~/.lfaa/mcp-servers.json` with a separate local key and omits them from API responses. Server and tool trust settings control approval. Project scope limits tool visibility and invocation through LFAA. Stdio servers run under the host's OS account.
