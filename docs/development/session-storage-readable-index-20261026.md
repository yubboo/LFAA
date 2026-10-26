<a id="lfaa-session-storage-readable-index-20261026"></a>

# 290-LFAA 会话目录可读索引（2026-10-26）

## 用户问题与目标

用户在 `C:\Users\Administrator\.lfaa\sessions` 中看到不可读的哈希目录名。为资源管理器增加自动生成的 `会话目录索引.txt`，映射会话标题到现有哈希目录；保留现有目录名和 `events.jsonl` 路径。

## Owner、入口与配置

- 运行入口：Control Plane 启动与现有 Session 提交/删除流程。
- 唯一 Owner：`packages/session/session-persistence-jsonl/src/repository.ts` 读取已验证的会话头并生成可重建索引；`persistence.ts` 继续唯一负责会话 ID 到哈希目录的映射及 JSONL 权威日志。
- 数据归属：索引位于 `<LFAA_HOME>/sessions/会话目录索引.txt`，仅派生自内存中的会话头，不读取消息正文；SQLite 会话头与 JSONL 权威事务合同不变。
- 设置：不新增或读取设置中心配置；Home 仍由 `lfaa-launch-environment` 的 `config.homeDirectory` 决定。权限、账户范围和会话操作语义不变。

## 修改边界与验收

- 允许范围：Session JSONL Owner、对应 README、存储路径架构表、本任务合同与长期回归。
- 禁止范围：不重命名、搬迁或改写现有会话目录及日志；不读取或复制会话消息正文；不新增数据库、设置、API 或第二份权威会话数据。
- 索引以 UTF-8 文本列出标题与对应哈希目录；标题中的换行和制表符不得破坏行列结构。索引在启动时可重建，并在新会话、标题改变及账户会话删除后刷新；临时替换文件和索引文件不影响 JSONL 重放。
- 生成成本只依赖轻量会话头，不扫描 `events.jsonl`；索引原子替换，生成失败不影响会话提交并留下诊断记录。
- 验收：隔离 Home 回归覆盖创建/改名映射、正文不进入索引、重启重建、账户清理后的索引更新及重放对索引文件的兼容；运行定向回归、Session 包构建和差异检查。真实用户 Home 不作为测试目录。

## 实施与验收记录

- `SessionRepository` 从已重放的轻量会话头生成 UTF-8 `会话目录索引.txt`，列出标题和摘要目录名；启动时全量重建，新建/改标题及账户会话删除时更新。标题控制字符被压成空格，消息正文不进入索引。
- 索引写入随机命名的同目录临时文件后原子替换；索引写入失败只记录错误，不影响已提交会话。JSONL 重放仅识别固定索引文件名与受限 UUID 临时文件；启动时清理崩溃遗留临时文件。现有目录及事件日志路径未迁移。
- `node --test apps/cli/tests/session-storage-index.test.mjs`：1/1 通过，覆盖标题映射、控制字符、正文排除、启动重建、临时文件清理与账户会话删除。`pnpm.cmd --filter lfaa-session-persistence-jsonl run build` 与 `pnpm.cmd run build:control-plane` 通过，产物均写入根 `dist/`。定向 `git diff --check` 通过。
- 性能证据为静态路径分析：索引从内存头部生成，不扫描当前目录合计约 361 MiB 的真实日志文件；标题未变化时普通消息提交不重写索引。未测真实 Home 的即时文件生成、运行中服务刷新或超大历史账户的索引生成耗时；本轮未重启用户服务。
- 设置中心：无相关配置，不新增或更改偏好；Home 仍由 `config.homeDirectory` 决定。
- 文件职责：`packages/session/session-persistence-jsonl/src/repository.ts`（生成与更新索引）；`packages/session/session-persistence-jsonl/src/persistence.ts`（重放识别索引/临时文件）；`apps/cli/tests/session-storage-index.test.mjs`（隔离 Home 回归）；`packages/session/session-persistence-jsonl/README.md`、`docs/系统总体架构.md`（数据布局合同）；`docs/PROMPTS.md`（索引与实施证据）；本文件（任务合同）。
