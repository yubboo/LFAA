# 全仓审计与维护

> 状态时效：本文主体实测记录截至 2026-10-01，是当时的审计快照。其 `H:/LFAA/data/database/lfaa.sqlite` 与 `user_version=35` 仅表示当时检查的那份数据库；不是固定数据目录，也不代表当前数据库版本。当前数据目录须从实际运行配置解析，当前支持的 SQLite schema 以代码迁移链为准（截至本次规则审查为 38）。本文记录的构建、运行、残留和验收状态也须按各自时间重新核实。用户已说明 `H:/LFAA` 改名为 `H:/LFAA1`，两者是同一项目；[历史清理清单](workspace-audit-cleanup.json) 中的绝对路径仍是改名前的物理路径，应映射到当前 checkout 并逐项重新核实。旧的清理授权与“未删除”状态仍只是历史记录，不能代替本轮授权或路径检查，也不得直接执行。

## LFAA-WORKSPACE-AUDIT-02 当前合同

用户要求检查整个项目，包括 apps、packages、native、scripts、data、server、dist 与 lfaa.bat；复现并修复菜单 5 备份失败、终端任务领取刷屏、各模块性能问题；确认新旧架构入口和实现是否冲突，清理确认废弃的源码与临时残留。

允许修改上述链路的真实缺陷及相关长期回归、事实文档与规范。禁止删除真实运行数据、正式备份、长期测试、上游明确要求的占位；保留既有未提交工作，不执行 Git 推送或发布，不绕过认证或删除视觉效果。清理每个目标前核对绝对路径、内容、引用与运行占用；不存在的目标不记为已删除。

正式入口为权威 SERVER_PORT 配置下的 Web（默认 3000），Daemon 由现有 Host 管理；开发 Vite 为独立模式。逐项审核 Web、Daemon、CLI 和两种桌面封装的源码/运行树依赖、输出路径和数据解析；不建立第二套 Owner。

设置盘点：UI 沿用 appearance 的主题、颜色、背景、字体/字号、遮罩、模糊、半透明、对比度与减少动态效果；终端沿用 general 的集成 Shell、面板位置/布局、字体和已保存栏宽。日志级别来自启动配置 LOG_LEVEL；备份名称版本从当前权威发布清单读取，输出仅 dist/backups，临时输出仅 dist/.tmp。此次不重置任何偏好。

验收：真实菜单 5 调用链生成可读取 ZIP，检查标准条目、必要源码、敏感数据排除和异常清理；验证日志成功领取/心跳为 debug，故障仍可见；核对全仓架构导入、活动输出与清理对象；对滚动与频繁更新检查布局/同步工作/生命周期，运行相关构建和回归。登录交互与桌面帧测量须独立报告，不能以构建代替。

## 审计与结果

### 范围、入口和架构事实

覆盖根目录清单与 apps、packages、scripts、native、data、server、dist；扫描 314 份代码/配置，核对 70 份实际工作区包清单及 3 份 CLI profile 清单。当前有 65 个实现包（含 test-support），默认构建 64 个产品包；五个实际 app 为 cli、web、daemon、desktop-electron、desktop-tauri。源文件级依赖扫描未发现缺失 workspace 依赖、生产依赖环或指向旧 server/frontend/daemon 运行树的导入。

| 目录/链路 | 实际核查结果 |
|---|---|
| apps / packages | Web、CLI、Daemon 和两桌面入口均装配当前包；桌面 profile 与 Web 监督器按职责管理节点，没有发现同时启动第二套业务 Owner 的装配。316 个上游占位、apps/desktop 与 desktop-host 占位继续保留 |
| scripts / lfaa.bat | 批处理禁用延迟展开，从自身目录进入；Node 桥接当前终端 PowerShell；菜单 2 启动编译包，菜单 3 当前全量构建，菜单 5 调用当前备份脚本。没有执行菜单 6/7 推送 |
| data | 真实配置/凭据/游戏/会话数据保持。只读检查 H:/LFAA/data/database/lfaa.sqlite：quick_check=ok、user_version=35；不读出秘密，不降级或迁移其他数据根 |
| server | 仅 server/data/ai-runtime-smoke 的空 credentials/database 目录，无旧服务端源码。删除尝试被审核拒绝，仍存在 |
| dist | 当前输出为 dist/apps/*、dist/packages/*、dist/npm/lfaa；新 Daemon 原生构建位于 dist/apps/daemon/target。历史 dist/server、frontend、daemon 及 .tmp 迁移/验证副本仍存在，未进入当前入口 |
| 文档 | 新增 CLI README，标明历史交付文档是时间快照，纠正当前架构把空测试目录描述为历史运行数据的问题。当前规则入口是开发规范.md 与 docs/系统总体架构.md；旧名称 DEVELOPMENT.md / ARCHITECTURE.md 不存在 |

### 已确认缺陷与修复

1. 菜单只检查入口文件存在，源码修复后仍启动旧编译输出。新增同一指纹工具，正式菜单只重建过期职责，成功构建后记录；构建期间源码变化拒绝完成标记，构建失败不继续启动。
2. 原源码 ZIP 收录 Git 历史（基线 5040 文件、54.02 MiB），复制/压缩阶段没有清晰进度；缺少并发互斥和完整异常撤销。现在排除 Git 目录/工作树指针、实际配置的数据根及秘密，检查输出祖先链接，锁定单次备份，显示三阶段进度，失败清理本轮暂存与 partial，保留正式 ZIP。
3. 成功 POST /api/daemon/ai/host-tasks/claim 漏出成功轮询 debug 白名单，每 5 秒在 info 刷屏。补入原日志分级规则；401/其他客户端失败仍 warn、500 仍 error，写入和任务故障不静默。
4. 任务列表 SELECT * 读取并解析完整输出后再丢弃。改为 SQL 摘要投影，不加载 command/result 正文；明细、取消、用户隔离仍沿用原 Owner。
5. 终端两秒一次将同值快照重装到 React 状态并重新拼接输出。共享纯比较器保留相同对象，选项与正文 memo；真实输出、状态与取消仍更新，旧取消响应不覆盖新选中任务。
6. 聊天每次滚动遍历全部锚点外框。按帧合并、内容变化才测量，普通滚动缓存坐标二分定位；异步图片 load/尺寸变化更新缓存，停止完整撤销。点击历史锚点关闭自动跟随，防止流式输出拉回底部。同值滚动存储不重复排计时器/写入。

没有修改 CSS、删除动效或重置偏好。设置映射实际读出 blur=21px、遮罩=45%、界面字号=14px，保留当前主题/强调色、背景、字体、对比度、半透明与减少动态效果；终端继续读取集成 Shell、默认终端位置、面板入口、代码字体与栏宽。LOG_LEVEL、SERVER_PORT、LFAA_DATA_DIR 属于现有部署 Owner，未变成第二套设置。

### 验证与限制

- `pnpm run build` 通过：64 产品包、Web TypeScript/Vite、控制端和 npm 组装；`pnpm run build:daemon` 通过 Rust release 与节点语法检查。`node scripts/runtime-build-state.mjs web` 返回 `[]`（当前职责输出一致）。未发布 npm/Git。
- `node --import tsx --import ./register-package-loader.mjs --test tests/*.test.mjs`（cwd apps/cli）：84 项，83 通过、0 失败、1 项真实 Minecraft 部署跳过。包含真实隔离 CLI 启动/认证/停止/重启、节点命令/取消、文件/Socket 权限、配置/存储和新备份回归。
- 性能工作量：500 锚点、1000 次普通滚动 → 1 次帧回调、0 次新增逐锚点外框读取；1000 次同值终端快照识别为不更新；MiB 任务输出不在列表读取解析，明细仍可读。全部是工作量回归，不冒充设备帧率。
- 从重新打开的 `cmd /d /c lfaa.bat` 输入 5，真实链路生成 `H:/LFAA/dist/backups/LFAA 0.1.1 (5).zip`：705 个文件、17.64 MiB 未压缩源码、14789683 字节 ZIP；条目数量/大小及逐项解压读取通过，本轮暂存已清理。Windows 隔离长期回归另覆盖 `.git` 文件、显式数据根、秘密排除及越界输出拒绝。
- 原版本在本次环境中通过重新打开菜单也能生成 ZIP，**未复现用户之前的原始失败**；上述修复针对确认的备份安全/进度/并发/异常缺陷，不宣称已证明此前失败的唯一原因。
- 用户登录后实际走查应用中心、设置常规/外观切换、滚动到底、许可证弹窗、终端开关、SteamCMD/Minecraft/写作的常规/AI Work、文件管理和通用任务入口。刷新恢复现有会话；读取 browser error/warn 为空。截图：H:/LFAA/dist/.tmp/workspace-audit-proof/settings-dialog.jpg。
- 验证 Web 使用 `--no-local-daemon`，未自动派发真实节点命令或调用付费模型；Minecraft 与文件管理准确显示离线边界。SteamCMD 常规业务仍为原有未接入说明，未伪装为可用。
- 走查后已停止本轮验证 Web 并关闭临时浏览器页，避免占用 3000；重新打开 lfaa.bat 的菜单 2 默认 Web 将使用当前构建，并按原有规则托管本机 Daemon。
- PowerShell Parser 检查 backup-project.ps1、install-dependencies.ps1、start-dev.ps1：0 错误；`git diff --check` 通过。workspace-preflight、独立 quality/release Gate 未定义，因此未运行。现有并行改动保留，没有提交/覆盖。
- **未完成：** 逐帧/长任务采样、真实长会话/大正文输入压力、桌面打包与 WebView、在线节点文件操作及真实游戏部署。已走查交互不等于所有功能或所有设备场景完全无卡顿。

### 物理清理受阻

当前用户已授权清理。对校验仓库内绝对路径、引用和进程占用后删除的操作，自动审批返回 `blocked by policy`，没有提供具体原因；本轮没有换工具绕过。59 个目标、20328 文件、约 560.81 MiB **仍存在，未删除**。逐项绝对路径见 [workspace-audit-cleanup.json](workspace-audit-cleanup.json)。保留正式源码 ZIP、data、尚未核实正式恢复备份的数据库快照、长期测试和上游占位。不能称为已经把老架构物理残留清干净。

### 本轮源码/文档变更文件与职责

所有路径前缀均为 `H:/LFAA/`；既有其他任务改动不归入本轮清单。

| 文件 | 职责/变更 |
|---|---|
| AGENTS.md / 开发规范.md | 硬性规范：性能/安全/维护、正式输出对账、日志与备份边界 |
| docs/PROMPTS.md / docs/workspace-audit.md | 当前合同登记、审计证据及验收边界 |
| docs/workspace-audit-cleanup.json | 审批受阻的逐项物理残留清单 |
| docs/系统总体架构.md / docs/harness-cleanup.md / docs/harness-delivery.md / docs/performance.md | 当前架构事实、历史文档标记及后续性能证据 |
| apps/cli/README.md | 当前启动、菜单、数据和备份职责说明 |
| apps/cli/tests/workspace-maintenance.test.mjs | 构建指纹/变更拒绝和真实 Windows 纯净 ZIP 回归 |
| apps/cli/tests/http-delivery.test.mjs | 成功轮询分级与失败可诊断回归 |
| apps/cli/tests/execution-control.test.mjs | 大输出摘要投影/明细/账户隔离回归 |
| apps/cli/tests/client-performance.test.mjs | 滚动合并、图片尺寸更新、停止与终端快照回归 |
| apps/web/vite.config.ts | Web 成功构建指纹，构建期间变更拒绝 |
| scripts/runtime-build-state.mjs / scripts/runtime-build-state.d.mts | 唯一职责指纹/过期检测实现及类型声明 |
| scripts/build-harness.mjs | 控制端构建完成对账 |
| scripts/install-dependencies.ps1 | 菜单启动过期构建处理和备份错误定位 |
| scripts/backup-project.ps1 | 备份排除、路径边界、互斥、进度与异常撤销 |
| packages/host/webserver/src/http-delivery.ts | 补齐任务领取成功 debug 分级 |
| packages/jobs/jobs/src/ai-host-tasks.ts | 列表 SQL 摘要投影，保留完整明细 |
| packages/client/ui-workspace/src/TaskTerminal.tsx / terminal-snapshot.ts | 同值快照复用与输出 memo、取消竞态保护 |
| packages/client/ui-chat/src/AiWorkChat.tsx / conversation-scroll.ts | 共享滚动跟踪、缓存坐标、定位/跟随与完整撤销 |
| packages/client/store/src/scroll-restoration.ts | 同位置不重复落盘或调度 |
| apps/desktop-tauri/src-tauri/src/main.rs | 修正关联注释为当前包架构；运行行为不变 |

`lfaa.bat` 和 `project-menu.mjs` 经真实调用核查，无需改写；修复发生在其调用的权威 PowerShell 菜单和备份 Owner。新产物全部写入根 dist，生成输出不是另一套源码。

### server 残留专项复核

2026-10-01 用户指出根 server 仍存在。重新只读核查：H:/LFAA/server 及其 data、ai-runtime-smoke、credentials、database 共五个目录，没有文件或目录链接。随后缩小为固定路径、逐级空目录校验的非递归删除，自动审批仍返回 blocked by policy，未提供原因，命令未执行。因此 server 仍未删除，不能把物理清理计为完成。本次只补记审计事实，没有修改源码或设置；构建和测试未运行。
