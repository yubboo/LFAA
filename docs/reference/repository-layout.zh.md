# 根目录职责

[English](repository-layout.md) · [文档目录](../README.zh.md)

根目录骨架继续使用当前 Harness 包架构。参考 DSH 的分类方式，不复制其业务包或另建 Owner。

| 路径 | 职责 |
|---|---|
| `apps/` | CLI、Web、节点、Electron 主线和 Tauri 兼容外壳的运行入口 |
| `packages/<领域>/<包>/` | 第一方能力、服务、客户端组件与 Profile/Bundle 装配；各组/包 README 解释 Owner |
| `native/` | Windows Sandbox Host 原生实现 |
| `scripts/` | 工作区生成、验证、构建、启动和发布工具 |
| `docs/` | 分类文档、权威合同、生成清单与历史归档 |
| `.agents/`、`.codex/` | 仓库 Agent 技能与工具配置 |
| `.github/` | Issue/PR 模板与持续检查 |
| `data/` | 本机运行数据，实际数据根读取配置，不进入发行物 |
| `dist/` | 唯一构建/打包/备份输出；能力包、运行入口和临时组装各自隔离 |

没有根 `frontend/` 或 `server/` 源码入口。`dist/frontend`、`dist/server` 等既有历史产物不是当前装配入口；在没有确认占用情况前不删除它们。正式备份与旧版本安装器保留。

包数量由 [生成清单](../harness-packages.md) 对账。`implemented` 只表示源码包/组合包存在，不代表功能接入、运行验收或达到 DSH 能力。上游占位目录有历史保留要求，不能因为空就批量删除；已实现包的无用 `.gitkeep` 可以清理。
