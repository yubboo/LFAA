# LFAA 更新日志

> 根目录只保留当前索引和最近版本。
> 历史详细记录放入 `docs/changelog/`。

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
