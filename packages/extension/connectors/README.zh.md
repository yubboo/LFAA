---
description: "MCP 服务器与声明式 CLI 工具的统一连接器中心。"
kind: "package"
---

# @lfaa/connectors

[English](README.md) | 中文

## 用法

Host 把 MCP 服务器（只读展示）与 CLI 连接器聚合成一份列表，供「设置 → 集成 → 连接器」使用。每个 CLI 连接器声明可执行文件与若干动作（argv 模板 + 强类型参数），每个动作注册为 `cli__<连接器>__<动作>` 工具，带审批、项目范围、超时与输出上限。命令始终以 argv 数组直接启动，不经过 shell。

连接器配置用本机独立密钥加密保存在 `~/.lfaa/connectors.json`。环境变量值支持 `${env:NAME}` 引用，凭据留在宿主环境而不是配置文件里。

内置模板（`gh`、`docker`、`pnpm`）只预填配置，不安装任何二进制。