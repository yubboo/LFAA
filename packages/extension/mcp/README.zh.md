---
description: "原生 MCP 客户端与会话工具注册。"
kind: "package"
---

# @lfaa/mcp

[English](README.md) | 中文

## 用法

Host 连接 Stdio、Streamable HTTP 和旧版 SSE 服务，注册发现的工具，并按会话所属项目限制可见性。可在「设置 → 集成 → MCP」配置连接，或导入 Claude Desktop/Cursor 的 `mcpServers` 对象。导入的服务默认为停用。

Host 将连接配置加密保存在 `~/.lfaa/mcp-servers.json`，密钥单独保存在本机。接口不回传连接参数。服务器与单个工具的信任设置控制审批。项目范围限制在 LFAA 中看到或调用工具的会话。Stdio 服务以宿主的系统用户身份运行。
