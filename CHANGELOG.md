## LFAA v0.0.80 — #22.2 Plugin Profile 生命周期与项目骨架收敛

- **状态：** pending-user-acceptance
- 审阅 DeepSeek Harness 源码并将 LFAA 骨架从“提前占位”收敛为“真实 Owner + 真实 Consumer”：Node workspace 9 个项目，Cargo workspace 1 个真实 Secret crate。
- 新增 package layer/role、依赖方向、无环、空壳 package/crate 机器门禁。
- 新增独立 Plugin Profile 与统一 PluginManager：registry/path/git/tarball inspect、pnpm 事务安装、取消/回滚、精确 build-script 审批、安装后默认 disabled、显式 enable 后发布 Registry generation。
- Settings 新增“插件与能力”；Web/未来 CLI/Agent 只调用同一 PluginManager，不维护第二套安装器。
- 新增 `@lfaa/credentials` 通用 seam；插件 Manifest 只声明 credential requirement，Secret 不得写入插件配置/日志/argv/env。
- executable plugin 本版不进主进程热加载；Manifest/Capability generation 可热切换，未来执行代码必须先经过隔离 Host/Sandbox。
- 修复发布流程认知：v0.0.79 中文代码地图 ZIP entry 被错误编码；v0.0.80 增加 Unicode/隐藏路径 Gate，并以最终 ZIP round-trip + 解压根 preflight 作为成品验收。
- **AI 验证：** 仓库 Node 101/101 + Config System 33/33 = 134/134 PASS；Credentials / Plugin SDK / Plugin Runtime / Agent Runtime / Config / Plugin Host 定向 TypeScript noEmit PASS；源码与 Unicode-safe ZIP round-trip 解压根 `workspace-preflight` 全 PASS。正式 Node24+pnpm Web build、Cargo/Windows Credential Manager 与真实 Windows 插件安装仍需实机，不冒充通过。

## LFAA v0.0.79 — #4.4 发布包隐藏资源完整性与同步前来源预检

- **状态：** pending-user-acceptance
- 修复 v0.0.78 交付 ZIP 漏掉隐藏 `.lfaa/` 项目资源骨架的问题；不是用户工作区自身损坏。
- Sync 新增来源包完整性预检：在 `Get-SyncPlan`、删除计划和任何文件写入之前运行统一 `workspace-preflight.mjs`。
- 来源包不完整时终端直接说明“稳定工作区尚未被修改”，禁止继续同步，避免坏包删除稳定工作区的治理必需文件。
- `.lfaa/cache|state|tmp|logs` 仍是本机运行状态保护项；`.lfaa/README.md`、manifest/lock 和资源 README 仍是项目级可升级骨架。
- 同时修正 Sync 的 `.lfaa` 保护正则：v0.0.78 使用了错误的双反斜杠，导致 `.lfaa/state/dependency-state.json` 也被误列为删除；v0.0.79 使用 literal-dot 匹配，确保本机 cache/state/tmp/logs 真正保留。
- 发布验证新增“成品 ZIP 解压 → 检查 8 个 `.lfaa` 必需文件 → 对解压根运行 workspace preflight”的实际交付检查。
- **AI 验证：** 仓库 Node 90/90 + Config System 33/33 = 123/123 PASS；源码根与成品 ZIP round-trip 根的 workspace preflight 全 Gate PASS。

## LFAA v0.0.78 — #22.1 Plugin Platform + #21.18 Workbench UI + #20.17 依赖幂等

- **状态：** pending-user-acceptance
- Plugin SDK 成为 Plugin Manifest / Capability / App Pack / External Adapter 唯一公共协议，Agent Runtime 复用同一 Capability 类型；Plugin Runtime 新增 generation-based Registry。
- 架构升级为 TypeScript Product & Agent Plane + Frozen Rust Native Kernel + Optional Python Runtime，并加入机器化 language ownership gate。
- App Pack 明确为能力组合，不拥有第二套 Agent Runtime；外部生态采用 Common Contract + namespaced extensions，保留 Codex / DeepSeek Harness 等平台高级能力。
- Workbench 按 Codex 参考收敛：左上角 LFAA 切换聊天/工作；三档权限改为带说明 Popover；添加与模型按钮均可点击；Chat 视觉重心居中，Work 保留真实 Infinite Canvas。
- Windows Setup 不再因 dependency-state 缓存缺失/指纹变化本身强制安装；首次基线不再误报全部依赖“新增”。Sync 在依赖声明未变化时保留稳定工作区更完整的 `pnpm-lock.yaml`，避免每次同步后重复执行无意义的 `pnpm install`。
- **AI 验证：** 仓库 Node 88/88 + Config System 33/33 = 121/121 PASS；Plugin/Agent Runtime 定向 TypeScript、Workbench TSX 语法、全部治理 Gate 与统一 Workspace Preflight PASS。正式 Node24/pnpm Web build 与 Windows PowerShell 动态执行仍保留为正式环境/用户实机验收。
- **边界：** 不新增外部 npm 依赖；Rust Native primitive 未因本版本普通产品功能扩张；真实 Codex/DSH Run Adapter 仍属于后续执行闭环。

# LFAA 更新日志

## LFAA v0.0.77 — #22.0 Agent Runtime 双入口基础 + #4.3 Windows 工作区预检修复

- **状态：** pending-user-acceptance
- **基线：** v0.0.76（保留 #2.16 ChatGPT / Codex App Server 登录成果）
- **任务：** #22.0、#4.3
- 架构升级为 `architecture-version: 2`：Chat 与 Work 不再被视为两套智能，统一通过 `AgentRunRequest` 进入同一个 Agent Runtime；Config System 继续只拥有账号/认证/模型选择。
- `packages/agent-runtime` 新增模型绑定、Capability、Run Host、三档 Permission Profile 与官方 Harness Registry；OpenAI Codex 只声明 `codex app-server` Bridge，DeepSeek Harness 只声明 ACP/SDK Bridge，不复制两者 Agent Loop。
- 三档权限固定为“请求审批 / 替我审批 / 完全权限”。请求审批为 LFAA `prompt-every-capability` 前置 Gate；替我审批使用受限工作区 + Model/Official Reviewer；完全权限映射 unrestricted，但普通 Run 永远不能修改 Trust Core / Permission Policy / Secret / Audit 边界。
- Work Surface 新增真实 Infinite Canvas：支持 pan、zoom、reset、节点拖拽和连线；Goal / Agent / Tool / Subagent / Artifact 仅为 Runtime Projection，不成为业务真值。
- Workbench 移除硬编码模型名，读取 Config System 当前 `selectedModelId`；Runtime Host 缺失时明确显示“Runtime 未连接”并禁用发送，不使用假回复冒充模型执行。
- Windows Sync / GitHub Push 改为共用 `scripts/workspace-preflight.mjs`；Gate 失败会直接显示具体 Gate 和原始错误摘要，并继续写日志。
- 运行时日志目录加入 `.gitkeep`，保证 Git / ZIP / Sync 后目录事实稳定存在；修复空目录在包传输后消失导致治理事实不一致的问题。
- **AI 验证：** 仓库 Node 78/78 + Config System 33/33 = 111/111 PASS；Agent Runtime / Config System TypeScript `--noEmit` PASS；统一 Workspace Preflight 全 Gate PASS。
- **边界：** v0.0.77 建立 Runtime/权限/画布/官方 Harness Adapter 的长期脊柱；尚未把所有 Provider 的真实推理执行桥全部接完，因此不会把“Runtime 未连接”伪装为完成。

## LFAA v0.0.76 — #2.16 OpenAI ChatGPT 套餐 / Codex App Server 登录闭环

- **状态：** pending-user-acceptance
- **基线：** v0.0.75（#2.15 已由用户确认通过）
- **任务：** #2.16
- Config Core 新增通用 `AiManagedAuthPort` / Host Capability 契约；ChatGPT 套餐不再伪装成 API Key 流程，Provider 只声明 `codex-app-server` 能力。
- Web Host 新增 Codex App Server Adapter：固定启动 `codex app-server`，通过 stdio JSONL 完成 `initialize → initialized`、`account/login/start`、`account/read`、`model/list` 与登录完成通知；Windows 对 `codex.cmd` 使用 shell 解析。
- ChatGPT OAuth / Token 生命周期继续由 Codex App Server 管理；LFAA 不读取 Codex auth 文件、不保存 access/refresh token，Subscription 账户使用 `credentialRef = null`。
- 浏览器 Client 在用户点击时同步预开登录弹窗，只接受 OpenAI / ChatGPT HTTPS 官方域名；异常/关窗/超时会取消未完成 loginId，成功后不会反向取消已完成登录。
- `model/list` 返回的模型与 `supportedReasoningEfforts/defaultReasoningEffort/inputModalities` 成为 Subscription 账户运行时模型能力事实；未知能力不猜测。
- 删除 LFAA ChatGPT 项目账户只解除本地关联，不调用全局 `account/logout`；现有 API Key / Token Plan Rust Secret Broker 保存、重测、删除链路保持不变。
- **AI 验证：** 仓库 Node 70/70 + Config System 33/33 = 103/103 PASS；Config System TypeScript noEmit PASS；全部治理门禁 PASS；Web Host 改动 TS 语法检查 PASS。完整 pnpm Web typecheck/build 因制作环境缺少项目 `node_modules`、Node 为 22.16.0（项目要求 24.x）而不冒充通过。

## LFAA v0.0.75 — #2.15 侧栏最小宽度超拖吸附修正

- **状态：** delivered
- **用户验收：** passed；用户在 v0.0.75 后确认继续下一步。
- **基线：** v0.0.74
- **任务：** #2.15
- 正常 resize 恢复 1:1 跟手，`minWidth..maxWidth` 任意位置均可停留；
- 到 `minWidth` 后视觉宽度锁定，不再继续随 Pointer 变窄；
- Pointer 继续向内只累计隐藏超拖，默认超拖半个 `minWidth` 后才进入 snap capture；
- 阈值前松手保持 `minWidth`，不自动收起、不自动展开；
- 左栏 / 右栏 / Bottom Dock / Settings 继续共用同一 `ResizableWorkbench` 与集中交互变量；
- 不修改 Rust Secret、Provider、Account/Auth、个人中心、主题与 Windows 工具链。

## LFAA v0.0.74 — #2.14 侧栏吸附触发阈值变量化

- **状态：** superseded
- **用户验收：** not-accepted；capture 前继续视觉缩窄导致正常 resize 回归，由 v0.0.75 修正
- **基线：** v0.0.73
- **任务：** #2.14
- `minWidth` 与 snap capture 正式解耦：达到最小可用宽度不会立刻吸附，默认继续拖到 `minWidth × 0.50` 才进入收起预览，降低误触。
- `min → capture threshold` 区间允许临时继续跟手缩窄；未越过阈值就松手时回到 `minWidth`，不会提交 collapsed。
- 左栏、右栏、Bottom Dock、Settings 继续复用同一个 `ResizableWorkbench` capture / hysteresis / release 算法。
- 新增 `workbench-interaction.config.ts`，集中管理 `captureRatio`、release hysteresis、capture/release/settle 动画时长、键盘 Resize 步长，并提供中文注释；组件仍允许按 Surface 覆盖参数。
- CSS 吸附/释放时长改由统一 CSS 变量注入，不再在 snap 规则中散落 150ms/180ms 魔法数字。
- **AI 验证：** 仓库 Node 回归 64/64 + Config System 30/30 = 94/94 PASS；补充 TypeScript PASS；governance / import / runtime import / folder / docs / comment / Windows BOM / release consistency / prompt lifecycle / config schema / release gates / UI contract 全部 PASS。

## LFAA v0.0.73 — #2.13 Rust Secret Broker 与官方模型能力配置

- **状态：** superseded
- **用户验收：** not-accepted；业务成果由 v0.0.74 继续承载，尚待 Windows Rust Secret / Provider 实机验收
- **基线：** v0.0.72
- **任务：** #2.13
- 删除 PowerShell/C# Credential helper；`crates/secret-store` 实现 `lfaa-secret-broker`，Windows 直接通过 Rust FFI 调用 `CredWriteW / CredReadW / CredDeleteW`，写入后必须回读比对。
- Web Host 通过 stdin/stdout 二进制协议调用 Rust Broker；Secret 不进入 argv、环境变量、日志、普通文件或账户 JSON。
- Provider 模型目录升级为官方来源：OpenAI / DeepSeek / Kimi / 千问 / Xiaomi 使用官方模型列表 API；智谱在未确认统一账户模型列表 API 时使用带官方来源的 Catalog Adapter，不伪造 endpoint。
- 新增模型 Capability 契约与 Core 校验：UI 只展示官方确认的思考模式/思考强度/输出限制等参数；未知或不支持参数不能保存。
- 移除任意手工模型 ID 作为主流程；保存模型必须存在于本次官方模型目录结果或官方 Catalog。
- **AI 验证：** Config System 30/30、AI Web Host / Rust Secret 9/9、Config System TypeScript `--noEmit` PASS；制作容器无 Cargo/pnpm/Windows，不声称 Rust 编译、Credential Manager 实机或真实厂商 Key 已动态通过。

## LFAA v0.0.72 — #2.12 Windows Credential Manager 保存链路修复

- **状态：** superseded
- **用户验收：** not-accepted；Windows 实机 PowerShell Add-Type/C# FILETIME 冲突，已由 v0.0.73 Rust Secret Broker 取代
- **基线：** v0.0.71
- **任务：** #2.12
- v0.0.71 左栏宽度同步已由用户实机确认通过并 delivered；随后真实 DeepSeek 保存测试暴露 Windows Credential Manager Secret Adapter 失败。
- Windows Secret Adapter 改为稳定 `windows-credential-manager.ps1` helper，通过 `-File` 启动，Secret 仍只经 stdin 传递。
- Generic Credential 写入后立即 `CredReadW` 回读校验；回读失败或内容不一致会删除刚写入凭证并拒绝账户元数据落盘。
- Windows 失败返回操作阶段与 Win32 错误码，不再只显示泛化“操作失败”；不回显 Secret。
- **边界：** 不改 Provider / 模型发现 / Settings / Workbench / Windows Setup-Sync-GitHub-Update。

## LFAA v0.0.71 — #2.11 工作台 / 设置左栏宽度单一事实源

- **状态：** delivered
- **用户验收：** passed；用户实机确认“好的，都优化好了”
- **基线：** v0.0.70
- **任务：** #2.11
- `AgentWorkbench.leftPaneWidth` 升级为主工作台、Settings 与 Profile 共用的唯一左栏宽度事实源。
- `ResizableWorkbench` 新增受控 `leftWidth`；非受控模式继续兼容原有使用方式。
- 工作台拉伸后的宽度进入 Settings 立即继承；Settings 内再次拉伸后返回工作台保持相同宽度。
- 新增 `lfaa.shell.left-pane-width.v1` 共享持久化，并从旧 `lfaa.workbench.layout.v5.leftWidth` 一次性迁移历史宽度。
- **边界：** 不修改 snap/hysteresis/release 算法，不修改 Account/Auth/Secret/Provider，不修改 Windows 工具链。


## LFAA v0.0.70 — #2.10 UI Workspace 运行时导入解析修复

- **状态：** superseded
- **用户验收：** not-accepted；运行时导入修复保留，但 Settings / Workbench leftWidth 未共享，由 v0.0.71 修正
- **基线：** v0.0.69
- **任务：** #2.10
- 修复 Settings 使用 `@/workbench/*` tsconfig-only alias 导致 Vite Web 宿主运行时无法解析的问题。
- `packages/ui` 新增 `@lfaa/ui/workbench` 公共 Subpath Export；Settings 通过稳定 package Export 复用 ResizableWorkbench 与布局计算器。
- 新增 runtime import resolution 治理：packages 禁止 `@/` 私有 alias，workspace `@lfaa/*/<subpath>` 必须在目标 package exports 中公开且目标存在。
- 新增真实 importer resolver 回归，直接从 `SettingsPage.tsx` 所在 package scope 解析 `@lfaa/ui/workbench`。
- **边界：** 不改变 Settings resize/snap/release 行为，不修改 AI Account/Auth/Secret/Provider，不修改 Windows Setup/Sync/GitHub/Update。

## LFAA v0.0.69 — #2.9 设置中心共享可伸缩侧栏

- **状态：** superseded
- **用户验收：** not-accepted；Windows 实机 Vite 无法解析 `@/workbench/*`，由 v0.0.70 修复。
- **任务：** #2.9
- Settings 左栏直接复用 `ResizableWorkbench`，删除固定 `17rem / 12rem` 侧栏宽度；
- 设置中心与工作台共享响应式尺寸、拖拽、吸附、Pointer 未松手反向释放、短过渡和布局持久化；
- `ResizableWorkbench` 支持单侧 Surface：没有右栏时不渲染右栏和右 separator；
- Settings 收起后提供显式“展开设置导航”入口；
- 不修改 AI Account/Auth/Secret/Provider、Profile/Theme、Web Host 与 Windows 工具链。

## LFAA v0.0.68 — #2.8 Vite Native Config 兼容修复

- **状态：** superseded
- **基线：** v0.0.67
- **任务：** #2.8
- Vite config 导入 AI dev bridge 改为显式 `.ts` 扩展名；Bridge 内三个本地实现依赖同样显式 `.ts`。
- Web `noEmit` TypeScript 配置启用 `allowImportingTsExtensions`。
- 新增静态防回归，禁止未来再次在 Vite config 依赖链省略本地 TypeScript 扩展名。
- 不使用 `VITE_CONFIG_NATIVE_IGNORE_WARNING` 掩盖兼容问题；Account/Auth/Provider/Secret/UI/Windows 工具链业务不变。

## LFAA v0.0.67 — #2.7 Web API-Key Account 真实闭环

- **状态：** superseded
- **用户验收：** not-accepted；Windows 实机启动出现 Vite native config extensionless import warning，由 v0.0.68 修正
- **基线：** v0.0.66
- **任务：** #2.7
- **前序验收：** v0.0.66 已由用户实机确认“丝滑”并 delivered。
- 新增 Provider 无关 `AiAccountService`、Account Repository / Secret Store / HTTP Host Ports，Config System 拥有 Account/Auth/Model 业务。
- Web 开发宿主新增 localhost AI Bridge；Windows Secret 进入 Credential Manager Generic Credential，`.lfaa/state/ai-accounts.json` 仅保存元数据与 `credentialRef`。
- 设置页支持 Secret 瞬时输入、真实连接测试、模型发现、手工模型 ID、保存账户、刷新恢复、重测、切换模型与删除账户。
- OpenAI / DeepSeek / Kimi / 千问 / MiMo 使用各自 Provider 插件真实模型发现；智谱不伪造未确认模型列表端点，保存真实 Key + 手工模型并明确 `unverified`。
- OpenAI ChatGPT 套餐入口保留但明确待 Codex App Server，不把订阅认证伪装成 API Key。
- Provider 远端错误体不直接返回 UI；账户元数据落盘失败会回滚新写 Secret。
- **AI 验证：** Config System 26/26、AI Web Host/Secret 6/6、Settings/Workbench/Dependency/Release 回归 PASS；补充 TypeScript 与目录/导入/治理/Schema/UI/BOM 门禁 PASS。当前制作容器不满足 Windows Node24+pnpm11.17.0+Cargo 完整发布环境，不声称 `release:full` / Windows Credential Manager 实机 PASS。

## LFAA v0.0.66 — #2.6 工作台吸附反向展开动效修复

- **状态：** delivered
- **用户验收：** passed；用户实机确认“ok，丝滑了”。
- **任务：** #2.6
- **范围：** `packages/ui/src/workbench` + Workbench 动效测试；不改 Provider / Config / Web Host / Windows 工具链。
- **修复：** snap capture 反向拉出不再从 0 瞬跳到 min，新增约 150ms release 过渡；随后普通 resize 恢复 1:1 跟手。
- **一致性：** 左栏、右栏、Bottom Dock 共用 release 规则，并支持 reduced-motion 降级。
- **前序验收：** v0.0.65 已由用户 Windows 实机确认通过并标记 delivered。
- **AI 验证：** Workbench Snap 4/4、Settings/Profile/Theme 6/6、Config System 17/17，治理链全部 PASS；制作容器未执行正式 Web build。


## LFAA v0.0.65 — #2.5 个人中心侧栏内联聚焦修复

- **状态：** delivered
- **基线：** v0.0.64
- **任务：** #2.5
- **用户验收：** passed；用户实机明确反馈“OK，非常好”。
- v0.0.64 的独立 Settings Surface 与三态主题保留；个人中心几何按用户实机反馈继续修正。
- 个人菜单不再使用固定宽度；由 `ResizableWorkbench` 当前 leftWidth 通过 `--agent-left-live-width` 实时决定。
- 菜单与底部用户条复用同一个 `ProfileBar` 并组成单一聚焦容器，宽度与左栏 content box 一致。
- 聚焦容器保持清晰，其余工作台统一 blur/dim；左栏 resize 后再次打开自动使用最新宽度。
- Settings/Profile/Theme 6/6、Config System 17/17 与目录/导入/UI/Schema/治理门禁通过。


## LFAA v0.0.64 — #2.4 设置中心与个人中心交互重构

- **状态：** superseded
- **用户验收：** not-accepted；设置中心/三态主题保留，个人中心几何由 v0.0.65 修正
- **基线：** v0.0.63
- **任务：** #2.4
- v0.0.63 的 Provider/目录架构保留，但其设置 UI 验收未通过，本版本不覆盖旧包，独立递增修正。
- 设置从工作台 center pane 中移出，改为共享 `SettingsPage` 独立 Surface：左侧设置分类与搜索，右侧内容区，支持返回应用。
- AI Provider 配置改为 `AiSettingsPanel`，作为 Settings 的“AI 服务”分类复用；Provider Registry/六家插件业务未改。
- 左下角个人中心改为聚焦式弹层；打开时工作台背景轻度模糊 + 压暗，菜单本身保持清晰。
- 左下角增加更新入口并位于主题入口左侧；主题升级为 `跟随系统 / 浅色 / 深色` 三态并监听系统主题变化。
- `Ctrl+,` 可打开设置；Esc 优先关闭个人/主题菜单。
- 新增 Settings/Profile/Theme 静态契约 5/5，并纳入根测试；Config System 17/17 与目录边界回归通过。

## LFAA v0.0.63 — #2.3 配置系统目录边界与 AI Provider 插件体系

- **状态：** superseded
- **用户验收：** not-accepted；Provider/目录架构保留，设置与个人中心 UI 由 v0.0.64 修正
- **基线：** v0.0.62
- **任务：** #2.3
- 配置业务固定归 `packages/config-system/src/settings/ai`，共享图形 UI 固定归 `packages/ui/src/features/settings/ai`，App 仅作为宿主；目录职责写入开发规范并由 `folder-boundary-check` 自动执行。
- 新增无厂商分支的 `AiProviderPlugin / AiProviderRegistry`；首批内置 OpenAI、DeepSeek、智谱 GLM、Kimi、千问/百炼、Xiaomi MiMo 六个 Provider 配置插件。
- OpenAI 配置插件同时声明 API Key 与官方 Codex App Server ChatGPT 套餐认证；其他 Provider 保留各自区域、Workspace、Coding API、Token Plan 等真实差异。
- OpenAI-compatible 共享 transport 只负责请求/模型列表协议形状，厂商 Base URL / Auth 不进入 Core。
- 新增共享 `AiSettingsPage`，由 App Shell 将 Provider Registry 投影为纯 UI ViewModel；UI 不直接依赖 Config System、不发 Provider 网络请求、不持有 Secret。
- Config System 17/17 单测、Config System TypeScript、UI/App Shell 补充类型检查与全部可执行治理门禁通过；当前制作容器无法联网取得 pnpm 11.17.0，因此未伪造正式 Web build / `release:full`。

## LFAA v0.0.62 — #20.16 pnpm 控制台直连原生输出修复

- **状态：** delivered
- **用户验收：** passed；Windows 实机确认 pnpm 原生控制台输出恢复
- **基线：** v0.0.61
- **任务：** #20.16
- 菜单 1 的交互式 pnpm install 在 Windows 改为 `cmd.exe` + `pnpm.cmd` 同控制台启动；PowerShell 不再作为 native-command 输出管道。
- 使用 `Start-Process -NoNewWindow -Wait -PassThru`，不重定向 stdout/stderr，只读取退出码。
- 安装前仅保留一条简短 `【安装】【Node】` 命令提示，中间过程完全由 pnpm 原生输出。
- frozen/no-frozen、正式发布 frozen、Store 动态事实与真实依赖健康检查保持不变。

## LFAA v0.0.61 — #20.15 pnpm CMD 原生终端输出与菜单精简

- **状态：** superseded
- **用户验收：** not-accepted；Windows 实机确认直接 pnpm.cmd 仍没有 CMD 原生动态进度，由 v0.0.62 修正
- **基线：** v0.0.60
- **任务：** #20.15
- Windows 菜单 1 的交互式 pnpm 写操作优先调用版本匹配的 `pnpm.cmd`，与用户在 CMD 直接运行 `pnpm install` 使用同类执行链；不存在时才回退现有 runner。
- pnpm 安装 stdout/stderr 继续直连当前终端，不捕获、不重定向、不模拟进度。
- 菜单 1 删除大段中文实现说明、前五个依赖明细、重复执行说明；默认只显示关键环境、四类依赖路径、简短状态、必要确认与最终结果。
- 菜单 7 保留 PNPM_HOME、全局配置、Store 来源、lockfile、状态缓存等完整诊断信息。
- frozen/no-frozen 分流、正式发布 frozen、Store 动态事实与真实依赖健康检查保持不变。

## LFAA v0.0.60 — #20.14 pnpm 原生安装输出恢复

- **状态：** superseded
- **用户验收：** not-accepted；Windows 实机仍无 CMD 同类 pnpm 原生进度且提示过多，由 v0.0.61 修正
- **基线：** v0.0.59
- **任务：** #20.14
- 撤销菜单 1 交互式 `pnpm install` 强制 `--reporter=append-only`，恢复 pnpm 原生终端 reporter。
- 保留 #20.13 的开发期 `--no-frozen-lockfile` / 精确修复 `--frozen-lockfile` 分流。
- `Invoke-Pnpm` 继续以前台直接进程运行，安装 stdout/stderr 不捕获、不重定向、不由 LFAA 模拟进度。
- LFAA 只在安装前显示模式与命令，安装过程中的 Scope / Progress / reused / downloaded / added 等由 pnpm 自身输出。
- 正式发布 frozen、Store 实时路径/来源、真实依赖健康检测均保持不变。

## LFAA v0.0.59 — #20.13 开发期依赖同步与实时输出修复

- **状态：** superseded
- **用户验收：** not-accepted；append-only reporter 在 Windows 实机仍无原生安装信息，由 v0.0.60 修正
- **基线：** v0.0.58
- **任务：** #20.13
- 修复菜单 1 在明确检测到 lockfile 落后后仍调用 `pnpm install --frozen-lockfile` 的逻辑矛盾。
- lockfile 落后时改用 `pnpm install --no-frozen-lockfile --reporter=append-only`，允许开发期同步当前声明并更新 `pnpm-lock.yaml`。
- lockfile 已完整但本地依赖损坏时继续使用 `--frozen-lockfile` 精确修复，避免无故改锁文件。
- pnpm 写操作显示实际命令并使用 append-only reporter，避免确认后只有一行执行提示造成假卡死。
- 正式发布 `release:full` 继续 frozen，不因本地开发同步放宽。

## LFAA v0.0.58 — #20.12 PowerShell 自动变量冲突修复

- **状态：** superseded
- **基线：** v0.0.57
- **任务：** #20.12
- 修复 `Test-PnpmHomeInPath` 把 `$home` 当普通局部变量导致与 PowerShell 只读自动变量 `$HOME` 冲突的问题。
- 新增 PowerShell 自动/只读变量赋值防回归，避免 `$HOME`、`$PID`、`$Host`、`$Error`、`$PSHOME`、`$PWD`、`$LASTEXITCODE` 等被普通代码覆盖。
- 完整保留 #20.11 的 pnpm 实时 Store / PNPM_HOME / 配置来源，以及 #20.10 的真实依赖健康检测。
- **未修改：** Web Account/Auth、Config Schema/Storage、Web UI、PTY、Sync/GitHub/Update 业务逻辑。
- **AI 验证：** dependency-setup 15/15、node-dependency-health 3/3、release-gates 5/5、release-environment 8/8、Config Schema 8/8、Config System TypeScript `--noEmit` 与治理链全部 PASS。当前制作容器无 PowerShell、Node 22.16.0、无 Cargo，因此 Windows 菜单动态执行与完整 `release:full` 不冒充通过。

> 单文件版本时间线。每个版本在顶部追加一节；不再创建 `docs/changelog/vX.Y.Z.md`。

## LFAA v0.0.57 — #20.11 pnpm 实时环境事实与 Store 来源修复

- **状态：** superseded
- **基线：** v0.0.56
- **任务：** #20.11
- 用户实机确认旧全局 `storeDir` 被删除后，`pnpm store path` 会立即从旧项目目录切换到当前 Windows 用户默认 Store；机器路径不能由历史缓存决定。
- `Get-PnpmStorePath` 改为每次从 `$ProjectRoot` 调用当前 pnpm runner，实时取得 active Store；禁止从 `.lfaa/state` 回放旧路径。
- 新增 pnpm 环境事实：pnpm executable、PNPM_HOME/PATH 状态、全局 config 路径、全局/项目 `storeDir`、active Store 与 Store 来源。
- Store 来源区分环境变量 / 项目配置 / 用户全局配置 / pnpm 默认；来源识别失败不覆盖 active Store 事实。
- LFAA 自身 `pnpm-workspace.yaml` 禁止声明 `storeDir`，默认尊重用户/机器 pnpm 配置；不会自动迁移或修改用户全局 Store。
- 保留 v0.0.56 的真实 Node resolve、node-pty 加载、Store 缺失/为空和 lockfile 离线 fetch 健康检查。
- **未修改：** Web Account/Auth、Config Schema/Storage、Web UI、PTY、Sync/GitHub/Update、Agent/Tool/Policy/Permission 业务语义。
- **AI 验证：** dependency-setup 14/14、node-dependency-health 3/3、release-gates 5/5、release-environment 8/8、Config Schema 8/8；治理门禁全部 PASS。当前容器无 PowerShell、Node 22.16.0、无 Cargo，因此 Windows 动态 UI 与完整 `release:full` 不冒充通过。

## LFAA v0.0.56 — #20.10 真实依赖健康检测与 Store 状态修复

- **状态：** superseded
- **基线：** v0.0.55
- **用户验收：** not-accepted；环境路径实时性与 Store 来源由 v0.0.57 继续修正
- **任务：** #20.10
- 用户 Windows 实机删除 `pnpm store path` 指向的 Store 后，v0.0.55 仍误报“当前依赖均已就绪”；定位确认旧逻辑只检查依赖指纹、`.modules.yaml` 与直接依赖 `package.json`。
- 新增跨平台 `node-dependency-health-check.mjs`：从每个 workspace importer 真实解析外部依赖；仅残留 package.json、真实入口缺失时会失败；`node-pty` 额外验证原生模块可加载并提供 `pty.spawn`。
- 菜单 1 新增 pnpm Store 真实健康层：路径不存在/为空直接报告；非空时使用临时目录执行 `pnpm fetch --offline --frozen-lockfile --ignore-scripts`，验证当前 lockfile 所需内容是否确实可从当前 Store 取得。
- “项目依赖可用”与“pnpm Store 健康”分开显示；Store 丢失但 node_modules 仍可真实解析时，不再误报全部就绪。
- Store 修复需用户确认，仅执行当前 lockfile 的 `pnpm fetch --frozen-lockfile --ignore-scripts` 补齐缺失缓存，不执行 `pnpm update`、不清空 node_modules/Store。
- 项目依赖同步改为 `pnpm install --frozen-lockfile`，安装后必须再次通过 manifest、真实解析、lockfile 和 Store 检测。
- **未修改：** Web Account/Auth、Config Schema/Storage、Web UI、Sync/GitHub/Update、Agent/Tool/Policy/Permission 业务语义。
- **AI 验证：** node-dependency-health 3/3、dependency-setup 11/11、release-gates 5/5、release-environment 8/8、Config Schema 8/8；Config System TypeScript `--noEmit` PASS；governance/import/dev-log/docs/comment/Windows BOM/release consistency/prompt lifecycle/config-schema/release-gates/UI contract 全部 PASS。当前容器 Node 22.16.0、无 Cargo、无 PowerShell，因此 Windows Store 删除/恢复动态行为与 `release:full` 不冒充通过。

## LFAA v0.0.55 — #20.9 依赖提示去重与路径可见性

- **状态：** delivered
- **基线：** v0.0.54
- **任务：** #20.9
- 用户实机确认 #20.8 的 unchanged 依赖路径已经能跳过安装，但指出菜单 1 的 Node/pnpm/workspace 与最终完成信息存在重复，并缺少依赖真实位置。
- 删除菜单 1 的重复“预检 → 检测”环境输出；Node/pnpm/workspace 只打印一次。
- unchanged 结尾从 Node/pnpm、Rust/Cargo 两条重复完成提示收敛为单一 `【完成】【按需依赖】` 摘要。
- 新增统一依赖路径展示：项目 node_modules、pnpm 虚拟仓库、真实 pnpm Store、Node lockfile、本机状态缓存、Cargo registry/git 缓存、Rust toolchains 与 Cargo.lock。
- `pnpm Store` 通过本机 `pnpm store path` 动态读取，不写死用户目录；菜单 7 环境检查复用同一路径展示。
- #20.8 的依赖指纹、零安装、差异提示、Yes/No、禁止自动 update/prune 语义保持不变。
- **未修改：** Config Schema/Storage、Web UI、PTY、Sync/GitHub/Update、Agent/Tool/Policy/Permission 业务语义。
- **AI 验证：** dependency-setup 8/8、release-gates 5/5、release-environment 8/8、Config Schema 8/8；全部 Node 治理门禁 PASS；Config System TypeScript `--noEmit` PASS；PowerShell 动态交互待 Windows 实机验收。
- **用户验收：** passed；菜单提示去重与依赖路径展示经 Windows 实机确认通过。随后发现的真实依赖健康误判由 #20.10 / v0.0.56 修复。

## LFAA v0.0.54 — #20.8 按需依赖增量检测与复用

- **状态：** superseded
- **基线：** v0.0.53
- **任务：** #20.8
- 用户实机发现 v0.0.53 菜单 1 虽已是“按需入口”，但每次执行仍会无条件调用依赖安装；本版本新增真正的依赖状态检测，不覆盖旧包。
- Node 依赖指纹只由 `packageManager`、workspace 依赖声明、`pnpm-lock.yaml`、`pnpm-workspace.yaml` 构成，不包含 LFAA 产品版本；纯版本递增不会触发重装。
- 新增 `.lfaa/state/dependency-state.json` 本机缓存，记录最近一次成功同步指纹；该目录保持 Git ignore，缓存可删除，不能反向覆盖依赖真相。
- 菜单 1 在 unchanged + 本地依赖完整时直接跳过 `pnpm install`；首次/变化/缺失时才展示新增、删除、版本变化、lockfile 或本地缺失摘要，并询问用户是否同步。
- 不自动更新依赖版本、不清空 node_modules / pnpm store；同步时复用 pnpm 现有内容寻址缓存。
- Rust 增加 toolchain + rustfmt + clippy 就绪检测；已完整时跳过 rustup 安装；无外部 crate 时跳过 Cargo fetch，Cargo.lock 未变化且已同步时也跳过 fetch。
- 新增 `test/dependency-setup.test.mjs` 并把增量依赖契约并入 release-gates 防回归。
- **AI 验证：** 增量依赖 6/6、release-gates 5/5、release-environment 8/8、Config Schema 8/8；governance/import/dev-log/docs/comment/Windows BOM/release consistency/prompt lifecycle/config-schema/UI contract 全部 PASS；Config System TypeScript `--noEmit` PASS。当前容器 Node 22.16.0 且无 Cargo，正式环境/Rust 门禁按设计阻断，不声称 `release:full` PASS。
- **未修改：** Config Schema/Storage、Web UI、PTY、Sync/GitHub/Update、Agent/Tool/Policy/Permission 业务语义。
- **用户验收：** not-accepted；增量跳过已实机体现，但输出重复与路径不可见由 #20.9 / v0.0.55 修正。

## LFAA v0.0.53 — #20.7 Setup 菜单与发布门禁解耦

- **状态：** superseded
- **基线：** v0.0.52
- **任务：** #20.7
- **用户验收：** not-accepted；菜单 1 仍无条件执行依赖安装，由 #20.8 / v0.0.54 修正。
- 用户未接受 v0.0.52 把菜单 1 / 10 绑定得过重的设计，因此本版本不覆盖旧包，改为新的递增修正。
- `LFAA-Setup.bat → 1` 改为“按需依赖”：首次配置、依赖变化或环境损坏时使用；环境已就绪时可跳过。
- `LFAA-Setup.bat → 10` 改为“检查中心”，提供快速检查 / 完整检查 / 正式发布三档，不再进入菜单 10 就直接执行 frozen install + Rust。
- 新增 `quality:quick`（governance + typecheck + test）与 `quality:full`（quick + build）；两者均不隐式安装依赖，也不要求 Rust 发布检查。
- `release:full` 保留正式发布严格语义：环境检查 + frozen install + `release:verify`；`release:verify` 复用 `quality:full` 后执行 Rust。
- 明确 PS1 负责 Windows 环境写操作，MJS 只负责跨平台项目检查；菜单编号不得成为未来 CLI / GUI API。
- 候选 ZIP 与完整发布验证分离：pending-user-acceptance 候选包可在受限制作环境生成，但未真实通过 `release:full` 时不得声称 release-ready。
- **未修改：** Config Schema、Config Storage、Web UI、PTY、Sync/GitHub/Update、Agent/Tool/Permission 业务语义。
- **AI 验证：** 分层门禁 5/5、发布环境 8/8、Config Schema 8/8；governance/import/dev-log/docs/comment/Windows BOM/release consistency/config-schema/release-gates/UI contract 全部 PASS；Config System TypeScript 补充检查 PASS。当前容器 Node 22.16.0、无 pnpm 11.17.0 / Cargo，因此正式环境与 Rust 门禁按设计阻断，不声称 `release:full` PASS。

## LFAA v0.0.52 — #20.6 发布环境与质量门禁闭环

- **状态：** superseded
- **基线：** v0.0.51
- **任务：** #20.6
- **用户验收：** not-accepted；其“菜单 1 / 10 过重绑定”由 #20.7 / v0.0.53 修正。
- 修复 Setup 在 pnpm 缺失 / 版本不匹配时提前退出的问题：Node 24.x 可用时优先通过 Corepack 准备根 `package.json` 锁定的 pnpm 11.17.0。
- `scripts/pnpm-only.mjs` 从“只检查是不是 pnpm”升级为“精确检查 pnpm 版本与 packageManager / engines.pnpm 一致”。
- 新增 `release-environment-check.mjs`、8 个环境门禁测试、`release-rust-check.mjs` 与 `release-gates-check.mjs`。
- 根 `typecheck / test / build` 不再调用固定失败占位入口，改为聚合当前真实 Web / Config System 检查。
- 新增统一 `release:verify`，覆盖环境、governance、TypeScript、tests、build、Rust；新增 `release:full`，先执行环境检查和 `pnpm install --frozen-lockfile` 再进入 `release:verify`。
- `LFAA-Setup.bat → 10` 改为“发布检查”：准备锁定 pnpm → frozen install → 统一 `release:verify`，不再维护第二套重复检查链。
- **未修改：** Config Schema 业务语义、Config Storage、Web UI 行为、PTY、Sync / GitHub / Update、Agent / Tool / Permission 执行链、Agent Protocol、Database Schema Version。
- **AI 验证：** 环境门禁 8/8、Config Schema 8/8、Config System TypeScript noEmit、import/dev-log/docs/comment/Windows BOM/config-schema/release-gates/UI contract 全部 PASS。当前制作容器为 Node 22.16.0、无 pnpm 11.17.0、无 Cargo 且无法联网准备工具链，`release:environment` / `release:rust` 均按设计拒绝，因此没有伪造 `release:full` PASS。
- **自举规则：** v0.0.52 用于首次引入这套硬门禁；从下一递增版本开始，生成正式 ZIP 前必须真实通过 `pnpm run release:full`。
- **后续修正：** 上述“生成每个候选 ZIP 前必须 release:full”规则未被用户接受；#20.7 / v0.0.53 改为候选包可披露阻断项，只有宣称完整发布验证 / release-ready 时才要求真实 `release:full` PASS。


## LFAA v0.0.51 — #2.2 Config Schema 基线

- **状态：** pending-user-acceptance
- **基线：** v0.0.50
- **任务：** #2.2
- 正式开始 `config-system` 业务实现，新增 `@lfaa/config-system`。
- Config Schema Version 独立为 `1`，不与产品版本 0.0.51 混用。
- 建立 Settings / Runtime / Provider / Account / Model / Permission Default 的可序列化配置契约。
- 新增默认配置、O(n) 运行时校验、ID 唯一性与引用完整性检查。
- Account 只保存 `credentialRef`；运行时拒绝 API Key / Token / Secret / Password 等明文字段。
- 新增 `config-schema-check.mjs` 与 8 个 Schema 单元测试。
- **未修改：** Config Storage / SQLite / Drizzle / Migration 执行器、Rust Secret Store、Config UI、Agent/Tool/Permission 执行逻辑、PTY、Sync / GitHub / Setup / Update。
- 本地可用环境已完成 TypeScript noEmit、8/8 单测、Config Schema 专项门禁；`governance:check` 中 10 个实际 Node 门禁已逐项执行并全部通过。当前环境无法联网取得项目锁定的 pnpm 11.17.0，因此未伪造 `pnpm run governance:check` 包装命令执行结果。100 Provider + 100 Account + 100 Model 的 1000 次校验实测 P95 约 0.61ms。
- 下一步：用户验收通过后进入 `config-storage`。


## LFAA v0.0.50 — #20.5 文档体系单文件时间线重构

- **状态：** pending-user-acceptance
- **基线：** v0.0.49
- **任务：** #20.5
- `docs/` Markdown 从约 251 个收敛为 9 个长期文档。
- Prompt、Development Log、Changelog、Release 改为固定单文件时间线，不再按任务 / 版本创建 Markdown。
- Standards 合并进 `DEVELOPMENT.md` / `docs/UI.md` / `docs/RUNTIME.md` / `docs/TESTING.md`。
- Module README / Plan / Progress 合并进 `docs/MODULES.md`。
- 架构详细文档合并进根 `ARCHITECTURE.md`。
- 新增 Prompt 生命周期门禁：AI 自测通过只进入 `pending-user-acceptance`，用户明确验收后才允许 `delivered`。
- 重写 docs / dev-log / release consistency 治理检查，禁止旧碎片目录回归。
- UI、PTY、Sync / GitHub / Setup / Update 业务逻辑不在本任务修改范围。

> 迁移来源：`docs/changelog/v0.0.49.md`

## LFAA v0.0.49

### #21.17 Composer 底部安全间距

#### 问题

v0.0.48 的 Composer Wrap 底部 padding 固定为 `.5rem`。Windows 实机全屏时输入框几乎贴着窗口底边，下方留白偏薄，视觉重心太低。

#### 修复

新增单一布局变量：

```text
--agent-composer-bottom-gap
```

当前响应式取值：

```text
Desktop → clamp(1rem, 2.4vh, 1.75rem)
Compact → clamp(.875rem, 1.8vh, 1.375rem)
Mobile  → .75rem
```

Composer Wrap 最终使用：

```css
max(var(--agent-composer-bottom-gap), env(safe-area-inset-bottom))
```

因此大屏会适度上移，小屏不会浪费过多垂直空间，安全区设备仍得到保护。

#### 防回归

`ui-contract-check.mjs` 要求：

- `--agent-composer-bottom-gap` 必须存在；
- `.agent-composer-wrap` 必须读取该变量与 safe area；
- 不允许恢复成固定 `.5rem` bottom padding。

#### 未修改

- Hover / Click 左栏宽度统一；
- 左 / 右 / Bottom 三向吸附；
- Desktop / Compact / Mobile 模式计算；
- Header / Tooltip；
- PTY；
- Sync / GitHub / Setup / Update。

> 迁移来源：`docs/changelog/v0.0.48.md`

## LFAA v0.0.48

### #21.16 Hover / Click 左栏宽度统一

#### 问题

v0.0.47 的正式左栏宽度由 `ResizableWorkbench.leftWidth` 控制，而 Hover Preview 仍由 CSS 的独立 `clamp()` 决定。两个来源会在不同窗口尺寸或历史 resize 状态下产生差异，导致 Hover 后点击展开时左栏宽度发生视觉跳变。

#### 修复

- `ResizableWorkbenchProps` 增加 `onLeftWidthChange`；
- 将当前真实 `leftWidth` 回传 App Shell；
- `AgentWorkbench` 保存 `leftPaneWidth`；
- Workbench Stage 写入 `--agent-left-preview-width`；
- Hover Preview 直接使用这个变量；
- 删除 Preview 独立 Desktop / Compact clamp 宽度；
- UI contract 禁止第二套 Hover 宽度再次出现。

#### 结果

```text
Hover Preview width == 下一次点击展开的正式左栏 width
```

用户 resize、响应式 clamp、恢复持久化宽度都沿用同一几何值。

#### 未修改

- 左 / 右 / Bottom 吸附状态机；
- Desktop / Compact / Mobile 计算；
- Header / Tooltip；
- PTY；
- Sync / GitHub / Setup / Update。

> 迁移来源：`docs/changelog/v0.0.47.md`

## LFAA v0.0.47

### #21.15 容器响应式与布局变量化

#### 问题

v0.0.46 虽然把吸附语义修正为“到 min 收起”，但把左栏 / 右栏 min 固定成 280 / 360，并用 1240 / 760 固定 viewport 断点决定响应式。

Windows 实机缩小浏览器后暴露两个问题：

1. 280 / 360 对小窗口过大，中央主区被挤成窄条；
2. “窗口宽度到了某个 px 就切模式”没有真正考虑 left / center / right 的当前可用尺寸。

同时 TS 与 CSS 分别维护尺寸，后续修改容易出现一边改了、一边没改的漂移。

#### 修复：单一布局配置

新增：

`packages/ui/src/workbench/workbench-layout.config.ts`

几何配置集中为：

```text
ratio + floor + ceiling
```

负责计算：

- left / right / bottom min / initial / max；
- center comfortable / minCenterWidth；
- separator 预算；
- snap hysteresis；
- Desktop / Compact / Mobile。

App Shell 不再拥有固定 `LEFT_LIMITS / RIGHT_LIMITS / BOTTOM_LIMITS`。

#### 修复：容器响应式

响应式链路改为：

```text
agent-workbench-stage
→ ResizeObserver
→ getBoundingClientRect()
→ resolveWorkbenchLayoutMetrics(width, height)
→ LayoutMode
```

不再使用：

```text
window.innerWidth < 1240
window.innerWidth < 760
```

这使浏览器小窗、桌面宿主内容区、DevTools 占宽等场景都按真正可用空间计算。

#### 当前参考结果

```text
1600 → Desktop：left≈288 / right≈360
1280 → Desktop：left≈243 / right≈307
1100 → Desktop：left≈216 / right≈264
1024 → Desktop：left≈216 / right≈252
950  → Compact：left Dock / right Overlay
820  → Compact：left Dock / right Overlay
760  → Compact：left Dock / right Overlay
<680 左右 → Mobile：左右 Overlay
```

这些不是固定断点，实际边界由容器需求公式决定。

#### 当前动态 min

```text
left：约 196~232
right：约 228~288
bottom：约 136~176
```

这比 v0.0.46 的 280 / 360 / 180 更接近实际生产力界面，同时仍保留 floor 防止内容不可读。

#### CSS 变量化

App Shell 新增/统一：

```text
--agent-shell-header-h
--agent-control-size
--agent-page-gutter
--agent-content-max
--agent-composer-max
--agent-left-preview-width
```

Workbench 使用：

```text
--lfaa-left-size
--lfaa-right-size
--lfaa-left-column
--lfaa-right-column
--lfaa-bottom-row
--lfaa-overlay-right-width
--lfaa-mobile-pane-width
```

Drawer 使用 `clamp()` + 百分比；删除旧 420px / 56vw / 88vw 方案。

#### 持久化宽度修复

大屏保存的宽度在容器变窄后会重新：

```text
clamp(current min/max)
→ clamp(dynamic max based on center protection)
```

Compact / Mobile 的 Overlay 不再错误参与另一侧 Dock 的 dynamic max。

#### 吸附行为保持

```text
Resize
→ 到动态 min
→ snap preview 收到 0
→ Pointer 不松手可反向越过 hysteresis 恢复
→ Pointer Up 仍 snapped 才 collapsed
```

正式 collapsed 后 separator 仍不能拖出。

#### 防回归

`ui-contract-check.mjs` 现在检查：

- ResizeObserver / 容器响应式；
- 单一 layout config；
- 禁止 App Shell 固定 Limits；
- CSS data-layout-mode / variables / clamp；
- 禁止旧固定 viewport 断点；
- 禁止旧 420px / 56vw / 88vw Drawer；
- 三向 min snap / reverse unlock / Pointer Up commit；
- 历史 pane width 重新 clamp；
- Tooltip 单一来源。

#### 未修改

- Sync / GitHub / Setup / Update；
- Windows PowerShell BOM；
- xterm / node-pty PTY bridge；
- Agent / Tool / Permission / Config / Rust Native 边界。

> 迁移来源：`docs/changelog/v0.0.46.md`

## LFAA v0.0.46

### #21.14 最小尺寸吸附收起语义修正

#### 问题

v0.0.45 为了改善吸附手感，把 `min` 以下做成了连续弹性压缩区。用户实机验证后发现，这个语义本身是错误的：右栏仍处于“展开”状态时可以被压得太窄，导致工具名称、快捷键和资源区排版被挤坏。

用户要求的正确交互是：

```text
正常展开
→ 拖到最小可用宽度 / 高度
→ 吸附收起
```

而不是：

```text
正常展开
→ min
→ 继续压到更窄
→ 最后才收起
```

#### 修复

- 删除 `elasticSize()`；
- 删除 `snapCommitThreshold()`；
- 左右栏在 `raw <= min` 时立即进入 snap capture；
- Bottom Terminal 同样在高度到达 min 时进入 snap capture；
- snapped 预览直接表达“收起”，不再以 min 以下尺寸渲染内容；
- Pointer 仍按住时，反向拖到 `min + snapHysteresis` 退出 snap capture；
- 退出后恢复到至少 min，可继续正常拉伸；
- Pointer Up 时仍 snapped 才正式提交 collapsed；
- collapsed 后 separator 仍禁止反向展开。

#### 新的可用最小尺寸

```text
左栏：initial 300 / min 280 / max 640
右栏：initial 400 / min 360 / max 760
Bottom：initial 280 / min 180 / max 560
```

新的 min 是布局可读性的硬下限，不是动画中间态。

#### 响应式同步

由于左右栏最小宽度提高，Desktop / Compact 边界同步改为：

```text
Desktop >= 1240px
Compact 760 ~ 1239px
Mobile < 760px
```

Compact / Mobile Drawer 逻辑保持不变。

#### 防回归

`ui-contract-check.mjs` 新增 / 更新检查：

- 必须存在 `raw <= drag.min`；
- 必须存在 `raw >= drag.min + snapHysteresis`；
- 非 snapped 视觉尺寸必须 clamp 到 min 以上；
- 禁止 `elasticSize()` / `snapCommitThreshold()` 回归；
- 左 / 右 / Bottom 最小尺寸必须分别为 280 / 360 / 180；
- 响应式断点必须为 1240 / 760。

#### 未修改

- Sync / GitHub / Setup / Update 业务逻辑；
- Windows PowerShell BOM 契约；
- PTY bridge / node-pty；
- Agent Runtime / Tool Runtime / Permission / Config 边界。

> 迁移来源：`docs/changelog/v0.0.45.md`

## LFAA v0.0.45

### #21.13 响应式重构与弹性吸附

#### 用户实机问题

v0.0.44 在 Windows 浏览器缩小窗口后暴露出三组问题：

1. 右栏在响应式浮层模式使用过大的覆盖宽度，主区几乎消失；
2. 右栏覆盖后顶部 Shell Actions 可能进入被覆盖区域，用户看不到关闭入口；
3. 左 / 右 / 底部吸附在到达 min 时直接跳到 0，拖拽期间又启用 transition，导致“卡一下、很硬、太快”的手感。

另外，贴近左右边缘的自定义 Tooltip 会被父区域 overflow 裁切。

#### 当前响应式方案

```text
Desktop >= 1180
→ 左 / 中 / 右 Dock

Compact 760~1179
→ 左 Dock + 右 Drawer

Mobile < 760
→ 主区全宽 + 左右 Drawer
```

Compact / Mobile 的 Drawer 都从 48px Center Header 下方出现。核心左栏 / 终端 / 右栏按钮留在 Center Header，不被 Drawer 覆盖。

#### 当前拖拽状态机

```text
Pointer Down
→ Pointer Capture
→ 正常跟手
→ min 以下进入弹性压缩区
→ 靠近边缘进入 snap capture
→ 不松手可反向拖回 min
→ 回到 min 后退出 snap capture
→ Pointer Up 决定是否真正 collapsed
```

正式 collapsed 后，separator 仍然不能反向拖出，只能通过显式按钮或快捷键重新展开。

#### 实现

- `AgentWorkbench.tsx`
  - 新增 `LayoutMode` 和 `useLayoutMode()`；
  - Compact 首次进入时自动收右栏；Mobile 首次进入时自动收左右栏与终端；
  - Compact / Mobile 中 Shell Actions 始终由 Center Header 承载；
  - Mobile 禁用 Hover Preview 作为必要入口。
- `agent-workbench.css`
  - 三档响应式视觉；
  - Tooltip start / end 定位；
  - Mobile 隐藏非必要 Header 控件；
  - Composer 与正文宽度适配。
- `ResizableWorkbench.tsx`
  - 新增 `elasticSize()`；
  - 新增 `snapCommitThreshold()`；
  - 左 / 右 / Bottom 统一“吸附后不松手可反拉”的状态机。
- `workbench.css`
  - 拖拽期间 transition 完全关闭；
  - 正式展开 / 收起调整为 220~280ms ease-out；
  - Compact 右 Drawer 和 Mobile 双 Drawer 几何规则；
  - 删除旧 `88vw` 方案。
- `ui-contract-check.mjs`
  - 增加 LayoutMode、断点、Drawer、弹性吸附静态门禁。

#### 不修改

- Windows Sync / GitHub / Setup / Update 业务逻辑；
- PowerShell BOM 契约；
- node-pty / Vite PTY bridge；
- Agent Runtime / Tool Runtime / Permission Engine；
- Config Storage / Secret Store。

#### 当前验证边界

容器环境可执行静态治理、TS/TSX 语法、版本、ZIP Round-trip 等检查；Windows Chrome / Edge 的最终视觉与 Pointer 手感仍需要用户实机确认。

> 迁移来源：`docs/changelog/v0.0.44.md`

## LFAA v0.0.44

### #21.12 Shell Tooltip 单一提示源

#### 问题

用户在 Windows 浏览器实机验证 v0.0.43 时，左栏、底部终端、右栏三个框架按钮都出现两层黑色悬浮提示。

根因：`ShellHeaderButton` 同时设置了：

```text
title="..."
+
<span class="agent-shell-tooltip">...</span>
```

自定义 Tooltip 先显示，浏览器原生 `title` 随后再次显示，形成重复提示和视觉挤压。

#### 修复

- 删除 `ShellHeaderButton` 的原生 `title`；
- 三个框架按钮统一只使用 `.agent-shell-tooltip`；
- 保留 `aria-label`；
- 保留 `Ctrl+B` / `Ctrl+J` / `Ctrl+Alt+B`；
- 保持 `.agent-shell-tooltip { pointer-events:none; }`；
- 新增 `scripts/ui-contract-check.mjs`；
- `governance:check` 增加 UI 静态契约检查。

#### 不变范围

- Header 联动布局不变；
- 左栏 Hover Preview 不变；
- ResizableWorkbench 拖拽/吸附不变；
- xterm/node-pty 真实终端不变；
- Sync/GitHub/Setup/Update 业务逻辑不变。

#### 验收

三个 Shell Header 按钮 Hover / Focus 都只允许出现一层快捷键 Tooltip；持续停留也不能再弹出第二层浏览器原生提示。

> 迁移来源：`docs/changelog/v0.0.43.md`

## LFAA v0.0.43

### #21.11 Web 工作台 Header 联动与按钮归属修正

#### 问题

v0.0.42 的 #21.10 已把左栏、终端和右栏按钮移动到中间区域左右上角，但实现仍使用正文容器内的 `position:absolute` 浮层。用户 Windows 实机截图显示，这会产生明显问题：按钮漂在正文上方，没有和项目标题 / 更多 / 分享 / 右侧栏形成同一条顶部工具栏。

#### 当前结论

参考 ChatGPT / Codex 的结构后，框架级按钮应属于区域 Header：

```text
右栏展开：
Center Header                           Right Header
[左栏] Web 工作台    … 分享            [终端] [右栏]

右栏收起：
Center Header
[左栏] Web 工作台    … 分享 [终端] [右栏]
```

#### 修改

- 删除独立全宽 Web Header；
- 删除 `agent-center-floats` / `agent-center-toggle` 正文悬浮实现；
- `CenterWorkspace` 新增 48px `agent-center-header`；
- 新增 `agent-right-shell-header`，与 Center Header 同高；
- `RightShellActions` 根据 `rightCollapsed` 在 Center Header 和 Right Header 之间迁移；
- 左栏按钮继续 Hover 临时预览、Click / `Ctrl+B` 正式开合；
- 终端快捷键继续 `Ctrl+J`，右栏继续 `Ctrl+Alt+B`；
- 新增自定义黑色 Tooltip；
- Preview 层级低于 Header，避免 Hover 后遮挡左栏按钮点击。

#### 不修改

- `ResizableWorkbench` 拖拽 / 吸附算法；
- node-pty / xterm 终端实现；
- Sync / GitHub / Setup / Update 业务脚本；
- Config / Agent Runtime / Permission / Rust Native 边界。

#### 文档与历史

- #21.10 归档到 `docs/logs/development/archive/0021-10-主区悬浮与左栏预览.md`；
- #21.11 成为 Active；
- Active Prompt、UI_LAYOUT、WEB_UI_TEST、Plan、Progress、Development Log 同步更新。

> 迁移来源：`docs/changelog/v0.0.42.md`

## LFAA v0.0.42

### #4.3 / #20.4 PowerShell 编码保护与开发规范执行闭环

#### 问题

v0.0.41 为关键 Windows PowerShell 文件补结构化中文注释时，文件保存过程把原本的 UTF-8 BOM 去掉了。

LFAA 的根 BAT 通过：

```text
powershell.exe -File scripts\windows\*.ps1
```

启动脚本。Windows PowerShell 5.1 对 UTF-8 without BOM 的自动识别不可靠，因此 v0.0.41 的 Sync / GitHub / Setup / Update 四个 PowerShell 入口都产生了兼容性回归风险。

这个问题说明：仅检查“有没有中文注释”还不够，开发规范必须同时保护可执行文件的编码契约和发布事实一致性。

#### #4.3 修复

- 恢复 4 个 `scripts/windows/*.ps1` 的 `EF BB BF` UTF-8 BOM；
- 不改变 v0.0.40 已修复的 Sync 目标推导、镜像比较、保护目录、路径乱码检测和 Git 工作区规则；
- 新增 `scripts/windows-script-encoding-check.mjs`；
- 编码检查同时验证：
  - BOM 存在；
  - BOM 后内容可严格 UTF-8 解码；
  - 根 BAT 仍通过 `powershell.exe` 调用正确 `.ps1`；
- `governance-check.mjs` 自身也做 BOM 字节检查，使 Sync 完成后的 standalone governance 不会漏掉该回归。

#### #20.4 规范执行闭环

当用户明确要求“按照开发要求 / 按照开发规范 / 严格按照开发规范”时，必须实际执行：

```text
当前事实源读取
→ 边界确认
→ Plan / Prompt
→ Code
→ Progress / Development Log
→ Standards
→ CHANGELOG / Release
→ 自动门禁
→ ZIP Round-trip
→ 新版本交付
```

禁止只在回复中口头承诺。

新增：

```text
scripts/release-consistency-check.mjs
```

用于阻止：

- `lfaa.release.json` 已经是新版本，但 package / crate 仍是旧版本；
- README / CHANGELOG 未更新；
- 当前版本 Changelog / Release 缺失。

#### 新旧记录

- v0.0.41：历史缺陷版本，保持不变；
- #20.3：归档到 `0020-03-代码可读性与项目地图.md`；
- #20.4：当前有效开发规范；
- #4.3：本次 PowerShell 编码修复的 delivered 历史记录。

#### 行为保持不变

本版本不修改：

- v0.0.39 的 Web 主区悬浮按钮与左栏 Hover 预览；
- v0.0.40 的稳定工作区目标推导；
- Sync 文件镜像算法；
- GitHub Push 业务流程；
- Setup / Update 业务流程；
- Protocol / DB Schema / Rust 安全边界。

> 迁移来源：`docs/changelog/v0.0.41.md`

## LFAA v0.0.41

### #20.3 代码可读性与项目地图

#### 问题

项目已经有不少 docs，但它们主要解决的是：

- 开发规范；
- 架构边界；
- Plan / Progress / Prompt；
- Development Log；
- Changelog / Release；
- 治理脚本事实源。

它们没有把“第一次打开仓库的人怎么认识所有目录 / 文件”和“关键源码内部怎么知道这块代码负责什么”做完整。

实际审计还发现：

1. `docs/standards/COMMENTS.md` 已经要求重要文件使用结构化中文文件头，但 `AgentWorkbench.tsx`、`ResizableWorkbench.tsx`、`LocalTerminal.tsx`、关键 CSS 等没有严格执行；
2. v0.0.39 后 UI 代码已经变成“中间主区悬浮按钮 + 左栏 Hover 预览”，但 `UI_LAYOUT.md`、Active Prompt、Active Development Log 仍停留在 v0.0.38 的 Web Chrome 方案；
3. v0.0.40 的同步 / ZIP 修复错误使用了 #21.11 UI 编号，实际应属于 #4 工作区同步问题；
4. `apps/`、`packages/`、`crates/`、`scripts/` 缺少一级目录 README，新用户只能猜目录作用。

#### 修复一：结构化代码注释

关键文件补充：

```text
文件
作用
负责
不负责
状态归属
对外接口
关联文件
修改注意事项
```

当前重点覆盖：

- `packages/app-shell/src/AgentWorkbench.tsx`
- `packages/app-shell/src/WorkbenchIcon.tsx`
- `packages/app-shell/src/workbench.types.ts`
- `packages/ui/src/workbench/ResizableWorkbench.tsx`
- `packages/ui/src/workbench/workbench-layout.types.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/LocalTerminal.tsx`
- `apps/web/src/vite-custom-events.d.ts`
- `apps/web/vite.config.ts`
- Windows Setup / Sync / GitHub / Update PowerShell
- 核心治理 MJS 脚本

复杂交互同时补充“为什么这样做”的段落注释，例如：

- Hover Preview 为什么不修改 `leftCollapsed`；
- `requestAnimationFrame` 为什么用于拖拽；
- snap hysteresis 为什么存在；
- collapsed 后 separator 为什么不能反向展开；
- PTY session 为什么绑定 WebSocket owner。

#### 修复二：CSS 盒子地图

三个关键 CSS：

```text
packages/app-shell/src/agent-workbench.css
packages/ui/src/workbench/workbench.css
apps/web/src/local-terminal.css
```

新增：

- 文件职责；
- 与 TSX/TS 的关联；
- DOM / Grid 盒子结构；
- 分区编号；
- 每块样式属于页面哪个区域。

#### 修复三：项目结构总地图

新增：

```text
docs/项目结构与代码地图.md
```

解释：

- 根目录每个主要文件和目录；
- `apps/` 每个 app；
- `packages/` 每个 package；
- `crates/` 每个 Rust crate；
- `scripts/` 每个治理 / Windows 脚本；
- `docs/` 每类文档到底回答什么问题；
- 当前 Web UI 从 `App.tsx` 到 `AgentWorkbench`、`ResizableWorkbench`、`LocalTerminal` 的调用链；
- 三个 CSS 文件分别负责哪个层次。

同时新增一级目录 README 和源码导航 README。

#### 修复四：自动门禁

新增：

```text
scripts/comment-check.mjs
```

并接入：

```text
pnpm run governance:check
```

检查关键实现文件的结构化文件头、关键 CSS 分区和项目地图入口。

#### 修复五：文档事实源回正

- #20：#20.2 归档，当前为 #20.3；
- #21：#21.9 归档，当前为 #21.10；
- #4：增加 #4.2，承接 v0.0.40 的同步目标 / ZIP 编码修复；
- Active Prompt、UI Layout、Development Log INDEX 同步到当前实现。

#### 行为保持不变

v0.0.41 不改变：

- v0.0.39 主区左 / 右上角 Shell 控件位置；
- 左栏 Hover 临时预览；
- `Ctrl+B` / `Ctrl+J` / `Ctrl+Alt+B`；
- 三向吸附；
- 真实 PTY；
- v0.0.40 Sync 目标路径和 ZIP 中文路径保护。

> 迁移来源：`docs/changelog/v0.0.40.md`

## LFAA v0.0.40

> **编号勘误（v0.0.41）：** 本版本内容属于工作区同步 / 发布包问题，Development Log 正式归档为 `#4.2`。当时标题写成 `#21.11` 属于任务编号归类错误；历史内容保留，不再把该修复视为 Web UI #21 的子变更。
### #21.11 同步目标与 ZIP 中文路径修复

#### 问题一：稳定工作区目标被推导错

v0.0.39 的发布 ZIP 多包了一层 `lfaa39`。解压后项目根变成：

```text
H:\lfaa\LFAA-v0.0.39\lfaa39
```

旧同步逻辑使用“项目根父目录 + `lfaa`”推导稳定工作区，因此得到：

```text
H:\lfaa\LFAA-v0.0.39\lfaa
```

而真正目标应为：

```text
H:\lfaa\lfaa
```

这会导致预览显示全部文件为新增，并在版本包内部创建错误的 `lfaa` 目录。

#### 修复一：目标根目录识别

`lfaa-sync.ps1` 现在会从当前项目根向上查找 `LFAA-vX.Y.Z` 版本目录：

- 找到版本目录时，目标固定为该版本目录父级下的 `lfaa`；
- 没找到版本目录时，才回退到原有“项目根父目录 + `lfaa`”规则；
- 仍保留源目录与目标目录相同的自同步保护。

因此即使未来发布包意外多一层目录，也不会再把稳定工作区建到版本包内部。

#### 问题二：Windows 解压中文文件名出现 GBK 乱码

此前路径保护只覆盖 UTF-8 文件名被 CP437/OEM 错解的情况，例如 `Θàìτ...`。Windows 某些解压路径还可能把 UTF-8 字节按 CP936/GBK 解码，形成：

```text
配置系统.md
↓
閰嶇疆绯荤粺.md
```

v0.0.39 的检查会漏掉这种乱码。

#### 修复二：双编码路径保护

路径检查现在同时尝试：

- CP437 -> UTF-8 恢复；
- CP936/GBK -> UTF-8 恢复。

只要能恢复出不同的中文名称，就会在差异计算前直接阻止同步。

#### 修复三：发布 ZIP 结构

v0.0.40 发布包采用项目根内容直接打包：

```text
LFAA-v0.0.40.zip
├─ LFAA-Sync.bat
├─ lfaa.release.json
├─ apps/
├─ packages/
└─ ...
```

不再包含：

```text
lfaa40/
```

同时中文文件名使用 UTF-8 ZIP 标志，避免 Windows Explorer 把路径按本地代码页错误解释。

#### 保持不变

- v0.0.39 的左侧 Hover 预览；
- 中间区域左右上角的常驻按钮布局；
- `Ctrl+B`、`Ctrl+J`、`Ctrl+Alt+B`；
- GitHub 推送修复；
- 三向吸附和吸附后禁止反向拖开；
- `.git`、本机日志、依赖缓存和本地 `.env` 保护。

> 迁移来源：`docs/changelog/v0.0.39.md`

## LFAA v0.0.39

### #21.10 主区悬浮栏与左栏 Hover 预览

#### 背景

v0.0.38 已经把左栏、终端和右栏入口从 hover 控件修正为常驻入口，但它们仍然停留在 Web 顶栏中。当前目标是继续向 ChatGPT / Codex 的主区入口布局靠拢：

- 左栏按钮放到中间工作区左上角；
- 终端和右栏按钮放到中间工作区右上角；
- 顶栏只承担页面标题和次要操作；
- 左栏按钮在收起状态下支持 hover 预览左侧内容区。

#### 交互结论

Web 端最终分成两层：

1. **页面顶栏**：显示 `Web 工作台` 标题、更多、分享；
2. **主区悬浮控件层**：显示左栏、终端、右栏三个框架级按钮。

```text
┌──────────────────── 页面顶栏 ────────────────────┐
│ Web 工作台                                  … 分享 │
├────────────────────────────────────────────────────┤
│ [左栏]                             [终端] [右栏]   │
│ ┌──── 左侧栏（可 hover 预览） ────┬──────────────┐ │
│ │                                │              │ │
│ └────────────────────────────────┤ 中间工作区   │ │
│                                  │              │ │
│                                  └──────┬───────┘ │
│                                         │ 终端面板 │
└─────────────────────────────────────────┴──────────┘
```

#### 修复

- 移除 `WebWorkbenchChrome` 顶栏控制布局；
- 新增页面顶栏 `WebWorkbenchHeader`，只保留标题与更多 / 分享操作；
- 左栏按钮迁移到中间主区左上角；
- 终端与右栏按钮迁移到中间主区右上角；
- 左栏按钮保留 `Ctrl+B` 提示，并在 hover / focus 时触发左栏预览；
- 左栏收起时新增 `agent-left-hover-preview` 浮层，使用 opacity + transform 做淡入淡出；
- 预览浮层可在按钮与左栏之间连续移动，不会立刻闪退；
- 右侧按钮行为不改，继续使用显式点击开合；
- 终端快捷键改为 `Ctrl+J`，右栏快捷键继续使用 `Ctrl+Alt+B`；
- 右栏资源区内的“终端”条目同步显示 `Ctrl+J`。

#### 保持不变

- 左右侧栏仍支持拖到最小宽度自动吸附收起；
- 吸附收起后仍不能从 separator 反向拖开；
- 真实终端仍固定在工作区底部；
- 右栏工具与资源内容结构保持不变；
- 顶栏在窄屏下仍可隐藏“分享”等次要操作，但主区左 / 右悬浮控制继续存在。

> 迁移来源：`docs/changelog/v0.0.38.md`

## LFAA v0.0.38

### #21.9 Web 常驻工作台 Chrome

#### 问题

v0.0.37 仍把侧栏开合入口设计成 hover 控件：

- 左栏展开时，收起按钮只有鼠标移入左栏才出现；
- 右栏展开时，终端 / 右栏按钮只有鼠标移入右栏才出现；
- 栏位收起后又依赖屏幕边缘 hover 热点重新展开。

这与 Codex 桌面端的实际壳层逻辑不同。参考界面中的左栏、终端和右栏按钮属于工作台框架本身，是常驻入口，不应该因为栏位内容被收起而消失。

#### Web 布局结论

桌面端可把这类按钮放进原生标题栏；Web 页面没有原生应用菜单栏，因此由页面自身提供一条全宽工作台 Chrome：

```text
┌──────────────────── Web Workbench Chrome ────────────────────┐
│ [左栏]  Web 工作台                         [终端] [右栏] … 分享 │
├────────左侧栏────────┬────────中间工作区────────┬────右侧栏─────┤
│                      │                           │               │
│                      │                           │               │
│                      ├───────────────────────────┴───────────────┤
│                      │                Terminal Dock              │
└──────────────────────┴───────────────────────────────────────────┘
```

#### 修复

- 新增 `WebWorkbenchChrome`，位于整个可拖拽工作区上方并横跨页面全宽；
- 左栏按钮固定在 Web 顶栏最左侧，左栏展开 / 收起时位置不变化；
- 终端按钮和右栏按钮固定在 Web 顶栏右侧；
- 三个壳层按钮始终可见，不再以 opacity / hover 控制显隐；
- 左侧栏内部删除重复的收起按钮；
- 右侧栏内部删除重复的终端 / 收起按钮；
- 删除收起状态下的左右边缘 hover 入口和底部 hover 入口；
- 右栏内部“终端”工具项仍保留，作为功能入口，与顶栏常驻按钮状态一致；
- `Ctrl+B`、`Ctrl+Alt+B`、`Ctrl+\`` 快捷键继续保留；
- 拖到阈值吸附、吸附后禁止从 separator 反向拖开的 v0.0.36 行为保持不变。

#### 响应式

- 顶栏始终横跨 Web 页面，不属于任意一个可收起侧栏；
- 窄屏隐藏“分享”等次要操作，但左栏 / 终端 / 右栏三个框架级入口继续保留；
- 左右栏进入浮层模式时，仍由同一组顶栏按钮控制。

> 迁移来源：`docs/changelog/v0.0.37.md`

## LFAA v0.0.37

### #4.1 版本包中文路径修复与同步保护

#### 问题

v0.0.36 的功能代码本身可用，但发布包中部分中文文档路径在打包过程中被错误按 CP437/OEM 字符集解释，导致同步预览出现：

- 正常中文路径被判断为删除；
- 乱码路径被判断为新增；
- 差异数量异常放大。

用户在确认阶段选择取消，因此稳定工作区没有被这批错误路径覆盖。

#### 修复

- 以 v0.0.36 为唯一功能基线，保留 #10.2 GitHub 推送修复和 #21.8 三向吸附交互；
- 将 v0.0.36 中 83 个可逆乱码路径恢复为原 UTF-8 中文文件名；
- `LFAA-Sync` 在生成差异前先检查源版本包路径；
- 如果路径可通过 `CP437 bytes → strict UTF-8` 恢复为不同的中文名称，则判定源版本包存在编码损坏并停止；
- 发布 ZIP 使用 Unicode 文件名写入，并在产物生成后重新读取 ZIP 清单验证；
- 修正同步保护目录判断：`apps/web/node_modules` 这类嵌套依赖缓存也不再进入删除计划。

#### 预期结果

从 v0.0.35 稳定工作区预览 v0.0.37 时，不应再出现“同一批中文文件一边删除、一边以乱码名称新增”的情况。

正常差异只来自 v0.0.36 / v0.0.37 的真实新增和修改。

> 迁移来源：`docs/changelog/v0.0.36.md`

## LFAA v0.0.36

### #10.2 GitHub 推送预检容错

- 移除 `git ls-remote` 失败即终止的一票否决行为；
- 改为 `git fetch origin main` 获取远端状态；
- fetch 成功时使用 `git rebase origin/main` 后再 push；
- fetch 预检失败时继续执行安全 push，让 Git 自身给出最终结果；
- 对网络 / 代理 / TLS、认证权限、non-fast-forward 分别给出更明确提示；
- 工作区无新文件变化时，也会继续推送此前已经创建但尚未上传的本地 commit。

### #21.8 三向吸附与显式重新展开

- 左右栏拖到最小尺寸后吸附收起；
- 吸附收起后，resize 分隔条不能反向拖拽展开；
- 左右栏必须点击对应边缘展开控件（或现有快捷键）重新打开；
- 底部终端新增向下拖拽吸附收起；
- 底部终端收起后不能从底边反向拖出；
- 新增底部 hover 展开入口，点击后恢复终端；
- 三个方向统一为“拖拽负责缩放/吸附，显式控件负责重新展开”。

> 迁移来源：`docs/changelog/v0.0.35.md`

## LFAA v0.0.35

### #19.10 Rustup Windows Target 缺失修复

Windows 新机器首次运行菜单 `1`，Rust 缺失时出现：

```text
Get-WindowsRustupTarget 无法识别
```

原因是 Rust 官方安装流程引用了该 helper，但此前重构时遗漏了函数定义。

#### 修复

```text
AMD64 → x86_64-pc-windows-msvc
ARM64 → aarch64-pc-windows-msvc
x86   → i686-pc-windows-msvc
```

官方 Rustup 下载和 SHA-256 校验保持不变。

Governance 新增关键 helper 与 target tuple 门禁，避免再次删漏。

> 迁移来源：`docs/changelog/v0.0.34.md`

## LFAA v0.0.34

### #19.9 node-pty Smoke Check Windows 引号修复

修复 Windows PowerShell 5 执行菜单 `1` 时出现：

```text
require(node-pty)
SyntaxError
```

该错误来自 `node -e` 内嵌 JavaScript 在 Windows 原生命令参数传递时丢失引号，不代表 node-pty 一定没有正确构建。

#### 修复

```text
旧：node -e "...require('node-pty')..."
新：node scripts/check-node-pty.mjs
```

独立脚本从 `apps/web` 的依赖上下文加载 node-pty，并真实检查 `pty.spawn`。

> 迁移来源：`docs/changelog/v0.0.33.md`

## LFAA v0.0.33

### #19.8 node-pty 跨机器安装

修复全新 Windows 电脑执行菜单 `1` 时：

```text
ERR_PNPM_IGNORED_BUILDS
Ignored build scripts: node-pty@1.1.0
```

#### 根因

真实终端新增 `node-pty` 后，pnpm 11 会默认阻止尚未审核的依赖构建脚本；严格模式下安装会返回非零退出码。

#### 修复

```yaml
strictDepBuilds: true
allowBuilds:
  "node-pty@1.1.0": true
```

只批准锁定版本的 node-pty，不允许所有依赖执行构建脚本。

Setup 菜单 1 安装后还会检查 node-pty 是否真的能被 Node 加载。

> 迁移来源：`docs/changelog/v0.0.32.md`

## LFAA v0.0.32

### #21.7 侧栏 Hover 与真实终端

#### 侧栏控制

- 左 / 右侧栏 Hover 控件回到侧栏本身；
- 中间顶部不再放侧栏开合按钮；
- 分隔条只负责拖拽；
- collapsed 时使用屏幕边缘淡入热点重新展开。

#### Terminal Dock

- 终端移到最底部；
- 左侧栏全高；
- 终端横跨中间 + 右侧；
- 顶部边界可拖动调整终端高度。

#### 真实终端

删除模拟终端输出。

Web Vite 开发模式新增：

```text
@xterm/xterm 6.0.0
@xterm/addon-fit 0.11.0
node-pty 1.1.0
```

终端连接真实 PTY，Windows 默认 PowerShell。

#### 重要

v0.0.32 新增依赖，首次使用必须先运行：

```text
LFAA-Setup.bat → 1
```

再运行菜单 2。

> 迁移来源：`docs/changelog/v0.0.31.md`

## LFAA v0.0.31

### #21.6 三栏交互与终端停靠

继续修正 Web 工作台 UI 交互，使其更接近 ChatGPT / Codex 的三栏使用方式。

#### 主要变化

```text
分隔条
→ 仅保留拖拽与自动吸附

顶部左上 / 右上
→ 提供开合左右栏与终端的控制按钮

中间底部
→ 新增终端停靠区
```

#### 修复点

- 去掉分隔条中央点击按钮，避免点击 / 拖拽冲突；
- 收起 / 展开增加更顺滑的过渡动画；
- 顶部控制按钮支持 hover 淡入、移出淡出；
- 右侧“终端”工具与底部终端联动。

> 迁移来源：`docs/changelog/v0.0.30.md`

## LFAA v0.0.30

### #21.5 Web 启动延迟修复

修复菜单 2 选择后长时间空白等待。

#### 根因

旧逻辑：

```text
5173 → HTTP 请求，最多等 1 秒
5174 → HTTP 请求，最多等 1 秒
...
5199 → HTTP 请求，最多等 1 秒
```

即使没有任何服务，也会逐端口探测。

#### 新逻辑

```text
一次读取本机 TCP Listener
→ 只探测真正占用的端口
→ 已有 LFAA 则复用
→ 否则立即选择空闲端口
```

Vite 直接执行项目本地 binary，不在菜单 2 走依赖安装。

### #19.7 Setup 主菜单循环

Setup 现在：

```text
1 - 10 → 操作后返回主菜单
0      → 退出
```

Web 按 Ctrl+C、普通错误、取消操作也会返回主菜单。

> 迁移来源：`docs/changelog/v0.0.29.md`

## LFAA v0.0.29

### #19.6 依赖模型简化

#### 最终规则

```text
电脑基础工具
→ Node / pnpm / Git / Rust / Cargo
→ 一次安装，多项目复用

项目内容
→ node_modules / Cargo.lock / rust-toolchain.toml / target / .lfaa
→ 跟项目走
```

#### Setup

菜单 1 不再暴露“用户级 / 项目级 / 共享工具链”等安装概念。

流程固定：

```text
已有工具 → 复用
缺少工具 → 自动安装
项目依赖 → 自动安装
项目资源 → 自动初始化
```

#### Rust

Rust 缺失时直接使用 Rust 官方 `rustup-init`。

删除 WinGet Rust 安装分支，减少安装路径差异。

安全链仍保留：

```text
Rust 官方 HTTPS
→ 官方 .sha256
→ 本地 SHA-256 校验
→ 执行安装器
```

> 迁移来源：`docs/changelog/v0.0.28.md`

## LFAA v0.0.28

### #19.5 Rust 工具链分层

Rust 改为共享 rustup/toolchain，项目通过 `rust-toolchain.toml` 锁定 `1.98.1`，不再修改全局 `rustup default`。

### #21.4 Web 端口复用

菜单 2 会复用已经运行的 LFAA Vite；5173 被其他程序占用时自动选择 5174-5199 空闲端口。

> 迁移来源：`docs/changelog/v0.0.27.md`

## LFAA v0.0.27

### #21.3 最小宽度自动吸附

#### 问题

v0.0.26 的侧栏收起逻辑是：

```text
拖到独立 96px 阈值
→ 松开 Pointer
→ 才收起
```

这与目标交互不一致。

#### 修改

现在改为：

```text
左栏到 240px
→ 立即自动吸附收起

右栏到 300px
→ 立即自动吸附收起
```

不需要松开鼠标。

反向拖回时使用 24px 迟滞，避免最小宽度边界反复开合。

最大宽度、中央最小宽度保护和 localStorage 状态继续保留。

> 迁移来源：`docs/changelog/v0.0.26.md`

## LFAA v0.0.26

### #21.2 黑白工作台重构

#### 视觉

- 移除水墨 / 宣纸 / 山水主题；
- 改为 Codex / ChatGPT 类中性黑白灰工作台；
- 支持浅色 / 深色；
- 主题偏好保存在浏览器本地。

#### 三栏布局

- 左栏：288px，240px - 640px；
- 右栏：360px，300px - 760px；
- 桌面拖动时动态限制最大宽度，保护中央工作区约 520px；
- 吸附阈值调整为 96px；
- 拖动只做 CSS 预览，松开后才提交 collapsed 状态；
- 收起 / 展开动画约 180ms。

#### 命名

`InkWorkbench` 更名为：

```text
AgentWorkbench
```

避免视觉方向已经改变后仍保留误导性命名。

#### 保留

`.lfaa` Vite 热插拔开发桥接协议不变。

> 迁移来源：`docs/changelog/v0.0.25.md`

## LFAA v0.0.25

### #19.4 Rust 安装诊断优化

#### 路径检测

新增 `CARGO_HOME/bin`，支持自定义 Rust/Cargo 安装目录。

#### WinGet

`-1978335189 / 0x8A15002B` 现在解释为：

```text
未发现可适用更新
```

WinGet 返回后会重新检测 rustup/Cargo，再决定是否走官方安装器。

#### Rust 官方输出

Rust 官方：

```text
info: ...
```

日志继续保留英文原文。

LFAA 在前面明确说明该英文属于官方 rustup 输出。

#### 安全

官方 rustup-init 仍然：

```text
static.rust-lang.org
+ 官方 .sha256
+ 本地 SHA-256 校验
```

> 迁移来源：`docs/changelog/v0.0.24.md`

## LFAA v0.0.24

### #19.3 统一开发入口

`LFAA-Setup.bat` 统一承担：

```text
依赖
Web 启动
Desktop 启动
Web 构建
Desktop 构建
本地构建发布
环境检查
项目资源
治理检查
完整检查
```

删除：

```text
LFAA-Web.bat
scripts/windows/lfaa-web.ps1
```

### #21.1 Web 启动入口调整

Web Vite 现在通过：

```text
LFAA-Setup.bat → 2
```

启动。

`.lfaa` 热插拔测试逻辑保持不变。

### Desktop 当前状态

Desktop 菜单已经预留真实入口，但 `apps/desktop` 尚未配置 Electron `dev/build/make` 等脚本。

因此选择 Desktop 相关菜单时必须明确提示未实现，不会假成功。

> 迁移来源：`docs/changelog/v0.0.23.md`

## LFAA v0.0.23

### #21 Web 工作台 UI

状态：`in-progress`

#### 已实现源码

- React + TypeScript + Vite Web 入口；
- ChatGPT 类三栏工作台；
- 左右栏自由拉伸；
- 128px 吸附收起；
- 双击 / 键盘收起；
- 本地宽度持久化；
- 水墨 / 宣纸视觉；
- Vite `.lfaa` 只读热插拔开发桥接；
- 窄窗口浮层布局。

#### 未伪造通过的检查

当前生成环境无法联网安装 pnpm/Vite 依赖，因此以下检查等待 Node 24 + pnpm 环境：

```text
pnpm install
pnpm run typecheck:web
pnpm run build:web
Vite 浏览器实机交互
```

### #19.2 Setup

本地 Setup 改为 `pnpm install`，允许开发新增依赖时同步 lockfile；CI / 正式质量门禁仍使用 frozen lock。

> 迁移来源：`docs/changelog/v0.0.22.md`

## LFAA v0.0.22

### #19.1 一键准备真实检测

#### Node / pnpm

- 显示真实版本与可执行路径；
- 校验 Node 24.x；
- 校验 pnpm 项目版本；
- 统计 workspace 和实际依赖声明；
- 零外部依赖时明确解释 node_modules 很小。

#### Rust

- Cargo 缺失时先尝试 winget；
- winget 不存在或失败时使用 Rust 官方 rustup-init；
- 下载官方 `.sha256`；
- SHA-256 一致后才执行；
- 显式安装 stable toolchain。

#### 完成状态

Rust 仍无法安装时显示：

```text
部分完成
```

而不是全部成功。

> 迁移来源：`docs/changelog/v0.0.21.md`

## LFAA v0.0.21

### #10.1 GitHub 推送取消二次确认

#### 修改前

```text
输入 Commit 名称
→ 创建 Commit
→ 【确认】【推送远程仓库】输入 Y
→ Push
```

#### 修改后

```text
输入 Commit 名称
→ 创建 Commit
→ 显示 origin / 分支 / Commit
→ 直接 Push
```

#### 保留

`origin` 新增或修改仍然需要确认。

> 迁移来源：`docs/changelog/v0.0.20.md`

## LFAA v0.0.20

### #20.2 中文命名与文档整理

#### 中文文件名

Development Log 改为：

```text
NNNN-中文短名.md
NNNN-NN-中文短名.md
```

例如：

```text
0020-开发日志与文档规范.md
0020-01-历史编号迁移.md
```

Prompt 编号文件同步使用中文短名。

#### docs 目录整理

新增：

```text
docs/README.md
```

作为文档总入口。

日志重新分为：

```text
docs/logs/development/
docs/logs/runtime/
```

其中运行日志统一移动到：

```text
runtime/workspace-sync/
runtime/github-push/
runtime/source-update/
```

#### 自动检查

新增：

```text
pnpm run docs:check
```

检查 docs 顶层目录、编号文档中文命名和日志分类。

> 迁移来源：`docs/changelog/v0.0.19.md`

## LFAA v0.0.19

### #20.1 历史编号迁移

修复 v0.0.18 Development Log 只直接显示 #20 的问题。

#### 完成

- #1 - #19 全部进入新的 Development Log 索引；
- #2 作为当前 Config System 放入 active；
- #1、#3 - #19 作为已交付历史放入 archive；
- #20.0 保存为历史快照；
- #20 当前更新为 #20.1；
- 原有 Prompt / Progress / Changelog / Release 不删除；
- 自动检查主编号 #1 到当前最大编号不能缺失；
- INDEX 明确说明真实历史从 #1 开始，不伪造 #0。

> 迁移来源：`docs/changelog/v0.0.18.md`

## LFAA v0.0.18

### #20 开发日志分层规范

#### 完成

- 新增 `docs/logs/development/`；
- 新增 `active/` 与 `archive/` 分层；
- 新增开发日志 `INDEX.md`；
- 新增 `docs/standards/DEV_LOGS.md`；
- `AGENTS.md` 强制先读 DEVELOPMENT，再读开发日志；
- DEVELOPMENT 重构为清晰分组的当前规则；
- NAMING 增加文档与日志命名硬规则；
- 新增 `scripts/dev-log-check.mjs`；
- Governance 接入开发日志检查；
- 旧 #1 - #19 记录不删除，通过 legacy 索引继续回溯。

#### 当前编号

```text
#20
最新变更：#20.0
```

> 迁移来源：`docs/changelog/v0.0.17.md`

## LFAA v0.0.17

### #19 一键准备与项目资源根收敛

#### Setup

菜单 `1` 改为“一键准备”：

- 复用现有 pnpm 依赖；
- 缺少 Rust/Cargo 时通过 winget 尝试安装 Rustup；
- Rust 当前无外部 crate 时不生成无必要的 Cargo.lock；
- 未来有受控 Cargo.lock 后使用 `cargo fetch --locked`。

#### Project Resources

删除根目录：

```text
/skills
/plugins
```

项目运行时资源统一到：

```text
.lfaa/
├── skills/
├── experts/
├── plugins/
├── extensions/
└── mcp/
```

#### Hot Plug

`.lfaa` 不妨碍 Electron / Node / Rust 读取或 File Watcher 监听。

热插拔采用 Registry Generation + Atomic Publish，运行中的 Run 不被中途替换资源破坏。

> 迁移来源：`docs/changelog/v0.0.16.md`

## LFAA v0.0.16

### #18 Setup 菜单缺少 Cargo 时错误终止修复

修复 `LFAA-Setup.bat` 菜单 `1` 在 pnpm 安装成功后，因为机器未安装 Cargo 而把整个流程标记失败的问题。

#### 新行为

```text
Node/pnpm 可用
→ 正常安装 Node 依赖

Cargo 不存在
→ 显示跳过
→ 保留 Node 安装结果
→ 初始化 .lfaa 项目资源
→ 以“当前环境可执行部分已完成”正常结束
```

菜单 `4` 与菜单 `10` 仍然严格要求 Cargo。

> 迁移来源：`docs/changelog/v0.0.15.md`

## LFAA v0.0.15

### #16 项目治理、归属与项目级资源边界加固

正式交付项目身份、第三方归属、`.lfaa/` 项目资源、安全、性能、质量门禁以及 Setup 菜单。

### #17 pnpm-only 一致性修复

#### 修复问题

项目已经固定 pnpm，但根 test 脚本和 DEVELOPMENT 仍有 npm 残留。

#### 修复内容

- `test` 使用 `pnpm run governance:check`；
- 新增 `scripts/pnpm-only.mjs`；
- `preinstall` 阻止其他包管理器；
- Governance 检查 root scripts；
- DEVELOPMENT、AGENTS、README、QUALITY_GATES 统一 pnpm-only；
- Setup 环境页只展示 Node/corepack/pnpm/Cargo/Rust。

#### 下一步

主业务模块仍为 `config-system`，下一任务进入 `config-schema`。

> 迁移来源：`docs/changelog/v0.0.14.md`

## LFAA v0.0.14

### #15 Update 安全拉取远程差异读取修复

修复 `LFAA-Update` 在本地与远程已经完全一致时，
仍然继续读取文件差异并错误失败的问题。

#### 新逻辑

```text
ahead=0 / behind=0
→ 立即判定已是最新
→ 不再执行 git diff
```

只有远程确实存在需要展示的变化时才读取文件差异。

文件差异比较同时改为：

```text
git diff <local-commit> <remote-ref>
```

并增加：

```text
git diff-tree
```

作为兼容 fallback。

> 迁移来源：`docs/changelog/v0.0.13.md`

## LFAA v0.0.13

### #14 同步菜单顺序优化

`LFAA-Sync.bat` 菜单顺序调整为：

```text
【1】【执行同步】
【2】【预览差异】
【3】【同步配置】
【0】【退出】
```

仅调整菜单顺序和对应选择逻辑，不改变同步实现、安全保护、镜像校验或日志机制。

> 迁移来源：`docs/changelog/v0.0.12.md`

## LFAA v0.0.12

### #13 Git 更新脚本路径无关化

`LFAA-Update.bat` 不再依赖固定盘符或固定目录名。

#### 新定位策略

```text
脚本所在项目
→ 当前启动目录
→ 附近 Git 工作区
→ 用户选择
→ 用户手工输入路径
```

最终使用：

```text
git rev-parse --show-toplevel
```

确认真正 Git 根目录。

因此项目位于任意盘符、移动硬盘、U 盘或任意目录名均可使用。

> 迁移来源：`docs/changelog/v0.0.11.md`

## LFAA v0.0.11

### #12 Windows 脚本菜单化与强制拉取

三个一键工具改为“先菜单、后执行”。

#### LFAA-Update

- 安全拉取
- 强制拉取
- 仅检查更新
- 退出

安全拉取只允许 fast-forward。

强制拉取会自动建立备份分支并 stash 未提交文件，再对齐远程。

#### LFAA-GitHub

- 一键提交并推送
- 查看 Git 状态
- 配置/修改 origin
- 退出

#### LFAA-Sync

- 预览差异
- 执行同步
- 查看同步配置
- 退出

双击脚本本身不再立即执行 Git/文件同步写操作。

> 迁移来源：`docs/changelog/v0.0.10.md`

## LFAA v0.0.10

### #11 Git Clone 后一键更新源码

#### 新脚本

```text
LFAA-Update.bat
scripts/windows/lfaa-update.ps1
```

#### 使用场景

第一次：

```text
git clone <origin>
```

以后：

```text
双击 LFAA-Update.bat
```

不需要重新 clone。

#### 更新流程

```text
检测 Git 工作区
→ 读取 origin
→ 检测本地未提交修改
→ git fetch --prune
→ 比较 ahead / behind
→ 展示远程文件变化
→ 用户确认
→ git pull --ff-only
→ 校验 HEAD
→ 保存更新日志
→ 提示可以关闭终端
```

#### 安全

脚本不会默认执行：

```text
git reset --hard
git clean -fd
```

本地与远程出现分叉时也不会自动 merge/rebase。

#### 关联 Prompt

`docs/prompts/archive/v0.0.10/0011-源码更新脚本.md`

> 迁移来源：`docs/changelog/v0.0.9.md`

## LFAA v0.0.9

### #10 移除 Commit 二次确认

#### 问题

用户填写 Commit 名称后还需要再次确认创建 Commit，交互重复。

#### 修复

删除：

```text
【确认】【创建提交】
```

现在：

```text
【输入】【提交名称】
→ 直接 git commit -m "<用户输入>"
```

随后继续检测远程状态。

#### 保留

Push 前仍然保留：

```text
【确认】【推送远程仓库】
```

因为 Push 会改变远程仓库状态。

#### 关联 Prompt

`docs/prompts/archive/v0.0.9/0010-Commit确认优化.md`

> 迁移来源：`docs/changelog/v0.0.8.md`

## LFAA v0.0.8

### #9 终端完成状态与关闭提示

#### 问题

脚本运行完成后窗口停留，但用户无法明确判断是否可以关闭。

#### 修复

统一 GitHub 与 Workspace Sync 的结束状态。

成功时：

```text
【提示】【可关闭】全部操作已完成，现在可以安全关闭终端窗口。
【提示】【操作】按任意键关闭窗口，或直接点击右上角 X。
```

失败时：

```text
【提示】【可关闭】错误信息已经保留，现在可以关闭窗口；处理问题后再重新运行。
```

#### 启动器

BAT 只负责启动 PowerShell：

```text
LFAA-GitHub.bat
LFAA-Sync.bat
```

最终提示与等待按键由 PowerShell 统一负责，避免双重 pause 和英文提示混杂。

#### 关联 Prompt

`docs/prompts/archive/v0.0.8/0009-终端完成状态.md`

> 迁移来源：`docs/changelog/v0.0.7.md`

## LFAA v0.0.7

### #8 用户首次配置 Git origin

#### 问题

仓库地址属于用户自己的 Git 工作区配置，不应该在 LFAA 脚本中硬编码。

#### 方案

首次没有 `origin` 时：

```text
【配置】【远程仓库】
首次使用需要配置 Git origin。

【输入】【origin 地址】
```

用户输入：

```text
https://github.com/username/repository.git
```

确认后：

```text
git remote add origin <用户地址>
```

Git 自动保存到：

```text
.git/config
```

以后再次运行：

```text
【远程】【已配置】 <origin>
【远程】【说明】 origin 已保存在 .git/config，本次无需重新输入。
```

#### 关联 Prompt

`docs/prompts/archive/v0.0.7/0008-Git远程配置.md`

> 迁移来源：`docs/changelog/v0.0.6.md`

## LFAA v0.0.6

### #7 GitHub 首次远程仓库检测与中文输出修复

#### 现象

`.git` 初始化已经成功：

```text
Initialized empty Git repository in H:/lfaa/lfaa/.git/
```

随后脚本报：

```text
No such remote 'origin'
```

#### 原因

第一次初始化时本来就不存在 `origin`。

旧脚本直接执行 `git remote get-url origin`，并在 PowerShell 的错误策略下被当成致命错误。

#### 新流程

```text
检查 .git
→ 如无则初始化
→ git remote
→ 若无 origin：添加 origin
→ 若有 origin：检查 URL
→ 检测文件变化
→ git add -A
→ 用户输入 Commit 名称
→ 创建 Commit
→ 检测远程 main
→ pull --rebase（需要时）
→ 用户确认 Push
→ Push
```

#### 中文输出

Git 原始 stdout/stderr 默认不再直接显示。

控制台使用 LFAA 中文状态：

```text
【远程】【新增】
【提交】【完成】
【推送】【进行中】
【完成】【推送成功】
```

真正失败时，原始 Git 技术输出写入：

```text
docs/logs/github-push/
```

便于排查。

#### 关联 Prompt

`docs/prompts/archive/v0.0.6/0007-GitHub远程检测.md`

#### BAT 启动器

`LFAA-GitHub.bat` 与 `LFAA-Sync.bat` 现在只负责启动 PowerShell，
不再自行打印英文成功/失败提示。

控制台可见业务提示统一由 UTF-8 PowerShell 输出。

> 迁移来源：`docs/changelog/v0.0.5.md`

## LFAA v0.0.5

### #6 GitHub 一键推送脚本修复

#### 问题

首次初始化 Git 时，控制台显示 Git 帮助页：

```text
usage: git ...
```

而不是执行：

```text
git init
```

#### 根因

PowerShell 函数使用 `$Args` 作为参数名，与 PowerShell 自动变量冲突。

#### 修复

改为：

```text
Invoke-Git -GitArgs @("init")
```

并按同步脚本设计标准重构整个 GitHub Push 流程。

#### 新流程

```text
治理检查
→ 检测 .git
→ 首次自动 git init
→ 检查 Git Identity
→ 检查 origin
→ 实际 Git 文件变化检测
→ 彩色 ADD/MOD/DEL/REN 列表
→ git add -A
→ staged 文件列表
→ 用户自定义 Commit 名称
→ Commit 确认
→ pull --rebase（如远程已有 main）
→ Push 确认
→ git push
→ 本地 Push 日志
```

#### 关联 Prompt

`docs/prompts/archive/v0.0.5/0006-GitHub推送修复.md`

> 迁移来源：`docs/changelog/v0.0.4.md`

## LFAA v0.0.4

### #5 同步日志目录优化

#### 问题

`.lfaa-local/sync-logs/` 属于隐藏开发目录，不符合 LFAA “文档和开发留痕按 docs 分类可发现”的治理原则。

#### 方案

改为：

```text
docs/logs/workspace-sync/
```

实际运行日志：

```text
*.log
```

作为本机开发留痕：

- 不参与版本镜像 diff；
- 不被同步删除；
- 默认不提交 GitHub。

目录说明 `README.md` 仍属于正式项目文档。

#### 未修改

- config-system 业务
- Agent Runtime
- Rust Execution

#### 关联 Prompt

`docs/prompts/archive/v0.0.4/0005-同步日志目录.md`

> 迁移来源：`docs/changelog/v0.0.3.md`

## LFAA v0.0.3

### #4 稳定工作区同步与 GitHub 推送

#### 问题

版本快照不断递增，但 Git 历史应该只保留在唯一稳定工作区。

同时，简单“覆盖目录”无法回答：

- 新增了什么；
- 修改了什么；
- 删除了什么；
- 是否真的同步完整；
- 是否误删 `.git` 或本地 Secret。

#### 方案

建立：

```text
版本快照
→ LFAA-Sync.bat
→ scripts/windows/lfaa-sync.ps1
→ H:\lfaa\lfaa
→ LFAA-GitHub.bat
→ GitHub
```

同步 PowerShell：

1. 枚举源/目标项目文件；
2. SHA-256 判断真实修改；
3. 列出 ADD/MOD/DEL；
4. 用户确认；
5. 应用变更；
6. 删除普通目标冗余文件；
7. 永久保护 `.git` / 本地数据；
8. 再次镜像校验；
9. 运行治理检查；
10. 保存本地同步日志。

#### 影响范围

开发基础设施与版本发布工作流。

#### 未修改

- 配置系统业务
- Agent Runtime 行为
- Rust Execution 行为

#### 关联 Prompt

`docs/prompts/archive/v0.0.3/0004-稳定工作区同步.md`

> 迁移来源：`docs/changelog/v0.0.2.md`

## LFAA v0.0.2

### #3 导入路径与 Alias 优化

#### 问题

随着 LFAA Monorepo 扩大，如果继续使用：

```text
../../../
../../../../
```

会导致：

- 路径难读；
- 目录重构引发大面积修改；
- AI 难以判断模块边界；
- 容易跨 Package 直接访问内部实现。

#### 方案

定义三层导入：

```text
./
@/
@lfaa/*
```

其中：

- `./`：同目录 / 同小模块；
- `@/`：当前 workspace 的 `src/`；
- `@lfaa/*`：真实 pnpm workspace package。

同时：

- `../../` 及以上禁止；
- `@lfaa/package/src/internal/*` 禁止；
- 新增自动检查脚本；
- TS workspace 增加本地 tsconfig Alias。

#### 修改范围

- 开发规范
- 架构规范
- TS workspace 配置
- 自动治理脚本
- Plan / Progress / Changelog / Release

#### 未修改

- config-system 业务实现
- Agent Runtime 行为
- Rust Broker 行为
- 数据库业务

#### 验证

- `node scripts/import-path-check.mjs`
- `node scripts/governance-check.mjs`
- ZIP 根目录结构检查

#### 关联 Prompt

`docs/prompts/archive/v0.0.2/0003-导入路径规范.md`

> 迁移来源：`docs/changelog/v0.0.1.md`

## LFAA v0.0.1

### #1 项目初始化与架构骨架

#### 问题

项目进入正式开发前，需要先避免：

- 文件乱放；
- 新旧架构混用；
- UI/业务/Runtime 混杂；
- 父子状态互相修改；
- AI 无法判断当前开发进度；
- 多模块同时半成品开发；
- 更新无留痕。

#### 方案

建立：

- LFAA 产品定义；
- 根目录 AI 入口；
- 开发规范；
- 当前架构；
- 历史架构 archive；
- Monorepo 骨架；
- Module README；
- Plan；
- Progress；
- Prompt；
- Changelog；
- Version；
- Governance Check。

#### 新增核心目录

```text
apps/
packages/
crates/
docs/
skills/
plugins/
evals/
scripts/
```

#### 影响

后续所有开发任务。

#### 验证

- Governance 文件完整；
- 模块边界文档完整；
- Rust workspace crate 骨架完整；
- 下一主模块 config-system 已计划。

#### 关联 Prompt

`docs/prompts/archive/v0.0.1/0001-项目基础.md`
