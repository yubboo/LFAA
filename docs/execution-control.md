# LFAA-EXECUTION-CONTROL-01 当前合同

用户已授权逐项实现本轮讨论的对话式自动执行与面板控制问题。模型规划、选工具并根据结果继续决策；手动操作不依赖模型。两入口复用现有领域服务、账户授权、任务队列和节点执行器，不创建第二套 Agent/服务器。

## 配置盘点与实施顺序

- 现有 Provider/模型配置、permissions.mode（默认 ask）、general.taskFolder（默认空）、integratedShell（默认 system）、agentEnvironment（默认 system）、plugins.enabled（默认 false）、mcpServers（默认空）、aiRuntime 请求/工具预算继续生效，不读取密钥或重置用户偏好。
- 新增命令运行时限与开服就绪/停服时限，必须贯通账户设置的类型、默认值、校验、保存、前端控件，再由业务服务生成不可由模型扩大的时限策略。
- 界面复用 appearance、通知、字体、主题与减少动态效果；本轮功能接入不重设计界面。
- 先实现持久游戏进程控制：手动/AI 共用启停、重启、控制台命令，实例互斥，真实就绪与断线未知状态。
- 再完善节点命令任务的增量输出、取消、超时、租约、环境绑定和证据返回；停止等待不冒充撤销副作用。
- 用户后续明确：直接操控本机，服务器作为远程节点；不要求先准备虚拟机。以 MCSManager、minecraft-host-agent、GameServerManager 的仓库为参考，保留本机原生执行与持久游戏实例，不安装/启用虚拟机或系统组件。OS 隔离不是本轮必需前置，不把普通进程或文件路径校验宣称为 OS 沙盒。
- 浏览器和桌面操作必须有真实驱动、账户/会话归属、观察—操作—验证和截图输入支持，未接通部分保持不可用。
- 三种权限按现行合同：full_access 允许已授权目标机器上的任意 Shell/路径且不逐项审批；另外两种模式按精确范围审批。远程节点独立凭据绑定身份，本机自动执行服务不能替离线远程节点执行。

## 允许与禁止边界

允许修改 packages/core/{agent-loop,tools}、packages/host/daemon、packages/jobs/jobs、packages/games/minecraft、packages/api/{remotes,job-controller,minecraft-controller,session-controller}、packages/settings/settings、相关 client 设置/控制台/连接包、现有启动器与 boot 生命周期、对应 sandbox/browser-use/computer-use/terminal 包、持久化迁移和长期测试、直接依赖清单/锁文件及事实文档。

禁止覆盖已有 scripts/install-dependencies.ps1 和用户提示词目录修改；禁止创建假成功、降低权限/Gate、把模型密钥传给执行器、静默更换节点/模型、重放结果未知的写操作、发布或部署外部服务。构建仅写根 dist，各入口只清理自己的目录。

## 验收

运行目标长期回归、Host/Client 类型检查、相关构建及差异检查；确认配置保存和消费、跨账户拒绝、并发操作冲突、就绪失败、取消/租约未知与不重放。真实 Provider、Daemon、Minecraft、浏览器/桌面、OS 隔离验证分别记录，构建通过不代表实机通过。每个变更文件的绝对路径与职责及剩余环境阻塞列入最终交付记录。

## 实施记录

本轮按用户明确的本机原生控制与远程服务器节点方案实施，没有安装或启用虚拟机。通用 Shell/项目文件工具保持现有原生执行合同；浏览器截图、桌面键鼠/UI Automation、交互式 PTY 尚未接入，不能宣称整台电脑的所有图形界面软件已可自动操作。

### 参考仓库

核查用户给出的维护者仓库及相关进程控制源文件：[MCSManager](https://github.com/MCSManager/MCSManager)（Apache-2.0，控制端/节点分离、原生进程与停止等待）、[minecraft-host-agent](https://github.com/AndrewNog0724/minecraft-host-agent)（MIT，模型工具循环和真实启动日志判断）、[GameServerManager](https://github.com/GSManagerXZ/GameServerManager)（GPL-3.0，实例互斥与终端管理）。本轮复用架构方法，在 LFAA 当前领域 Owner 内独立实现，没有复制第三仓库的 GPL 代码或另建业务服务器。

### 本轮设置

| 配置 | 默认值/约束 | 消费位置 |
| --- | --- | --- |
| aiRuntime.commandTimeoutSeconds | 0，0–1800 秒；0 不自动超时 | 工具按账户上限约束模型参数，节点保存任务时限 |
| minecraftRuntime.minecraftReadyTimeoutSeconds | 120，10–900 秒 | 手动/模型启动、重启任务保存设置快照，等待当次服务就绪 |
| minecraftRuntime.minecraftStopTimeoutSeconds | 30，5–300 秒 | 停服/重启任务与节点关闭使用等待时限 |
| general.taskFolder / integratedShell | 沿用现有空目录/system 默认 | 项目工具和主机命令准备参数 |
| permissions.mode | 沿用 ask / approve_remembered / full_access | 包括新增重启、控制台和取消工具，调用时走原有审批合同 |
| plugins.enabled / mcpServers、Provider/模型及 Agent 预算 | 沿用当前账户配置 | 同一 Agent Loop 继续选择工具，不另建模型入口 |
| appearance 共享映射 | 沿用现有主题、字号、字体、颜色与减少动态效果 | 新增界面使用工作台内的 Ant Design 组件，无新增视觉令牌 |

部署开关 `--no-local-daemon` 和 `LFAA_TRUST_LOOPBACK_PROXY` 属于启动拓扑/TLS 代理配置，不是模型可扩大权限的账户偏好。没有读取或改变真实账户保存的配置。

### 结果与限制

已经通过隔离真实 Windows 节点的 PowerShell 执行、运行中输出读取、取消和节点退出确认；并补充空 stdout/stderr 接收、能力握手白名单、实例互斥、过期租约不复活/不重放、身份绑定及设置快照消费回归。编译后的 CLI 自动本地节点已通过真实心跳检查和正常关闭/重启回归。

尚未执行真实 Minecraft 游戏启动/重启/世界备份、跨机器 HTTPS、真实模型账号自主开服、登录态新增控件与外观交互验收。测试 Provider 是隔离合成协议夹具，不是实际模型验收。最后一次前端类型检查仅剩并行写作页面 `WritingWorkspace.tsx` 的 16 项未使用声明/可空引用错误；Web 构建未运行，不能用旧 Web 构建宣称本轮界面已验收。

远程凭据生成接口已经通过真实管理员 HTTP 认证回归：响应只含公开身份，不含 token/摘要。连接文件经编译后的 CLI 一次导出，不在终端打印密钥；导出后移除控制端待交付副本，撤销身份的文件不可导出。

| 检查 | 实际结果 |
| --- | --- |
| apps/cli 内 11 个目标长期回归文件（含 harness-cli） | 33 个测试通过；Windows 节点、PowerShell 中文输出、取消、CLI 自动托管和迁移使用实际进程/数据库 |
| pnpm exec tsc --noEmit --pretty false -p tsconfig.host.json | 通过；后续 control-plane 构建也执行同一 Host 类型检查 |
| pnpm run build:control-plane | 通过，输出 H:/LFAA/dist/apps/control-plane |
| pnpm --filter lfaa-host-daemon run build | 通过，输出 H:/LFAA/dist/packages/host/daemon |
| pnpm exec tsc --noEmit --pretty false -p tsconfig.client.json | 未通过；WritingWorkspace.tsx 的并行改动错误，未改写该文件 |
| pnpm install --lockfile-only --ignore-scripts | 完成；无新增外部依赖下载，workspace 依赖锁定同步 |
| git diff --check | 通过 |
| workspace-preflight、quality/release Gate | 未运行；当前根 package.json 未登记这些历史脚本，没有伪造或绕过 Gate |
| 浏览器/桌面、Minecraft、真实 Provider、跨机器 HTTPS | 未运行；图形驱动与 PTY 尚未实现 |

构建与本轮临时组装保持根 dist 边界。长期测试保留，合成账户、节点、密钥、临时数据库与进程均在各自隔离测试生命周期清理，没有启动/停止用户的真实游戏实例或更改真实账户设置。并行改动和既有安装脚本未重置、提交或覆盖；没有发布/部署。

### 本轮变更文件

下列为本轮写入的文件。共享文件中仍保留其他任务的多核心/提示词改动，不将它们归为本轮实现；未改动用户的安装脚本、提示词目录和写作工作台。

| 绝对路径 | 本轮职责/改动 |
| --- | --- |
| H:/LFAA/.env.example | 明确声明回环 TLS 代理部署开关 |
| H:/LFAA/apps/cli/bin/lfaa.mjs | 自动托管本地节点、通过 OS CLI 导出/导入远程连接文件、部署模式切换 |
| H:/LFAA/apps/cli/tests/agent-runtime.test.mjs | 当前数据库版本断言与共享迁移同步 |
| H:/LFAA/apps/cli/tests/harness-cli.test.mjs | 编译入口自动节点真实心跳回归 |
| H:/LFAA/apps/cli/tests/harness-agent-api.test.mjs | 管理员签发真实身份，确认 HTTP 响应不含密钥 |
| H:/LFAA/apps/cli/tests/minecraft-task-leases.test.mjs | 仍有效租约续期与过期租约不能复活 |
| H:/LFAA/apps/cli/tests/daemon-connection.test.mjs | 连接校验/保存、运行中拒绝改身份和真实 IPC 关闭 |
| H:/LFAA/apps/cli/tests/execution-control.test.mjs | 账户/节点归属、时限消费、互斥和版本 33 数据保留迁移 |
| H:/LFAA/apps/cli/tests/native-daemon-control.test.mjs | 隔离真实节点执行、中文增量输出、认证读取及取消确认 |
| H:/LFAA/apps/cli/tests/process-control.test.mjs | 真实进程树终止、超时、UTF-8 限额和就绪双证据 |
| H:/LFAA/docs/PROMPTS.md | 当前任务登记及验收状态 |
| H:/LFAA/docs/execution-control.md | 当前合同、配置、参考来源和逐文件交付记录 |
| H:/LFAA/docs/系统总体架构.md | 当前执行与状态回报事实 |
| H:/LFAA/packages/api/job-controller/src/index.ts | 心跳取消指令与真实增量输出接收 |
| H:/LFAA/packages/api/minecraft-controller/src/index.ts | 共享重启/控制台接口、管理员远程凭据管理 |
| H:/LFAA/packages/api/remotes/src/route-contracts.ts | 节点身份/TLS、能力白名单、空输出与新设置校验 |
| H:/LFAA/packages/api/session-controller/src/index.ts | 当前账户的取消请求接口 |
| H:/LFAA/packages/boot/app-boot/src/index.ts | IPC 触发现有 Cordis 关闭生命周期 |
| H:/LFAA/packages/client/connection/src/api.ts | 统一新增设置、重启、控制台、取消与凭据 API 合同 |
| H:/LFAA/packages/client/ui-minecraft/src/MinecraftWorkspace.tsx | 共用重启和服务器指令入口、节点连接入口、任务名称 |
| H:/LFAA/packages/client/ui-minecraft/src/DaemonConnections.tsx | 生成/轮换私有连接文件与撤销身份，浏览器不接收密钥，弹层沿用主题容器 |
| H:/LFAA/packages/client/ui-settings-general/src/default-settings.ts | 三项时限前端默认值 |
| H:/LFAA/packages/client/ui-settings/src/SettingsPage.tsx | 三项时限设置控件 |
| H:/LFAA/packages/client/ui-workspace/src/TaskTerminal.tsx | 真实增量输出展示与等待节点取消确认 |
| H:/LFAA/packages/core/agent-loop/src/execute-turn.ts | 返回失败/未完成任务时不显示操作成功 |
| H:/LFAA/packages/core/agent-loop/src/runtime.ts | 要求模型继续取证，区分送达、就绪、连通和完成 |
| H:/LFAA/packages/core/tools/src/business-tools.ts | 模型重启、控制台、取消工具，配置时限约束与真实任务回传 |
| H:/LFAA/packages/core/tools/src/project-tools.ts | Agent 停止时请求取消已派发文件任务 |
| H:/LFAA/packages/games/minecraft/package.json | 声明领域服务对权威设置包的直接依赖 |
| H:/LFAA/packages/games/minecraft/src/service.ts | 手动/模型共用动作、时限快照、互斥和过渡状态保护 |
| H:/LFAA/packages/host/daemon/README.md | 执行器原生权限、连接与托管合同 |
| H:/LFAA/packages/host/daemon/package.json | 声明节点凭据模块对权威运行环境配置包的直接依赖 |
| H:/LFAA/packages/host/daemon/src/daemon.mjs | 节点真实取消/日志回报，服务就绪与安全停服等待 |
| H:/LFAA/packages/host/daemon/src/node-credentials.ts | 独立身份签发、摘要认证、私有文件一次导出、轮换与撤销 |
| H:/LFAA/packages/host/daemon/src/process-control.mjs | 进程输出、退出、超时、终止树及就绪等待 |
| H:/LFAA/packages/host/daemon/src/connection-config.mjs | HTTPS 连接文件安全解析和原子保存 |
| H:/LFAA/packages/host/daemon/src/supervisor.mjs | 本地进程托管、异常退出有界重启与正常关闭 |
| H:/LFAA/packages/host/webserver/src/server.ts | 显式配置时信任本机 TLS 代理 |
| H:/LFAA/packages/jobs/jobs/README.md | 持久任务、取消、租约和状态合同 |
| H:/LFAA/packages/jobs/jobs/src/ai-host-tasks.ts | 取消事实、增量序列、过期拒绝、按退出结果判定成功 |
| H:/LFAA/packages/jobs/jobs/src/minecraft-queue.ts | 重启/控制台任务、实例排他、过期租约与未知状态 |
| H:/LFAA/packages/settings/settings/src/service.ts | 三项权威时限类型、默认值及旧账户保留归一化 |
| H:/LFAA/packages/storage/storage-domain/src/migration.ts | 既有迁移链调用执行控制版本 34 迁移 |
| H:/LFAA/packages/storage/storage-sqlite/src/database.ts | 版本 34 数据保留迁移，取消/输出字段与凭据摘要表 |
| H:/LFAA/pnpm-lock.yaml | 同步 Minecraft 设置依赖和节点配置依赖，保留其他任务依赖 |
