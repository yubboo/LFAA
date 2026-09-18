# 开发日志索引

> **开发前先查本索引。**
> 当前结论优先看 `active/`，历史对比再看 `archive/`。

## 编号说明

- 现有真实历史从 **#1** 开始；
- 没有发现真实 `#0`，因此不伪造 #0；
- #1 - #20 现在全部可以在本索引直接找到；
- 主编号以后不得无记录缺失。

## 当前有效记录

| 主编号 | 名称 | 最新变更 | 状态 | 关键词 | 当前日志 |
|---|---|---|---|---|---|
| #2 | 配置系统 | #2.0 | active | 配置、Schema、模型、账号、权限 | `active/0002-config-system.md` |
| #20 | 开发日志分层规范 | #20.1 | active | 日志、索引、命名、中文、归档、历史 | `active/0020-dev-logs.md` |

## 历史已交付记录

| 主编号 | 名称 | 记录版本 | 状态 | 关键词 | 历史日志 |
|---|---|---|---|---|---|
| #1 | 项目初始化与架构骨架 | #1.0 | delivered | 项目、架构、骨架、治理 | `archive/0001-foundation/0001.0-foundation.md` |
| #3 | 导入路径与 Alias 优化 | #3.0 | delivered | 导入、Alias、路径、边界 | `archive/0003-import-paths/0003.0-import-paths.md` |
| #4 | 稳定工作区同步与 GitHub 推送 | #4.0 | delivered | 同步、GitHub、工作区、推送 | `archive/0004-workspace-sync/0004.0-workspace-sync.md` |
| #5 | 同步日志目录优化 | #5.0 | delivered | 同步、日志、目录 | `archive/0005-sync-logs/0005.0-sync-logs.md` |
| #6 | GitHub 一键推送修复 | #6.0 | delivered | GitHub、推送、Commit、脚本 | `archive/0006-github-push/0006.0-github-push.md` |
| #7 | GitHub 远程检测与中文输出修复 | #7.0 | delivered | GitHub、origin、中文、错误 | `archive/0007-github-remote/0007.0-github-remote.md` |
| #8 | 用户首次配置 Git origin | #8.0 | delivered | Git、origin、远程、配置 | `archive/0008-git-origin/0008.0-git-origin.md` |
| #9 | 终端完成状态与关闭提示 | #9.0 | delivered | 终端、提示、关闭、脚本 | `archive/0009-terminal-status/0009.0-terminal-status.md` |
| #10 | 移除 Commit 二次确认 | #10.0 | delivered | Git、Commit、确认、交互 | `archive/0010-commit-confirm/0010.0-commit-confirm.md` |
| #11 | Git Clone 后一键更新源码 | #11.0 | delivered | Git、更新、拉取、源码 | `archive/0011-source-update/0011.0-source-update.md` |
| #12 | Windows 脚本菜单化与强制拉取 | #12.0 | delivered | 脚本、菜单、强制拉取、备份 | `archive/0012-script-menus/0012.0-script-menus.md` |
| #13 | Git 更新脚本路径无关化 | #13.0 | delivered | Git、路径、盘符、更新 | `archive/0013-path-update/0013.0-path-update.md` |
| #14 | 同步菜单顺序优化 | #14.0 | delivered | 同步、菜单、交互 | `archive/0014-sync-menu/0014.0-sync-menu.md` |
| #15 | Update 远程差异读取修复 | #15.0 | delivered | Update、diff、拉取、Git | `archive/0015-update-diff/0015.0-update-diff.md` |
| #16 | 项目治理与资源边界加固 | #16.0 | delivered | 治理、归属、资源、安全、质量 | `archive/0016-governance/0016.0-governance.md` |
| #17 | pnpm-only 一致性修复 | #17.0 | delivered | pnpm、包管理、工具链 | `archive/0017-pnpm-only/0017.0-pnpm-only.md` |
| #18 | Setup 缺少 Cargo 容错修复 | #18.0 | delivered | Setup、Cargo、Rust、依赖 | `archive/0018-setup-cargo/0018.0-setup-cargo.md` |
| #19 | 一键准备与项目资源根收敛 | #19.0 | delivered | Setup、资源、lfaa、热插拔 | `archive/0019-resource-root/0019.0-resource-root.md` |

## #20 历史变更

| 版本 | 状态 | 日志 |
|---|---|---|
| #20.0 | superseded | `archive/0020-dev-logs/0020.0-dev-logs.md` |
| #20.1 | active | `active/0020-dev-logs.md` |

## 查找方法

例如搜索：

```text
Cargo
```

可以直接定位 #18。

搜索：

```text
插件
```

可以定位资源、治理或当前相关任务。

读取顺序：

1. 先搜索本 `INDEX.md`；
2. 如果任务仍 active，先读 active；
3. 如果需要比较前后变化，再读对应 archive；
4. archive 中列出的原始来源用于深入回溯；
5. 禁止只看旧历史就覆盖当前 active 结论。
