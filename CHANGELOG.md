# LFAA 更新日志

> 根目录只保留当前索引和最近版本。
> 历史详细记录放入 `docs/changelog/`。

## Unreleased / #16 项目治理、归属与项目级资源边界加固

- 状态：deliverable，待下一正式版本发布
- 日期：2026-09-18
- 完成 LFAA 官方 `lfaa-*` / `@lfaa/*` 命名与作者“二鱼”元数据门禁。
- 新增版权、第三方来源、NOTICE 与许可证保留规范。
- Skills、Experts、Plugins、Extensions、MCP 固定为项目 `.lfaa/` 安装，不再使用用户级事实源。
- 补齐安全、性能、质量门禁，明确 `Full` 不得绕过硬拒绝和 Rust Broker。
- 新增 `LFAA-Setup.bat` 及 `0-10` 开发环境、依赖、资源与质量菜单。
- 固定 pnpm 版本并生成 `pnpm-lock.yaml`。
- 原占位 typecheck/build/test 改为明确失败，禁止假绿。
- 当前主业务模块仍为 `config-system`，本任务不实现配置业务。

## #15 Update 安全拉取远程差异读取修复

- 产品：Little Fish AI Agent
- 简称：LFAA
- 用户版本：v0.0.14
- 状态：delivered
- 日期：2026-09-18

### 完成

- 修复 `0/0` 状态仍继续读取远程文件差异的问题。
- 本地与远程完全一致时直接返回“已是最新”。
- 本地纯领先时不再执行无意义远程 diff。
- 安全拉取分叉时先保护停止。
- 文件差异改为明确的本地 Commit 与远程 Ref 直接比较。
- 增加 `git diff-tree` 备用比较。
- 失败时保留两种 Git 比较命令的技术输出。
- 当前主业务模块仍为 `config-system`。

完整记录：

`docs/changelog/v0.0.14.md`
