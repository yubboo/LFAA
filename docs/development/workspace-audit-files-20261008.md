# 本轮变更文件清单（2026-10-08）

范围为当前 H:/LFAA1。以实施前差异快照比对，排除未改动的既有更新代码；同时修改的文件保留原并行工作，表中只说明本轮职责。安装/构建输出不属于源码清单；一次性脚本交付前删除。

共 196 个源码/文档路径（移动按旧/新路径分别列出），含删除。绝对路径仅用于本轮交付定位，不构成未来访问/清理授权。

| 文件（当前相对导航） | 绝对路径 | 本轮职责 |
|---|---|---|
| [.github/workflows/check.yml](../../.github/workflows/check.yml) | `H:/LFAA1/.github/workflows/check.yml` | Linux/Windows 工程门禁与长期回归，未声明远端已运行 |
| [.gitignore](../../.gitignore) | `H:/LFAA1/.gitignore` | 防止再次收录无关 CAD 附件 |
| [README.en.md](../../README.en.md) | `H:/LFAA1/README.en.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [README.md](../../README.md) | `H:/LFAA1/README.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [apps/cli/README.md](../../apps/cli/README.md) | `H:/LFAA1/apps/cli/README.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [apps/cli/tests/capability-mcp.test.mjs](../../apps/cli/tests/capability-mcp.test.mjs) | `H:/LFAA1/apps/cli/tests/capability-mcp.test.mjs` | 业务 import 前隔离数据根，关闭存储并清理合成夹具 |
| [apps/cli/tests/capability-skill.test.mjs](../../apps/cli/tests/capability-skill.test.mjs) | `H:/LFAA1/apps/cli/tests/capability-skill.test.mjs` | 业务 import 前隔离数据根，关闭存储并清理合成夹具 |
| [apps/cli/tests/daemon-task-lanes.test.mjs](../../apps/cli/tests/daemon-task-lanes.test.mjs) | `H:/LFAA1/apps/cli/tests/daemon-task-lanes.test.mjs` | Shell/运维槽隔离、轮转与停止领取/收尾 |
| [apps/cli/tests/isolated-data.mjs](../../apps/cli/tests/isolated-data.mjs) | `H:/LFAA1/apps/cli/tests/isolated-data.mjs` | 业务 import 前隔离数据根，关闭存储并清理合成夹具 |
| [apps/cli/tests/managed-process-shutdown.test.mjs](../../apps/cli/tests/managed-process-shutdown.test.mjs) | `H:/LFAA1/apps/cli/tests/managed-process-shutdown.test.mjs` | 受管进程正常/强制退出确认，失败不冒充成功及回归 |
| [apps/cli/tests/mcp-tools.test.mjs](../../apps/cli/tests/mcp-tools.test.mjs) | `H:/LFAA1/apps/cli/tests/mcp-tools.test.mjs` | 业务 import 前隔离数据根，关闭存储并清理合成夹具 |
| [apps/cli/tests/session-cache.test.mjs](../../apps/cli/tests/session-cache.test.mjs) | `H:/LFAA1/apps/cli/tests/session-cache.test.mjs` | JSONL 冷缓存/完整性、轻量计划状态与有界账户列表 |
| [apps/cli/tests/settings-contract.test.mjs](../../apps/cli/tests/settings-contract.test.mjs) | `H:/LFAA1/apps/cli/tests/settings-contract.test.mjs` | 十分类默认值、非法值拒绝、客户端一致与重启偏好回归 |
| [apps/desktop-electron/README.md](../../apps/desktop-electron/README.md) | `H:/LFAA1/apps/desktop-electron/README.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [apps/desktop-electron/src/main.mjs](../../apps/desktop-electron/src/main.mjs) | `H:/LFAA1/apps/desktop-electron/src/main.mjs` | 既有桌面 Owner 接通子进程 IPC、安全关闭与启动失败收尾 |
| [apps/desktop-electron/src/service-shutdown.mjs](../../apps/desktop-electron/src/service-shutdown.mjs) | `H:/LFAA1/apps/desktop-electron/src/service-shutdown.mjs` | Electron IPC 正常退出确认、异常/超时拒绝及回归 |
| [apps/desktop-electron/tests/service-shutdown.test.mjs](../../apps/desktop-electron/tests/service-shutdown.test.mjs) | `H:/LFAA1/apps/desktop-electron/tests/service-shutdown.test.mjs` | Electron IPC 正常退出确认、异常/超时拒绝及回归 |
| [apps/web/package.json](../../apps/web/package.json) | `H:/LFAA1/apps/web/package.json` | 实际依赖/公开入口/主线命令对账，不改变产品发行版本 |
| [docs/PROMPTS.md](../PROMPTS.md) | `H:/LFAA1/docs/PROMPTS.md` | 当前合同、完整历史索引与本轮实际验收 |
| [docs/README.md](../README.md) | `H:/LFAA1/docs/README.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [docs/README.zh.md](../README.zh.md) | `H:/LFAA1/docs/README.zh.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [docs/archive/README.md](../archive/README.md) | `H:/LFAA1/docs/archive/README.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [docs/archive/README.zh.md](../archive/README.zh.md) | `H:/LFAA1/docs/archive/README.zh.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [docs/archive/audits/design-qa.md](../archive/audits/design-qa.md) | `H:/LFAA1/docs/archive/audits/design-qa.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/archive/audits/harness-agent-delivery.md](../archive/audits/harness-agent-delivery.md) | `H:/LFAA1/docs/archive/audits/harness-agent-delivery.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/archive/audits/harness-cleanup-files.json](../archive/audits/harness-cleanup-files.json) | `H:/LFAA1/docs/archive/audits/harness-cleanup-files.json` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/archive/audits/harness-cleanup.md](../archive/audits/harness-cleanup.md) | `H:/LFAA1/docs/archive/audits/harness-cleanup.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/archive/audits/harness-delivery-files.json](../archive/audits/harness-delivery-files.json) | `H:/LFAA1/docs/archive/audits/harness-delivery-files.json` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/archive/audits/harness-delivery-files.md](../archive/audits/harness-delivery-files.md) | `H:/LFAA1/docs/archive/audits/harness-delivery-files.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/archive/audits/harness-delivery.md](../archive/audits/harness-delivery.md) | `H:/LFAA1/docs/archive/audits/harness-delivery.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/archive/audits/harness-migration-files.json](../archive/audits/harness-migration-files.json) | `H:/LFAA1/docs/archive/audits/harness-migration-files.json` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/archive/audits/harness-migration.md](../archive/audits/harness-migration.md) | `H:/LFAA1/docs/archive/audits/harness-migration.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/archive/audits/harness-p0-audit.md](../archive/audits/harness-p0-audit.md) | `H:/LFAA1/docs/archive/audits/harness-p0-audit.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/archive/audits/minecraft-deployment-plan.md](../archive/audits/minecraft-deployment-plan.md) | `H:/LFAA1/docs/archive/audits/minecraft-deployment-plan.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/archive/audits/settings-center-20260929.md](../archive/audits/settings-center-20260929.md) | `H:/LFAA1/docs/archive/audits/settings-center-20260929.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/archive/audits/workspace-audit-cleanup.json](../archive/audits/workspace-audit-cleanup.json) | `H:/LFAA1/docs/archive/audits/workspace-audit-cleanup.json` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/archive/audits/workspace-audit.md](../archive/audits/workspace-audit.md) | `H:/LFAA1/docs/archive/audits/workspace-audit.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/archive/contracts/01.md](../archive/contracts/01.md) | `H:/LFAA1/docs/archive/contracts/01.md` | 分档历史合同，保留 ID、显式锚点、索引和原始证据 |
| [docs/archive/contracts/02.md](../archive/contracts/02.md) | `H:/LFAA1/docs/archive/contracts/02.md` | 分档历史合同，保留 ID、显式锚点、索引和原始证据 |
| [docs/archive/contracts/03.md](../archive/contracts/03.md) | `H:/LFAA1/docs/archive/contracts/03.md` | 分档历史合同，保留 ID、显式锚点、索引和原始证据 |
| [docs/archive/contracts/04.md](../archive/contracts/04.md) | `H:/LFAA1/docs/archive/contracts/04.md` | 分档历史合同，保留 ID、显式锚点、索引和原始证据 |
| [docs/archive/contracts/05.md](../archive/contracts/05.md) | `H:/LFAA1/docs/archive/contracts/05.md` | 分档历史合同，保留 ID、显式锚点、索引和原始证据 |
| [docs/archive/contracts/06.md](../archive/contracts/06.md) | `H:/LFAA1/docs/archive/contracts/06.md` | 分档历史合同，保留 ID、显式锚点、索引和原始证据 |
| [docs/archive/contracts/07.md](../archive/contracts/07.md) | `H:/LFAA1/docs/archive/contracts/07.md` | 分档历史合同，保留 ID、显式锚点、索引和原始证据 |
| [docs/archive/contracts/08.md](../archive/contracts/08.md) | `H:/LFAA1/docs/archive/contracts/08.md` | 分档历史合同，保留 ID、显式锚点、索引和原始证据 |
| [docs/archive/contracts/09.md](../archive/contracts/09.md) | `H:/LFAA1/docs/archive/contracts/09.md` | 分档历史合同，保留 ID、显式锚点、索引和原始证据 |
| [docs/archive/plans/development-plan-20261008.md](../archive/plans/development-plan-20261008.md) | `H:/LFAA1/docs/archive/plans/development-plan-20261008.md` | 完整保留整理前计划与业务要求 |
| [docs/development/guide.md](guide.md) | `H:/LFAA1/docs/development/guide.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [docs/development/guide.zh.md](guide.zh.md) | `H:/LFAA1/docs/development/guide.zh.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [docs/development/performance.md](performance.md) | `H:/LFAA1/docs/development/performance.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [docs/development/performance.zh.md](performance.zh.md) | `H:/LFAA1/docs/development/performance.zh.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/development/workspace-audit-20261008.md](workspace-audit-20261008.md) | `H:/LFAA1/docs/development/workspace-audit-20261008.md` | GLM 逐项判断、整改、设置、证据与限制 |
| [docs/development/workspace-audit-20261008.zh.md](workspace-audit-20261008.zh.md) | `H:/LFAA1/docs/development/workspace-audit-20261008.zh.md` | GLM 逐项判断、整改、设置、证据与限制 |
| [docs/development/workspace-audit-files-20261008.md](workspace-audit-files-20261008.md) | `H:/LFAA1/docs/development/workspace-audit-files-20261008.md` | 本轮逐文件职责、移动/删除与并行基线说明 |
| docs/execution-control.md（删除/移出） | `H:/LFAA1/docs/execution-control.md` | 移动至 docs/subsystems/execution-control.zh.md，原内容保留且导航更新 |
| docs/harness-agent-delivery.md（删除/移出） | `H:/LFAA1/docs/harness-agent-delivery.md` | 移动至 docs/archive/audits/harness-agent-delivery.md，原内容保留且导航更新 |
| docs/harness-cleanup-files.json（删除/移出） | `H:/LFAA1/docs/harness-cleanup-files.json` | 移动至 docs/archive/audits/harness-cleanup-files.json，原内容保留且导航更新 |
| docs/harness-cleanup.md（删除/移出） | `H:/LFAA1/docs/harness-cleanup.md` | 移动至 docs/archive/audits/harness-cleanup.md，原内容保留且导航更新 |
| docs/harness-cli.md（删除/移出） | `H:/LFAA1/docs/harness-cli.md` | 移动至 docs/user/cli.zh.md，原内容保留且导航更新 |
| docs/harness-delivery-files.json（删除/移出） | `H:/LFAA1/docs/harness-delivery-files.json` | 移动至 docs/archive/audits/harness-delivery-files.json，原内容保留且导航更新 |
| docs/harness-delivery-files.md（删除/移出） | `H:/LFAA1/docs/harness-delivery-files.md` | 移动至 docs/archive/audits/harness-delivery-files.md，原内容保留且导航更新 |
| docs/harness-delivery.md（删除/移出） | `H:/LFAA1/docs/harness-delivery.md` | 移动至 docs/archive/audits/harness-delivery.md，原内容保留且导航更新 |
| docs/harness-migration-files.json（删除/移出） | `H:/LFAA1/docs/harness-migration-files.json` | 移动至 docs/archive/audits/harness-migration-files.json，原内容保留且导航更新 |
| docs/harness-migration.md（删除/移出） | `H:/LFAA1/docs/harness-migration.md` | 移动至 docs/archive/audits/harness-migration.md，原内容保留且导航更新 |
| docs/harness-p0-audit.md（删除/移出） | `H:/LFAA1/docs/harness-p0-audit.md` | 移动至 docs/archive/audits/harness-p0-audit.md，原内容保留且导航更新 |
| [docs/harness-packages.json](../harness-packages.json) | `H:/LFAA1/docs/harness-packages.json` | 从真实工作区生成包状态/数量与可移植导航 |
| [docs/harness-packages.md](../harness-packages.md) | `H:/LFAA1/docs/harness-packages.md` | 从真实工作区生成包状态/数量与可移植导航 |
| docs/harness-storage.md（删除/移出） | `H:/LFAA1/docs/harness-storage.md` | 移动至 docs/subsystems/storage.zh.md，原内容保留且导航更新 |
| [docs/i18n/README.md](../i18n/README.md) | `H:/LFAA1/docs/i18n/README.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [docs/i18n/README.zh.md](../i18n/README.zh.md) | `H:/LFAA1/docs/i18n/README.zh.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| docs/mc提示词/说明.md（删除/移出） | `H:/LFAA1/docs/mc提示词/说明.md` | 移动至 docs/reference/prompts/minecraft/说明.md，原内容保留且导航更新 |
| docs/minecraft-deployment-plan.md（删除/移出） | `H:/LFAA1/docs/minecraft-deployment-plan.md` | 移动至 docs/archive/audits/minecraft-deployment-plan.md，原内容保留且导航更新 |
| docs/performance.md（删除/移出） | `H:/LFAA1/docs/performance.md` | 移动至 docs/development/performance.zh.md，原内容保留且导航更新 |
| docs/quality/design-qa.md（删除/移出） | `H:/LFAA1/docs/quality/design-qa.md` | 移动至 docs/archive/audits/design-qa.md，原内容保留且导航更新 |
| [docs/reference/prompts/README.md](../reference/prompts/README.md) | `H:/LFAA1/docs/reference/prompts/README.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [docs/reference/prompts/README.zh.md](../reference/prompts/README.zh.md) | `H:/LFAA1/docs/reference/prompts/README.zh.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [docs/reference/prompts/minecraft/说明.md](../reference/prompts/minecraft/说明.md) | `H:/LFAA1/docs/reference/prompts/minecraft/说明.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/reference/prompts/writing/作品简介.md](../reference/prompts/writing/作品简介.md) | `H:/LFAA1/docs/reference/prompts/writing/作品简介.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/reference/prompts/writing/剧情分析引擎.md](../reference/prompts/writing/剧情分析引擎.md) | `H:/LFAA1/docs/reference/prompts/writing/剧情分析引擎.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/reference/prompts/writing/参考面板-润色.md](../reference/prompts/writing/参考面板-润色.md) | `H:/LFAA1/docs/reference/prompts/writing/参考面板-润色.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/reference/prompts/writing/取名器.md](../reference/prompts/writing/取名器.md) | `H:/LFAA1/docs/reference/prompts/writing/取名器.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/reference/prompts/writing/妙笔对话.md](../reference/prompts/writing/妙笔对话.md) | `H:/LFAA1/docs/reference/prompts/writing/妙笔对话.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/reference/prompts/writing/封面画面描述.md](../reference/prompts/writing/封面画面描述.md) | `H:/LFAA1/docs/reference/prompts/writing/封面画面描述.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/reference/prompts/writing/建书向导.md](../reference/prompts/writing/建书向导.md) | `H:/LFAA1/docs/reference/prompts/writing/建书向导.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/reference/prompts/writing/榜单趋势解读.md](../reference/prompts/writing/榜单趋势解读.md) | `H:/LFAA1/docs/reference/prompts/writing/榜单趋势解读.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/reference/prompts/writing/灵感生成.md](../reference/prompts/writing/灵感生成.md) | `H:/LFAA1/docs/reference/prompts/writing/灵感生成.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/reference/prompts/writing/竞品拆书.md](../reference/prompts/writing/竞品拆书.md) | `H:/LFAA1/docs/reference/prompts/writing/竞品拆书.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/reference/prompts/writing/编辑器-划词处理.md](../reference/prompts/writing/编辑器-划词处理.md) | `H:/LFAA1/docs/reference/prompts/writing/编辑器-划词处理.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/reference/prompts/writing/编辑器-续写补全.md](../reference/prompts/writing/编辑器-续写补全.md) | `H:/LFAA1/docs/reference/prompts/writing/编辑器-续写补全.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/reference/prompts/writing/逐章自动生文.md](../reference/prompts/writing/逐章自动生文.md) | `H:/LFAA1/docs/reference/prompts/writing/逐章自动生文.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/reference/prompts/writing/通用指令与小件.md](../reference/prompts/writing/通用指令与小件.md) | `H:/LFAA1/docs/reference/prompts/writing/通用指令与小件.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/reference/repository-layout.md](../reference/repository-layout.md) | `H:/LFAA1/docs/reference/repository-layout.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [docs/reference/repository-layout.zh.md](../reference/repository-layout.zh.md) | `H:/LFAA1/docs/reference/repository-layout.zh.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [docs/subsystems/architecture.md](../subsystems/architecture.md) | `H:/LFAA1/docs/subsystems/architecture.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [docs/subsystems/architecture.zh.md](../subsystems/architecture.zh.md) | `H:/LFAA1/docs/subsystems/architecture.zh.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [docs/subsystems/execution-control.md](../subsystems/execution-control.md) | `H:/LFAA1/docs/subsystems/execution-control.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [docs/subsystems/execution-control.zh.md](../subsystems/execution-control.zh.md) | `H:/LFAA1/docs/subsystems/execution-control.zh.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/subsystems/storage.md](../subsystems/storage.md) | `H:/LFAA1/docs/subsystems/storage.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [docs/subsystems/storage.zh.md](../subsystems/storage.zh.md) | `H:/LFAA1/docs/subsystems/storage.zh.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| [docs/updata-log.md](../updata-log.md) | `H:/LFAA1/docs/updata-log.md` | 保留版本历史，解释授权重置与当前产品对账 |
| [docs/user/cli.md](../user/cli.md) | `H:/LFAA1/docs/user/cli.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [docs/user/cli.zh.md](../user/cli.zh.md) | `H:/LFAA1/docs/user/cli.zh.md` | 分类迁移原文，更新相对导航；历史事实不改写 |
| docs/workspace-audit-cleanup.json（删除/移出） | `H:/LFAA1/docs/workspace-audit-cleanup.json` | 移动至 docs/archive/audits/workspace-audit-cleanup.json，原内容保留且导航更新 |
| docs/workspace-audit.md（删除/移出） | `H:/LFAA1/docs/workspace-audit.md` | 移动至 docs/archive/audits/workspace-audit.md，原内容保留且导航更新 |
| docs/小说提示词/作品简介.md（删除/移出） | `H:/LFAA1/docs/小说提示词/作品简介.md` | 移动至 docs/reference/prompts/writing/作品简介.md，原内容保留且导航更新 |
| docs/小说提示词/剧情分析引擎.md（删除/移出） | `H:/LFAA1/docs/小说提示词/剧情分析引擎.md` | 移动至 docs/reference/prompts/writing/剧情分析引擎.md，原内容保留且导航更新 |
| docs/小说提示词/参考面板-润色.md（删除/移出） | `H:/LFAA1/docs/小说提示词/参考面板-润色.md` | 移动至 docs/reference/prompts/writing/参考面板-润色.md，原内容保留且导航更新 |
| docs/小说提示词/取名器.md（删除/移出） | `H:/LFAA1/docs/小说提示词/取名器.md` | 移动至 docs/reference/prompts/writing/取名器.md，原内容保留且导航更新 |
| docs/小说提示词/嘉兴放射性贝壳.dwg（删除/移出） | `H:/LFAA1/docs/小说提示词/嘉兴放射性贝壳.dwg` | 删除与产品无关的 CAD 附件，不改写 Git 历史 |
| docs/小说提示词/妙笔对话.md（删除/移出） | `H:/LFAA1/docs/小说提示词/妙笔对话.md` | 移动至 docs/reference/prompts/writing/妙笔对话.md，原内容保留且导航更新 |
| docs/小说提示词/封面画面描述.md（删除/移出） | `H:/LFAA1/docs/小说提示词/封面画面描述.md` | 移动至 docs/reference/prompts/writing/封面画面描述.md，原内容保留且导航更新 |
| docs/小说提示词/建书向导.md（删除/移出） | `H:/LFAA1/docs/小说提示词/建书向导.md` | 移动至 docs/reference/prompts/writing/建书向导.md，原内容保留且导航更新 |
| docs/小说提示词/榜单趋势解读.md（删除/移出） | `H:/LFAA1/docs/小说提示词/榜单趋势解读.md` | 移动至 docs/reference/prompts/writing/榜单趋势解读.md，原内容保留且导航更新 |
| docs/小说提示词/灵感生成.md（删除/移出） | `H:/LFAA1/docs/小说提示词/灵感生成.md` | 移动至 docs/reference/prompts/writing/灵感生成.md，原内容保留且导航更新 |
| docs/小说提示词/竞品拆书.md（删除/移出） | `H:/LFAA1/docs/小说提示词/竞品拆书.md` | 移动至 docs/reference/prompts/writing/竞品拆书.md，原内容保留且导航更新 |
| docs/小说提示词/编辑器-划词处理.md（删除/移出） | `H:/LFAA1/docs/小说提示词/编辑器-划词处理.md` | 移动至 docs/reference/prompts/writing/编辑器-划词处理.md，原内容保留且导航更新 |
| docs/小说提示词/编辑器-续写补全.md（删除/移出） | `H:/LFAA1/docs/小说提示词/编辑器-续写补全.md` | 移动至 docs/reference/prompts/writing/编辑器-续写补全.md，原内容保留且导航更新 |
| docs/小说提示词/逐章自动生文.md（删除/移出） | `H:/LFAA1/docs/小说提示词/逐章自动生文.md` | 移动至 docs/reference/prompts/writing/逐章自动生文.md，原内容保留且导航更新 |
| docs/小说提示词/通用指令与小件.md（删除/移出） | `H:/LFAA1/docs/小说提示词/通用指令与小件.md` | 移动至 docs/reference/prompts/writing/通用指令与小件.md，原内容保留且导航更新 |
| [docs/开发计划.md](../开发计划.md) | `H:/LFAA1/docs/开发计划.md` | 当前优先级与缺口；旧业务记录归档保留 |
| [docs/系统总体架构.md](../系统总体架构.md) | `H:/LFAA1/docs/系统总体架构.md` | 同步实际 Owner、运行入口、存储/设置/调度与未验边界 |
| docs/设置中心审查与整改待办.md（删除/移出） | `H:/LFAA1/docs/设置中心审查与整改待办.md` | 移动至 docs/archive/audits/settings-center-20260929.md，原内容保留且导航更新 |
| [package.json](../../package.json) | `H:/LFAA1/package.json` | 实际依赖/公开入口/主线命令对账，不改变产品发行版本 |
| [packages/api/connectivity-controller/package.json](../../packages/api/connectivity-controller/package.json) | `H:/LFAA1/packages/api/connectivity-controller/package.json` | 实际依赖/公开入口/主线命令对账，不改变产品发行版本 |
| [packages/api/knowledge-controller/src/index.ts](../../packages/api/knowledge-controller/src/index.ts) | `H:/LFAA1/packages/api/knowledge-controller/src/index.ts` | 完整 App ID 与显式已接入目录项目子集收敛 |
| [packages/api/remotes/src/route-contracts.ts](../../packages/api/remotes/src/route-contracts.ts) | `H:/LFAA1/packages/api/remotes/src/route-contracts.ts` | Settings 拥有写入 schema，HTTP 重导出同一合同 |
| packages/api/workspace-controller/.gitkeep（删除/移出） | `H:/LFAA1/packages/api/workspace-controller/.gitkeep` | 删除已实现包内的无用空标记 |
| [packages/api/workspace-controller/src/index.ts](../../packages/api/workspace-controller/src/index.ts) | `H:/LFAA1/packages/api/workspace-controller/src/index.ts` | 完整 App ID 与显式已接入目录项目子集收敛 |
| packages/boot/plugin-manager/.gitkeep（删除/移出） | `H:/LFAA1/packages/boot/plugin-manager/.gitkeep` | 删除已实现包内的无用空标记 |
| [packages/client/connection/src/api.ts](../../packages/client/connection/src/api.ts) | `H:/LFAA1/packages/client/connection/src/api.ts` | 复用共享设置类型/默认值，保留既有桌面更新接口 |
| [packages/client/modules/README.md](../../packages/client/modules/README.md) | `H:/LFAA1/packages/client/modules/README.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [packages/client/modules/package.json](../../packages/client/modules/package.json) | `H:/LFAA1/packages/client/modules/package.json` | 实际依赖/公开入口/主线命令对账，不改变产品发行版本 |
| [packages/client/ui-layout/package.json](../../packages/client/ui-layout/package.json) | `H:/LFAA1/packages/client/ui-layout/package.json` | 实际依赖/公开入口/主线命令对账，不改变产品发行版本 |
| [packages/client/ui-layout/src/Workbench.tsx](../../packages/client/ui-layout/src/Workbench.tsx) | `H:/LFAA1/packages/client/ui-layout/src/Workbench.tsx` | App 路由读权威清单，快捷键配置引用提交后更新且不重挂监听 |
| [packages/client/ui-minecraft/README.md](../../packages/client/ui-minecraft/README.md) | `H:/LFAA1/packages/client/ui-minecraft/README.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [packages/client/ui-minecraft/package.json](../../packages/client/ui-minecraft/package.json) | `H:/LFAA1/packages/client/ui-minecraft/package.json` | 实际依赖/公开入口/主线命令对账，不改变产品发行版本 |
| [packages/client/ui-minecraft/src/assets/minecraftScenes.ts](../../packages/client/ui-minecraft/src/assets/minecraftScenes.ts) | `H:/LFAA1/packages/client/ui-minecraft/src/assets/minecraftScenes.ts` | 内置背景元数据移至纯数据 Owner，保留兼容导出 |
| [packages/client/ui-renderer/package.json](../../packages/client/ui-renderer/package.json) | `H:/LFAA1/packages/client/ui-renderer/package.json` | 实际依赖/公开入口/主线命令对账，不改变产品发行版本 |
| [packages/client/ui-settings-general/package.json](../../packages/client/ui-settings-general/package.json) | `H:/LFAA1/packages/client/ui-settings-general/package.json` | 实际依赖/公开入口/主线命令对账，不改变产品发行版本 |
| [packages/client/ui-settings-general/src/default-settings.ts](../../packages/client/ui-settings-general/src/default-settings.ts) | `H:/LFAA1/packages/client/ui-settings-general/src/default-settings.ts` | 客户端克隆共享默认值，保留兼容解析 |
| [packages/client/ui-settings/package.json](../../packages/client/ui-settings/package.json) | `H:/LFAA1/packages/client/ui-settings/package.json` | 实际依赖/公开入口/主线命令对账，不改变产品发行版本 |
| [packages/client/ui-settings/src/SettingsPage.tsx](../../packages/client/ui-settings/src/SettingsPage.tsx) | `H:/LFAA1/packages/client/ui-settings/src/SettingsPage.tsx` | 消费共享背景，保持现有设置界面与偏好 |
| [packages/client/ui-sidebar-files/package.json](../../packages/client/ui-sidebar-files/package.json) | `H:/LFAA1/packages/client/ui-sidebar-files/package.json` | 实际依赖/公开入口/主线命令对账，不改变产品发行版本 |
| [packages/client/ui-theme/package.json](../../packages/client/ui-theme/package.json) | `H:/LFAA1/packages/client/ui-theme/package.json` | 实际依赖/公开入口/主线命令对账，不改变产品发行版本 |
| [packages/client/ui-theme/src/login-appearance.ts](../../packages/client/ui-theme/src/login-appearance.ts) | `H:/LFAA1/packages/client/ui-theme/src/login-background.ts` | 历史登录背景入口现映射到登录页安全外观缓存 |
| [packages/client/ui-workflow/package.json](../../packages/client/ui-workflow/package.json) | `H:/LFAA1/packages/client/ui-workflow/package.json` | 实际依赖/公开入口/主线命令对账，不改变产品发行版本 |
| [packages/core/session/src/sessions.ts](../../packages/core/session/src/sessions.ts) | `H:/LFAA1/packages/core/session/src/sessions.ts` | JSONL 冷缓存/完整性、轻量计划状态与有界账户列表 |
| packages/credentials/credentials/.gitkeep（删除/移出） | `H:/LFAA1/packages/credentials/credentials/.gitkeep` | 删除已实现包内的无用空标记 |
| [packages/games/minecraft/README.md](../../packages/games/minecraft/README.md) | `H:/LFAA1/packages/games/minecraft/README.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [packages/host/daemon/README.md](../../packages/host/daemon/README.md) | `H:/LFAA1/packages/host/daemon/README.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [packages/host/daemon/src/daemon.mjs](../../packages/host/daemon/src/daemon.mjs) | `H:/LFAA1/packages/host/daemon/src/daemon.mjs` | Shell/运维槽隔离、轮转与停止领取/收尾 |
| [packages/host/daemon/src/managed-process-shutdown.mjs](../../packages/host/daemon/src/managed-process-shutdown.mjs) | `H:/LFAA1/packages/host/daemon/src/managed-process-shutdown.mjs` | 受管进程正常/强制退出确认，失败不冒充成功及回归 |
| [packages/host/daemon/src/task-lanes.mjs](../../packages/host/daemon/src/task-lanes.mjs) | `H:/LFAA1/packages/host/daemon/src/task-lanes.mjs` | Shell/运维槽隔离、轮转与停止领取/收尾 |
| packages/interaction/tool-ask-user/.gitkeep（删除/移出） | `H:/LFAA1/packages/interaction/tool-ask-user/.gitkeep` | 删除已实现包内的无用空标记 |
| packages/interaction/user-approval/.gitkeep（删除/移出） | `H:/LFAA1/packages/interaction/user-approval/.gitkeep` | 删除已实现包内的无用空标记 |
| packages/interaction/user-questions/.gitkeep（删除/移出） | `H:/LFAA1/packages/interaction/user-questions/.gitkeep` | 删除已实现包内的无用空标记 |
| [packages/jobs/jobs/README.md](../../packages/jobs/jobs/README.md) | `H:/LFAA1/packages/jobs/jobs/README.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| packages/sandbox/sandbox-policy/.gitkeep（删除/移出） | `H:/LFAA1/packages/sandbox/sandbox-policy/.gitkeep` | 删除已实现包内的无用空标记 |
| packages/sandbox/sandbox/.gitkeep（删除/移出） | `H:/LFAA1/packages/sandbox/sandbox/.gitkeep` | 删除已实现包内的无用空标记 |
| [packages/session/session-persistence-jsonl/README.md](../../packages/session/session-persistence-jsonl/README.md) | `H:/LFAA1/packages/session/session-persistence-jsonl/README.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [packages/session/session-persistence-jsonl/src/persistence.ts](../../packages/session/session-persistence-jsonl/src/persistence.ts) | `H:/LFAA1/packages/session/session-persistence-jsonl/src/persistence.ts` | JSONL 冷缓存/完整性、轻量计划状态与有界账户列表 |
| [packages/session/session-persistence-jsonl/src/repository.ts](../../packages/session/session-persistence-jsonl/src/repository.ts) | `H:/LFAA1/packages/session/session-persistence-jsonl/src/repository.ts` | JSONL 冷缓存/完整性、轻量计划状态与有界账户列表 |
| [packages/settings/README.md](../../packages/settings/README.md) | `H:/LFAA1/packages/settings/README.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [packages/settings/settings/package.json](../../packages/settings/settings/package.json) | `H:/LFAA1/packages/settings/settings/package.json` | 实际依赖/公开入口/主线命令对账，不改变产品发行版本 |
| [packages/settings/settings/src/service.ts](../../packages/settings/settings/src/service.ts) | `H:/LFAA1/packages/settings/settings/src/service.ts` | 共享默认值、严格保存、兼容读取和单一 Minecraft 拆分 |
| [packages/settings/settings/src/validation.ts](../../packages/settings/settings/src/validation.ts) | `H:/LFAA1/packages/settings/settings/src/validation.ts` | Settings 拥有写入 schema，HTTP 重导出同一合同 |
| packages/storage/storage/.gitkeep（删除/移出） | `H:/LFAA1/packages/storage/storage/.gitkeep` | 删除已实现包内的无用空标记 |
| packages/subprocess/subprocess/.gitkeep（删除/移出） | `H:/LFAA1/packages/subprocess/subprocess/.gitkeep` | 删除已实现包内的无用空标记 |
| packages/typert/generator/.gitkeep（删除/移出） | `H:/LFAA1/packages/typert/generator/.gitkeep` | 删除已实现包内的无用空标记 |
| packages/typert/loader/.gitkeep（删除/移出） | `H:/LFAA1/packages/typert/loader/.gitkeep` | 删除已实现包内的无用空标记 |
| packages/typert/protocol/.gitkeep（删除/移出） | `H:/LFAA1/packages/typert/protocol/.gitkeep` | 删除已实现包内的无用空标记 |
| packages/typert/registry/.gitkeep（删除/移出） | `H:/LFAA1/packages/typert/registry/.gitkeep` | 删除已实现包内的无用空标记 |
| [packages/util/home-paths/README.md](../../packages/util/home-paths/README.md) | `H:/LFAA1/packages/util/home-paths/README.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [packages/util/home-paths/src/private-directory.d.mts](../../packages/util/home-paths/src/private-directory.d.mts) | `H:/LFAA1/packages/util/home-paths/src/private-directory.d.mts` | OS 凭据目录权限合同或真实 ACL/链接拒绝回归 |
| [packages/util/home-paths/src/private-directory.mjs](../../packages/util/home-paths/src/private-directory.mjs) | `H:/LFAA1/packages/util/home-paths/src/private-directory.mjs` | OS 凭据目录权限合同或真实 ACL/链接拒绝回归 |
| [packages/util/launch-environment/src/config.ts](../../packages/util/launch-environment/src/config.ts) | `H:/LFAA1/packages/util/launch-environment/src/config.ts` | 既有密钥路径复用 OS 私有目录保护 |
| [packages/util/values/README.md](../../packages/util/values/README.md) | `H:/LFAA1/packages/util/values/README.md` | 分类/语言入口或目标 Owner 说明，修正命令和相对链接 |
| [packages/util/values/src/application-id.ts](../../packages/util/values/src/application-id.ts) | `H:/LFAA1/packages/util/values/src/application-id.ts` | 完整 App ID 与显式已接入目录项目子集收敛 |
| [packages/util/values/src/builtin-backgrounds.ts](../../packages/util/values/src/builtin-backgrounds.ts) | `H:/LFAA1/packages/util/values/src/builtin-backgrounds.ts` | 内置背景元数据移至纯数据 Owner，保留兼容导出 |
| [packages/util/values/src/settings-contract.ts](../../packages/util/values/src/settings-contract.ts) | `H:/LFAA1/packages/util/values/src/settings-contract.ts` | 唯一共享 Settings 类型/默认值，保持既有用户偏好 |
| packages/workflow/workflow/.gitkeep（删除/移出） | `H:/LFAA1/packages/workflow/workflow/.gitkeep` | 删除已实现包内的无用空标记 |
| packages/workspace/workspace/.gitkeep（删除/移出） | `H:/LFAA1/packages/workspace/workspace/.gitkeep` | 删除已实现包内的无用空标记 |
| [packages/workspace/workspace/package.json](../../packages/workspace/workspace/package.json) | `H:/LFAA1/packages/workspace/workspace/package.json` | 实际依赖/公开入口/主线命令对账，不改变产品发行版本 |
| [packages/workspace/workspace/src/index.ts](../../packages/workspace/workspace/src/index.ts) | `H:/LFAA1/packages/workspace/workspace/src/index.ts` | 完整 App ID 与显式已接入目录项目子集收敛 |
| [pnpm-lock.yaml](../../pnpm-lock.yaml) | `H:/LFAA1/pnpm-lock.yaml` | 既有内部依赖/Joi 声明、Vite 兼容插件与 KaTeX 安全修复锁定 |
| [pnpm-workspace.yaml](../../pnpm-workspace.yaml) | `H:/LFAA1/pnpm-workspace.yaml` | 统一 KaTeX 直接/间接依赖至维护者安全修复版 |
| [scripts/check-workspace.mjs](../../scripts/check-workspace.mjs) | `H:/LFAA1/scripts/check-workspace.mjs` | 包/依赖/映射/版本/产物/文档检查及违规失败回归 |
| [scripts/harness-workspace.d.mts](../../scripts/harness-workspace.d.mts) | `H:/LFAA1/scripts/harness-workspace.d.mts` | 统一源码入口解析与 TS/Vite/Node 包清单映射 |
| [scripts/harness-workspace.mjs](../../scripts/harness-workspace.mjs) | `H:/LFAA1/scripts/harness-workspace.mjs` | 统一源码入口解析与 TS/Vite/Node 包清单映射 |
| [scripts/install-dependencies.ps1](../../scripts/install-dependencies.ps1) | `H:/LFAA1/scripts/install-dependencies.ps1` | 移除 main 强推菜单，保留正常推送保护 |
| [scripts/tests/math-rendering.test.mjs](../../scripts/tests/math-rendering.test.mjs) | `H:/LFAA1/scripts/tests/math-rendering.test.mjs` | 真实公式/Markdown 渲染和继承 trust 拒绝回归 |
| [scripts/tests/private-directory.test.mjs](../../scripts/tests/private-directory.test.mjs) | `H:/LFAA1/scripts/tests/private-directory.test.mjs` | OS 凭据目录权限合同或真实 ACL/链接拒绝回归 |
| [scripts/tests/workspace-check.test.mjs](../../scripts/tests/workspace-check.test.mjs) | `H:/LFAA1/scripts/tests/workspace-check.test.mjs` | 包/依赖/映射/版本/产物/文档检查及违规失败回归 |
| [tsconfig.client.json](../../tsconfig.client.json) | `H:/LFAA1/tsconfig.client.json` | 由真实包清单同步完整类型路径 |
| [tsconfig.host.json](../../tsconfig.host.json) | `H:/LFAA1/tsconfig.host.json` | 由真实包清单同步完整类型路径 |
| [开发规范.md](../../开发规范.md) | `H:/LFAA1/开发规范.md` | 去除过时固定版本，补文档配对、当前版本与工程门禁规则 |

## 移动对照

- `H:/LFAA1/docs/harness-cleanup-files.json` → `H:/LFAA1/docs/archive/audits/harness-cleanup-files.json`
- `H:/LFAA1/docs/harness-cleanup.md` → `H:/LFAA1/docs/archive/audits/harness-cleanup.md`
- `H:/LFAA1/docs/harness-delivery-files.json` → `H:/LFAA1/docs/archive/audits/harness-delivery-files.json`
- `H:/LFAA1/docs/harness-delivery-files.md` → `H:/LFAA1/docs/archive/audits/harness-delivery-files.md`
- `H:/LFAA1/docs/harness-delivery.md` → `H:/LFAA1/docs/archive/audits/harness-delivery.md`
- `H:/LFAA1/docs/harness-migration-files.json` → `H:/LFAA1/docs/archive/audits/harness-migration-files.json`
- `H:/LFAA1/docs/harness-migration.md` → `H:/LFAA1/docs/archive/audits/harness-migration.md`
- `H:/LFAA1/docs/harness-p0-audit.md` → `H:/LFAA1/docs/archive/audits/harness-p0-audit.md`
- `H:/LFAA1/docs/harness-agent-delivery.md` → `H:/LFAA1/docs/archive/audits/harness-agent-delivery.md`
- `H:/LFAA1/docs/workspace-audit-cleanup.json` → `H:/LFAA1/docs/archive/audits/workspace-audit-cleanup.json`
- `H:/LFAA1/docs/workspace-audit.md` → `H:/LFAA1/docs/archive/audits/workspace-audit.md`
- `H:/LFAA1/docs/minecraft-deployment-plan.md` → `H:/LFAA1/docs/archive/audits/minecraft-deployment-plan.md`
- `H:/LFAA1/docs/设置中心审查与整改待办.md` → `H:/LFAA1/docs/archive/audits/settings-center-20260929.md`
- `H:/LFAA1/docs/harness-cli.md` → `H:/LFAA1/docs/user/cli.zh.md`
- `H:/LFAA1/docs/harness-storage.md` → `H:/LFAA1/docs/subsystems/storage.zh.md`
- `H:/LFAA1/docs/execution-control.md` → `H:/LFAA1/docs/subsystems/execution-control.zh.md`
- `H:/LFAA1/docs/performance.md` → `H:/LFAA1/docs/development/performance.zh.md`
- `H:/LFAA1/docs/quality/design-qa.md` → `H:/LFAA1/docs/archive/audits/design-qa.md`
- `H:/LFAA1/docs/小说提示词/作品简介.md` → `H:/LFAA1/docs/reference/prompts/writing/作品简介.md`
- `H:/LFAA1/docs/小说提示词/剧情分析引擎.md` → `H:/LFAA1/docs/reference/prompts/writing/剧情分析引擎.md`
- `H:/LFAA1/docs/小说提示词/参考面板-润色.md` → `H:/LFAA1/docs/reference/prompts/writing/参考面板-润色.md`
- `H:/LFAA1/docs/小说提示词/取名器.md` → `H:/LFAA1/docs/reference/prompts/writing/取名器.md`
- `H:/LFAA1/docs/小说提示词/妙笔对话.md` → `H:/LFAA1/docs/reference/prompts/writing/妙笔对话.md`
- `H:/LFAA1/docs/小说提示词/封面画面描述.md` → `H:/LFAA1/docs/reference/prompts/writing/封面画面描述.md`
- `H:/LFAA1/docs/小说提示词/建书向导.md` → `H:/LFAA1/docs/reference/prompts/writing/建书向导.md`
- `H:/LFAA1/docs/小说提示词/榜单趋势解读.md` → `H:/LFAA1/docs/reference/prompts/writing/榜单趋势解读.md`
- `H:/LFAA1/docs/小说提示词/灵感生成.md` → `H:/LFAA1/docs/reference/prompts/writing/灵感生成.md`
- `H:/LFAA1/docs/小说提示词/竞品拆书.md` → `H:/LFAA1/docs/reference/prompts/writing/竞品拆书.md`
- `H:/LFAA1/docs/小说提示词/编辑器-划词处理.md` → `H:/LFAA1/docs/reference/prompts/writing/编辑器-划词处理.md`
- `H:/LFAA1/docs/小说提示词/编辑器-续写补全.md` → `H:/LFAA1/docs/reference/prompts/writing/编辑器-续写补全.md`
- `H:/LFAA1/docs/小说提示词/逐章自动生文.md` → `H:/LFAA1/docs/reference/prompts/writing/逐章自动生文.md`
- `H:/LFAA1/docs/小说提示词/通用指令与小件.md` → `H:/LFAA1/docs/reference/prompts/writing/通用指令与小件.md`
- `H:/LFAA1/docs/mc提示词/说明.md` → `H:/LFAA1/docs/reference/prompts/minecraft/说明.md`

## 保留的既有工作

- `H:/LFAA1/apps/desktop-electron/src/update-download-progress.mjs`：实施前已存在，本轮未改。
- `H:/LFAA1/apps/desktop-electron/src/update-manifest-fetch.mjs`：实施前已存在，本轮未改。
- `H:/LFAA1/apps/desktop-electron/tests/update-download-progress.test.mjs`：实施前已存在，本轮未改。
- `H:/LFAA1/apps/desktop-electron/tests/update-manifest-fetch.test.mjs`：实施前已存在，本轮未改。
- `H:/LFAA1/scripts/desktop-package-artifacts.mjs`：实施前已存在，本轮未改。
- `H:/LFAA1/scripts/tests/desktop-package-artifacts.test.mjs`：实施前已存在，本轮未改。

## 后续缺口修复增补（2026-10-08）

下列路径是四项明确缺口的后续修改，不计入上文原审查的 196 个路径统计；此前已经修改的文件保留其原职责记录。

| 文件（当前相对导航） | 绝对路径 | 后续修复职责 |
|---|---|---|
| [apps/desktop-tauri/src-tauri/src/main.rs](../../apps/desktop-tauri/src-tauri/src/main.rs) | `H:/LFAA1/apps/desktop-tauri/src-tauri/src/main.rs` | Tauri 子进程经 stdin 请求幂等退出，等待状态并在异常时拒绝关闭 |
| [packages/boot/app-boot/src/index.ts](../../packages/boot/app-boot/src/index.ts) | `H:/LFAA1/packages/boot/app-boot/src/index.ts` | 让 stdin 关闭信号与 IPC/系统信号共用生命周期卸载 |
| [scripts/configure-tauri-output.mjs](../../scripts/configure-tauri-output.mjs) | `H:/LFAA1/scripts/configure-tauri-output.mjs` | 安全修复指向旧根目录且已断开的 Tauri gen junction |
| [packages/session/session-persistence-jsonl/src/persistence.ts](../../packages/session/session-persistence-jsonl/src/persistence.ts) | `H:/LFAA1/packages/session/session-persistence-jsonl/src/persistence.ts` | 有界候选的 JSONL 消息页读取和完整链校验 |
| [packages/session/session-persistence-jsonl/src/repository.ts](../../packages/session/session-persistence-jsonl/src/repository.ts) | `H:/LFAA1/packages/session/session-persistence-jsonl/src/repository.ts` | 为 Session Owner 暴露分页读取 |
| [packages/core/session/src/sessions.ts](../../packages/core/session/src/sessions.ts) | `H:/LFAA1/packages/core/session/src/sessions.ts` | 账户归属检查、游标分页和反馈投影 |
| [packages/api/session-controller/src/index.ts](../../packages/api/session-controller/src/index.ts) | `H:/LFAA1/packages/api/session-controller/src/index.ts` | 为认证消息路由增加可选分页参数和错误映射 |
| [packages/client/connection/src/api.ts](../../packages/client/connection/src/api.ts) | `H:/LFAA1/packages/client/connection/src/api.ts` | 请求 AI 消息页并回传下一游标 |
| [packages/client/ui-chat/src/AiWorkChat.tsx](../../packages/client/ui-chat/src/AiWorkChat.tsx) | `H:/LFAA1/packages/client/ui-chat/src/AiWorkChat.tsx` | 主聊天初始页、加载更早消息与视口保留 |
| [packages/client/ui-chat/src/AiWorkSideChat.tsx](../../packages/client/ui-chat/src/AiWorkSideChat.tsx) | `H:/LFAA1/packages/client/ui-chat/src/AiWorkSideChat.tsx` | 侧聊消息分页和源会话切换复位 |
| [packages/core/tools/src/mcp-tools.ts](../../packages/mcp/mcp-client/src/runtime.ts) | `H:/LFAA1/packages/core/tools/src/mcp-tools.ts` | MCP 连接池、账户/App/配置隔离、租约和回收 |
| [packages/boot/capability-mcp/src/index.ts](../../packages/boot/capability-mcp/src/index.ts) | `H:/LFAA1/packages/boot/capability-mcp/src/index.ts` | 安装检查/写入流程使用完整权威服务列表和账户上下文 |
| [packages/boot/capability-installs/src/index.ts](../../packages/boot/capability-installs/src/index.ts) | `H:/LFAA1/packages/boot/capability-installs/src/index.ts` | 将账户上下文传给能力安装检查适配器 |
| [packages/core/agent-loop/src/execute-turn.ts](../../packages/core/agent-loop/src/execute-turn.ts) | `H:/LFAA1/packages/core/agent-loop/src/execute-turn.ts` | Agent MCP 发现绑定真实用户并刷新完整设置快照 |
| [apps/cli/tests/session-cache.test.mjs](../../apps/cli/tests/session-cache.test.mjs) | `H:/LFAA1/apps/cli/tests/session-cache.test.mjs` | 130 条消息多页顺序、末页和账户隔离回归 |
| [apps/cli/tests/mcp-tools.test.mjs](../../apps/cli/tests/mcp-tools.test.mjs) | `H:/LFAA1/apps/cli/tests/mcp-tools.test.mjs` | MCP 同配置复用、账户/App 隔离、配置更换与租约回归 |
| [apps/cli/tests/capability-mcp.test.mjs](../../apps/cli/tests/capability-mcp.test.mjs) | `H:/LFAA1/apps/cli/tests/capability-mcp.test.mjs` | 安装适配器账户上下文回归 |
| [apps/cli/tests/agent-runtime.test.mjs](../../apps/cli/tests/agent-runtime.test.mjs) | `H:/LFAA1/apps/cli/tests/agent-runtime.test.mjs` | Agent Runtime 传递用户上下文的回归 |
| [apps/web/vite.config.ts](../../apps/web/vite.config.ts) | `H:/LFAA1/apps/web/vite.config.ts` | 按构建证据拆分 Web 共享依赖 chunk，保留实际超限告警 |
| [packages/boot/capability-mcp/README.md](../../packages/boot/capability-mcp/README.md) | `H:/LFAA1/packages/boot/capability-mcp/README.md` | MCP 连接池的隔离、空闲回收和未验边界 |
| [packages/client/README.md](../../packages/client/README.md) | `H:/LFAA1/packages/client/README.md` | AI Work 主聊/侧聊分页行为和性能边界 |
| [docs/PROMPTS.md](../PROMPTS.md) | `H:/LFAA1/docs/PROMPTS.md` | 更新四项缺口合同状态及验证证据 |
| [docs/开发计划.md](../开发计划.md) | `H:/LFAA1/docs/开发计划.md` | 跟进未验收实机与长日志治理计划 |
| [docs/系统总体架构.md](../系统总体架构.md) | `H:/LFAA1/docs/系统总体架构.md` | 当前 Tauri、Session 分页、MCP Owner 和 Web 行为事实 |
| [docs/subsystems/architecture.zh.md](../subsystems/architecture.zh.md) | `H:/LFAA1/docs/subsystems/architecture.zh.md` | 中文子系统事实与运行边界 |
| [docs/subsystems/architecture.md](../subsystems/architecture.md) | `H:/LFAA1/docs/subsystems/architecture.md` | 英文子系统事实与运行边界 |
| [packages/core/session/README.md](../../packages/core/session/README.md) | `H:/LFAA1/packages/core/session/README.md` | Session 分页 Owner 与全链扫描成本 |
| [packages/session/session-persistence-jsonl/README.md](../../packages/session/session-persistence-jsonl/README.md) | `H:/LFAA1/packages/session/session-persistence-jsonl/README.md` | JSONL 消息页内存/CPU 行为 |
| [docs/development/workspace-audit-20261008.zh.md](workspace-audit-20261008.zh.md) | `H:/LFAA1/docs/development/workspace-audit-20261008.zh.md` | 中文审计报告追加缺口修复和最终验收边界 |
| [docs/development/workspace-audit-20261008.md](workspace-audit-20261008.md) | `H:/LFAA1/docs/development/workspace-audit-20261008.md` | 英文审计报告同步追加修复与最终验收边界 |
| [docs/development/workspace-audit-files-20261008.md](workspace-audit-files-20261008.md) | `H:/LFAA1/docs/development/workspace-audit-files-20261008.md` | 本次追加路径职责清单 |

下列路径记录 MCP 出站校验和 Session 分页的追加修复；文件可能同时包含此前工作，本表只说明此项修复的职责。

| 文件（当前相对导航） | 绝对路径 | 本次修复职责 |
|---|---|---|
| [packages/util/launch-environment/src/config.ts](../../packages/util/launch-environment/src/config.ts) | `H:/LFAA1/packages/util/launch-environment/src/config.ts` | 集中判定桌面、本机 CLI 回环、开发/测试回环与远程生产的私网 MCP 策略 |
| [packages/core/tools/package.json](../../packages/core/tools/package.json) | `H:/LFAA1/packages/core/tools/package.json` | 声明 MCP Tools Owner 对 launch-environment 配置的直接依赖 |
| [packages/core/tools/src/mcp-network.ts](../../packages/mcp/mcp-client/src/network.ts) | `H:/LFAA1/packages/core/tools/src/mcp-network.ts` | 全地址解析、非公网拒绝和固定已校验 DNS 结果的 HTTP lookup |
| [packages/core/tools/src/mcp-tools.ts](../../packages/mcp/mcp-client/src/runtime.ts) | `H:/LFAA1/packages/core/tools/src/mcp-tools.ts` | MCP 请求使用安全地址校验和固定连接；继续拒绝重定向 |
| [packages/session/session-persistence-jsonl/src/persistence.ts](../../packages/session/session-persistence-jsonl/src/persistence.ts) | `H:/LFAA1/packages/session/session-persistence-jsonl/src/persistence.ts` | 单遍异步校验 JSONL，并以至多 101 条有序候选替代逐事件全量排序 |
| [packages/core/session/src/sessions.ts](../../packages/core/session/src/sessions.ts) | `H:/LFAA1/packages/core/session/src/sessions.ts` | 将消息页读取作为异步 Session Owner API 暴露 |
| [packages/api/session-controller/src/index.ts](../../packages/api/session-controller/src/index.ts) | `H:/LFAA1/packages/api/session-controller/src/index.ts` | 认证分页路由等待异步 JSONL 页完成后响应 |
| [apps/cli/tests/mcp-tools.test.mjs](../../apps/cli/tests/mcp-tools.test.mjs) | `H:/LFAA1/apps/cli/tests/mcp-tools.test.mjs` | 地址类别、混合 DNS、固定解析和部署模式边界回归 |
| [apps/cli/tests/session-cache.test.mjs](../../apps/cli/tests/session-cache.test.mjs) | `H:/LFAA1/apps/cli/tests/session-cache.test.mjs` | 多页顺序、游标、反馈、账户隔离和损坏拒绝回归 |
| [apps/cli/tests/harness-agent-api.test.mjs](../../apps/cli/tests/harness-agent-api.test.mjs) | `H:/LFAA1/apps/cli/tests/harness-agent-api.test.mjs` | 完整装配登录态分页回归；等待异步记忆落盘并通过 Session Owner API 核对用量 |
| [pnpm-lock.yaml](../../pnpm-lock.yaml) | `H:/LFAA1/pnpm-lock.yaml` | 与直接 workspace 依赖声明保持锁图一致 |
| [packages/boot/capability-mcp/README.md](../../packages/boot/capability-mcp/README.md) | `H:/LFAA1/packages/boot/capability-mcp/README.md` | MCP 远程/本机地址政策与能力边界 |
| [packages/core/session/README.md](../../packages/core/session/README.md) | `H:/LFAA1/packages/core/session/README.md` | Session 异步单遍扫描、内存工作集和未完成索引成本 |
| [packages/session/session-persistence-jsonl/README.md](../../packages/session/session-persistence-jsonl/README.md) | `H:/LFAA1/packages/session/session-persistence-jsonl/README.md` | JSONL 分页行为与逐页线性扫描边界 |
| [docs/开发计划.md](../开发计划.md) | `H:/LFAA1/docs/开发计划.md` | 当前 Session 分页事实与后续长日志治理计划 |
| [docs/系统总体架构.md](../系统总体架构.md) | `H:/LFAA1/docs/系统总体架构.md` | MCP 出站与 Session 分页当前 Owner/边界 |
| [docs/PROMPTS.md](../PROMPTS.md) | `H:/LFAA1/docs/PROMPTS.md` | 追加修复合同与实际验收记录 |
| [docs/development/workspace-audit-20261008.zh.md](workspace-audit-20261008.zh.md) | `H:/LFAA1/docs/development/workspace-audit-20261008.zh.md` | 中文风险审查、修复证据和未验收范围 |
| [docs/development/workspace-audit-20261008.md](workspace-audit-20261008.md) | `H:/LFAA1/docs/development/workspace-audit-20261008.md` | 英文摘要同步追加修复事实 |
| [docs/development/workspace-audit-files-20261008.md](workspace-audit-files-20261008.md) | `H:/LFAA1/docs/development/workspace-audit-files-20261008.md` | 本次修复文件职责索引 |
