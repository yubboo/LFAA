---
description: "MCP 服务器与声明式 CLI 工具的连接器设置页。"
kind: "package"
---

# @lfaa/client-ui-connectors

[English](README.md) | 中文

## 用法

在「设置 → 集成 → 连接器」注册连接器页面。一页管理两类连接器：MCP 服务器（连接、项目范围、工具审批）与命令行工具（可执行文件、动作、参数 schema、审批）。CLI 编辑器可从内置 `gh` / `docker` / `pnpm` 模板预填，并在保存前探测可执行文件。

页面只调用已认证的 Host 接口，自身不执行任何命令。