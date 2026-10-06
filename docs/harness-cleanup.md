# LFAA Harness 核心、开发规则与节点整理

> 本文是 2026-09-30 的历史验证快照，包数量、构建命令及 `dist/server` / `dist/daemon` 路径不代表当前入口。当前架构与残留状态见 [2026-10-01 全仓审计](workspace-audit.md) 和 [系统总体架构](系统总体架构.md)。

## 核心与当前范围

用户目标 → 大模型理解/规划 → 主 Agent 自主选择 Tools、Skills、提示词、专家与子 Agent → App 业务服务/节点任务 → Daemon 执行 → 真实结果回到模型，继续判断与交付。

截至 2026-09-30，本任务记录的执行链仍处于发展阶段：当时仅有一次只读专家委派，完整可执行子 Agent 尚未接入。该状态是本历史快照，不代表当前能力；后续顺序子 Agent 的实际范围和待办见 [Agent Runtime 交付记录](harness-agent-delivery.md)、[当前系统架构](系统总体架构.md)与[开发计划](开发计划.md)。当时的模型来源、权限模式及源码包边界仍按后续权威文档执行。

本轮落实开发硬规则、发布隔离和节点入口/轮询退出。没有把目录占位写成已实现能力。

## 设置中心配置

无新增或重置设置。继续读取已激活 Provider/模型及推理模式、AI Runtime、permissions.mode（三种模式）、general.integratedShell、SteamCMD 安装方式/工具目录/游戏目录、Minecraft 实例目录，以及 LFAA_DATA_DIR 数据根目录。界面未改动，既有 Appearance、Shortcuts、Plugins、通知和布局偏好继续沿用原映射。

已有 71 项叶子默认值、前端默认值和服务端默认值静态对照一致；原类型、Joi 校验、账户持久化与数据库迁移链保持。完整默认值盘点见 [首轮设置盘点](harness-migration.md#设置中心配置盘点)。节点在认证心跳和任务参数中读取业务配置，模型/权限仍由既有控制端服务处理。

## 规则与 Daemon

- 固定协议、枚举、数学常量和不可配置安全约束可集中定义；用户配置、真实身份、密钥、模型选择、目录、Shell、UI 偏好不得被硬编码覆盖。测试夹具只能出现在隔离测试环境。
- 当前实现是开发入口；短期兼容代码须标记废弃、替代位置、保留原因和删除条件，到期删除。永久测试保留，临时脚本、假数据、调试打印、测试路由及无用中间目录在任务结束后清理。
- 节点公开入口是 lfaa-host-daemon/daemon；同包根入口提供控制端节点登记。两入口分进程装配，节点执行程序不引入控制端数据库。版本读取包清单；卸载终止心跳/领取请求及等待，阻止关闭后的领取结果执行，释放节点锁并沿用 Minecraft 受管实例停止流程。
- 当前其他在途任务仍沿用原完成/故障回报协议；未宣称所有运行任务都可取消，也未宣称完成真实游戏启动验收。
- test-support 源码保留；默认产品包构建及发布运行树排除它。源码实现包仍为62个，默认产品包输出61个，控制端/节点运行清单39个。

## 实际验证

| 验证 | 实际结果 |
|---|---|
| pnpm install --offline --ignore-scripts | 68 个 workspace 同步完成；保留既有弃用子依赖与 peer 提示 |
| pnpm run build:server | 通过，输出 H:/LFAA/dist/server；确认不包含 client/test-support 和旧 minecraft-daemon.mjs |
| pnpm run build:harness | 61 个产品包构建通过，输出 H:/LFAA/dist/packages |
| pnpm run build:daemon | Rust release 与节点语法检查通过，原生输出 H:/LFAA/dist/daemon/target |
| Node 语法与 PowerShell Parser | 节点、包解析器、构建、两桌面组装脚本和 start-dev.ps1 通过 |
| 源码入口（NODE_ENV=test） | HTTP 200；无密钥心跳401；持真实生成密钥的隔离等待请求在卸载时取消；7ms卸载，锁释放，无后续轮询 |
| 编译入口（NODE_ENV=test） | 同项通过；6ms卸载 |
| 编译生产入口（NODE_ENV=production） | 使用本次生成且不打印的隔离 JWT；同项通过；4ms卸载。缺少有效生产 JWT 时的导入被原校验拒绝，未绕过校验 |
| 静态合同审计 | 316 个上游目录、62个实现包、16份CSS、114路由、71项默认值、数据库实现均对照通过；包依赖无环 |
| 长期测试 | 5份源码全部保留；本轮未重跑完整套件。首轮已有17项中12通过、5项夹具失败，仍保留原测试 |
| 开发模式 HMR 补充检查 | 启动等待未结束，已停止本轮检查进程，未标为通过；不据测试/生产结果宣称开发 HMR 已验收 |
| 本轮桌面交付 | 仅组装脚本语法检查；未重新打包或运行桌面 GUI |
| git diff --check 与产品源码标记扫描 | 通过；指定临时接口/假数据标记、skipAuth 与 debugger 未出现在产品源码 |

临时验证服务只在独立隔离进程内等待携带正确节点密钥的健康请求；未向产品登记测试接口。临时检查脚本和数据原计划验证后删除，但删除审核拒绝，仍位于根 dist/.tmp，并在下面列明。

## 清理实际状态

自动审核先拒绝批量删除，再拒绝更精确的单个失败运行数据临时 ZIP 删除，均只返回 blocked by policy，没有具体原因。未执行删除，也未改用其他工具绕过。全部 56 个目标仍存在，登记文件 20831 个，约 841.99 MiB（清理前盘点值）。因此本轮不能称为完成残留清理。

确认 server/data/ai-runtime-smoke 只有空 credentials/database 目录。5个系统临时目录通过只读 SQLite 检查，用户全部匹配 realtime-test-* 夹具。正式 ZIP 备份、实际活动数据、用户目录数据、长期维护工具和全部316个上游目录占位未删除。旧源码/缓存只留在未被装配的临时目录，清理仍欠完成。

| 绝对目标路径 | 文件数 | MiB | 实际结果 |
|---|---:|---:|---|
| H:/LFAA/dist/.tmp/backup-project | 3027 | 44.84 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/cordis-inspection | 4 | 0.09 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/daemon-compiled-check-data | 3 | 0.45 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/daemon-source-check-data | 4 | 0.45 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/desktop-electron | 6913 | 133.58 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/desktop-style-audit | 1 | 2.71 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/desktop-tauri | 6515 | 131.07 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/harness-legacy-directories | 57 | 13.39 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/harness-lifecycle-data | 3 | 0.45 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/harness-migration-original | 574 | 11.00 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/harness-smoke-data | 4 | 0.59 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/lfaa-runtime-data-db-snapshot-20260930 | 1 | 0.52 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/packaged-smoke-data | 3 | 0.45 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/portable-smoke-data | 3 | 0.45 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/server | 0 | 0.00 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/source-smoke-data | 2 | 0.45 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/audit-harness.mjs | 1 | 0.00 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/baseline-database-tests.log | 1 | 0.01 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/browser-settings.mjs | 1 | 0.00 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/cleanup-inventory.json | 1 | 0.01 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/configure-harness.py | 1 | 0.01 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/connect-api.py | 1 | 0.00 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/connect-harness.py | 1 | 0.01 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/daemon-lifecycle-check.mjs | 1 | 0.00 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/finish-harness.py | 1 | 0.00 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/harness-contract-audit.json | 1 | 0.00 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/harness-electron-package.log | 1 | 0.00 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/harness-final-tests.log | 1 | 0.01 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/harness-invalid-patch.yml | 1 | 0.00 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/harness-lifecycle-smoke.mjs | 1 | 0.00 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/harness-migration-map.json | 1 | 0.08 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/harness-source-backup.log | 1 | 0.01 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/migrate-desktop-daemon.py | 1 | 0.01 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/migrate-harness.py | 1 | 0.01 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/packaged-smoke.mjs | 1 | 0.00 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/portable-smoke.mjs | 1 | 0.00 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/refresh-harness.py | 1 | 0.00 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/repair-imports.py | 1 | 0.00 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/restore-ui.py | 1 | 0.00 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/source-smoke.mjs | 1 | 0.00 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/split-harness.mjs | 1 | 0.01 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/split-ui.mjs | 1 | 0.00 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/sync-harness-paths.py | 1 | 0.00 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/update-harness-docs.py | 1 | 0.01 | 审核拒绝，仍存在 |
| H:/LFAA/dist/.tmp/write-harness-report.py | 1 | 0.02 | 审核拒绝，仍存在 |
| H:/LFAA/server/data/ai-runtime-smoke | 0 | 0.00 | 审核拒绝，仍存在 |
| H:/LFAA/dist/packages/test-support | 2 | 0.00 | 审核拒绝，仍存在 |
| H:/LFAA/dist/apps/desktop-electron/win-unpacked | 3663 | 483.29 | 审核拒绝，仍存在 |
| H:/LFAA/dist/apps/desktop-electron/builder-debug.yml | 1 | 0.00 | 审核拒绝，仍存在 |
| H:/LFAA/dist/backups/.LFAA 0.1.1.5aad33fc627d49b39316f10e72e841ae.partial | 1 | 14.10 | 审核拒绝，仍存在 |
| H:/LFAA/dist/backups/.LFAA runtime data 20260930-001413.zip.partial | 1 | 0.00 | 审核拒绝，仍存在 |
| C:/Users/Administrator/AppData/Local/Temp/lfaa-realtime-socket-2osAdB | 4 | 0.85 | 审核拒绝，仍存在 |
| C:/Users/Administrator/AppData/Local/Temp/lfaa-realtime-socket-4Nuc99 | 4 | 0.66 | 审核拒绝，仍存在 |
| C:/Users/Administrator/AppData/Local/Temp/lfaa-realtime-socket-cJmmVc | 4 | 0.85 | 审核拒绝，仍存在 |
| C:/Users/Administrator/AppData/Local/Temp/lfaa-realtime-socket-RxXa1n | 4 | 0.85 | 审核拒绝，仍存在 |
| C:/Users/Administrator/AppData/Local/Temp/lfaa-realtime-socket-upYh23 | 4 | 0.66 | 审核拒绝，仍存在 |

正式备份保留清单见 [机器记录](harness-cleanup-files.json)。清理受阻同时包括本轮 daemon-lifecycle-check.mjs、cleanup-inventory.json 以及隔离生成数据，不能遗漏它们。

## 本轮逐文件变更

以下为源码、配置、锁文件与文档的全部28个变更文件。节点改名前路径 H:/LFAA/packages/host/daemon/src/minecraft-daemon.mjs 已迁到表中的新路径。

| 绝对文件路径 | 职责 | 本轮改动 |
|---|---|---|
| [H:/LFAA/AGENTS.md](<H:/LFAA/AGENTS.md>) | 仓库执行规则 | 加入模型驱动、硬编码、新旧实现和临时排查清理硬规则。 |
| [H:/LFAA/开发规范.md](<H:/LFAA/开发规范.md>) | 开发规则 | 定义固定值/配置边界、新实现优先、废弃删除、长期测试保留及模型自主决策。 |
| [H:/LFAA/docs/系统总体架构.md](<H:/LFAA/docs/系统总体架构.md>) | 当前架构 | 固定模型—Agent—工具—App/节点执行链，更新包与进程边界、节点公开入口和实际限制。 |
| [H:/LFAA/docs/开发计划.md](<H:/LFAA/docs/开发计划.md>) | 开发进度 | 登记本轮整理与自主多 Agent 协作的待实施内容。 |
| [H:/LFAA/docs/PROMPTS.md](<H:/LFAA/docs/PROMPTS.md>) | 任务合同 | 登记 LFAA-HARNESS-CLEANUP-01 的范围、设置、清理和验证条件。 |
| [H:/LFAA/docs/harness-migration.md](<H:/LFAA/docs/harness-migration.md>) | 历史迁移记录 | 标为历史记录，后续入口与清理状态指向本轮记录。 |
| [H:/LFAA/docs/harness-migration-files.json](<H:/LFAA/docs/harness-migration-files.json>) | 历史迁移清单 | 标记 historical-migration 和后续记录位置，原哈希仍表示历史版本。 |
| [H:/LFAA/docs/harness-packages.md](<H:/LFAA/docs/harness-packages.md>) | 包目录清单 | 说明 test-support 为测试资源，不进入默认产品构建与发布树。 |
| [H:/LFAA/docs/harness-cleanup.md](<H:/LFAA/docs/harness-cleanup.md>) | 本轮交付记录 | 完整登记逐文件变更、设置、实际验证、限制与审核阻止的清理。 |
| [H:/LFAA/docs/harness-cleanup-files.json](<H:/LFAA/docs/harness-cleanup-files.json>) | 机器清单 | 记录全部 56 个清理目标、数量、正式备份、逐文件变更和实际状态。 |
| [H:/LFAA/scripts/build-harness.mjs](<H:/LFAA/scripts/build-harness.mjs>) | 包与运行树构建 | 默认能力包构建排除 test-support；控制端运行树排除 client 和 test-support。 |
| [H:/LFAA/tsconfig.host.json](<H:/LFAA/tsconfig.host.json>) | 控制端类型构建 | 编译入口排除测试支持源码，长期测试的映射保留。 |
| [H:/LFAA/apps/cli/package-loader.mjs](<H:/LFAA/apps/cli/package-loader.mjs>) | Node 包解析 | 遵循 package.json 的精确公开导出，生产入口将 TS/TSX 映射到编译后的 JS。 |
| [H:/LFAA/apps/daemon/package.json](<H:/LFAA/apps/daemon/package.json>) | 节点启动工具 | 语法检查命令指向通用 daemon.mjs。 |
| [H:/LFAA/packages/host/daemon/package.json](<H:/LFAA/packages/host/daemon/package.json>) | 节点包清单 | 公开 ./daemon 执行入口并声明 home-paths 依赖。 |
| [H:/LFAA/packages/host/daemon/src/daemon.mjs](<H:/LFAA/packages/host/daemon/src/daemon.mjs>) | 节点执行插件 | 由 minecraft-daemon.mjs 改名；跨包导入、版本读取包清单，卸载取消轮询及等待，关闭后不再派发领取的任务。 |
| [H:/LFAA/packages/bundle/daemon-app/cordis.patch.yml](<H:/LFAA/packages/bundle/daemon-app/cordis.patch.yml>) | 节点装配 | 装配 lfaa-host-daemon/daemon 公开执行入口。 |
| [H:/LFAA/pnpm-lock.yaml](<H:/LFAA/pnpm-lock.yaml>) | 工作区锁文件 | 离线同步节点包新增的 home-paths 工作区依赖。 |
| [H:/LFAA/scripts/start-dev.ps1](<H:/LFAA/scripts/start-dev.ps1>) | 开发启动器 | 节点文件检查及进程识别匹配通用 daemon 名称。 |
| [H:/LFAA/apps/desktop-electron/scripts/prepare-runtime.mjs](<H:/LFAA/apps/desktop-electron/scripts/prepare-runtime.mjs>) | Electron 运行组装 | 必需运行文件检查和关联注释更新为通用节点入口。 |
| [H:/LFAA/apps/desktop-tauri/scripts/package-windows.mjs](<H:/LFAA/apps/desktop-tauri/scripts/package-windows.mjs>) | Tauri 发布组装 | 必需运行文件检查和关联注释更新为通用节点入口。 |
| [H:/LFAA/apps/desktop-electron/src/main.mjs](<H:/LFAA/apps/desktop-electron/src/main.mjs>) | 桌面进程管理 | 仅同步节点关联路径注释。 |
| [H:/LFAA/packages/util/home-paths/src/resolve-data-directory.mjs](<H:/LFAA/packages/util/home-paths/src/resolve-data-directory.mjs>) | 数据目录解析 | 仅同步节点关联路径注释。 |
| [H:/LFAA/packages/host/daemon/src/local-daemon.ts](<H:/LFAA/packages/host/daemon/src/local-daemon.ts>) | 控制端节点登记 | 仅同步节点关联路径注释。 |
| [H:/LFAA/packages/jobs/jobs/src/ai-host-tasks.ts](<H:/LFAA/packages/jobs/jobs/src/ai-host-tasks.ts>) | AI 主机任务队列 | 仅同步节点关联路径注释。 |
| [H:/LFAA/packages/fs/fs/src/queue.ts](<H:/LFAA/packages/fs/fs/src/queue.ts>) | 文件任务队列 | 仅同步节点关联路径注释。 |
| [H:/LFAA/packages/games/steamcmd/src/service.ts](<H:/LFAA/packages/games/steamcmd/src/service.ts>) | SteamCMD 业务服务 | 仅同步节点关联路径注释。 |
| [H:/LFAA/apps/cli/tests/data-directory.test.mjs](<H:/LFAA/apps/cli/tests/data-directory.test.mjs>) | 长期数据目录测试 | 仅同步节点关联路径注释，测试断言与夹具保留。 |

生成输出按根 dist/server、dist/packages/<领域>/<包>、dist/daemon/target 管理；未改变前端界面或新增CSS变量。临时产物逐项列在清理表，状态均为审核拒绝。
