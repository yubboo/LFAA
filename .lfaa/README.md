# LFAA 项目资源根

`.lfaa/` 是当前项目唯一的 LFAA 项目级资源与本机运行数据命名空间。

它不是 Secret Store，也不是源码 package。

```text
.lfaa/
├── manifest.json
├── lock.json
├── skills/
├── experts/
├── plugins/
├── extensions/
├── mcp/
├── cache/
├── state/
├── tmp/
└── logs/
```

## 项目资源

`skills/`、`experts/`、`plugins/`、`extensions/`、`mcp/` 是当前项目的热插拔资源目录。

根目录不再允许另建 `/skills` 或 `/plugins` 作为第二事实源。

## 本机运行数据

`cache/`、`state/`、`tmp/`、`logs/` 不进入正常 Git/Release 事实源。

## 为什么使用点号目录

点号用于表示“项目工具自己的命名空间”，避免与用户项目本身常见的 `plugins/`、`skills/`、`extensions/` 目录冲突。

Windows 文件系统、Electron、Node.js 和 Rust 都可以正常访问该目录。后续 Desktop 会通过项目资源管理界面直接打开和管理它。

## Secret

API Key、Token、Credential 明文禁止进入 `.lfaa/`。这里只能保存 `credential_ref`。
