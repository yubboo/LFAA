# LFAA 提示词与任务合同

本文件登记任务的目标、验收条件和修改边界。新任务应从任务索引选择与本轮目标匹配的合同；已完成任务下的合同、实现记录和验证结果是该任务完成时的历史证据，不自动成为当前能力或当前规则。跨任务的当前规则以根 `AGENTS.md`、`开发规范.md` 为准；能力现状以 `docs/系统总体架构.md`、`docs/开发计划.md` 和当前实现为准。任务合同优先于旧阶段草案；实际代码与架构文档需保持一致。

## 任务索引

| 编号 | 任务 | 状态 | 合同 |
|---|---|---|---|
| LFAA-DESKTOP-UPDATE-RELEASE-01 | 将 Windows Electron 更新能力接入 0.1.2，并发布可供 0.1.1 检测的更新 | 已发布（构建、线上清单与安装包核对通过；0.1.1 实机升级未验） | 本文件“LFAA-DESKTOP-UPDATE-RELEASE-01” |
| LFAA-UI-PLUGIN-WORKSPACE-01 | 将设置中心的插件配置重排为分区工作台，分离总览、能力目录、知识库、第三方插件、MCP 与运行诊断，并复用现有设置 Owner | 已实现（UI 包构建、客户端类型检查和差异检查通过；Web 构建指纹检测到并行源码变更而未登记，浏览器目视未验） | 本文件“LFAA-UI-PLUGIN-WORKSPACE-01” |
| LFAA-CLI-WEB-LOCK-RECOVERY-01 | Web 菜单启动时识别当前数据目录的存活 LFAA Web 写锁持有者，结束该 CLI 进程后再启动 | 已实现（PowerShell 语法、数据目录解析、差异检查通过；真实 PID 终止与 Web 重启未运行） | 本文件“LFAA-CLI-WEB-LOCK-RECOVERY-01” |
| LFAA-DESKTOP-ELECTRON-AUTO-UPDATE-01 | 为 Electron 桌面端增加 LFAA 更新清单，并接入自动检查、下载与受控安装 | 代码已接入；清单回归和静态检查通过；Electron NSIS 构建被现有 Host TypeScript 错误阻断；真实 Release 下载、签名和安装升级未验 | 本文件“LFAA-DESKTOP-ELECTRON-AUTO-UPDATE-01” |
| LFAA-DESKTOP-UPDATE-CONSENT-CHECK-01 | 为当前可运行的 Windows Electron 桌面端增加新版本推送、用户选择下载及设置页手动检查 | Windows Electron 源码、定向回归及隔离前端构建通过；真实 Release/桌面安装及 Android、Tauri 未验 | 本文件“LFAA-DESKTOP-UPDATE-CONSENT-CHECK-01” |
| LFAA-DESKTOP-UPDATE-PROMPT-UI-01 | 将 Electron 更新提示从有系统音效的原生消息框改为 LFAA 工作台内的静音、主题适配更新弹窗 | 源码、24 项更新回归、客户端类型检查、UI 包与 Web 构建通过；桌面候选包与实际视觉未验，Host 构建指纹过期 | 本文件“LFAA-DESKTOP-UPDATE-PROMPT-UI-01” |
| LFAA-DESKTOP-UPDATE-DEFER-SUPPRESSION-01 | 用户暂不更新后，本次进程不再因自动或手动检查重复提示同一版本；重启后恢复提示 | 已修复；Electron 更新回归 24/24、语法与差异检查通过；打包桌面端未验 | 本文件“LFAA-DESKTOP-UPDATE-DEFER-SUPPRESSION-01” |
| LFAA-DESKTOP-UPDATE-PACKAGE-REBUILD-01 | 重建包含工作台静音更新提示及进程内暂缓逻辑的 Windows Electron 安装候选，并核验随包运行树 | Windows x64 NSIS 候选构建、包内更新代码核验及 CUA Driver 导入验收通过；实际安装/启动目视未验 | 本文件“LFAA-DESKTOP-UPDATE-PACKAGE-REBUILD-01” |
| LFAA-APP-VERSION-REBASE-01 | 按用户指定的 `0.0.1 → 0.0.2` 更新链重建 Windows Electron `0.0.2` 候选，保留运行中 Web 正式构建目录 | 已实现；版本/更新回归 7/7、24/24，安装器回归 3/3，Windows x64 候选包与随包运行树验收通过；真实安装/启动视觉及外部发布未验 | 本文件“LFAA-APP-VERSION-REBASE-01” |
| LFAA-DESKTOP-UPDATE-RELEASE-003 | 修复桌面更新 404 错误泄露原始 HTTP 响应信息，并将 LFAA 0.0.3 安装包及更新清单发布至 GitHub Release | Windows x64 安装包已构建并本地验收；GitHub 推送与 Release 待执行；真实应用自动升级待验 | 本文件“LFAA-DESKTOP-UPDATE-RELEASE-003” |
| LFAA-DESKTOP-UPDATE-EXPERIENCE-004 | 将 LFAA 桌面更新体验完善为顶部更新入口、版本说明卡片、跳过指定版本及用户 opt-in 的自动下载安装，并构建 `LFAA-0.0.4.exe` | 本地代码、回归、Windows x64 NSIS 包和版本交付目录已验收；真实安装、桌面视觉和升级未验；未上传或发布 | 本文件“LFAA-DESKTOP-UPDATE-EXPERIENCE-004” |
| LFAA-DESKTOP-ELECTRON-BUILD-MENU-01 | 将工作台菜单 3 与 `pnpm run build:win` 接入 Windows Electron 安装包构建；保留 `0.0.4` 已生成事实，之后每次新包递增版本并同步更新日志、产品元数据与更新清单 | 构建入口、版本登记与回归完成；现有 `0.0.4` 安装器匹配核验通过；未生成新包 | 本文件“LFAA-DESKTOP-ELECTRON-BUILD-MENU-01” |
| LFAA-GIT-PUSH-CREDENTIAL-PATH-GUARD-01 | 修复正常推送前历史路径扫描将第一方 `packages/credentials` 目录树节点误判为敏感数据，同时保留其他敏感路径、内容和大对象阻断 | Pester 2/2、完整历史安全门禁通过；正常快进推送至 GitHub main；远端 `update.json` 与 `latest.yml` 均为 0.0.4；应用内手动检测待用户复验 | 本文件“LFAA-GIT-PUSH-CREDENTIAL-PATH-GUARD-01” |
| LFAA-WEB-VERSION-UPDATE-CHECK-01 | 在 Web 设置页显示构建版本，并手动检查官方更新清单、展示更新说明和发布页 | Web 构建、定向回归、TypeScript 与登录态浏览器验收通过；桌面下载安装不属于 Web 验收 | 本文件“LFAA-WEB-VERSION-UPDATE-CHECK-01” |
| LFAA-DESKTOP-ELECTRON-STARTUP-INSTALLER-01 | 修复桌面安装包缺少 CUA Driver 导致启动失败，并补齐 LFAA 安装图标、强制确认、安装详情和桌面快捷方式 | 源码、Windows x64 安装包及随包插件导入验收通过；实际安装交互与快捷方式目视待用户安装确认 | 本文件“LFAA-DESKTOP-ELECTRON-STARTUP-INSTALLER-01” |
| LFAA-DESKTOP-ELECTRON-LICENSE-ENCODING-01 | 修复 Windows NSIS 安装须知中文乱码并重建独立候选安装包 | 源码与构建资源编码核验、Windows x64 NSIS 构建及随包运行树验收通过；安装器界面未安装/目视，候选未签名 | 本文件“LFAA-DESKTOP-ELECTRON-LICENSE-ENCODING-01” |
| LFAA-DESKTOP-ELECTRON-INSTALL-PROGRESS-01 | 修复 NSIS 安装文件复制期间详情区为空，显示实际写入文件，同时保留总进度与静默安装行为 | 已实现；安装器定向回归、Windows x64 NSIS 构建与随包运行树检查通过；实际安装器界面未打开 | 本文件“LFAA-DESKTOP-ELECTRON-INSTALL-PROGRESS-01” |
| LFAA-DESKTOP-DAEMON-INTEGRATION-CLARITY-01 | 将本机 Daemon 明确为桌面安装包内置、随桌面自动启动的独立节点进程，并把沙箱宿主构建命令和启动菜单说明改为真实职责 | 已完成（命令与构建链静态核对、JSON/PowerShell 解析和差异检查通过；未重建安装包或运行远程节点） | 本文件“LFAA-DESKTOP-DAEMON-INTEGRATION-CLARITY-01” |
| LFAA-DESKTOP-ELECTRON-INSTALL-SMOOTHNESS-01 | 减少 Windows NSIS 安装中文件状态行闪烁，保留稳定的安装目标提示，核实目标目录为用户选择的安装目录，并按 `LFAA-版本号` 命名下一安装包 | 稳定提示已接入；定向回归 3/3、Windows x64 NSIS 重建与随包检查通过；安装器 UI 目视未验 | 本文件“LFAA-DESKTOP-ELECTRON-INSTALL-SMOOTHNESS-01” |
| LFAA-HARNESS-PRODUCT-DIRECTION-01 | 明确 LFAA-Harness 自有产品、插件化、多平台目标与纯净发行边界，并检查当前项目偏差 | 开发规范/架构/打包指导已对齐，根 workspace 清单与锁文件入口已修复；桌面默认入口仍待迁移，安装包归档与异盘验收未做 | 本文件“LFAA-HARNESS-PRODUCT-DIRECTION-01” |
| LFAA-AI-INSTRUCTION-CONSISTENCY-01 | 审查 AI 规则与当前能力描述，消除 Agent 委派、Minecraft 核心支持和运行数据事实中的过期冲突 | 规则/提示词/项目说明已对齐；`git diff --check` 和 Minecraft 包构建器通过；pnpm 包装命令因依赖目录清理需交互确认而中止，未绕过 | 本文件“LFAA-AI-INSTRUCTION-CONSISTENCY-01” |
| LFAA-REPO-AI-GUIDES-01 | 参考 DeepWrite 的 AI 助手目录组织、Git 提交和桌面打包流程，为 LFAA 建立一致的仓库指导入口并整理根目录文档位置 | 仅文档、模板与目录变更；不改产品运行代码、设置或构建链；定向路径/差异检查，workspace-preflight 若缺失如实记录 | 本文件“LFAA-REPO-AI-GUIDES-01” |
| LFAA-UI-AI-WORK-REFRESH-STABILITY-01 | 修复 AI Work 刷新时回到底部按钮、输入提示和模型选择器的状态闪烁与横移 | 代码、定向回归、Web 构建和登录态源码预览通过；3000 运行服务未重启，避免停止正在运行的 Minecraft 实例 | 本文件“LFAA-UI-AI-WORK-REFRESH-STABILITY-01” |
| LFAA-UI-AI-MODEL-CARD-01 | 优化 AI Work 模型悬浮卡片与模型专属思考参数，并与设置中心的 AI 账户配置保持同一数据源 | 实现、5/5 定向回归、相关包/控制端/Web 构建通过；登录态浮卡交互待浏览器连接恢复后验收 | 本文件“LFAA-UI-AI-MODEL-CARD-01” |
| LFAA-UI-AI-WORK-OUTPUT-FOCUS-01 | 在外观设置中增加 AI Work 回复区悬停聚焦虚化、同步刻度轨道与滚动条；按截图调整红框命中并保持输入框清晰 | 两块红框并集命中已实现；聊天包构建、差异检查与 5173 登录态页面交互核验通过；连续物理鼠标与帧时间未测 | 本文件“LFAA-UI-AI-WORK-OUTPUT-FOCUS-01” |
| LFAA-UI-AI-WORK-IDLE-BLUR-01 | 将 AI Work 回复区从指针进出虚化改为用户活动空闲计时虚化，并在外观设置中配置启用、空闲时长与虚化强度 | 空闲设置保存阻断已修复：Appearance API Schema 与 Settings Owner 的 Wallpaper Engine ID 格式对齐；定向回归、控制端构建及登录态保存/刷新通过；虚化计时与帧时间本轮未复测 | 本文件“LFAA-UI-AI-WORK-IDLE-BLUR-01” |
| LFAA-SETTINGS-APPEARANCE-WALLPAPER-ID-01 | 修复账户外观设置保存被 Wallpaper Engine 项目 ID 校验错误拒绝的问题，保持 Settings Owner 已支持的项目 ID 格式 | 已完成：真实账户数字项目 ID 导致整份外观提交被错误 Schema 拒绝；修正格式约束，定向回归、控制端构建、登录态保存/刷新和健康检查通过 | 本文件“LFAA-SETTINGS-APPEARANCE-WALLPAPER-ID-01” |
| LFAA-AI-AUTONOMOUS-TOOLS-01 | 将 AI Work 的 Shell 默认绑定到所选项目、收敛活动轨迹中的原始协议数据、让最终回复自然语言转述工具结果、展示可折叠的真实工作轨迹，并按设置中心显式 App 范围发现真实 MCP 工具 | 回复规则与活动轨迹定向回归、AI Work/Agent Loop 包及 Web 构建通过；真实 Provider/浏览器验收待完成 | 本文件“LFAA-AI-AUTONOMOUS-TOOLS-01” |
| LFAA-AI-CONTEXT-REUSE-01 | 优化 AI Work 新任务上下文，避免重复提交历史已完成轮次的内部工具协议 | 定向回归、Agent Loop/Session 与控制端构建、控制端类型检查通过；真实 Provider 用量待验 | 本文件“LFAA-AI-CONTEXT-REUSE-01” |
| LFAA-AI-MEMORY-01 | 在设置中心接入账户隔离的 AI Work 对话记忆、工具聊天控制、后续个性化读取与删除 | 已实现；定向回归与 Web/包构建通过；控制端类型构建受现有错误阻断，Provider/浏览器未验 | 本文件“LFAA-AI-MEMORY-01” |
| LFAA-AI-MEMORY-01-R1 | 加固 AI Work 个性化记忆：输入敏感内容过滤、不把记忆正文写入 Session 模型快照、删除时清理旧快照、回答先结束再异步整理，并在设置中心查看/编辑记忆 | 已实现；记忆定向回归 14/14、9 个受影响包构建及 `git diff --check` 通过；Web/Host 构建受缺失的 account-controller 生成 `.js` 模块阻断，Provider/浏览器未验 | 本文件“LFAA-AI-MEMORY-01-R1” |
| LFAA-UI-AI-WORK-MESSAGE-ACTIONS-01 | 为 AI Work 提问与完整回答增加复制，为回答加入可持久化反馈，并按指定回答的历史前缀创建独立会话分支（支持当前工作空间与符合条件的 AI Worktree） | 本轮代码完成；定向回归和直接包构建通过；Web 构建被既有 SettingsPage 类型错误阻断，登录态交互未通过空白页面验收 | 本文件“LFAA-UI-AI-WORK-MESSAGE-ACTIONS-01” |
| LFAA-UI-AI-WORK-EDIT-MESSAGE-01 | 在 AI Work 中编辑已发送的问题；活动回复先停止并等待结束，再从问题之前的 Session 上下文创建分支并提交修改后的问题 | 已实现；定向回归与相关包构建通过；Web 构建受既有 SettingsPage 未使用变量 TS6133 阻断；登录态交互未验 | 本文件“LFAA-UI-AI-WORK-EDIT-MESSAGE-01” |
| LFAA-LOCAL-GIT-WORKTREES-01 | 为 AI Work 接入账户隔离的本地 Git 状态、隔离 Worktree、真实变更摘要和可确认恢复 | 实现、构建和本地回归通过；目标 Daemon/浏览器验收待完成 | 本文件“LFAA-LOCAL-GIT-WORKTREES-01” |
| LFAA-UI-GIT-CHANGE-EDITOR-01 | 把 AI Work 右侧 Git 变更摘要扩展为可联动的变更审查和安全文本编辑器，支持文件列表、差异视图、编辑保存及截图中的浏览操作 | 实现完成（浏览器验收未验证） | 本文件“LFAA-UI-GIT-CHANGE-EDITOR-01” |
| LFAA-UI-AI-WORK-SIDE-CHAT-01 | 在 AI Work 右侧工具栏增加独立侧边聊天，支持 `/side` 与可配置快捷键；从当前 Session 已记录上下文创建无工具分支，在主任务运行期间提问且不打断主任务 | 实现完成；95 个包构建、Web 构建及 13 项相关回归通过；登录态页面验收待做 | 本文件“LFAA-UI-AI-WORK-SIDE-CHAT-01” |
| LFAA-UI-AI-WORK-SETTINGS-COMPAT-01 | 修复 AI Work 因缺少侧聊快捷键兼容回退及 `AiWorkSideChat` 未注册导致的整页 React 崩溃，复用设置中心默认值并补齐真实 Client 模块装配 | 已修复；目标包/Web 构建、设置兼容回归和登录态四类 AI Work 页面验收通过；运行中控制端侧聊接口返回未找到 | 本文件“LFAA-UI-AI-WORK-SETTINGS-COMPAT-01” |
| LFAA-CLIENT-WORKSPACE-RENDER-RECOVERY-01 | 排查 Minecraft/Connectivity 登录后共享工作区渲染失败，兼容旧版快捷键设置缺项并让错误边界显示安全摘要 | 兼容修复、4/4 定向回归、客户端类型检查和 Web 构建通过；当前登录态工作区尚未验收，具体根因需用错误摘要复核 | 本文件“LFAA-CLIENT-WORKSPACE-RENDER-RECOVERY-01” |
| LFAA-AI-PLAN-MODE-01 | 为 AI Work 增加可持续讨论并经用户批准后执行的计划模式；支持 `/plan`、自然语言意图判断和批准后恢复任务工具 | 已实现；15/15 定向回归、控制端/Web 构建及差异检查通过；真实 Provider、登录态浏览器与 Daemon 验收未运行 | 本文件“LFAA-AI-PLAN-MODE-01” |
| LFAA-AGENT-WORKFLOW-CANVAS-01 | 为 Minecraft 增加可保存、可执行的无限画布 Agent 工作流；图节点复用 Agent Loop 与 Minecraft 工具，任务状态可追踪 | 画布与定义持久化的浏览器验收通过；真实 Provider/Daemon 工作流执行待验 | 本文件“LFAA-AGENT-WORKFLOW-CANVAS-01” |
| LFAA-WORKFLOW-CANVAS-DATAFLOW-01 | 将工作流拆为跨 App 的通用核心、可撤销节点/引擎适配器和共享编辑器；Minecraft 作为首个 App 适配器 | 核心与首个适配器已实现；类型检查、迁移回归、Control Plane/Web 构建及隔离浏览器创建/连线/保存/运行/刷新恢复通过；真实 Minecraft Agent/Provider/Daemon 未验；旁支 Agent API 回归的记忆生成断言失败 | 本文件“LFAA-WORKFLOW-CANVAS-DATAFLOW-01” |
| LFAA-LOCAL-STORAGE-SQLITE-01 | 审查本地数据目录与混合存储，将高频结构化配置改为 SQLite 按记录事务存储，同时保留 JSONL 会话事件与文件型大资源 | 实现、定向回归、类型检查与隔离构建完成；浏览器验收因 5173 未监听且现有服务仍运行旧版而受阻；未改动两个数据根 | 本文件“LFAA-LOCAL-STORAGE-SQLITE-01” |
| LFAA-PROJECT-STATUS-CONFLICTS-01 | 修复项目状态审查发现的界面与路线文档冲突 | 已完成（Web 构建与应用中心浏览器核验通过；Provider/Daemon 端到端未运行） | 本文件“LFAA-PROJECT-STATUS-CONFLICTS-01” |
| LFAA-ROADMAP-ALIGNMENT-01 | 对齐 Harness 当前主线与既有 P0–P7 应用阶段口径 | 已完成（文档对齐；端到端实机验收未运行） | 本文件“LFAA-ROADMAP-ALIGNMENT-01” |
| LFAA-WORKSPACE-AUDIT-02 | 全仓入口、架构残留、备份、日志与交互性能审计修复 | 修复与回归通过；物理清理受阻、逐帧验收待完成 | [当前合同](workspace-audit.md) |
| LFAA-PERFORMANCE-SAFETY-MAINTAINABILITY-01 | 全模块性能与重复逻辑整治，落实性能、安全、可维护性硬规则 | 共享链路优化通过；后续全仓回归 83 通过、1 跳过，登录交互走查完成，桌面与逐帧实测待验 | [合同与检查记录](performance.md) |
| LFAA-MINECRAFT-DEPLOYMENT-02 | 多核心目录与传统面板自动开服闭环 | 代码/回归完成；16 类实机通过，SpongeNeo 与浏览器验收受阻 | [计划、合同与开发记录](minecraft-deployment-plan.md) |
| LFAA-UI-MINECRAFT-DEPLOYMENT-01 | 重排 Minecraft 部署整页的信息层级、配置流程与部署记录，并适配工作区宽度 | 已完成（Web 构建、宽窄屏浏览器布局与核心菜单交互通过） | 本文件“LFAA-UI-MINECRAFT-DEPLOYMENT-01” |
| LFAA-MINECRAFT-PLAYER-CONNECTIVITY-01 | 在开服部署之外建立独立的 LFAA 世界联机中心，呈现内置穿透、自备穿透和房间域名三种路线，并支持外部服务地址手动交接 | 历史范围，已由 LFAA-GAME-CONNECTIVITY-APP-01 扩展为跨游戏 Connectivity App | 本文件“LFAA-MINECRAFT-PLAYER-CONNECTIVITY-01” |
| LFAA-GAME-CONNECTIVITY-APP-01 | 建立独立、跨游戏复用的联机服务 App，隔离游戏部署与联网；提供官方 Provider 适配、自备服务交接和 LFAA 自有房间域名 Relay，支持 TCP/UDP 与真实路由状态 | 当前阶段：管理员可经认证节点任务安装并校验官方 EasyTier Windows x64 运行包；后续按阶段接入真实实例与协作功能 | 本文件“LFAA-GAME-CONNECTIVITY-APP-01” |
| LFAA-UI-MINECRAFT-CORE-LIBRARY-01 | 将部署页核心选择区改为分类导航与核心/版本卡片式操作面板，默认自动匹配下载工件 | Web 构建通过；浏览器可视验收受 CDP 超时阻塞 | 本文件“LFAA-UI-MINECRAFT-CORE-LIBRARY-01” |
| LFAA-UI-MINECRAFT-ONBOARDING-01 | 将部署改为分步引导，并让实例列表更便于查找和执行常用操作 | UI 实现与 Web 构建完成；浏览器交互待验 | 本文件“LFAA-UI-MINECRAFT-ONBOARDING-01” |
| LFAA-EXECUTION-CONTROL-01 | 统一手动/模型开服、本机原生执行与远程节点控制 | 控制链已实现并通过真实节点命令验收；游戏、远程 HTTPS、前端及图形驱动仍待验/接入 | [当前合同](execution-control.md) |
| LFAA-COMPUTER-USE-LOCAL-01 | 将 CUA Driver 本机电脑操控接入 LFAA-Harness Windows 桌面 Profile，支持账户关闭开关、截图视觉反馈及经现有权限合同的有限鼠标键盘操作 | 源码接入、隔离回归、Control Plane/Web 构建通过；真实 Windows 桌面、Provider 与打包桌面验收待完成 | 本文件“LFAA-COMPUTER-USE-LOCAL-01” |
| LFAA-COMPUTER-USE-SETTINGS-UI-RECOVERY-01 | 修复进入“设置中心 > 电脑操控”导致设置页崩溃的问题，并保证导航只显示/编辑 Agent 能力开关，不探测或执行桌面动作 | 已修复（设置回归、UI 包构建、Web 构建通过；登录态页面/真实桌面未验） | 本文件“LFAA-COMPUTER-USE-SETTINGS-UI-RECOVERY-01” |
| LFAA-HARNESS-CLEANUP-01 | 固定大模型驱动核心、硬编码与新旧代码规则，清理迁移残留并整理节点入口 | 原任务规则与清理快照见 harness-cleanup.md；当时的 Agent 状态已由后续可执行顺序子 Agent 实现更新，当前能力/待办见系统架构、开发计划和 harness-agent-delivery.md | 本文件“LFAA-HARNESS-CLEANUP-01” |
| LFAA-HARNESS-DSH-PACKAGES-01 | 按 DSH 实际包树重构并迁移现有项目，保留全部同名目录占位 | 源码迁移与构建完成；隔离运行通过；5 项既有测试失败及未验项目详见交付记录 | 本文件“LFAA-HARNESS-DSH-PACKAGES-01” |
| LFAA-HARNESS-DSH-CAPABILITY-PARITY-01 | 将 DSH 非界面能力纳入 LFAA 优先级路线，并按 LFAA 唯一责任归属适配和优化 | 路线登记完成；LFAA 场景筛选后的 P0 已完成；P1–P4 仍按路线待实施，不宣称 DSH 全量能力已复刻 | 本文件“LFAA-HARNESS-DSH-CAPABILITY-PARITY-01” |
| LFAA-HARNESS-DSH-P0-01 | 完成基于 LFAA 场景筛选的 DSH 参考 P0 能力 | 已完成（仅 LFAA 场景筛选范围）；审计 61 个上游包作为参考清单，不要求逐包复刻；凭据/交互插件、Storage Hub/JSON/SQLite、Typert 真实账户 Remote、Session 耐久性及插件生命周期已有实现/回归；DSH 专属格式、无消费者的 Typert 双向流与 P2 执行提供方明确暂缓；90 项回归、95 个能力包构建、Host/Web 隔离构建和当前未登录页面验收通过；用户 Edge 登录态、Provider/Daemon/桌面/OS 沙箱未验 | 本文件“LFAA-HARNESS-DSH-P0-01” |
| LFAA-HARNESS-DSH-CORE-01 | 将 DSH `packages/core` 的核心职责适配到 LFAA-Harness，复用现有会话、设置、权限与执行 Owner，并记录 MIT 来源 | 核心适配与 8 个直接包构建完成；Host/Client 类型检查通过；测试与真实运行验收未做；PTC 隔离执行未接入 | 本文件“LFAA-HARNESS-DSH-CORE-01” |
| LFAA-HARNESS-PLUGIN-CORE-01 | 建设模型驱动的通用能力发现、理解、按应用接入、真实验证与调用闭环，覆盖 Plugins、Skills、Prompts、Tools、MCP 与 Minecraft 插件/模组 | 进行中（Wallpaper Engine 上游 Host/Client UI 与右侧栏适配已接入；官方兼容 revision 检查/替换已实现；真实浏览器、媒体和跨桌面验收未完成） | 本文件“LFAA-HARNESS-PLUGIN-CORE-01” |
| LFAA-SESSION-KERNEL-01 | 依据 DSH `core/session` 建立 LFAA 自有事件溯源 Session 内核，复用现有会话、认证、持久化与工作台 Owner | 内核及 Agent Loop 接线完成；Session/JSONL 9 项、File Storage 6 项、Agent Runtime 1 项分项回归通过；3 个直接包构建、Host 类型检查和 Control Plane 构建通过；workspace-preflight 不存在；Provider/浏览器/桌面/Daemon 未验 | 本文件“LFAA-SESSION-KERNEL-01” |
| LFAA-WALLPAPER-ENGINE-FULL-DSH-01 | 按固定 DSH 上游源码完整接入 Wallpaper Engine 可移植功能，在 LFAA 对应 Settings、Workbench 和 Harness Profile Owner 落地 | 官方插件已在 LFAA Web Profile 启用；原生 Settings 与右侧工作台面板通过浏览器验收；当前 Client 报告所选壁纸“播放中”，但 AI Work 主面板仍黑底 | 本文件“LFAA-WALLPAPER-ENGINE-FULL-DSH-01” |
| LFAA-WALLPAPER-ENGINE-UI-COMPLETE-01 | 保留上游壁纸插件原生界面与能力，接入 LFAA 右侧图标入口/展开行为，并让插件 UI 继承 LFAA 外观设置 | Settings 原生分区、壁纸选择器、右侧图标/抽屉及外观与播放页通过真实 Web Profile 验收；播放器报告“播放中”，工作区背景可见性待修复/复验 | 本文件“LFAA-WALLPAPER-ENGINE-UI-COMPLETE-01” |
| LFAA-WALLPAPER-ENGINE-END-TO-END-01 | 修复 Wallpaper Engine 从 Profile Host 到浏览器 Client、插件 API 和原生 UI 的端到端请求链，确保安装启用后完整上游功能可用 | 首次载入、根画布与 Scene 实时渲染已在当前 3000 登录浏览器验收；实时 Scene 帧策略见 LIVE-SCENE-01；桌面打包及硬件逐帧测量未验 | 本文件“LFAA-WALLPAPER-ENGINE-END-TO-END-01” |
| LFAA-DSH-SLOT-EMPTY-STATE-01 | 为 DSH 设置区与右侧插件面板补齐通用空插槽反馈和插件状态入口，避免插件内容缺失时整页空白 | 已实现（DSH Slot fallback 定向回归及相关 Client/Web 构建通过；浏览器插件运行态未验） | 本文件“LFAA-DSH-SLOT-EMPTY-STATE-01” |
| LFAA-WALLPAPER-ENGINE-UPSTREAM-UPDATES-01 | 让固定官方仓库的兼容上游版本通过提交级来源核验后复用 DSH 适配，不因正常上游发版改写 LFAA UI 或逐次硬编码版本/提交 | Runtime 快照校验、官方同源停用态版本替换和定向回归通过；真实新版本未验 | 本文件“LFAA-WALLPAPER-ENGINE-UPSTREAM-UPDATES-01” |
| LFAA-WALLPAPER-ENGINE-COMPOSITING-01 | 修复 LFAA 根画布与 AI Work 面板遮挡插件壁纸层的问题，并让主面板读取设置中心现有透明度和模糊映射 | CSS 修复后在真实 Web 页面确认壁纸层可见，AI Work 面板计算样式读取当前设置中心令牌；未验动态 Scene 播放 | 本文件“LFAA-WALLPAPER-ENGINE-COMPOSITING-01” |
| LFAA-WALLPAPER-ENGINE-APPEARANCE-BOOT-01 | 修复 Wallpaper Engine 首次进入需刷新及窄屏闪屏，保持 LFAA/插件各自外观 Owner | 首个深层路由冷加载不需二刷；1600/938/640 视口和 640px 常规↔AI Work 切换中实时壁纸保持可见；GPU 帧时间/物理闪屏未测 | 本文件“LFAA-WALLPAPER-ENGINE-APPEARANCE-BOOT-01” |
| LFAA-WALLPAPER-ENGINE-LIVE-SCENE-01 | 保留官方 Wallpaper Engine Scene 大型媒体包的实时传输能力，并在 LFAA 固定来源适配器中限制媒体服务边界 | 适配器关闭独立媒体监听，只对 scene-live/index.html 设 SAMEORIGIN；Scene 在 3000 同源 iframe 达到 first-frame-ok/live-ready，诊断报 30 FPS；定向回归与控制端构建通过 | 本文件“LFAA-WALLPAPER-ENGINE-LIVE-SCENE-01” |
| LFAA-PLUGIN-INSTALL-ACTIVATE-01 | 让对话中的插件安装按 DSH 默认行为完成兼容运行时启用与 Owner 回读核验，失败时返回真实未就绪状态 | 安装激活和跨重启恢复已实现；定向回归 15/15、Plugin Manager/Capability Install 包构建、Control Plane 构建通过；真实 Provider/登录浏览器验收未完成 | 本文件“LFAA-PLUGIN-INSTALL-ACTIVATE-01” |
| LFAA-AI-NATURAL-LANGUAGE-PLUGIN-INSTALL-01 | 让内置 AI Work 能从一句话和直接 GitHub 插件地址自主调用 LFAA 生命周期 Owner；同源已安装插件只启用并回读，不重复安装或更新 | 工具自主规划与 Owner 清单回读已实现；定向回归、包构建和 Host 类型检查通过；真实 Provider/登录浏览器验收待做 | 本文件“LFAA-AI-NATURAL-LANGUAGE-PLUGIN-INSTALL-01” |
| LFAA-SETTINGS-NOTIFICATION-COMPLETION-SOUND-01 | 让 AI Work 回复完成通知在工作台聚焦时也播放设置中心选定的提示音 | 已修复（前端构建和目标差异检查通过；浏览器/桌面播放待验） | 本文件“LFAA-SETTINGS-NOTIFICATION-COMPLETION-SOUND-01” |
| LFAA-AUTH-PASSKEY-01 | 为 LFAA 登录增加可选通行密钥并提供安全管理 | 代码已接入（前端构建受既有 SteamCMD 类型错误阻塞，实机待验） | 本文件“LFAA-AUTH-PASSKEY-01” |
| LFAA-MINECRAFT-APPCONTAINER-ENV-01 | 修复 Minecraft AppContainer 启动因 Windows 子进程环境块错误返回 Win32 203 | 代码修正完成（Sandbox Host 构建通过；实例启动待实机复验） | 本文件“LFAA-MINECRAFT-APPCONTAINER-ENV-01” |
| LFAA-PORTABLE-DATA-ISOLATION-01 | 曾将可移动盘数据隔离到各电脑本机 | 历史实现已被更新后的数据归属规则取代：固定盘使用用户级目录，可移动盘数据跟随项目目录 | 本文件“LFAA-PORTABLE-DATA-ISOLATION-01” |
| LFAA-FILE-MANAGER-RECOVERY-01 | 修正文件管理的离线节点状态、空目录误报与节点恢复控制 | 实现完成（前端构建通过；浏览器和 Daemon 验收待做） | 本文件“LFAA-FILE-MANAGER-RECOVERY-01” |
| LFAA-FILE-MANAGER-HOME-01 | 修正文件管理左侧房子按钮误返回来源子页面，改为来源 App/模式首页 | 实现和 Web 构建通过；浏览器点击验收受 Edge 连接故障阻塞 | 本文件“LFAA-FILE-MANAGER-HOME-01” |
| LFAA-UI-WORKMODE-HOME-01 | 工作区房子按钮返回当前应用与所选工作模式首页，应用中心入口保持原路由 | 已修正（路由静态核对；构建未运行） | 本文件“LFAA-UI-WORKMODE-HOME-01” |
| LFAA-UI-RECENT-SESSIONS-NAV-01 | 将左一“最近会话”接入现有跨 App AI Work 会话查询与打开流程 | 实现完成（前端构建与差异检查通过；登录态交互待验） | 本文件“LFAA-UI-RECENT-SESSIONS-NAV-01” |
| LFAA-UI-APP-CENTER-NAV-01 | 左一提供应用中心直达入口；应用切换统一从应用中心进行，左二只保留当前应用导航 | 实现完成（前端构建与差异检查通过；浏览器目视待验） | 本文件“LFAA-UI-APP-CENTER-NAV-01” |
| LFAA-UI-APP-CONTEXT-01 | 切换应用时保留各自 AI Work 会话与未发送草稿，并明确当前应用 | 实现完成（交互未验收） | 本文件“LFAA-UI-APP-CONTEXT-01” |
| LFAA-AI-WORKSPACE-PROJECTS-01 | 在 AI Work 中按真实主机目录管理项目，并将会话与项目文件范围关联 | 定向回归、全仓构建、v38 迁移与 API 路由核实通过；登录态 UI 待验 | 本文件“LFAA-AI-WORKSPACE-PROJECTS-01” |
| LFAA-UI-APP-CENTER-ENTRY-01 | 将应用中心设为进入与切换 App 能力的唯一交互入口，拦截无应用中心来源的 App 深链，并让跨 App 会话/快捷入口先回到应用中心 | 已实现（Web 构建、差异检查与登录态浏览器入口核验通过） | 本文件“LFAA-UI-APP-CENTER-ENTRY-01” |
| LFAA-UI-SETTINGS-RESPONSIVE-01 | 按设置正文实际宽度完善设置中心响应式排版 | 已修复（Web 构建、分屏/宽屏/窄屏浏览器目视及横向溢出检查通过） | 本文件“LFAA-UI-SETTINGS-RESPONSIVE-01” |
| LFAA-UI-WORKBENCH-CHROME-PERSISTENCE-01 | 模式切换时保留用户主动设置的应用侧栏收起状态 | 已修复（前端构建通过；浏览器交互待验） | 本文件“LFAA-UI-WORKBENCH-CHROME-PERSISTENCE-01” |
| LFAA-UI-AI-PROVIDER-LOADING-01 | AI Work 加载 Provider 时不短暂误报未配置 | 已修复（Vite 构建通过；完整构建受 TypeScript 错误阻塞；浏览器交互待验） | 本文件“LFAA-UI-AI-PROVIDER-LOADING-01” |
| LFAA-UI-MODULE-NOTIFICATIONS-01 | 优化应用侧栏顶栏的左右布局，并提供真实 AI Work 完成通知卡片 | 已完成（构建通过；浏览器目视待验） | 本文件“LFAA-UI-MODULE-NOTIFICATIONS-01” |
| LFAA-UI-SETUP-REMINDER-PERFORMANCE-01 | 修复首次配置提醒弹窗打开卡顿，避免全屏实时模糊和工作台整树重渲染 | 复查中（用户反馈仍卡；运行版本未核实） | 本文件“LFAA-UI-SETUP-REMINDER-PERFORMANCE-01” |
| LFAA-PERFORMANCE-ROOT-CAUSE-01 | 定位并修复设置中心与整个项目普遍卡顿 | 调查中（待运行时性能证据；此前误判的遮罩样式已恢复） | 本文件“LFAA-PERFORMANCE-ROOT-CAUSE-01” |
| LFAA-SETTINGS-MINECRAFT-OWNER-01 | 将 Minecraft 运行配置从 AI Runtime 分类和存储中拆分 | 实现、构建与回归通过；运行时未重启 | 本文件“LFAA-SETTINGS-MINECRAFT-OWNER-01” |
| LFAA-STEAMCMD-CONFIG-INSTALL-01 | 分离 SteamCMD 专项配置与应用存储，并让在线安装可独立选择目标节点 | 合同已登记，待实现 | 本文件“LFAA-STEAMCMD-CONFIG-INSTALL-01” |
| LFAA-APP-SETTINGS-SCOPE-01 | 共用账户偏好与三种 App 的业务配置分域，并让现有 App 配置范围互不串改 | 已实现（前端构建通过；浏览器范围切换待验） | 本文件“LFAA-APP-SETTINGS-SCOPE-01” |
| LFAA-UI-WRITING-SIDEBAR-01 | 将写作常规模式的作品与章节导航移入应用侧栏空白区，移除编辑页常驻导航列 | 已实现（前端 TypeScript/Vite 构建通过；浏览器目视待验） | 本文件“LFAA-UI-WRITING-SIDEBAR-01” |
| LFAA-UI-WRITING-NO-TERMINAL-01 | 写作 App 隐藏不使用的共享节点任务输出面板，不影响其他 App 的终端入口与状态 | 已实现（Web 构建与差异检查通过；浏览器目视受 Edge 连接器故障阻塞） | 本文件“LFAA-UI-WRITING-NO-TERMINAL-01” |
| LFAA-WRITING-VOLUME-GROUPING-01 | 在现有写作作品目录内增加卷分组，保留章节数据并支持在指定卷中新建章节 | 实现完成（v27 迁移专项通过；浏览器交互待验） | 本文件“LFAA-WRITING-VOLUME-GROUPING-01” |
| LFAA-WRITING-AGENT-PLACEMENT-01 | 让写作 Agent 按自然语言目标将内容精确写入当前作品大纲或章节正文，并经逐项审批与业务服务持久化 | 已接入（前后端构建通过；Provider 工具调用和浏览器交互待验） | 本文件“LFAA-WRITING-AGENT-PLACEMENT-01” |
| LFAA-DEEPWRITE-WRITING-SKILLS-01 | 参考 DeepWrite 方法，增强写作 Agent 的按需 Skills、自然语言目标提示与唯一锚点编辑工具 | 实现完成（server 类型检查/构建和差异检查通过；Provider 交互待验） | 本文件“LFAA-DEEPWRITE-WRITING-SKILLS-01” |
| LFAA-WRITING-PROMPT-LIBRARY-01 | 整理外部 14 份网文提示词，优化后加入写作工作区并按需供模型读取 | 已接入（相关包构建、Host 类型检查和差异检查通过；模型交互待验） | 本文件“LFAA-WRITING-PROMPT-LIBRARY-01” |
| LFAA-DEEPWRITE-WRITING-INTEGRATION-01 | 按 LFAA 既有 Owner 分阶段接入 DeepWrite 的作品资料、审阅式 Agent 写作、专职流程与分析能力 | P1–P5 已实现；定向回归 5/5、客户端类型检查与 Web 构建通过；折叠侧栏重新进入验收通过；真实 ZIP 文件交互、Provider 与 DeepWrite 客户端互操作待实测 | 本文件“LFAA-DEEPWRITE-WRITING-INTEGRATION-01” |
| LFAA-APP-SANDBOX-01 | 将应用作为安全范围、模式作为应用内交互方式，并为当前 Minecraft Daemon 接入 fail-closed Windows OS 沙盒 | 实现代码已接入（Windows 实机验收待做） | 本文件“LFAA-APP-SANDBOX-01” |
| LFAA-UI-WORKBENCH-DEFAULTS-01 | 稍微收窄工作台左右栏默认展开宽度，并让右侧工具栏默认收起 | 已完成（前端构建通过；浏览器目视待验） | 本文件“LFAA-UI-WORKBENCH-DEFAULTS-01” |
| LFAA-UI-WORKBENCH-SNAP-01 | 修复工作台左右栏吸附收起/展开残影、拖尾及过程中的横向滚动条 | 已修复（Vite 构建通过；TypeScript 检查被其他文件错误阻塞；浏览器实拖待验） | 本文件“LFAA-UI-WORKBENCH-SNAP-01” |
| LFAA-UI-WORKBENCH-SNAP-02 | 修复按住鼠标从吸附收起反向拉出时侧栏展开突跳、手感卡顿 | 实现完成（前端 TypeScript/Vite 构建通过；浏览器实拖待验） | 本文件“LFAA-UI-WORKBENCH-SNAP-02” |
| LFAA-UI-WORKBENCH-SNAP-03 | 统一设置和应用工作区左右侧栏及底部终端的拉伸、吸附收起与反向展开动效 | 实现完成（前端 TypeScript/Vite 构建通过；浏览器实拖待验） | 本文件“LFAA-UI-WORKBENCH-SNAP-03” |
| LFAA-UI-SIDEBAR-GLASS-STABILITY-01 | 修复左侧栏悬停预览和拉伸期间透明度/背景模糊突变 | 实现完成（前端 TypeScript/Vite 构建通过；浏览器悬停与实拖待验） | 本文件“LFAA-UI-SIDEBAR-GLASS-STABILITY-01” |
| LFAA-UI-LEFT-PREVIEW-HOVER-STABILITY-01 | 修复左侧栏收起预览 hover 移出时末尾突隐 | 移出动效已调优（Web 构建、差异检查通过；浏览器 hover 待实测） | 本文件“LFAA-UI-LEFT-PREVIEW-HOVER-STABILITY-01” |
| LFAA-UI-WORKBENCH-SWAP-CONTROL-01 | 让交换按钮仅在鼠标移入右侧拉伸位置时显示，移出后隐藏 | 已修复（前端构建通过；浏览器交互待验） | 本文件“LFAA-UI-WORKBENCH-SWAP-CONTROL-01” |
| LFAA-SETTINGS-GLOBAL-NAV-01 | 将应用工作区左侧全局导航轨复用到设置中心，统一两处导航外壳 | 已完成（TypeScript/Vite 构建通过；浏览器目视待验） | 本文件“LFAA-SETTINGS-GLOBAL-NAV-01” |
| LFAA-SETTINGS-RETURN-CONTEXT-01 | 设置中心全局导航房子和侧栏返回均回到进入设置前的路由 | 已修复（TypeScript/Vite 构建通过；浏览器交互待验） | 本文件“LFAA-SETTINGS-RETURN-CONTEXT-01” |
| LFAA-UI-COMPOSER-PANE-SWAP-01 | 按 Codex 对话输入框的交互层级优化 AI Work 输入区，并允许桌面工作台交换中间区与右侧工具资源栏 | 已完成（前端构建通过；浏览器目视待验） | 本文件“LFAA-UI-COMPOSER-PANE-SWAP-01” |
| LFAA-KNOWLEDGE-LIBRARY-01 | 增加账户隔离的 Markdown 知识/Skill/Prompt/专家资料库，支持低 token 按需检索、上传、对话沉淀和受控本地项目链接，并复用 MCP 搜索 | 已实现（定向回归 2/2、Host/Client 类型检查、11 个相关包构建通过；登录界面、Provider 与实时 MCP 待验） | 本文件“LFAA-KNOWLEDGE-LIBRARY-01” |
| LFAA-UI-AI-PERMISSION-POPOVER-01 | 将 AI Work 权限模式菜单收敛为紧凑弹层，展示 LFAA 现有三种权限模式 | 已按反馈修订（前端构建与差异检查通过；浏览器目视待验）；执行语义以 `LFAA-AI-PERMISSION-MODE-EXECUTION-02` 为准 | 本文件“LFAA-UI-AI-PERMISSION-POPOVER-01” |
| LFAA-SETTINGS-APPEARANCE-DEFAULTS-01 | 对齐外观设置默认值与工作区 CSS 兜底值，保留各组件独立外观 | 已完成（前端与 server 构建通过；背景路由映射静态核对；浏览器目视待验） | 本文件“LFAA-SETTINGS-APPEARANCE-DEFAULTS-01” |
| LFAA-UI-CENTER-SCROLLBAR-HIDE-01 | 隐藏应用工作区中间内容区的滚动条，同时保留原有滚动能力 | 已修复（前端构建通过；浏览器目视与滚动交互待验） | 本文件“LFAA-UI-CENTER-SCROLLBAR-HIDE-01” |
| LFAA-UI-SCROLLBAR-APPEARANCE-01 | 统一全站可见滚动条视觉并跟随外观设置主题、强调色与对比度 | 已实现（Web 构建与差异检查通过；浏览器目视待验） | 本文件“LFAA-UI-SCROLLBAR-APPEARANCE-01” |
| LFAA-UI-AI-SCROLL-FOLLOW-01 | 修复 AI Work 流式回复跟随丢失并保留主动上滚，消除回到底部时的瞬间跳动 | 续修实现、定向回归与 Web 构建通过；真实浏览器滚动待测 | 本文件“LFAA-UI-AI-SCROLL-FOLLOW-01” |
| LFAA-UI-AI-STREAM-CARET-COMPACT-01 | 修复 AI Work 流式光标错位并收紧回复活动状态与交互卡之间的留白 | 聊天包与 Web 构建、12 项滚动回归、CSS 解析及差异检查通过；浏览器目视待验 | 本文件“LFAA-UI-AI-STREAM-CARET-COMPACT-01” |
| LFAA-UI-AI-CONVERSATION-ANCHOR-SPACING-01 | 让 AI Work 会话导航随提问数量动态增长并等距排列，支持整轨跟随、卡片暂停、平滑阶梯反馈和真实锚点跳转 | 19 项定向回归、聊天包和完整 Web 构建通过；登录态浏览器目视待验 | 本文件“LFAA-UI-AI-CONVERSATION-ANCHOR-SPACING-01” |
| LFAA-UI-AI-CONVERSATION-ANCHOR-INTERACTION-02 | 修复 AI Work 对话锚点卡片停留、单项强调色、手形光标、可点击命中区和横杠粗细一致性 | 实现与定向验证通过；IAB 登录态悬停样式核对通过；物理鼠标帧时间未测 | 本文件“LFAA-UI-AI-CONVERSATION-ANCHOR-INTERACTION-02” |
| LFAA-UI-AI-STOP-BUTTON-ACCENT-01 | 将 AI Work 运行中的停止按钮改为设置强调色圆钮与方形停止图标 | 已实现（聊天包/Web 构建、CSS 解析和目标差异检查通过；登录态浏览器配色目视待验） | 本文件“LFAA-UI-AI-STOP-BUTTON-ACCENT-01” |
| LFAA-UI-MODE-TOGGLE-RESPONSIVE-01 | 响应式中间工作区将常规 / AI Work 模式切换栏居中 | 已实现（Web 构建及本地浏览器目视通过；窄视口实测待做） | 本文件“LFAA-UI-MODE-TOGGLE-RESPONSIVE-01” |
| LFAA-UI-AI-APPROVAL-QUICK-ACTIONS-01 | 在 AI Work 审批提醒中直接批准本次操作或拒绝，免去先打开会话的步骤 | 已实现；交互入口由 `LFAA-UI-AI-INTERACTION-DOCK-01` 收敛并替代 | 本文件“LFAA-UI-AI-APPROVAL-QUICK-ACTIONS-01” |
| LFAA-UI-AI-INTERACTION-DOCK-01 | 将审批与模型澄清统一为输入框上方的单一交互栏 | 已实现（Web 构建通过；控制端构建受无关工作区包类型错误阻塞；真实 Provider 浏览器交互待验） | 本文件“LFAA-UI-AI-INTERACTION-DOCK-01” |
| LFAA-UI-AI-RUN-REFRESH-01 | 修复 AI Work 刷新恢复时误报重新处理，并显示持久化的真实等待时长 | 已修复（定向回归 4/4、客户端性能回归 13/13、聊天包与 Web 构建通过；登录态刷新待实测） | 本文件“LFAA-UI-AI-RUN-REFRESH-01” |
| LFAA-UI-AI-ANCHOR-PREVIEW-01 | 收紧 AI Work 对话锚点纵向间距与鼠标悬浮预览卡宽度 | 已修复（定向回归 12 项、完整 Web 构建、登录态页面间距目视核验通过） | 本文件“LFAA-UI-AI-ANCHOR-PREVIEW-01” |
| LFAA-UI-AI-DRAFT-PERSISTENCE-01 | 审查刷新后的主要工作状态，并让 AI Work 未发送草稿可恢复 | 草稿恢复已实现（2 项定向回归、Web 构建通过；登录态浏览器刷新待验）；文件编辑草稿与部署向导草稿列为后续专项审查 | 本文件“LFAA-UI-AI-DRAFT-PERSISTENCE-01” |
| LFAA-UI-CLIENT-PERSISTENCE-CORE-01 | 建立可复用的浏览器端持久化与防抖恢复能力 | 共享层实现、5 项定向回归与 Web 构建通过；登录态刷新待验 | 本文件“LFAA-UI-CLIENT-PERSISTENCE-CORE-01” |
| LFAA-UI-CENTER-RESIZE-REFLOW-01 | 中间列缩窄时让 Minecraft 卡片按实际可用宽度排版，减少内容跳动 | 已完成（Vite 构建通过；完整构建被无关 TypeScript 错误阻塞；浏览器拖拽待验） | 本文件“LFAA-UI-CENTER-RESIZE-REFLOW-01” |
| LFAA-UI-WORKBENCH-RESPONSIVE-02 | 优化 AI Work 窄屏左右栏联动、右栏拖拽和中心区最小宽度 | 实现完成，构建/定向回归通过；窄 Dock 和拖拽已在 5173 实测 | 本文件“LFAA-UI-WORKBENCH-RESPONSIVE-02” |
| LFAA-UI-WORKBENCH-REFLOW-STABILITY-01 | 修复左右菜单和底部终端开合时中间内容闪动、跳动 | 实现完成（静态核对；构建与浏览器目视待验） | 本文件“LFAA-UI-WORKBENCH-REFLOW-STABILITY-01” |
| LFAA-P4-MINECRAFT-MVP-01 | 按用户优先级先完成 Minecraft 管理 MVP，并为后续应用保留统一工作台与 AI Runtime 边界 | 进行中 | 本文件“LFAA-P4-MINECRAFT-MVP-01” |
| LFAA-MINECRAFT-CONTROL-CENTER-01 | 将 Minecraft 总览整理为真实状态监控卡片中心，并补齐控制节点页面与分类菜单 | 实现完成（前端构建、Manager 健康与 Daemon 心跳通过；浏览器目视验收待做） | 本文件“LFAA-MINECRAFT-CONTROL-CENTER-01” |
| LFAA-MINECRAFT-TASK-RECOVERY-01 | 修复 SQLite 迁移测试版本断言，并为 Minecraft Daemon 任务加入心跳租约和中断恢复 | 已完成（测试与完整构建通过；真实 Minecraft 未验） | 本文件“LFAA-MINECRAFT-TASK-RECOVERY-01” |
| LFAA-P1-01-05 | 完成依赖与持久化、server 基础、应用中心、前后端健康状态闭环、账户登录与权限基础 | 进行中 | 本文件“LFAA-P1-01-05” |
| LFAA-P1-01-07 | 提供根目录并行开发启动命令和 Windows 单窗口一键启动入口 | 已完成 | 本文件“LFAA-P1-01-07” |
| LFAA-DEV-STARTUP-RESILIENCE-01 | 避免旧服务占端口时误启新实例，并让 Daemon 等待控制端就绪 | 实现完成（代码静态检查；Windows 启动实测待验） | 本文件“LFAA-DEV-STARTUP-RESILIENCE-01” |
| LFAA-UI-MODULE-CANVAS-01 | 让所有应用模式的中间工作区铺满可用区域，并让 AI Work 中间区只显示对话 | 已完成（浏览器目视待验） | 本文件“LFAA-UI-MODULE-CANVAS-01” |
| LFAA-UI-WRITING-AI-CENTER-01 | 让写作 AI Work 空状态沿用共享中间聊天区样式，并完整说明外观设置影响范围 | 实现完成（前端构建与差异检查通过；登录后浏览器目视待验） | 本文件“LFAA-UI-WRITING-AI-CENTER-01” |
| LFAA-UI-AI-WORK-CANVAS-BACKGROUND-01 | 移除 AI Work 消息画布重复的整面遮罩和模糊，让中间区透出工作台统一壁纸 | 实现完成（前端构建与静态映射核对通过；登录后目视待验） | 本文件“LFAA-UI-AI-WORK-CANVAS-BACKGROUND-01” |
| LFAA-UI-HOME-RESPONSIVE-01 | 收紧应用中心桌面留白并适配矮窗口 | 已完成（浏览器目视待验） | 本文件“LFAA-UI-HOME-RESPONSIVE-01” |
| LFAA-UI-APP-CENTER-POLISH-01 | 优化应用中心主次层级、入口卡片和重复状态信息 | 已完成（Web 构建、差异检查及 3/2/1 列登录态目视通过） | 本文件“LFAA-UI-APP-CENTER-POLISH-01” |
| LFAA-UI-APP-CENTER-POLISH-02 | 优化应用中心标题、专业应用卡片层级、状态可读性与模式按钮触达 | 已实现（Web 构建、差异检查通过；浏览器目视受本机服务状态限制） | 本文件“LFAA-UI-APP-CENTER-POLISH-02” |
| LFAA-SETTINGS-AI-GROUP-SPACING-01 | 修正 AI 账户区与推理参数标题的间距 | 已完成（浏览器目视待验） | 本文件“LFAA-SETTINGS-AI-GROUP-SPACING-01” |
| LFAA-UI-PERF-SETTINGS-01 | 修复设置中心主题闪烁与重复加载，并优化按需读取 | 已完成 | 本文件“LFAA-UI-PERF-SETTINGS-01” |
| LFAA-UI-PERF-SETTINGS-02 | 降低设置中心长分类滚动时的布局与绘制负担 | 已完成（登录后滚动帧采样待实测） | 本文件“LFAA-UI-PERF-SETTINGS-02” |
| LFAA-UI-SETTINGS-PRELOAD-01 | 预热设置页代码，减少首次进入时的等待与闪动 | 已完成（浏览器冷启动目视待验） | 本文件“LFAA-UI-SETTINGS-PRELOAD-01” |
| LFAA-UI-REFRESH-PERSISTENCE-01 | 修复刷新期间的登录闪现并记住设置分类与滚动位置 | 已完成（浏览器刷新实测待验） | 本文件“LFAA-UI-REFRESH-PERSISTENCE-01” |
| LFAA-UI-SESSION-RESTORE-STARTUP-01 | 缩短已登录页面刷新的工作台恢复链路，避免额外串行读取初始化状态 | 已修复（定向回归 3/3、Web 类型检查与构建通过；登录态刷新耗时待实测） | 本文件“LFAA-UI-SESSION-RESTORE-STARTUP-01” |
| LFAA-UI-SETTINGS-REFRESH-PRELOAD-01 | 直达刷新设置中心时并行预热工作台与设置页代码，消除串行加载回退 | 已修复（定向回归 4/4、Web 类型检查与构建通过；登录态刷新目视与网络瀑布待验） | 本文件“LFAA-UI-SETTINGS-REFRESH-PRELOAD-01” |
| LFAA-UI-SCROLL-RESTORATION-SHARED-01 | 统一恢复设置与各功能页面的滚动位置 | 实现完成（构建通过；浏览器刷新验收待验） | 本文件“LFAA-UI-SCROLL-RESTORATION-SHARED-01” |
| LFAA-SETTINGS-AUTOSAVE-01 | 让设置中心所有已接入的账户设置自动持久化 | 修复完成（外观字段白名单已对齐；前后端构建通过；登录后刷新实测待验） | 本文件“LFAA-SETTINGS-AUTOSAVE-01” |
| LFAA-SETTINGS-BACKGROUND-RENDER-01 | 修复设置中心所选背景被内部工作台与侧栏底色遮挡 | 已修复（前端构建通过；浏览器目视待验） | 本文件“LFAA-SETTINGS-BACKGROUND-RENDER-01” |
| LFAA-WORKSPACE-BACKGROUND-UNIFICATION-01 | 统一设置中心、应用常规与 AI Work 的背景绘制及遮罩透明度 | 实现完成（前端构建通过；浏览器目视待验） | 本文件“LFAA-WORKSPACE-BACKGROUND-UNIFICATION-01” |
| LFAA-SETTINGS-NOTIFICATIONS-01 | 将设置中心通知接入真实 AI Work 完成事件与浏览器通知 | 已完成 | 本文件“LFAA-SETTINGS-NOTIFICATIONS-01” |
| LFAA-SETTINGS-TYPOGRAPHY-01 | 统一设置中心字号层级并显露外观字号控制 | 已完成（浏览器目视待验） | 本文件“LFAA-SETTINGS-TYPOGRAPHY-01” |
| LFAA-SETTINGS-LAYOUT-UNIFICATION-01 | 统一设置中心全部分类的布局、尺寸与间距 | 已完成（浏览器目视待验） | 本文件“LFAA-SETTINGS-LAYOUT-UNIFICATION-01” |
| LFAA-SETTINGS-SIDEBAR-HEADER-ALIGNMENT-01 | 对齐设置侧栏顶部的返回与收起按钮 | 已完成（Vite 构建通过；类型检查受其他文件错误阻塞，浏览器目视待验） | 本文件“LFAA-SETTINGS-SIDEBAR-HEADER-ALIGNMENT-01” |
| LFAA-FRONTEND-CSS-SHARED-01 | 建立清晰的前端公共 CSS 入口并分离共享样式 | 已完成 | 本文件“LFAA-FRONTEND-CSS-SHARED-01” |
| LFAA-AI-ARCH-01 | 建立 AI 插件宿主的最小后端基础并验证 Cordis | 已完成 | 本文件“LFAA-AI-ARCH-01” |
| LFAA-AI-RUNTIME-01 | 完成 AI Work Runtime 并按业务归属接入设置中心 | 进行中 | 本文件“LFAA-AI-RUNTIME-01” |
| LFAA-AI-PERMISSIONS-01 | 将 AI 工具权限接入三种模式、可记忆授权和独立审批控制 | 已完成 | 本文件“LFAA-AI-PERMISSIONS-01” |
| LFAA-AI-PERMISSION-MODE-EXECUTION-02 | 落实三种项目权限模式、Daemon 主机命令执行，并修复权限弹层外观 | 实现完成（Server、前端、Daemon 构建与差异检查通过；浏览器及真实 Daemon 验收待运行环境） | 本文件“LFAA-AI-PERMISSION-MODE-EXECUTION-02” |
| LFAA-AI-PERMISSIONS-DB-01 | 修复 AI 审批与记忆授权表的版本 8 数据库迁移兼容 | 已完成 | 本文件“LFAA-AI-PERMISSIONS-DB-01” |
| LFAA-SERVER-POLL-LOG-01 | 降低健康与会话轮询成功日志的终端噪声 | 已完成 | 本文件“LFAA-SERVER-POLL-LOG-01” |
| LFAA-SETTINGS-PERMISSION-CLARITY-01 | 按 LFAA 当时的实际能力完善常规页访问边界说明与权限页策略说明 | 历史任务已完成；权限语义已由 `LFAA-AI-PERMISSION-MODE-EXECUTION-02` 更新 | 本文件“LFAA-SETTINGS-PERMISSION-CLARITY-01” |
| LFAA-OBS-SERVER-LOGS-01 | 观察开发终端中的偏好、AI 查询与认证日志；确认是否需要单独修复 | 待开始 | 本文件“LFAA-OBS-SERVER-LOGS-01” |
| LFAA-GITHUB-FORCE-PUSH-01 | 从根目录菜单一键提交纯净源码并安全推送或强制推送到指定 GitHub main | 已完成（语法与静态分支核对通过；GitHub 推送未运行） | 本文件“LFAA-GITHUB-FORCE-PUSH-01” |
| LFAA-REALTIME-SOCKET-01 | 为 Minecraft 现有任务、日志与状态接入经会话认证的 Socket.IO 实时推送 | 已完成（代码与自动验证） | 本文件“LFAA-REALTIME-SOCKET-01” |
| LFAA-SETTINGS-CENTER-CLEANUP-01 | 依据设置中心审查结论整理导航、重复入口与尚未生效的设置项 | 本轮仅归档；整改待开始（排在架构升级后） | 本文件“LFAA-SETTINGS-CENTER-CLEANUP-01” |
| LFAA-DOMAIN-PROMPT-INTEGRATION-01 | 将 Minecraft 与小说领域提示词按 LFAA 真实能力接入 AI Work | 已接入（五个目标包构建、差异检查通过；Host TypeScript 有并行源码错误；Provider/实机待验） | 本文件“LFAA-DOMAIN-PROMPT-INTEGRATION-01” |

## LFAA-UI-AI-CONVERSATION-ANCHOR-SPACING-01

### 用户目标

参照用户提供的 Codex 截图，修正 AI Work 中央回复区左缘的窄型会话导航：轨道长度随提问数量变化，横杠间距一致、粗细一致，悬停预览同时展示本轮用户提问和助手回复。

本次增量：鼠标可在显示横杠的整段轨道区域内移动并动态选中最近锚点；鼠标进入对应悬浮卡片后暂停跟随；点击横杠或悬浮卡片都跳转到该锚点对应的真实用户提问。映射始终由当前提问列表和布局坐标计算，不按固定数量、屏幕坐标或历史索引写死。进一步把跟随状态隔离到 memo 轨道组件，轨道内最多保留一个待执行动画帧并只处理最新指针坐标；悬停卡片、离轨和卸载时撤销待执行帧。主刻度明显加长，左右各五档随距离缩短并使用平滑宽度过渡。

针对空白轨道移动时卡顿的增量：上一版本在最近锚点变化时更新 React state，导致整条锚点列表重新协调；帧合并只限制更新频率，没有消除每次更新的列表工作。现在只在最近刻度变化时，对上一根和当前刻度切换瞬时 DOM 标记，不触发 React 渲染。

### 当前合同

- 目标运行入口为 Web `apps/web` 的 AI Work 页面；`packages/client/ui-chat/src/AiWorkChat.tsx` 负责真实消息与悬停预览，`conversation-scroll.ts` 负责按帧测量活动提问与视口高度并生成等距布局，`ai-work-chat.css` 负责窄轨道与预览卡片的响应式样式。
- 导航轨道保持窄小，长度按提问数量增长并受消息视口高度约束（自然长度按 12–16 CSS 像素步进，通常最高为视口高度的 42%）；横杠按提问顺序等距排列，中心落在整数 CSS 像素，消息长短不改变横杠间距。达到轨道长度上限后仍保持等距压缩；若提问数多到整数像素槽位不足，则等距扩展轨道并将所有横杠统一减至 1px 高，避免重合。
- 点击横杠仍跳转到对应用户提问的真实 DOM 位置；滚动时活动标记仍按真实消息位置更新。
- 鼠标在 48px 轨道命中区内、可见预览卡之外的区域移动时（包括横杠右侧透明空隙），按指针纵坐标与当前布局坐标二分选出最近锚点；首尾位置自然取最近端点。只有指针进入可见预览卡本身时冻结当前选择，离开卡片回到轨道范围后恢复跟随，离开整个轨道后清除悬停选择。
- 横杠和其悬浮卡片都保留同一个真实提问按钮及点击跳转；锚点数量变化时，跟随和跳转映射随当前列表更新。
- 透明按钮本身不以重叠的矩形热区遮挡相邻刻度；只让可见横杠和预览卡接收指针点击，按钮继续承担键盘焦点和语义。
- 每个用户提问对应其后、下一条用户提问前的真实助手消息；悬停预览以提问为标题、以助手输出为正文。流式中、排队、失败或暂无正文时只显示与消息实际状态相符的文本。
- 默认导航横杠使用统一的可视尺寸；鼠标悬停或键盘聚焦某一项时，当前横杠最长约 34px，左右各五档按距离逐级缩短形成明显阶梯；刻度左缘对齐、高度保持一致，宽度切换使用平滑过渡。无障碍减少动态效果继续由工作台全局样式统一关闭。
- 保留每条真实用户提问的跳转、活动标记、键盘聚焦及触屏可用行为；不改对话正文行距、消息次序、会话持久化、服务端 API、授权或运行时。
- 不改对话正文行距、消息次序、会话持久化、服务端 API、授权或运行时；不新增设置项、请求、全局事件监听器、观察器或常驻动画循环。允许用单个待执行 requestAnimationFrame 合并指针移动，并只变更最近锚点切换前后的 DOM 标记，不调用 React state；卡片进入、离轨与卸载都须取消待执行帧，不绑定 document/window。

### 设置中心配置盘点

- 不新增或改变设置中心配置。导航继续沿用现有外观令牌，包括强调色、焦点环、主题文字和界面字体，并遵循 `appearance.advanced.reducedMotion`；设置默认值、持久化与映射均不变。

### 允许修改

- `packages/client/ui-chat/src/AiWorkChat.tsx`：配对用户提问与真实助手消息，并在预览卡呈现两者；用局部指针帧 coalescer 计算当前刻度，仅切换前后两个按钮的瞬时标记并取消未执行指针帧。
- `packages/client/ui-chat/src/conversation-anchor-preview.ts`：按真实消息顺序配对每轮提问/回复，并生成与消息状态一致的预览文本。
- `packages/client/ui-chat/src/conversation-scroll.ts`：用已有按帧 DOM 测量更新活动提问与视口高度，并提供等距整数像素布局、最近锚点二分查找、指针值按帧合并和两刻度标记切换 helper，不增加滚动期间逐节点布局读取。
- `packages/client/ui-chat/src/ai-work-chat.css`：统一横杠粗细和左缘，扩大轨道根节点命中区，避免按钮热区重叠遮挡刻度；移除会把卡片外透明空隙错误命中为卡片的桥接伪元素；当前横杠最长 34px，左右各五级逐渐收窄并平滑过渡。
- `apps/cli/tests/client-performance.test.mjs`：验证等距整数像素布局、最近锚点选择、真实提问跳转定位、回复配对、帧合并和卸载清理。
- `docs/PROMPTS.md`：维护任务索引、合同和完成状态。

### 禁止修改

- 不改锚点帧合并、消息顺序、会话或服务端数据合同、授权和设置持久化；不调整工作台列宽、背景或其他界面间距。

### 验收条件

- 轨道保持窄型，长度按提问数量增长且不超过消息视口高度的 42%；相邻横杠间距始终一致，达到轨道上限后仍等距排列。
- 每根横杠的 CSS 高度一致，常规为 2px；仅在极端密度下整组统一为 1px。中心坐标落在整数 CSS 像素，避免分数像素定位造成的粗细差异。
- 悬停一条用户提问时，卡片显示该提问与对应助手输出；流式、排队、失败或无文字输出时显示真实状态，不跨越下一条用户提问误配回复。
- 未悬停时所有横杠视觉尺寸一致；悬停或键盘聚焦时形成以当前项为中心、向相邻项逐级收窄的阶梯。
- 指针高频移动最多只有一个待执行动画帧，使用该帧内最新坐标；只有最近锚点改变时才切换前后两个按钮的瞬时 DOM 标记，不调用 React state 或重渲染轨道/消息树。卡片暂停、离轨和卸载均取消尚未执行的帧。
- 指针在整个 48px 轨道命中区、可见卡片之外的空白处移动（包括横杠右侧透明区域）仍选择最近刻度；只有进入可见卡片后移动指针才不会改变选中刻度，离开卡片回到轨道范围后重新跟随；离开轨道后清除指针选择。
- 点击任一横杠及其对应悬浮卡片均滚动到对应真实用户提问；不同提问数和动态轨道布局由同一列表映射，不使用固定坐标或计数分支。
- 定向回归证明等距像素布局、真实消息跳转、回复配对、指针选择和待执行帧清理；聊天包与 Web 构建、差异检查通过。登录态真实浏览器长会话视觉、鼠标跳转、键盘聚焦和触屏操作单独报告。

### 当前验证

- `pnpm --filter lfaa-client-ui-chat run build` 通过，产物位于根目录 `dist/packages/`。
- `pnpm --filter lfaa-web run build` 通过，包含客户端 TypeScript 检查与 Vite 构建，产物位于根目录 `dist/apps/web/`；Vite 提示既有主入口 chunk 超过 500 kB，本次未调整拆包。
- `node --import tsx --import ./register-package-loader.mjs --test tests/client-performance.test.mjs`（在 `apps/cli` 执行）通过，15 项全部通过；覆盖等距整数像素布局、活动提问定位、回复配对、滚动帧合并和卸载清理。
- `git diff --check` 对已跟踪任务文件通过；新增辅助模块与回归文件的行尾空白检查通过。仓库当前未定义 `workspace-preflight` 或独立 quality/release Gate。登录态浏览器的真实悬停画面、跳转、键盘和触屏行为仍待目视验收。
- 本次整轨道跟随增量：`findNearestConversationAnchorIndex` 使用升序动态坐标二分查找，指针移动只更新跨越最近锚点后的状态；不增加全局事件、观察器或动画帧。`node --import tsx --import ./register-package-loader.mjs --test tests/client-performance.test.mjs` 通过，17 项全部通过，新增回归覆盖 4 种不同提问数量/轨道密度、首尾钳制和中点择前。
- `pnpm --filter lfaa-client-ui-chat run build` 通过，输出仅位于根 `dist/packages/`；最终 CSS 修改后再次运行 `pnpm --filter lfaa-web run build` 通过，包含 `tsc --noEmit` 与 Vite 构建，输出位于根 `dist/apps/web/`。Vite 保留仓库既有超过 500 kB 的 chunk 警告。
- `git diff --check` 对本次相关跟踪文件通过；新增 helper/test 文件无尾随空白。外观变量映射静态核对至 `Workbench.tsx`：强调色、界面/正文/字号、减少动态效果仍来自设置中心；本次未改设置或视觉令牌。性能仅有定向回归证据，未取得真实浏览器帧时间。
- 登录态浏览器目视未完成：Edge 浏览器连接器返回 `nodeRepl.fetch request failed`，未能读取标签页或操作页面。仓库当前没有 `packages/client/ui-chat/README.md`；根 `开发规范.md`、`docs/系统总体架构.md`、`docs/开发计划.md` 和本合同已核对。
- 本次平滑反馈增量：将跟随状态放入 `memo` 轨道组件，指针坐标由单个 `requestAnimationFrame` coalescer 合并，卡片暂停、离轨和卸载取消待执行帧；仅最近锚点变化时更新轨道状态。CSS 主横杠宽 34px，左右阶梯依次为 28/22/16/11/8/6px，固定 2px 高度、左对齐，180ms 平滑变化；工作台原有减少动态效果规则继续接管过渡。
- `client-performance.test.mjs` 定向回归通过 18/18，含最新值按帧合并、取消后可重新调度和卸载式取消；`pnpm --filter lfaa-client-ui-chat run build` 通过。独立 `pnpm exec vite build` 从 `apps/web` 执行通过，CSS/JS 产物位于根 `dist/apps/web/`。
- `pnpm --filter lfaa-web run build` 的本轮最终重跑通过 `tsc --noEmit` 与 Vite 构建，产物位于根 `dist/apps/web/`；第一次执行时报告的模型 Popover 与 `defaultValue` 类型错误在重跑中未复现，本轮未修改模型设置路径。
- 仍无登录态浏览器目视和实机帧时间证据；Edge 连接器返回 `nodeRepl.fetch request failed`。设置盘点为仅使用现有强调色、主题及 `appearance.advanced.reducedMotion` 映射，未增设或重置设置。
- 针对空白轨道卡顿：根因为旧的 `setHoveredAnchorId` 每次切换都重渲染锚点列表，而帧合并只限制更新频率。现改为每帧只对前一刻度与当前刻度增删 `data-pointer-active` 属性，没有 React state 更新；新增回归确认仅两节点发生标记变更。客户端性能回归通过 19/19，聊天包与标准 Web 构建通过；Web 产物位于根 `dist/apps/web/`。浏览器帧耗时尚未实测。
- 2026-10-02 红框右侧区域仍卡顿：命中检查确认可见预览卡左侧 `::before` 透明桥接层被 `closest()` 当作卡片，导致卡片外透明区错误暂停跟随。已移除该伪元素命中层，并保留对实际可见卡片本身的暂停；48px 轨道范围内的卡片外区域继续选择最近刻度。定向性能回归 19/19、聊天包构建、标准 Web TypeScript/Vite 构建和 `git diff --check` 均通过；产物仅写入根 `dist/`。设置中心配置未变；未进行登录态浏览器操作或鼠标帧时间测量。

## LFAA-UI-AI-CONVERSATION-ANCHOR-INTERACTION-02

### 用户目标

修复 AI Work 对话锚点的四项交互问题：指针停在预览卡时对应横杠持续展开；指针选中的横杠单独使用设置中心强调色；横杠与预览卡均显示手形光标并可跳转到真实提问；横杠视觉粗细一致且点击命中区更容易命中。

### 当前合同

- 目标运行入口为 Web `apps/web` 的 AI Work 页面；真实交互 Owner 为 `packages/client/ui-chat/src/AiWorkChat.tsx` 与 `ai-work-chat.css`，布局数据继续由 `conversation-scroll.ts` 提供。
- 指针在横杠的 48px 单项命中区或可见预览卡内移动时，保留同一按钮的 `data-pointer-active`，停止待执行跟随帧；预览卡左缘须与按钮命中区水平重叠，鼠标从横杠经过透明间隙进入卡片时不得短暂失去所属项。指针进入卡片后卡片继续显示且可点击，只将该卡片对应横杠保持为 34px 强调色，其余横杠恢复为 6px 主题基础色；移回轨道空白区后恢复最近锚点阶梯，离开轨道后清除指针选择。继续复用单个帧合并器和 DOM 标记，不用 React state 重渲染消息列表。
- 指针悬停或键盘聚焦时只有当前横杠显示强调色；其余横杠保持原色。相邻横杠可以保留宽度阶梯，但不能因距离当前项远近混合强调色。无悬停时仍保留当前消息的活动语义标记。
- 横杠按钮保留真实提问跳转与键盘语义；单项按钮命中宽度覆盖完整 48px 轨道，纵向高度不超过相邻锚点间距，避免相邻按钮重叠。最长 34px 横杠右侧仍保留至少 6px 可点击余量；预览卡左缘固定落在按钮范围内（轨道左缘 44px），从横杠到卡片之间没有失去按钮悬停状态的空档。轨道按钮的可点击透明范围仍限于每项自身，不将整个空白轨道改成点击跳转区域。
- 每条横杠使用同一个轨道高度：通常为 2px；仅当布局间距不足 2px 时整组统一为 1px。厚度不因悬停宽度或邻近状态变化。按钮命中框用整数 top 和高度放置，不再对奇数高度的按钮做半像素纵向变换；横杠用独立的整数 top 对齐到布局中心。鼠标落在按钮范围及卡片上均显示手形光标。
- 点击可见横杠、其扩大的单项按钮区域或该项预览卡，均跳转至同一真实用户提问；消息配对、锚点顺序、滚动和自动跟随规则不变。
- 不改服务端、会话持久化、消息顺序、账户权限或设置数据合同；不新增设置项、请求、全局监听、观察器、常驻动画或 CSS 自定义属性。继续遵循主题、对比度及减少动态效果设置。

### 设置中心配置盘点

- 不新增或改变设置。横杠高亮读取现有 `--settings-accent` 外观强调色；基础横杠与活动状态继续使用现有主题文字令牌；动画仍受工作台减少动态效果设置控制。默认值、持久化和前端映射不变。

### 允许修改

- `packages/client/ui-chat/src/AiWorkChat.tsx`：保持指针停留在真实预览卡对应项时的 DOM 选中标记；为 48px 单项按钮命中框、像素对齐的横杠和预览卡位置保留真实锚点点击。
- `packages/client/ui-chat/src/conversation-scroll.ts`：在现有等距布局结果中提供不重叠的单项命中高度及整数横杠纵向偏移。
- `packages/client/ui-chat/src/ai-work-chat.css`：单项按钮命中区域、光标、独立强调色、卡片位置及整组统一横杠厚度。
- `apps/cli/tests/client-performance.test.mjs`：为命中高度、等距布局及不同密度下横杠的整数像素放置增加直接回归。
- `docs/PROMPTS.md`：维护本合同、任务索引和完成验证记录。

### 禁止修改

- 不改真实消息定位、提问/回复配对、滚动跟随、消息持久化、API、权限和设置持久化。
- 不扩大到聊天列宽、背景、其他组件或全局指针策略；不以透明桥接伪元素混淆预览卡命中。

### 验收条件

- 进入并停留在预览卡时，卡片保持显示和可点击，仅对应横杠保持 34px 强调色，其余横杠恢复 6px 短刻度与基础色；返回轨道恢复最近锚点阶梯，离开轨道清除选择。
- 鼠标或键盘选择项高亮只改变该项颜色并实时读取设置强调色；邻近横杠保持原色。
- 横杠至预览卡之间始终命中同一按钮，卡片停留期间横杠保持展开；单项 48px 按钮区域和预览卡均显示手形光标，且点击均到达正确提问；相邻按钮的垂直范围不重叠。
- 同一布局中所有横杠的 CSS 高度和整数像素 top 完全一致；常规为 2px，极密布局时整组统一为 1px；更换布局密度不会让按钮变换产生半像素横杠位置。
- 定向回归、聊天包构建、Web 构建和差异检查通过；性能报告区分静态证据与浏览器帧时间。登录态浏览器若不能访问则记录明确阻塞，不将构建当作交互验收。

### 当前验证

- 2026-10-04 复核：`node --import tsx --import ./register-package-loader.mjs --test tests/client-performance.test.mjs`（`apps/cli`）通过，21/21；回归覆盖单项 48px 按钮、卡片在按钮命中区内重叠、强调色规则、5 种布局密度下整数像素横杠位置，以及卡片悬停时仅对应刻度保持 34px、其余刻度为 6px。
- `pnpm --filter lfaa-client-ui-chat run build` 通过，产物位于仓库根 `dist/packages/`；`pnpm --filter lfaa-web run build` 通过 TypeScript 检查与 Vite 构建，产物位于仓库根 `dist/apps/web/`。首次并行构建遇到 PNPM 工作区状态文件 `EPERM rename`，单独重跑 Web 构建通过。Vite 保留既有主入口超过 500 kB 的提示；构建 CSS 已核实包含“卡片悬停时仅对应项展开”的规则。
- `git diff --check -- docs/PROMPTS.md packages/client/ui-chat/src/AiWorkChat.tsx packages/client/ui-chat/src/ai-work-chat.css apps/cli/tests/client-performance.test.mjs` 退出码为 0；`workspace-preflight`、`quality:full`、`quality:check` 与 `release:gate` 未在根脚本、`scripts/` 或 `docs/quality/` 中找到，未运行。
- 静态工作量：指针移动仍由单个待执行动画帧合并；锚点切换最多改动前一项与当前项两个 DOM 属性，不调用 React state；每项布局仅多出常数时间的整数偏移计算，无新增监听、观察器或设置读取。实际浏览器帧时间未测。
- 2026-10-04 IAB 登录态浏览器复核：进入 Minecraft AI Work 后选择并点击预览卡，读取到对应项 `:hover=true`、卡片 `visibility=visible`，对应刻度宽约 34px 且为强调色 `rgb(214, 77, 143)`；其余 15 根均约 6px 且为基础色 `rgb(140, 140, 140)`。确认了卡片停留时邻近阶梯已收回；物理鼠标帧时间未测。Edge 扩展连接仍返回 `nodeRepl.fetch request failed`。
- 设置中心配置未变：横杠继续读取工作台注入的 `--settings-accent` 强调色，基础色使用现有主题文字令牌，动效沿用减少动态效果设置；未新增或重置设置项。

## LFAA-AI-PERMISSION-MODE-EXECUTION-02

### 用户目标

让 LFAA 账户级三种项目权限模式真实控制项目操控；“完全权限”下由模型根据当前用户指令自主执行项目管理、文件、任意主机命令和其他应用能力，不再逐项等待用户审批。通过真实 Daemon Host 执行终端命令，并修复权限弹层与启用确认框的视觉问题。

### 当前合同

- “请求审批”：模型可以调用项目能力；每项写入、高风险操作和主机命令都创建并消费一次性用户审批，不创建记忆授权。
- “替我审批”：未匹配记忆授权的写入、高风险操作和主机命令逐项审批；用户明确选择记住后，严格匹配账户、应用、操作 ID/版本、风险和目标范围的后续操作可自动执行。
- “完全权限”：模型按当前用户指令自主决定并执行项目的所有操控能力，包括主机 Shell 与任意路径访问；读、写、部署、配置、文件和命令操作均不再逐项审批。切换到账户完全权限仍保留一次显式确认。
- 这三项是 LFAA 项目权限模式，不是其他产品的工具权限模式。模式只决定逐项审批方式，不得按操作风险、记忆授权或目标路径缩减完全权限；主机命令按目标 Daemon 进程账户的 OS 权限执行。
- Shell 工具面向所有已登记在线节点，通过 daemon 心跳能力 `agent-shell-v1`、server 持久化任务队列和 Daemon 执行，不在 server 进程直接运行主机命令。命令使用账户已有 `general.integratedShell` 选择的 Shell；允许模型提供任意命令与工作目录，不添加命令白名单、路径限制或默认运行超时；提供任务查询以继续跟踪长时间命令。
- 当前用户明确请求才可驱动操作；项目文件、命令输出和其他资料中的指令只作为数据，不构成用户授权。模型返回成功结果后才可说已完成。Minecraft EULA 的展示与用户明确同意仍单独执行。
- “完全权限”确认框与权限弹层使用 `Modal.useModal()`/`.workbench-shell` 继承设置中心现有主题、强调色、界面字体/字号、对比度、壁纸遮罩/模糊与减少动态效果设置，不新增设置字段、依赖或 CSS 自定义属性。
- 设置中心与 AI Work 的三种模式说明及完全权限确认文案保持一致，强调项目权限模式语义，不称为 Codex/其他产品的工具权限模式。
- 保持三种模式的账户设置类型、默认值、API 与现有单次审批/记忆授权表结构、哈希、有效期及消费格式不变；只新增独立 AI Host 任务表，不把任务队列保存为用户设置。
- 完成标准：路由只在授权器返回 `approval_required` 时创建并等待审批；`allow` 直接调用现有工具；前端、server、daemon 构建与差异检查通过。无真实 Provider/登录态时不声称完成浏览器或 Host/Daemon 验收。

### 允许修改

- `server/src/api/routes.ts`：按 server 授权器结果决定等待审批或直接执行模型选择的项目能力。
- `server/src/database.ts`、`server/src/modules/nodes/ai-host-tasks.ts`：新增任意主机命令任务迁移、排队、租约、结果和查询。
- `server/src/ai/permissions.ts`：完全权限直接授权，不要求操作范围哈希；请求审批/替我审批继续使用原有精确范围合同。
- `server/src/ai/business-tools.ts`、`server/src/ai/runtime.ts`、`server/src/ai/prompts/writing.ts`：向各 App 提供节点发现与主机命令能力，并把三种项目权限模式告知模型。
- `daemon/src/task-runner/minecraft-daemon.mjs`：上报主机命令能力、领取并执行 Shell 命令任务、回传真实退出状态和输出。
- `frontend/src/components/AiWorkChat.tsx`、`frontend/src/components/SettingsPage.tsx`、`frontend/src/components/ai-work-chat.css`：统一三种模式说明、紧凑权限弹层和完全权限确认。
- `frontend/src/styles/workbench.css`：添加确认框局部主题样式，复用既有设置映射。
- `开发规范.md`、`docs/PROMPTS.md`、`docs/开发计划.md`、`docs/系统总体架构.md`：同步新架构执行语义与本轮记录。
- `server/test/database-migrations.test.mjs`：只把现有迁移版本断言从 29 更新到 30；按本合同不运行测试套件。

### 禁止修改

- 不改变三种模式的账户设置字段、默认值、API、现有审批哈希/有效期/单次消费和记忆授权规则；新增任务表不保存为用户设置。
- 不添加新的权限限制、命令白名单、路径约束或全局主题变量；不运行测试套件，不部署、发布、上传或提交 Git。

### 实施记录（2026-09-29）

- 权限模式按 LFAA 账户设置落实：请求审批逐项审批，替我审批按既有精确范围记忆授权，完全权限直接提供当前应用全部已登记工具并免逐项审批；完全权限授权不再要求风险/目标范围哈希，App 和账户写作归属仍由当前上下文约束。
- 新增 `agent-shell-v1` Daemon 队列：模型可发现在线节点、提交任意命令与工作目录并按任务 ID 查询；默认不加命令运行超时。命令由目标 Daemon 按 `general.integratedShell` 设置运行，执行失败、退出码、超时和截断状态真实回传。活动摘要不复制命令正文或终端输出。
- 三模式弹层收敛为紧凑列表；完全权限确认框和弹层挂在 `.workbench-shell` 主题上下文，读取既有外观令牌。
- Server、前端和 Daemon 构建通过；`git diff --check` 通过。迁移测试仅同步断言至版本 30，按合同未运行测试套件。仓库没有 `workspace-preflight` 脚本或对应包命令，未运行该 Gate。
- 检查时本机 `5173`/`3000` 没有监听服务；登录态浏览器目视、真实 Provider 工具调用和 Daemon 主机命令实机验收未执行。

## LFAA-UI-WORKBENCH-SWAP-CONTROL-01

### 用户目标

让截图红框中的 `↔` 交换按钮只在鼠标移入右侧栏拉伸区域时显示，鼠标移出后隐藏。

### 当前合同

- 桌面布局且右侧栏展开时，交换按钮默认透明且不接收鼠标点击；指针移入右侧拉伸分隔区域（包括浮现后的按钮区域）时显示，移出后隐藏。
- 键盘聚焦交换按钮时保持可见并可激活；鼠标悬停仍显示提示文字。
- 右侧栏收起或布局不是桌面时，保持现有不渲染语义；不改分隔器拖拽、键盘调整和吸附行为。
- 不新增 CSS 自定义属性或依赖；只调整交换按钮的显隐反馈。

### 允许修改

- `frontend/src/workbench/workbench.css`：让 pane swap 按钮跟随右侧分隔器 hover 显示，并在键盘聚焦时可见。
- `docs/PROMPTS.md`：登记当前任务合同与完成记录。

### 禁止修改

- 不改分隔器热区尺寸、拖拽阈值、默认栏宽、按钮条件渲染或其他工作台区域。
- 不新增 CSS 自定义属性、依赖、动画或与本任务无关的视觉修改；不部署、发布、上传或提交 Git。

### 验收方式

- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查和 Vite 构建；产物必须写入根目录 `dist/frontend/`。
- 核对交换按钮只在右侧分隔区域 hover 或键盘聚焦时可见，并保留现有桌面/展开显示条件及窗格交换行为。

### 代码修改记录（2026-09-29）

- 移除交换按钮常驻可见样式；默认透明且不接收鼠标事件，右侧分隔区/按钮悬停或键盘聚焦时显示，移出后隐藏。保留现有条件渲染、提示文字和窗格交换行为。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查与 Vite 构建成功，产物写入根目录 `dist/frontend/`；本任务文件 `git diff --check` 通过。
- 未完成浏览器实际悬停与移出交互验收；当前无法通过 CUA 获取浏览器状态，静态构建不能代替目视验证。

## LFAA-SETTINGS-GLOBAL-NAV-01

### 用户目标

把应用工作区左侧红框中的全局导航轨加入设置中心，使两处共用相同的导航组件和视觉样式。

### 当前合同

- 设置中心在最左侧显示应用工作区现有全局导航轨；原设置分类侧栏仍保留在其右侧。
- 导航轨复用一个 React 组件，应用工作区与设置中心不维护两份菜单结构；首页、设置、工具、快捷键和账户入口按当前页面能力执行，未接入的动作保持禁用。
- 应用工作区导航轨原有的模式首页、工具栏、快捷键、账户菜单和退出登录行为保持不变；设置中心的首页入口最初打开应用中心，此行为由后续 `LFAA-SETTINGS-RETURN-CONTEXT-01` 调整为返回进入设置前的路由，明确的“应用中心”入口仍打开应用中心；设置图标标示当前页面。
- 只调整设置页自身外层布局以容纳导航轨；不改变设置分类、表单、布局偏好或背景配置行为。
- 完成标准：静态确认共享导航组件被两处复用、设置轨道不遮挡设置分类栏和正文；前端构建通过，产物位于根目录 `dist/frontend/`。

### 允许修改

- `frontend/src/components/GlobalNavigationRail.tsx`：承载两处共用的全局导航轨与原有交互。
- `frontend/src/components/ApplicationWorkspace.tsx`：改为使用共享导航组件，保持应用工作区现有行为。
- `frontend/src/components/SettingsPage.tsx`：在设置页面挂载共享导航轨并接入页面动作。
- `frontend/src/components/SettingsPage.css`：为设置导航轨与设置工作台增加外层布局。
- `frontend/src/components/module-workbench.css`：更新共享导航轨样式归属说明（如需要）。
- `frontend/src/components/Workbench.tsx`：向设置页传递现有导航和账户动作。
- `docs/系统总体架构.md`：更新设置中心全局导航轨与分类侧栏的布局事实。
- `docs/PROMPTS.md`：维护本任务合同和完成记录。

### 禁止修改

- 不新增第二份导航菜单，不改变既有按钮含义、应用路由、快捷键绑定、权限或退出登录行为。
- 不修改设置分类导航、设置数据、服务端接口、CSS 自定义属性或依赖；不部署、发布、上传或提交 Git。

### 验收方式

- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查和 Vite 构建；产物必须写入根目录 `dist/frontend/`。
- 静态核对两处挂载同一组件，设置布局包含 64px 导航轨和原有可调整分类栏，窄屏规则适配现有工作区。
- 检查本任务的差异没有覆盖其他未提交改动。

### 完成记录（2026-09-28）

- 应用工作区和设置中心统一使用 `GlobalNavigationRail`；设置中心左侧增加 64px 导航轨，宽度不超过 420px 时收窄到 48px。设置分类栏仍由原有 `ResizableWorkbench` 管理，轨道的工具入口因设置页没有工具资源栏而禁用。
- 设置工作区测量可用宽度时扣除导航轨宽度；架构文档同步说明全局导航轨与设置分类栏的位置关系。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查与 Vite 构建；构建产物位于 `dist/frontend/`。本任务涉及文件的 `git diff --check` 通过。
- 未进行浏览器目视验收；当前仓库没有 `scripts/workspace-preflight.mjs`，根 `package.json` 未定义额外的 quality/release Gate。

## LFAA-SETTINGS-RETURN-CONTEXT-01

### 用户目标

设置中心左侧全局导航的房子入口返回进入设置前所在的页面或应用工作区，不固定跳回应用中心。

### 当前合同

- 设置中心侧栏“返回工作台”和全局导航房子使用同一已保存来源路由，离开设置后恢复进入设置前的精确路由。
- 从应用工作区打开设置时，返回该应用、模式及原子页面；从应用中心打开时，返回应用中心。
- 直接访问设置路由且没有本次导航来源时，沿用工作台现有的当前应用/模式默认返回目标。
- 仅改变设置中心房子入口的目标与说明；全局导航的明确“应用中心”入口和快捷键继续导航到 `/`。
- 不改变设置分类、设置数据、应用内导航或返回目标的所有权与存储方式。
- 完成标准：静态确认设置中心两个返回入口复用相同回调、明确应用中心入口仍指向 `/`；前端构建通过，产物位于根目录 `dist/frontend/`。

### 允许修改

- `frontend/src/components/SettingsPage.tsx`：让全局导航房子复用现有的设置返回回调，并说明其来源路由语义。
- `docs/系统总体架构.md`：明确设置中心房子与侧栏返回都恢复进入设置前的路由。
- `docs/PROMPTS.md`：维护本任务合同与完成记录。

### 禁止修改

- 不改变 `Workbench` 已有的来源路由捕获、直接访问设置时的默认目标或 `/` 应用中心入口语义。
- 不修改设置数据、服务端接口、账户偏好、应用业务页或其他导航行为；不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对设置中心房子与侧栏返回调用同一返回回调，并核对快捷键及明确应用中心入口仍指向 `/`。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与 Vite 构建通过，产物写入根目录 `dist/frontend/`。
- 记录未执行的浏览器交互验收，不以静态检查替代实际点击验收。

### 首版完成记录（2026-09-29）

- 设置中心全局导航房子改为复用侧栏“返回工作台”的 `onBack`，返回 `Workbench` 进入设置前保存的精确路由；直接访问设置时继续沿用原有应用/模式默认目标。
- 快捷键“应用中心”和导航轨“更多入口 > 应用中心”仍指向 `/`；同步更新架构说明，并标记旧的设置首页行为已由本合同调整。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查与 Vite 构建成功，产物位于根目录 `dist/frontend/`；本任务涉及文件 `git diff --check` 通过。
- 未进行浏览器点击验收；构建和静态核对未验证实际浏览器中的导航交互。

## LFAA-UI-WORKMODE-HOME-01

### 用户目标

在应用工作区点击左侧主导航栏的房子按钮时，返回当前应用中用户当前选择的工作模式首页。

### 当前合同

- 首页目标由当前应用和当前选择的模式共同决定，清除该模式下的子页面路径，目标格式为 `/apps/{app}/{mode}`。Minecraft 常规模式根页呈现总览，AI Work 根页呈现 AI Work 对话入口。
- 左侧主导航栏房子按钮使用“返回当前模式首页”的名称和行为。
- 明确的“应用中心”入口继续导航到 `/`。
- 不改变快捷键“返回应用中心”的语义、应用/模式切换、工作区布局或其他页面行为。
- 完成标准：代码可静态确认两类入口路由分离；前端构建通过，构建产物位于根目录 `dist/frontend/`。

### 允许修改

- `frontend/src/components/ApplicationWorkspace.tsx`：将当前模式首页动作接入全局导航轨。
- `frontend/src/components/Workbench.tsx`：按当前应用与所选模式提供首页路由。
- `docs/PROMPTS.md`：维护本任务合同和完成记录。

### 禁止修改

- 不修改应用中心自身路由、侧栏明确的“应用中心”入口、快捷键语义、应用/模式偏好或持久化。
- 不改其他业务页面、样式或布局；不部署、发布、上传或提交 Git。

### 首次实现记录（2026-09-28）

- 房子按钮指向当前应用与当前工作模式根路由，从子页面返回时清除子页面路径；应用中心入口单独指向 `/`。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查与 Vite 构建均成功，产物位于 `dist/frontend/`。未进行浏览器交互验收；当前目录没有 Git 元数据，无法核查 Git 变更状态。

### 用户澄清（2026-09-29）

- 用户确认首页应跟随当前所选模式：常规模式返回常规根页，AI Work 返回 AI Work 根页；从模式子页面进入时清除子页面路径。明确的应用中心入口仍进入 `/`。
- `Workbench.tsx` 使用当前应用和路由中的所选模式构造首页路径；`ApplicationWorkspace.tsx` 的回调与无障碍名称明确表达当前模式首页。
- 静态路由核对确认目标不依赖前一页面或应用中心入口。未运行构建或测试；浏览器交互待验。

## LFAA-GITHUB-FORCE-PUSH-01

### 用户目标

运行根目录 `lfaa.bat` 后，可从现有项目管理菜单一键将 `H:\LFAA` 当前纯净源码提交并推送到 `https://github.com/yubboo/LFAA.git` 的 `main` 分支；提供不覆盖远端历史的常规推送和单独确认的强制推送两种方式。

### 当前合同

- 保留现有安装、开发服务、环境检查和源码备份菜单；新增独立 GitHub 推送选项，由用户选择后才启动 Git 写操作。
- 菜单提供两个明确选项：常规推送使用不带 `--force` 的 `git push`；强制推送使用 `git push --force` 并明确显示会覆盖远端 `main` 历史。默认菜单选项应为不覆盖历史的常规推送。
- 两种推送均从 `docs/updata-log.md` 读取当前正式版本，显示并要求用户确认；提交说明前自动加入 `LFAA 版本号`，成功提示也显示该版本。用户要推送新版本时，须先按项目版本规则更新更新日志，不允许在脚本里填写一个与项目记录不一致的版本。
- 推送前复用或初始化当前工作区 Git 仓库，将 `origin` 固定为用户指定地址；有安全源码变更时列出待提交文件并要求提交说明，过滤后没有可提交内容时不创建空提交；缺少 Git 作者信息时只写入当前仓库配置。
- HTTPS 推送的持续低速阈值为 1 KiB/s、60 秒，避免传输无进展时无限等待；超时或失败时保留 Git 原始错误信息。常规推送遇到非快进拒绝时不得自动强推。
- 本任务只实现脚本，不实际初始化 Git、提交或推送。
- 提交前从暂存区排除 `data/`、`server/data/` 运行数据、构建产物、Node/Python/原生依赖与缓存、本机凭据文件、数据库、日志、归档和模型权重；仅移除明确受保护路径的暂存状态，保留本地文件。单个文件超过 25 MiB 时也从暂存区排除并保留本地文件；剩余安全源码有变更时继续到必填提交说明步骤。推送前扫描当前提交历史中的受保护路径、大文件和高风险凭据特征。
- 不提交 SQLite 等账户数据库、超级管理员注册结果、会话、用户设置或其他运行状态；锁文件和项目清单保留，用于可复现地重新安装依赖。
- 复用 Git CLI 的原始错误信息，不添加依赖或额外服务。
- 完成标准：从 `lfaa.bat` 菜单能分别选择常规和强制推送；两个选项都能确认当前正式版本；目标 URL、分支、强推隔离、正常推送非覆盖、超时、依赖/运行状态排除、大文件闸门与敏感内容扫描可静态核对；PowerShell 脚本语法检查通过。

### 允许修改

- `lfaa.bat`：更新入口用途说明。
- `scripts/install-dependencies.ps1`：在现有管理菜单加入 GitHub 强制推送选项及其本地 Git 流程。
- `.gitignore`：忽略仓库运行数据目录、本地环境凭据、依赖与构建缓存目录。
- `docs/PROMPTS.md`：登记本任务合同与完成记录。

### 禁止修改

- 不在本任务中运行 Git 初始化、暂存、提交、远端写入或强制推送。
- 不修改目标 GitHub 仓库内容，不推送其他分支，不把运行数据、凭据或构建产物纳入提交。
- 不调整与菜单及 GitHub 推送无关的安装、启动、备份或业务代码。

### 完成记录（2026-09-28）

- 菜单项 6 执行普通快进推送，菜单项 7 单独执行强制推送；两种模式均从 `docs/updata-log.md` 读取并要求输入确认当前项目版本，成功提示显示版本，新提交说明自动带版本前缀。普通推送不带 `--force`，非快进时明确报告被拒且不会覆盖远端；HTTPS 上传持续低于 1 KiB/s 达 60 秒时退出并保留 Git 错误信息。
- `origin` 与 push URL 固定为 `https://github.com/yubboo/LFAA.git`；Git 作者名和邮箱缺失时只询问并写入当前仓库配置，不修改全局 Git 配置。
- 根 `.gitignore` 与暂存保护规则排除根 `data/`、`server/data/` 运行数据、本机环境文件、数据库、日志、依赖目录和构建/原生缓存；支持本次失败记录中的 `server/data/ai-runtime-smoke` 从暂存区移除并保留本地文件，然后继续到提交说明步骤。另有本机凭据文件名与私钥/令牌特征扫描，以及超过 25 MiB 的暂存文件和历史对象拦截。
- 附件中的强制推送显示已发送 162 个对象、8.78 MiB，但输出止于 Git 写入对象之后，没有远端完成确认。随后只读比对发现本地 `HEAD` 为 `627d19f`、远端 `main` 为 `3694219`，确认该次推送没有更新远端；缺少后续 Git 错误输出，具体传输/权限原因仍未确定。脚本已增加低速超时。
- 静态检查确认当前 `HEAD` 追踪树不含运行数据、依赖、构建输出、账号数据库或大于 25 MiB 的文件；`.env.example` 仅保留空的 `JWT_SECRET` 配置项。当前追踪历史与工作区源码的五类高风险凭据特征扫描均无命中。PowerShell Parser、版本解析（`LFAA 0.1.1`）、推送分支静态核对、忽略规则抽查和目标文件 `git diff --check` 均通过；索引保持干净。本轮未提交、未推送；`scripts/workspace-preflight.mjs` 不存在，未运行。

## LFAA-UI-MODULE-NOTIFICATIONS-01

### 用户目标

优化应用工作区左侧栏顶部：品牌入口靠左，通知、搜索与收起操作靠右；补上独立通知铃铛，并可单独打开悬浮通知卡片。

### 当前合同

- 保持当前品牌按钮的模式切换行为；在同一行将品牌入口与右侧操作组分开对齐，按钮间距清楚且适配窄侧栏。
- 通知铃铛独立开关锚定在按钮旁的通知卡片；支持键盘 Escape 和点击卡片外关闭，并提供可读的可访问名称、展开状态与焦点样式。
- 卡片只呈现按账户通知偏好允许的真实 AI Work 成功完成事件；最多保留当前工作区内存中的 8 条，不持久化、不依赖浏览器系统通知权限，并支持标记已读和清空。
- 暂无事件时显示明确空状态。权限等待、失败/中断回复、ChatGPT/Codex 外部任务、用量、健康及其他无 LFAA 事件源均不得显示为通知。
- 沿用现有主题令牌、图标与样式体系，不新增依赖、CSS 自定义属性、API、数据库字段或持久化结构。
- 完成标准：顶栏形成左右分组；铃铛可独立打开/关闭真实事件卡片；前端类型检查与构建通过，产物写入根目录 `dist/frontend/`。

### 允许修改

- `frontend/src/components/ApplicationWorkspace.tsx`、`frontend/src/components/AiWorkChat.tsx`、`frontend/src/shared/notification-runtime.ts`、`frontend/src/components/workbench/shared/WorkbenchIcon.tsx`：接入当前工作区内存事件、独立按钮与真实 AI Work 完成通知。
- `frontend/src/components/module-workbench.css`：只调整侧栏顶栏的左右对齐，并为通知卡片和其响应式状态添加样式。
- `docs/PROMPTS.md`、`docs/系统总体架构.md`、`docs/开发计划.md`：登记合同并同步通知行为与当前能力说明。

### 禁止修改

- 不改变应用/模式导航、搜索、侧栏收起、AI Work 通知偏好和浏览器系统通知的既有语义。
- 不新增外部通知集成、伪造未接入事件、用户消息正文、服务端 API、数据库或通知持久化。
- 不改与本次侧栏顶栏及通知卡片无关的页面布局、背景、其他导航或业务流程；不部署、发布、上传或提交 Git。

### 本轮范围调整（2026-09-28）

- 用户随后明确要求应用内只能保留一个当前应用，且其他应用不能从当前应用侧栏直接跳转；此项当前要求覆盖上面的“保持应用导航既有语义”。
- 只调整应用列表项的可用状态与提示；通知、搜索按钮本身及模式切换行为保持不变。跨应用切换统一经过“应用中心”。

### 验收方式

- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与 Vite 构建通过，产物位于根目录 `dist/frontend/`。
- 静态核对通知来源、内存边界、空状态、键盘关闭与改动范围；无法进行浏览器目视验收时如实记录。

### 完成记录（2026-09-28）

- 顶栏改为品牌靠左、通知/搜索/收起按钮靠右；新增独立通知铃铛和浮层卡片，打开时标记已读，支持清空、点击外部关闭和 Escape 关闭。
- 仅在现有账户通知策略允许时，把真实 AI Work 完成事件放入当前工作区最多 8 条的内存记录；空状态明确，不读取或显示聊天正文。应用工作区卸载后记录清空。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查；Vite 产物写入根目录 `dist/frontend/`。未进行浏览器目视交互验收；当前目录没有 Git 元数据，无法核查完整 Git 变更状态或运行 `git diff --check`。

## LFAA-APP-SANDBOX-01

### 用户目标

以 App 作为身份、权限、数据、执行进程和 AI Work 的根安全范围；常规模式、手动模式和 AI Work 是同一 App 内的交互模式，切换模式不重建 App 沙盒、不切换数据或授权范围。只有离开 App A 并进入 App B 时才切换当前 App 范围。

根据当前真实代码，Minecraft Daemon 是唯一已接入的 App 主机进程执行路径，且当前只支持 Windows x64。本任务先为 Minecraft 实例接入真实 OS 沙盒，并让控制端只把符合沙盒能力的 Daemon 作为可执行节点；SteamCMD、写作与第三方可执行插件尚无对应运行时，不得显示为已接入沙盒。

### 当前合同

- `server` 保留身份、应用、审批和任务授权；TypeScript Daemon 保留节点连接与任务协调；最小 Rust Sandbox Host 只负责 Windows 原生进程隔离与生命周期，不新增另一套 Manager、AI Runtime 或游戏业务实现。
- 每个 Minecraft 实例以固定 `appId=minecraft`、`instanceId` 和每实例 AppContainer 身份启动；Java 进程及其子进程必须处于该身份与 Job Object 内。模式切换不启动、停止或重建这些进程。
- AppContainer 只能读取实例显式选择的受版本校验 Java 安装目录，并在所属实例目录内读写；外部 Java 不复制、修改或卸载，不能因此访问其他 Minecraft 实例、LFAA 数据、凭据目录或任意本机路径。Java 目录授权只读和执行；运行时 ID 必须匹配服务端所需主版本，已选路径失效时启动失败，不静默回退。网络能力仅按 Minecraft 服务端运行所需显式登记；当前授予 Internet 与 Private Network 能力，尚无域名/端口白名单。启动环境不得继承 Daemon Token、模型密钥或其他无关秘密。
- Job Object 负责进程树管理、实例内存上限与宿主关闭时终止整个进程树；它不能替代 AppContainer 的文件、网络和进程访问隔离。
- Rust Host 只接受已校验的 Minecraft 启动字段，不接受模型或用户提供的任意命令、可执行路径或额外参数。AppContainer、Job Object、允许目录或能力设置任一失败时，Daemon 必须拒绝启动；不得回退为直接 `spawn(java.exe)`。
- Daemon 只有在 Windows Sandbox Host 可用并通过能力探测后才上报沙盒能力。server 的 Minecraft 节点资格与任务创建/领取必须要求该能力；旧版或无沙盒节点不能收到可启动 Minecraft 实例的任务。
- 每实例面板只展示 Daemon 实际回报的沙盒后端与当前状态，不允许用静态文案推断沙盒已启用，也不提供关闭安全边界的普通开关。现有 AI Work 的 `appId` 会话隔离和应用内模式状态继续由现有 Owner 管理。
- Windows x64 是本合同唯一可执行平台。其他平台不得无沙盒回退运行；Linux/macOS 沙盒后端、SteamCMD/写作执行运行时、第三方插件运行时和虚拟机级隔离不属于本任务。
- 所有 Cargo 编译产物写入根目录 `dist/daemon/`；运行数据仍归 daemon 的内容型数据根目录，不得写入仓库源码或构建目录。
- 完成标准：Minecraft 节点能力和实例面板来自真实探测/进程状态；有沙盒 Host 时可在 AppContainer 中启动 Vanilla Java 服务并保留控制台、日志、安全停止；缺少或无法建立沙盒时明确失败且 Java 不启动；server/frontend/daemon 静态检查和构建通过，并记录未执行的真实服务端/网络验收。

### 允许修改

- `daemon/package.json`、`daemon/src/task-runner/minecraft-daemon.mjs`、`daemon/src/process-manager/`：构建与启动 Rust Sandbox Host、上报真实能力、为 Minecraft 实例建立沙盒启动和安全停止流程。
- `daemon/sandbox-host/`：新增最小 Rust Windows AppContainer/Job Object 可执行宿主及其 Rust 清单、锁文件和实现。
- 根 `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`scripts/install-dependencies.ps1`、`scripts/start-dev.ps1`：只接入 Daemon 沙盒构建命令和 Rust/MSVC target 前置检查，并将产物显式写入 `dist/daemon/`。
- `server/src/api/routes.ts`、`server/src/database.ts`、`server/src/modules/nodes/`、`server/src/modules/games/minecraft/`、`server/test/database-migrations.test.mjs`：校验节点沙盒能力、任务资格，并持久化每实例真实沙盒状态所需的向前迁移及维护已有迁移版本断言。
- `frontend/src/api.ts`、`frontend/src/components/MinecraftWorkspace.tsx` 及其直接相关样式：显示真实节点/实例沙盒能力与状态，不提供绕过安全边界的开关。
- `docs/PROMPTS.md`、`docs/系统总体架构.md`、`docs/开发计划.md`、`README.md`：同步安全合同、运行前置条件、项目状态和验收结果。

### 禁止修改

- 不改变 Minecraft EULA、官方来源校验、实例路径所有权、用户权限、AI 审批、AI Work 会话归属或模式切换语义。
- 不允许无沙盒时直接启动 Java；不开放任意 Shell、任意可执行文件、任意路径、任意环境变量或宿主机全盘访问。
- 不扩大到 SteamCMD、写作、插件市场、MCP、远程 Daemon 新平台、Linux/macOS 后端或完整第三方插件沙盒；这些能力须在其真实执行 Owner 出现后另立合同。
- 不安装系统服务、不修改全局防火墙/系统策略、不运行真实 Minecraft 世界任务、不读写或清理 `data/` 用户运行数据。
- 不修改项目版本或更新日志，不部署、发布、上传、购买、提交 Git 或创建 Git 元数据。

### 实现记录（2026-09-28）

- 增加 Windows x64 Rust Sandbox Host：为每个 Minecraft 实例建立不同 AppContainer SID，以显式网络能力启动受管理或实例选定 Java，使用受限句柄列表和清洁环境；实例目录读写 ACL、低完整性标签和当前 Java 目录读/执行 ACL 在安装及每次启动前重新应用。固定目录链和实例目录通过规范路径验证；失败时 Daemon 不回退直接启动 Java。
- Job Object 在恢复 Java 主线程前接管进程，限制活动进程数与内存；Node Daemon 收到真实 Host 启动令牌后才将实例报告为 `running`。server schema 迁移到 12，旧的活动状态迁为无法确认；节点能力门禁、任务认领和实例启动按钮均 fail closed。Minecraft 总览及实例页展示实际探测/心跳状态、文件范围、网络能力和资源边界，并说明模式切换与 App 切换行为。
- 构建命令已接入根 `dist/daemon/target/`。`pnpm run build` 通过（前端 TypeScript/Vite、server TypeScript、Windows x64 Rust release、Daemon `node --check`）；`cargo fmt --check` 和 PowerShell 启动/环境脚本解析通过。菜单显示 Rust/MSVC target 状态，启动 Daemon 前检查 `x86_64-pc-windows-msvc`。现有数据库迁移测试中的目标版本断言已更新为 12，但本轮未运行测试套件。
- 按仓库规则尝试 `node scripts/workspace-preflight.mjs`，当前仓库没有该脚本；`quality:full` 也未定义。初次检查时没有 `.git`；之后 Git 出现根提交 `627d19f`（`1`），本轮没有创建提交或更改暂存区。随后工作区又出现其他未提交文件变更；我未触碰这些并行改动。`git diff --check` 与 `git diff --cached --check` 当时均通过。
- 首次 Cargo 构建的 target-dir 曾多退一层，生成 `H:\dist\daemon\target`；命令已修正，最终构建位于仓库 `dist/daemon/target/`。清理误生成的仓库外 `H:\dist` 被执行策略以 `blocked by policy` 拒绝，未尝试绕过；该外部构建目录仍需处理。
- 未启动 Minecraft Java、未创建 AppContainer 用户配置、未更改实例/JRE ACL、未触碰 `data/`。因此 ACL/低完整性标签是否被目标 Windows 用户上下文接受、实际网络访问与 Sandbox Host 退出清理仍未验收；代码构建不代表这些运行时结论。

### 实例选择电脑已有的 Java（2026-09-29）

- 用户反馈 Java 页面已能发现其他软件安装的 Java，但 Minecraft 版本卡片仍引导重新下载，实例也没有选用入口。目标是让管理员在创建实例及实例停止时选择同节点、主版本匹配的 Java，并保留自动管理模式。
- 实例把 Java 运行时 ID 存在 SQLite 与实例元数据中。显式选中外部 Java 时 Daemon 重新扫描、校验真实版本及规范 `bin\java.exe` 路径；Rust Sandbox Host 只给该安装目录添加 AppContainer 读取/执行 ACL，实例目录仍单独读写。外部 Java 文件不复制、不改动、不卸载；外部路径失效或 Daemon 不支持运行时选择时明确失败，不静默切换版本。显式选择的 LFAA 托管版如果被卸载，则按需重装同主版本。
- 新增 `minecraft-java-runtime-selection-v1` 能力以门控新旧 Daemon，自动管理仍复用现有 LFAA 托管 Java 安装流程。数据库迁移版本 21 保存实例所选运行时 ID。同步更新 `docs/系统总体架构.md` 和 `docs/开发计划.md` 的运行时及沙盒边界描述。
- 前后端 TypeScript 类型检查、Daemon `node --check`、Rust Windows x64 `cargo check` 和 `cargo fmt --check` 均通过；未运行测试套件。Windows AppContainer 对外部 Java 目录的实际访问仍需在目标 Windows 主机验收。

## LFAA-UI-WORKBENCH-DEFAULTS-01

### 用户目标

工作台两侧默认展开栏宽略微缩小，并让右侧工具与资源栏默认收起。

### 当前合同

- 调整工作台左、右栏的默认初始宽度；左栏最小展开尺寸降至 200px 以支持指定默认范围，保留最大可拖宽度、吸附收起、响应式布局和用户主动调整的自定义宽度。
- 桌面端首次布局默认收起右侧工具与资源栏；历史默认展开状态迁移为收起一次，用户之后主动展开或收起的选择在刷新后保留。
- 将已保存宽度中与旧默认值相同的值迁移为新默认值；不同于旧默认值的用户自定义宽度继续保留。
- 不改侧栏内容、应用导航、底部终端、业务能力或设置项；不引入依赖、图片、动效或新的用户设置字段。
- 完成标准：新用户和旧默认布局显示更窄的左右栏，右栏默认收起；用户手动调整后刷新仍保留其自定义布局；前端 TypeScript 检查与构建通过。

### 允许修改

- `frontend/src/workbench/workbench-layout.config.ts`、`frontend/src/workbench/workbench-preferences.ts`、`frontend/src/workbench/ResizableWorkbench.tsx`、`frontend/src/workbench/workbench-layout.types.ts`：调整默认尺寸并兼容迁移旧布局偏好。
- `frontend/src/components/ApplicationWorkspace.tsx`、`frontend/src/components/SettingsPage.tsx`：向共享工作台传递迁移所需的实际容器宽度。
- `docs/PROMPTS.md`：维护本任务合同与完成记录。

### 禁止修改

- 不修改侧栏业务内容、应用功能、API、数据库、账户设置、CSS 变量或其他页面视觉样式。
- 不清空用户布局，不覆盖与旧默认值不同的自定义尺寸；不部署、发布、上传或提交 Git。

### 验收方式

- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与 Vite 构建通过，产物写入根目录 `dist/frontend/`。
- 静态核对旧布局迁移、新默认收起以及手动展开后的持久化路径；能访问当前浏览器时再做页面目视检查，否则明确报告未完成。

### 完成记录（2026-09-28）

- 左栏默认初始宽度改为 200–340px，右栏改为 240–340px；只迁移与旧默认宽度相同的历史值，其他已保存栏宽继续保留。旧版工具与资源栏状态迁移到新版偏好时默认收起；之后手动展开或收起由新版偏好保存，默认“三列”布局不会在初次载入时再次自动展开右栏。
- `pnpm --filter lfaa-frontend run build` 通过，包含 `tsc --noEmit` 与 Vite 构建，产物位于根目录 `dist/frontend/`。静态核对确认布局状态迁移和新开合偏好保存路径。
- 未完成浏览器目视验收：浏览器连接检查返回 `nodeRepl.fetch request failed`。当前目录没有 Git 元数据，无法提供 Git 变更状态或运行 `git diff --check`。仓库未提供 `scripts/workspace-preflight.mjs` 或 `quality:full` 门禁。

### 用户进一步反馈（2026-09-28）

- 用户希望左侧栏默认展开后再窄一些，同时不影响刚修复的吸附拖动卡顿。
- 本轮只把左栏初始宽度响应比例从 18% 调为 16%；最小展开宽度仍为 200px，最大拖动宽度仍为 340px。
- 历史持久化宽度仅在等于上一版 18% 默认值时迁移到新默认；其他用户自定义宽度保持不变。保持左右栏拖拽、阻尼、吸附和释放动画实现不变。

### 本轮允许修改

- `frontend/src/workbench/workbench-layout.config.ts`：更新左栏初始宽度比例并提供上一版默认宽度的迁移计算。
- `frontend/src/workbench/workbench-preferences.ts`：只迁移等于上一版默认宽度的共享左栏偏好。
- `frontend/src/workbench/ResizableWorkbench.tsx`：升级布局默认值版本并迁移等于上一版默认宽度的布局状态。
- `docs/PROMPTS.md`：更新本轮合同和完成记录。

### 本轮禁止修改

- 不调整左栏最小/最大尺寸、左右栏吸附行为、拖拽阻尼、CSS 过渡或动画参数。
- 不覆盖任何不等于上一版默认值的用户自定义宽度，不改右栏、底部栏或业务内容。

### 本轮完成记录（2026-09-28）

- 左栏默认初始宽度比例从 18% 调至 16%；200px 最小展开宽度和 340px 最大拖动宽度保持不变。
- 布局状态版本升级到 3，并将共享宽度键升至 v3。只把恰好等于上一版 18% 默认宽度的已保存值迁移为新默认值；其他自定义宽度继续保留。
- 未修改吸附拖动、阻尼和 CSS 过渡代码；`pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查与 Vite 构建，产物位于根目录 `dist/frontend/`。
- 未进行浏览器目视和拖拽手感验收。

## LFAA-MINECRAFT-TASK-RECOVERY-01

### 用户目标

修复当前数据库迁移测试仍断言版本 9、而程序已迁移到版本 10 的问题；避免 Minecraft Daemon 中断后，已领取任务永久停留在 `running`。

### 当前合同

- SQLite schema 以当前版本 10 为基线，新增版本 11 迁移保存 Minecraft 任务租约到期时间，不重建或删除现有用户、实例、任务或日志数据。
- Daemon 心跳上报当前进程实际持有的任务 ID；server 只为同一节点上仍为 `running` 的任务续租。任务领取时先将已过期任务标记为失败，并说明执行结果未确认。
- 租约过期任务不得自动重新执行；安装、启动、停止等可能已有部分副作用的操作必须由用户检查真实节点状态后再决定后续操作。实例状态不确定时保持 `unknown`，不得以猜测写成已停止或成功。
- Daemon 重启后不得把残留安装标记误报为当前仍在安装；只清理能确认属于旧进程的标记，不改变 Windows Sandbox Host、AppContainer、Job Object 或 Java 启动安全边界。
- 更新版本 8 迁移测试以覆盖当前完整迁移链，并新增隔离临时数据库的任务租约行为测试；通过根目录与 server 测试脚本可运行，不访问仓库 `data/` 运行数据。
- 完成标准：迁移到版本 11 并可重复启动；活跃任务续租；无心跳且租约到期的任务变为失败且不会自动重派；相关回归测试及 `pnpm build` 通过。

### 允许修改

- 根 `package.json`、`server/package.json`：提供根目录与 server 的测试命令。
- `server/src/database.ts`、`server/src/api/routes.ts`、`server/src/modules/tasks/minecraft-queue.ts`：版本 11 迁移、心跳租约续期、过期任务收敛及实例不确定状态。
- `daemon/src/task-runner/minecraft-daemon.mjs`：只上报当前活动任务 ID，并处理重启后可识别的旧安装标记；保留现有 Sandbox Host 启动与停止实现。
- `server/test/database-migrations.test.mjs`、`server/test/minecraft-task-leases.test.mjs`：修正迁移预期并覆盖隔离租约行为。
- `docs/PROMPTS.md`、`docs/系统总体架构.md`、`docs/开发计划.md`：登记任务合同并同步迁移版本与恢复语义。

### 禁止修改

- 不自动重放任何已领取的 Minecraft 副作用任务，不放宽任务节点绑定或 Daemon 身份校验。
- 不改变 Minecraft EULA、安装工件校验、AppContainer/Job Object、任意命令限制或实例文件权限边界。
- 不触碰仓库 `data/` 运行数据，不实现远程多节点调度、通用重试/取消系统或与本任务无关的功能；不部署、发布、上传、购买或提交 Git。

### 验收方式

- 在临时 `LFAA_DATA_DIR` 中运行根目录 `pnpm test`，确认旧版本迁移、租约续期、租约到期失败和重复启动行为。
- 运行 `pnpm build`，确认前端、server、daemon 检查通过且构建产物仅写入根目录 `dist/`。
- 静态核对 Sandbox Host 安全路径未被改动；不运行真实 Minecraft 世界任务。

### 完成记录（2026-09-28）

- SQLite 版本 8 兼容测试现检查完整升级至 schema 11、租约字段存在、既有授权数据保留，并验证重复启动不重复破坏数据；另以版本 10 任务数据验证迁移保留记录、为运行任务设置 30 秒宽限且不为排队任务续租。
- Daemon 心跳上报当前活动任务 ID，server 仅续租本节点仍在运行的任务；未带该字段的旧心跳按空列表处理，避免直接拒绝节点心跳，但不会续租旧 Daemon 正在执行的任务。租约过期后任务失败并保存 `{ outcome: "unknown" }`，实例转为未知状态，不自动重放；Daemon 重启后会把不属于当前活动任务的残留安装标记按未知状态上报。
- `pnpm test` 通过（5 项）；`pnpm build` 通过，覆盖前端构建、server TypeScript 构建和 Daemon 语法检查，产物写入根目录 `dist/`。已尝试 `node scripts/workspace-preflight.mjs`，但仓库没有该脚本；也没有 `.git` 元数据可供 `git diff --check`。未运行真实 Minecraft 任务；Sandbox Host 与 Java 启动路径未修改。

## LFAA-UI-WORKBENCH-SNAP-01

### 用户目标

排查并修复工作台左右栏吸附收起、吸附后反向拖出时的卡顿和拖尾感。

### 当前合同

- 左右栏拖动按 Pointer 事件逐帧合并后直接更新宽度，不在指针停下后继续追赶；吸附触发时只播放一次列宽收拢动画，同时立即隐藏侧栏内容，不显示半透明内容残影。
- 左右栏拖拽、反向展开期间不运行透明度或位移追赶动画；保留吸附阈值、迟滞和展开状态提交语义。
- 取消左右栏连续阻尼追赶和自续排 RAF；不调整吸附阈值、迟滞、默认宽度或底部面板阻尼。
- 完成标准：左右栏拖动紧跟 Pointer、停下后不再有追赶帧；吸附时内容立即隐藏、列宽只收拢一次且无透明度/位移拖尾；前端 TypeScript 检查与构建通过。
- 左侧应用列表、应用菜单和会话列表只允许纵向滚动；吸附收起/展开经过窄宽度时不出现横向滚动条。

### 允许修改

- `frontend/src/workbench/workbench.css`：修复吸附预览时侧栏越界绘制和拖拽动画叠加；左右栏拖拽全程直接跟随 Pointer，吸附时立即隐藏内容并只播放一次列宽收拢。
- `frontend/src/workbench/ResizableWorkbench.tsx`：仅在 CSS 修复不能解决时调整拖拽状态清理；不改吸附计算与提交语义。
- `frontend/src/components/module-workbench.css`：限制左侧应用列表、应用菜单和会话列表为纵向滚动，避免宽度过渡中的横向滚动条。
- `docs/PROMPTS.md`：登记本任务合同与完成记录。

### 禁止修改

- 不修改吸附阈值、释放迟滞、默认宽度、持久化布局或底部栏阻尼和交互。
- 不移除左栏必要的纵向滚动，不改业务内容、默认宽度、吸附阈值或迟滞；不改底部面板动画。
- 不新增依赖、CSS 自定义属性或其它视觉效果；不部署、发布、上传或提交 Git。

### 验收方式

- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与 Vite 构建通过，产物写入根目录 `dist/frontend/`。
- 静态核对普通拖动直接应用最新 Pointer 尺寸、吸附及反向展开无侧栏内容残影或动画追赶、左栏内部纵向滚动区不再显示横向滚动条；浏览器交互检查无法执行时明确报告。

### 完成记录（2026-09-28）

- 移除左右栏吸附捕获和反向释放期间对 `grid-template-columns` 的 CSS 过渡；保留栏内淡出/位移和松手后收起归位动画，避免它们与 `ResizableWorkbench` 的逐帧阻尼重复追逐列宽。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查与 Vite 构建，产物写入根目录 `dist/frontend/`。静态核对确认左右栏拖动捕获/释放选择器不再覆盖 Grid 列宽过渡。
- 未进行浏览器拖拽手感验收。

### 用户补充反馈（2026-09-28）

- 用户指出左栏吸附收起与重新展开过程仍出现横向滚动条。代码检查发现应用列表、左侧菜单和会话列表的 `overflow: auto` 同时启用了横纵滚动；栏宽暂时小于内容时会显示横向滚动条。
- 本轮仅将上述滚动区限定为纵向滚动，保留其纵向滚动能力和已修复的吸附动画。

### 本轮完成记录（2026-09-28）

- 左侧应用列表、Minecraft 菜单和 AI Work 会话列表均改为横向溢出隐藏、纵向滚动保留；未改吸附阈值、阻尼、动画或默认宽度。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查与 Vite 构建，产物写入根目录 `dist/frontend/`。静态核对确认三个左栏纵向滚动区均不再启用横向滚动。
- 未完成浏览器实拖验收：当前浏览器工具返回 `nodeRepl.fetch request failed`。

### 用户再次反馈（2026-09-28）

- 用户反馈收起时仍有明显卡顿和拖尾，担心多层动画或重复绘制。
- 源码确认左右栏仍有 72ms 阻尼以及偏差超过 0.35px 后自续排的 RAF；因此指针停下后仍持续写入 Grid 尺寸，形成追尾。本轮移除这条连续追赶路径，恢复逐个浏览器帧直接跟随 Pointer，并仅在吸附捕获时启用一次固定目标的 Grid 过渡。
- 不改吸附参数、横向溢出修复、默认宽度和底部面板阻尼。

### 本轮完成记录（2026-09-28）

- 左右栏拖动移除 72ms 阻尼和偏差阈值自续排 RAF，仍按 `requestAnimationFrame` 合并 Pointer 事件；指针停下后不会继续写入宽度。吸附捕获时仅播放一次目标为 0 的 Grid 过渡，反向拖出直接跟随 Pointer。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查与 Vite 构建，产物写入根目录 `dist/frontend/`。静态核对确认 `flushPending` 不再递归调度，底部面板原有阻尼保持不变。
- 浏览器实拖未完成：`agent-browser` 的独立会话落在登录页；当前浏览器连接返回 `nodeRepl.fetch request failed`，没有自动输入账户凭据。

### 用户再次反馈（2026-09-28）

- 用户提供的实机照片显示吸附收起过程出现侧栏内容半透明残留，并指出收起效果仍有明显拖尾。
- 源码确认吸附预览将整个侧栏降至 28% 不透明度并向画布位移，左侧 Pane 还允许内容越界绘制；Pointer 拖拽时同时额外开启 260ms Grid 列宽过渡，造成侧栏内容残影与拖动反馈滞后。
- 本轮取消左右栏吸附期间的 Grid 和内容过渡；进入吸附预览时立即隐藏侧栏内容，并确保拖拽规则不能重新显示已收起或正在吸附的 Pane。保留底部面板的现有动画与左右栏吸附阈值、迟滞。

### 用户继续询问（2026-09-28）

- 用户对比设置中心与应用工作区的侧栏吸附手感，询问是否共用同一实现以及卡顿差异。
- 两处共用 `ResizableWorkbench`；应用工作区的 `.module-sidebar` 在半透明侧栏设置下实时采样并模糊背景，设置中心的 `.settings-sidebar` 则明确关闭 `backdrop-filter`，避免滚动/绘制成本。
- 本轮允许在左栏 Pointer 拖拽期间临时关闭应用侧栏的背景模糊采样；空闲时视觉维持现状。吸附仍直接跟随 Pointer，不增加动画。

### 用户指出吸附效果被移除（2026-09-28）

- 用户反馈取消所有列宽过渡后，吸附收起变成瞬间消失，原有吸附收拢效果不见了。
- 本轮恢复一次固定零宽目标的列宽收拢过渡；侧栏内容仍立即隐藏，透明度/位移过渡及拖动期间实时模糊采样保持关闭，避免恢复残影和拖尾。

### 本轮完成记录（2026-09-28）

- `frontend/src/workbench/workbench.css`：左右栏拖拽/吸附/反向展开期间不再额外过渡列宽、透明度或位移；吸附预览立即隐藏 Pane 内容，并限制拖动态可见规则，避免左侧 overflow-visible 将内容画到主区。
- `frontend/src/components/module-workbench.css`：仅在应用左栏拖拽期间关闭应用侧栏的实时背景模糊采样。
- 左右栏吸附阈值、迟滞、展开提交、底部面板动画和先前的横向滚动修复均保持不变。
- `pnpm --filter lfaa-frontend run build` 未通过 TypeScript 检查：`MinecraftWorkspace.tsx` 存在未使用变量，`SettingsPage.tsx` 存在声明前引用，`Workbench.tsx` 传入不受 `ApplicationWorkspaceProps` 接受的 `userId`；错误均位于本轮未修改的文件。单独运行 `pnpm --filter lfaa-frontend exec vite build` 通过，产物位于根目录 `dist/frontend/`。
- 设置页和应用工作区共用 `ResizableWorkbench`；设置页点击收起按钮是一次状态切换，不经过拖拽吸附帧。设置页禁用了侧栏背景模糊，应用左栏则会在 Pointer 拖拽时临时禁用该采样。
- 浏览器登录态无法通过当前自动化连接访问，未完成实机吸附/反向展开验收；当前目录无 Git 元数据，无法运行 `git diff --check` 或提供 Git 差异状态。

### 本轮补充完成记录（2026-09-28）

- `frontend/src/workbench/workbench.css`：吸附预览恢复单次 `grid-template-columns` 收拢动画；栏内内容立即隐藏，不恢复半透明和位移动画。
- `pnpm --filter lfaa-frontend exec vite build` 通过，Vite 产物写入根目录 `dist/frontend/`。完整前端构建仍被前述其他文件的 TypeScript 错误阻塞，浏览器实拖仍待验。

## LFAA-UI-COMPOSER-PANE-SWAP-01

### 用户目标

参考 Codex 对话输入框的清晰层级和操作布局，优化 LFAA 共享 AI Work 输入区；增加桌面工作台中间区与右侧工具资源栏的位置交换功能。

### 当前合同

- 三款应用共用同一 AI Work 输入区；保留实际活动 Provider/模型信息、最多 12000 字符、账户配置门槛、当前发送快捷键、流式发送和停止行为。
- 输入区采用清晰的上下文信息、消息编辑区和 Codex 风格底部操作栏，并适配当前主题、背景、紧凑布局与窄屏。
- 对话消息列与输入框共用居中的最大宽度（920px）；助手消息从列内左侧开始，用户消息继续靠列内右侧对齐，避免回复横跨整个画布。
- 底部操作栏显示并接通现有活动模型选择、AI Runtime 快速/平衡/深入档位、权限模式；模型和设置变更调用现有 API，并同步工作台设置状态；切换完全权限前保留二次确认。
- 附件和语音宿主目前未接入 AI 会话；对应入口可按参考布局显示为禁用状态，并说明尚未接入，不得接收后丢弃素材或伪装语音功能。
- 仅桌面双 Dock 布局提供中间区与右侧工具资源栏交换按钮；使用现有右栏宽度、拖拽和收起状态，刷新后沿用工作台 Chrome 偏好保存交换状态。
- 交换时视觉顺序与 DOM/键盘顺序一致；右栏收起时中心内容仍占满主区，重新展开后恢复交换位置。紧凑和移动布局继续使用现有右栏浮层行为，不提供交换操作。
- 完成标准：输入、快捷键、发送/停止、字符上限和无 Provider 状态保持正确；底部模型/推理档位/权限模式可用且持久化，附件/语音入口明确禁用；对话消息列与输入框居中对齐；桌面可交换并恢复布局；前端 TypeScript 检查与构建通过；未执行的浏览器目视验收明确记录。

### 允许修改

- `frontend/src/components/AiWorkChat.tsx`、`frontend/src/components/ai-work-chat.css`、`frontend/src/components/workbench/shared/WorkbenchIcon.tsx`：调整共享 AI Work 输入区、底部真实操作控件与图标。
- `frontend/src/components/ApplicationWorkspace.tsx`、`frontend/src/components/Workbench.tsx`：把已保存设置变更同步回共享工作台状态。
- `frontend/src/components/ApplicationWorkspace.tsx`、`frontend/src/components/module-workbench.css`：持有和呈现桌面交换偏好。
- `frontend/src/workbench/ResizableWorkbench.tsx`、`frontend/src/workbench/workbench-layout.types.ts`、`frontend/src/workbench/workbench.css`：为共享工作台增加可选的中间/右栏交换呈现与分隔按钮。
- `docs/PROMPTS.md`、`docs/开发计划.md`：维护本任务合同与实际结果。

### 禁止修改

- 不新增 API、数据库、Provider、Agent Runtime 或 AI Work 业务能力；只调用已有的模型、设置保存 API。
- 不新增依赖、CSS 自定义属性、假交互、占位数据、图片或无关动效。
- 不改变全局主导航、应用左侧菜单、右栏资源内容、紧凑/移动浮层行为和已有面板拖拽规则。
- 不部署、发布、上传、购买或提交 Git。

### 验收方式

- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与 Vite 构建通过，产物写入根目录 `dist/frontend/`。
- 静态核对输入区真实 Provider 状态、快捷键/字符限制/发送/停止路径，以及桌面交换、收起恢复、DOM 顺序和小屏不交换行为。
- 能访问当前浏览器时再做页面目视检查，否则明确报告未完成。

### 完成记录（2026-09-28）

- AI Work 输入框现显示真实应用上下文和活动 Provider/模型，保留 12000 字符限制与配置门槛；发送快捷键提示、圆形发送/停止按钮和自动扩展编辑区与现有发送逻辑一致。
- 回复消息列已与输入框共用 920px 居中宽度；助手消息左对齐、用户消息右对齐仍在同一内容列内。
- 桌面双 Dock 分隔处增加左右窗格交换按钮；交换后 DOM 顺序与视觉顺序一致，工作台本地偏好保存位置。右栏收起时聊天恢复占满中心区，重新展开恢复交换；紧凑/移动布局保留原浮层。
- `pnpm --filter lfaa-frontend run build` 通过，包含 `tsc --noEmit` 与 Vite 构建，产物写入根目录 `dist/frontend/`。
- 未执行浏览器目视验收。当前目录没有 Git 元数据，无法核查完整 Git 变更状态或运行 `git diff --check`。

### 用户补充反馈（2026-09-29）

- 用户指出 Codex 输入框底部操作栏没有对应到 LFAA；截图中 LFAA 仅有快捷键提示和发送按钮。

### 本轮补充完成记录（2026-09-29）

- 输入框底部现提供真实权限模式、已保存模型和 Runtime 推理档位选择，并同步保存回工作台；切换完全权限保留二次确认。附件和语音入口按未接入能力显示禁用状态与说明。
- `pnpm --filter lfaa-frontend run build` 通过，包含 `tsc --noEmit` 与 Vite 构建，产物写入根目录 `dist/frontend/`。
- 未完成浏览器目视验收：浏览器连接返回 `nodeRepl.fetch request failed`。当前工作树没有 `scripts/workspace-preflight.mjs` 或 Git 元数据，未能运行该预检脚本或 `git diff --check`。

## LFAA-UI-AI-PERMISSION-POPOVER-01

### 用户目标

将 AI Work 输入区的 LFAA 权限模式切换菜单整理为紧凑、轻量的弹层；清楚呈现项目现有“请求审批 / 替我审批 / 完全权限”三种模式，而非借用其他产品或额外工具权限提示的语义。参考用户提供的紧凑菜单截图，并继承外观设置。

### 当前合同

- 保留账户级 `permissions.mode` 三种既有选项及真实保存流程；保留切换“完全权限”前的二次确认。
- 模式说明必须以当前 LFAA 设置页和 server 行为为准，不能复制其他产品的权限语义，也不能暗示 LFAA 未开放的能力。
- 弹层挂载在 `.workbench-shell` 内，使用现有主题、强调色、字体、字号、对比度、壁纸遮罩透明度、模糊和减少动态效果映射；不新增设置字段、CSS 自定义属性或硬编码主题色。
- “权限说明”入口可打开现有设置中心“用户与权限”页面；不改变授权规则、审批流程或会话数据。
- 标题使用“权限模式”，不称为“工具权限模式”；三种模式作为一组紧凑列表呈现，不再使用占空间较大的卡片式选项和图标底板。
- 三种模式文案以“用户与权限”设置页、server `authorizeAiTool` 和 `LFAA-AI-PERMISSION-MODE-EXECUTION-02` 为准；“完全权限”下当前已接入工具由模型按指令直接执行，不逐项审批。
- 完成标准：三种选项文字、图标、说明和选中态可读；弹层在浅/深色、壁纸和用户字号/字体设置下继续使用共享令牌；原有持久化与完全权限确认保持不变；前端构建及差异检查通过；浏览器目视验收如未运行须明确说明。

### 允许修改

- `frontend/src/components/AiWorkChat.tsx`：呈现权限模式选项、当前选择和现有设置页说明入口。
- `frontend/src/components/ai-work-chat.css`：定义该弹层的局部布局、状态和外观令牌适配。
- `docs/PROMPTS.md`：维护本任务合同及实际验证记录。

### 禁止修改

- 不改权限模式类型/默认值/API、server 授权和审批、模式保存与完全权限二次确认。
- 不新增设置项、依赖、全局设计令牌、图标包、模拟能力或与弹层无关的布局/动效。
- 不修改其他 AI Work 操作菜单、消息区、工作台尺寸、导航、后端和 Daemon。
- 不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对菜单仍绑定 `settings.permissions.mode` 与既有 `saveSettings`，切换 `full_access` 仍调用既有二次确认；“权限说明”打开当前权限设置分类。
- 运行 `pnpm --filter lfaa-frontend run build`，确认构建产物只写入根目录 `dist/frontend/`；执行 `git diff --check`。
- 检查当前运行浏览器可达性；能登录时目视核对菜单位置、主题和外观映射，否则如实记录未完成的验收。

### 完成记录（2026-09-29）

- `frontend/src/components/AiWorkChat.tsx`：权限模式选择器增加说明标题、到“用户与权限”的入口、三种模式图标/说明与当前选择标记；仍调用原有账户设置保存流程，并保留“完全权限”二次确认。
- `frontend/src/components/ai-work-chat.css`：为卡片弹层和选项行补充局部样式；弹层挂入 `.workbench-shell`，沿用主题、强调色、字体/字号、对比度、壁纸遮罩透明度、模糊和减少动态效果设置，没有新增设置项或 CSS 自定义属性。
- `pnpm --filter lfaa-frontend run build` 通过，包含 `tsc --noEmit` 和 Vite 构建；产物位于根目录 `dist/frontend/`，未生成包内构建目录。
- `git diff --check -- frontend/src/components/AiWorkChat.tsx frontend/src/components/ai-work-chat.css docs/PROMPTS.md` 通过。
- 未完成浏览器目视验收：开发页端口 5173 正在监听，但浏览器连接返回 `nodeRepl.fetch request failed`，没有取得可检查的页面或登录态；未运行测试套件。
- 当前仓库没有 `scripts/workspace-preflight.mjs`、`quality:full` 或 release Gate 脚本，因此这些 Gate 无法运行。

### 用户反馈修订合同（2026-09-29）

- 用户指出上版菜单视觉过大，且“工具权限模式”标题没有表达 LFAA 项目真实权限模式。本次目标为紧凑菜单，并明确展示 `permissions.mode` 对应的三项既有模式。
- 只允许调整 `AiWorkChat.tsx` 中的模式标题、真实模式说明和无障碍文案，以及 `ai-work-chat.css` 的弹层/选项局部尺寸与布局；同步记录本轮结果。
- 保留 `permissions.mode` 类型、默认值、`saveSettings` 持久化、“完全权限”二次确认和 server 授权语义；不接入新设置，不新增 CSS 自定义属性或硬编码主题色。
- 使用已映射的主题、强调色、界面字体与字号、对比度、壁纸遮罩/模糊和减少动态设置；三项说明准确反映 LFAA 执行语义，完全权限具体行为以 `LFAA-AI-PERMISSION-MODE-EXECUTION-02` 为准。
- 验证前端构建和 `git diff --check`；不运行测试套件。若当前浏览器可访问，核对实际弹层高度、文案、选中态和主题，否则记录未目视验收。

### 本轮调整与验证记录（2026-09-29）

- `AiWorkChat.tsx` 将标题改为“LFAA 权限模式”，继续呈现并保存 `ask`、`approve_remembered`、`full_access`；说明按项目实际授权语义收短，并保留“完全权限”二次确认。
- `ai-work-chat.css` 将最大宽度收至 360px、选项高度收至 42px，改为紧凑列表并移除大图标底板。字体字号、主题/强调色、对比度、壁纸遮罩、模糊继续使用工作台既有设置映射；未新增 CSS 变量或设置项。
- `pnpm --filter lfaa-frontend run build` 通过，`git diff --check` 通过；构建产物位于根目录 `dist/frontend/`。
- 本轮未运行测试套件，也未完成浏览器目视验收；当前可用的 Codex IAB 没有打开标签，未在登录态页面核对实际弹层，也未尝试登录或更改权限值。

## LFAA-OBS-SERVER-LOGS-01

### 用户目标

记录开发终端中重复请求与认证日志的观察事项，暂不修改实现；先判断这些请求是否只随正常页面操作出现，还是会在页面空闲时重复触发。

### 当前合同

- 已观察到短时间内多次 `PUT /api/preferences`，并伴随 `GET /api/ai/sessions` 与 `GET /api/settings/ai/accounts`；另有两组相隔约 16 秒的 `GET /api/auth/setup-status` 和 `GET /api/auth/me`，后者返回 `401`。
- 当前调用路径显示偏好保存由打开/切换应用或模式触发，AI 会话与账户读取由 AI Work 面板挂载或应用切换触发；`/auth/me` 的定时复核仅在已有登录用户时运行。现有日志不足以证明代码故障。
- 先观察页面不操作、不刷新、不重新聚焦，且 server 持续在线时是否再次出现这些请求组合。若复现，记录时间、请求发起方及当时登录状态，再定位触发路径；未复现时按正常页面操作/未登录检查记录并关闭观察项。
- 完成标准：确认空闲复现与否并把证据写回 `docs/开发计划.md`；若确认是实现缺陷，另开精准修复任务及合同后再改代码。

### 允许修改

- `docs/开发计划.md`、`docs/PROMPTS.md`：维护观察状态和结论。
- 只读检查 `frontend/src/App.tsx`、`frontend/src/components/AiWorkChat.tsx` 与相关 API 调用。

### 禁止修改

- 观察完成前不修改前端、server、API、数据库或日志级别，不通过隐藏日志处理现象。
- 不为观察项运行测试、构建或重启服务；不部署、发布、上传或提交 Git。

### 本轮范围调整（2026-09-28）

- 用户明确要求单独优化应用切换体验；允许 `LFAA-UI-APP-CONTEXT-01` 修改其列出的前端工作区状态与展示文件。
- 此授权不关闭本观察项，也不允许修改偏好请求发起逻辑、server/API 或日志；空闲请求观察仍需单独完成。

## LFAA-P4-MINECRAFT-MVP-01

### 用户目标

先完成 Minecraft 应用，再开始 SteamCMD 与写作应用。明确“应用”与“模式”的关系：应用提供自己的菜单、工作台和业务流程；常规与 AI Work 是该应用内的两种交互方式。Minecraft AI Work 复用现有 LFAA AI Runtime 和活动 Provider，通过 Minecraft 应用上下文与独立会话工作，不复制一套模型服务。

### 当前合同

- 工作台最左侧全局导航保持跨应用一致；进入 Minecraft 后，第二栏切换为 Minecraft 专属菜单，应用选择留在该栏顶部；常规/AI Work 切换保持在工作区标题栏。
- Minecraft 常规工作台按“总览、实例、Java 环境、任务”组织；选中实例后提供该实例自己的概览、配置、日志和世界备份视图。日志视图只展示 Daemon 回传内容，不提供任意命令输入。任务是可追踪的真实后端状态，不用演示数据。
- 首个可验收目标暂定本机 Windows x64 Daemon、Minecraft Java Edition、官方 Vanilla 服务端；远程 Daemon、其他系统、Bedrock、Paper/Spigot/Fabric/Forge、插件和复杂升级迁移不属于本合同。
- 游戏版本/服务端工件和 Java 发行版仅使用官方来源；下载前验证来源、大小与官方摘要/校验值。Minecraft EULA 必须在首次下载前展示并取得明确同意，不能由 AI 权限模式替代。
- 前端只调用 server API。server 持有身份授权、Minecraft 业务校验、节点/任务状态与控制面元数据；daemon 在目标主机执行已登记的 Minecraft/Java 操作，并独占实例文件、运行进程、日志和世界备份。
- 实例路径由 daemon 按实例 ID 在数据根目录内生成；不接收任意本机路径，不把 Minecraft 文件、存档或日志写进仓库源码或 `dist/`。
- 仅具备当前 server 管理员角色的账户可执行安装、创建、启动/停止、配置写入和备份等副作用操作；所有状态以 server/daemon 实际返回为准。
- AI Work 使用现有会话/Provider/权限基础并保留 `appId=minecraft` 的上下文隔离。Agent Loop 或真实 Minecraft AI 执行工具只有在其调用真实 Minecraft 业务服务、节点 Runner 并经授权后才能开放；本任务不提供模拟执行结果。
- 执行顺序按用户明确优先级调整为 Minecraft → SteamCMD → 写作；只做支撑 Minecraft 闭环所需的节点与任务能力，不在本任务实现 SteamCMD 或写作业务。
- 完成标准：进入 Minecraft 后有专属菜单和工作台；至少一个受支持节点能显示真实状态；用户可查看官方版本/Java 环境、创建 Vanilla 实例、显式同意 EULA 后启动、查看运行状态/日志、停止、修改受支持的 `server.properties` 字段并为停止中的世界创建安全备份；刷新后实例与任务状态仍来自 server/daemon 数据。

### 允许修改

- `frontend/src/components/`、`frontend/src/styles/`、`frontend/src/api.ts`：通用工作台中的 Minecraft 导航、视图与真实 API 交互；保持现有 Ant Design、用户主题和响应式布局。
- `server/src/api/routes.ts`、`server/src/database.ts`、`server/src/modules/games/minecraft/`、`server/src/modules/nodes/`、`server/src/modules/tasks/`：认证 API、迁移、Minecraft 业务规则和本合同所需的节点/任务控制面。
- `daemon/package.json`、`daemon/src/connection/`、`daemon/src/task-runner/`、`daemon/src/runners/minecraft/` 与确有需要的 `daemon/src/process-manager/`、`daemon/src/monitoring/`：受认证、限权的节点连接和 Minecraft 本地执行。
- 根 `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml` 以及启动/构建配置：只接入和输出到根 `dist/` 所需的 daemon 命令与依赖。
- `docs/PROMPTS.md`、`docs/开发计划.md`、`docs/系统总体架构.md`、`README.md`：登记合同、调整应用实施顺序并同步真实能力和限制。

### 禁止修改

- 不实现 SteamCMD、写作业务、通用插件市场、第三方可执行插件、Bedrock、Paper/Spigot/Fabric/Forge、复杂多实例升级迁移或生产发布。
- 不把节点执行放进 Vite、浏览器或 Minecraft AI 聊天进程；不绕过 server 授权直接控制 daemon。
- 不提供任意 Shell、任意文件路径、URL 指定目标或浏览器本地凭据存储；不向日志、URL 或普通 API 响应泄露节点凭据。
- 不伪造节点在线、安装进度、实例运行状态、日志、玩家数、资源用量或备份成功状态。
- 不在未接入真实 Minecraft Runner 前开放会执行副作用的 AI 工具；“完全权限”不绕过业务校验或 EULA 同意。
- 不修改、清理或覆盖用户运行数据，不部署、发布、上传、购买或提交 Git。

## LFAA-SETTINGS-TYPOGRAPHY-01

### 用户目标

统一设置中心不同分类的标题、分组标题和设置条目文字层级；让用户能在“外观”中直接找到字号调整，并通过已有外观偏好驱动共享字号变量。

### 当前合同

- 设置中心各分类共用一致的页面标题、分组标题、条目标题和说明文字字号层级；“常规/通知”与普通分类不得因布局样式类而显示成两套字号。
- 共享字号令牌放在已有的 `frontend/src/styles/tokens.css`；页面样式留在各自职责样式表，不创建重复的通用令牌文件或迁移无关样式。
- 将已有账户级“界面字号”设置从“高级”折叠区提升到外观页常显区域，并让其缩放设置中心的语义字号；保留现有设置字段、范围、保存流程和实时预览。
- 现有 `SettingGroup`、`SettingRow` 等共享组件继续复用；不做与字号一致性无关的组件重构。
- 完成标准：上述四类文字在设置分类间使用共享令牌；字号偏好可在外观页直达并控制这些令牌；前端类型检查与构建通过。

### 允许修改

- `frontend/src/styles/tokens.css`：补齐设置中心使用的共享语义字号令牌。
- `frontend/src/components/Workbench.tsx`：按账户的界面字号为共享令牌提供缩放值。
- `frontend/src/components/SettingsPage.css`、`frontend/src/components/SettingsPage.tsx`：统一设置中心文字层级，并调整字号控件位置。
- `docs/PROMPTS.md`：维护本任务合同与完成记录。

### 禁止修改

- 不搬迁整个前端样式、不创建重复的 `common.css`，不把所有页面的专属样式合并到全局文件。
- 不新增设置字段、API、数据库迁移、依赖、自由格式 CSS 输入或新的字号体系。
- 不改设置分类内容、业务行为、其他页面布局；不部署、发布、上传或提交 Git。

### 验收方式

- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与前端构建通过，产物位于根目录 `dist/frontend/`。
- 检查最终变更范围；如果没有可用的 Git 元数据或浏览器目视验收环境，明确报告限制，不宣称已完成相应核查。

### 完成记录（2026-09-28）

- 设置中心页面标题、分组标题、设置条目标题和说明文字改为使用共用字号令牌；通知页与常规页继续共享布局，但不再覆盖成更大的标题和分组字号。
- 在全局令牌中增加导航标题和页面标题字号，Workbench 按账户已保存的界面字号统一缩放。外观页将界面字号与代码字体大小控件从“高级”折叠区提升至可见的“字体大小”分组，原账户字段、10–24px 与 8–24px 范围、保存和预览路径均保留。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查；构建产物写入根目录 `dist/frontend/`。
- 未执行浏览器目视验收；当前工作目录没有 Git 元数据，无法运行 `git diff --check` 或读取完整 Git 变更状态。当前项目没有 `scripts/workspace-preflight.mjs` 或 `quality:full` 门禁。

## LFAA-SETTINGS-LAYOUT-UNIFICATION-01

### 用户目标

对设置中心全部功能分类进行二次优化，让各分类复用同一套页面宽度、外边距、页头间距、分组容器、设置行尺寸、控件列宽和响应式规则；只为确有不同内容结构的模块保留局部布局。

### 当前合同

- 所有设置分类（含常规、通知、外观、快捷键、AI、用量、插件、权限、账户、存储、开发者和待接入入口）共用统一的内容最大宽度、页面内边距、页头间距、分组间距、标题间距、面板边框/圆角、设置行高度/内边距/列宽、表单控件宽度和底部操作区规则。
- 移除“常规/通知”与其他分类之间的特殊大留白、大行高、大控件列和大开关等重复布局变体；共享 `SettingGroup`、`SettingRow` 和共享字号令牌继续作为通用页面构件。
- 在设置样式职责范围内集中定义带中文说明的 CSS 自定义属性；使用统一值驱动共享布局，避免各分类分别维护相同尺寸。响应式变化由公共断点规则统一处理。
- 主题选择、工作台布局预设、背景图库、快捷键列表、AI Provider 卡片、账户数据表等内容可以保留各自必需的内部排列，但必须使用相同的外层内容宽度、分组标题、容器边框/圆角、间距与断点。
- 保存/恢复操作固定出现在该分类内容末尾；只读页面保持没有虚假的保存操作。
- 不改设置项语义、账户数据、API、权限行为和导航分类；不引入依赖，不进行全站样式迁移。
- 完成标准：全部分类使用同一套外层与标准行布局；剩余变体仅服务于已列出的特殊内容结构；320px 窄屏、中等宽度与桌面宽度下布局均可收缩且不造成横向滚动；前端类型检查与构建通过。

### 允许修改

- `frontend/src/components/SettingsPage.css`：集中设置中心布局变量，统一外层、分组、行、控件、卡片和响应式样式。
- `frontend/src/components/SettingsPage.tsx`：移除分类特有外层布局标记，并将需保存分类的操作区统一置于内容末尾。
- `docs/PROMPTS.md`：维护本任务合同与完成记录。

### 禁止修改

- 不修改设置内容、设置字段、数据格式、API、数据库、权限逻辑、导航顺序和真实能力状态。
- 不把所有前端 CSS 搬入一个全局文件，不重做主题配色，不增加图像、动效或依赖。
- 不修改工作台/侧栏整体架构，不部署、发布、上传或提交 Git。

### 验收方式

- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与前端构建通过，产物位于根目录 `dist/frontend/`。
- 静态核对设置页分类结构、共享布局令牌和剩余特殊变体；如果浏览器或 Git 元数据不可用，明确说明相应目视验收或变更状态限制。

### 完成记录（2026-09-28）

- 移除常规和通知分类的旧专属布局覆盖，使全部设置页共用内容宽度、页边距、页头/分组间距、行高、行内边距、控件列宽、表单高度、面板圆角、卡片内边距和底部操作间距；布局响应式收缩统一由设置页变量驱动。
- 设置页全部可读字体改用 `tokens.css` 中会随账户“界面字号”缩放的共享字号令牌。主题卡片、布局预览、背景图库、快捷键、AI Provider 和账户表格仅保留自身所需的内部网格，并复用统一外层样式；插件与权限页的保存/恢复操作移至内容末尾。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查；Vite 产物写入根目录 `dist/frontend/`。静态核对确认旧的常规/通知布局类已移除；仅保留 LFAA 品牌预览字样按桌面/窄屏切换字号的装饰性特例。
- 未完成登录后设置页及 320px/中等宽度的浏览器目视验收：可访问的本地设置路由显示登录页，且没有可用登录态；未读取或输入账户凭据。当前目录没有 Git 元数据，不能提供完整 Git 变更状态或运行 `git diff --check`。

## LFAA-SETTINGS-SIDEBAR-HEADER-ALIGNMENT-01

### 用户目标

修正设置中心侧栏顶部“返回工作台”与“收起设置导航”按钮错位的问题，让两者沿同一行对齐并保持在侧栏内容边界内。

### 当前合同

- 收起按钮以侧栏标题区域为定位容器，垂直位置与返回按钮一致，水平位置贴合标题区域右侧内容边界。
- 保留返回与收起按钮的现有文字、可访问名称、事件行为和设置导航布局；不改其他分类内容、侧栏宽度或工作台面板尺寸。
- 不新增 CSS 变量、依赖或断点，只修正设置页专属样式。
- 完成标准：顶部两个按钮在桌面侧栏中沿同一水平行对齐且不越出内容边界；前端类型检查与构建通过，产物位于根目录 `dist/frontend/`。

### 允许修改

- `frontend/src/components/SettingsPage.css`：修正收起按钮相对侧栏标题区域的偏移。
- `docs/PROMPTS.md`：维护本任务索引、合同与完成记录。

### 禁止修改

- 不改 `SettingsPage.tsx`、工作台共享布局、侧栏交互、导航内容或其他页面样式。
- 不新增设置项、CSS 变量、依赖、图片或动效；不部署、发布、上传或提交 Git。

### 验收方式

- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与 Vite 构建通过，产物写入根目录 `dist/frontend/`。
- 静态核对按钮定位值与改动范围；浏览器无法访问已登录设置页时，明确说明未完成目视验收。

### 完成记录（2026-09-28）

- 收起按钮从标题栏左上方 8px、右侧 6px 的偏移改为 `top: 0; right: 0`，与返回按钮顶边对齐并留在侧栏标题内容区内；按钮文案与行为未改。
- `pnpm --filter lfaa-frontend run build` 的 TypeScript 检查被两个当前错误阻断：`ApplicationWorkspace.tsx:588` 传入 `AiWorkChatProps` 未声明的 `draft`，以及 `ResizableWorkbench.tsx:712` 找不到 `WorkbenchIcon`。随后单独执行 `pnpm --filter lfaa-frontend exec vite build` 通过，CSS 产物写入根目录 `dist/frontend/`。
- 未完成登录后浏览器目视验收：本轮浏览器状态读取返回 `nodeRepl.fetch request failed`。当前目录没有 Git 元数据，无法运行 `git diff --check` 或读取完整 Git 变更状态。

## LFAA-FRONTEND-CSS-SHARED-01

### 用户目标

建立容易查找的前端公共 CSS 文件入口，把真正跨多个独立组件复用的加载状态、服务状态和页面错误提示集中维护；保留设计变量与页面/组件样式各自的职责。

### 当前合同

- `frontend/src/styles/tokens.css` 继续作为全局颜色、字号、间距和字体变量的唯一来源，不新增重复令牌文件。
- 新增 `frontend/src/styles/common.css`，只收纳有多个独立组件真实复用的通用状态样式；本任务将 `loading-page`、`loading-indicator`、`service-status` 和 `page-alert` 从 `base.css` 移入该文件。
- `base.css` 只保留盒模型、文档背景、原生控件字体、键盘焦点等文档级基础样式；`main.tsx` 是全局 CSS 的单一导入入口，公共样式只导入一次并保持基础样式先于页面专属样式。
- `pages.css`、`responsive.css`、工作台样式、设置中心样式及其他组件样式继续由原有职责文件维护；不将仅在一个页面/组件使用的样式提升为全局样式。
- `docs/系统总体架构.md` 记录上述前端 CSS 所有权与加载规则；不改变页面结构、主题、断点、交互和业务行为。
- 完成标准：公共状态类在唯一 `common.css` 中定义、由 `main.tsx` 导入一次；基础与组件专属样式边界清晰；前端构建通过。

### 允许修改

- `frontend/src/styles/common.css`：新增跨组件共享状态样式。
- `frontend/src/styles/base.css`：移出上述共享状态样式，保留文档级基础样式。
- `frontend/src/main.tsx`：在全局样式导入顺序中加入公共 CSS。
- `docs/系统总体架构.md`、`docs/PROMPTS.md`：记录前端样式职责和任务验收结果。

### 禁止修改

- 不迁移或重写所有前端 CSS，不把设置中心、应用工作区、AI Work 或认证页面的专属规则放入公共文件。
- 不新增重复设计令牌、依赖或样式架构工具，不调整现有样式数值或用户可见行为。
- 不部署、发布、上传、购买或提交 Git。

### 验收方式

- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查及前端构建通过，产物位于根目录 `dist/frontend/`。
- 静态检查共享类只在 `common.css` 定义一次，`main.tsx` 仅导入一次，并确认页面/组件专属样式仍在其原 Owner 文件。

### 完成记录（2026-09-28）

- 新增 `frontend/src/styles/common.css`，集中加载容器、加载指示器、服务状态及多页面错误提示；这些样式仅在公共文件定义，并由 `main.tsx` 在基础样式之后导入一次。
- `base.css` 现在只负责盒模型、文档背景、原生控件字体与焦点样式；全局设计变量仍集中在 `tokens.css`，页面/组件专属样式保留原文件。架构文档已记下样式所有权和导入规则。
- 通用错误提示的 20px 下边距改用等值的 `--space-5`，其余共享状态规则保留原有声明值。`pnpm --filter lfaa-frontend run build` 通过，含 TypeScript 检查；产物写入根目录 `dist/frontend/`。静态核对确认公共类只定义一次且只从主入口导入一次。
- 未做浏览器目视验收；本次仅调整 CSS 文件归属和单一导入位置，没有改动布局、颜色、交互或业务行为。当前目录没有 Git 元数据，无法运行 `git diff --check`。

## LFAA-UI-HOME-RESPONSIVE-01

### 用户目标

减少应用中心在宽屏和矮窗口中的过大留白，让应用入口在不同 CSS 视口宽度下保持清晰、紧凑且可访问。

### 当前合同

- 保留应用中心现有导航、文案、卡片入口和交互，不改变应用能力、数据或路由。
- 桌面布局减少宽屏顶部留白、欢迎区高度和卡片的非必要最小高度；矮窗口进一步压缩垂直间距。
- 保留现有宽度断点和自然页面滚动；窄屏不强制缩小全部内容以挤入首屏，不产生横向滚动。
- 完成标准：320px 窄屏、常见桌面宽度、超宽桌面、横屏矮窗口均保持内容可读；类型检查与前端构建通过；明确说明未执行的实机视觉验收。

### 允许修改

- `frontend/src/styles/workbench.css`、`frontend/src/styles/responsive.css`：仅调整应用中心及其共享页面框架的尺寸与响应式规则。
- `docs/PROMPTS.md`：维护本任务合同与完成记录。

### 禁止修改

- 不改导航、卡片文案、应用行为、设置数据、API、路由或页面信息架构。
- 不增加依赖、图片或动画，不重做首页，不把完整首屏展示作为牺牲可读性和可访问性的目标。
- 不部署、发布、上传或提交 Git。

### 完成记录（2026-09-28）

- 应用中心桌面留白收紧：主内容顶部间距上限由 108px 降为 64px，欢迎区最小高度由 286px 降为 244px，卡片最小高度由 340px 降为 320px。
- 增加宽度至少 721px、高度不超过 960px 时的紧凑布局，压缩欢迎区、卡片图文和页脚间距；页面仍按内容自然增高并支持滚动。保留既有 1050px、720px 宽度断点及移动端纵向滚动。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查；产物位于根目录 `dist/frontend/`。
- 未完成浏览器多视口目视验收：本次浏览器控制面连续返回 `nodeRepl.fetch request failed`。仓库未提供 `scripts/workspace-preflight.mjs` 或 `quality:full`；当前工作目录也没有 Git 元数据，无法运行 `git diff --check`。

## LFAA-SETTINGS-AI-GROUP-SPACING-01

### 用户目标

修正设置中心“AI 与模型”页面中，模型账户卡片区域与“推理参数”分组标题之间过近的问题。

### 当前合同

- 保持模型账户卡片、推理设置行、字段顺序和交互不变。
- 只调整账户卡片网格与后续参数分组之间的垂直间距；桌面双列和窄屏单列布局均应保留清晰分组。
- 完成标准：标题不再紧贴账户卡片；前端类型检查与构建通过；未执行的浏览器视觉验收需明确说明。

### 允许修改

- `frontend/src/components/SettingsPage.css`：仅调整 AI 与模型页面的分组间距。
- `docs/PROMPTS.md`：维护本任务合同与完成记录。

### 禁止修改

- 不改 AI 设置内容、数据、API、表单顺序、页面信息架构或其他设置分类。
- 不增加依赖，不做无关布局重构；不部署、发布、上传或提交 Git。

### 完成记录（2026-09-28）

- 原因是 `.ai-settings-layout` 后面直接进入“推理参数”分组，网格自身没有底部间距。现为账户卡片网格增加 24px 下边距，让标题与上方卡片分开。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查；产物写入根目录 `dist/frontend/`。
- 未执行修改后的浏览器目视验收；仓库未提供 `scripts/workspace-preflight.mjs` 或 `quality:full`，当前工作目录也没有 Git 元数据。

## LFAA-UI-PERF-SETTINGS-01

### 用户目标

修复设置中心首次进入时与账户主题不一致、重复读取设置造成等待的问题，并确保分类数据按需读取；同时处理有源码证据支持的滚动和切换开销。

### 当前合同

- 会话恢复或登录时与账户偏好一起读取当前账户设置，设置返回前不挂载工作台，避免系统深色模式暂时代替账户主题；读取失败时提供重试入口，不回退到临时主题。
- 工作台持有已读取的账户设置；设置页复用工作台传入的设置，不重复请求完整设置。
- 设置默认分类立即呈现；外观背景、AI Provider、插件、用量、归档、权限和运行状态等数据只在进入对应分类时请求，并避免未访问分类的数据阻塞首屏。
- 分类切换期间继续完成已发出的读取；重复进入同一分类或读取共享的运行状态、扩展信息时复用进行中的请求，不因切换产生重复请求。
- 检查设置分类的 React 渲染、外观图片预览和相关布局样式，按源码证据选择最小有效优化。
- 保持设置项、API 契约、数据归属、权限行为和视觉层级；优化不能以隐藏内容或减少功能为代价。
- 某个分类的数据请求失败时，只显示该分类的错误，不改变工作台已加载的账户主题或阻塞其他分类。
- 完成标准：工作台首次显示已采用账户保存的主题；设置页不重复读取完整设置；未访问分类没有对应数据请求；前端类型检查与构建通过；明确说明无法运行时采样的限制。

### 允许修改

- `frontend/src/App.tsx`：会话恢复或登录时预载账户设置，并在返回前不挂载工作台。
- `frontend/src/components/Workbench.tsx`：持有已读取的账户设置并将其传递给设置页。
- `frontend/src/components/SettingsPage.tsx`、`frontend/src/components/SettingsPage.css`：设置分类按需读取及设置页专属的加载与渲染处理。
- `docs/PROMPTS.md`：维护本任务合同与完成状态。

### 禁止修改

- 不改设置 API、数据格式、设置项归属、其他页面行为或用户可见功能。
- 不在浏览器本地存储复制账户设置，不增加依赖，不做无关重构；不部署、发布、上传或提交 Git。

### 完成记录（2026-09-28）

- 主题闪烁来自 Workbench 首次使用 `system` 默认主题，随后异步加载账户设置；认证恢复与登录现在会先并行读取账户偏好和账户设置，再挂载 Workbench，因此初始主题直接来自账户保存值。
- 如果完整账户设置读取失败，保留已恢复的会话并显示明确错误和重试入口，不以默认系统主题冒充账户设置。
- 设置页此前在 Workbench 已读取后又调用一次完整设置接口，并把首屏内容挡在加载态后；现改为复用 Workbench 设置，默认“常规”页立即显示。保存成功后同步完整账户设置，避免重新进入时读到旧状态。
- 分类数据原本已按当前分类懒加载，本次保留该行为；外观、AI、插件、用量、归档、权限和运行信息仍只在进入相应分类时请求。
- 滚动路径没有设置页自定义滚轮处理；已去掉设置正文实时模糊采样，将设置页壁纸改为普通滚动背景，并关闭半透明设置导航的实时背景模糊，保留半透明配色。
- 外观背景卡片改用懒加载、异步解码，并跳过视口外卡片内容的布局与绘制；切换分类不会丢弃仍在进行的读取，同分类请求及 AI 插件/运行状态等共享读取会复用进行中的 Promise，避免快速切换触发重复请求。
- `pnpm run build:frontend` 通过，含 TypeScript 检查；Vite 产物写入根目录 `dist/frontend/`。未运行浏览器实机采样；当前工作目录无 Git 元数据，仓库也未提供 `scripts/workspace-preflight.mjs` 或 `quality:full`，因此无法执行 `git diff --check` 或这些额外 Gate。截图中的通用“服务器内部错误”没有请求 ID 或接口信息，无法据此确认其独立服务端原因。

## LFAA-UI-PERF-SETTINGS-02

### 用户目标

修复设置中心在 Web 浏览器和桌面容器中滚动卡顿的问题，优先优化两端共享前端的长分类滚动路径。

### 当前合同

- 先核对设置中心滚动容器、背景合成、分类 DOM 和滚动时的 React 更新来源，按可观察代码证据选择修复点。
- 只优化当前活动分类中视口外设置行的布局与绘制；视口内内容、交互、无障碍树、背景配置和滚动行为保持可用。
- 不新增依赖、不修改设置 API 或数据、不移除用户可见设置；桌面端继续复用共享 Web 前端实现。
- 完成标准：离屏设置行按需跳过布局与绘制并保留自然高度；前端类型检查与构建通过；核对产物与源码规则；说明浏览器/桌面运行时滚动帧采样是否实际完成。

### 允许修改

- `frontend/src/components/SettingsPage.css`：设置中心滚动容器和行级布局/绘制优化。
- `docs/PROMPTS.md`：维护本任务合同和完成状态。

### 禁止修改

- 不改变设置项、背景图片显示、页面结构、滚轮事件、API、权限或持久化行为。
- 不新增运行时依赖，不部署、发布、上传或提交 Git。

### 完成记录（2026-09-28）

- 源码核对未发现滚轮处理器或随滚动更新 React 状态的代码；设置页只渲染当前分类，但该分类中的设置行此前始终参与完整布局与绘制。
- 设置行现使用 `content-visibility: auto`，并按普通行、快捷键行、布局预览行和窄屏分别提供估算尺寸；滚入视口后使用真实布局，保留控件、键盘访问和用户设置。
- `pnpm run build:frontend` 通过，类型检查与 Vite 构建成功，产物位于根目录 `dist/frontend/`。本机 Headless Chrome 151 确认支持 `content-visibility: auto` 与对应内在尺寸语法，开发服务器返回的设置样式也包含这些规则。
- 自动化浏览器是隔离的未登录会话，只能确认登录入口可显示；未取得用户账户会话，未实测登录后设置分类的滚动帧率，也未实测桌面容器帧率。改动位于 Web/Desktop 共用前端，因此两端使用同一优化实现。

## LFAA-UI-SETTINGS-PRELOAD-01

### 用户目标

减少首次进入设置中心时因 `SettingsPage` 按需加载而出现的等待和视觉闪动。

### 当前合同

- 保留设置页代码分块和现有路由；工作台首屏稳定后在空闲时预加载设置页模块，设置入口获得鼠标悬停或键盘焦点时也可提前预热。
- 懒加载展示仍保留安全兜底；预加载失败不得形成未处理拒绝或阻止用户后续进入设置页。
- 预加载仅获取前端模块及其样式，不挂载设置页、不触发分类数据 API、不重复读取账户设置。
- 不改设置业务、导航、API、数据归属、账户权限和页面布局，不新增依赖。
- 完成标准：前端类型检查与构建通过，产物位于根目录 `dist/frontend/`；说明浏览器实际冷启动耗时是否完成目视验收。

### 允许修改

- `frontend/src/components/Workbench.tsx`：复用同一个设置页动态导入，并在工作台空闲和设置入口交互时预加载。
- `docs/PROMPTS.md`：维护本任务合同与完成记录。

### 禁止修改

- 不移除设置页代码分块，不在应用初始关键路径同步载入设置页。
- 不触发设置分类数据读取，不改设置项、数据格式、API、权限、其他页面行为或布局。
- 不新增依赖，不部署、发布、上传或提交 Git。

### 验收方式

- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与前端构建通过，产物位于根目录 `dist/frontend/`。
- 静态核对动态导入复用、预加载失败处理及交互预热入口；浏览器若不可用，明确说明未完成冷启动目视验收。

### 完成记录（2026-09-28）

- Workbench 初次稳定后使用 `requestIdleCallback`（最长等待 1500ms）预加载设置页模块；不支持该 API 的浏览器使用 1000ms 延迟回退。设置入口悬停或键盘聚焦时也会立即预热。
- 设置页懒加载与预热复用同一动态导入 Promise。预热失败会清除缓存并吞掉后台拒绝，用户随后打开设置页时仍可重新加载；模块导入不会挂载设置页或触发设置分类数据 API。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查；Vite 构建产物位于根目录 `dist/frontend/`。
- 未执行浏览器冷启动目视或网络采样，无法确认实机首次打开耗时；当前工作目录没有 Git 元数据，无法运行 `git diff --check` 或读取 Git 变更状态。

## LFAA-UI-REFRESH-PERSISTENCE-01

### 用户目标

刷新设置中心时保持当前分类与正文滚动位置，避免服务检查期间短暂误显示登录页；控制端不可达时给出明确连接提示和重试操作。

### 当前合同

- 浏览器刷新 `/settings` 时，从有效 URL 分类恢复设置页；同时按当前用户持久化最近选择的分类，重新打开设置中心时恢复该分类。
- 按当前用户与分类分别持久化设置正文垂直滚动位置；刷新或返回同一分类时，在同步内容或该分类异步数据加载完成后恢复滚动位置。
- 服务状态为 `checking` 时继续显示初始化状态，不提前将未验证会话呈现为登录页；仅在服务端明确返回未认证后显示登录表单。
- 控制端不可达或会话恢复发生临时错误时显示可恢复状态与重试操作；健康接口恢复后自动继续恢复会话。
- 确认有效会话后，Workbench 模块与偏好/账户设置读取并行预热；共享同一动态导入请求，不提前挂载设置页或显示未经验证的账户内容。
- 不把账户设置、令牌或会话凭据复制到浏览器存储；本地只保存设置分类标识与正文滚动位置等非敏感界面偏好。
- 完成标准：前端类型检查与构建通过，产物位于根目录 `dist/frontend/`；明确说明未执行的浏览器刷新验收。

### 允许修改

- `frontend/src/App.tsx`：修正健康检查与会话恢复状态机、增加可恢复连接提示，并并行预热 Workbench 模块。
- `frontend/src/components/SettingsPage.tsx`：从 URL/当前账户本地界面偏好恢复并保存当前设置分类和各分类正文滚动位置。
- `docs/PROMPTS.md`：维护本任务合同与完成记录。

### 禁止修改

- 不在会话验证前渲染账户工作台，不改变 HttpOnly 会话认证和服务端授权。
- 不把账户设置、身份资料、Cookie、Token 或秘密写入浏览器存储。
- 本地仅保存当前分类和滚动位置等非敏感界面状态，不保存分类内容或设置数据。
- 不改设置 API、账户设置字段、分类内容、业务权限或其他页面行为；不新增依赖。
- 不部署、发布、上传或提交 Git。

### 验收方式

- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与前端构建通过，产物位于根目录 `dist/frontend/`。
- 静态核对初始化状态转换、登录判定、重试流程、分类恢复优先级与异步内容滚动恢复；浏览器若不可用，明确说明未完成刷新实测。

### 完成记录（2026-09-28）

- 初始化阶段等控制端健康检查结束后再恢复会话，避免 `checking` 状态提前显示登录页。仅 `/auth/me` 明确返回 401 时显示登录；健康接口离线或会话恢复失败时显示重试界面，恢复连接后自动继续检查。
- 会话确认后并行读取偏好/账户设置并预热 Workbench 动态模块，渲染时复用同一导入请求；登录前不显示工作台账户内容。若刷新时 URL 指向设置中心，成功登录后保留该目标路由。
- 设置分类按用户 ID 保存在浏览器本地的非敏感界面状态中，同时同步到 `?section=`；有效 URL 值优先，其次是旧版账户入口指定分类，再其次是该账户上次分类，最后才回退“常规”。
- 设置正文滚动位置按用户 ID 和分类分别保存；分类切换时立即保存离开的分类，刷新/离开页面时冲刷待保存位置，并在对应分类的异步数据加载结束后恢复。没有历史位置的分类从顶部开始。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查；Vite 产物写入根目录 `dist/frontend/`。
- 仓库未提供 `scripts/workspace-preflight.mjs` 或 quality/release Gate 脚本；按要求尝试运行 workspace preflight 时因脚本不存在而无法执行。未执行浏览器刷新实测；当前工作目录没有 Git 元数据，无法运行 `git diff --check` 或读取 Git 变更状态。检查时本机控制端健康接口返回 `status: ok`、`persistence: ready`。

## LFAA-SETTINGS-NOTIFICATIONS-01

### 用户目标

让设置中心“通知”中的当前 LFAA 通知偏好接入真实通知宿主和事件；AI Work 的成功回复完成后，按用户选择向操作系统发送浏览器通知，并实际播放所选提示音。

### 当前合同

- 当前 LFAA 只有 AI Work 流式对话完成事件可作为通知来源。仅 `complete` 结果触发通知；失败、中断和取消不触发。
- 使用浏览器 Notifications API；设置页显示当前浏览器支持情况和授权状态，并通过明确的用户操作请求授权。系统拒绝授权时说明需在浏览器站点设置中恢复。
- `completionNotification` 的“始终 / 仅工作台未聚焦时 / 关闭”由页面可见性与焦点状态真实执行。通知正文只说明哪个 LFAA 应用的 AI 回复已完成，不包含用户消息或模型回复内容。
- `notificationSound` 由 Web Audio 实际播放，并在设置页提供试听；浏览器限制或音频设备错误时不伪称已播放。
- 在本通知合同登记时，当前没有权限等待、AI 反问、Codex/ChatGPT 外部任务、用量重置、健康数据、群聊、营销、资料库分享或项目邀请等 LFAA 事件源。权限等待和 AI 澄清事件后续已由 `LFAA-UI-AI-INTERACTION-DOCK-01` 接入；外部产品及其他事件仍无 LFAA 事件源，不显示为已接入能力。
- 浏览器通知仅在 LFAA 页面进程仍运行时有效，不承诺关闭页面后的 Web Push 或后台任务投递。保留现有账户级设置字段和服务端存储格式，不新增依赖、数据库字段或 API。
- 完成标准：授权与不支持/拒绝状态可见；通知策略能针对真实 `complete` 事件执行；提示音可试听且在通知事件中按设置播放；通知不泄漏会话正文；前端类型检查与构建通过，并说明未执行的浏览器/桌面环境验收。

### 允许修改

- `frontend/src/shared/notification-runtime.ts`：浏览器通知授权、状态、投递和提示音运行时。
- `frontend/src/components/SettingsPage.tsx`：通知状态、授权/测试操作和真实功能状态说明。
- `frontend/src/components/AiWorkChat.tsx`：将 AI Work 成功完成事件接入通知运行时。
- `docs/PROMPTS.md`、`docs/系统总体架构.md`、`docs/开发计划.md`：同步事件来源、通知宿主边界和实际接入状态。

### 禁止修改

- 不增加 ChatGPT、Codex、健康、营销、群聊、分享或项目等外部服务通知；当前没有对应 LFAA 连接器和授权 API。
- 不把权限请求、问题等待、模型额度或后台任务显示成已接入事件；不在通知中暴露用户消息、模型回复或秘密。
- 不新增服务端 API、账户设置格式、数据库迁移、依赖、Service Worker 或 Web Push 服务；不部署、发布、上传或提交 Git。

### 完成记录（2026-09-28）

- 设置页显示浏览器通知能力和授权状态，支持由用户主动请求授权、发送测试通知及试听提示音；被浏览器阻止或运行环境不支持时显示对应说明。
- 三个应用共用的 AI Work 聊天在收到真实 `complete` 事件后，按“始终 / 仅工作台未聚焦时 / 关闭”策略发送系统通知，并根据提示音偏好播放 Web Audio 音效。失败和中断不会通知，通知正文不包含聊天消息。
- 权限等待与问题提醒显示为待接入，不保留会造成误解的有效开关。ChatGPT/Codex 外部任务及其他没有 LFAA 事件源的通知类别不纳入本次范围。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查；Vite 产物位于根目录 `dist/frontend/`。仓库未提供 `workspace-preflight.mjs` 或 `quality:full` 脚本。未进行浏览器权限弹窗、操作系统通知弹出及桌面容器的交互验收。

## LFAA-AI-PERMISSIONS-01

### 用户目标

在“用户与权限”中正式提供“请求审批”“替我审批”“完全权限”三种账户级 AI 工具策略，并让 server 核心按真实工具、操作类型和目标范围执行策略；审批与记忆授权必须由当前账户明确决定，且能查看和撤销。

### 当前合同

- “请求审批”：只读工具可按既有能力执行；每项写入或高风险操作都必须单独审批，不建立记忆授权。
- “替我审批”：未记忆的写入或高风险操作必须先审批；审批流随后单独询问是否记住。只有用户明确选择记住，才保存精确到用户、应用、工具 ID/版本、风险和目标范围的授权。任何键变化均重新审批。
- “完全权限”：不对已登记且真实可执行的工具逐项弹出审批；仍受工具登记、应用范围、目标校验、身份/角色授权和业务规则约束，不开放任意 Shell/任意路径能力，也不代表同意 Minecraft EULA。
- 授权决策由 server 核心作出。缺少可执行工具登记、目标范围或有效参数时必须拒绝或要求审批，不能因前端选择、Hook 或模型回复提升权限。
- 单次审批继续按用户隔离、参数哈希绑定、五分钟失效且只能消费一次；“记住”授权不绑定本次参数值，但绑定稳定工具版本与完整授权范围，并支持当前账户撤销。
- 设置读取兼容旧 `defaultPermission` 值；旧 `workspace` 不迁移成无条件放行，转换为需要首次审批的“替我审批”模式。
- 当前尚无业务工具执行器；本任务接入策略、设置、记忆授权 API/界面和审批闭环，不虚构 Minecraft/Java 下载、EULA 接受或开服执行结果。
- 完成标准：账户可读取/保存三种模式；权限核心对三种模式、未登记工具、跨应用、工具版本变化、范围变化、记忆授权及撤销给出正确结果；审批可选记忆且仍只能授权单次参数；类型检查和构建通过。

### 允许修改

- `server/src/ai/permissions.ts`、`server/src/modules/settings/service.ts`、`server/src/api/routes.ts`、`server/src/database.ts`：策略决策、账户级授权记录、兼容读取、API 与显式数据库迁移。
- `frontend/src/api.ts`、`frontend/src/components/SettingsPage.tsx`：三种模式说明、两步审批/记忆确认、已记忆授权查看与撤销。
- `docs/PROMPTS.md`、`docs/系统总体架构.md`、`docs/开发计划.md`：同步权限语义、EULA 边界和当前没有业务工具的状态。

### 禁止修改

- 不实现或伪装尚不存在的 Minecraft、Java、文件、网络、Shell 或 daemon 工具；不把授权偏好等同于工具执行能力。
- 不将用户审批、记忆授权或 EULA 同意合并；不自动接受 EULA。
- 不放宽单次审批参数绑定、用户隔离、过期或单次消费要求；不让前端或插件成为授权事实来源。
- 不引入新依赖，不改与权限策略无关的页面或业务，不部署、发布、上传或提交 Git。

### 完成记录（2026-09-28）

- 设置中心已提供“请求审批”“替我审批”“完全权限”三种账户级模式；旧 `defaultPermission: workspace` 以兼容读取映射到需首次审批的“替我审批”，不会继续静默放行。
- server 授权器从 SQLite 读取当前账户的已保存模式；仅对真实登记、适用当前应用且有可信目标范围的工具作出授权。记忆授权匹配账户、应用、工具 ID/版本、风险和目标范围哈希；审批需先确认本次操作，再单独选择“仅批准一次”或“记住并批准”。
- 新增记忆授权列表与账户内撤销接口。单次审批绑定参数、工具版本、风险和目标范围，有效 5 分钟且单次消费；升级时旧审批标记过期。EULA 仍需单独由用户明确同意。
- 当前没有可执行的 Minecraft/Java 或其他 AI 业务工具；本次接入的是可信授权策略和审批控制，真实下载、配置及开服执行尚未接入。
- 验证：`pnpm run build`、`pnpm --filter lfaa-server run typecheck` 通过；临时 SQLite 烟测覆盖三种模式、账户隔离、风险/版本/范围变化、撤销、旧设置兼容及单次参数绑定消费。未执行浏览器交互验收；仓库未提供 `scripts/workspace-preflight.mjs` 或 `quality:full` 门禁。

## LFAA-AI-PERMISSIONS-DB-01

### 用户目标

修复版本 8 SQLite 数据库缺少 `scope_summary` 列时，设置页读取 AI 审批和记忆授权列表返回 500 的问题。

### 当前合同

- 通过新增版本 9 迁移兼容两种版本 8 结构：审批表和授权表均已有 `scope_summary`，或两表均缺少该列。
- 迁移保留审批与授权记录及原有字段；旧记录没有保存目标范围时，使用明确说明“旧版本未记录目标范围”的值，不推断实际范围。
- 迁移在事务中完成，成功后才更新数据库版本；不删除数据库、不重置用户数据。
- 完成标准：临时 SQLite 烟测覆盖缺列与已有列两种版本 8 数据库、字段补齐、旧记录保留和重复启动；server 类型检查及工作区构建通过。

### 允许修改

- `server/src/database.ts`：新增兼容迁移。
- `server/test/database-migrations.test.mjs`：新增 Node 内置测试覆盖两种版本 8 结构与数据保留。
- `docs/PROMPTS.md`：维护本任务合同与完成记录。

### 禁止修改

- 不手动改写或删除 `data/database/lfaa.sqlite`；不丢弃审批、授权或账户数据来绕过迁移。
- 不改变 AI 权限策略、API 响应、前端行为或其他数据库迁移。
- 不增加依赖，不部署、发布、上传或提交 Git。

### 完成记录（2026-09-28）

- 新增 SQLite 迁移 v9，兼容两种版本 8 授权表结构；缺失目标范围说明的旧记录显示“旧版本未记录目标范围”，授权表重建时保留原记录、约束与索引。
- 新增临时 SQLite 回归测试，覆盖缺列/已有列、记录保留、外键检查与重复启动；2 项通过。
- 验证：`pnpm --filter lfaa-server run typecheck` 与 `pnpm run build` 通过。本地数据库为 v9，两张表均有 `scope_summary`，现有审批/授权记录数量为 0；未执行浏览器界面验收。仓库没有 `scripts/workspace-preflight.mjs`、`quality:full` 或 Git 元数据。

## LFAA-SERVER-POLL-LOG-01

### 用户目标

减少开发终端中由前端定时健康检查和会话复核产生的重复成功请求日志，同时保留真实请求失败及其他 API 请求的可诊断日志。

### 当前合同

- 前端现有 `/api/health` 健康检查和 `/api/auth/me` 会话复核频率及认证行为保持不变。
- 成功的 `GET /api/health` 与 `GET /api/auth/me` 请求使用 `debug` 级别；默认 `LOG_LEVEL=info` 时不持续打印这些轮询记录。失败响应仍保持可见。
- 其他 HTTP 请求仍按现有 `info` 级别记录；服务器错误仍保留 `error` 日志和请求 ID，不得记录请求正文、Cookie、Token 或密钥。
- AI 审批与记忆授权接口曾因 v8 SQLite 数据库缺少 `scope_summary` 返回 500；该问题由 `LFAA-AI-PERMISSIONS-DB-01` 的 v9 兼容迁移处理。本任务不重复迁移、不重置或直接修改用户数据库。
- 完成标准：server 类型检查与工作区构建通过；使用隔离的临时数据目录验证健康轮询成功记录在默认日志级别下被压低，失败请求仍有可见诊断；说明未执行的环境验收。

### 允许修改

- `server/src/index.ts`：仅调整成功健康/会话轮询请求的日志级别及其路径判定。
- `docs/PROMPTS.md`：维护本任务索引、合同与完成记录。

### 禁止修改

- 不改变前端轮询频率、认证语义、API 响应或用户可见行为。
- 不改变其他接口的日志级别，不记录请求正文或认证秘密。
- 不修改 SQLite 迁移、权限 API、数据库运行数据或依赖；不部署、发布、上传或提交 Git。

### 完成记录（2026-09-28）

- `/api/health` 与 `/api/auth/me` 的成功 GET 请求改为 `debug` 级别；默认 `LOG_LEVEL=info` 下不再持续打印。失败响应与其他接口继续记录为 `info`，500 错误保留原有 `error` 及请求 ID。
- 在全局中间件处理时固定原始请求路径，完成日志不再受 Express 路由挂载期间的路径变化影响。
- 隔离数据目录运行验证：`GET /api/health` 返回 200 且不产生 `info` 请求日志；`GET /api/auth/me` 返回 401、未知接口返回 404，两者仍输出含稳定原始路径和请求 ID 的请求日志。临时数据库和密钥已清理。
- `node --test server/test/database-migrations.test.mjs` 通过（2 项）；`pnpm --filter lfaa-server run typecheck` 通过；`pnpm run build` 通过，前后端产物位于根目录 `dist/`。
- 日志中的审批与记忆授权 500 对应版本 8 SQLite 表缺少 `scope_summary`；现有 v9 迁移已处理该兼容问题，本次复跑其迁移回归通过。本次未直接修改用户数据库。
- 未运行浏览器目视验收；仓库未提供 `scripts/workspace-preflight.mjs` 或 `quality:full`，当前目录也没有 Git 元数据，无法运行 `git diff --check`。

## LFAA-SETTINGS-PERMISSION-CLARITY-01

> 历史合同（2026-09-28）：以下内容记录当时的能力状态，已由 `LFAA-AI-PERMISSION-MODE-EXECUTION-02` 和当前代码更新；后续实现以新合同为准。

### 用户目标

按 LFAA 当前的权限模型与宿主能力，完善“常规”中的访问边界说明和“用户与权限”中的 AI 工具授权说明，避免借用其他产品的权限定义或让账户偏好看起来能直接授予本机能力。

### 当前合同

- “常规”只说明 LFAA 当前客户端的主机访问边界，并提供到“用户与权限”的明确入口；不在常规设置中复制 AI 工具权限模式，也不提供无法执行的本机完整访问开关。
- 页面不得链接到 Codex 或其他产品的权限说明；所有描述必须以 LFAA 代码、当前项目架构和权限合同为依据。
- 清楚区分账户级 AI 工具授权策略与本机/节点实际执行能力：当前没有已接入的 AI 业务执行工具；权限模式本身不授予任意本机文件、Shell 或网络命令能力。
- “请求审批”说明：已登记且适用于当前应用的只读工具按规则执行；写入与高风险操作逐项审批，且不保存记忆授权。
- “替我审批”说明：首次写入或高风险操作仍需用户批准；用户可仅批准一次或记住授权。记忆授权仅匹配当前用户、应用、工具 ID/版本、风险和目标范围，不绑定单次参数值；工具参数仍由业务规则校验。
- “完全权限”说明：仅对已登记、可执行、适用于当前应用且具有有效目标范围的工具免逐项审批；server 仍执行身份、应用、工具、目标和业务规则检查。不开放任意 Shell 或任意路径，不代替 Minecraft EULA 的单独同意。
- 保持现有设置 API、账户数据格式、数据库、授权器和审批流程不变；不新增实际主机访问能力。
- 完成标准：常规页提供 LFAA 自有且准确的访问边界和权限页入口；权限页按当前 server 策略解释三种模式及未接入的执行能力；前端检查与构建通过。

### 允许修改

- `frontend/src/components/SettingsPage.tsx`：常规访问边界入口、三种 AI 工具权限模式说明和当前能力状态。
- `docs/PROMPTS.md`、`docs/开发计划.md`：维护任务合同和设置归属描述。

### 禁止修改

- 不实现或伪装桌面宿主、daemon、本机文件、Shell、网络命令或其他业务执行器。
- 不修改用户权限 API、授权核心、数据库格式、审批/记忆授权语义或 EULA 处理。
- 不增加依赖、不引入其他产品的设置说明链接、不修改无关设置或视觉样式；不部署、发布、上传或提交 Git。

### 完成记录

- 常规页移除不可用的“完整访问权限”开关和 Codex 外链，改为显示账户级 AI 工具策略入口与当前未接入的本机/节点执行边界；AI 策略入口直接跳转“用户与权限”。
- “用户与权限”按 LFAA server 的实际授权语义逐项说明请求审批、替我审批和完全权限，并明确当前没有可执行的 AI 业务工具、授权策略不会授予本机文件/Shell/网络命令能力，Minecraft EULA 仍需单独同意。
- 将 P1-08 的设置归属描述改为：常规保存通用偏好，AI 工具权限、审批与记忆授权归入“用户与权限”。
- 验证：`pnpm --filter lfaa-frontend run build` 通过，包含 `tsc --noEmit` 与 Vite 构建，产物写入 `dist/frontend/`。未执行浏览器/桌面交互验收；`scripts/workspace-preflight.mjs` 与 `quality:full` 当前不存在，工作目录没有 `.git` 元数据，无法核查 Git 状态或运行 `git diff --check`。

## LFAA-AI-ARCH-01

### 用户目标

为后续 LLM、Agent、Skills、提示词和专家扩展建立可组合的后端 AI 插件宿主；先验证 DeepSeek Harness 使用的 Cordis 插件生命周期是否适合 LFAA，不提前实现完整 AI Work。

### 当前合同

- AI Runtime 宿主位于 `server/src/ai/`，由 server 启动和关闭；首阶段使用 Cordis Context、Loader 和生命周期管理。
- Core 服务保留 LFAA 身份、授权策略、审批、审计、业务规则和节点任务边界。插件不得替代这些服务或绕开 server 业务 API。
- 首阶段仅装载随 LFAA 源码发布且由代码清单登记的内置插件；不得从 `data/plugins/` 或用户输入路径装载第三方可执行代码。
- 开发模式可对受信任的内置插件启用代码热更新；生产模式不监视源码目录。Skills/提示词的用户管理、第三方插件沙箱、插件市场和插件 UI 不属于本任务。
- AI 插件宿主在 HTTP 服务开始接收请求前完成初始化，并在 server 正常关闭时释放插件资源。
- 完成标准：Cordis 宿主可启动、登记内置插件、提供插件状态，并释放全部运行资源；server TypeScript 检查与构建通过。不得将宿主就绪报告为 LLM 推理或 AI Work 已接入。

### 允许修改

- `server/package.json`、`pnpm-lock.yaml`：加入并锁定本任务验证所需的 Cordis 依赖。
- `server/src/ai/`、`server/src/index.ts`：实现最小宿主和生命周期接线。
- `docs/PROMPTS.md`、`docs/系统总体架构.md`、`docs/开发计划.md`：记录任务合同、插件边界和实际阶段状态。

### 禁止修改

- 不实现 LLM 推理、Agent Loop、模型 API 调用、AI 对话 API、游戏/写作/网络穿透工具或新数据库表。
- 不从插件执行任意 Shell、任意文件路径或自行授予主机权限；不装载未经信任和授权的外部可执行插件。
- 不实现插件商店、在线安装、前端插件 UI、MCP 服务管理或跨进程第三方插件沙箱。
- 不部署、发布、上传、购买、提交 Git 或执行外部环境变更。

## LFAA-AI-RUNTIME-01

### 用户目标

完成可用的 AI Work 后端闭环，并复用设置中心已加密保存的 Provider 账户。模型运行参数、AI 扩展、连接器、权限审批、用量和会话归档必须进入各自正确的设置分类。

### 设置中心归属规则

| 设置分类 | AI 能力归属 |
|---|---|
| AI 与模型 | Provider 账户、密钥状态、活动模型、推理参数和 Runtime 状态 |
| 插件 | 内置/受信任插件、Skills、Experts、Prompts 和 Tools 的目录与启用状态 |
| 连接 | MCP 与外部服务连接及其凭据引用 |
| 用户与权限 | Agent 工具权限、风险级别、审批策略和用户角色 |
| 使用情况和计费 | 本地 Token 与请求用量；暂无成本数据时不虚构费用 |
| 已归档的聊天 | AI Work 会话列表、归档和恢复 |
| 常规 | 通用工作台交互偏好 |
| 外观 | 主题、强调色、背景和视觉效果；不得放置 AI 服务配置 |

### 当前合同

- AI 推理必须读取当前用户在设置中心激活的 Provider 账户；密钥只在 server 内解密使用，不返回浏览器，不复制维护第二份 Provider 配置。
- 实现可取消、限流、持久化且按用户隔离的会话与流式响应；支持当前设置中心登记的六类 Provider，并只请求固定 HTTPS 白名单端点。
- Agent、模型、Skill、Prompt、Expert 和 Tool 使用可版本化的类型化契约及 Cordis 生命周期；所有扩展注册和监听均随拥有它的插件卸载。
- 核心授权与审批优先于 Hook 决策；插件不能提升用户权限、绕过拒绝结果或直接执行任意 Shell/任意路径文件操作。
- 每个应用 AI Work 使用独立会话上下文。只有仓库中确实存在的业务服务/daemon Runner 才能注册为可执行工具；不存在的 SteamCMD、Minecraft、写作和隧道执行能力必须明确显示待接入，不得用假工具完成演示。
- 只允许代码登记的受信任内置插件运行；Markdown/JSON 型 Skills、Prompts、Experts 可以作为数据扩展管理。第三方可执行插件、在线市场和进程沙箱不纳入本任务，不能从任意路径执行用户代码。
- 数据库使用向前兼容的显式迁移；AI Provider、AI Runtime 偏好、会话、消息和 Token 用量按用户隔离并持久化。设置中心只在其业务归属分类呈现配置。
- 完成标准：已配置活动 Provider 的用户可在 SteamCMD、Minecraft 和写作的 AI Work 中创建/继续/归档会话并收到流式模型回复；无活动 Provider 时 UI 引导进入“AI 与模型”；插件目录、权限状态、Token 用量和会话归档都来自真实后端数据；server 与 frontend 检查和构建通过。

### 当前实现与边界（2026-09-28）

- 已接入六个固定 Provider 的账户复用、加密密钥、模型选择、限流、超时、取消、流式响应、持久化会话、用量、归档和三个应用内 AI Work 面板。当前没有真实 Provider 密钥，故没有发起真实模型请求；首次使用者需在“AI 与模型”配置并激活账户。
- 设置中心已按业务归属拆分：AI 参数与 Runtime 状态在“AI 与模型”，受信任扩展与运行期 Hooks 在“插件”，默认工具策略与审批队列在“用户与权限”，本地 token 用量在“使用情况和计费”，会话恢复在“已归档的聊天”。“外观”只处理视觉设置。
- 当前登记 Agent 是可版本化的对话/规划配置，不包含 Agent Loop、子 Agent 委派或工具执行。SteamCMD、Minecraft、写作文件、MCP、网络穿透和 daemon 工具尚不存在，因此没有登记虚假可执行工具。
- Cordis Hooks 只观察不含用户正文的推理元数据；Hook 异常不能改写请求或权限。server 核心授权器读取当前账户权限模式，按应用、工具版本、风险和目标范围给出 allow/approval-required/deny；记忆授权只在“替我审批”模式匹配，单次审批绑定完整参数且有效期 5 分钟、只能消费一次。当前无执行工具，审批队列为空。
- 迁移 v6/v7 新增按用户隔离、有时效的单次工具审批记录；迁移 v8 新增工具版本、目标范围与记忆授权，并将旧格式待处理审批置为过期。历史设置由迁移 v5 从“常规”拆到 AI Runtime、用户权限和插件分类，历史会话消息和配置不删除。
- 当前验收：server/frontend TypeScript 检查与构建通过；临时 SQLite API 烟测确认三个 Cordis 插件 ACTIVE、六项扩展登记、设置分类正确、无 Provider 时返回 409、审批列表与拒绝 API 可用；授权烟测确认跨应用拒绝、危险操作需审批、审批绑定参数且单次消费。真实 Provider 流式响应仍待配置密钥后验证。

### 允许修改

- `server/src/ai/`、`server/src/api/`、`server/src/modules/settings/`、`server/src/database.ts`、`server/src/index.ts`：Provider 推理、Agent/Hooks、数据迁移、API 和生命周期。
- `frontend/src/api.ts`、`frontend/src/components/`、`frontend/src/styles/`：AI Work 页面和与设置分类对应的真实控制面。
- `docs/PROMPTS.md`、`docs/系统总体架构.md`、`docs/开发计划.md`：同步契约、设置归属、实现状态和验收结果。

### 禁止修改

- 不在“外观”或不相关页面添加 AI 服务配置；不将 AI 密钥发送到浏览器存储、URL、日志或普通设置响应。
- 不用占位响应伪装模型调用、业务工具、插件隔离或权限审批已接通。
- 不调用不存在的 SteamCMD、Minecraft、写作、daemon、主机 Shell 或任意文件操作能力。
- 不装载任意来源第三方可执行代码；不在此任务中实现市场下载和进程沙箱。
- 不部署、发布、上传、购买、提交 Git 或执行外部环境变更。

## LFAA-P1-01-05

### 用户目标

以当前 `H:\LFAA` 新项目为唯一工作对象，完成此前列出的 1 至 5 项：确认并实现持久化边界；建立 server 启动、配置、日志和健康接口；建立 Web 应用中心与路由骨架；连接前端健康状态；实现首次管理员初始化、登录、权限检查及可恢复的用户偏好。

### 当前合同

- server 是用户、角色、登录会话、应用偏好和健康状态的唯一 Owner；前端只消费 server API，不在浏览器保存密码或登录凭据。
- 本阶段使用 Node.js `node:sqlite` 文件数据库，位置为 `LFAA_DATA_DIR/database/lfaa.sqlite`；数据库迁移以 `PRAGMA user_version` 顺序管理。开发最低 Node.js 版本为 24.15.0。
- 登录密码和恢复密钥使用 Node.js `scrypt` 加随机盐保存；登录凭证通过 `HttpOnly`、`SameSite=Strict` Cookie 传递，生产模式要求配置强 `JWT_SECRET`。仅当本地用户表为空时可初始化唯一超级管理员；之后不开放注册和新增账户接口。新设密码至少 8 位并包含至少 3 类字符，恢复密钥可用于重设密码；已有账户可登录后补设恢复密钥。
- 最小业务持久化对象为用户、服务端登录会话、用户选中的应用及模式。游戏实例、节点、任务和写作数据不在本任务内。
- SteamCMD、Minecraft、写作及 AI Work 只提供明确标记为开发中的应用入口；不得表现成已经连接或可执行的功能。
- 完成标准：配置错误有明确启动诊断；server 可提供真实健康状态；唯一超级管理员可初始化并登录；登录后可访问应用中心；密码强度在界面提示并由服务端校验；恢复密钥可重设密码；用户偏好重启后仍可恢复；应用卡片入口、路由和健康状态可运行。
- 当前核查：server/front 构建通过；本机临时 SQLite API 流程通过首次管理员、登录、会话撤销、角色授权、用户隔离和重启后数据恢复；浏览器已显示首次管理员初始化表单及真实在线状态。未自动化提交登录表单，登录后的应用中心视觉验收仍待完成。

### 允许修改

- `package.json`、工作区包 `package.json`、`pnpm-workspace.yaml` 与 `pnpm-lock.yaml`：只调整本阶段需要的依赖、Node 引擎范围和命令。
- `server/src/`、`server/tsconfig.json`：实现配置、日志、SQLite 迁移、认证授权、用户偏好、健康接口及 server 启动。
- `frontend/src/`、`frontend/index.html`、`frontend/vite.config.ts`、`frontend/tsconfig.json`：实现应用中心、登录/首次初始化、用户管理页面和 API 状态连接。
- `.env.example`、`README.md`、`docs/开发计划.md`、`docs/系统总体架构.md`：同步运行方式、持久化合同和本阶段状态。
- `docs/PROMPTS.md`：维护本任务的合同状态与完成记录。

### 禁止修改

- 不实现 daemon 节点通信、真实 SteamCMD 或 Minecraft 部署、实例/文件/终端操作、写作业务、LLM 或 Agent 执行能力。
- 不新增数据库服务、ORM、UI 组件库或动效依赖；不把账号、密码、Token 或敏感配置写入前端、本地存储、URL、日志或仓库。
- 不部署、发布、上传、购买、提交 Git 或执行外部环境变更。
- 不执行与本任务无关的重构或大范围测试；只运行适用于本交付的构建和静态检查。

## LFAA-P1-01-07

### 用户目标

在新项目 `H:\LFAA` 中，让根目录 `pnpm dev` 能同时启动前端和 server；`lfaa.bat` 菜单选项 `2` 在当前窗口启动这两个服务，选项 `4` 保留给环境检查。

### 当前合同

- 前端和 server 仍分别由现有 `dev:frontend`、`dev:server` 命令负责；启动入口不重复实现服务逻辑。
- `pnpm dev` 在当前终端并行运行两个工作区开发脚本。
- `lfaa.bat` 保留依赖管理菜单；选项 `2` 在当前窗口前台同时运行两个开发服务，按 `Ctrl+C` 停止；选项 `4` 执行环境检查。
- 启动脚本验证 Node.js、项目指定的 pnpm 版本、工作区依赖及服务脚本；不自动安装依赖或更改运行配置。
- 完成标准：根目录 `pnpm dev` 指向两个真实工作区脚本；批处理菜单选项 `2` 在当前窗口前台调用并行启动脚本、不创建额外窗口；选项 `4` 检查运行环境；README 给出启动和停止方式。

### 允许修改

- `package.json`：只添加根目录 `dev` 脚本。
- `scripts/install-dependencies.ps1`、`scripts/start-dev.ps1`、`lfaa.bat`：只增加开发服务启动菜单及其检查、调度逻辑。
- `README.md`、`docs/开发计划.md`、`docs/PROMPTS.md`：同步开发启动方式、任务状态和合同。

### 禁止修改

- 不修改前端、server、daemon 业务实现及其 API、数据格式或架构边界。
- 不自动安装依赖、修改 `.env`、启动生产服务、部署、发布、上传、购买或提交 Git。
- 不引入服务编排依赖，不实现与本任务无关的进程管理或后台服务安装功能。

### 完成记录（2026-09-28）

- 根目录 `pnpm dev` 配置为并行运行前端和 server 的现有开发脚本。
- `lfaa.bat` 菜单调整为选项 `2` 一键启动前端和 server，选项 `4` 检查 Node.js、pnpm 版本和依赖。
- 启动脚本在当前窗口以前台方式运行根目录 `pnpm dev`；按 `Ctrl+C` 停止两个服务，不再调用 `Start-Process` 打开额外窗口。
- README 已记录命令行、菜单入口和停止方式。静态核对已完成；未启动开发服务或运行测试。

## LFAA-DEV-STARTUP-RESILIENCE-01

### 用户目标

减少一键启动时旧前端端口冲突、后端启动失败后 Daemon 连续报连接错误造成的误判，并让数据库版本不兼容信息可定位。

### 当前合同

- Windows 菜单启动前检查 Vite 5173 和当前控制端端口；被占用时显示端口、进程名和 PID 并停止本次启动，不自动结束未知进程。
- Vite 固定使用 5173；端口冲突时报错退出，不静默切换到 5174。
- Daemon 先等待控制端健康检查通过，再扫描环境、提交心跳和领取任务；控制端未就绪时按间隔重试，并避免重复打印相同错误。
- 数据库版本高于当前代码支持值时继续 fail-closed，并在错误中显示数据库路径与保护数据的原因；不降级或删除数据库。
- 完成后核对菜单与单服务启动入口、当前数据库 14 到 15 的迁移兼容，以及 Windows 端口冲突提示；未运行的构建/启动验收如实记录。

### 允许修改

- `scripts/start-dev.ps1`、`frontend/vite.config.ts`、`daemon/src/task-runner/minecraft-daemon.mjs`、`server/src/database.ts`：实现启动前检查、固定前端端口、Daemon 健康等待与清晰的数据库版本错误。
- `docs/系统总体架构.md`、`docs/PROMPTS.md`：登记启动行为及本次任务记录。

### 完成记录（2026-09-29）

- 启动脚本会先检查服务监听端口并显示占用进程，不会自动结束进程；Vite 端口冲突时不再换端口。Daemon 等待 `/api/health` 成功后才开始节点扫描和心跳，同一连接错误只提示一次，恢复后提示已连通。
- 数据库高版本拒绝信息包含数据文件路径，并说明不会为保护数据而自动降级；当前代码支持数据库版本 16，版本 15 会继续执行已有迁移。
- 未运行 PowerShell 启动、构建或自动化测试；Windows 端口占用场景与完整菜单启动待实机验收。

## LFAA-UI-MODULE-CANVAS-01

### 用户目标

让 SteamCMD、Minecraft 和写作应用在常规模式与 AI Work 模式下都使用中间列全部可用宽度和高度，不因内容最大宽度、外围内边距或固定内容高度留下大块空白。

### 当前合同

- 三款应用共用 `ApplicationWorkspace` 和其中间工作区布局；保留导航轨、当前应用左侧菜单、中心区和右侧工具资源栏的现有 Owner，不新增独立导航栏。
- 常规模式和 AI Work 模式的主内容均贴合中间列边缘，并占满顶部工作区标题栏以下的可用高度。
- 背景必须使用当前工作区对应的 `settings.appearance.backgrounds` 位置：选图片时同一张图片铺满中间画布并从内容面板中可见；选“纯色”时不显示工作区背景图片或独立横幅图片。
- 浅色和深色主题均尊重外观页的背景遮罩设置；有背景图片时，聊天和状态面板保持透光，文字与输入控件仍清晰可读；无背景图片时继续使用不透明纯色面板。
- 常规模式保留真实的“尚未连接业务能力”说明和状态占位；底部状态区域随工作区扩展填满剩余高度。
- AI Work 中心内容顶部不显示额外的应用标题/说明区；中心区域直接由对话消息和输入区占满。
- AI Work 会话列表显示在当前应用对应的 `ApplicationSidebar` 左侧菜单中，不显示在中心区或覆盖抽屉；会话按应用隔离，新建、切换、归档行为保持可用。
- AI Work 聊天面板在桌面、紧凑和移动布局中占满可用区域，不受旧最小高度覆盖；全局应用导航仍由外层工作台侧栏负责。
- 完成标准：共享实现覆盖三款应用的 AI Work；中心内容紧接工作区模式工具栏开始对话；会话只出现在当前应用的左侧菜单；前端 TypeScript 检查和构建通过；说明未执行的浏览器视觉验收。

### 本轮导航决策（2026-09-28）

- 在应用工作区内，侧栏只标记当前应用；其他应用入口禁用，避免直接跨应用跳转。用户先返回“应用中心”，再选择另一应用。
- 应用中心仍是跨应用切换入口；最左侧全局导航与应用内业务菜单保持原有职责。

### 允许修改

- `frontend/src/components/Workbench.tsx`：向共享外壳标记当前工作区是否配置了背景图片，供样式按真实设置切换透明度。
- `frontend/src/components/module-workbench.css`：调整共享中间工作区的尺寸、背景继承、主题透明度、纯色回退样式及应用侧栏中的会话区域。
- `frontend/src/components/ApplicationWorkspace.tsx`：将 AI Work 会话导航放入当前应用左侧菜单，并连接会话选择、新建和归档状态。
- `frontend/src/components/AiWorkChat.tsx`：移除会话抽屉和对话区会话入口，通过受控会话状态加载与显示消息。
- `frontend/src/components/ai-work-chat.css`：保持 AI Work 中间画布为单列对话布局。
- `docs/PROMPTS.md`：登记本任务合同和完成记录。

### 禁止修改

- 不新增功能、占位业务数据、图片、动效、依赖或 CSS 自定义属性。
- 不修改应用路由、后端 API、全局主导航轨和右侧上下文栏；仅调整当前应用左侧菜单中的 AI Work 会话导航与中心区标题呈现。
- 不部署、发布、上传、购买或提交 Git。

### 本轮修正（2026-09-28）

- 用户指出进入 SteamCMD AI Work 时，中间工作区仍被内部“会话”侧栏分成两列；中间区域应由对话区独占。
- 通过对话区内的“会话”入口按需打开覆盖抽屉，默认不为会话列表保留横向空间；抽屉保留会话新建、切换、归档与 Provider 状态。
- 外层应用导航属于全局工作台左栏，保持原有位置和职责。

### 用户进一步澄清（2026-09-28）

- 用户指出红框中的 AI Work 应用标题与说明不应占据中心对话区；该标题区必须移除。
- 会话列表必须迁入当前应用真正对应的左侧菜单，由 `ApplicationSidebar` 持有展示与选择入口；中心区不出现会话侧栏、抽屉或会话按钮。
- 本节取代上方“覆盖抽屉”方案；保留原有会话持久化与会话操作。

### 完成记录（2026-09-28）

- 用户反馈首轮铺满调整仍被浅色聊天面板遮住背景，常规模式还存在硬编码横幅图；现已按当前工作区的外观背景位置修正图层与透明面板规则。
- 图片背景时，同一张设置图片铺满中间画布并透过聊天和常规状态面板显示；“纯色”时中间画布使用主题画布色，常规模式不再显示独立横幅图片。
- `pnpm run build:frontend` 通过，TypeScript 检查与 Vite 构建均成功，产物写入根目录 `dist/frontend/`；构建产物内确认包含图片/纯色分支样式且不含硬编码应用横幅图片。
- 仓库未提供 `workspace-preflight` 脚本，当前目录没有 Git 元数据；浏览器目视核对因 `cua_repl` 返回 `nodeRepl.fetch request failed` 未能执行。
- 用户进一步指出覆盖抽屉仍属于中间区域，前一版抽屉方案已撤销。
- 最终实现已移除中心区 AI Work 标题/说明和会话入口；会话列表显示在当前应用左侧菜单，保留按应用读取、新建、切换、归档和 Provider 状态。
- `pnpm run build:frontend` 通过，包含 `tsc --noEmit` 和 Vite 构建，产物位于根目录 `dist/frontend/`。本轮未执行浏览器目视验收。

## LFAA-UI-APP-CONTEXT-01

### 用户目标

应用工作区同一时间只显示一个当前应用；切换应用后，原应用的 AI Work 会话选择和未发送草稿仍可恢复，不串入新应用。

### 当前合同

- 左侧应用列表在工作区内明确显示唯一“当前”应用，其他应用入口禁用；需要切换时先返回“应用中心”再选择。
- AI Work 当前会话选择与未发送草稿按 `appId` 保存在已挂载的 `Workbench` 内存状态中；切换应用或模式后返回，恢复对应应用的会话和草稿。
- 新建、选择、归档会话仍使用现有 API 与会话列表；不同应用的状态互相隔离。
- 草稿不写入 `localStorage`、URL、账户偏好或 server；不新增 API、数据库字段或持久化层。
- 不改变 `/api/preferences` 的请求时机、应用路由语义、AI 请求中断行为或 P1-09 的服务端请求观察范围。
- 完成标准：应用内不能直接跳转到其他应用；经“应用中心”切换后，仍只有一个当前应用，返回原应用可恢复其 AI 会话和未发送草稿；切换会话操作保持原状；前端构建通过。

### 允许修改

- `frontend/src/components/Workbench.tsx`：持有按应用隔离的短期 AI Work 界面状态并传递给应用工作区。
- `frontend/src/components/ApplicationWorkspace.tsx`：恢复当前应用会话选择、同步会话操作，并呈现明确的当前应用标识。
- `frontend/src/components/AiWorkChat.tsx`：本地响应式编辑草稿，并通过回调同步到工作台内存以便按应用恢复。
- `frontend/src/components/module-workbench.css`：当前应用标记、禁用应用入口及切换提示样式，不新增 CSS 自定义属性。
- `docs/PROMPTS.md`：维护任务索引、合同及完成记录。

### 禁止修改

- 不移除“应用中心”这一跨应用切换路径，不增加并行应用面板或新的全局导航。
- 不修改 `frontend/src/App.tsx`、偏好保存/API 请求、server、数据库或日志观察逻辑；P1-09 的空闲请求观察仍待单独完成。
- 不把对话草稿写入浏览器持久存储；不新增依赖、业务功能或与本任务无关的视觉改动。
- 不部署、发布、上传、购买或提交 Git。

### 完成记录（2026-09-28）

- 左侧应用列表把唯一当前应用标为“当前”，并禁用其他应用的直接跳转；切换路径为先返回应用中心。
- `Workbench` 按 `appId` 在内存中保留 AI Work 当前会话 ID 和未发送草稿；应用或模式切换后，回到原应用可恢复对应内容。工作区按应用和模式使用独立 React key，避免旧应用的对话组件状态短暂复用到新应用。
- 新建、选择、归档会话继续使用现有 API；未修改偏好保存请求、服务端或 P1-09 日志观察链路。
- `pnpm run build:frontend` 通过，包含 TypeScript 检查和 Vite 构建，产物位于根目录 `dist/frontend/`。未执行浏览器交互验收。
- 已尝试执行 `node scripts/workspace-preflight.mjs`，但当前仓库没有该脚本；仓库也没有 `quality:full` 门禁脚本或 Git 元数据，无法运行 `git diff --check`。

## LFAA-UI-WORKBENCH-CHROME-PERSISTENCE-01

### 用户目标

用户收起应用工作区左侧导航后，切换常规模式与 AI Work 时继续保持收起；模式切换不得把用户刚刚做出的侧栏选择重置为默认展开。

### 当前合同

- 同一应用内切换模式导致工作区重新挂载时，必须尊重现有 `lfaa.module-workbench.chrome.v2`（或兼容的 v1）中保存的 `leftCollapsed` 状态；不得因初始化导航布局默认值而覆盖。
- 首次使用且没有已保存工作区开合状态时，仍按账户当前 `navigationLayout` 初始化侧栏；用户之后显式修改该设置时，现有布局行为保持有效。
- 继续使用现有浏览器偏好键，不新增 API、账户字段、数据库、依赖或另一套状态存储；不改变移动端响应式收起、侧栏内容、快捷键或模式路由。
- 完成标准：代码路径可证明已有保存状态优先于挂载默认值；`pnpm --filter lfaa-frontend run build` 通过，产物位于根目录 `dist/frontend/`。

### 允许修改

- `frontend/src/components/ApplicationWorkspace.tsx`：修正首次挂载与模式切换重挂载时的侧栏状态初始化/默认值应用时机。
- `docs/PROMPTS.md`：维护本任务合同、任务索引和完成记录。

### 禁止修改

- 不修改应用路由、模式切换请求、偏好 API、server、数据库、布局 CSS、拖拽与吸附行为。
- 不改变已有用户保存的侧栏状态，不新增存储键或设置项；不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对已有 v2/v1 状态会阻止挂载默认值覆盖、无历史状态仍应用账户导航布局、显式更改布局设置仍生效。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查及 Vite 构建通过，产物位于根目录 `dist/frontend/`；若浏览器交互验收不可用，如实记录。

### 完成记录（2026-09-28）

- 工作区状态保存时附带当时的 `navigationLayout` 快照。模式切换重新挂载时，如果导航布局未变，就保留已保存的左右侧栏开合状态；旧版 v1/v2 记录没有快照时也优先保留已有状态。无历史工作区状态时仍按账户导航布局初始化，设置值后续变化时继续应用。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查和 Vite 构建；产物写入根目录 `dist/frontend/`。
- 未完成浏览器点击验收：当前浏览器枚举因 `nodeRepl.fetch request failed` 失败。当前目录没有 Git 元数据，无法核对 Git 变更状态或运行 `git diff --check`。

## LFAA-UI-AI-PROVIDER-LOADING-01

### 用户目标

从常规模式进入 AI Work 时，不因活动 Provider 仍在加载而短暂显示“尚未配置活动 Provider”黄色警告。

### 当前合同

- 只有活动 Provider 查询成功且结果中没有活动账户时，才显示未配置 Provider 警告。
- Provider 查询期间不显示未配置警告或“模型未配置”状态，模型标签和输入提示显示读取中；查询失败时显示实际加载错误，不将失败伪装成“没有活动 Provider”。
- 保留现有 Provider API、发送禁用条件、Runtime、会话和警告文案；不新增依赖、CSS、存储、API 或设置项。
- 完成标准：状态判断能区分加载中、已成功且无账户、加载失败；`pnpm --filter lfaa-frontend run build` 通过，产物写入根目录 `dist/frontend/`。

### 允许修改

- `frontend/src/components/AiWorkChat.tsx`：区分 Provider 加载状态，并根据成功结果呈现未配置警告。
- `docs/PROMPTS.md`：维护任务索引、合同及完成记录。

### 禁止修改

- 不修改 Provider API、模型 Runtime、会话/模式路由、发送行为或账户数据。
- 不改变实际无活动 Provider 时的警告与输入禁用语义；不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对加载中不显示未配置警告、成功返回空活动账户时显示警告、加载失败显示真实错误。
- 运行 `pnpm --filter lfaa-frontend run build`；浏览器交互无法使用时如实记录。

### 完成记录（2026-09-28）

- Provider 状态新增加载中、成功、失败三态。加载中显示读取提示；只有成功读取后确认没有活动账户才显示原黄色警告；读取失败显示实际错误，不叠加“未配置”误报。
- `pnpm --filter lfaa-frontend exec vite build` 通过，产物写入根目录 `dist/frontend/`，并核对构建包包含读取中与未配置提示文案。
- 完整命令 `pnpm --filter lfaa-frontend run build` 被 `frontend/src/components/MinecraftWorkspace.tsx:47` 的 `TS6133 sandboxStatusLabel is declared but its value is never read` 阻断；该错误不在本任务修改文件内，未顺手改动。
- 未完成浏览器交互验收：浏览器枚举返回 `nodeRepl.fetch request failed`。当前目录没有 Git 元数据，无法核对 Git 变更状态或运行 `git diff --check`。

## LFAA-UI-SCROLL-RESTORATION-SHARED-01

### 用户目标

刷新设置中心、应用中心和应用内功能页面后，恢复用户最后停留的主要滚动位置，避免页面或菜单跳回顶部。滚动记忆由前端共享模块实现，各页面只提供账户与区域标识并调用同一能力。

### 当前合同

- 新增共享滚动恢复 hook 与 key 构造函数，统一完成账户/区域隔离、读取、节流保存、离页冲刷和恢复。
- 设置正文按账户与设置分类隔离；设置导航按账户隔离。应用中心按账户隔离；应用工作区正文、工具资源栏、左侧应用列表/功能菜单/会话列表和 Minecraft 日志按账户及其应用、路由、会话或实例区域分别隔离。
- AI Work 消息列表按账户、应用与会话隔离；为刷新后恢复对应消息列表，只额外保存最近选中的会话 ID，不保存消息正文、草稿、设置值或认证信息。
- 同步内容在布局提交时恢复；异步内容必须等对应数据加载就绪后恢复，避免初始空内容把已存位置钳制到顶部。
- 滚动数值作为非敏感浏览器界面偏好保存在 `localStorage`；存储不可用时静默降级，不影响页面滚动和业务操作。
- 不改变页面布局、路由、业务加载、聊天消息自动行为或服务端数据归属；不新增依赖、API、数据库字段或 CSS 变量。
- 完成标准：设置与主要应用功能滚动区域均调用同一共享实现，前端 TypeScript 检查与构建通过，产物位于根目录 `dist/frontend/`；准确说明是否完成浏览器刷新实测。

### 允许修改

- `frontend/src/shared/scroll-restoration.ts`：实现共享滚动位置 key 与 React hook。
- `frontend/src/components/Workbench.tsx`、`frontend/src/components/SettingsPage.tsx`、`frontend/src/components/ApplicationWorkspace.tsx`、`frontend/src/components/AiWorkChat.tsx`、`frontend/src/components/MinecraftWorkspace.tsx`：将各自实际负责滚动的持久页面/菜单区域接入共享 hook，并传递账户及所需区域标识。
- `docs/PROMPTS.md`、`docs/系统总体架构.md`：维护本任务合同与完成记录，并说明共享滚动偏好的前端归属和持久化边界。

### 禁止修改

- 不把滚动位置、聊天消息正文、草稿、账户设置或认证凭据写入服务端；浏览器只保存区域化滚动数值和恢复 AI Work 会话所需的非敏感会话 ID。
- 不持久化短暂弹窗、通知列表、工具提示等临时浮层的滚动状态；不改变 Minecraft 日志的实时加载或 AI Work 对话行为。
- 不修改业务 API、数据库、权限、样式布局或 CSS 自定义属性；不新增依赖，不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对每个实际滚动容器使用共享 key/hook，且用户、应用、路由、设置分类、会话与实例之间不会串位；异步区域恢复受加载状态控制。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查和 Vite 构建通过，产物写入根目录 `dist/frontend/`。
- 当前无已登录浏览器会话时，不伪称完成刷新验收；记录仍需在浏览器验证的区域。

### 完成记录（2026-09-28）

- 新增共享 `createScrollRestorationKey` 与 `useScrollRestoration`，按用户和界面区域隔离，统一读取、140ms 滚动节流保存、路由/组件切换冲刷、`pagehide` 冲刷和布局提交前恢复；支持异步就绪门控及浏览器窗口滚动。
- 应用中心窗口滚动、工作区主内容、设置正文与分类导航、应用/功能/会话导航、工具资源栏、AI Work 消息列表、Minecraft 日志均接入同一 hook。设置正文会从旧 `lfaa.settings.scroll-position.v1` 键迁移；AI Work 只额外保存当前会话 ID以便刷新后加载服务端消息，不保存消息正文或草稿。
- `docs/系统总体架构.md` 已记录共享模块 Owner 与浏览器/服务端持久化边界。静态核对确认其余实际溢出区域属于临时通知或弹出面板，未写入持久偏好。
- `pnpm --filter lfaa-frontend run build` 通过，包含 `tsc --noEmit` 和 Vite 构建；产物位于根目录 `dist/frontend/`。
- 未完成浏览器刷新验收：当前 CUA 浏览器枚举失败（`nodeRepl.fetch request failed`），没有可操作的已登录页面。仓库未提供 `scripts/workspace-preflight.mjs` 或 `quality:full`；当前目录无 Git 元数据，无法运行 `git diff --check` 或核查 Git 变更状态。

## LFAA-UI-CENTER-SCROLLBAR-HIDE-01

### 用户目标

应用工作区中间区域不显示滚动条，同时继续支持滚轮、触控、键盘及现有滚动位置恢复。

### 当前合同

- 隐藏共享中间内容区及其内部滚动区域的可见滚动条；不改变实际滚动容器、滚动方向或滚动位置恢复行为。
- 适用于 Minecraft、SteamCMD、写作应用的常规模式与 AI Work；左侧导航、应用菜单、右侧工具资源栏及外层工作台不受影响。
- 不改变布局尺寸、内容、路由、业务逻辑或 CSS 自定义属性；不新增依赖。
- 完成标准：中间区域不绘制滚动条，内容仍可正常滚动；前端构建通过且产物位于根目录 `dist/frontend/`。浏览器目视验收未执行时如实记录。

### 允许修改

- `frontend/src/components/module-workbench.css`：仅隐藏共享中间内容区及其后代滚动容器的滚动条外观，保留滚动行为。
- `docs/PROMPTS.md`：维护本任务索引、合同和完成记录。

### 禁止修改

- 不改滚动容器的 `overflow`、滚动位置恢复 hook、页面布局、侧栏或右侧上下文栏。
- 不修改业务组件、路由、服务端、运行数据或其他样式；不新增 CSS 变量、依赖或动效。
- 不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对隐藏规则仅作用于共享中间内容区及其后代，且没有移除已有滚动行为。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查和 Vite 构建结果；若完整构建受无关既有问题阻塞，单独运行 Vite 构建核对样式产物并说明限制。

### 完成记录（2026-09-28）

- 用户截图显示中间 AI Work 长回复旁仍出现原生滚动条。在共享中间内容区及其后代的隐藏规则上补充强制覆盖，并将 Chromium/WebKit 滚动条宽高归零；保留消息列表原有 `overflow: auto`、滚动位置恢复 Hook 和滚轮/触控板滚动路径。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查与 Vite 构建均成功；构建产物写入根目录 `dist/frontend/`。未执行浏览器目视或滚轮/触控板交互验收。
- 浏览器目视验收未完成：浏览器枚举返回 `nodeRepl.fetch request failed`。当前目录没有 Git 元数据，无法运行 `git diff --check`。

## LFAA-UI-CENTER-RESIZE-REFLOW-01

### 用户目标

拖窄应用工作区中间列时，Minecraft 总览卡片不要因仍强制四列而连续挤压、折行和跳动；过渡保持跟手。

### 当前合同

- Minecraft 总览的统计卡片与沙盒说明卡片依据中间内容容器的实际宽度重排，不依赖浏览器视口宽度判断列数。
- 统计值标题随中间容器宽度在清晰可读范围内连续缩放，降低分隔条微小位移就触发行内折行的情况。
- 保持工作台分隔条直接跟随指针、现有吸附阈值、布局持久化、滚动行为和其余应用内容不变。
- 不新增动画、依赖、CSS 自定义属性或业务状态；不修改组件状态、API、路由或布局 Owner。
- 完成标准：中间列变窄时 Minecraft 卡片保持可读并按容器宽度重排；前端构建通过，产物写入根目录 `dist/frontend/`。浏览器拖拽目视验收未完成时如实记录。

### 允许修改

- `frontend/src/components/module-workbench.css`：将共享中心内容标记为按自身宽度查询的命名容器。
- `frontend/src/components/MinecraftWorkspace.css`：依据中间列容器宽度重排总览卡片，并连续缩放统计值标题。
- `docs/PROMPTS.md`：维护任务索引、合同和完成记录。

### 禁止修改

- 不修改 `ResizableWorkbench` 拖拽算法、工作台宽度阈值、吸附迟滞、宽度偏好或侧栏布局。
- 不修改 Minecraft 业务组件、数据、API、路由、滚动恢复或其他应用样式。
- 不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对容器查询以中间列宽度为依据、四列向两列/单列收敛，且标题缩放有上下限。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查和 Vite 构建通过，产物位于根目录 `dist/frontend/`；浏览器拖拽手感无法实测时如实说明。

### 完成记录（2026-09-28）

- 中间内容容器增加命名 inline-size 查询；Minecraft 统计卡标题以容器单位在 16px 至 20px 之间连续缩放，统计与沙盒说明卡在中间列不超过 920px 时切换为两列、不超过 560px 时切换为单列，实例详情栅格同步收敛。
- `pnpm --filter lfaa-frontend exec vite build` 通过，产物写入根目录 `dist/frontend/`；目标文件 `git diff --check` 通过。构建 CSS 中已核对命名容器查询和 `cqi` 规则。
- 完整命令 `pnpm --filter lfaa-frontend run build` 被现有未提交改动中的 `AiWorkChat.tsx`、`Workbench.tsx` TypeScript 错误阻塞；本任务未修改这两个文件。仓库没有 `scripts/workspace-preflight.mjs`，根脚本也未定义额外 quality/release Gate。
- 未完成浏览器拖拽目视验收；截图能看到卡片文字折行，但无法从静态图确认运行时掉帧或闪烁。

## LFAA-UI-WORKBENCH-REFLOW-STABILITY-01

### 用户目标

修复展开或收起工作台左右菜单、底部终端时中间区域闪屏、抖动和跳动的问题，并覆盖所有共用此布局的页面。

### 当前合同

- `SettingsPage` 与 `ApplicationWorkspace` 共用的 `ResizableWorkbench` 在左右 Dock 宽度动画期间标记布局过渡；Minecraft 中间内容的容器断点暂停到动画结束，避免随每帧宽度变化反复切换卡片列布局。
- 半透明应用侧栏在左右 Dock 开合动画期间暂停背景模糊采样，过渡结束后恢复当前外观偏好；现有拖拽暂停行为保持不变。
- 应用侧栏/底部终端状态变化不应因父工作区重渲染而重新执行 Minecraft 或 AI Work 的整页组件函数；组件自身状态更新仍正常工作。
- 保留工作台开合尺寸、交互、吸附和持久化语义；不改业务数据、API、路由或其他响应式断点。
- 静态核对共享布局覆盖范围与过渡事件收尾；构建和浏览器开合观感待验收。

### 允许修改

- `frontend/src/workbench/ResizableWorkbench.tsx`、`frontend/src/workbench/workbench.css`：跟踪共享 Grid 轨道过渡并暂缓中间内容断点切换。
- `frontend/src/styles/workbench.css`：左右 Dock 开合期间暂停应用侧栏实时背景模糊采样。
- `frontend/src/components/ApplicationWorkspace.tsx`、`frontend/src/components/MinecraftWorkspace.tsx`、`frontend/src/components/AiWorkChat.tsx`：稳定导航回调并避免无关开合状态导致重渲染重页面。
- `docs/系统总体架构.md`、`docs/PROMPTS.md`：同步共享布局行为与本次任务记录。

### 完成记录（2026-09-29）

- 共享工作台通过轨道过渡事件标记左右宽度动画；动画期间 Minecraft 内容使用稳定的外层容器作为响应式参照，结束后恢复最终中心宽度对应的断点。应用左右侧栏在同一时段暂停实时背景模糊；拖动期间既有规则保留。
- 稳定应用内导航回调，并对 Minecraft 工作区与 AI Work 聊天使用 `memo`，避免菜单或终端开合导致业务重页面重渲染。
- 本轮未运行构建或自动化检查，亦未进行浏览器目视验收；尚未验证实际帧表现。

## LFAA-SETTINGS-AUTOSAVE-01

### 用户目标

修复设置中心所有已接入账户设置只改内存、刷新后丢失的问题；设置分类、滚动位置及加载体验继续保持稳定。

### 当前合同

- 设置中心中由 `updateSettings` 编辑的服务端账户设置，在控件变更后自动保存；短时间连续变化按类别合并，停止操作后保存最新值。现有“立即保存”操作保留为即时提交和失败重试入口。
- 同一设置类别的并发写入串行收敛到最新修订，旧响应不得覆盖新编辑或其他类别的当前内存值；保存失败时保留本次页面中的编辑值并显示可重试错误。
- `UserSettings` 的 `aiRuntime` 前端键必须映射到服务端现有 `ai-runtime` 路径；不改服务端分类、数据格式、权限或数据库合同。
- 服务端校验白名单必须覆盖前端实际提交且服务层已支持的字段；保持严格拒绝未知字段，发现既有字段漏登记时只补齐该字段的原有合法取值。
- 已确认外观保存失败的根因：前端及服务层都包含 `appearance.sidebarColor`，但 API 的严格 Joi schema 未登记该字段，导致整份外观设置保存请求被拒绝。
- 服务端仍是账户设置的持久化 Owner。浏览器只保留设置分类、分类滚动位置、外观高级设置展开状态和背景目标选择等非敏感界面状态，不复制账户设置或设置草稿。
- AI Provider 密钥、密码、恢复密钥和其他需明确提交的凭据，不进入自动保存队列或浏览器存储；沿用各自已有的明确提交 API。
- 只读状态和未接入分类继续保持说明性，不伪装为可保存设置；快捷键冲突等服务端校验失败必须明确反馈，不能被自动保存绕过。修复前端类型、API schema 和服务层之间的既有字段漂移，不新增账户设置字段或持久化格式。
- 完成标准：所有真实账户设置控件通过统一自动保存路径，刷新后从服务端恢复；前端类型检查与构建通过，产物位于根目录 `dist/frontend/`。

### 允许修改

- `frontend/src/components/SettingsPage.tsx`：保持所有账户设置编辑使用统一自动保存、错误提示和即时提交路径；保留凭据显式提交边界。
- `frontend/src/api.ts`：保持 `aiRuntime` 到 `ai-runtime` 的路径映射与离页请求行为。
- `server/src/api/routes.ts`：仅补齐与现有前端类型和设置服务一致的遗漏校验字段；保持未知字段拒绝、现有取值限制及服务端权限边界。
- `docs/PROMPTS.md`：维护本任务合同与完成记录。

### 禁止修改

- 不改数据库 schema、设置类别字段、服务端授权或真实业务能力；不重写设置服务。
- 不把任何账户设置、设置草稿、密码、恢复密钥或 Provider Secret 写入浏览器持久存储。
- 不新增依赖，不移除安全校验，不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对前端六类账户设置与 API schema / 服务层字段一致，所有账户设置控件统一经过自动持久化路径，短时间连改不会旧值覆盖新值，`aiRuntime` 路径映射有效，秘密字段仍需显式提交。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与 Vite 构建通过，产物位于根目录 `dist/frontend/`；如无法使用已登录浏览器实测保存后刷新，准确记录限制。

### 完成记录（2026-09-28）

- 设置中心全部 21 处 `updateSettings` 控件共用按账户设置类别自动保存路径；300ms 内的连续变化合并写入。同类别请求串行追到最新修订，响应只合并对应类别，避免旧响应覆盖其他类别的编辑。
- 页面离开时冲刷等待中的类别写入，设置 API 请求启用 `keepalive`；保存失败按类别保留错误提示，现有按钮改为“立即保存”并作为手动提交/重试入口。快捷键冲突时暂停写入并提示。
- 修正 `aiRuntime` 客户端键写入服务端已存在的 `/settings/ai-runtime` 路径。背景上传后的选择与背景删除前的引用更新都通过同一持久化路径。
- 设置分类和滚动位置、外观高级区展开状态、背景目标选择按账户保存在浏览器；账户设置值仍只由服务端保存。AI Provider 密钥和恢复密钥保留显式提交，不进入自动保存。
- `pnpm --filter lfaa-frontend run build` 通过，含 TypeScript 检查；Vite 产物写入根目录 `dist/frontend/`。当前没有已登录浏览器会话可完成保存后刷新实测。
- 仓库没有 `scripts/workspace-preflight.mjs` 或 quality/release Gate 脚本，workspace preflight 无法运行；当前目录无 Git 元数据，无法运行 `git diff --check` 或核对 Git 变更状态。

### 补充修复记录（2026-09-29）

- 根因：前端和设置服务均包含 `appearance.sidebarColor`，但 API 的严格 Joi 白名单遗漏该字段；外观控件提交整份分类对象时都会因未知字段返回 400，所以自动保存与“立即保存”一并失败，刷新读回旧值。
- 在 `server/src/api/routes.ts` 为既有 `sidebarColor` 字段补齐服务层已有的 `auto` 或六位十六进制颜色约束；继续拒绝其他未知字段。逐项核对六类账户设置字段后，其他五类与 API schema / 设置服务一致。
- `pnpm --filter lfaa-frontend run build` 和 `pnpm --filter lfaa-server run build` 均通过；`git diff --check` 通过。构建输出分别写入根目录 `dist/frontend/` 与 `dist/server/`。
- 已检查开发 API 健康状态为 200；当前桌面浏览器连接器未返回可用浏览器或标签页，未能在登录态下实际调整 10%、保存并刷新确认。

## LFAA-SETTINGS-BACKGROUND-RENDER-01

### 用户目标

修复外观设置中为“设置中心”选择背景图片后，设置中心实际页面仍显示纯色的问题。

### 当前合同

- 设置中心继续使用账户设置 `appearance.backgrounds.settings` 选择背景；外层 `.workbench-shell` 负责背景图片与遮罩，设置页面内部工作台根容器不得用不透明底色覆盖该背景。
- 背景遮罩滑块同时控制设置正文与设置导航的大面积表面透明度：0% 时不叠加遮罩且两处透出所选壁纸，数值升高时逐步增加主题底色以提高文字对比度。
- “统一侧边栏颜色”只决定设置导航的底色色调；透明度由背景遮罩控制。独立设置卡片保留各自表面以维持文字可读性，其他应用工作区的侧栏行为保持现状。
- 本次只修复设置中心大面积表面的 CSS 遮挡并明确控件说明，不改变背景选择目标、资源映射、自动保存、API、设置数据结构、登录页或其他工作区行为。
- 完成标准：设置中心的内部工作台透出所选背景；前端 TypeScript 检查与构建通过，产物位于根目录 `dist/frontend/`。

### 允许修改

- `frontend/src/components/SettingsPage.css`：仅调整设置中心内部工作台根容器和设置正文表面的背景绘制。
- `frontend/src/components/SettingsPage.tsx`：说明背景遮罩与侧边栏颜色分别控制的视觉属性。
- `frontend/src/components/Workbench.tsx`：将背景遮罩百分比传递给设置中心大面积表面透明度。
- `docs/PROMPTS.md`：维护本任务合同和完成记录。

### 禁止修改

- 不修改设置 API、账户设置 schema、图片资源、登录页或其他工作区的背景样式。
- 不修改侧边栏颜色取值、设置卡片表面、其他工作区侧栏样式、布局或交互；不新增服务端设置字段或依赖。
- 不部署、发布、上传或提交 Git。

### 验收方式

- 静态确认设置页内部工作台根容器透明；正文和设置导航的不透明度与背景遮罩百分比一致，0% 时不遮挡所选壁纸；统一侧边栏颜色仍提供背景色调，设置卡片表面保持独立。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与 Vite 构建通过，产物写入根目录 `dist/frontend/`。

### 完成记录（2026-09-28）

- 设置页内部工作台根容器透明；正文与设置导航的底色不透明度跟随背景遮罩，0% 时完整透出壁纸，侧栏色调仍由“统一侧边栏颜色”提供，设置卡片保留独立底色。
- 背景遮罩和侧栏颜色说明已区分透明度与色调；高级“半透明侧边栏”说明明确该开关作用于应用导航和工具资源栏。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查与 Vite 构建成功；确认生成 CSS/JS 产物包含动态不透明度规则，产物位于 `dist/frontend/`。
- `git diff --check` 对本任务涉及文件通过。仓库没有 `scripts/workspace-preflight.mjs` 或 quality/release 脚本；未进行浏览器目视验收。

## LFAA-SETTINGS-APPEARANCE-DEFAULTS-01

### 用户目标

检查设置中心“外观”中的背景位置、背景遮罩和玻璃模糊控制，保留每类界面按用途独立的样式，只统一确实共用的设置来源，并修正样式缺省值，避免设置值缺失时出现 0% 透明度等意外表现。

### 当前合同

- 外观偏好的 API、账户数据结构、自动保存、背景上传/删除和目标选择持久化行为保持不变；不把所有工作区表面改成相同样式。
- 新账户、缺少对应字段的旧账户及“恢复默认”采用用户截图中的背景遮罩 37%、玻璃模糊 14px；工作台 CSS 动态设置未覆盖时使用同一兜底值。已经保存的账户外观偏好不批量覆盖。
- 背景目标沿用现有六个独立槽位；Minecraft 常规模式与 AI Work 继续共用 `minecraft` 槽位。背景位置选择、预览卡片、上传、删除和当前路由应用关系不改变。
- 背景遮罩、模糊和侧栏自定义颜色各自继续控制现有职责；仅合并确实相同的共享默认值/样式入口。组件特有的卡片、控件、消息和布局样式保留。
- 无背景图时的纯色表面与高级“半透明侧边栏”现有行为保持不变；不改路由、布局、主题色、图片资源、设置 API 或服务端 schema。
- 完成标准：前端与 server 默认值一致；工作区共享 CSS 兜底值与其一致；静态确认背景槽位映射与即时预览/自动保存路径未被改变；前端 TypeScript/Vite 构建通过且产物在根目录 `dist/frontend/`。

### 允许修改

- `frontend/src/styles/workbench.css`：定义工作区外观共享兜底值，供对应页面样式读取。
- `frontend/src/components/module-workbench.css`、`frontend/src/components/SettingsPage.css`、`frontend/src/components/ai-work-chat.css`、`frontend/src/styles/application-workspace.css`：仅将确实共享的背景遮罩/模糊默认值改为使用工作区定义的兜底值；保留组件特有样式。
- `frontend/src/components/Workbench.tsx`、`frontend/src/components/SettingsPage.tsx`、`server/src/modules/settings/service.ts`：让新账户、恢复默认和工作区 CSS 使用同一组外观默认值；不改现有保存协议与设置字段。
- `docs/系统总体架构.md`：同步记录外观设置默认值。
- `docs/PROMPTS.md`：维护本合同和完成记录。

### 禁止修改

- 不改变用户已经保存的外观偏好，不改 API、schema、背景槽位或上传/删除业务逻辑。
- 不重做整套视觉设计，不强制所有面板、卡片或消息共用透明度/背景，不引入新依赖或新增持久化配置。
- 不部署、发布、上传、清理运行数据或提交 Git。

### 验收方式

- 对照 `frontend/src/components/SettingsPage.tsx`、`server/src/modules/settings/service.ts` 与工作台 CSS 中的外观默认值，确认均为遮罩 37%、模糊 14px；核对 CSS 未再把共享遮罩变量的缺省值设为 0%。
- 核对背景位置六个选项仍映射到原有 `appearance.backgrounds` 槽位，Minecraft 常规与 AI Work 仍共享 `minecraft`；选择卡片后仍通过原 `updateSettings` 即时预览并自动保存。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与 Vite 构建通过，产物写入根目录 `dist/frontend/`；对任务文件运行 `git diff --check`。记录未进行的浏览器外观验收。

### 完成记录

- 前端“恢复默认”、server 新账户/缺省设置和工作区 CSS 兜底统一为遮罩 37%、模糊 14px，取自用户截图中的当前外观值；已保存的用户偏好仍由原账户值覆盖，不做批量迁移。
- CSS 的共用设置变量由 `.workbench-shell` 提供默认值；设置页、应用侧栏和聊天输入区消费同一变量，移除分散的 0%/8px 缺省值。组件专用背景、卡片与消息样式保持独立。
- 核对六个背景目标及 `/apps/{应用}/{normal|ai-work}` 路由映射未改变；Minecraft 常规和 AI Work 继续使用 `minecraft` 背景槽，卡片仍即时预览并通过现有自动保存逻辑持久化。
- `pnpm --filter lfaa-frontend run build` 与 `pnpm --filter lfaa-server run build` 均通过，构建产物写入根目录 `dist/frontend/` 与 `dist/server/`；本任务涉及文件 `git diff --check` 通过。
- 尝试读取浏览器进行目视验收时，CUA 返回 `nodeRepl.fetch request failed`，未取得页面状态；因此未验证真实窗口中的背景合成效果和控件交互。

## LFAA-WORKSPACE-BACKGROUND-UNIFICATION-01

### 用户目标

让所选工作区壁纸由同一层绘制，且背景遮罩滑块对设置中心、应用常规模式和 AI Work 的主要画布与导航表面产生一致效果，避免模式切换后透明度控制表现不同。

### 当前合同

- `.workbench-shell` 是工作区壁纸与遮罩的唯一绘制 Owner；应用中间画布不得重复绘制同一图片或遮罩。
- 设置中心、应用导航/工具栏、常规模式主提示表面和 AI Work 输入区等主要表面共用 `--settings-background-surface-opacity`。AI Work 对话画布本身保持透明以显露外壳壁纸，避免父子表面叠加；0% 时受控表面不盖住壁纸，提高百分比时按同一值增加主题底色。
- “统一侧边栏颜色”继续提供侧栏色调，“半透明侧边栏”继续负责其模糊开关；二者不得覆盖背景遮罩对大面积表面透明度的控制。
- 小型操作控件、聊天消息气泡及独立内容卡继续使用自身主题表面以保证可读性；不把壁纸透明度扩大成对所有按钮或语义卡片的强制透明。
- 常规模式和 AI Work 保持现有业务组件、路由、数据及交互不变；只统一外层背景和主要表面透明度。
- 应用背景仍按设置中的工作区位置分别保存；Minecraft 常规与 AI Work 共用 `minecraft` 背景槽，和设置中心背景互相独立。
- 本任务扩展设置中心背景修复范围，覆盖先前合同所述“其他应用工作区侧栏行为保持现状”的限制；不改变背景选择目标、图片资源映射、自动保存、API、账户设置数据结构或登录页。
- 完成标准：静态可确认唯一背景绘制 Owner、主要表面共用同一动态透明度值且常规/AI Work 无固定模式透明度；前端 TypeScript 检查与构建通过，产物位于根目录 `dist/frontend/`。

### 允许修改

- `frontend/src/styles/workbench.css`：保持工作台外壳唯一绘制壁纸，并让应用侧栏主要表面跟随共同透明度。
- `frontend/src/components/module-workbench.css`：移除重复中间背景，统一应用工作区侧栏、顶部栏、常规模式提示区与 AI Work 大面积表面的透明度。
- `frontend/src/components/SettingsPage.css`、`frontend/src/components/SettingsPage.tsx`：保持设置中心与应用工作区对同一遮罩设置的说明一致。
- `frontend/src/components/Workbench.tsx`：为共享工作区提供同一遮罩百分比。
- `docs/系统总体架构.md`、`docs/PROMPTS.md`：同步背景选择位置、应用模式共享规则及本任务完成记录。

### 禁止修改

- 不修改设置 API、账户设置 schema、背景图片选择/存储逻辑、登录页或模式路由/业务组件。
- 不改变消息气泡、独立内容卡和小型操作控件的既有语义表面，不新增变量、依赖、抽象层或后端能力。
- 不部署、发布、上传、清理运行数据或提交 Git。

### 验收方式

- 静态核对页面级工作区壁纸只由 `.workbench-shell` 绘制；`module-center` 不再声明背景图片或遮罩；设置中心和应用的受控主要表面共用同一个 `--settings-background-surface-opacity`，AI Work 画布保持透明，常规模式与 AI Work 不再写独立固定透明度。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与 Vite 构建通过，产物写入根目录 `dist/frontend/`；对本任务文件运行 `git diff --check`。
- 记录未进行的浏览器目视验收，不以静态构建代替真实外观验证。

### 完成记录（2026-09-28）

- 应用工作区的 `.module-center` 与 AI Work 对话画布改为透明，由 `.workbench-shell` 单点绘制壁纸和遮罩；设置导航、应用导航/工具资源栏、常规模式提示表面、AI Work 输入区和中间工具栏统一读取同一表面透明度，清除 AI Work/常规内容表面原有的 34%、58%、72%、76% 固定透明度分叉。无壁纸时原有半透明侧栏 76% fallback 保持不变。
- 侧栏仍保留统一自定义色调和玻璃模糊设置；聊天消息气泡、独立内容卡和小型操作控件保留自身表面。背景位置选择文案明确说明 Minecraft 常规与 AI Work 共用 Minecraft 工作区背景，和设置中心背景独立。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查与 Vite 构建成功，产物写入根目录 `dist/frontend/`；本任务文件 `git diff --check` 通过。
- 未进行浏览器目视验收；构建与静态核对未验证实际浏览器合成效果。

## LFAA-REALTIME-SOCKET-01

### 用户目标

参考 GSM3 的 Socket.IO 实时连接，为 LFAA 当前已有的 Minecraft 任务进度、日志及节点/实例状态提供低延迟浏览器更新，并能呈现连接状态与恢复操作。

### 当前合同

- 在 LFAA Manager HTTP 服务上挂载 Socket.IO；Web、Tauri 与 Electron 共用的 Minecraft Renderer 连接同源 Socket.IO 服务。开发环境 Vite 代理 `/socket.io` 并允许 WebSocket 升级。
- Socket 握手复用现有 HttpOnly `lfaa_session` Cookie；服务端使用与 HTTP API 相同的 JWT issuer/audience、活动会话和用户身份检查。不得把会话 Token 放到 URL、`localStorage` 或普通日志中。
- Socket 的活动连接在 JWT 到期、用户登出或通过恢复密钥重置密码时断开；无效或撤销会话不能建立新连接。
- 仅接受已认证连接加入实时事件范围。Socket.IO 只推送最小范围的 Minecraft 数据变更通知，不新增绕过 REST 角色授权的命令入口；客户端收到通知后通过现有受保护 REST API 重新读取权威任务、日志和状态快照。
- 对现有 Minecraft 任务创建、领取、进度、完成、日志追加及真实节点/实例状态变化发送事件。页面初次加载、重连及现有 HTTP 轮询继续用于状态对账；AI Work SSE、Daemon HTTP 心跳/任务领取/上报及 REST 命令行为保持不变。
- Minecraft 页面显示实时连接状态；Socket.IO 自动重连，连接恢复后刷新快照，并提供手动重连入口。暂不实现交互式 PTY、SteamCMD 推送、主机资源采集、通用事件总线或多 Manager 横向扩展。
- 完成标准：匿名/无效会话的 Socket 握手被拒绝；有效现有会话可连接并仅收到真实 Minecraft 变更通知；前端在收到任务/日志/状态通知及重连后刷新 REST 快照；server 测试、前端构建和工作区构建通过，构建产物只写入根 `dist/`。记录未完成的浏览器/真实 Windows Daemon 验收。

### 允许修改

- `frontend/package.json`、`server/package.json`、`pnpm-lock.yaml`：加入匹配版本的 Socket.IO 客户端与服务端依赖。
- `frontend/vite.config.ts`、`frontend/src/realtime/`、`frontend/src/components/MinecraftWorkspace.tsx`：代理 Socket.IO，建立会话 Cookie 连接、重连与连接状态 UI，并响应 Minecraft 变更事件。
- `server/src/index.ts`、`server/src/middleware/auth.ts`、`server/src/realtime/`、`server/src/api/routes.ts`、`server/src/modules/nodes/local-daemon.ts`：装配已认证 Socket.IO 并从现有 Minecraft API/Daemon 回报路径发布变更通知。
- `server/test/`：覆盖 Socket.IO 身份验证、事件访问与实时通知。
- `docs/PROMPTS.md`、`docs/系统总体架构.md`、`docs/开发计划.md`、`README.md`：登记合同并同步实际传输、功能范围和当前验收状态。

### 禁止修改

- 不更改 HttpOnly Cookie/JWT 的签发策略、现有 REST API 权限、SQLite 数据结构、Minecraft EULA、安全沙盒或任务租约语义。
- 不把 Daemon 连接改为 WebSocket，不由 Socket.IO 接收控制端命令，不把瞬时推送当作持久任务状态或日志数据源。
- 不实现未接入的终端、资源监控、SteamCMD、远程多节点或 AI 工具能力；不改变健康/会话轮询行为及其日志观察合同。
- 不修改无关既有工作，不清理或覆盖 `data/`、`dist/` 用户数据，不部署、发布、上传或提交 Git。

### 验收方式

- 在隔离临时 `LFAA_DATA_DIR` 下运行 Socket.IO 鉴权与变更推送测试，验证缺失/无效 Cookie 被拒绝、会话失效无法新建连接、有效会话只接收已定义的 Minecraft 变更通知。
- 运行 `pnpm --filter lfaa-server run typecheck`、`pnpm --filter lfaa-frontend run build`、`pnpm test` 和 `pnpm build`；确认所有构建输出位于根 `dist/`。
- 静态核对 Vite WebSocket 代理、Cookie 认证、事件字段最小化、REST 重新读取路径与 Daemon HTTP 协议未变；浏览器与真实 Windows Daemon 验收未执行时明确记录。

### 完成记录（2026-09-28）

- 在 server HTTP 服务挂载 Socket.IO 4.8.4；Socket 握手复用 `lfaa_session` Cookie、原有 JWT issuer/audience 和活动会话校验。连接按 JWT 到期、登出或密码恢复失效时关闭。
- Minecraft 页面用 Socket.IO Client 4.8.4 订阅最小 `logs`、`tasks`、`state` 变更范围与可选实例 ID；收到事件及断线恢复后仍通过现有认证 REST API 读取快照。保留原状态与日志轮询作对账，Daemon 仍使用 HTTP。
- Vite 开发代理允许 `/socket.io` WebSocket 升级。前端显示连接/重连状态、自动重连五次，并在中断时提供手动重连。
- 新增隔离临时 `LFAA_DATA_DIR` 的 Socket.IO 集成测试：无 Cookie 与无效 Cookie 被拒绝；有效会话只收到定义的通知字段；真实管理员 REST 创建任务会发出任务变更；撤销会话后当前连接断开且不能重新连接。修正两处既有测试夹具：版本 10 测试数据库补上迁移 v12 所需的实例表；启动任务租约测试明确提供当前实现要求的沙盒能力，原有断言保留。
- 验证通过：`pnpm --filter lfaa-server run typecheck`、`pnpm --filter lfaa-frontend run build`、`pnpm test`（7 项）和 `pnpm run build`；构建产物写入根目录 `dist/`。`git diff --check` 通过。
- 当前仓库未提供 `scripts/workspace-preflight.mjs` 或 `quality:full` / release 脚本。未进行浏览器目视、桌面 WebView 或真实 Windows Daemon 网络验收；这些环境验收仍待执行。

## LFAA-UI-WORKBENCH-SNAP-02

### 用户目标

修复鼠标持续按住拖拽时，左右侧栏从吸附收起反向拉出展开发生突跳、卡顿，提升这段过渡的连贯性。

### 当前合同

- 普通左右栏拖动继续逐帧跟随最新 Pointer；吸附捕获阈值、释放迟滞、松手提交和吸附收起动画保持现状。
- 越过释放迟滞、从吸附态反向展开时，不把视觉列宽从 0 一帧跳到最小宽度；使用有时长上限的逐帧缓动，让宽度连续展开，并在缓动结束后与当前 Pointer 尺寸精确衔接。
- 用户继续移动时始终读取最新 Pointer 目标；缓动结束或再次进入吸附时停止该动画，不留下追赶帧。
- 不改 CSS 网格布局、Pane 内容、默认尺寸、吸附参数、持久化状态或底部面板阻尼。

### 允许修改

- `frontend/src/workbench/ResizableWorkbench.tsx`：仅为左右栏吸附后的反向释放加入短时、有界的宽度缓动；普通拖动仍按 Pointer 逐帧直写。
- `docs/PROMPTS.md`：登记当前任务合同和实际验证结果。

### 禁止修改

- 不改吸附捕获阈值、释放迟滞、默认宽度、普通拖动跟手规则、CSS 自定义属性、底部面板阻尼或既有吸附收起过渡。
- 不改动当前工作区中其他未提交内容，不新增依赖，不清理或覆盖 `dist/`、`data/`，不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对反向释放时宽度从 0 连续缓动，动画期间使用最新 Pointer 位置，并在达到统一释放时长后精确回到直接跟手；再次吸附或缓动结束时停止 RAF，Pointer 结束/取消后不再更新尺寸，取消时恢复起始宽度。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 与 Vite 构建结果；记录浏览器实拖是否完成及任何环境限制。

### 完成记录（2026-09-29）

- 修正吸附态反向越过释放迟滞时从 0 直接跳到最小栏宽的问题：左右栏现在按统一释放时长逐帧缓动，并在动画结束时与最新 Pointer 尺寸精确衔接；若拖回吸附区，立即取消展开缓动。普通拖动、吸附阈值、释放迟滞和收起动画不变。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查和 Vite 构建均通过，产物位于根目录 `dist/frontend/`；本任务文件 `git diff --check` 通过。
- 未进行浏览器实拖，尚未实测真实鼠标手感。

## LFAA-UI-SIDEBAR-GLASS-STABILITY-01

### 用户目标

修复应用工作区左侧菜单悬停展开预览及鼠标拉伸期间，半透明背景先透底、再恢复模糊的突变，让玻璃侧栏状态连续且操作手感稳定。

### 当前合同

- 悬停预览出现时侧栏从第一帧起保持账户外观设置的透明度与背景模糊；保留现有轻微位移动画，不对整块玻璃侧栏做透明度淡入。
- 拖动应用左侧栏时保持同一背景模糊与透明度，不在 Pointer 按下期间切换视觉效果。
- 不改外观设置值、应用侧栏内容、列宽、吸附阈值、Pointer 跟手、纵向滚动、设置中心行为或现有 reduced-motion 支持。
- 完成标准：静态核对悬停与拖拽状态不再覆盖侧栏的 opacity / backdrop-filter；构建和浏览器交互验收结果如实记录。

### 允许修改

- `frontend/src/components/module-workbench.css`：只调整应用左侧栏悬停预览的显隐过渡及拖拽期间的背景模糊规则。
- `docs/PROMPTS.md`：维护本任务索引、合同和完成记录。

### 禁止修改

- 不修改全局外观偏好、CSS 自定义属性、设置中心、工作台尺寸/吸附算法或其他应用交互。
- 不新增依赖，不改动工作区中与本任务无关的未提交内容，不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对悬停预览没有整体 opacity 淡入，左栏拖动期间不再关闭 `backdrop-filter`。
- 运行前端构建并检查产物仍写入根目录 `dist/frontend/`；记录浏览器悬停与实拖是否完成及限制。

### 完成记录（2026-09-29）

- 悬停预览去掉整块容器的透明度淡入，只保留位移显现；左栏 Pointer 拉伸时移除关闭 `backdrop-filter` 的覆盖规则，外观设置的侧栏透明度与模糊不再随交互状态切换。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查与 Vite 构建均通过，产物位于根目录 `dist/frontend/`；任务文件 `git diff --check` 通过。
- 未进行浏览器悬停和实机拖拽：当前浏览器控制连接返回 `nodeRepl.fetch request failed`，实际鼠标观感仍待验收。

## LFAA-MINECRAFT-CONTROL-CENTER-01

### 用户目标

让 Minecraft 总览成为应用内的运行管理中心，清楚呈现真实节点、实例和任务状态；点击监控卡片可进入对应页面，并在 Minecraft 菜单中补齐控制节点入口与菜单分类。

### 当前合同

- 总览提供真实数据卡片与简明运行状态区；节点、实例、任务和版本卡片都能用鼠标及键盘进入对应的 Minecraft 管理页面。
- Minecraft 二级菜单按“监控”“管理”“环境”三个可访问的分类标签组织；总览/控制节点属于监控，实例/任务属于管理，Java 环境属于环境，选中实例时仍显示其实例子菜单。
- 控制节点页面读取现有受保护 `/minecraft/nodes` 接口，显示心跳上报的在线状态、平台、Daemon 版本、能力、Java 运行环境和最近心跳；不把只读监控伪装成远程接入、删除或命令控制功能。
- 总览状态响应现有经会话认证的 Minecraft Socket.IO 变更推送，并保留每 8 秒 REST 快照对账。无真实值时显示未读取/空状态，不用演示值填充。
- 将 AppContainer 文件、网络、进程边界说明放入控制节点页面；总览只保留是否存在可开服节点及可操作的诊断入口。
- 当前 Daemon 尚未采集 CPU、内存、磁盘或网络吞吐指标，本任务不增加或伪造这些资源指标；它们需由后续 Daemon 监控 Owner 提供真实数据后再接入。
- 完成后更新 Minecraft 菜单和页面范围文档，运行仓库要求的前端构建与适用检查，并注明未做的浏览器/目标主机验收。

### 允许修改

- `frontend/src/components/ApplicationWorkspace.tsx`、`frontend/src/components/module-workbench.css`：增加 Minecraft 菜单分类标签和控制节点入口。
- `frontend/src/components/MinecraftWorkspace.tsx`、`frontend/src/components/MinecraftWorkspace.css`：重组 Minecraft 总览卡片和运行区，增加真实控制节点只读页面及空/异常状态。
- `docs/PROMPTS.md`、`docs/开发计划.md`、`docs/系统总体架构.md`：登记任务并同步菜单、监控范围与验收状态。

### 禁止修改

- 不改变 Manager/Daemon Owner、节点身份认证、SQLite schema、Daemon 心跳、Socket.IO 事件、Minecraft 任务和 AppContainer fail-closed 语义。
- 不增加远程节点配对、注册、删除、任意主机命令或主机资源采集；不显示未测量的 CPU/内存/磁盘数据。
- 不运行真实 Minecraft 下载、实例创建或开服任务，不读写或清理 `data/`，不部署、发布、上传或提交 Git。
- 不覆盖当前工作区既有的未提交更改；不把本任务扩展到 SteamCMD、AI Work 执行工具或全局应用中心重构。

### 验收方式

- 静态核对所有菜单标签与路由匹配，卡片跳转目标正确；控制节点状态字段与现有 `/minecraft/nodes` 类型一致，缺少 AppContainer Host 时明确显示不可开服原因。
- 运行 `pnpm --filter lfaa-frontend run build` 并核对构建产物仅写入根 `dist/frontend/`；按仓库当前实际存在的脚本执行适用检查，准确记录缺失或未运行的 Gate。
- 如可访问当前已登录浏览器，检查菜单分类、窄列布局、卡片焦点和跳转；不以构建替代真实 Windows Minecraft 开服验收。

### 实现记录（2026-09-29）

- Minecraft 侧栏加入“监控 / 管理 / 环境”分类和“控制节点”路由。总览改为可点击的节点、实例、任务、正式版卡片，并列出真实节点状态和最近任务；节点页读取现有 `/minecraft/nodes` 快照，展示真实心跳、平台、版本、能力和 Java 环境。详细 AppContainer 边界说明从总览移到节点页。
- 状态仍通过既有认证 Socket.IO 变更通知刷新，并保留每 8 秒 REST 对账；主机 CPU、内存、磁盘数据尚无 Daemon 采集来源，未添加模拟指标。
- 已定位截图中不可开服原因：运行中的 Daemon 于 2026-09-28 21:55 启动，Sandbox Host 文件于 22:05 生成；Daemon 只在启动时探测一次，因此该旧进程持续未上报 AppContainer 能力。当前构建的 Sandbox Host `--probe` 返回正确后端与网络能力。重启后的 Daemon 未输出 Host 不可用警告。首次重启时 Manager 尚未监听；随后启动 `pnpm dev:server`，`/api/health` 返回 ready，Daemon 心跳和任务领取接口均返回 HTTP 200，证明节点已重新接入。没有创建或启动 Minecraft 实例。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 与 Vite 构建产物写入根目录 `dist/frontend/`；`git diff --check` 通过。当前仓库没有 `scripts/workspace-preflight.mjs`，根 `package.json` 也没有 `quality:full` 脚本。
- 浏览器清单读取失败，未进行登录后目视/点击验收；未运行 Minecraft 下载、实例创建或真实开服任务。截图当前实例数为 0，开服前仍需在页面创建实例并由用户明确同意 EULA；Windows Host ACL、网络及实际 Minecraft 启动仍需目标环境验收。

## LFAA-UI-WORKBENCH-SNAP-03

### 用户目标

让设置中心左侧分类栏、应用工作区左右侧栏和底部终端的拖拽拉伸、吸附收起及按住鼠标反向拉出，统一采用已验证有效的侧栏动效。

本合同扩展 `LFAA-UI-WORKBENCH-SNAP-02` 的范围；仅针对本次面板统一，替代其“底部面板阻尼不变”的限制。

### 当前合同

- 设置中心与应用工作区继续共用 `ResizableWorkbench`；左右栏和底部终端由同一套帧处理及动效参数管理，不复制独立动画路径。
- 所有方向的普通拖动按浏览器帧合并后直接跟随 Pointer，不使用连续阻尼追赶；吸附捕获时使用相同固定目标收起过渡，并立即隐藏被收起区域内容。
- 越过释放迟滞反向拉出时，所有方向使用相同的有界缓动曲线与释放时长，从吸附尺寸连续展开，并在结束时精确衔接最新 Pointer 尺寸；再次吸附、释放 Pointer 或取消拖动时停止 RAF 并清理状态。遵循系统减少动态效果偏好，开启时跳过代码驱动的释放缓动。
- 移除底部终端现有的指数阻尼和与逐帧宽高更新冲突的 CSS 行过渡，避免同一列/行被两套动画同时驱动。
- 显式收起/展开入口、布局持久化和面板职责不变；左右栏和底部终端的开合显隐时序统一。保持现有吸附阈值、释放迟滞、默认尺寸与键盘调整；不改变不具备拖拽吸附能力的独立 UI。

### 右侧菜单栏专项复查补充（2026-09-29）

- 桌面右栏的列宽由工作台 Grid 负责；普通拖拽和吸附后的反向释放期间关闭 Pane 自身过渡，吸附捕获只保留一次 Grid 收拢过渡。紧凑/移动布局下右栏是独立 Overlay，由位移过渡负责显隐。
- 当前 DOM 使用 `.lfaa-workbench`，旧 `.module-workspace` 选择器不参与这段交互。右侧工具内容 `.module-context` 在半透明侧栏开启时带有实时 `backdrop-filter`；宽度逐帧变化会持续重采样背景，增加绘制负担。
- 水平拉伸期间暂时关闭应用左导航 `.module-sidebar` 与右侧工具栏 `.module-context` 的背景模糊，结束后恢复用户偏好；不改 Pane 的吸附阈值、宽度计算或既有过渡。

### 允许修改

- `frontend/src/workbench/ResizableWorkbench.tsx`：合并左右栏与底部面板的 Pointer 帧处理及捕获/释放动效；普通拖动直写，吸附反向展开使用同一有限时缓动。
- `frontend/src/workbench/workbench.css`：令底部终端吸附时的内容显隐与左右侧栏一致，移除重复驱动行尺寸的反向 CSS 过渡；保留现有用户未提交样式变更。
- `frontend/src/styles/workbench.css`：水平拖拽时暂停左右应用侧栏的背景模糊采样，空闲时恢复用户设置。
- `docs/PROMPTS.md`：登记本次范围扩展合同和验证结果。

### 禁止修改

- 不调整吸附捕获阈值、释放迟滞、默认面板尺寸、布局模式、持久化数据、业务面板内容或显式开合控制。
- 不新增 CSS 自定义属性、依赖或第二套拖拽状态；不修改设置页或应用页对共享 `ResizableWorkbench` 的业务接线。
- 不覆盖工作区已有未提交内容，不清理或覆盖 `dist/`、`data/`，不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对设置与应用工作区复用同一 Owner，左右与底部拖动共用帧调度和缓动，捕获/释放不会同时触发 JS 与 CSS 尺寸动画；中断、结束和再次吸附不会遗留 RAF。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查、Vite 构建及根目录 `dist/frontend/` 输出；运行本任务相关 `git diff --check`。记录浏览器实拖验收情况。

### 完成记录（2026-09-29）

- `SettingsPage` 与 `ApplicationWorkspace` 已确认共用 `ResizableWorkbench`。左右栏和底部终端现在共用 Pointer 帧合并、吸附阈值解析及相同的有限时反向释放缓动；普通拖动直接跟手。移除了底部终端原有指数阻尼和重复 CSS 行尺寸过渡，并让吸附时的终端内容立即隐藏。显式开合保留原状态入口，显隐节奏与侧栏一致；减少动态效果偏好下跳过 JS 缓动。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查和 Vite 构建通过，产物写入根目录 `dist/frontend/`；相关文件 `git diff --check` 通过。
- 未进行浏览器实拖，真实鼠标手感待实机确认。

### 右侧菜单栏专项复查完成记录（2026-09-29）

- 静态核对确认桌面右栏的宽度只由 Grid 轨道控制：普通拖拽与反向释放期间禁用 Pane CSS 过渡，吸附捕获只启用一次 Grid 收拢；紧凑/移动布局的右栏 Overlay 只使用位移显隐。旧 `.module-workspace` 规则不匹配当前 `.lfaa-workbench` DOM，不会叠加驱动。
- 修复右侧 `.module-context` 在水平拉伸时仍实时采样背景模糊的问题；拉伸期间同时暂停左右应用侧栏的 `backdrop-filter`，结束或取消后恢复用户偏好。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查和 Vite 构建通过，产物写入根目录 `dist/frontend/`；本次相关文件 `git diff --check` 通过。未进行浏览器实拖，真实鼠标手感待实机确认。

## LFAA-UI-SETUP-REMINDER-PERFORMANCE-01

### 用户目标

修复截图中的“完成首次配置”弹窗出现时严重卡顿的问题，让弹窗打开过程流畅，同时保持提醒判断、按钮语义和主题外观。

### 当前合同

- 首次配置提醒沿用现有账户设置总开关、当天暂停记录、缺失配置检查和按钮行为，不改变服务端数据或通知业务语义。
- 提醒显示状态由独立组件持有，避免仅为打开弹窗而重新渲染整个 `Workbench` 子树。
- 移除提醒遮罩上的全屏实时背景模糊；保留 Ant Design 的主题遮罩和现有弹窗淡入效果。弹窗仍挂载在 `.workbench-shell` 内，以继承主题与减少动态效果设置。
- 不新增设置控件、CSS 自定义属性、依赖、接口或存储字段。现有玻璃模糊设置只控制顶栏与半透明侧栏，不用于弹窗遮罩。
- 完成标准：构建通过、代码差异检查通过；记录是否进行浏览器实测。

### 允许修改

- `frontend/src/components/Workbench.tsx`：移除提醒弹窗的本地状态和重复渲染触发点，挂载独立提醒组件。
- `frontend/src/components/SetupReminder.tsx`：承载提醒检查、弹窗状态和既有按钮行为。
- `frontend/src/styles/workbench.css`：删除提醒遮罩的全屏背景模糊规则，并更新样式文件职责说明。
- `docs/PROMPTS.md`：登记本合同与完成记录。

### 禁止修改

- 不改变首次配置提醒的开关、暂缓规则、检查条件、设置中心配置结构或后端持久化。
- 不更改其他通知、全局动效、应用页面、工作台布局、依赖或构建配置；不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对提醒状态由独立组件持有、弹窗保留工作台主题容器且遮罩不再执行全屏 `backdrop-filter`。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与 Vite 构建，产物位于根目录 `dist/frontend/`；运行 `git diff --check`。
- 如未进行浏览器实测，明确记录实际限制，不以构建结果代替卡顿体验验收。

### 完成记录（2026-09-29）

- 将首次配置检查和弹窗状态移入 `SetupReminder`，不再因弹窗开关重新渲染整个工作台；检查只在账户、日期、提醒开关或是否位于设置页变化时触发。
- 删除提醒遮罩的全屏实时模糊；继续使用 Ant Design 主题遮罩，并保留工作台已有的减少动态效果规则。首次配置总开关与今日暂停行为未变。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查和 Vite 构建成功，产物写入 `dist/frontend/`；`git diff --check` 通过。
- 仓库没有 `scripts/workspace-preflight.mjs`，根 `package.json` 也没有独立 quality/release Gate；未运行测试或浏览器体验测量，因此实际弹窗帧率仍待浏览器实测。

### 复查记录（2026-09-29）

- 用户反馈改动后弹窗仍卡，当前不将问题标记为已修复。
- 用户允许重启本地服务后，检查到前端 `127.0.0.1:5173` 和服务端 `127.0.0.1:3000` 正在监听；`/api/health` 返回 HTTP 200。独立浏览器能加载当前工作台入口，但处于未登录状态，只显示登录页。
- 独立浏览器控制台未见错误；观察到的 `/api/health` 轮询间隔约 15 秒、单次约 3–6 ms。这些证据不足以解释弹窗明显卡顿，也没有采集到弹窗开合的主线程或帧时数据。
- Codex 无法读取用户原有的 Edge 标签页（`nodeRepl.fetch request failed`），所以尚不能核实已登录页面实际加载版本或复现提醒弹窗。待用户刷新原 Edge 页面并触发提醒后，继续对弹窗开合录制性能数据，再依据数据定位和修改根因。

## LFAA-FILE-MANAGER-RECOVERY-01

### 用户目标

修正截图中的文件管理体验：节点离线时页面看起来像空目录，用户看不到有效恢复入口；让节点状态、可执行操作和恢复方式清楚且可控。

### 当前合同

- 文件任务仍只能由报告 `node-filesystem-v1` 且当前在线的 Daemon 执行；离线时禁止读取、写入和其他文件操作，不增加控制端本地文件回退。
- 保留当前选中节点以供排查；如果节点离线，或正在切换节点，不得把未读取状态/其他节点的缓存列表显示为当前目录。内容区应明确显示节点离线、最近心跳（如有）和恢复步骤，并提供不依赖所选节点在线状态的“刷新节点状态”操作。
- 节点列表刷新中应有可见的忙碌状态，失败时显示实际错误。仍可在下拉框中显式切换到其他在线节点；不因定时刷新静默切换文件系统。
- 真正连接并读取目录后，空目录才显示“此目录为空”；无可选节点与离线节点分别呈现。
- 页面沿用工作台主题、强调色、壁纸遮罩透明度和字体设置映射；不新增设置字段、CSS 自定义属性、API 或持久化状态。

### 允许修改

- `frontend/src/components/FileManagerPage.tsx`：区分节点离线与空目录，提供可手动触发的节点状态刷新及最近心跳/恢复说明。
- `frontend/src/components/FileManagerPage.css`：为节点离线状态提供清晰、响应式且沿用工作台主题令牌的布局样式。
- `docs/PROMPTS.md`：登记本合同与完成记录。

### 禁止修改

- 不改文件任务 API、权限、Daemon 能力、节点连接机制或文件路径安全边界。
- 不允许离线节点执行任务，不增加本地磁盘直连、模拟文件列表、自动切换到另一节点或未请求的新设置。
- 不修改其他应用页面、全局主题/壁纸设置、依赖、构建配置或运行数据；不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对：离线节点时文件列表不再显示“此目录为空”；手动刷新节点列表可用并反馈加载/错误；离线文件任务仍被前端禁用且服务端继续执行在线能力校验；在线空目录仍显示原空状态。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与 Vite 构建通过，产物仅写入根目录 `dist/frontend/`；核对本次已跟踪改动的 `git diff --check`。
- 记录是否完成浏览器目视和节点上线恢复交互验收；构建结果不代替真实 Daemon 文件操作验收。

### 完成记录（2026-09-29）

- 离线节点和无可管理节点显示独立状态；离线状态展示节点名与最近心跳，并说明启动目标主机 Daemon、刷新状态或切换在线节点的恢复方式。顶部“刷新节点状态”始终可用，手动刷新显示忙碌状态和请求错误，原有 10 秒在线轮询保留。
- 离线、切换节点或切换文件路径时清除当前列表，避免把缓存或其他节点文件误当作当前目录；真正在线读取后才显示“此目录为空”。打开新建、重命名或编辑窗口期间锁定节点选择；客户端同时检查在线状态，目录导航、搜索、编辑和文件操作控件按节点状态启用。
- 未新增设置字段；页面沿用共享主题/强调色、所选工作区背景与 `appearance.overlay` 透明度、界面字体和字号。文本编辑器继续读取已注入的代码字体与字号映射。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查与 Vite 构建成功，产物位于根目录 `dist/frontend/`。`git diff --check -- docs/PROMPTS.md` 和两个文件管理源文件的行尾空白检查通过。
- 仓库没有 `scripts/workspace-preflight.mjs`，根 `package.json` 没有 `quality:full` 脚本；未运行自动化测试。未进行浏览器目视、节点上线恢复交互或真实 Daemon 文件操作验收。

## LFAA-FILE-MANAGER-HOME-01

### 用户目标

修正从文件管理点击左侧全局导航房子时误回到进入前页面（例如设置页），让房子始终回到来源 App 和工作模式的首页。

### 当前合同

- 目标运行入口为 `apps/web` 的 `/files` 页面；导航状态由 `packages/client/ui-layout/src/Workbench.tsx` 持有，文件页通过共享 `GlobalNavigationRail` 发出导航动作。
- 文件页左侧轨道的房子从来源路由提取 App 与模式，并清除子页面路径。来源是 `/tasks` 时归一到 `workspace/ai-work` 首页；来源是设置页时，先使用设置中心保存的进入来源路由提取 App 与模式；来源是应用中心、直接打开文件页或其他非 App 路由时，使用当前 `UserPreferences` 中的选中 App 与模式作为回退目标。
- 应用中心仍通过导航轨“更多入口 > 应用中心”进入 `/`。文件列表工具栏中的目录小房子仍只回到 `LFAA 数据`目录根；两种房子行为不得混淆。
- 设置中心房子、应用工作区房子、文件操作、路由权限和持久化合同均保持不变；不增加订阅、请求、设置项、API 或存储。

### 设置中心配置盘点

- 本次无新的或直接相关的设置中心配置。仅在来源路由不是 App 页面时读取现有 `UserPreferences.selectedApp` 与 `selectedMode` 作为确定性回退；不改变其默认值、持久化或映射。

### 允许修改

- `packages/client/ui-layout/src/Workbench.tsx`：根据文件页来源路由解析 App/模式首页，并提供明确的偏好回退目标。
- `packages/client/ui-sidebar-files/src/FileManagerPage.tsx`：将全局导航房子的传入目标标注为首页路由；保留目录工具栏房子的现有语义。
- `docs/系统总体架构.md`：记录文件页房子、设置中心房子和应用中心入口各自的路由语义。
- `docs/PROMPTS.md`：维护当前合同、任务索引和完成记录。

### 禁止修改

- 不改变文件列表工具栏的目录导航、文件/节点 API、安全边界、设置中心返回路由、工作区首页行为或应用中心 `/` 入口。
- 不新增设置、CSS 变量、API、持久化状态、测试路由、依赖或临时脚本；不改其他未提交功能，不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对：App 子路由回到同一 App/模式根；`/tasks` 回到 workspace AI Work 根；从设置页进入文件管理时回到设置来源 App/模式根；来源不是 App 时回退当前选中 App/模式；应用中心仍独立指向 `/`；目录小房子仍只重置目录路径。
- 运行 `pnpm --filter lfaa-web run build` 并对本合同涉及差异运行 `git diff --check`；产物只写入仓库根目录 `dist/`。
- 未执行的浏览器交互、帧时间和实时服务验收须明确标记，不以静态核对或构建替代。

### 实施记录（2026-10-01）

- `packages/client/ui-layout/src/Workbench.tsx` 将 `/apps/{app}/{mode}/...` 归一到对应模式根，将 `/tasks` 归一到 `/apps/workspace/ai-work`；从设置进入文件管理时解析设置页保存的来源路由。来源没有 App/模式路由或直接打开 `/files` 时，回退到当前偏好中的 `selectedApp` 与 `selectedMode`。
- `packages/client/ui-sidebar-files/src/FileManagerPage.tsx` 将全局轨道房子接到明确的 `homeRoute`，提示为“返回来源应用/模式首页”。应用中心的 `/` 入口和文件目录工具栏房子未改。
- 设置中心配置盘点：没有改动设置项；仅使用现有 `UserPreferences.selectedApp`、`selectedMode` 作为非 App 来源的回退。
- `pnpm --filter lfaa-web run build` 通过，包含 `tsc --noEmit` 和 Vite production build；产物位于根目录 `dist/apps/web/`。本合同相关文件 `git diff --check` 通过。未添加或运行自动化测试。
- 尝试获取浏览器状态时，Edge 返回 `nodeRepl.fetch request failed`，Codex 内置浏览器没有打开的页面，因此未完成登录态点击验收；没有帧时间测量或实时服务验收。

## LFAA-UI-LEFT-PREVIEW-HOVER-STABILITY-01

### 用户目标

修复应用工作区左侧导航收起后，整块 hover 预览在鼠标移出时前段缓慢淡出、尾部突然消失的问题，同时保留用户认可的顺滑入场、固定位置和现有 hover 触发行为。

### 当前合同

- 桌面端收起预览由 `packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 的 `closeLeftPreview` 控制关闭等待（现有 160ms）；预览 DOM 使用 `.module-left-preview` 和 `.is-visible` 状态。除非有独立合同，本任务不改 React hover 事件、等待时间和预览挂载条件。
- CSS Owner 为 `packages/client/ui-workspace/src/module-workbench.css`：`.module-left-preview` 隐藏目标态使用 `opacity 260ms ease-in-out`，并把 `visibility` 隐藏延迟设为 260ms；`.module-left-preview.is-visible` 显示目标态继续使用 `opacity 160ms ease-out`，从而让入场和退场分别使用各自的过渡曲线。
- 不给 `.module-sidebar` 子项增加重复 opacity 过渡，避免内容先淡完而预览外壳继续停留后突然隐藏。预览位置、尺寸和布局保持不变。
- 沿用外观设置的“减少动态效果”配置；不新增设置项、CSS 自定义属性或依赖。
- 侧栏背景色、遮罩透明度和模糊仍由既有设置映射控制；不改变预览触发按钮、尺寸、拖拽/吸附、侧栏内容及列表项 hover 样式。

### 设置中心配置盘点

- `appearance.overlay` 控制壁纸下侧栏底色透明度；`appearance.sidebarColor` 控制自定义侧栏色调；`appearance.blur` 控制玻璃模糊强度，均经现有工作台变量映射应用到预览。
- `appearance.advanced.reducedMotion` 控制减少动态效果，并由工作台 `data-reduced-motion` 与共享 CSS 规则处理。
- 本任务不改变以上配置、默认值、持久化或前端映射；淡入淡出继续遵循现有 reduced-motion 规则。

### 允许修改

- `packages/client/ui-workspace/src/module-workbench.css`：仅调整 `.module-left-preview` 显示/隐藏过渡及相应中文注释。
- `docs/PROMPTS.md`：维护本任务当前合同、根因、实现指针和验证记录。

### 禁止修改

- 不修改设置中心控件、类型、默认值、服务端校验、持久化或工作台设置映射。
- 不改变 React hover 事件/160ms 关闭等待、预览尺寸与位置、工作台布局、拖拽/吸附逻辑、列表项反馈或其他未提交改动；不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对显示为 160ms `ease-out`、移出为 260ms `ease-in-out`，移出 `visibility` 延迟与 opacity 时长对齐，且无子项重复 opacity 过渡；预览无位置变化，减少动态效果规则仍生效。
- 运行 `pnpm --filter lfaa-web run build`，确认 TypeScript 与 Vite 构建产物写入根目录 `dist/apps/web/`；运行目标文件 `git diff --check`。
- 浏览器中验证移入顺滑、移出均匀淡出且末尾不突隐；不能访问浏览器时，明确记录未完成的交互和帧时间实测。

### 完成记录（2026-09-29）

- 移除左侧收起预览的 `translateY(-14px)` 与 transform 过渡；预览固定在标题栏下方，通过现有 `visibility` 状态显隐，鼠标命中区域不再随上下移动。
- 按用户补充为预览内直接内容项增加短暂 opacity 过渡；承载玻璃背景的外层与侧栏本身不参与透明度动画，减少动态效果偏好继续统一控制过渡时长。
- 保留外观设置的侧栏颜色、背景遮罩透明度、玻璃模糊与减少动态效果映射；未新增配置项或 CSS 自定义属性。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查和 Vite 构建通过，产物写入 `dist/frontend/`；本任务涉及文件 `git diff --check` 通过。
- 未完成浏览器悬停验收：CUA 浏览器清单连续返回 `nodeRepl.fetch request failed`。当前仓库也没有 `scripts/workspace-preflight.mjs`，根 `package.json` 没有额外 quality/release Gate。

### 用户澄清与续修合同（2026-10-01）

- 用户指出问题对象是收起状态下 hover 打开的整块 `.module-left-preview`，不是侧栏内的菜单项。鼠标移出后，React 仍按现有 160ms 延迟关闭；栏内直接子项再以 160ms 淡出，外层 `visibility` 却延迟 220ms，留下约 60ms 的空壳，之后突然隐藏。
- 本轮将整块预览的 `opacity` 淡出与 `visibility` 隐藏延迟对齐，移除直接子项的重复 opacity 过渡；保留固定位置、尺寸、触发/关闭计时、命中区域和拖拽行为。此续修明确取代旧合同中“不对整块预览做透明度淡入”的限制，因为该限制造成当前尾部突隐。
- 外观仍由 `appearance.overlay`、`appearance.sidebarColor`、`appearance.blur` 既有映射控制；`appearance.advanced.reducedMotion` 继续控制动效。不新增配置、变量、依赖或 React 状态。
- 允许修改 `packages/client/ui-workspace/src/module-workbench.css` 与本任务合同记录；不改 `ApplicationWorkspace.tsx` 的 160ms 关闭计时。
- 验收：整块预览淡出时不出现空壳后突隐；入场保持平滑；显隐不位移且尺寸/命中区域不变；运行 Web 构建和目标 `git diff --check`。浏览器不可用时记录实际 hover 未验。

### 续修实施记录（2026-10-01）

- `.module-left-preview` 整体使用 `opacity 160ms ease-out`，`visibility` 延迟同步为 160ms；移除了栏内子项独立淡出，避免内容先消失、外壳再延迟突隐。固定位置、尺寸和 hover 触发/关闭计时不变。
- 撤回错误作用于 `.module-sidebar__menu-tabs button` 与 `.module-sidebar__menu-item` 的过渡声明；保留工作区里原有的菜单焦点与选中样式改动。
- 沿用 `appearance.overlay`、`appearance.sidebarColor`、`appearance.blur` 和 `appearance.advanced.reducedMotion`，未改设置持久化或映射。
- `pnpm --filter lfaa-web run build` 通过，TypeScript 与 Vite 完成，产物写入 `dist/apps/web/`。生成 CSS 已核实为 `opacity .16s ease-out` 与 `visibility 0s linear .16s`，没有子项重复淡出；目标 `git diff --check` 通过。

### 二次调优实施记录（2026-10-01）

- **根因：** 首次复现的尾端突隐来自两组时间未对齐：栏内子项 opacity 在 160ms 淡完，外层 `visibility` 延后 220ms 才隐藏，产生约 60ms 空壳后再突然消失。第一次把整块预览也设为 160ms 淡出后，用户反馈整体退场仍显生硬。
- **代码路径：** React 关闭等待和预览状态分别位于 `packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 的 `closeLeftPreview` 与 `.module-left-preview` 渲染处；本轮没有改这段逻辑。动画 Owner 位于 `packages/client/ui-workspace/src/module-workbench.css` 的 `.module-left-preview` / `.module-left-preview.is-visible` 规则。
- **修复机制：** CSS 按目标状态分别设置 transition：进入 `.is-visible` 使用 `opacity 160ms ease-out`；离开 `.is-visible` 回到基础态时使用整块预览 `opacity 260ms ease-in-out`。隐藏态 `visibility` 延迟同步为 260ms，淡出结束时才隐藏；删除子项重复 opacity 过渡。由此保留顺滑入场，并避免移出尾部空壳突隐。
- React 原有 160ms hover 关闭等待、预览尺寸/位置/命中行为、拖拽逻辑及 `appearance.overlay`、`appearance.sidebarColor`、`appearance.blur`、`appearance.advanced.reducedMotion` 映射均保持不变。
- `pnpm --filter lfaa-web run build` 通过；已检查 `dist/apps/web/` 中生成 CSS 确认入场 `.16s ease-out`、移出 `.26s ease-in-out`、visibility 延迟 `.26s` 且无子项重复淡出；目标 `git diff --check` 通过。未运行自动化测试。Edge 返回 `nodeRepl.fetch request failed`，因此浏览器 hover 手感及帧时间尚未实测。

### 用户反馈与再次调优合同（2026-10-01）

- 用户反馈整体侧栏 160ms 淡出仍显生硬。保留 160ms `ease-out` 入场；仅将移出改为 260ms `ease-in-out`，并将隐藏态 `visibility` 延迟设为相同的 260ms，确保尾帧透明度归零后再隐藏。
- 继续移除栏内子项的独立 opacity 过渡，避免整体与内容双重淡化；不改变关闭等待、尺寸、位置、事件和设置映射。

## LFAA-MINECRAFT-APPCONTAINER-ENV-01

### 用户目标

修复 Minecraft 实例启动时 Windows AppContainer Sandbox Host 无法创建 Java 子进程的问题。截图对应的失败任务日志显示 `CreateProcessW` 返回 Win32 203。

### 当前合同

- 只修复 Rust Sandbox Host 为 Java 子进程构造 Windows Unicode 环境块的行为；筛出 Daemon 原环境中的 `=X:` 驱动器目录项，并以实例目录覆盖实例所在盘符，随后按 Windows 要求排序和终止环境块。
- 保留现有最小环境变量白名单及 Java/System32 PATH；不得继承 Daemon 的任意进程环境、Daemon Token、模型密钥或其他秘密。
- 保持每实例 AppContainer SID、显式网络能力、实例/Java ACL、低完整性标签、受限句柄、Job Object、启动令牌及 fail-closed 行为不变。任何沙盒启动失败仍须拒绝实例启动，不得回退为普通 Java 进程。
- 诊断证据只读来自截图所示最新 Minecraft 启动任务及其日志；不修改、清理或迁移运行数据。
- 不进行真实 Minecraft 启动或下载；构建产物只能写入根目录 `dist/daemon/`。

### 允许修改

- `daemon/sandbox-host/src/main.rs`、`daemon/sandbox-host/Cargo.toml`：仅筛出系统 `=X:` 当前目录项，覆盖实例所在驱动器，并启用 Windows 环境块读取 API；修正 Unicode 环境块排序和终止处理。
- `docs/PROMPTS.md`：登记本合同和实际验证记录。

### 禁止修改

- 不放宽环境变量、可执行文件、命令参数、路径、AppContainer 能力、ACL 或句柄范围；不继承完整 Daemon 环境。
- 不修改前端、server API、SQLite schema、EULA、任务语义、Java 安装文件或实例数据；不运行真实 Minecraft 下载/创建/启动任务。
- 不部署、发布、上传、提交 Git、改版本号或更新日志。

### 验收方式

- 静态核对 Unicode 环境块包含实例工作目录所在驱动器的当前目录项，变量名按 Windows 大小写不敏感排序，并以双 NUL 正确结束；现有白名单没有扩为任意环境继承。
- 运行 `cargo fmt --manifest-path daemon/sandbox-host/Cargo.toml -- --check` 与 `pnpm --filter lfaa-daemon run build:sandbox`；确认 Cargo 产物位于根目录 `dist/daemon/target/`，不在包目录生成构建目录。
- 运行涉及文件的 `git diff --check`。记录未执行的 Minecraft 实例实机启动验收；编译成功不视为 Windows AppContainer 运行成功。

### 故障证据

- 2026-09-29 最新启动任务失败记录为 `Minecraft AppContainer 在启动确认前退出（退出码 1）`；只读任务日志进一步显示 `CreateProcessW` 错误码 203，消息为系统找不到所输入的环境选项。
- [Microsoft `CreateProcessW` 文档](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw)说明：传入自定义环境块时，系统驱动器当前目录不会自动传递；需要显式提供相应 `=C:` 形式的目录项，并按大小写不敏感 Unicode 顺序排序。[环境变量文档](https://learn.microsoft.com/en-us/windows/win32/procthread/changing-environment-variables)规定环境项排序和双 NUL 终止；[系统错误码文档](https://learn.microsoft.com/en-us/windows/win32/debug/system-error-codes--0-499-)将 203 定义为 `ERROR_ENVVAR_NOT_FOUND`。
- 当前实现传入最小环境块，但没有任何驱动器当前目录项；代码修复仍须维持清洁环境和现有 AppContainer 安全边界。

### 实现记录（2026-09-29）

- Sandbox Host 只从 Daemon 原环境中保留 `=X:` 驱动器当前目录项，并以实例工作目录覆盖相同盘符；继续只传 `PATH`、`SystemRoot`、`TEMP`、`TMP`、`WINDIR` 和这些驱动器目录项，未继承其他 Daemon 环境。所有项按 Windows 大小写不敏感顺序排序，Unicode 环境块以双 NUL 终止。
- `cargo fmt --manifest-path daemon/sandbox-host/Cargo.toml -- --check` 通过；`pnpm --filter lfaa-daemon run build:sandbox` 通过，Windows x64 release 产物位于 `dist/daemon/target/x86_64-pc-windows-msvc/release/lfaa-sandbox-host.exe`；相关文件 `git diff --check` 通过。
- 未运行 Minecraft/Java 实例启动，故 Win32 203 的真实 AppContainer 恢复效果仍待用户 Windows 实例启动验收。环境块遗漏驱动器当前目录项与 203 同属启动环境问题，属于基于官方 API 说明和实际日志的根因判断，尚无真实启动结果确认。
- `Failed to fetch` 为截图时的控制端连接故障；本轮复查时 `/api/health` 直连及经 Vite 代理均返回 HTTP 200，未在当前服务状态复现，因此没有改动 API 或前端连接代码。

## LFAA-AUTH-PASSKEY-01

### 用户目标

为 LFAA 增加截图所示的可选通行密钥登录引导，让用户可以用 Windows Hello、设备 PIN/生物识别或其他兼容验证器更快登录，同时保留当前密码与恢复密钥登录。

### 当前合同

- 通行密钥使用 W3C WebAuthn 公钥凭据。PIN、生物识别和私钥只由浏览器/验证器处理；LFAA 仅接收验证响应并保存公钥凭据数据，不接收或保存设备 PIN、生物特征或私钥。
- 登录支持 discoverable credential，不要求先输入用户名；成功验证后复用现有服务端会话和 HttpOnly Cookie。密码、恢复密钥、会话期限、角色与权限语义保持现状。
- 设置通行密钥与撤销通行密钥均要求当前密码重新验证。每个账户可有多个凭据；凭据按账户隔离，并记录服务端验证所需的凭据 ID、公钥、签名计数器、传输方式及注册/最近使用时间。
- 注册与登录挑战必须随机、短时有效、一次使用、服务端关联用途和账户；验证必须限制到明确配置的 RP ID 与完整 Origin，并要求用户验证。注册只接受当前登录账户；登录以服务端凭据记录确定账户，不信任客户端提供的账户身份。
- 登录界面只在浏览器支持通行密钥且服务端已有凭据时提供入口；验证失败统一返回认证失败，不泄露用户名、凭据或内部验证细节。加入登录速率限制和通用错误处理。
- 首次登录后可显示可跳过的设置引导；“暂时跳过”仅在当前浏览器会话内记忆。账户安全设置提供凭据列表、添加和撤销。引导、登录和设置界面沿用现有工作台主题及适用外观设置，不新增可绕过安全边界的偏好开关。
- `WEBAUTHN_RP_ID` 与 `WEBAUTHN_ORIGIN` 作为部署配置使用：仅开发模式允许明确的 `localhost` 默认值；生产环境未配置或配置不匹配时，通行密钥功能保持不可用，密码登录继续工作。不得从任意 Host/Origin 请求头动态信任 RP 配置。
- 项目外资料核查范围限于 W3C WebAuthn、Microsoft Windows Hello/HTTPS 官方资料及 SimpleWebAuthn 维护者文档/许可证；不引用第三方教程作为实现依据。已核查的来源：
  - W3C Web Authentication Level 3：<https://www.w3.org/TR/webauthn-3/>
  - Microsoft Windows passkeys：<https://learn.microsoft.com/en-us/windows/security/identity-protection/passkeys/>
  - Microsoft ASP.NET passkeys 与 HTTPS / recovery 指引：<https://learn.microsoft.com/en-us/aspnet/core/security/authentication/passkeys/?view=aspnetcore-10.0>
  - SimpleWebAuthn 服务端及浏览器文档：<https://simplewebauthn.dev/docs/packages/server>、<https://simplewebauthn.dev/docs/packages/browser>
  - SimpleWebAuthn 维护仓库许可证与更新记录：<https://github.com/MasterKale/SimpleWebAuthn/blob/master/LICENSE.md>、<https://github.com/MasterKale/SimpleWebAuthn/blob/master/CHANGELOG.md>
  - 已通过 npm 官方元数据核对：`@simplewebauthn/server@14.0.3`、`@simplewebauthn/browser@14.0.0` 均为 MIT；server 14.0.3 延续 14.0.2 的近期认证安全修复，项目 Node 24 满足维护者公布的 Node LTS 22+ 支持线。

### 设置中心配置盘点

- 账户安全数据不属于外观或普通 `user_settings` 偏好；凭据、挑战和撤销状态由认证领域服务与 SQLite 认证表持有，不通过前端偏好或 localStorage 保存。
- 账户设置分类已有账户列表、当前账户和恢复密钥管理；本功能在此分类增加通行密钥列表、添加和撤销操作，不改变现有偏好默认值、持久化映射或账户权限。
- 登录后引导与账户设置界面沿用 `appearance.theme`、`appearance.accentColor` / 模式文字色、字体与字号、对比度、背景、遮罩透明度、模糊及减少动态效果等现有工作台映射；不新增 CSS 自定义属性或设置字段。

### 允许修改

- `.env.example`、`README.md`：说明 WebAuthn RP ID / Origin 部署设置及本地 localhost 使用约束。
- `server/src/config.ts`：校验并暴露可选 WebAuthn RP ID / Origin 配置，未配置时安全禁用通行密钥。
- `server/src/database.ts`：新增版本 24 凭据与短期一次性挑战的 SQLite 迁移，顺接现有版本 23 SteamCMD 迁移。
- `server/src/modules/auth/service.ts`、`server/src/modules/auth/index.ts`、新文件 `server/src/modules/auth/passkeys.ts`、`server/src/api/routes.ts`：实现密码重新验证、通行密钥注册/登录验证、挑战消费、凭据管理和现有会话签发。
- `server/package.json`、`frontend/package.json`、`pnpm-lock.yaml`：按官方维护者资料引入 WebAuthn server/browser 库；锁定已核查的兼容版本。
- `server/test/database-migrations.test.mjs`：只把当前最新迁移版本断言更新为 24，保留现有测试范围。
- `frontend/src/api.ts`、`frontend/src/App.tsx`、`frontend/src/components/AuthView.tsx`：接入浏览器能力检测、通行密钥登录与账户会话建立。
- `frontend/src/components/SettingsPage.tsx`、`frontend/src/components/Workbench.tsx`、新文件 `frontend/src/components/PasskeyManager.tsx`、`frontend/src/components/PasskeySetupPrompt.tsx`：添加账户安全管理和可跳过的首次引导，并使用现有主题/外观映射。
- `docs/系统总体架构.md`、`docs/开发计划.md`：记录认证边界、数据库版本和当前实机验收状态。
- `docs/PROMPTS.md`：登记当前合同、实际验证记录和完成状态。

### 禁止修改

- 不删除或弱化密码/恢复密钥回退、角色授权、会话撤销、登录速率限制及现有认证错误处理。
- 不将 PIN、指纹/面部数据、私钥、JWT、挑战秘密或凭据私有材料发送到日志、设置偏好、URL 或浏览器持久存储；不从请求 Host/Origin 自动扩展信任域。
- 不启用仅通行密钥登录、不改身份模型、账户初始化流程、普通设置 schema、数据库运行数据或其他认证策略。
- 不通过模拟浏览器成功状态替代真实 Windows Hello 验收；不部署、发布、上传或提交 Git。
- 保留工作树已有的未提交修改；只在当前合同列明的文件内做局部调整，不重置或覆盖其他用户改动。

### 验收方式

- 运行 `pnpm --filter lfaa-server run typecheck`、`pnpm --filter lfaa-server run build`、`pnpm --filter lfaa-frontend run build`；确认构建产物仅写入根目录 `dist/` 对应包目录。
- 静态检查失败路径均不签发会话；挑战过期、复用、跨账户或错误 Origin/RP ID 均拒绝；成功后只签发现有会话 Cookie；凭据列表与撤销严格限定当前账户；日志中不出现密码、PIN、响应正文、公钥以外的凭据秘密或挑战。
- 更新现有 SQLite 迁移版本断言；运行本合同涉及文件的 `git diff --check`。记录 workspace-preflight/quality Gate 是否存在及是否运行，不以构建代替安全行为验证。
- 记录真实 Windows Hello/浏览器注册、passkey 登录、账户切换和 HTTPS 部署验收情况；未实机完成时明确标记待验。

### 实现与验证记录（2026-09-29）

- 服务端通过显式 RP ID/Origin 配置校验并限制认证请求 Origin；挑战绑定用途、账户与 5 分钟期限，验证前一次性消费。成功认证复用现有会话 Cookie；添加/删除凭据需当前密码；数据库迁移为版本 24，以兼容已存在的版本 23 SteamCMD 迁移。
- 登录页只在当前 Origin 匹配、浏览器支持且服务端存在通行密钥时显示入口；账户页可添加、列出和删除通行密钥；工作台显示可跳过且仅在当前会话记忆的设置引导。界面沿用工作台 Ant Design 主题和外观配置，无新增设置项或 CSS 自定义变量。
- 依赖锁定 `@simplewebauthn/server@14.0.3`、`@simplewebauthn/browser@14.0.0`。W3C、Microsoft 与 SimpleWebAuthn 官方/维护者资料按合同所列链接核查。
- server `typecheck` 与 `build` 均通过，产物写入仓库根 `dist/server/`；frontend `build` 未通过，当前解析错误位于工作区已有的 SteamCMD 配置 JSX（`SettingsPage.tsx`，配置分类片段未闭合）。此前同一构建还报告 SteamCMD 配置拆分中的未使用状态/缺失旧变量及 `SetupReminder.tsx` 使用旧 API 字段。第一次完整 TypeScript 检查未报告通行密钥文件错误；当前语法错误使前端完整类型检查无法完成。未改写这些现存 SteamCMD 改动。
- 数据库迁移文件中已有的最新版本断言已从 23 更新为 24；`git diff --check` 通过。当前仓库没有 `scripts/workspace-preflight.mjs`，根 `package.json` 也没有 workspace-preflight 或 quality 脚本，因此对应 Gate 未运行。未运行自动化测试。
- Windows Hello、真实浏览器 Passkey 注册/登录、账户切换及生产 HTTPS 验收未执行，须保留为待验。

## LFAA-PORTABLE-DATA-ISOLATION-01

### 用户目标

同一份 LFAA 源码放在 U 盘等可移动盘上，在不同电脑运行时，各电脑使用独立的数据、数据库、凭据和 Daemon 节点身份，避免后启动电脑覆盖或抢占另一台电脑的节点状态。

### 当前合同

- 仅当 `LFAA_DATA_DIR` 未配置或仍为默认相对路径 `data`，且 Windows 仓库所在卷识别为 `Removable` 时，默认数据目录使用当前 Windows 用户 `%USERPROFILE%\.LFAA\data`。
- 固定磁盘和非 Windows 环境继续默认使用仓库根目录 `data/`；自定义绝对路径或其他相对路径遵循现有语义。可移动盘检测失败时必须报错，不得静默回退到 U 盘共享目录。
- Windows 卷检测脚本通过 Windows PowerShell 5.1 的 `-File` 启动时必须能正确解析；含中文内容的 `.ps1` 文件须使用 Windows PowerShell 5.1 可识别的编码，避免编码解析失败被误报为磁盘检测失败。
- server、Daemon、`scripts/start-dev.ps1` 对默认目录的解析必须一致；Daemon 锁文件也必须定位到同一实际数据根目录。
- 不自动复制、删除、迁移或修改 U 盘现有 `data/`；通过 `LFAA_DATA_DIR` 显式配置的共享目录语义保持不变。
- 设置中心只管理应用内目录；本任务不新增账户设置或 UI 配置，不改变设置中心已有数据。

### 允许修改

- `scripts/resolve-data-directory.mjs`、`scripts/resolve-data-directory.d.mts` 与其 Windows 卷识别脚本：实现可测试的数据根目录解析和 Removable 检测。
- 针对 Windows PowerShell 5.1 编码错误的局部修复仅调整 `scripts/get-project-drive-type.ps1` 的文件编码，不改卷检测逻辑。
- `server/src/config.ts`、`daemon/src/task-runner/minecraft-daemon.mjs`、`scripts/start-dev.ps1`：共用该解析结果。
- `server/test/data-directory.test.mjs`：验证默认、移动盘、显式覆盖和检测失败行为。
- `.env.example`、`README.md`、`docs/系统总体架构.md`、本文件：说明新默认规则与不迁移边界。

### 禁止修改

- 不触碰现有 `data/` 内容、SQLite 数据、节点凭据、Minecraft 实例、Java 安装或备份；不在两台设备间复制或迁移数据。
- 不改变数据库 schema、节点注册/心跳协议、Minecraft 任务语义、设置中心账户设置或用户偏好。
- 不扩大为自动漫游、云同步、备份恢复、数据目录选择 UI 或发布安装器改造。
- 不部署、发布、上传、提交 Git、改版本号或更新日志；不运行真实 Minecraft 任务。

### 验收方式

- 测试固定盘仍解析到仓库 `data/`，可移动盘默认解析到注入的用户主目录，绝对和自定义相对覆盖保持原义，无法检测的移动盘不会回退到共享路径。
- 静态核对 server、Daemon 和 Windows 启动脚本都把解析结果用于数据库/节点数据/Daemon 锁路径。
- 使用 Windows PowerShell 5.1 的实际 `-File` 调用验证卷检测脚本可解析并返回卷类型；确认 Node 数据目录解析器能据此在当前可移动盘解析到本机用户主目录。
- 运行新数据目录单元测试、server build/typecheck、Daemon 脚本语法检查和涉及文件 `git diff --check`；按需要验证 Windows Sandbox Host 构建仍通过。
- 不以本机模拟检测代替两台 Windows 电脑的实际隔离验收；最终记录实际未覆盖的双机验证。

### 故障修复记录（2026-09-29）

- 选项 2 的启动预检调用 `scripts/resolve-data-directory.mjs`。本机 `H:` 被识别为 `Removable`，且 `LFAA_DATA_DIR` 未设置，因此解析器按既定隔离策略调用卷检测脚本；这与 SQLite 数据库无关。
- 根因是 `scripts/get-project-drive-type.ps1` 含中文且为 UTF-8 无 BOM，但启动器使用 Windows PowerShell 5.1 的 `-File` 读取它，导致 PowerShell 解析阶段报错。Node 解析器捕获该失败并显示通用的“无法检测卷类型”错误。
- 为该 PowerShell 脚本添加 UTF-8 BOM；未改卷类型检测逻辑、数据目录策略、数据库 schema 或任何运行数据。
- Windows PowerShell 5.1 `-File` 实际调用返回 `Removable`；Node 解析器原先返回 `%LOCALAPPDATA%\.LFAA\data`，后按用户要求调整为 `%USERPROFILE%\.LFAA\data`；`node --check scripts/resolve-data-directory.mjs` 与相关文件 `git diff --check` 通过。
- 未运行自动化测试或启动三个服务；未完成另一台 Windows 电脑的双机数据隔离验收。

### 用户指定数据路径调整（2026-09-29）

- 按用户要求将可移动盘默认位置从 `%LOCALAPPDATA%\.LFAA\data` 改到 `%USERPROFILE%\.LFAA\data`；当前 H: 的实际解析结果为 `C:\Users\yu\.LFAA\data`。
- 路径调整后 `node --test server/test/data-directory.test.mjs` 通过（6/6），`pnpm --filter lfaa-daemon run build`、Daemon 语法检查、PowerShell 解析及 `git diff --check` 通过。
- 当前 server 构建遇到 `server/src/modules/auth/passkeys.ts:142` 的 TS2352 类型错误；该文件是本次路径调整前出现的未跟踪文件，与数据目录解析无关，本次未修改。

## LFAA-STEAMCMD-CONFIG-INSTALL-01

### 用户目标

修正设置中心把 SteamCMD 专项配置称作“存储配置”并与 Steam/Minecraft 存储目录共用编辑范围的问题；让管理员能清楚地选择 SteamCMD 配置、存储范围和实际安装目标，并可从全局默认配置页启动在线安装。

### 已确认的边界

- SteamCMD 安装模式、SteamCMD 工具目录属于 SteamCMD 专项配置；Steam 游戏目录与 Minecraft 实例根目录属于存储配置，分别编辑、分别保存、分别选择配置范围。
- 在线安装必须独立选择目标 Daemon 节点，不由当前正在编辑的全局默认/节点覆盖范围隐式决定。
- SteamCMD 工具目录和 Steam 游戏目录仍是目标节点 `LFAA_DATA_DIR` 内的安全相对路径；不开放任意绝对路径，不改变节点文件访问安全边界。
- 任务仍由 server 创建并派发，实际下载、解压和首次启动仍由具备条件的在线 Windows x64 Daemon 执行；页面必须明确显示无可用节点、节点离线或能力不足的原因。

### 当前合同

- 设置中心将 SteamCMD 安装方式和工具目录放进独立的“SteamCMD 配置”分类；Steam 游戏目录、Minecraft 实例根目录和未接入的写作目录归“项目与存储”。AI Provider 入口继续由“AI 与模型”拥有。
- SteamCMD 专项配置和 Steam 游戏存储使用不同的全局默认/节点覆盖状态。SQLite 迁移必须保留现有 SteamCMD 安装模式、工具目录和游戏目录值，不移动节点数据文件，不重置用户偏好。
- 在线安装/校验目标节点使用独立选择器。提交任务时按目标节点已保存且生效的配置创建 payload；若当前修改的是相同节点配置，可先保存该配置。无可运行节点时显示明确原因并禁用操作。
- daemon 心跳仍接收合并后的有效 SteamCMD 设置；SteamCMD 安装任务协议、路径校验和 30 秒任务租约保持兼容。
- 不新增账户偏好或外观设置项。继续使用管理员授权、现有工作台主题与减少动态效果偏好；不新增 CSS 自定义属性或依赖。
- 完成标准：配置表单、存储表单和安装目标互不串改；从全局默认配置选择在线节点后可以提交安装/校验任务；数据库升级保留旧值；无在线 Windows x64 Daemon 时页面给出准确提示；构建、迁移检查和差异检查通过，并说明是否完成真实 Daemon 安装验收。

### 允许修改

- `frontend/src/components/SettingsPage.tsx`、`frontend/src/api.ts`：拆分 SteamCMD 专项配置/存储页面与范围状态，增加独立安装目标选择。
- `server/src/database.ts`、`server/src/modules/games/steamcmd/service.ts`、`server/src/api/routes.ts`：把安装配置与 Steam 游戏默认目录分开持久化/保存，并为 Daemon/任务提供合并后的有效设置。
- `server/test/`：验证旧 SQLite SteamCMD 配置无损迁移及配置/存储范围隔离。
- `docs/PROMPTS.md`、`docs/系统总体架构.md`、`docs/开发计划.md`：登记本合同并同步配置 Owner、持久化与当前 SteamCMD 安装状态。

### 禁止修改

- 不改变 Minecraft 实例目录、SteamCMD 工具或 Steam 游戏目录相对于目标节点 `LFAA_DATA_DIR` 的安全边界；不移动现存文件。
- 不绕过管理员授权、节点能力条件、任务队列或 Daemon 校验；不让浏览器直接下载/运行 SteamCMD。
- 不启动或提交真实 SteamCMD 安装任务，不下载 SteamCMD，不修改用户运行数据或节点任务队列。
- 不扩展到 Steam 游戏服务器部署 Runner、实例生命周期、AI 工具、Linux Daemon 或发布流程。
- 不改动与本任务无关的工作区未提交文件，不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对设置导航、设置页状态、REST 保存路径、数据库独立默认/节点覆盖与心跳合并结果；检查全局默认配置可独立发起目标节点任务。
- 使用隔离临时 SQLite 数据验证从当前版本 22 升级后安装配置和 Steam 游戏目录分别保留默认值与节点覆盖值；不触碰当前 `data/`。
- 运行 server typecheck/build、frontend build、daemon 脚本语法检查和相关迁移测试；构建产物只写入根目录 `dist/`。
- 运行 `git diff --check` 并核对本任务变更文件；不把静态构建视为真实 Valve CDN 下载或 Windows Daemon 安装验收。

### 完整实现验证补记（2026-09-29）

- 新增解析器与 server/Daemon 接入后，Windows 可移动盘默认路径跟随项目根目录 `data/`；Windows 固定盘默认使用 `%USERPROFILE%\.lfaa\data`，非 Windows 开发跟随项目根目录。server、Daemon 与启动器共用规则；启动器在检查旧 Daemon 锁之前先注入已解析绝对路径，单独启动前端不做卷检测。
- `node --test server/test/data-directory.test.mjs` 通过（6/6）；`pnpm --filter lfaa-server run build` 通过；`pnpm --filter lfaa-daemon run build` 通过，Sandbox Host 构建输出位于根目录 `dist/daemon/target/`；Daemon 语法检查、PowerShell 5.1 脚本解析、当前卷检测、本机路径解析和 `git diff --check` 均通过。当前可移动盘项目实际解析到项目根目录 `data/`。
- `pnpm --filter lfaa-server run test` 共 12 项，8 项通过、4 项失败。3 项数据库迁移测试分别因迁移夹具缺少 `ai_accounts` 表或 `updated_at` 列失败；1 项实时心跳测试因 SQLite 参数 6 无法绑定失败。这些测试、数据库和心跳实现文件在本任务前已有未提交修改；本任务未修改它们或放宽断言。
- 当前项目根目录的可移动盘 `data/` 保留为唯一活动数据根；SQLite 从版本 25 正常迁移到版本 26，daemon 心跳确认使用该根目录。旧用户 Home 下的项目 `data/` 与当前库有同名账户但账户 ID、节点 ID 不同，AI 密钥加密所用的密钥文件也不同，因此未拼表；旧副本已单独归档，Home 下其他配置、状态、插件和运行时目录保持原样。未在第二台电脑启动本项目，也未运行 Minecraft 实例；双机首次启动后数据库和节点隔离、AppContainer 实际启动仍待实机验收。

## LFAA-UI-WRITING-AI-CENTER-01

### 用户目标

让写作 AI Work 的中间空状态沿用其他应用 AI Work 的共享聊天画布排版，同时遵循设置中心“外观”中适用于该区域的配置。

### 当前合同

- 写作 AI Work 继续复用 `ApplicationWorkspace`、`AiWorkChat` 和共享 `.module-center__content--ai-work`；不新增第二套聊天区、路由、会话状态或业务逻辑。
- 写作欢迎标题、说明和示例问题保留其业务文案；空状态宽度、间距和示例问题列表样式沿用共享 AI Work 版式，不使用写作专属的多行胶囊按钮布局。
- 写作工作区继续读取 `appearance.backgrounds.writing`、主题、强调色、界面/内容字体与字号、背景遮罩、模糊、对比度及减少动态效果等现有设置；不新增设置项、CSS 自定义属性或硬编码主题色。
- 外观页“玻璃模糊”说明应包含当前实际受其控制的 AI Work 输入区和写作上下文卡片；消息画布保持透明，不作为独立模糊表面。
- 不改变消息、输入、Provider、会话、提示词内容、右侧写作上下文、左侧导航、路由或服务端行为。
- 完成标准：静态核对写作空状态复用共享聊天布局和设置令牌；前端 TypeScript 检查及 Vite 构建通过，产物位于根目录 `dist/frontend/`；`git diff --check` 通过。浏览器实际外观切换结果单独记录。

### 允许修改

- `frontend/src/components/ai-work-chat.css`：让写作空状态的说明和示例问题沿用共享 AI Work 排版，并保留外观令牌适配。
- `frontend/src/components/SettingsPage.tsx`：准确说明玻璃模糊设置覆盖的实际 UI 区域。
- `docs/PROMPTS.md`：登记本任务合同并记录完成与验证结果。

### 禁止修改

- 不新增聊天实现、依赖、图片、CSS 自定义属性或设置项；不移除写作专属欢迎文案和提示内容。
- 不修改写作右侧上下文栏、会话导航、AI 服务/API、账户设置值和持久化行为。
- 不部署、发布、上传或提交 Git。

### 完成记录（2026-09-29）

- 写作空状态保留原有标题、说明、图标和示例问题文案；宽度、留白、建议列表和按钮改为沿用其他 AI Work 共用样式，避免写作专属宽幅胶囊布局。
- AI Work 字体、字号、强调色、主题、写作工作区壁纸、遮罩透明度、模糊强度及对比度继续读取现有设置中心配置；未新增设置项或 CSS 自定义属性。外观页的玻璃模糊说明已覆盖聊天画布、输入区、导航栏及写作上下文作品卡片。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查和 Vite 构建成功，产物位于根目录 `dist/frontend/`；`git diff --check` 通过。仓库未提供 `workspace-preflight` 脚本或 `quality:full` 命令。
- 当前 CUA 浏览器打开本地路由后停留在登录页，且未提供已有登录标签页；未登录或修改账户外观偏好。设置效果依据源代码映射完成静态核对，登录后的真实主题/壁纸切换目视验收待做。

## LFAA-APP-SETTINGS-SCOPE-01

### 用户目标

保持设置中心现有导航、页面结构和视觉布局，将共用账户偏好与 SteamCMD、Minecraft、写作三种 App 的业务配置按实际 Owner 区分；App 配置分别控制自己的需求，互不串改。

### 当前合同

- 不调整设置中心导航分类、总体页面结构、尺寸、间距、样式或现有分类内容位置；在现有 Minecraft 存储分组中复用 `SettingRow` 提供独立范围控制，并拆分现有编辑范围状态。
- 共用的常规、通知、外观、快捷键、AI Runtime、权限和插件偏好继续由 `user_settings` 按账户保存，并继续供共用工作台或跨 App 能力读取；不复制成每个 App 各一份。
- SteamCMD 安装方式/工具目录、Steam 游戏目录和 Minecraft 实例根目录保留各自业务 API 与持久化 Owner；SteamCMD 配置范围、Steam 游戏存储范围、Minecraft 存储范围和实际 SteamCMD 任务目标互相独立。
- 不改服务端数据格式、默认值、已有数据库数据或用户偏好；现有默认/节点覆盖 API 继续作为持久化依据。
- 当前写作 App 没有已接入的专属偏好项；作品、章节和编辑状态按账户保存，预留的作品路径目前仅作说明。未得到具体写作设置需求前，不新增空配置对象、虚构选项或未接入的控制。
- 不新增 CSS 自定义属性或依赖，不改设置中心现有外观、主题和动效配置。
- 完成标准：切换 Steam 游戏存储范围只更改 Steam 配置草稿；切换 Minecraft 存储范围只更改 Minecraft 配置草稿；保存到各自现有 API 后互不覆盖；保留共享账户偏好和当前 UI 布局。

### 允许修改

- `frontend/src/components/SettingsPage.tsx`：为 Steam 游戏存储与 Minecraft 实例存储分别维护独立的节点范围及草稿状态，继续调用各自现有保存接口。
- `docs/系统总体架构.md`：记录共用账户偏好、App 业务配置和当前写作配置接入状态的 Owner 边界。
- `docs/PROMPTS.md`：登记本合同并记录实际实现与验证结果。

### 禁止修改

- 不调整或重排设置中心导航、分组、页面布局、样式、配色、间距、字号或控件风格；不新增应用设置分类页面。
- 不拆分/迁移现有 `user_settings` 类别，不改变设置 API、数据库 schema、默认值和 SQLite 用户数据。
- 不把 SteamCMD、Minecraft 或写作的业务数据塞进共用账户偏好；不把共用外观、通知、权限等设置复制为 App 配置。
- 不新增写作设置字段、AI 写作行为、作品目录读写或未接入的功能。
- 不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对三种 App ID、共享用户设置类别、SteamCMD 配置/存储 API、Minecraft 存储 API 与写作 Owner；确认前端状态和保存函数分别使用各自的范围 ID。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 与 Vite 构建成功且产物写入仓库根目录 `dist/frontend/`。
- 运行 `git diff --check` 并核对本任务触碰文件；登录后在浏览器分别切换 Steam 与 Minecraft 节点范围的实操验收单独记录。

### 实现与验证记录（2026-09-29）

- 共用账户偏好和三种 App 的配置 Owner 已按现状记录到系统架构文档；常规、通知、外观、快捷键、AI Runtime、权限与插件仍由账户设置保存。SteamCMD 安装/存储与 Minecraft 实例目录继续走各自既有服务端 API 和持久化默认/节点覆盖值。
- 设置页为 Steam 游戏存储和 Minecraft 实例存储分别维护范围节点 ID 与草稿状态；切换 Steam 范围不再改写 Minecraft 草稿，Minecraft 保存使用自己的节点 ID 和节点列表。没有改 API、数据库、默认值或用户数据，也没有重排导航、页面结构或样式。
- 按用户确认，本次未新增写作偏好项；写作作品路径继续显示为未接入说明，不创建目录或启用文件读写。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查和 Vite 构建成功，产物位于根目录 `dist/frontend/`；`git diff --check` 通过。仓库中未找到 `workspace-preflight`、`quality` 或 `release` 脚本入口，因此未运行这些 Gate。
- 未登录浏览器进行节点范围切换；实际交互验收待做。本次未运行自动化测试。

## LFAA-UI-WRITING-SIDEBAR-01

### 用户目标

解决写作常规模式左侧同时出现全局导航栏、应用栏和作品/章节目录三列导航的问题。将作品与章节目录放入应用侧栏中应用切换说明下方的空白区域，正文编辑区不再常驻保留独立导航列。

### 当前合同

- 仅调整写作 App 常规模式的导航呈现；作品列表、章节列表、新建/选择/删除/重命名操作、自动保存状态及修订历史继续由现有写作工作区和 API 处理。
- 在写作常规模式的应用侧栏空白区域直接显示现有作品/章节列表，允许继续进行既有选择和创建操作；不在最窄的全局图标轨增加重复入口。
- 写作正文编辑区域改为单列，不再保留常驻的“作品目录”列；不改变应用侧栏、右侧作品信息/AI 上下文、工作台其他面板及其他 App 布局。
- 目录面板继续使用现有主题、表面、侧栏背景色、强调色、字体、字号、遮罩/模糊和减少动态效果令牌；不新增 CSS 自定义属性、设置项、默认值、依赖、服务端接口或数据字段。
- 目录面板需保留语义标签、键盘焦点可见性、窄屏可用性；目录操作不能丢失或改变既有保存状态。
- 完成标准：静态核对红框导航已移入写作应用侧栏空白区域且不再作为编辑页常驻列，其他 App 不显示该面板，现有作品/章节控制仍连接原有处理函数；前端构建和 `git diff --check` 通过。

### 允许修改

- `frontend/src/components/ApplicationWorkspace.tsx`：仅在写作常规模式的应用侧栏空白区域提供目录挂载点。
- `frontend/src/apps/writing/normal/WritingWorkspace.tsx`：将现有作品/章节导航内容挂载到应用侧栏，保持现有业务操作。
- `frontend/src/apps/writing/normal/WritingWorkspace.css`、`frontend/src/components/module-workbench.css`：将编辑区改为单列并让目录面板填充应用侧栏空白区域，复用现有视觉令牌。
- `docs/PROMPTS.md`：登记本任务合同并记录实际实现与验证结果。

### 禁止修改

- 不调整全局栏、应用侧栏、右侧栏或工作台的总体布局、宽度、次序及其他 App 的导航。
- 不新增写作配置选项、作品路径读写能力、后端逻辑、数据库变更、快捷键或依赖。
- 不改变作品/章节业务状态、API、自动保存、修订和账户数据；不改设置中心布局或设置值。
- 不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对目录挂载点只在写作常规模式的应用侧栏显示，目录内容通过现有写作业务处理函数运行，编辑区为单列布局且面板消费现有外观令牌。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 与 Vite 构建通过并且产物位于仓库根目录 `dist/frontend/`。
- 运行 `git diff --check` 并核对本任务触碰文件；登录后选择作品和章节及窄屏交互待浏览器验收。

### 实现与验证记录（2026-09-29）

- 作品/章节列表通过 React Portal 填入写作常规模式应用侧栏中应用切换说明下方的空白区域，复用原有选择、新建、删除、重命名和自动保存逻辑；不向最窄的全局图标轨增加重复入口。正文区改为单列，其他应用和 AI Work 不显示该面板。
- 面板沿用既有主题表面、侧栏颜色、强调色、边框、阴影、字体与字号映射；壁纸遮罩透明度和玻璃模糊继续由原有作品目录样式读取。没有新增 CSS 自定义属性、设置项、API、数据字段或依赖。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查与 Vite 构建成功，产物写入 `dist/frontend/`；`git diff --check` 通过。仓库没有 `scripts/workspace-preflight.mjs` 或 `quality:full` 脚本入口。
- 当前本地页面浏览器核查未完成：Computer Use 浏览器发现返回 `nodeRepl.fetch request failed`，没有打开或操作页面；展开/关闭、作品/章节选择和窄屏交互仍待目视验收。本次未运行自动化测试。

## LFAA-UI-AI-WORK-CANVAS-BACKGROUND-01

### 用户目标

修正带壁纸时 AI Work 中间消息画布被单独加深和模糊的问题，使中间区与工作台其他区域共享 `.workbench-shell` 绘制的同一张完整壁纸和全局遮罩。

### 当前合同

- `.workbench-shell` 继续作为工作区壁纸与全局遮罩的唯一绘制 Owner；AI Work 消息画布保持透明，不再叠加整面主题底色或 `backdrop-filter`。
- AI Work 继续消费当前应用工作区壁纸、主题及共享文字/字体令牌；`appearance.overlay` 继续控制外壳壁纸遮罩和既有独立表面透明度，`appearance.blur` 继续控制顶栏、导航、输入框及写作上下文卡等实际玻璃表面。
- 欢迎标记、示例按钮、消息气泡和输入框等离散控件保留各自的可读表面；不把局部遮罩扩大到整个消息视口。
- 只修正中间消息画布的局部覆盖并更新外观说明；不改变设置项、默认值、账户设置持久化、会话/消息、应用路由或工作台布局。
- 完成标准：静态确认消息画布无整面背景色与模糊，工作台外壳仍绘制背景，输入框等独立表面仍使用共享外观令牌；`pnpm --filter lfaa-frontend run build` 通过，产物位于根目录 `dist/frontend/`，`git diff --check` 通过。登录后真实壁纸和玻璃强度切换单独记录。

### 允许修改

- `frontend/src/components/ai-work-chat.css`：移除消息画布整面遮罩与模糊，并让保留的小型写作控件注释准确描述作用范围。
- `frontend/src/components/SettingsPage.tsx`：准确说明背景遮罩和玻璃模糊的实际覆盖范围。
- `docs/系统总体架构.md`：明确 AI Work 消息画布透出工作台统一壁纸，不额外叠加整面遮罩或模糊。
- `docs/PROMPTS.md`：登记本合同并记录完成与验证结果。

### 禁止修改

- 不增加设置项、CSS 自定义属性、依赖、壁纸资源或新的画布/聊天实现；不写死或重置账户外观偏好。
- 不修改全局背景 Owner、侧栏/右栏布局、聊天语义卡片、消息逻辑、API 或服务端设置存储。
- 不部署、发布、上传或提交 Git。

### 完成记录（2026-09-29）

- 移除了 `.ai-work-chat__messages` 整面主题底色与 `backdrop-filter`；消息画布现在透出 `.workbench-shell` 统一绘制的壁纸和遮罩。欢迎标记、写作示例按钮、消息气泡、顶部栏、导航、输入框及写作上下文卡仍按各自用途保留表面。
- 设置页已说明 `appearance.overlay` 控制工作区整张壁纸及既有独立表面透明度，消息画布不另加局部遮罩；`appearance.blur` 的说明排除消息画布。当前应用壁纸继续按 `appearance.backgrounds` 选择；主题与文字令牌沿用共享映射。前端与 server 默认值仍为遮罩 37%、模糊 14px；未改设置 schema、持久化或账户偏好。
- 静态核对确认消息画布无独立背景色/模糊声明，工作台外壳仍绘制统一壁纸，输入框仍读取 `--settings-glass-blur`，工作台仍映射背景、遮罩和模糊设置。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查和 Vite 构建成功，产物写入根目录 `dist/frontend/`；本任务文件 `git diff --check` 通过。
- CUA 未能读取当前浏览器状态，登录后真实壁纸与模糊效果目视验收待做；本次未登录或修改账户设置。

## LFAA-WRITING-VOLUME-GROUPING-01

### 用户目标

在写作常规模式现有的左侧作品目录中，按“作品 → 卷 → 章节”组织内容，支持新建卷，并能在指定卷中新建章节。

### 当前合同

- 只扩展现有写作目录的数据与交互；复用账户隔离的 SQLite 写作服务、API 和当前目录挂载点。
- 新增账户作品下的卷数据。新建作品默认生成“第一卷”；版本 27 的已有作品在版本 28 迁移中各生成一个“第一卷”，其原章节全部归入该卷，章节 ID、标题、正文、修订历史和当前编辑位置保持不变。
- 写作工作区返回当前作品的卷列表；章节带所属卷 ID。用户能新建卷，并在某卷下新建章节；章节仍由原章节服务负责选择、自动保存、删除、修订与恢复。已有章节创建接口保持可用，未传卷 ID 时归入该作品第一卷。
- 卷标题由服务端校验并持久化，作品归属由服务端账户校验；不得只在浏览器维护分组或跨账户接受卷 ID。
- 仅在现有左侧作品目录内补充“卷”标题、卷条目及新增控件，沿用既有主题、强调色、字体、字号、背景遮罩、模糊和减少动态效果映射。不新增外观设置或 CSS 自定义属性。
- 严格保持页面总体布局和现有区域位置：不重排或改宽全局栏、应用侧栏、正文编辑区、顶部当前章节工具栏及右侧作品信息栏；不调整其他 App。
- 本阶段不做卷重命名、删除、拖拽排序、章节跨卷移动、导入导出、写作偏好设置或文件路径读写。
- 完成标准：v27 到 v28 的数据迁移不丢失既有写作数据；服务端和前端类型/构建检查通过；目录控件连接真实服务/API；`git diff --check` 通过。

### 允许修改

- `server/src/database.ts`：新增 v28 卷表、章节外键字段、索引和非破坏性旧数据归卷迁移。
- `server/src/modules/writing/service.ts`：维护账户卷、卷查询和卷内章节创建。
- `server/src/api/routes.ts`：校验并接入新建卷及带卷 ID 的章节创建请求，保留旧章节请求兼容。
- `server/test/database-migrations.test.mjs`：覆盖 v27 既有作品/章节/修订/编辑位置迁移及重复启动不重复建卷。
- `frontend/src/api.ts`：同步卷与章节关联类型和创建 API。
- `frontend/src/apps/writing/normal/WritingWorkspace.tsx`、`frontend/src/apps/writing/normal/WritingWorkspace.css`：在当前目录中显示卷分组并提供对应新增操作，复用现有令牌。
- `docs/开发计划.md`、`docs/系统总体架构.md`：同步写作数据模型、Owner 和当前进度。
- `docs/PROMPTS.md`：维护本任务合同、索引与完成记录。

### 禁止修改

- 不改变页面布局、区域宽度/顺序、顶部工具栏、右侧信息栏或其他应用样式。
- 不删改现有作品或章节正文/修订，不更换作品、章节、自动保存、AI Work 上下文的 Owner。
- 不新增写作专属设置、文件读写、卷删除/改名/排序、章节移动、依赖或虚构入口。
- 不重置用户数据库，不部署、发布、上传或提交 Git。

### 验收方式

- 使用临时数据库验证 v27 → v28 后旧作品、章节正文、修订和最近编辑位置仍在，章节指向其新建的“第一卷”，外键检查通过；重复启动不会重复创建卷。
- 运行 `pnpm --filter lfaa-server run typecheck`、`pnpm --filter lfaa-server test -- test/database-migrations.test.mjs`、`pnpm --filter lfaa-frontend run build` 和 `git diff --check`，核对构建产物位于根目录 `dist/`。
- 静态核对新建卷/卷内新建章节调用真实 API，布局区域未改变；浏览器登录交互单独记录。

### 实现与验证记录

- 新增数据库版本 28 的账户作品卷表和章节 `volume_id`；既有作品各生成“第一卷”，原章节改为关联该卷，章节正文、修订和编辑位置保持原值。新建作品也会创建默认“第一卷”。
- 写作服务与账户认证 API 已支持新建卷和在指定卷下创建章节；旧章节创建请求不传卷 ID 时仍归入该作品的第一卷。服务端校验卷属于请求作品及当前账户。
- 左侧现有作品目录现在按作品、卷、章节显示；“卷”标题提供新建卷入口，每卷提供新建章节入口。仅调整目录内部层级，页面整体布局、顶部工具栏、右侧信息栏和其他 App 未改。
- 目录继续读取既有主题、侧栏颜色、强调色、界面字体/字号、壁纸遮罩与模糊映射；未增加写作专属设置、CSS 自定义属性或硬编码颜色。
- `pnpm --filter lfaa-server run typecheck` 通过；v27→v28 专项迁移测试通过，确认正文、修订、当前章节、卷外键、重复启动和整本作品级联删除。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查通过，构建产物位于根目录 `dist/frontend/`；`git diff --check` 通过。
- 完整 `database-migrations.test.mjs` 还存在历史 v8/v10/v22 夹具未包含当前旧迁移要求的表/列问题（例如 `ai_accounts`、`ai_messages`、任务 `updated_at`），这些测试在到达版本 28 前失败；本次新加的 v27 专项用例单独通过。浏览器登录交互未运行。
- 当前仓库没有 `scripts/workspace-preflight.mjs`、`quality:full` 或 `release` 脚本入口，因此这些 Gate 未运行。

## LFAA-UI-APP-CENTER-NAV-01

### 用户目标

将应用中心入口放到左一，使用户从应用中心进入或切换 SteamCMD、Minecraft、写作 App；左二不再占用空间展示不能直接切换的应用列表。

### 当前合同

- 左一指最窄的全局导航轨；左二指当前 App 的应用侧栏；中间与右侧分别保持当前工作区内容和上下文面板。
- 应用工作区左一增加“应用中心”直达按钮，调用现有 `onApplicationsHome` 回调进入 `/`；现有“返回当前模式首页”的房子按钮语义保持不变。
- 左二移除冗余的“应用中心”行、不可切换的全 App 列表、该列表的搜索入口/状态及说明文字。左二仍保留当前 App 的业务导航、写作作品目录、通知和侧栏控制。
- 应用之间的切换只通过应用中心已有入口完成；不在左一增加各 App 独立切换按钮，不修改应用路由、快捷键、应用状态或服务/API。
- 不改变左一/左二/中间/右侧宽度、顺序、收起行为或主题；新入口沿用全局导航按钮样式与当前主题令牌。不新增设置或 CSS 自定义属性。
- 设置中心与文件页继续复用全局导航轨，但只在应用工作区显示应用中心快捷按钮；其现有返回行为和更多入口保持可用。

### 允许修改

- `frontend/src/components/GlobalNavigationRail.tsx`：在应用工作区左一增加应用中心入口。
- `frontend/src/components/ApplicationWorkspace.tsx`：移除左二无效应用列表和专属搜索状态，保留当前 App 业务菜单。
- `frontend/src/components/module-workbench.css`：清理仅服务于被移除应用列表/搜索的样式。
- `docs/系统总体架构.md`：说明应用切换入口归应用中心、左一可直接返回应用中心、左二承载当前 App 导航。
- `docs/PROMPTS.md`：登记和记录本任务合同、边界及验证。

### 禁止修改

- 不增加左一的 App 快捷切换按钮，不改变当前模式首页与应用中心的不同路由语义。
- 不移动或重排左二业务菜单，不改变中间、右侧、任何栏宽、拉伸/吸附交互或应用工作区默认布局。
- 不改应用中心已有 App 入口、应用权限/状态、数据、设置、API 或快捷键；不新增依赖、配置项或 CSS 自定义属性。
- 不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对左一应用工作区按钮执行 `onApplicationsHome`，设置页/文件页不显示该按钮，左一原房子仍调用 `onHome`。
- 静态核对左二不再渲染应用切换列表与应用搜索，当前 App 菜单和写作目录条件仍保留；中间、右侧和面板尺寸计算无改动。
- 运行 `pnpm --filter lfaa-frontend run build` 和 `git diff --check`，并确认构建产物位于仓库根目录 `dist/frontend/`。真实登录后点击和浏览器视觉检查另行记录。

### 实现与验证记录（2026-09-29）

- 左一在应用工作区增加网格图标“应用中心”按钮，直接调用已有 `onApplicationsHome`（当前路由进入 `/`）；房子按钮继续调用 `onHome` 返回当前 App 与当前模式首页。设置页和文件页不显示新增按钮。
- 左二移除了不可切换 App 列表、列表搜索、提示文字和重复的应用中心行；保留通知、收起控制、Minecraft 菜单、写作作品目录、AI Work 会话及当前模式切换。
- 中间、右侧和工作台各栏宽度、顺序及拉伸状态未改。新增入口复用现有导航按钮样式和主题令牌；未触及设置中心配置，也未新增 CSS 变量或依赖。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查和 Vite 构建通过，产物位于根目录 `dist/frontend/`；`git diff --check` 通过。本次未新增或运行自动化测试。
- `scripts/workspace-preflight.mjs` 不存在，根 `package.json` 未提供 `quality:full` 或 `release` 脚本；这些 Gate 未运行。登录后点击和浏览器视觉验收未运行。

## LFAA-UI-RECENT-SESSIONS-NAV-01

### 用户目标

启用左一“最近会话”入口，展示现有各 App 的最近 AI Work 会话，并允许从当前任意全局导航页面打开选中的会话。

### 当前合同

- 复用 `loadAiSessions({ archived: false })` 和现有认证 `GET /api/ai/sessions`，按服务端 `updated_at DESC` 返回的次序显示最近 20 条；保留真实加载、空数据和错误/重试反馈。
- 选择会话时复用现有 `lfaa:open-ai-session` 事件，由已挂载的 `Workbench` 更新按 App 隔离的活动会话 ID 并打开所属 App 的 AI Work；消息、会话归属及路由仍由现有服务和工作台处理。
- 最近会话弹层属于全局导航的本地展示状态，每次打开重新请求当前账户未归档会话；不新增会话缓存 Owner、API、数据库字段、持久化或跨账户数据。
- 左一按钮保持原位置和宽度；入口使用现有主题令牌，不改变左二、中间、右侧或其他工作台布局。不新增设置项、CSS 自定义属性或依赖。
- 保持设置页、文件页和应用工作区共用入口可用；弹层支持关闭按钮、点击外部和 Escape 关闭。

### 允许修改

- `frontend/src/components/GlobalNavigationRail.tsx`：启用最近会话按钮，读取和呈现当前账户会话摘要，并通过现有事件打开会话。
- `frontend/src/components/module-workbench.css`：定义最近会话弹层内的条目、元信息、空/错/加载状态及其在左一附近的位置，沿用共享主题令牌。
- `docs/系统总体架构.md`：记录最近会话入口复用的 API、会话事件与状态 Owner。
- `docs/PROMPTS.md`：登记本合同并写入实现和验证记录。

### 禁止修改

- 不改 `server/`、会话 API/数据库/排序语义、AI Work 消息加载、通知逻辑、`Workbench` 的会话状态 Owner 或应用路由。
- 不新增另一套会话状态、模拟会话、归档操作、会话搜索/分页、设置项、依赖或 CSS 自定义属性。
- 不改变左一/左二/中间/右侧宽度、顺序、可调节行为及既有导航按钮语义。
- 不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对按钮可用、打开时请求未归档跨 App 会话、显示服务端排序靠前的 20 条，选择项发出现有事件，且原 Workbench 监听器仍接管打开流程。
- 运行 `pnpm --filter lfaa-frontend run build` 和 `git diff --check`，并确认构建产物在根目录 `dist/frontend/`；真实登录后的 API、选择与返回交互另行记录。

### 实现与验证记录（2026-09-29）

- 左一“最近会话”按钮已启用。每次打开弹层，通过认证 `GET /api/ai/sessions?archived=false` 读取当前账户会话，显示更新时间最新的 20 条；有明确的加载、空数据、错误和重试状态。
- 选择条目会派发既有 `lfaa:open-ai-session` 事件。`Workbench` 原监听器据此恢复对应 App 的活动会话 ID、切换到其 AI Work 并打开会话；会话消息仍由原 App 工作区按需读取。
- 应用工作区、设置页和文件页复用同一入口。弹层可通过关闭按钮、点击外部或 Escape 关闭；样式沿用现有主题令牌，仅定位到历史图标旁，没有修改导航栏宽度或其他工作台区域。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查和 Vite 构建通过，产物位于根目录 `dist/frontend/`；`git diff --check` 通过。本次未新增或运行自动化测试，浏览器登录态交互未运行。
- 仓库没有 `scripts/workspace-preflight.mjs`、`quality:full` 或 `release` 脚本入口，因此这些 Gate 未运行。

## LFAA-WRITING-AGENT-PLACEMENT-01

### 用户目标

在写作 AI Work 对话中，Agent 理解用户的自然语言写作指令，自主选择当前作品大纲或常规模式当前章节正文，并执行准确的写入操作。

### 当前合同

- 写作上下文向模型提供服务器确定的当前作品/章节身份、当前大纲和正文资料。模型按用户明确指向选择“作品大纲”或“当前章节正文”；目标或写入位置确实含糊时先追问，不猜测、不声称未执行的写入。
- 写作 Agent 提供受限的大纲编辑与章节编辑 Tools；支持追加、前置、按唯一锚点前后插入及明确要求时整体替换。锚点缺失或多次出现时拒绝执行并让 Agent 澄清；不得默默追加到错误位置。
- 所有写入由模型工具调用真实写作业务服务完成；每次写入使用现有的单次审批机制，审批信息展示实际作品/章节、大纲或正文目标、操作和内容摘要。工具执行重新校验目标属于当前账户，并将本次变更保存到对应修订历史。
- 作品大纲作为作品级真实持久数据保存；在已有写作作品目录下增加“大纲”条目，选择后复用中央编辑器查看/编辑，保留大纲修订与恢复。保持工作台左一、左二、中间、右侧布局和分栏尺寸，不重排现有列。
- 普通模式编辑器在切换到 AI Work 前 flush 未保存草稿；AI 工具执行后的内容由已有工作区重新加载读取，避免脏草稿覆盖工具写入。
- 写作工具只处理服务端账户隔离的作品数据，不开放任意本机路径、Daemon 文件操作或 Shell；Provider、模型、Skills 和权限仍由既有 AI 设置与 Runtime 管理。
- 不添加回复旁的手动插入按钮，不把 AI 回复机械地盲目追加到正文；不让模型绕过审批或业务校验；不新增设置项、依赖、CSS 自定义属性或工作台重新布局。

### 允许修改

- `server/src/database.ts`：持久化作品大纲及其修订历史。
- `server/test/database-migrations.test.mjs`：同步当前最新数据库版本断言。
- `server/src/modules/writing/service.ts`、`server/src/api/routes.ts`：实现账户隔离的大纲读写、修订恢复 API，以及 AI 当前写作上下文。
- `server/src/ai/business-tools.ts`、`server/src/ai/runtime.ts`：注册范围受限的写作工具与自然语言目标选择规则。
- `frontend/src/api.ts`、`frontend/src/apps/writing/normal/WritingWorkspace.tsx`、`frontend/src/apps/writing/normal/WritingWorkspace.css`：让“大纲”进入现有作品目录并复用中央编辑器与修订历史。
- `frontend/src/components/ApplicationWorkspace.tsx`、`frontend/src/components/AiWorkChat.tsx`、`frontend/src/components/ai-work-chat.css`、`frontend/src/apps/writing/ai-work/WritingAiContext.tsx`：保留编辑器 flush，去除机械手动插入按钮，说明 Agent 工具写入与审批。
- `README.md`、`docs/系统总体架构.md`、`docs/开发计划.md`：记录作品级大纲数据 Owner、Agent 工具和审批边界。
- `docs/PROMPTS.md`：维护本合同和实现、验证记录。

### 禁止修改

- 不修改工作台布局/分栏尺寸、AI Provider/模型选择、权限策略或其他应用工具；不开放文件路径、Daemon 或 Shell。
- 不添加无审批的写入、跨账户/跨作品任意目标写入、猜测锚点的静默降级或回复按钮式机械追加。
- 不新增设置项、依赖或 CSS 自定义属性；不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对写作 Agent 只获得当前作品范围的两个写工具，模型参数与审批摘要绑定同一目标；越权目标、缺失/重复锚点均拒绝写入。
- 静态核对 schema v29 可在既有 v28 后添加大纲/修订数据，读写与恢复均检查账户和作品归属；Chapter 与 outline 保存都保留最多 50 个修订快照。
- 静态核对普通模式“大纲”条目打开中央编辑区，且栏位布局不变；切换模式前等待当前编辑草稿保存。
- 运行 server 和 frontend 构建及 `git diff --check`；构建产物位于根目录 `dist/` 对应子目录。迁移和浏览器交互按实际执行结果记录，不得暗示未运行的测试通过。

### 实现与验证记录

- 已移除消息旁盲目“插入正文”按钮与前端追加回调。AI Runtime 现在把本轮请求时服务端确认的作品/章节 ID、大纲和正文标记为不可信作品资料；只为该上下文生成大纲与当前章节工具。普通账户可编辑自己的账户隔离写作记录，工具参数和目标 ID 被单次审批绑定；服务层再次检查账户归属。
- `writing_edit_book_outline` 与 `writing_edit_current_chapter` 支持追加、前置、唯一锚点前后插入及明确要求的整体替换。锚点不存在/重复时服务返回错误，不会降级为追加；System Prompt 要求模型在目标/位置不清时先询问，工具结果成功后才允许模型声称已保存。
- 数据库迁移 v29 给作品增加大纲正文和独立修订历史；大纲 API 覆盖保存、读取工作区、列出修订和恢复。大纲在既有作品目录里新增一个条目，中央编辑区复用同一文本编辑器；不改左一/左二/中间/右侧栏位顺序、宽度和布局。
- 常规编辑器为正文和大纲分别自动保存，并在切换文档或模式前 flush 当前草稿。AI Tools 保存时生成对应内容修订，两个内容目标各保留最近 50 个版本。沿用设置中心的活动 Provider/模型、AI Runtime 限额与权限；没有新增设置项。
- `pnpm --filter lfaa-server run build` 通过；`pnpm --filter lfaa-frontend run build` 通过（TypeScript 与 Vite，产物在根 `dist/frontend/`）；`git diff --check` 通过。迁移测试文件的最新版本断言已更新为 29；本轮未运行自动化测试。模型 Provider 的工具兼容性、逐项审批交互和浏览器实机编辑验收未运行。
- 仓库未提供 `scripts/workspace-preflight.mjs`，根脚本也没有 `quality:full` 或 `release` 入口；这些 Gate 未运行。

### 启动错误修正合同（2026-09-29）

- 用户启动日志显示数据文件版本为 29，而程序支持上限仍为 28；同一文件已有 v29 迁移，计划文档也记录了 v29 数据结构。
- 将当前支持上限与最新迁移版本对齐为 29；继续对高于 29 的数据库 fail-closed，不降级、不重置或直接修改运行数据。
- 允许修改 `server/src/database.ts` 的支持版本声明，以及本合同中的验证记录；不扩大到启动器、Daemon 或 UI。
- 核查 server 类型检查、构建和差异格式；不运行自动化测试或启动服务。记录日志中其他错误是否为后端退出后的派生现象。

### 修正记录（2026-09-29）

- 支持版本上限已从 28 对齐到 29；版本高于 29 时原有 fail-closed 检查仍生效。未直接打开或修改用户数据库。
- `pnpm --filter lfaa-server run typecheck`、`pnpm --filter lfaa-server run build` 和目标文件 `git diff --check` 均通过；构建输出目录由 `server/tsconfig.json` 指向根 `dist/server/`。
- 未运行自动化测试或启动服务。日志中重复的数据库错误是服务端无法启动的根因；Daemon 的 `fetch failed` 与控制端不可用相符。Vite `ECONNABORTED` 和 Node `util._extend` 弃用提示也出现在日志中，但不构成该数据库启动故障的原因，本次未改动它们。

## LFAA-DEEPWRITE-WRITING-SKILLS-01

### 用户目标

参考 DeepWrite 的写作 Skills、提示词和工具协作方式，增强 LFAA 写作 AI Work 对自然语言写作目标的识别和准确落笔能力；结合 LFAA 当前数据模型与权限边界实施，不照搬其他仓库的作品结构。

### 当前合同

- 仅实现 LFAA 当前真实支持的写作目标：账户自己的作品大纲和本轮选中的章节正文。DeepWrite 的人物卡、剧情阶段、素材库、项目技能库等在 LFAA 没有相应持久领域 Owner，当前不新增模拟工具或虚假入口。
- 新增少量由 LFAA 自行编写的内置写作 Skills，Agent 可通过只读 `writing_load_skill` 按需加载；基础提示词说明各 Skill 的适用任务，并要求把 Skill 作为写作方法，不当作作品事实或越权授权。Skill 元数据进入既有 AI 扩展目录。
- 加强写作 System Prompt 对“先讨论/给建议”和“明确要求保存”的区分；明确“大纲/正文”自然语言目标路由、追加默认行为、锚点插入/替换与整篇重写的边界、上下文不可信和工具成功后才可声称已保存。
- 现有大纲和章节工具继续使用请求时锁定的账户目标、写作业务服务、逐项审批及修订历史。补充唯一锚点局部替换能力，锚点缺失或重复一律拒绝，不退化为追加或全文覆盖。
- 不修改左一、左二、中间、右侧等工作台布局、分栏尺寸、导航、样式或设置页；不增加数据库、用户技能库 UI、外部模型依赖、任意路径或 Shell 能力。
- 只参考 DeepWrite 的按需加载、阶段化提示和审阅边界等方法；本次提示词与技能正文为 LFAA 新写，不复制外部源码或提示词文本。DeepWrite 仓库标示 Apache-2.0；如未来直接复用其代码，必须遵循该许可证的保留、声明和分发条件。

### 允许修改

- `server/src/ai/skills/writing-skills.ts`：定义少量 LFAA 内置写作 Skill 的 ID、说明和完整方法内容。
- `server/src/ai/prompts/writing.ts`、`server/src/ai/runtime.ts`：构造 LFAA 写作 Agent 的目标识别、Skill 加载提示和写作边界，并接入现有 Runtime。
- `server/src/ai/business-tools.ts`：加入只读 Skill 加载工具，扩展两个写作工具的唯一锚点替换操作。
- `server/src/ai/plugins/builtin-catalog.ts`：登记内置写作 Skill 元数据。
- `server/src/api/routes.ts`：在既有 AI 活动轨迹中将动态 Skill 加载显示为 Skill 活动。
- `server/src/modules/writing/service.ts`：为大纲/正文写作服务增加唯一锚点局部替换语义。
- `README.md`、`docs/系统总体架构.md`、`docs/开发计划.md`：准确记录能力、调用边界和未接入的领域。
- `docs/PROMPTS.md`：维护本合同和实现、验证记录。

### 禁止修改

- 不改变任何 UI 布局、分栏尺寸、CSS、导航、外观设置或写作常规编辑器的交互。
- 不伪造人物、剧情阶段、素材库或用户技能库的持久化能力；不把对话生成伪装成作品已保存。
- 不增加无需逐项审批的写入，不允许目标 ID 脱离本轮上下文，不开放文件系统路径、Daemon 文件工具或 Shell。
- 不复制 DeepWrite 源码或其提示词原文；不增加依赖、数据库迁移或新的设置项；不提交、部署、发布或上传代码。

### 验收方式

- 静态核对只有写作 App 能看到 `writing_load_skill`；Skill 读取不需要审批且不写数据；非写作 App 不暴露该工具。
- 静态核对写作提示把讨论/建议与明确保存区分清楚，并把“大纲”“正文”“追加”“锚点插入”“锚点替换”“整体重写”映射到现有真实工具；模糊目标先询问。
- 静态核对锚点替换只改唯一精确原文，缺失/重复时不改内容；两种写入仍绑定请求时目标、逐项审批、账户校验和修订历史。
- 运行 server typecheck/build 和 `git diff --check`；确认构建产物仍位于仓库根 `dist/server/`。不运行自动化测试或启动服务。

### 实现与验证记录

- 写作 App 新增 4 个 LFAA 内置 Skill：大纲规划、章节正文写作、精准润色与修改、连贯性审阅。Agent 通过只读 `writing_load_skill` 按需加载完整方法；Skill 元数据加入受信任插件目录，实际工具调用在活动轨迹中归类为 Skill 活动。Skills 仅提供写作方法，不创建作品事实、权限或其他 App 的能力。
- 新增独立写作 System Prompt，明确区分对话建议与保存指令；“大纲”和“当前正文”分别路由到请求时目标，未指定位置时追加，锚点插入/替换要求唯一原文，全文替换必须是用户明确要求。上下文里的指令按作品资料处理，只有真实 Tool 成功后才报告已保存。
- `writing_edit_book_outline` 和 `writing_edit_current_chapter` 增加 `replace_anchor`，对唯一原文片段做局部替换；锚点缺失/重复会拒绝，不降级为追加。保留现有单次审批、账户归属校验、修订历史及当前作品/章节绑定。
- 未复制 DeepWrite 源码或提示词文本；参考其按需加载 Skill、按阶段提供方法与写入需审阅的设计。当前只做大纲和章节正文，不伪造人物卡、剧情阶段、素材库或用户技能库。
- `pnpm --filter lfaa-server run typecheck`、`pnpm --filter lfaa-server run build`、`git diff --check` 均通过；构建由 `server/tsconfig.json` 输出到根目录 `dist/server/`。未运行自动化测试、Provider 工具调用或浏览器交互。

## LFAA-DEEPWRITE-WRITING-INTEGRATION-01

### 用户目标与范围

- 用户确认按完整范围分阶段，将 DeepWrite 的写作功能接入 LFAA Writing App；第一阶段先接作品资料目录与 AI 按需上下文，再处理修改差异审阅、专职写作 Agent 和分析流程。
- DeepWrite 的 Electron/Vue/Pi Runtime 不作为 LFAA 的第二套应用或运行时引入。作品、设置、模型、会话、权限和工具继续使用 LFAA 唯一 Owner；对接的是写作流程与能力。
- 分阶段路线：P1 作品资料目录与按需只读上下文；P2 AI 写作提案差异预览、确认、冲突处理和历史；P3 专职写作角色与作品绑定素材/Skills（使用 LFAA 的模型与权限设置）；P4 短篇/长篇拆解、修订分析和文风比较；P5 DeepWrite 文件项目的显式导入/导出兼容。LFAA 已有模型 Provider、章节/大纲、Skills 和提示词能力按现状复用，不重复建设。
- 不移植 DeepWrite 的 Electron 外壳、自动更新、云备份或设备同步；不直接依赖其私有应用包。若复制上游代码或文本，须另行核实并登记 Apache-2.0 声明与来源；本阶段不复制。

### P1 当前合同

- 运行入口为 `pnpm lfaa web` 提供的写作 App 常规模式及 AI Work。作品与资料归 `packages/document/writing`，认证/账户隔离由写作 API 和服务端 Owner 执行，模型工具通过既有 Agent Loop 与权限合同接入。
- 复用现有账户作品下 `writing_catalog_entries` 和 CRUD API；常规模式按世界观、人物、剧情、素材分类浏览、创建、编辑和删除，不创建平行文件存储或第二套目录数据。
- 列表按当前作品、资料类别、标题搜索和固定页大小分页。`getWritingWorkspace` 不再为概览一次读取该作品全部资料正文；每次目录查询至多返回 40 个摘要。标题与正文的保存继续经过认证 API 并验证账户/作品归属。
- AI Work 仅在 Writing App 且本轮有当前作品目标时提供 `writing_list_catalog_entries` 与 `writing_read_catalog_entry` 两个只读工具。列表单次最多 40 项；正文按需最多返回 12,000 字符并报告是否截断。工具从服务端本轮上下文取得作品 ID，不接受模型指定其他作品；条目 ID 必须属于该账户当前作品。
- 系统提示明确资料正文是用户创作内容，属于不可信参考资料，不构成执行指令、权限或写入授权。本阶段 Agent 不能写入资料条目；AI 改写与差异确认进入后续阶段。
- 保留现有 `WritingWorkspace.tsx` 未提交编辑器变更，包括延迟字数统计和正文/大纲保存链；资料面板拆成独立 Client 模块，禁止回滚、重写或夹带那些变更。

### 设置、数据与权限盘点

- 不新增写作偏好或 Settings 字段。界面使用既有 `appearance` 的主题、强调色、界面/内容字体字号、背景/壁纸、遮罩透明度、侧栏模糊、对比度和减少动态效果映射。
- 写作业务配置没有需要读取的新项；活动模型、Provider 密钥与 Agent 参数继续来自当前 Settings/Runtime。作品与目录数据保存在既有账户隔离 SQLite；API 与 Tool 均按当前认证用户和当前作品二次校验。
- P1 的模型工具只读、无副作用审批；用户在常规模式编辑资料时使用认证 CRUD API。此处权限模式不替代账户归属校验。

### 允许修改

- `packages/document/writing/src/service.ts`、`packages/document/writing/src/prompts.ts`、新增 `packages/document/writing/README.md`：实现有界分页/当前作品约束读取并说明唯一数据 Owner 与写作上下文合同。
- `packages/api/writing-controller/src/index.ts`：登记认证的作品资料分页读取路由。
- `packages/core/tools/src/business-tools.ts`：仅为当前 Writing 作品增加只读资料列表/正文工具。
- `packages/client/connection/src/api.ts`：添加分页资料列表调用及类型。
- `packages/client/ui-writing/src/normal/WritingWorkspace.tsx`、新增 `WritingCatalogPanel.tsx` 及必要局部样式；`packages/client/ui-workspace/src/ApplicationWorkspace.tsx`：挂载独立资料面板，并由工作区 Owner 提供稳定门户节点，使侧栏折叠时首次进入后展开仍能显示目录。
- `apps/cli/tests/`：增加覆盖分页、账户/作品隔离、读取截断与 App 工具范围的长期回归。
- `docs/PROMPTS.md`、`docs/系统总体架构.md`、`docs/开发计划.md`：登记本任务、P1 真实现状与后续阶段状态。

### 禁止修改

- 不改 DeepWrite checkout；不复制其私有 Electron/Renderer/Agent Runtime，不加入工作区依赖。
- 不重置或回滚任何既有工作树差异；尤其保留写作编辑器当前的保存和性能优化。
- 不新建作品数据表、文件系统读写、同步服务、模型 Provider、Agent Loop、权限体系或账户/App 设置；不开放模型任意路径与跨作品读取。
- 不在 P1 增加 AI 资料写入、未经审阅的改写、提示词指定的工具授权或未实现的分析入口；不改写作工作台总体布局。
- 不修改用户作品数据或运行服务，不部署、发布、上传或提交 Git；构建产物只写仓库根 `dist/`。

### P1 验收条件

- 认证 UI 只加载当前作品当前类别的一页资料，页大小不超过 40；切换作品后旧请求不能覆盖新作品状态；增删改后刷新能从服务端读回。
- 写作列表和正文读取工具仅属于 Writing App，缺少当前作品时不可用；只返回当前账户/当前作品资料；正文最多 12,000 字符并诚实标记截断；资料内容不被解释为权限指令。
- 目录 UI 不阻塞现有大纲/章节编辑与保存；没有重复请求、无界列表响应、未清理的计时器/订阅或每次按键读取大正文。
- 运行写作服务、API、Core Tools、Client UI/Web 相关构建和新增直接回归，输出仅在根 `dist/`；运行存在的 workspace-preflight 与适用 Gate；`git diff --check` 通过。
- 报告 P1 负载上限与静态工作量；真实 Provider、登录浏览器/键盘交互、不同主题及帧时间分别按实际结果记录，不以构建代替。

### P1 实施与验证记录

- `WritingCatalogPanel` 在常规模式提供 17 类作品资料的分类、标题搜索、固定页长分页、认证 API 新建/编辑/删除；切换条目、筛选或关闭面板遇到未保存正文时会先要求处理草稿。原 `WritingWorkspace` 当前未提交的编辑器改动保留。
- Service 的列表/工作区概览只选择 `id/kind/title/updated_at`，不为生成摘要读取正文；目录页与 AI 列表各最多返回 40 条。AI 正文工具从当前运行上下文绑定的作品读取至多 12,000 字符，返回总字符数、截断标记和 `untrusted` 信任标记；提示词禁止将条目内文字解释为指令或授权。现阶段工具只读。
- `pnpm --filter @yubboo/lfaa test -- tests/writing-catalog.test.mjs` 通过（1 项），覆盖分页、标题筛选、元数据投影、当前账户/作品约束、AI 工具 App 范围与 12,000 字符截断。
- 写作 Service、Writing Controller、Core Tools、Client Connection、Writing UI 包构建通过；`pnpm --filter lfaa-web run build` 单独重跑通过，产物写入 `H:/LFAA1/dist/apps/web/`；`pnpm run build:control-plane` 通过，产物写入 `H:/LFAA1/dist/apps/control-plane/`。首次 Web 构建在并行包构建期间被源码指纹变化门禁拒绝登记，停止并行构建后重跑通过，没有将首次结果记作成功。
- `git diff --check` 对本合同列出的已跟踪实现与文档改动通过。资料分页实际读取列固定为 4 个元数据字段，响应上限 40 条；AI 正文额外读取上限 12,000 字符；交互无轮询、定时器或订阅。未测量浏览器帧时间。
- 浏览器清单中 Edge 扩展返回 `nodeRepl.fetch request failed`，Codex IAB 没有现成页面；没有启动或重启服务。因此目录实际键盘/鼠标操作、主题/壁纸视觉与登录 Provider 的 AI 工具调用未验收。
- `workspace-preflight` 当前仓库未找到对应入口；本次未运行与资料目录无关的全量测试或发布 Gate。P2 的审阅式 AI 修改已在下方完成；P3–P5 专职角色和作品绑定方法、长短篇分析、显式文件导入导出仍待实施。

### P2 当前合同

- 用户目标：AI 编辑先形成可审阅提案；AI Work 展示提案绑定的作品/目标、当前原文与完整新稿，用户点击“确认并应用”后才更新大纲或章节。拒绝提案只改提案状态，不改作品。
- 运行入口：`pnpm lfaa web` 的 Writing AI Work。提案与内容归 `packages/document/writing`，SQLite 结构归现有 Storage Owner，认证路由归 writing-controller，活动元数据归现有 Session Owner，UI 复用 AiWorkChat 和 connection API。
- 将 AI 现有 `writing_edit_book_outline` / `writing_edit_current_chapter` 工具变为只创建提案的语义；它们不可修改目标正文。AI 没有“应用提案”工具。用户的显式 UI 动作是所有权限模式下唯一应用入口，权限模式不得把未审阅提案自动写入。
- 提案绑定账户、作品、目标类型/ID、原文 SHA-256 与建议正文；保留上限 150 万字符、按目标只留一个待审提案、24 小时有效期。加载预览时重读当前目标；哈希不一致即标为过期且不返回可应用状态。应用操作在单一 SQLite 事务中比较原文指纹、保存旧版本至现有 50 条修订历史并提交新稿，冲突时整笔不写。
- AI 会话活动只保存提案 ID，不复制完整原文/新稿；详情仅在用户打开审阅界面时从认证 API 读取。所有 GET/应用/拒绝路由按当前认证账户和提案 ID 校验，不能跨账户取回或提交。
- 设置无新增；审阅界面使用当前主题、强调色、界面/内容字体字号、对比度、壁纸遮罩/模糊与减少动态效果。

### P2 设置与文件合同

- 允许修改：`packages/storage/storage-sqlite/src/database.ts`、`packages/storage/storage-domain/src/migration.ts`（新增一次向前 SQLite 提案表迁移）；`packages/document/writing/src/service.ts`、`src/prompts.ts`、`writing-prompt-library.ts` 与 README（提案服务及写作行为合同）；writing-controller（认证详情/应用/拒绝接口）；`packages/core/tools/src/business-tools.ts`、`packages/core/agent-loop/src/execute-turn.ts`、`packages/core/session/src/sessions.ts`、`packages/skill/writing/src/writing-skills.ts`（只生成提案并把提案 ID 持久化到活动，Skills/Prompts 不得声称工具成功即已保存）；`packages/client/connection/src/api.ts`、`packages/client/ui-chat/src/AiWorkChat.tsx` 与局部样式（查看和人工应用）；`packages/client/ui-writing/src/ai-work/WritingAiContext.tsx`（准确解释人工审阅/应用边界）；`packages/client/ui-workspace/src/ApplicationWorkspace.tsx`（应用成功后刷新共享作品状态）；`apps/cli/tests/`（隔离、冲突、修订和权限模式回归）；本合同及计划文档。
- 禁止：AI Tool 直接保存提案正文、当前权限模式自动应用提案、因过期而覆盖更新正文、在聊天活动中复制完整文本、改写未选择的作品/章节、重置用户数据、修改 DeepWrite checkout、部署/发布/提交。
- 验收：提案创建不改变正文/修订；同账户 UI 能加载完整旧文/新稿并选择拒绝或应用；跨账户 ID 访问失败；提案后原文变更时 apply 拒绝且正文/修订不变；有效 apply 原文进入现有修订历史；`full_access` 下 AI 仍不能绕开 UI 点击；运行服务、API、Core Tools、Session/Agent Loop、Web/控制端直接相关构建和持久化回归；新输出仅在根 `dist/`。浏览器交互、Provider 使用和帧时间单独报告。

### P2 实施与验证记录（2026-10-04）

- 数据库版本 39 新增账户/作品绑定的审阅提案表；Writing Service 在事务中创建提案、记录基准正文 SHA-256、单目标只保留一个待审提案、每账户最多 50 条并设置 24 小时有效期。预览只在用户打开时加载正文；应用时事务内重验哈希，保存原文到既有修订表后提交新内容。
- 写作编辑 Tools 仅创建待审提案，按 `read` 风险且没有提案应用工具；Agent 活动只持久化提案 ID。认证 API 提供详情/应用/拒绝，UI 可并排检查完整原文和新稿；用户拒绝、过期、目标冲突或已被替代时不会写正文。用户明确点击应用后，父工作区重新读取共享写作状态。
- 同步修正内置写作 Skills、任务 Prompt 与右侧上下文提示：工具调用成功只能报告“提案已生成”，不会称正文已保存，也不会误称由权限模式逐项审批。
- 未新增 Settings 字段；审阅界面消费外观中心已有语义主题/强调色/对比度令牌、界面与内容字体/字号映射、壁纸遮罩透明度和玻璃模糊、减少动态效果偏好。
- `pnpm --filter @yubboo/lfaa test -- tests/writing-catalog.test.mjs tests/writing-edit-proposals.test.mjs` 通过（2 项）。覆盖 P1 目录隔离与分页；P2 提案只读创建、跨账户拒绝、拒绝不写、原文冲突阻止应用且不新增修订、有效应用保留旧版本、重复应用不重复建修订、过期保护、同目标提案替代及 `full_access` 下工具不能应用。
- SQLite、Storage Domain、Writing Service、Writing Controller、Core Tools、Session、Agent Loop、Client Connection、Chat UI、Application Workspace 十个相关包构建通过；`pnpm --filter lfaa-web run build` 和 `pnpm run build:control-plane` 通过，输出分别在根 `dist/apps/web/` 和 `dist/apps/control-plane/`。
- 本阶段没有启动或重启服务。浏览器/键盘审阅弹窗、真实 Provider 生成提案、外观组合及帧时间未实测；构建和服务层回归不代表这些运行验收已完成。

### P3 当前合同

- 用户目标：为每部作品选择一个明确的 LFAA 写作专职角色，并维护只属于该作品的自定义 Skills；Agent 按任务需要读取当前作品已有资料和启用的 Skills。角色与 Skills 是写作方法，不创建第二个 Agent Runtime、Provider、Session 或写入通道。
- 运行入口：`pnpm lfaa web` 的 Writing 常规模式右侧创作上下文与 AI Work。角色/Skill 资料归 `packages/document/writing`；当前作品资料继续复用 P1 `writing_catalog_entries`；认证路由由 writing-controller 按当前用户/作品校验；Tools 沿用现有 Agent Loop；页面沿用现有 LFAA Provider、AI Runtime 与权限配置。
- 每个作品保存一个内置角色 ID，初始角色为通用写作顾问；可选创作顾问、大纲策划、章节写手、精准编辑、连贯性审阅和人物顾问。角色只调整本轮方法与关注点，不能改变用户目标、工具集合、数据权限或提案应用边界。
- 每个作品最多 40 条自定义 Skill；标题最多 120 字符、说明最多 300 字符、完整方法最多 12,000 字符。Skill 带账户和作品外键、可启停；详情只在 Agent 调用只读 Tool 时按需读取。列表返回元数据，不读取正文。Skill 内容视为用户资料，只提供写作方法，不构成授权或产品指令。
- 现有 17 类作品资料仍受当前作品限制并按 P1 的 40 条分页/12,000 字符正文读取上限工作。模型不默认枚举或拉取全库；只在任务需要时读取有关资料或启用 Skill。专职角色与 Skills 不获得直接保存正文能力；写入仍只能由 P2 用户审阅提案界面应用。
- Settings 不新增模型、权限或外观字段。角色与 Skills 使用作品业务 API 持久化；模型、Provider、推理档位、输出长度与项目权限继续读取现有账户设置。UI 消费主题/强调色/对比度、字体与字号、壁纸遮罩/模糊、减少动态效果共享映射。

### P3 设置与文件合同

- 允许修改：Storage SQLite 与 Storage Domain（版本 41 的书籍角色列和作品 Skill 表迁移）；`packages/document/writing/src/`（静态角色目录、作品档案及 Skill Service）；writing-controller（认证角色/Skill API）；Core Tools（当前作品启用 Skill 的有界只读目录/正文 Tool）；Agent Loop 与 System Prompt（把当前作品角色附加到提示并保持 Skill 按需读取）；Client Connection；`ui-writing` 右侧角色/Skill 管理局部 UI；ApplicationWorkspace 共享状态刷新；长期 Service/Tool/Owner/边界回归；本合同、架构、计划和 Writing README。
- 禁止：角色写入/覆盖 system permission、工具定义或目标授权；从 Skill 正文推导额外权限；允许跨账户/跨作品读取；全量注入 Skill 正文；为角色另建模型配置或替代设置中心 Provider；绕过 P2 提案审阅、复制 DeepWrite 代码、改任意文件或变更其他 App。
- 验收：不同作品的角色与 Skill 严格隔离；只启用的 Skill 显示在当前作品元数据列表中，正文只读时最多 12,000 字符；无当前作品时无角色/Skill 写作工具；非写作 App 不暴露写作 Skills；模型可按用户目标使用当前作品角色和已有目录资料，真实工具仍不变；测试账户、容量与长度边界；构建 Storage、Writing、Controller、Tools、Agent Loop、Session/Client/Web/Control Plane，产物在根 `dist/`；运行 `git diff --check`。真实 Provider、登录浏览器、外观组合和帧时间单独报告。

### P4 当前合同

- 用户目标：在现有 Writing AI Work 中提供短篇/长篇拆解、章节修订分析和文风比较；复用现有模型、Agent Loop、当前作品数据、作品 Skills 与提示词，不复制 DeepWrite Electron/Pi 扩展 Runtime。
- 分析输入只来自经认证的当前账户/当前作品服务：章节目录只读摘要分页；批量章节正文由当前作品的章节 ID 按需读取，每次最多 8 章且总返回不超过 12,000 字符；修订列表限当前选中章节最近 50 条，单份历史正文读取最多 12,000 字符；文风参考来自用户本轮文字或当前作品资料条目。结果声明实际读取范围与截断状态。
- 新增内置写作 Prompt：短篇全篇拆解、长篇分批/范围拆解、修改分析、文风比较。简单问题仍由模型直接回答；只有任务需要时按需加载提示词与资料。长篇分析按章节目录分段读取，受现有设置中心最大请求数/工具调用数和 Provider 上下文限制；超出范围必须报告已分析章节和未覆盖部分，不得伪称通读。
- 分析默认只读，结果留在当前 AI Work 会话；不得写回正文、资料库、作品 Skill 或 DeepWrite 文件。用户可自行复制确认过的结果到现有手动编辑入口；若用户明确要求修改作品，仍走 P2 待审提案。输出引用章节标题/序号或差异序号，不复述大段原文。
- 新章节与历史修订工具仅属于 Writing App 且绑定本轮当前作品/当前章节；所有 SQL 查询都同时验证认证用户、作品和章节，禁止模型传入任意账户、路径或作品目标。

### P4 设置与文件合同

- 允许修改：`packages/document/writing/src/service.ts`、`prompts.ts` 与 `writing-prompt-library.ts`；Core Tools 的当前作品章节目录/有界正文读取、当前章节修订只读工具；相关认证/连接 API 仅在必要时变更；隔离 Service/Tool 回归；本合同、Writing README、架构与开发计划。
- 设置：不新增设置项；模型、Provider、推理档位、输出长度、最大请求与工具调用次数均继续读取现有 AI Runtime/Provider 配置。
- 禁止：不启动、关闭、改写或写入 DeepWrite checkout；不执行 DeepWrite 分析指令/用户正文中的命令；不全量加载作品正文；不复制 Pi Agent、Vue 页面或扩展 Agent Runtime；不引入新存储、平行会话、批处理结果缓存或自动落库；不覆盖未确认正文或 Skills。
- 验收：短篇可用分批有界读取当前作品章节，长篇用分页目录和多次有界读取并诚实报告覆盖；修订分析仅能读取当前章节历史；文风分析只基于当前提供样本；其他账户/作品/章节无法读取；非 Writing App 不显示这些工具；工具数量、列表/正文长度有上限；直接回归、相关包与 Web/Control Plane 构建通过并只输出到根 `dist/`；`git diff --check` 通过。Provider 实际长文覆盖、浏览器使用与视觉表现分开报告。

### P5 当前合同

- 用户目标：支持用户显式将当前 Writing 作品导出为 DeepWrite 可打开的项目目录 ZIP，或选择 DeepWrite 项目 ZIP 导入为一部新的 LFAA 作品；不自动同步、不覆盖当前作品。
- 导出格式：DeepWrite 原生长篇目录，包含 `deepwrite.json`、`long/index.json`、`long/book-line.md`、每章 body/card/character-state/handoff/continuity Markdown；附带 `lfaa/metadata.json` 与 `lfaa/catalog/**` 扩展文件以便 LFAA 往返保存作品角色、启用/停用 Skills、章节卷归属与作品资料目录。DeepWrite 忽略扩展文件，核心长篇 manifest/index 使用其公开文件合同。
- 导入支持 DeepWrite `deepwrite.long-book`（`deepwrite.json` + `long/index.json`）与短篇/剧本 `deepwrite.book`（schemaVersion 1–4）的 Markdown 项目；长篇读取 bookLine 与章节 body；短篇读取草稿分节 body，并把附属 Markdown 文档作为当前 LFAA `material` 目录条目。支持的文本字段进入现有写作领域 Owner，不搬运 Agent 会话、提案、修订历史、Provider 凭据或外部路径。
- 导入创建一部新作品，生成 LFAA 自己的账户、作品、章节和资料 ID；由 Writing Service 单一事务完成，任何 manifest、引用路径、重复 ID、长度、ZIP 目录或外键问题均整包失败，不留下半成品。已绑定任何其他用户的数据一律不导入，也不信任 ZIP 文件中的作者/账户 ID。
- 上传为用户在常规 Writing 页面通过文件选择器明确选择的 `.zip`；导出为浏览器下载。接口只收/发 ZIP 流，不接受任意服务器文件路径。ZIP 防护：压缩体不超过 32 MiB、解压体不超过 64 MiB、最多 5,000 文件、单文件不超过 8 MiB；拒绝 ZIP64、加密、链接条目、重复/大小写冲突路径、绝对/盘符/反斜线/`..` 路径、未知压缩算法、CRC 错误及超限解压。
- 不导入或导出未应用 P2 提案、修订历史、Agent Session/Run、账号设置/秘密、上传附件、图片或任意本地绝对路径。导入从 DeepWrite folder 项目映射到 LFAA current book/volume/chapter/catalog；不反向兼容用户的 DeepWrite 私有设置、工作进度或历史账本。

### P5 设置与文件合同

- 允许修改：`packages/document/writing/src/service.ts`、`src/deepwrite-archive.ts`（ZIP、DeepWrite manifest 映射及事务导入/导出）；writing-controller（认证 raw ZIP 导入/导出端点和上传体积流控）；Client Connection 二进制请求/下载；`WritingWorkspace.tsx` 和局部样式（文件选择、确认、下载）；`packages/client/ui-workspace/src/ApplicationWorkspace.tsx`（把作品目录门户节点生命周期交给工作区 Owner）；隔离 Storage/Controller/Client 回归；本合同、Writing README、系统架构与开发计划。
- 设置：不新增设置项；导入/导出按钮沿用现有外观令牌与可访问性。写入账户 SQLite 并继续使用原 Owner，不创建 `projects/writing` 或任意文件缓存目录。
- 禁止：浏览器提交路径字符串、任意服务器本地读写、URL/日志泄漏正文、隐式同步、覆盖既有作品、直接导入其他人的账户 ID、二次存储全本内容、导出密钥/session/proposal/revision；不改 DeepWrite checkout，不新增外部 ZIP 依赖，不写出 ZIP/临时产物到仓库 `dist/`。
- 验收：DeepWrite 长篇导出 manifest/index 符合其当前版本结构，章节和大纲 Markdown 可读；DeepWrite 短篇/剧本包导入成新 LFAA 作品；LFAA ZIP 导出再导入可保留大纲、卷、章节正文、作品资料、角色及 Skills；首次进入时侧栏折叠，之后展开可见作品目录、资料与 DeepWrite 导入/导出控件；损坏/越权/超限 ZIP 整包失败且数据库无新作品；构建相关包、Web/Control Plane 并运行 P1–P5 直接回归；输出只在根 `dist/`，`git diff --check` 通过。浏览器真实文件选择/下载和 DeepWrite 客户端打开兼容性分开报告。

### P1–P5 综合实施与验证记录（2026-10-04）

- P1 作品资料目录与按需只读上下文、P2 审阅提案与显式应用、P3 作品专职角色和 Skills、P4 有界篇章/修订/文风分析、P5 DeepWrite ZIP 导入导出均已接入现有 Writing/Storage/Controller/Core Tools/Agent Loop/Client Owner；未引入 DeepWrite Runtime、第二套存储、Provider、会话、权限或任意文件访问。
- P5 长篇导出按 DeepWrite 当前 `deepwrite.long-book` 与 `long/index.json` schema 生成核心项目文件；LFAA 的角色、Skills、卷归属与资料目录保存在 `lfaa/` 扩展。短篇/剧本项目的 Markdown 草稿分节映射为新作品章节，附属 Markdown 映射为资料目录条目。往返导入创建新作品并重新分配 LFAA ID；账户、会话、提案、修订历史和秘密不随 ZIP 迁移。
- ZIP 读写仅在请求内存中完成；认证 Controller 对上传流限 32 MiB，归档读取还限制解压体 64 MiB、5,000 项和单项 8 MiB，并校验路径、类型、大小与 CRC。导入事务失败不留下半成品；不新增设置项或外部 ZIP 依赖。
- `apps/cli` 的 P1–P5 定向回归通过（5/5），覆盖资料和提案账户隔离、角色/Skill 隔离、分析读取边界、短篇导入、LFAA 往返保留、恶意/损坏 ZIP 整包拒绝；运行时通过 `LFAA_DEEPWRITE_ROOT=H:\deepwrite` 指向只读 DeepWrite 源码，并直接校验其当前 manifest/index schema。版本 43 的会话记忆迁移是当前最新数据库版本，作品角色测试同步断言此版本；未设置环境变量时，回归不依赖本机 DeepWrite checkout。
- Writing Service、Writing Controller、Core Tools、Client Connection、UI Writing、UI Workspace 包构建以及 Control Plane 构建通过；本轮再次验证 UI Writing、UI Workspace 构建、`tsc --noEmit -p tsconfig.client.json`、Web Vite 构建及 `git diff --check` 均通过，构建输出位于根 `dist/`。Web 构建有现存大于 500 KB 的 chunk 提示；帧时间未测量。
- 登录态浏览器通过 Vite 开发入口 `http://127.0.0.1:5173/apps/writing/normal` 验证：折叠导航后切换到 AI Work 再回常规模式，展开侧栏能看到作品目录、资料库、DeepWrite 导入/导出控件；DOM 中作品目录 Portal 宿主为单个，解决了主侧栏和折叠预览重复挂载的问题。正文没有编辑，未选择、上传或下载 ZIP。3000 上既有 CLI 服务保持运行，仍提供旧静态资源指纹；没有重启该服务。
- `workspace-preflight` 当前仓库没有对应脚本入口。浏览器真实 ZIP 文件选择/下载、真实 Provider 的分析与提案交互、DeepWrite 桌面客户端实际打开、外观组合和帧时间仍未实测；schema 校验、开发入口交互与构建结果不替代这些验收。

## LFAA-SETTINGS-NOTIFICATION-COMPLETION-SOUND-01

### 用户目标

AI Work 回复完成时，除工作台通知栏和右下角提醒外，播放设置中心“通知”中选择的完成提示音；用户可以在“通知”分类试听或关闭提示音。

### 设置中心配置盘点

- `general.completionNotification` 默认 `unfocused`，控制完成事件是否启用以及浏览器系统通知是否在工作台未聚焦时投递；`never` 时不显示完成通知，也不播放对应音效。
- `general.notificationSound` 默认 `default`，可选 `default`、`subtle`、`off`；前端设置页已提供选项与试听，server `readGeneralSettings` 已做白名单校验并随账户 `general` 设置持久化，前端 `UserSettings` 已映射该字段。
- 不新增设置字段或迁移；完成事件的音效按已保存的 `notificationSound` 执行。工作台聚焦状态只影响浏览器系统通知，不再抑制已有工作台完成提醒的音效。

### 当前合同

- 仅真实 AI Work 流式回复的 `complete` 结果触发完成通知音效；失败、中断、取消不触发完成音效，已有会话问题/审批提醒行为保持不变。
- `completionNotification=never` 时仍关闭完成提醒与音效；其余策略下，只要现有完成通知被加入工作台通知中心，就按 `notificationSound` 播放一次。`notificationSound=off` 时静音。
- 浏览器系统通知仍遵循 `always`、`unfocused` 与 `never` 的既有投递条件；系统通知设为 `silent`，避免与 LFAA 提示音重复。
- 不新增依赖、API、数据库字段或声音资产，不修改通知权限模型和其他通知类别。

### 允许修改

- `frontend/src/shared/notification-runtime.ts`：修正完成音效与浏览器系统通知聚焦条件的耦合。
- `docs/PROMPTS.md`：登记本合同与实际验证记录。

### 禁止修改

- 不修改设置中心已有控件、设置字段名、默认值、服务端持久化与校验逻辑。
- 不修改其他提醒事件、浏览器授权流程、通知内容、音效设计或系统通知策略。
- 不新增后端 API、数据库迁移、依赖、静态音频文件，不运行自动化测试或启动/部署服务。

### 验收方式

- 静态核对 `always` 与 `unfocused` 策略下，完成通知入工作台通知中心时都会遵循 `notificationSound`；`off` 静音，`never` 不通知且不播放；系统通知仍按焦点策略投递。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 与 Vite 构建结果；确认产物位于根 `dist/frontend/`。
- 核对本合同相关文件的差异格式，并记录浏览器/桌面实机音频播放是否验收。

### 实现与验证记录（2026-09-30）

- `notifyAiWorkCompletion` 在完成提醒进入工作台通知中心后，立即按 `general.notificationSound` 播放一次；工作台是否聚焦只决定是否额外投递浏览器系统通知。`completionNotification=never` 仍会关闭完成提醒与音效，`notificationSound=off` 保持静音；设置项、默认值、校验和持久化均沿用现有实现。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查；Vite 产物写入仓库根目录 `dist/frontend/`。`git diff --check -- frontend/src/shared/notification-runtime.ts docs/PROMPTS.md` 通过。
- 已按仓库规则尝试 `node scripts/workspace-preflight.mjs`，但脚本不存在；根 `package.json` 未定义额外 quality/release Gate。未运行自动化测试或浏览器/桌面音频播放实测。

## LFAA-SETTINGS-CENTER-CLEANUP-01

### 用户目标

归档设置中心审查结论，将导航和配置整理列为后续待办；先完成用户当前安排的架构升级，再依据升级后的架构决策开展设置中心整改。

### 审查记录

- 2026-09-29 对当前 `SettingsPage.tsx` 做静态源码盘点：导航共 31 个入口、5 个分组；16 个入口点击后仅展示待接入说明。未接入的入口、数据/状态页面和真实设置混在同一导航中。
- “通知”设置组同时出现在“常规”和“通知”；“个性化”指回“外观”，“环境”指回“常规”。“已归档的聊天”是会话操作，“开发者”是状态信息，“使用情况和计费”当前只展示 Token 用量且注明不含费用。
- “常规”有 23 个字段；静态检索未发现其中若干字段在设置页面以外的运行时代码引用。`questionNotifications` 有数据字段但没有可操作控件；部分可编辑选项的页面说明注明待接入。
- 导航分组在首次无保存折叠状态时默认全部展开；搜索框按分类名/分组名筛选，不检索具体设置字段。设置项在约 300ms 后自动保存，同时页面仍提供“立即保存”。
- 共用用户设置、AI 账户、外观背景、SteamCMD 工具配置、Steam 游戏存储、Minecraft 实例存储和本机数据根目录由不同 Owner/API 管理。该数据归属拆分是有意设计，后续整改不得混并或重置已有用户值。
- 本记录是代码静态审查结果，不代表浏览器视觉或运行时验收；实现整改前需复核当时的代码和架构决定。

### 后续整改合同

- 本轮只保存审查记录并登记待办；设置中心代码和架构代码均不在本合同的实施范围内。
- 设置中心整改排在当前架构升级之后。架构升级完成并确认新的模块边界后，再确定导航分组、占位功能呈现策略、设置项的运行时消费者、搜索范围和保存交互。
- 整改时复核每项设置的默认值、前端映射、服务端校验和持久化 Owner；未接入真实 Consumer 的项目保持说明或禁用状态，不表现为已经生效。
- 保留账户隔离、AI 密钥保护、主题/字体/字号/颜色/背景/遮罩/模糊/减少动态效果等现有设置语义；不删除、合并或迁移用户数据，除非后续合同明确规定兼容方案并完成无损验证。
- 保留 SteamCMD 工具安装目录、Steam 游戏目录、Minecraft 实例目录和 `LFAA_DATA_DIR` 的独立业务归属及全局默认/节点覆盖边界。

### 后续实施前置条件

- 用户确认架构升级范围与新的 Owner/模块边界。
- 按新架构重新盘点设置页、类型、默认值、服务端校验、API、持久化和实际消费者，并更新本合同及 `docs/开发计划.md` 中的验收标准。
- 代码、数据迁移和浏览器验收由后续独立实施任务决定；本归档任务不运行测试、不改变代码或用户数据。

## LFAA-HARNESS-DSH-PACKAGES-01

### 用户授权与目标

用户明确要求对标 `deepseek-ai/deepseek-harness` 的实际结构，保留全部同名包目录占位，并将当前项目实现迁入职责包；特别指定 `packages/client/ui-chat`、`ui-commands` 等 UI 划分。沿用上游目录名和包名后缀，将项目命名替换为 `lfaa`。用户已授权开始架构重构。

### 实施边界与设置盘点

- 实际迁移源码、开发入口、依赖、构建、两种既有桌面外壳的启动及打包引用；用 Cordis Context、服务、事件和可撤销插件生命周期装配。
- 保留现有产品页面、路由、JSX、文案和 CSS；设置类型、71 项叶子默认值、服务端校验、账户持久化与前端映射沿用原实现。General、Appearance、Shortcuts、AI Runtime、Permissions、Plugins、应用/布局偏好、通知、Provider/模型配置和数据位置均不重置。
- Profile 是配置，Bundle 是普通包的装配补丁；使用上游的包分类，不保留前一版自定义 `harness/kernel` 源码层。目录占位不标为可用功能。
- 数据留在原位置，数据库迁移链、`LFAA_DATA_DIR`、三个权限模式保持原合同。完全权限不增加逐项审批。
- 所有构建和中间产物只进入根 `dist`；每个能力包只清理自己的输出子目录。

### 实际交付与验证

上游 316 个包目录原名保留，62 个实际能力/装配包构建通过；Server、Web、Sandbox Host 和 Tauri debug/release 检查通过。隔离环境核对 HTTP 就绪、动态控制器登记与撤销、共享服务关闭、Daemon 启停、独立桌面运行树、设置持久化和浏览器映射。Electron 未安装打包及实际包内 HTTP/Daemon 运行通过，产物在根 dist。现有用例 17 项中 12 通过、5 失败；迁移前快照复现相同失败。

完整绝对路径、文件职责、迁移前后对应、71 项默认值、验证与未验范围见 [迁移交付记录](harness-migration.md)；全部包状态见 [目录对标清单](harness-packages.md)。真实游戏/模型执行、Windows Hello、安装包和完整产品验收未执行。

## LFAA-HARNESS-CLEANUP-01

> 历史合同说明：本合同的“完整多子 Agent 自主协作仍需实施”描述该任务结束时的状态，不代表当前缺少可执行子 Agent。后续已接入独立模型与工具循环的顺序委派；并行调度、任务依赖、写入冲突处理、独立专家角色配置和聚合用量仍是待办，当前事实见 [Agent Runtime 交付记录](harness-agent-delivery.md)、[系统架构](系统总体架构.md)和[开发计划](开发计划.md)。

- 目标：以 DSH 对标包架构为当前开发入口，落实大模型自主驱动全部已接入 App 和节点的核心，补齐硬编码、新旧实现、临时排查及长期测试的开发规则。
- 执行：发布运行树排除测试支持包；节点执行文件统一为 `packages/host/daemon/src/daemon.mjs`，公开 `lfaa-host-daemon/daemon`，由独立节点 Context 装配；版本读取包清单，卸载取消轮询请求和等待。
- 清理：删除确认的一次性脚本、测试数据、旧架构缓存、失败临时归档与无用中间产物；保留长期测试、必要夹具、用户数据、正式备份和上游占位。每项清理记录绝对路径、数量与实际结果。
- 设置：沿用 Provider/模型、AI Runtime、三种项目权限模式、Shell、应用目录和外观设置；不新增或重置配置，完全权限不增加逐项审批。
- 验证：按实际命令记录构建、源码/编译入口、无密钥节点请求拒绝、轮询取消、锁释放和发布树隔离。临时检查脚本与数据在验证后删除。
- 范围（任务完成时）：本轮固定核心与清理执行边界；当时完整多子 Agent 自主协作、专家独立模型配置和未实现 App Runner 仍属后续工作。顺序可执行子 Agent 已由后续交付接入；当前剩余项见 [Agent Runtime 交付记录](harness-agent-delivery.md)、[系统架构](系统总体架构.md)和[开发计划](开发计划.md)。
- 交付：[逐文件变更、设置、清理和验证记录](harness-cleanup.md)。
## LFAA-HARNESS-CLI-STORAGE-01

用户要求 `npx @yubboo/lfaa web` 与源码 `pnpm install`、`pnpm run build`、`pnpm lfaa web`。用户已明确选择先完成本地启动与打包，暂不发布 npm。最新存储决定为混合：Agent 会话/轨迹 JSONL，配置文件，账户/权限/任务 SQLite；覆盖此前全部 JSON/JSONL 的选择。

设置中心沿用 71 项默认值与既有 UI 映射、Provider/模型、三种权限模式、Shell、应用目录和项目存储配置，不重置用户数据。文件迁移先回读校验与备份，再退役旧权威表；新运行入口不查询旧配置/消息表。全部产物位于根 dist，长期测试保留，临时物删除被自动审核阻挡的实际情况须如实记录。

交付：本地 CLI/发布组装、3 个真实文件存储包、SQLite v31、节点私有路径保护、完整旧库夹具及 30/30 长期回归；活动数据只读核对 7 会话/30 消息/14 用量。完整文件、设置和实际验证见 [交付记录](harness-delivery.md)。早期迁移记录的 62 包及 5 个失败为历史状态，本记录为当前状态。

## LFAA-WRITING-PROMPT-LIBRARY-01

### 用户目标

整理 `C:\Users\Administrator\Documents\易创提示词` 中的写作提示词，优化后加入 LFAA 写作工作区的内置提示词库。

### 设置中心配置盘点

- 写作 AI Work 沿用“AI 与模型”中的活动 Provider、模型与推理参数，以及账户 `aiRuntime.speed`、`requestTimeoutSeconds`、`maxOutputTokens`、`maxModelRequests`、`maxToolCalls`；不在提示词或工具中重复设置这些运行参数。
- 本次不新增写作偏好、模型、权限或外观配置。提示词为只读内置内容，不做用户编辑或持久化；不新增界面，因此没有新增外观样式映射。
- 保存行为继续遵循现有“用户与权限”项目权限模式、写作工具的单次审批、账户归属检查和修订历史。

### 当前合同

- 将来源目录的 14 份写作提示词整理为任务级模板，保留作品简介、剧情分析、设定/大纲润色、取名、妙笔顾问、封面画面描述、建书规划、榜单解读、灵感、竞品拆解、选中文本处理、续写补全、逐章写作和通用小任务。
- 模板按需放在 `packages/document/writing/src/writing-prompt-library.ts`；写作 System Prompt 提供 ID 与用途目录，大模型根据用户目标自主选择是否调用只读 `writing_load_prompt` 加载内容。
- 删除来源中特定应用依赖的 `{{JSON形状}}` 等程序占位符和无法映射至 LFAA 的 JSON 字段；使用 LFAA 当前提供的文本上下文、大纲与当前章节工具，不虚构人物卡、分卷字段、批量生成、榜单数据或封面生成功能。
- 榜单分析和竞品拆解严格依据用户提供的数据/原文；设定扩写将新增想法标为建议；文档内容与已加载提示词都不覆盖系统规则、用户目标或工具权限。
- 仅明确要求保存时调用当前作品的大纲或当前章节工具；建议、分析、样稿及模板加载保持只读。

### 变更文件

- `H:/LFAA/packages/document/writing/src/writing-prompt-library.ts`：定义 14 个经 LFAA 业务边界改写的只读写作模板。
- `H:/LFAA/packages/document/writing/src/prompts.ts`：向写作 System Prompt 加入模板目录及按需读取规则。
- `H:/LFAA/packages/core/tools/src/business-tools.ts`：新增写作专用只读 `writing_load_prompt` 工具并将其限制在 Writing App。
- `H:/LFAA/packages/core/agent-loop/src/execute-turn.ts`：在 AI Work 活动记录中标示提示词加载。
- `H:/LFAA/packages/preset/agent-preset/src/builtin-catalog.ts`、`H:/LFAA/packages/preset/agent-preset/package.json`：将 Prompt 名称和用途登记为 Writing App 内置 AI 扩展元数据，并声明提示词库工作区依赖。
- `H:/LFAA/docs/系统总体架构.md`：记录内置写作提示词的位置、只读加载边界与能力范围。
- `H:/LFAA/docs/PROMPTS.md`：记录任务合同、配置盘点、变更职责和验证结果。

### 实际验证

- `pnpm --filter lfaa-document-writing run build`、`pnpm --filter lfaa-tools run build`、`pnpm --filter lfaa-agent-loop run build` 均通过；产物分别位于根目录 `dist/packages/document/writing/`、`dist/packages/core/tools/`、`dist/packages/core/agent-loop/`。
- `pnpm exec tsc --noEmit --pretty false -p tsconfig.host.json` 通过；目标变更文件的 `git diff --check` 通过。
- 构建产物检查确认提示词库、System Prompt、工具与 Agent Loop 输出均在根目录 `dist/`；未运行自动化测试、Provider 模型调用或浏览器交互。

## LFAA-DOMAIN-PROMPT-INTEGRATION-01

### 用户目标

将 `docs/mc提示词/` 与 `docs/小说提示词/` 中的项目提示词结合 LFAA 当前能力，接入对应 AI Work，使模型能按任务读取并遵循领域指引。

### 设置中心配置盘点

- Minecraft 与 Writing 沿用“AI 与模型”中的活动 Provider、模型和推理参数，以及账户级 AI Runtime 请求/输出/工具预算；提示词不重复配置模型温度、Token 上限或调用预算。
- 工具执行继续由当前应用上下文和“用户与权限”中的项目权限模式控制；Minecraft EULA 仍由用户在常规界面单独同意，提示词加载只读且不改变工具风险。
- 沿用 Plugins 启用偏好控制扩展注入；核心 Minecraft System Prompt 与应用专属只读提示词工具不受该开关关闭。项目权限模式仍决定副作用工具的审批行为；不增加设置字段、存储、API 或设置界面，因此无需新增外观映射。
- 现有 AI Runtime 请求、输出和工具预算继续生效；Minecraft 业务服务读取的 `commandTimeoutSeconds`、`minecraftReadyTimeoutSeconds`、`minecraftStopTimeoutSeconds` 保持由设置权威值控制，领域提示词不写死时限。

### 当前合同

- Minecraft 目录的 16 份 Markdown 提示词整理为 `packages/games/minecraft` 中的领域模板；Minecraft AI System Prompt 载入总控规则并提供模板目录，模型按任务通过只读 `minecraft_load_prompt` 加载专项提示词。该工具仅属于 Minecraft 应用，不执行 Minecraft 操作。
- 专项提示词的指引必须映射到当前 Minecraft 业务服务与 Daemon 能力：官方 Vanilla、Java 环境、实例与 EULA、启停/重启、已就绪实例的单行控制台命令、受支持 `server.properties` 字段、按实际回报诊断节点执行能力、真实任务恢复、日志分析和停止中世界备份。不得用 Shell 或通用文件工具绕过当前业务校验、权限和实例状态保护；不把 OS 沙盒能力写成普遍前提或未经节点报告的事实。
- 小说目录的 14 份 Markdown 对应现有 14 个写作模板；复用 `packages/document/writing/src/writing-prompt-library.ts` 与只读 `writing_load_prompt`，按来源补齐创作方法但保留当前纯文本上下文及大纲/当前章节写入合同，不另建重复库。
- 丢弃来源中依赖其他应用的 JSON Schema、动态占位符和不存在的数据字段；提示词不得宣称 LFAA 已接入批量生文、榜单抓取、封面生图、作品设定卡/故事线数据库或任意文档文件编辑。分析、润色、建议和样稿保持只读，写入仍需用户明确要求、真实业务工具成功及现有权限流程。
- `docs/小说提示词/嘉兴放射性贝壳.dwg` 是非提示词二进制文件，不纳入 AI 提示词库；保留两个源目录，不在运行时读取仓库文档路径。

### 允许修改

- `packages/games/minecraft/src/minecraft-prompt-library.ts`、`packages/games/minecraft/src/prompts.ts`：定义 Minecraft 领域模板及 AI System Prompt。
- `packages/games/minecraft/src/index.ts`、`packages/games/minecraft/package.json`：导出领域 Prompt 并声明需要的包依赖（仅在实现需要时修改）。
- `packages/core/tools/src/business-tools.ts`：增加仅供 Minecraft App 调用的只读 Prompt 加载工具。
- `packages/core/agent-loop/src/runtime.ts`、`packages/core/agent-loop/src/execute-turn.ts`、`packages/core/agent-loop/package.json`：装配 Minecraft System Prompt、显示 Prompt 加载活动并声明直接依赖。
- `packages/preset/agent-preset/src/builtin-catalog.ts`、`packages/preset/agent-preset/package.json`：登记 Minecraft Prompt 元数据。
- `packages/document/writing/src/writing-prompt-library.ts`：按本次小说源稿补齐/校准现有 14 个模板，不新增重复 ID 或来源应用专属结构。
- `docs/系统总体架构.md`、`docs/PROMPTS.md`：同步当前 AI Prompt 归属、按需读取、安全和能力边界以及验证记录。

### 禁止修改

- 不改变设置中心已有 Provider/模型、推理参数、运行预算、Plugins、权限模式及其默认值、映射、校验或持久化；不把 Plugins 开关当作核心领域提示词工具的总开关。
- 不新增前端 Prompt 管理界面、可编辑 Prompt 存储、HTTP 接口、数据库表、外部下载或运行时读取绝对路径。
- 不新增或虚构 Minecraft Runner、文件访问、写作数据结构、图片生成、市场榜单数据或批量生成能力；不改变审批、Minecraft EULA、实例路径、Daemon 或 Sandbox Host 合同。
- 不修改或删除用户提供的 `docs/mc提示词/`、`docs/小说提示词/` 源稿与其他既有工作区内容。

### 验收方式

- 静态检查所有来源 Markdown 对应的提示词覆盖、工具应用范围、只读语义及各项当前业务边界；确认 Writing 仍只有既有 14 个模板。
- 构建 Minecraft、Writing、Tools、Agent Loop 与 Agent Preset 目标包；运行控制端 TypeScript 检查，核对产物仅写入根目录 `dist/`。
- 尝试仓库要求的 `workspace-preflight` 并执行可用的适用 Gate；记录缺少的脚本/门禁。用 `git diff --check` 检查本合同涉及差异；不把构建等同于 Provider、浏览器、真实节点或实际 Minecraft/Writing 工具验收。

### 实际接入与验证记录（2026-09-30）

- Minecraft 的 16 个 Markdown 提示词已整理为 `packages/games/minecraft` 内置模板；AI Work 常驻加载总控，并以仅限 Minecraft App 的只读 `minecraft_load_prompt` 按需加载专项内容。模板覆盖当前真实服务工具，包括启动、停止、安全重启、已就绪实例单行控制台命令、Java、EULA、配置、日志、任务和备份；控制台命令与操作系统 Shell 明确区分。实际执行前置条件按业务服务与节点本轮真实回报处理，不把 OS 沙盒描述为通用前置或既成事实。
- 小说 14 个来源文件映射到 Writing 已有 14 个模板，没有建立第二套库。模板保留现有文本上下文和大纲/章节写入工具边界，并删去其他产品专属结构及无法核实的数据需求。`嘉兴放射性贝壳.dwg` 未纳入提示词。
- 本次涉及的 Minecraft、Writing、Tools、Agent Loop、Agent Preset 五个包均没有 `README.md`；领域归属与接入合同记录在架构文档和本任务合同中。
- 设置中心沿用活动 Provider/模型、AI Runtime 预算、项目权限模式和 Minecraft EULA 人工确认；领域提示词不改变这些设置。`plugins.enabled` 只控制扩展注入，核心 System Prompt 与内置只读提示词工具仍可用。Minecraft 执行超时使用设置中的权威值，本任务未更改任何设置或界面。
- 本次文件职责：`H:/LFAA/packages/games/minecraft/src/minecraft-prompt-library.ts` 定义 Minecraft 模板；`H:/LFAA/packages/games/minecraft/src/prompts.ts` 装配总控与目录；`H:/LFAA/packages/core/tools/src/business-tools.ts` 提供应用限定的只读加载工具；`H:/LFAA/packages/core/agent-loop/src/runtime.ts` 接入系统提示词；`H:/LFAA/packages/core/agent-loop/src/execute-turn.ts` 显示加载活动；`H:/LFAA/packages/core/agent-loop/package.json`、`H:/LFAA/packages/preset/agent-preset/package.json` 与 `H:/LFAA/pnpm-lock.yaml` 声明直接依赖；`H:/LFAA/packages/preset/agent-preset/src/builtin-catalog.ts` 登记提示词元数据；`H:/LFAA/packages/document/writing/src/writing-prompt-library.ts` 校准既有小说提示词；`H:/LFAA/docs/系统总体架构.md` 记录提示词归属；`H:/LFAA/docs/PROMPTS.md` 登记合同与验证。
- Minecraft、Writing、Tools、Agent Loop、Agent Preset 五个目标包分别使用 `node ../../../scripts/build-harness.mjs package` 构建，成功，产物位于根 `dist/packages/`；Minecraft 两个提示词源文件的独立严格 TypeScript 检查通过。`git diff --check` 通过。覆盖核对为 Minecraft 源稿/模板 16/16、Writing 源稿/模板 14/14。
- `node node_modules/typescript/bin/tsc --noEmit --pretty false -p tsconfig.host.json` 未通过：当前未跟踪并行文件 `packages/games/minecraft/src/core-sources.ts:152` 报 TS2375，`loaderArtifact` 可能为 `undefined`，不属于本提示词改动。`scripts/workspace-preflight.mjs` 不存在，尝试运行时返回模块缺失；根 `package.json` 有通用 build/test 命令，但没有 workspace-preflight 或专用质量/发布 Gate。未运行自动化测试、Provider 模型调用、浏览器操作或真实 Minecraft/Writing 业务执行；这些环境验收仍未确认。工作区内已有其他并行修改保留，未并入本任务清单或清理。

## LFAA-PERFORMANCE-ROOT-CAUSE-01

### 用户目标

定位设置中心乃至整个 LFAA 项目普遍卡顿的实际原因，并基于性能证据修复根因；不得将问题预设为单个弹窗或单条 CSS 规则。

### 设置中心配置盘点

- 排查并尊重已有主题、界面/内容字体及字号、强调色、壁纸与遮罩透明度、玻璃模糊、减少动态效果等设置及其前端映射、持久化。
- 本任务不新增或修改设置字段、默认值、映射及持久化；不得为性能优化擅自移除用户可见的外观效果。

### 当前合同

- 先检查当前开发服务和日志，再取得浏览器页面、控制台、网络请求与交互性能轨迹；对设置页和工作台其他页面做对照。
- 依据主线程长任务、帧耗时、React 提交/重复渲染、CSS 布局与合成、资源加载及持续请求等证据判断瓶颈，并区分用户当前运行版本与工作树代码。
- 只有定位到可复现且有证据的根因后才修改实现；保留主题、毛玻璃、模糊、动效和用户偏好，除非性能轨迹证明特定效果造成问题且修复遵循现有设置合同。
- 先前移除模型服务商弹窗遮罩模糊属于误判，已恢复原 CSS；不得将其描述为本次问题的根因或修复。

### 允许修改

- 运行时性能检查所需的只读操作；仅可在根因证据明确后修改直接相关的代码、设置映射或文档。
- `docs/PROMPTS.md`：登记调查范围、证据、根因、精准修复和实际验证结果。

### 禁止修改

- 不以单个弹窗的 CSS 成本代替全项目排查；不因主观判断删除用户可见效果或关闭现有动效。
- 不改与已证实根因无关的业务、权限、数据和设置；不新增假数据、永久排查接口或无关依赖。
- 不部署、发布、上传或提交 Git。

### 验收方式

- 获得可用的运行日志和浏览器性能证据，记录卡顿期间的帧耗时、主线程工作或渲染成本，并覆盖设置页与另一个工作区页面。
- 根因修复后在同一环境、同一交互路径复测；运行匹配改动范围的构建/检查，并准确记录无法执行的门禁。
- 若登录环境或浏览器测量不可用，明确说明具体阻塞和未确认项，不把静态检查称为全局性能修复。

### 调查记录（2026-09-30）

- 用户纠正范围后，已恢复 `packages/client/ui-settings/src/SettingsPage.css` 中 `.settings-ai-provider-modal .ant-modal-mask` 原有 `blur(10px)`、WebKit 前缀、遮罩颜色和中文注释；此前的单弹窗改动不再存在。
- 最初本机 3000/5173 均无监听。排查期间错误绕过项目启动入口，直接启动了 `apps/web` 的 Vite 5173；浏览器只显示控制端未启动提示，没有挂载登录后的设置页/工作区，无法据此测量用户报告的卡顿。已停止自己启动的 Vite 并关闭临时标签页；不把该次结果当作目标运行版本证据。
- 第一轮源码检索发现 UI 中存在由外观设置控制的背景模糊效果；不能据此判断全局卡顿根因，也不删除这些外观效果。此前 Web TypeScript 构建受工作区 Minecraft/Writing 未提交改动阻塞；须区分该构建问题与运行时性能问题。
- 当前身份核对：工作目录与唯一 Git worktree 都是 `H:\LFAA`（`main`）；`H:\lfaa\lfaa` 不存在，根目录也没有 `frontend/` 源码目录；3000/5173 均无监听。因此没有本机第二个 LFAA checkout 或抢端口进程的证据。
- 当前源码的正式 `lfaa web` 启动会令控制端在默认 3000 同源服务 `dist/apps/web`；但根目录 `pnpm dev`/Tauri 开发配置仍启动并使用 Vite 5173，控制端 API 默认 3000。用户指出其当前目标入口是 3000；这与当前 checkout 的开发入口配置有冲突，现有证据不足以判断是代码/文档落后还是目标运行版本来自另一环境。
- 当前没有认定根因，调查继续；工作区内其他并行未提交改动保持原样。

## LFAA-SETTINGS-MINECRAFT-OWNER-01

### 用户目标

“AI 与模型”的推理参数不得混入 Minecraft 领域默认值和执行配置。将 Minecraft 运行配置放到独立“Minecraft 配置”入口，并从 AI Runtime 持久化分类拆开。

### 设置与数据归属

- AI Runtime 保留输出策略/Token 上限、Provider 请求超时、子 Agent 账户/预算、模型与工具预算、提示词建议、真实上下文用量显示，以及供 AI 节点命令使用的命令时限。
- Minecraft Runtime 单独保存默认内存、执行方式、默认核心、Java/基岩端口、下载/安装/就绪/安全停服时限。继续保持现有账户范围、默认值和已保存值；该配置由 Minecraft 业务服务读取，面板与 Minecraft AI Work 共用。
- Minecraft 实例/节点存储目录仍归既有 Minecraft 存储 Owner，本任务不改数据范围、路径、API 或已有实例。
- 从旧 `ai-runtime` JSON 记录迁移 Minecraft 字段到新 `minecraft-runtime` 分类；迁移必须原子、可重复、不覆盖已迁移的新值，且先保存新分类再清理旧键。旧版已打开的客户端若仍随 AI Runtime 提交旧字段，应兼容拆分，不能丢设置。

### 当前合同

- 新增设置中心“Minecraft 配置”分类；“AI 与模型 / 推理参数”仅呈现 AI/Agent Runtime 设置。保留现有 SettingGroup 与 SettingRow 布局、主题和视觉令牌。
- 为新分类补齐服务端类型、默认值、校验、读写分类、客户端 API 映射；Minecraft 领域服务读取唯一 Minecraft Runtime 配置 Owner，不保留对 `aiRuntime.minecraft*` 的引用。
- 不更改默认值、账户作用范围、AI 推理字段、AI 密钥/账户合同、Minecraft 实例快照语义、权限/认证或节点任务行为。

### 允许修改

- `packages/settings/settings/src/service.ts`、`packages/storage/storage-domain/src/configuration.ts`、`packages/api/remotes/src/route-contracts.ts`、`packages/api/settings-controller/src/index.ts`：独立类型与分类、校验、账户旧值迁移及保存接口。
- `packages/client/connection/src/api.ts`、`packages/client/ui-settings-general/src/default-settings.ts`、`packages/client/ui-settings/src/SettingsPage.tsx`：分类映射、默认值、独立导航入口及设置控件归属。
- `packages/games/minecraft/src/service.ts`、`packages/games/minecraft/src/deployment-service.ts`、`packages/client/ui-minecraft/src/MinecraftWorkspace.tsx`、`packages/client/ui-minecraft/src/MinecraftDeploymentPanel.tsx`：Minecraft 服务和面板读取同一 Runtime 配置。
- `apps/cli/tests/execution-control.test.mjs`、`apps/cli/tests/minecraft-multicore.test.mjs`、`apps/cli/tests/minecraft-live-deployment.test.mjs`：旧值拆分、配置消费的相关回归。
- `packages/games/minecraft/README.md`、`docs/系统总体架构.md`、`docs/harness-storage.md`、`docs/execution-control.md`、`docs/minecraft-deployment-plan.md`、`docs/PROMPTS.md`：同步配置 Owner、归属、迁移和验收记录。

### 禁止修改

- 不重置已有账户配置，不改变用户/管理员范围、不迁移实例目录、不删除实例数据、不更改运行任务中的已保存时限快照。
- 不复制 AI 或 Minecraft 设置到第二套控制器/字段；不重排设置中心既有总体布局，不新增 CSS 令牌、外部依赖或无关功能。
- 不提交、发布或部署。

### 验收方式

- 静态检查新的 AI Runtime 类型与前端映射不含 Minecraft 运行字段；AI 页面不再出现 Minecraft 参数；服务端只对旧客户端显式兼容已知 Minecraft 字段并在保存时拆分；Minecraft 领域所有读取集中到 `minecraftRuntime`，无旧代码引用。
- 对含旧字段、已有独立 Minecraft 分类、重复运行以及旧客户端提交旧字段的迁移路径作回归验证，确认字段值不丢、不覆盖、账户隔离不变。
- 构建直接受影响的 Settings、API、Client 与 Minecraft 包，并执行 `git diff --check`；报告浏览器页面与真实数据库升级验收是否完成。

### 实现与验证记录

- “AI 与模型 / 推理参数”只展示 AI Runtime 配置；新增“Minecraft 配置”账户分类和独立页面。Minecraft 面板、自动开服服务及 Minecraft AI Work 均读取 `minecraftRuntime`。进入 Minecraft 配置页时才读取核心目录，不在 AI 页面额外请求。
- 旧账户 `ai-runtime` 中的 Minecraft 字段在设置服务启动时通过配置事务搬到 `minecraft-runtime`，先写入新分类再清理旧键；已存在的新分类优先。旧版仍开着的客户端提交时，仅接收白名单中的旧字段并拆分保存。字段默认值、账户范围和已有 Minecraft 业务行为未改变。
- 相关包构建通过：`lfaa-settings`、`lfaa-storage-domain`、`lfaa-api-remotes`、`lfaa-api-settings-controller`、`lfaa-client-connection`、`lfaa-client-ui-settings-general`、`lfaa-client-ui-settings`、`lfaa-client-ui-minecraft`、`lfaa-games-minecraft`；能力包产物在根 `dist/packages/`。
- `pnpm run build:web` 通过，Vite 产物在根 `dist/apps/web/`；`pnpm run build:control-plane` 通过，产物在根 `dist/apps/control-plane/`；`pnpm --filter @yubboo/lfaa typecheck` 通过。
- `pnpm --filter @yubboo/lfaa exec node --import tsx --import ./register-package-loader.mjs --test tests/execution-control.test.mjs tests/minecraft-multicore.test.mjs tests/minecraft-live-deployment.test.mjs`：16 项通过、0 失败、真实 EULA/联网部署验收 1 项按约定跳过。执行控制回归使用隔离临时数据，覆盖旧值迁移、已有新分类优先、账户隔离、保存拆分和任务读取。
- 静态检索未发现 `packages/` 下的 `aiRuntime.minecraft*` 读取；`git diff --check` 通过。AI 前端类型不含 Minecraft 字段；API 仅为旧客户端边界兼容已知字段。
- 浏览器和现有生产数据尚未实测。本机 `127.0.0.1:3000` 正由 PID 35176 的 `node apps/cli/bin/lfaa.mjs "web"` 提供服务；构建后没有重启该进程。生产数据迁移仅在启用新控制端代码时执行，当前验证来自隔离临时数据库回归；不把构建和临时数据测试表述为已上线或浏览器验收。

## LFAA-UI-APP-CENTER-POLISH-01

### 用户目标

优化应用中心的布局与视觉层级，让通用任务入口、应用卡片和服务状态更容易识别，同时保留 LFAA 现有应用与工作模式行为。

### 设置中心配置盘点

- 页面继续读取 `UserSettings.appearance` 已有设置：主题、强调色、字体和字号、对比度、`backgrounds.appCenter`、背景遮罩透明度、模糊和减少动态效果；样式必须继续通过 `.workbench-shell` 的现有 CSS 映射消费，不新增主题或视觉配置。
- 应用卡片仍读取 `general.defaultMode` 决定默认模式按钮；控制端状态仍遵循 `general.showServiceStatus`。不改设置字段、默认值、映射或持久化。

### 当前合同

- `/` 应用中心采用紧凑欢迎区：标题和说明在左，现有“开始通用任务”按钮与其同排呈现；保留 `/tasks` 目标。
- SteamCMD、Minecraft、写作三张卡片仍是页面主体；保留各自文案、真实接入状态、上次打开标记、常规模式与 AI Work 按钮及其路由/回调语义。只调整卡片视觉密度与可读性，不制造新的应用能力或状态。
- 移除卡片下方重复的控制端状态横幅；顶栏状态及其 `showServiceStatus` 控制继续作为应用中心唯一的服务状态入口。
- 保留现有三列、双列、单列响应式断点与自然滚动；双列时第三张卡片居中，单列时保持满宽。保留键盘可访问性和全局用户外观设置；不引入新依赖、图片、计时器、观察器或额外动画。

### 允许修改

- `packages/client/ui-layout/src/Workbench.tsx`：调整应用中心标题区、通用任务按钮和重复状态横幅。
- `packages/client/ui-layout/src/workbench.css`：调整应用中心标题、卡片与状态相关样式。
- `packages/client/ui-theme/src/responsive.css`：同步应用中心紧凑标题区和卡片的窄屏适配。
- `docs/PROMPTS.md`：维护本任务合同与完成记录。

### 禁止修改

- 不改变登录、导航、应用卡片路由、常规模式/AI Work 切换、应用选择偏好或业务服务/API。
- 不调整设置中心布局，不新增或重置设置值，不绕开现有主题、壁纸、遮罩透明度、模糊和减少动态效果映射。
- 不修改与应用中心无关的工作区、页脚、顶部导航或状态实现；不提交、发布或部署。

### 验收方式

- `pnpm --filter lfaa-web run build`：确认 Web TypeScript 与 Vite 构建；产物仅写入根目录 `dist/apps/web/`。
- 执行本次目标文件 `git diff --check`，静态核对应用卡片、任务路由、默认模式和服务状态设置语义未变，以及 1050px/720px 响应式断点、双列末卡居中、单列满宽和自然滚动仍生效。
- 检查浅色/深色、字体字号、强调色、应用中心壁纸、遮罩透明度和模糊仍由已存设置控制；浏览器登录态目视及帧时间验收须单独报告，不能由构建代替。

### 实现与验证记录（2026-10-01）

- 欢迎区收紧为同排标题、说明和“开始通用任务”入口；保留 `/tasks` 导航。应用卡片高度、图文间距和状态文字对比度调整；双列时第三张卡片居中、单列时恢复满宽。
- 移除卡片下方重复的服务状态横幅；状态仍由顶栏现有 `general.showServiceStatus` 控制。三张应用卡片、真实接入文案、上次打开标记、常规模式和 AI Work 行为及 `general.defaultMode` 均保留。
- 标题表面使用主题色令牌；有应用中心壁纸时继续读取既有遮罩透明度与模糊值。字号、强调色、主题和对比度继续消费现有工作区令牌，没有修改用户设置字段或默认值。
- `pnpm --filter lfaa-web run build` 通过，包含 TypeScript 检查与 Vite 构建；产物写入根目录 `dist/apps/web/`。四个本任务文件的 `git diff --check` 通过。
- 在已登录的 `http://127.0.0.1:3000/` 页面目视检查：1280×800 为三列；默认窄桌面宽度为双列且第三卡居中；390×844 为单列，应用内容无横向溢出。检查后恢复默认视口。浏览器显示当前账户已有的深色主题、强调色与应用中心壁纸；未更改并轮换账户偏好来测试浅色、字体、遮罩和模糊的每个选项，也未测帧时间。
- `packages/client/ui-layout/README.md` 与 `docs/DEVELOPMENT.md` 不存在；按实际存在的 `开发规范.md`、`docs/系统总体架构.md` 与当前仓库 `AGENTS.md` 执行。仓库中没有 `workspace-preflight` 脚本或 quality/release 命令；未运行无关自动化测试。

## LFAA-UI-SETTINGS-RESPONSIVE-01

### 用户目标

修复设置中心在工作台窄中间区或分屏浏览器中的拥挤、卡片列数不合适和控件挤压问题；在桌面宽区、窄栏与移动布局下保持清晰可读及正常滚动。

### 运行入口、Owner 与配置

- Web 入口：`pnpm --filter lfaa-web run build`；用户当前页面为 `/settings?section=ai`。
- 页面与布局 Owner：`packages/client/ui-settings/src/SettingsPage.tsx` 提供设置分类和 `.settings-main` 滚动正文；`packages/client/ui-settings/src/SettingsPage.css` 拥有设置页面布局与各类卡片/表单网格；`ResizableWorkbench` 拥有侧栏和中间区宽度。
- 仅按 `.settings-main` 实际可用宽度适配内容，不根据整个浏览器窗口宽度猜测中间区大小；保留分类顺序、可调侧栏、滚动和现有交互。
- 继续使用已接入的设置中心外观配置与共享令牌：主题、强调色、界面字体与字号、对比度、壁纸、遮罩透明度、模糊和减少动态效果；本任务不增加或修改设置字段、默认值、持久化和映射。

### 允许修改

- `packages/client/ui-settings/src/SettingsPage.css`：设置正文容器响应式布局、设置行/控件网格和服务商卡片网格。
- `packages/client/ui-settings/src/SettingsPage.tsx`：在菜单收起时为现有展开按钮提供独立的全宽固定栏容器，不改菜单状态归属与交互。
- `docs/PROMPTS.md`：登记本合同和完成验证记录。

### 禁止修改

- 不重排设置分类或设置项，不改业务行为、Owner、路由、数据/API、侧栏持久化和可调行为。
- 不新增设置字段、依赖、图片资源、观察器或额外动画；不写死并绕过用户外观设置。
- 不调整与设置中心无关的工作区或业务页面样式。

### 验收条件

- 服务商卡片列数按正文容器宽度切换，设置行与复杂控件在空间不足时纵向排列；菜单收起状态下的固定展开栏清晰且不压住滚动内容。
- 保留中间区自然滚动、横向无溢出、设置分类和业务交互；外观主题与令牌来源不变。
- 执行 Web 构建和目标差异检查；在可用的已登录页面中缩放/收窄工作台中心区，检查桌面宽区、窄区和移动区；单独报告浏览器目视和帧时间验收范围。

### 实现与验证记录（2026-10-01）

- `SettingsPage.css` 为 `.settings-main` 设置命名 inline-size 容器；供应商、主题和工作台布局卡片按正文宽度在三列、两列、单列间切换。窄栏下设置行与快捷键行纵向排列，Provider 状态标签移至卡片内容下方，外观字段和账户筛选允许换行。
- 设置正文左右留白改用中间窗格宽度的 4% 并限制在 14px 到 52px；保留滚动和现有视口断点。未调整设置项顺序、工作台行为或用户配置字段。
- 沿用 `appearance.theme`、`accentColor`、`sidebarColor`、`backgrounds.settings`、`overlay`、`blur`、`advanced.fonts`、`interfaceFontSize`、`codeFontSize`、`contrast` 与 `reducedMotion` 的现有映射；`Workbench.tsx` 仍是主题、字体字号、对比度、设置壁纸及遮罩/模糊令牌的来源。本次没有改动或重置这些设置；登录页实测保留账户当前深色主题和强调色。未轮换偏好逐项测试浅色主题、各字体和遮罩/模糊取值。
- `pnpm --filter lfaa-web run build` 通过（TypeScript 与 Vite）；产物位于根目录 `dist/apps/web/`。根据用户截图复验默认 1003px 分屏：设置导航展开时正文宽 688px、服务商区域宽 631px，为两列，设置行为单列；收起导航时正文宽 929px、服务商区域宽 852px，固定菜单栏贴齐滚动视口顶部（y=0），仍为两列。另测 1280px 视口/正文宽 1206px 为两列，1600px/正文宽 1526px 为三列，560px/正文宽 486px 为单列且设置行单列。上述页面与正文均无横向溢出；测试后已重置视口、恢复 `/settings?section=ai` 和设置导航展开状态。未测帧时间。
- `git diff --check -- packages/client/ui-settings/src/SettingsPage.css packages/client/ui-settings/src/SettingsPage.tsx docs/PROMPTS.md` 通过。未运行额外自动化测试。
- 已读取 `开发规范.md`、`docs/系统总体架构.md`、`docs/开发计划.md` 与 `AGENTS.md`；`docs/DEVELOPMENT.md`、`docs/ARCHITECTURE.md`、`docs/PROJECT_PLAN.md` 及 `packages/client/ui-settings/README.md` 不存在。仓库中未找到 `workspace-preflight` 脚本。

## LFAA-UI-MINECRAFT-DEPLOYMENT-01

### 用户目标与复现

按用户更正，优化范围是 Minecraft 常规模式“部署”整页，需重新规划整体布局和操作流程，而非只修下拉控件。现有页面把页面标题、部署表单和历史记录分散在两个等宽卡片中；长表单缺少字段分组，部署按钮和 EULA 混在字段网格底部，窄工作区阅读/提交层级不清。原核心选择弹层约高 264px，部署导航焦点提示不明显。

### 运行入口、Owner 与设置盘点

- Web 入口：`pnpm --filter lfaa-web run build`；页面 `/apps/minecraft/normal/deployment`。
- 页面容器与部署记录 Owner：`packages/client/ui-minecraft/src/MinecraftWorkspace.tsx`；整页、表单、响应式样式 Owner：`packages/client/ui-minecraft/src/MinecraftWorkspace.css`；表单状态与正式 provision API Owner：`packages/client/ui-minecraft/src/MinecraftDeploymentPanel.tsx`。
- 应用二级导航 Owner：`packages/client/ui-workspace/src/module-workbench.css`，导航按钮与路由语义由 `ApplicationWorkspace.tsx` 负责。
- 表单使用 `settings.minecraftRuntime.minecraftDefaultCore`、`minecraftExecutionMode`、`minecraftDefaultMemoryMb`、`minecraftDefaultPort`、`minecraftBedrockDefaultPort`；外观沿用 `appearance.theme`、`accentColor`、`advanced`（字体、字号、对比度、减少动态效果）和 `backgrounds.minecraft`、`overlay`、`blur`。不新增/重置字段，继续从 `.module-center__content` 实际可用宽度做容器响应式。
- 验收边界：整页标题/描述、配置分组、运行边界/EULA/提交动作、历史记录层级和宽窄布局；不得提交部署。

### 允许修改

- `packages/client/ui-minecraft/src/MinecraftDeploymentPanel.tsx`：重排现有核心/节点、版本/构建、实例参数、运行边界与 EULA/提交区；保留真实目录、用户输入、校验和 onSubmit 行为。
- `packages/client/ui-minecraft/src/MinecraftWorkspace.tsx`：调整部署记录的呈现结构与容器 class，不改记录来源及其业务动作。
- `packages/client/ui-minecraft/src/MinecraftWorkspace.css`：部署页整体布局、分组层级、记录卡片和容器响应式样式。
- `packages/client/ui-workspace/src/module-workbench.css`：部署导航沿用本任务已做的强调色活动态和键盘焦点反馈。
- `docs/PROMPTS.md`：本合同和实现/验证记录。

### 禁止修改

- 不改部署 API、状态 Owner、路由、核心/版本目录、字段值/默认配置、EULA 明确同意要求及现有任务/部署记录语义。
- 不触发下载、创建实例、开服或任何真实节点操作；不新增设置字段、依赖、假数据或与页面无关的业务功能。
- 不覆盖主题、强调色、字体/字号、对比度、Minecraft 壁纸/遮罩/模糊及减少动态效果设置；不重排 Minecraft 其他页面。

### 验收条件

- 部署页视觉层级清楚：选择来源、版本构建、实例参数、执行边界与 EULA/提交区一眼可区分；主要提交动作位置稳定，历史记录清晰且不与长表单争夺主层级。
- 以 `.module-center__content` 实际宽度适配：桌面宽区可并排展示表单与记录；收窄后切为单列；表单字段继续按可用宽度重排，无横向溢出，保留自然滚动。
- 核心列表限高后仍可搜索、分类浏览和滚动；导航整行命中及激活语义不变，键盘焦点清楚。
- 已登录浏览器检查宽区和当前窄工作区的实际页面；检查菜单、字段、EULA、提交按钮及记录，没有触发部署或改动持久状态。
- 执行 Web 构建和目标差异检查；记录布局/交互证据。没有帧时间测量时不得声称通过帧性能验收。

### 实现与验证记录

- `MinecraftDeploymentPanel.tsx` 将表单整理为“服务端来源、版本与构建、实例参数、执行与许可”四组；EULA 与主提交按钮独立成提交区，显示提交条件提示。所有控件继续读写原有状态并走原有 provision API；核心弹层保留 200px 列表视窗。
- `MinecraftWorkspace.tsx` 将部署记录标题、数据来源提示、状态与操作整理为清晰层级；记录内容仍来自原部署、任务、实例和节点集合，重试/创建实例/打开实例调用不变。
- `MinecraftWorkspace.css` 按 `.module-center__content` 实际宽度布局：宽区主表单与记录按约 1.5:1 并排，记录卡在主栏滚动时保持可见；宽度收窄后改为单列，560px 以下表单字段、提交区与记录状态纵向排列。保留工作台自然滚动及共享主题令牌，没有增加动画、图片或 CSS 自定义属性。
- 已登录浏览器实测 1600×1000 视口（工作区 1295px）：表单/记录列宽约 725/483px，滚动表单时记录卡保持在视口上方；1003×905（工作区 698px）布局切单列；800×900（工作区 495px）表单字段和提交区单列，EULA/按钮/记录均可向下滚动访问。三种布局均无横向溢出，结束后已重置视口和滚动位置。
- 重排后的核心菜单实测列表视窗 200px、弹层总高约 208px、目录可滚高度 704px；滚动到 Vanilla/代理/基岩分类后关闭，当前 Paper 未变化。部署菜单键盘焦点沿用共享强调色轮廓。
- 设置中心配置盘点与实际消费：`minecraftRuntime.minecraftDefaultCore`、`minecraftExecutionMode`、`minecraftDefaultMemoryMb`、`minecraftDefaultPort`、`minecraftBedrockDefaultPort`，以及 `appearance.theme`、`accentColor`、`advanced`（字体/字号/对比度/减少动态效果）、`backgrounds.minecraft`、`overlay`、`blur`。没有新增、重置或持久化设置字段；当前深色主题、壁纸和强调色保持原样。
- `pnpm --filter lfaa-web run build` 通过（TypeScript 与 Vite），构建产物位于根目录 `dist/apps/web/`；浏览器控制台未发现 error；`git diff --check` 对本任务跟踪文件通过。未测帧时间、浅色主题/其他字号组合及真实 Minecraft 部署；没有触发 EULA、下载、节点或部署操作。

## LFAA-UI-MINECRAFT-CORE-LIBRARY-01

### 用户目标

按用户提供的服务端资源库参考图，将 Minecraft 部署页中间内容区的核心选择操作改为资源库式布局：左侧按现有核心分类导航，右侧以卡片选择具体核心分支和 Minecraft 版本。用户进一步指出普通开服不应被“选择具体构建”打断；实现修订为自动采用核心目录返回的首个可用下载工件，普通流程不展示工件列表，只在可展开技术信息中显示真实上游标识。保留 LFAA 工作台外围导航，不把参考站的浏览器下载确认流程复制为新能力。

### 运行入口、Owner 与设置盘点

- Web 入口：`pnpm --filter lfaa-web run build`；页面 `/apps/minecraft/normal/deployment`；浏览器验收只浏览和改变表单选择，不提交部署。
- 核心/版本表单状态、分类核心目录读取和现有 provision 提交由 `packages/client/ui-minecraft/src/MinecraftDeploymentPanel.tsx` 负责；该 UI 自动取目录首个工件作为默认项，不提供手选列表。目录数据来自 `packages/client/connection/src/api.ts` 对接的 Minecraft 核心领域接口，工件解析与下载摘要校验归 `packages/games/minecraft/src/core-sources.ts` 及其部署服务。部署历史、节点状态、权限和任务状态仍由 `MinecraftWorkspace.tsx` 及其既有领域 API 管理。
- 仅简化当前核心面板，不新增目录请求、下载 API、校验协议、部署状态、设置字段或状态 Owner。分类、核心和版本卡片使用真实目录；自动匹配沿用现有加载和过期响应撤销逻辑，只读取默认工件所在的首批结果。
- 保留设置中心当前值：`minecraftRuntime.minecraftDefaultCore`、`minecraftExecutionMode`、`minecraftDefaultMemoryMb`、`minecraftDefaultPort`、`minecraftBedrockDefaultPort`、`minecraftStopTimeoutSeconds`；实例目录继续读取 Minecraft 存储设置的全局默认与目标节点覆盖（`getMinecraftNodeStorageSettings`）。外观沿用 `appearance.theme`、`accentColor`、`advanced`（字体、字号、对比度、减少动态效果）、`backgrounds.minecraft`、`overlay`、`blur` 与共享 CSS 令牌。不得新增、重置或绕过用户设置。
- 权限与副作用边界保持原状：`canOperate`、在线 Windows x64 多核心节点能力、原生执行要求、代理后端约束、EULA 明确同意和现有 `provisionMinecraftServer` 调用不变。

### 允许修改

- `packages/client/ui-minecraft/src/MinecraftDeploymentPanel.tsx`：将普通核心下拉和版本控件改为真实分类导航及核心/版本卡片；自动采用真实构建目录的首项作为下载工件，只提供可展开的工件标识信息，不要求用户选择或翻页挑构建。保留描述、来源错误、节点/实例字段、设置默认值、EULA、校验和提交合同。
- `packages/client/ui-minecraft/src/MinecraftWorkspace.css`：部署页在中间区域改为完整主面板，记录移至其后；增加资源库分类/卡片、自动匹配工件摘要及基于中心区实际宽度的响应式规则。继续使用共享主题/字号令牌，不新增 CSS 自定义属性。
- `packages/client/ui-minecraft/README.md`：更新核心选择界面行为说明。
- `docs/PROMPTS.md`：登记本合同及实际修改和验收记录。

### 禁止修改

- 不改全局导航、Minecraft 二级导航、工作台壳层、设置中心、服务端/节点 API、目录来源、安全校验、数据库、默认值或其他 Minecraft 页面。
- 不引入截图中的示例目录作为运行数据，不写死分类数量/构建成功状态；不新增浏览器下载、文件安全确认、摘要显示或安装绕行操作。
- 不触发 EULA 同意、核心下载、实例创建、部署、启动、重试或任何真实节点操作；不添加临时测试路由、一次性测试代码或新依赖。

### 验收条件

- 桌面宽区显示左侧分类、右侧分支卡片、版本卡片和自动匹配的下载包摘要；中心区变窄后分类可横向浏览/折行、选项卡片收敛为可读列数，无横向溢出。
- 分类、核心和版本选择只写入原有表单状态；切换行为继续加载真实目录工件并自动选择目录首项；显示来源错误和加载状态，工件标识默认收起；初始核心、端口、内存及许可/权限禁用条件保持生效。
- 版本继续增量显示；下载工件不再渲染成手动选择网格，也不为普通流程继续翻页；筛选仅由当前已加载目录本地计算，不增加订阅或后台轮询。
- 执行 Web TypeScript/Vite 构建、目标 `git diff --check`；在当前 Minecraft 部署页检查宽区、分屏中间区和窄区下的结构、滚动、分类切换、版本及自动匹配下载包状态和禁用条件。未测帧时间或真实部署时据实说明。

### 实施记录

- 合同在代码修改前登记，后按用户问题修订默认交互。`MinecraftDeploymentPanel.tsx` 使用真实分类导航、可搜索核心卡片和版本卡片；切换版本自动取核心目录首个可用下载工件，编号默认收起显示，不要求用户在几十个来源工件中手选。节点、名称、端口、内存、代理后端、执行边界、EULA 和提交动作分组保留；所有部署仍经过原有 `provisionMinecraftServer` 与权限、节点、代理、许可校验。
- `MinecraftWorkspace.css` 让资源库占据完整中间列宽，部署记录排在面板后方；宽区按约 0.38:1.62 显示分类栏与资源浏览区，分类栏随右侧资源区等高。中心列收窄到 980px 时转为可横向浏览的分类条，560px 以下实例字段、EULA/提交区及记录操作纵向排布。版本首屏最多显示 24 项并可增量展开；不再渲染工件手选网格或翻页按钮。沿用主题、强调色、字体字号等共享令牌，没有新增 CSS 变量、依赖或目录数据。
- 设置中心配置盘点及消费：`minecraftRuntime.minecraftDefaultCore`、`minecraftExecutionMode`、`minecraftDefaultMemoryMb`、`minecraftDefaultPort`、`minecraftBedrockDefaultPort`、`minecraftStopTimeoutSeconds`；Minecraft 存储设置全局目录默认和所选节点目录覆盖，实际部署路径由领域服务 `getMinecraftNodeStorageSettings` 解析；外观使用 `appearance.theme`、`accentColor`、`advanced`（字体、字号、对比度、减少动态效果）、`backgrounds.minecraft`、`overlay`、`blur` 和工作台共享 CSS 令牌。没有新增、重置或绕过配置。
- `packages/client/ui-minecraft/README.md` 更新核心资源库操作说明。无 CSS 自定义属性变更。
- 实现核对：部署服务读取目标节点的全局默认/节点覆盖目录；Daemon 在该目录下创建以实例名命名的独立目录、下载并校验核心，再写入 `eula.txt`（`eula=true`）、端口配置和 LFAA 实例元数据后启动。常规 Jar 启动由结构化参数数组和 `shell:false` 执行；Java 内存映射为 `-Xms`/`-Xmx`，Java 核心参数按协议追加 `-jar` 与 `nogui`（后者不带连字符）。未设置 `-server`、`UseG1GC` 或 `SurvivorRatio`；Forge/Sponge、代理、Nukkit、PocketMine 使用各自启动协议。
- `pnpm --filter lfaa-web run build` 通过，包含 `tsc --noEmit` 与 Vite production build；构建输出在根目录 `dist/apps/web/`。`git diff --check -- docs/PROMPTS.md packages/client/ui-minecraft/src/MinecraftWorkspace.css` 和两个本轮未跟踪文件的尾随空白检查通过；未运行额外自动化测试。
- 尝试检查当前 `/apps/minecraft/normal/deployment` 浏览器标签，但连接在 CDP `Emulation.setFocusEmulationEnabled` 命令超时，未取得更新后截图。因此没有声称完成浏览器可视验收、真实交互或帧时间测量。未同意 EULA、下载核心、创建实例或触发节点部署。

## LFAA-UI-MINECRAFT-ONBOARDING-01

### 用户目标

- 将 Minecraft 部署操作改为新手可跟随的逐步向导，说明每步要做什么，并在最终步骤统一核对参数、EULA 和执行边界。
- 优化实例列表的查找与常用操作路径；无实例时清楚引导用户检查节点或开始部署。
- 评估参考站的可视化启动脚本在 LFAA Daemon 托管进程架构中的接入方式。

### 运行入口、Owner 与设置盘点

- Web 入口：`pnpm --filter lfaa-web run build`；页面 `/apps/minecraft/normal/deployment` 与 `/apps/minecraft/normal/instances`。
- 部署表单及步骤状态 Owner：`packages/client/ui-minecraft/src/MinecraftDeploymentPanel.tsx`；Minecraft 页面、真实实例/部署/任务数据及实例动作 Owner：`packages/client/ui-minecraft/src/MinecraftWorkspace.tsx`；两页样式 Owner：`packages/client/ui-minecraft/src/MinecraftWorkspace.css`。
- 实例创建仍走现有 `provisionMinecraftServer` 及领域服务；启动/停止仍走现有 `runMinecraftInstanceAction`。不复制目录、EULA、下载、任务进度或进程状态逻辑。
- 部署表单沿用 `minecraftRuntime.minecraftDefaultCore`、`minecraftExecutionMode`、`minecraftDefaultMemoryMb`、`minecraftDefaultPort`、`minecraftBedrockDefaultPort`；实例目录继续由部署领域服务读取全局默认与节点覆盖。外观继续使用 `appearance.theme`、`accentColor`、`advanced`（字体、字号、对比度、减少动态效果）、`backgrounds.minecraft`、`overlay`、`blur` 和工作台共享 CSS 令牌。
- 参考站生成独立 `.bat` / `.sh` 并可复制、下载；LFAA 的 Java 命令由 Daemon 通过结构化 argv 与 `shell:false` 托管，GUI 与崩溃循环也没有当前实例级设置和执行合同。本轮只评估该边界，不新增绕开 Daemon 的外部脚本或伪称持久化的启动编辑器。若继续实现，需要为实例级启动配置建立正式存储、服务校验和 Daemon 执行合同。

### 允许修改

- `packages/client/ui-minecraft/src/MinecraftDeploymentPanel.tsx`：以多步界面组织既有核心/版本、节点/参数、许可/摘要状态；最终仅提交一次现有部署请求。
- `packages/client/ui-minecraft/src/MinecraftWorkspace.tsx`：改善实例空状态、查找/过滤和卡片上的现有启停入口；部署/实例状态和动作仍用现有真实 API。
- `packages/client/ui-minecraft/src/MinecraftWorkspace.css`：新向导和实例列表的层级与实际工作区宽度响应式布局；无新增 CSS 自定义属性。
- `packages/client/ui-minecraft/README.md`、`docs/PROMPTS.md`：更新可用流程、配置边界和实测记录。

### 禁止修改

- 不改服务端、Daemon、数据库、实例字段、启动参数合同、设置类型/默认值或路由；本轮不生成/运行 `.bat`、`.sh`，不增加 JVM 参数、GUI 模式或自动重启。
- 不改其他 Minecraft 页面、全局导航或工作台；不新增依赖、假状态或浏览器持久化。
- 不提交部署、不勾选/保存 EULA、不下载核心、不创建或启停实例、不向节点派发任何操作。
- 不重置已有设置，不覆盖共享主题、强调色、字体/字号、对比度、壁纸、遮罩、模糊和减少动态效果偏好。

### 验收条件

- 部署步骤清晰标示当前任务、必要信息与前进条件；前后切换保留已填状态；核心/版本/工件仍来自真实目录；EULA 只在最后一步明确同意；所有业务约束由原有 API 再次验证。
- 实例页可按名称/核心/节点查找并按状态筛选，空状态根据真实节点准备情况引导检查节点或部署；可用的启动/安全停止入口沿用现有 API、权限、在线和状态条件。
- 两个界面根据 `.module-center__content` 可用宽度调整，不造成横向溢出，保留工作台滚动和共享主题令牌。
- 执行 Web TypeScript/Vite 构建及目标差异检查。若当前浏览器不能连接，明确说明视觉与点击验收未完成；不以构建代替实机交互/帧时间结论。

### 实施与验证记录

- `MinecraftDeploymentPanel.tsx` 把已选核心/版本、节点/实例参数和执行边界/EULA拆成三步；上一步可返回修改，状态留在当前组件中。最后一步展示配置摘要，仅在许可明确勾选、角色/节点/核心等现有前置条件满足时调用一次 `provisionMinecraftServer`。服务端继续读取设置中心为目标节点解析的实例目录；没有新增目录请求、持久化“已看过”标志或提交旁路。
- `MinecraftWorkspace.tsx` 的实例列表增加名称/核心/节点搜索、按真实状态筛选和状态计数；过滤结果及计数由实例快照 memo 派生，不增加订阅/轮询。卡片基于账户角色、节点在线、实例状态和 AppContainer 可用性显示可用的启动/安全停止操作，仍分别调用原 `runMinecraftInstanceAction` 服务；停止需要用户确认。空列表按实际节点前置条件引导“检查执行节点”或“开始首次部署”。
- `MinecraftWorkspace.css` 补充步骤状态、部署摘要、实例检索工具栏、操作卡片和小容器排版；沿用共享主题/强调色/字体与 Minecraft 壁纸遮罩令牌，没有新增 CSS 自定义属性、依赖、动效或资源。
- 配置盘点及使用：部署继续使用 `minecraftRuntime.minecraftDefaultCore`、`minecraftExecutionMode`、`minecraftDefaultMemoryMb`、`minecraftDefaultPort`、`minecraftBedrockDefaultPort`；实例路径由领域服务根据 Minecraft 存储设置的全局默认/节点覆盖解析。外观使用 `appearance.theme`、`accentColor`、`advanced` 字体/字号/对比度/减少动态效果、`backgrounds.minecraft`、`overlay`、`blur` 与共享令牌。本轮没有新增或重置设置字段。
- 已检查用户提供的 [MC ToolBox 启动脚本生成器](https://mctoolbox.net/zh-cn/server-start-script)：页面展示 RAM、JAR 名称、Aikar 选项、GUI 和崩溃重启，并生成 Windows `.bat` 或 Linux/macOS `.sh` 供复制/下载。LFAA 由 Daemon 以经过校验的结构化参数、`shell:false` 管理进程、任务和安全停服；本轮没有生成能绕过这些状态的脚本，也没有新增不能保存/消费的启动参数 UI。后续如要真正做成可视化实例启动配置，需增加实例级数据、API 校验/保存，并由 Daemon 的实际启动参数构造消费。
- `pnpm --filter lfaa-web run build` 通过：TypeScript 检查通过，Vite 转换 1630 个模块并输出到仓库根 `dist/apps/web/`。首次构建发现本轮替换实例卡片后原状态颜色函数不再使用，已删除该函数后重建通过。`git diff --check -- docs/PROMPTS.md packages/client/ui-minecraft/src/MinecraftWorkspace.tsx packages/client/ui-minecraft/src/MinecraftWorkspace.css` 与新建组件/README 尾随空白检查通过。
- 未完成浏览器视觉/点击验收：当前会话此前尝试连接 Minecraft 标签时 CDP 的 `Emulation.setFocusEmulationEnabled` 超时；本轮未重复尝试。没有测量帧时间；没有接受 EULA、提交部署、下载核心、创建/启停实例或派发节点任务。构建不代表页面实际交互或 60Hz 性能通过。

## LFAA-ROADMAP-ALIGNMENT-01

### 用户目标

明确 LFAA 当前总路线与既有业务阶段的关系，给出可执行的近期顺序，消除开发计划中 Harness 主线与 P0–P7 当前重点描述不一致的问题。

### 当前合同

- 以本文件和《开发计划》第 1 节记录的六条 Harness 主线作为当前总路线；P0–P7 阶段表保留为历史业务阶段及各 App 验收进度，不再与总路线并列争夺优先级。
- 近期顺序分两步：先由登录浏览器的 Minecraft 面板经 Manager 与认证在线 Daemon 完成真实部署/就绪/停服/受支持属性编辑；再由真实 Provider/Agent 调用同一领域服务验证 AI 操作与权限。每步按实测证据收敛阻断项并完成相关回归，之后再安排新能力。
- Minecraft 的实机验收属于该闭环可使用的业务场景。玩家 P2P/内网穿透和自有镜像源当前未实现，应作为单独能力评估 Owner、运维成本、协议边界与验收，不写成已有能力。
- 本任务只修改开发路线文档；不启动控制端或 Daemon，不调用 Provider，不接受 EULA，不下载核心，不创建或操作实例，不改变代码、设置、运行数据或任何现有验收状态。

### 允许修改

- `docs/开发计划.md`：澄清当前总路线、P0–P7 表的用途及近期推进顺序。
- `docs/PROMPTS.md`：登记本合同与完成记录。

### 禁止修改

- 不修改产品代码、设置中心、用户数据、构建/发布配置或其他项目计划。
- 不把已记录的构建、回归或部分核心实机结果扩大表述为完整端到端验收。
- 不将未实现的玩家隧道、自有镜像或 SteamCMD 游戏服务端 Runner 标成已接入。

### 验收条件

- 《开发计划》只保留一个当前总路线；P0–P7 明确标为业务阶段记录，且不再用旧段落覆盖六条 Harness 主线。
- 近期顺序明确为先验收面板到 Daemon 的手动业务闭环，再验收 Provider/Agent 的同一领域服务调用；未验收项及副作用边界准确。
- 执行本任务文档的 `git diff --check`，并确认改动未覆盖既有工作区修改。

### 实施记录

- 将第 2 节标题改为“既有业务阶段（P0–P7）”，移除旧的“当前重点：继续完成 P4/P5/P6”表述，改为以第 1 节六条 Harness 主线为唯一总路线。
- 近期顺序明确为：先以登录浏览器的 Minecraft 面板走通 Manager→认证在线 Daemon 的手动部署、就绪、停服与受支持属性编辑；再以真实 Provider/Agent 调用同一领域服务；按实测证据修复阻断项并完成相关回归；之后再评估新能力。P2P/内网穿透和自有镜像明确为未实现、需单独评估的范围。
- 只改 `docs/开发计划.md` 和 `docs/PROMPTS.md`；未触及产品代码、设置、运行数据或其他既有工作区改动。
- `git diff --check -- docs/PROMPTS.md docs/开发计划.md` 通过。浏览器只读核验显示：登录态有效，控制端已连接，1 个在线且满足部署条件的 Windows x64 节点；真实核心目录已载入，默认 Paper 26.3 自动匹配工件，许可未勾选且部署按钮禁用。未运行构建/自动化测试、未调用 Provider、未派发 Daemon 任务、未接受许可、下载或创建/操作 Minecraft 实例；端到端实机验收仍待继续。

## LFAA-UI-SCROLLBAR-APPEARANCE-01

### 用户目标

- 轻量美化 LFAA 全站可见滚动条，使其与设置中心外观保持一致。

### 目标运行入口、设置与 Owner

- 入口：`pnpm --filter lfaa-web run build` 对应的 Web 应用；全局样式由 `packages/client/web/src/main.tsx` 单次导入。
- 样式 Owner：`packages/client/ui-theme/src/base.css`；外观映射沿用 `packages/client/ui-layout/src/Workbench.tsx` 与现有 `.workbench-shell` 数据属性和 CSS 令牌。
- 设置：主题使用 `appearance.theme`；强调色使用 `appearance.accentColor` 或 `appearance.advanced.modeStyles[theme].accentColor` 映射出的 `--settings-accent`；对比度沿用现有颜色令牌。减少动态效果无需新增映射，因为本次不添加动画或过渡。
- 数据与权限 Owner：无新增数据或权限行为；不增加设置项、默认值、持久化字段或服务端接口。

### 验收条件

- 全站默认可见滚动条采用轻薄、圆角、透明轨道的主题化样式；设置中心不保留重复的局部实现。
- 保留应用工作区中间内容区“隐藏滚动条但可滚动”的既有规则，以及 AI Work 消息区的既有滚动条行为。
- 不改变任何容器的滚动能力、布局或交互，不新增 CSS 自定义属性、依赖或动画。
- `pnpm --filter lfaa-web run build` 与本任务 `git diff --check` 通过；记录是否完成浏览器目视验收。

### 允许修改

- `packages/client/ui-theme/src/base.css`
- `packages/client/ui-settings/src/SettingsPage.css`
- 本任务索引与合同所在的 `docs/PROMPTS.md`

### 禁止修改

- 设置状态映射、设置 schema/默认值/持久化、工作台列布局与任何滚动容器行为。
- `packages/client/ui-workspace/src/module-workbench.css` 中间内容区与 AI Work 消息区的滚动条例外规则。
- 其他未列入允许范围的文件。

### 实施记录

- 按目标样式 Owner 在 `packages/client/ui-theme/src/base.css` 加入全局细型滚动条、透明轨道和圆角强调色滑块；浅色使用强调色与边框色混合，深色使用强调色与正文色混合，旧版 WebKit 提供 hover/active 反馈。
- 移除 `packages/client/ui-settings/src/SettingsPage.css` 的重复局部定义，设置导航和正文沿用全局样式；没有改动设置映射、设置字段、滚动容器或数据权限。
- 保留应用工作区中间画布隐藏滚动条但可滚动、AI Work 消息区按需显现、Minecraft 分类横向滚动条隐藏的现有规则；未新增 CSS 自定义属性、依赖或动画。
- `pnpm --filter lfaa-web run build`（TypeScript 检查与 Vite production build）通过，产物写入根 `dist/apps/web/`；`git diff --check -- docs/PROMPTS.md packages/client/ui-theme/src/base.css packages/client/ui-settings/src/SettingsPage.css` 通过。
- 浏览器目视未完成：Edge 浏览器枚举失败（`nodeRepl.fetch request failed`），当前浏览器列表没有可检查页面；浅色/深色、强调色切换和真实滚动交互仍待目视验收。

## LFAA-PROJECT-STATUS-CONFLICTS-01

### 用户目标

修复只读项目审查确认的状态冲突：Minecraft 首页卡片仍称“功能接入中”；P4 对 Minecraft AI 工具的描述与 P6 和当前工具注册实现相反；P7 阶段状态及 Tauri/Electron 路线描述不一致；9 月 30 日构建记录的输出目录可能被误认为当前路径；交付文件清单有重复损坏字段。

### 运行入口、Owner 与配置

- 运行入口：Web 应用中心卡片；构建命令为 pnpm --filter lfaa-web run build。
- UI Owner：packages/client/ui-layout/src/Workbench.tsx 中的应用卡片状态文案。
- 路线与能力事实 Owner：docs/系统总体架构.md、docs/开发计划.md 及各当前能力包；本任务只将说明对齐到当前事实，不改能力实现。
- 账户数据、权限和设置：不变更；不增加或读取新的设置项。Minecraft 工具仍按既有角色与权限合同筛选，EULA 仍须用户明确同意。

### 当前合同

- Minecraft 卡片说明部署已接入、实机验收仍在进行；SteamCMD 卡片区分已接入的安装/校验工具和未接入的游戏 Runner；写作卡片保留现有状态。
- P4 明确 Minecraft 业务工具已在代码中登记并按现有角色与权限模式筛选；真实 Provider/Agent 到 Daemon 的端到端验收仍未完成。不得把工具登记或构建通过说成运行时验收。
- P6 对 Minecraft 工具状态加上“代码已接入、端到端验收待完成”的边界。
- P7 阶段表与正文统一为进行中；Windows 正式桌面路线为 Tauri，Electron 仅维护旧版。
- 9 月 30 日交付记录保留当次真实构建目录，并明确注明它是历史快照；当前路径链接 10 月 1 日全仓审计。
- 修正交付文件清单的 favicon 行，使其恢复正确的表格列。

### 允许修改

- packages/client/ui-layout/src/Workbench.tsx：只改应用中心卡片的状态文字。
- docs/开发计划.md：对齐 P4、P6、P7 状态及 Tauri/Electron 路线描述。
- docs/harness-agent-delivery.md：标注 9 月 30 日构建输出记录为历史快照并链接当前审计。
- docs/harness-delivery-files.md：修复 favicon 记录的重复字段。
- docs/PROMPTS.md：登记本合同和记录实际验证。

### 禁止修改

- 不修改 AI 工具执行、Minecraft 业务、SteamCMD Runner、Daemon、镜像源、隧道/P2P、桌面构建/发布实现或其用户数据。
- 不改变设置中心、权限合同、页面布局、路由、外观令牌或应用卡片操作行为。
- 不把未验证 Provider、Minecraft EULA 部署、远程节点或 P2P/镜像能力标为已验收。
- 不覆盖本工作区其他未提交或暂存改动；不提交、发布或部署。

### 验收条件

- 应用中心三个卡片分别反映 SteamCMD、Minecraft、写作的当前接入状态。
- P4/P6 不再相互矛盾，P7 阶段状态与正文一致，并与系统总体架构中的 Tauri/Electron 边界一致。
- 历史构建记录保留可追溯性且不会被误读为当前输出路径；文件清单行列数和内容正确。
- 运行 Web 构建及本任务相关文件的 git diff --check；如浏览器可访问，核实应用中心卡片文字。无需测试数据、节点命令、Provider 调用或实际开服。

### 实施记录

- Workbench.tsx 按应用显示当前状态：Minecraft 为“开服部署已接入 · 实机验收中”，SteamCMD 为“工具已接入 · 游戏开服待接入”，写作沿用正文编辑状态。只改文字，不改卡片行为、布局、设置、权限或数据。
- 开发计划 P4 说明 Minecraft 工具已登记且端到端验收待完成；P6 补上工具登记与验收边界；P7 阶段表更新为进行中并明确 Tauri 正式路线、Electron 旧版维护。
- harness-agent-delivery.md 标注 2026-09-30 构建路径为历史快照并链接当前审计；harness-delivery-files.md 的 favicon 清单恢复为五列有效记录。
- 设置中心配置：未新增、未修改、未消费新的设置项。无新增订阅、请求或渲染工作；未进行帧时间测量。
- pnpm --filter lfaa-web run build 通过，TypeScript 检查与 Vite 构建成功，产物位于根 dist/apps/web/。本任务五个文件的 git diff --check 通过。
- 登录态浏览器打开新临时标签页并检查应用中心：三个应用卡片均显示上述状态文案；验收后已关闭临时标签页，用户原有 Minecraft 部署标签页未改动。
- 未运行自动化测试、Provider/Agent 调用、Daemon 任务或 Minecraft 部署；代码登记与真实端到端验收仍按计划分别记录。

## LFAA-UI-SIDEBAR-MENU-HOVER-TRANSITION-01（范围误判，已撤销）

### 范围澄清与撤销记录（2026-10-01）

- 用户澄清截图所指为整块收起侧栏 hover 预览的移出淡出，本合同最初误判为菜单项 hover。
- 下方菜单项过渡实现已撤回，实际修复合同与验收见 `LFAA-UI-LEFT-PREVIEW-HOVER-STABILITY-01` 的“用户澄清与续修合同”。本节以下内容只保留误判过程记录，不代表当前实现要求。

### 用户目标

修复应用工作区左侧菜单 hover 状态在鼠标移出时突然还原、缺少过渡的问题，让菜单交互更顺滑。

### 运行入口、Owner 与设置

- 运行入口：`pnpm --filter lfaa-web run build` 对应的 Web 工作区。
- 样式 Owner：`packages/client/ui-workspace/src/module-workbench.css` 中的 `.module-sidebar__menu-tabs button` 与 `.module-sidebar__menu-item`。
- 外观配置沿用 `appearance.theme`、`appearance.accentColor` / `appearance.advanced.modeStyles[theme].accentColor` 映射出的现有颜色令牌，以及 `appearance.advanced.reducedMotion` 对应的 `.workbench-shell[data-reduced-motion]` 规则；不新增设置、令牌或持久化字段。
- 数据与权限 Owner：不涉及数据、权限或请求行为。

### 当前合同

- 分类按钮只对背景色和文字色添加短促的减速收尾过渡；菜单项只过渡背景色，避免阴影、边框和标记同时变化造成反馈过量。
- 仅修改侧栏菜单分类按钮和菜单项的反馈；不移动元素、不改变点击/路由、选中状态、键盘焦点样式、侧栏展开/预览与拖拽行为。
- 过渡继续消费现有主题颜色令牌，并遵循设置中心减少动态效果与系统无障碍偏好。
- 本合同只针对菜单 hover 过渡，取代旧任务中对此处 hover 样式“禁止修改”的限制；旧合同其他边界仍有效。

### 设置中心配置盘点

- `appearance.theme` 和强调色配置经 `Workbench` 现有共享令牌控制菜单颜色；本次不修改颜色映射。
- `appearance.advanced.reducedMotion` 已映射到工作台属性，工作台 CSS 对“开启”及“系统偏好减少动态效果”统一缩短过渡；新过渡沿用此控制。
- 不新增配置控件、类型、默认值、服务端校验、持久化或 CSS 自定义属性。

### 允许修改

- `packages/client/ui-workspace/src/module-workbench.css`：仅为侧栏菜单分类按钮与菜单项补充基础状态过渡。
- `docs/PROMPTS.md`：登记本合同、任务索引与实施记录。

### 禁止修改

- 不改变菜单布局、尺寸、导航/点击行为、当前选中语义、焦点轮廓、悬停预览容器或工作台拖拽/吸附行为。
- 不新增设置、依赖、DOM 事件、动画循环、CSS 自定义属性或其他界面效果。
- 不覆盖本工作区既有未提交改动；不运行与本任务无关的测试或检查。

### 验收条件

- 移入和移出左侧分类按钮、菜单项时，分类按钮背景/文字和菜单项背景平滑还原，且不产生布局位移。
- 菜单项仅过渡背景色；分类按钮过渡背景色和文字色；边框、选中阴影和状态圆点不新增动画。
- 静态核实减少动态效果规则仍覆盖新增过渡；运行 Web 构建和本任务 `git diff --check`。
- 若当前浏览器不可访问，明确记录未完成实际鼠标交互和帧时间验收。

### 首版实施记录（2026-10-01）

- 在 `module-workbench.css` 的菜单基础态为分类按钮和菜单项加 150ms 颜色/边框过渡；菜单项的选中阴影及状态圆点颜色也平滑变化。悬停与离开共用基础态过渡，不改菜单布局、路由或焦点轮廓。
- 仅使用既有主题/强调色令牌与 `appearance.advanced.reducedMotion` 全局 CSS 规则；没有新增设置、CSS 自定义属性、依赖、事件或动画。样式只过渡绘制属性，不引发布局重排；本次未进行帧时间测量。
- `pnpm --filter lfaa-web run build` 通过（TypeScript 检查和 Vite production build）；产物写入 `dist/apps/web/`。生成的 `ApplicationWorkspace` CSS 中已包含两个菜单选择器和过渡声明。目标文件 `git diff --check` 通过。
- 未运行自动化测试。`workspace-preflight` 脚本在仓库中未找到。Edge 浏览器清单调用返回 `nodeRepl.fetch request failed`，无法读取当前页面，因此实际鼠标移入/移出、主题切换和帧时间仍待浏览器实测。

### 用户反馈修订（2026-10-01）

- 用户反馈首版多属性过渡有顿挫感。本轮将效果收敛到背景色（分类按钮另含文字色），移除边框、选中阴影和状态圆点的过渡，曲线改为 `ease-out`；具体时长以最终 CSS 为准。

### 修订实施记录（2026-10-01）

- 分类按钮改为仅过渡背景色与文字色，菜单项仅过渡背景色，均使用 `180ms ease-out`；状态圆点和选中阴影不再增加过渡。
- 收敛后再次运行 `pnpm --filter lfaa-web run build`，TypeScript/Vite 构建通过，输出仍位于 `dist/apps/web/`；`git diff --check -- docs/PROMPTS.md packages/client/ui-workspace/src/module-workbench.css` 通过。
- 浏览器不可访问，未实测鼠标手感或帧时间；实际体验需在 Edge 连接恢复后验证。

## LFAA-UI-WRITING-NO-TERMINAL-01

### 用户目标

写作 App 不使用共享终端/节点任务输出面板；常规写作页和写作 AI Work 均不显示该入口或面板，避免编辑区被占用。

### 运行入口、设置与 Owner

- 运行入口：`pnpm --filter lfaa-web run build` 对应的 Web 应用。
- UI Owner：`packages/client/ui-workspace/src/ApplicationWorkspace.tsx`，负责共享工作台入口、面板挂载与 App 上下文。
- 面板内容 Owner：`packages/client/ui-workspace/src/TaskTerminal.tsx`；本任务只阻止其在写作 App 挂载，不改变节点任务读取、输出或权限行为。
- 既有设置：`general.showBottomPanelControl`、`general.terminalPosition` 和终端相关快捷键继续沿用现有账户设置；它们只在支持该面板的其他 App 按原逻辑生效。本任务不新增、不修改、不重置设置值或全局工作台偏好。
- 数据与权限 Owner：节点任务仍由现有 Host/Daemon 与服务端队列负责；不改任务状态、账户隔离、认证、授权或执行能力。

### 当前合同

- 写作 App 的常规模式与 AI Work 模式都不渲染终端/节点任务输出入口，不挂载 `TaskTerminal`，也不为面板预留底部或右侧空间。
- 写作 App 不响应“切换底部面板”和“打开终端”快捷键；其他 App 的快捷键、设置控制与底部/右侧面板位置保持现状。
- 切换到写作 App 时不清除或覆盖已保存的全局工作台面板状态；回到其他 App 后继续遵循用户原有状态和设置。
- 不改节点命令工具、任务执行/取消、写作业务、工作台布局算法、主题样式、设置 schema、默认值、持久化或依赖。
- 写作页面不挂载任务面板可避免其额外读取/订阅；本次不新增请求、订阅、计时器或动画。

### 允许修改

- `packages/client/ui-workspace/src/ApplicationWorkspace.tsx`：按当前 App 控制共享终端入口、快捷键和任务面板的显示及挂载。
- `docs/PROMPTS.md`：登记本合同和实际验证记录。

### 禁止修改

- 不修改 `TaskTerminal` 的任务读取、输出或取消语义，不改变任何服务端/Daemon 执行与权限行为。
- 不改终端设置字段、默认值、映射、持久化或其他 App 的终端行为；不清空写作切换前的全局工作台状态。
- 不新增 CSS 自定义属性、依赖、测试数据、测试路由或临时脚本；不部署、发布、上传或提交 Git。

### 验收条件

- 写作常规与 AI Work 模式中均无终端入口/任务输出面板，且无底部/右侧面板占位；终端快捷键不会在写作 App 打开该面板。
- 其他 App 仍由既有设置控制入口、位置与快捷键；从其他 App 切到写作再切回时，全局工作台面板状态未被清除。
- 运行 Web 构建及本任务相关文件的 `git diff --check`；记录浏览器目视是否可执行。

### 实施记录

- `ApplicationWorkspace` 对写作 App 隐藏共享终端控制入口、移除“切换底部面板/打开终端”快捷键绑定，并在底部与右侧两种位置都不挂载 `TaskTerminal`；因此写作页不会显示节点任务输出，也不会为其留出面板空间。
- 继续使用既有 `general.showBottomPanelControl`、`general.terminalPosition` 和快捷键设置控制其他 App；不更改设置中心、全局工作台状态或节点任务/Daemon 执行能力。写作页不会挂载 `TaskTerminal`，不发起它的任务读取/订阅。
- `pnpm --filter lfaa-web run build` 通过，TypeScript 检查与 Vite production build 成功，产物位于根目录 `dist/apps/web/`。本任务相关文件的 `git diff --check` 通过。
- 浏览器目视未完成：Edge 标签枚举返回 `nodeRepl.fetch request failed`，无法取得用户当前登录页面；未测实际页面布局、其他 App 切回状态或帧时间。仓库不存在 `scripts/workspace-preflight.mjs`，未运行该 Gate。

## LFAA-UI-AI-SCROLL-FOLLOW-01

### 用户目标与可观察表现

- 修复截图中 `/apps/minecraft/ai-work` 中间回复区域向上滚动时卡住、不能自由查看较早内容的问题。
- 预期行为：用户向上滚动后保持当前位置；用户停留在底部时新回复仍自动跟随；点“滚到最新”与会话滚动位置恢复继续有效。

### 运行入口、Owner 与设置

- 入口：`apps/web` 的 Minecraft AI Work 页面；实际消息滚动容器为 `.ai-work-chat__messages`。
- 自动跟随 Owner：`packages/client/ui-chat/src/AiWorkChat.tsx`；锚点与滚动读取 Owner：`packages/client/ui-chat/src/conversation-scroll.ts`；位置持久化由 `packages/client/store/src/scroll-restoration.ts` 负责。
- 既有设置：`appearance.advanced.reducedMotion` 继续只控制程序化平滑滚动；不新增设置、默认值或持久化字段。
- 权限与业务数据不变；不改 AI 请求、消息内容、会话或认证授权行为。

### 复现依据

- 消息区 `overflow: auto`；滚动处理器将距底部 64px 内的滚动仍视为自动跟随。
- `createConversationScrollTracker` 在普通滚动帧也通知组件；跟随标记为真时回调立即把 `scrollTop` 设回 `scrollHeight`。因此底部附近的小幅上滚会被弹回，符合截图反馈。
- 全局滚动条样式只改变可见外观；本次修复聊天滚动与自动跟随逻辑，不改滚动条宽度/颜色或工作区其他容器。
- 浏览器实时复现受 Edge `nodeRepl.fetch request failed` 阻塞，源代码路径作为当前复现证据；交付需如实记录浏览器状态。

### 允许修改

- `packages/client/ui-chat/src/AiWorkChat.tsx`：区分用户主动上滚与仍在底部跟随，保留自动跟随和回到底部行为。
- `packages/client/ui-chat/src/conversation-scroll.ts`：提供可单测的自动跟随滚动判断。
- `apps/cli/tests/client-performance.test.mjs`：为小幅向上滚动暂停跟随增加长期回归断言。
- `docs/PROMPTS.md`：登记本合同和实际验证记录。

### 禁止修改

- 不改 `overflow` 容器、CSS 滚动条样式、页面布局、右侧资源面板或滚动条显隐规则。
- 不移除滚动恢复、对话锚点、减少动态效果支持或“滚到最新”操作。
- 不改模型流、会话数据、权限、存储字段、设置映射、依赖或其他既有工作区改动。

### 验收条件

- 距底部小于 64px 的任何明确向上滚动不再被程序逻辑强制拉回；持续生成期间可以向上阅读。
- 留在底部或向下回到底部时仍自动跟随；会话切换、滚动恢复和锚点跳转保持原有语义。
- 运行 Web 构建、`client-performance.test.mjs` 定向回归及本任务差异检查，并记录浏览器交互是否实测。

### 实施记录

- 在 `conversation-scroll.ts` 集中判断自动跟随：识别真实上滚方向，只要位置向上变化就暂停跟随，即使仍在原 64px 底部范围内；滚动方向基线在会话位置恢复后的 effect 中同步，首次位置未知时仅把实际贴底视为跟随。
- `AiWorkChat.tsx` 保留原有 64px “回到底部”按钮提示阈值与底部自动跟随；会话切换时重置方向基线，不改滚动容器、滚动恢复、锚点、消息或权限行为。
- 在 `client-performance.test.mjs` 增加回归断言，覆盖底部附近上滚暂停、向下恢复跟随、超出缓冲距离停止跟随及初始方向未知等边界。
- `pnpm --filter lfaa-web run build` 通过（TypeScript 与 Vite production build，输出位于 `dist/apps/web/`）；`pnpm --filter @yubboo/lfaa run test -- tests/client-performance.test.mjs` 通过，12 项通过、0 失败；本任务 `git diff --check` 通过。仓库根没有 `scripts/workspace-preflight.mjs`，根 package scripts 也未提供其他 preflight Gate。
- 实际交互核验：Edge 当前会话枚举仍报 `nodeRepl.fetch request failed`；随后在 Codex In-app Browser 打开同一 localhost 页面及截图对应的 Minecraft 会话。底部向上滚动 0.05 屏后，消息区 `scrollTop` 从 1416.15 变为 1368.46、距底部 47.54px；等待 1 秒位置未被吸回；向下滚动后距底部回到约 0px。完成后将隔离预览滚回底部；未向 Provider 发送新消息。

### 用户反馈复核：流式回复未跟随最新输出

- 新表现：用户报告回复生成期间消息区没有持续滚到最新输出。此前 `onScroll` 根据 `scrollTop` 的任何下降推断用户主动上滚；消息流重排、滚动锚定或布局变化也会造成下降，因此可能误暂停跟随。
- 修订目标：只有可观察到的用户滚动意图（滚轮/触控板上滚、触屏拖动或滚动条拖动）才暂停；纯消息增长、ResizeObserver 或布局引发的位置变化不得清除跟随。用户向下回到底部缓冲区时恢复；“滚到最新”、锚点跳转及会话恢复语义保持。
- 允许修改：本合同原列出的 `AiWorkChat.tsx`、`conversation-scroll.ts`、`client-performance.test.mjs` 与本合同记录。
- 验收：无用户上滚时 AI 流式内容持续贴底；用户主动上滚后仍能自由阅读且不被吸回；主动向下回到底部后恢复跟随；定向回归、Web 构建和差异检查通过。实际模型流式浏览器验收需独立标明是否完成，不用静态构建替代。
- 设置与权限：不新增或修改设置。`appearance.advanced.reducedMotion` 仍只控制程序化平滑滚动；AI 请求、权限与消息数据不变。

### 反馈修复记录

- `AiWorkChat.tsx` 不再从被动 `scrollTop` 变化推测上滚；滚轮/触控板方向和触摸/滚动条拖动才更新跟随状态。消息布局变化继续走原有按帧锚点测量和 ResizeObserver 生命周期，不清除跟随状态。会话首次恢复后按已恢复位置初始化跟随，避免把历史阅读位置强拉到底部。
- `conversation-scroll.ts` 将判断改为接收明确的用户滚动方向；向上暂停，向下进入 64px 缓冲区后恢复，被动布局变化保持当前状态。减少动态效果设置与原有 `scrollToLatest` 不变。
- `pnpm --filter @yubboo/lfaa run test -- tests/client-performance.test.mjs` 通过，12 项通过、0 失败；`pnpm --filter lfaa-web run build` 通过 TypeScript 与 Vite production build，输出位于根 `dist/apps/web/`；本次文件 `git diff --check` 通过。
- 浏览器限制：本地登录态 AI Work 页面已打开并目视检查，未发送 Provider 请求。真实回复流式期间自动跟随，以及移动触摸设备上的实际手势仍未浏览器实测；不以单测/构建声称已验证这些端到端行为。
- 根目录不存在 `scripts/workspace-preflight.mjs`，`package.json` 没有 workspace-preflight/quality/release 脚本，本次无可执行的该 Gate。

### 用户反馈：回到底部瞬间顿挫（续修合同，2026-10-02）

#### 可观察目标与运行入口

- 用户在 Minecraft AI Work 对话中反馈：滚回消息区最底部的瞬间会抖一下；截图中的消息区有“有新内容 · 回到底部”入口。
- 目标运行入口为 `apps/web` 的 `/apps/minecraft/ai-work`；真实滚动容器是 `.ai-work-chat__messages`。
- 自动跟随由 `packages/client/ui-chat/src/AiWorkChat.tsx` 管理，锚点与内容尺寸观察由 `packages/client/ui-chat/src/conversation-scroll.ts` 管理；滚动位置恢复由 `packages/client/store/src/scroll-restoration.ts` 管理。

#### 配置、Owner 与现有证据

- `appearance.advanced.reducedMotion` 继续控制程序化平滑滚动；不新增设置、不改默认值、映射或持久化。
- 消息和会话仍归当前账户、App 与会话的 AI Work Owner；不改 AI 请求、审批、消息存储、认证或授权。
- 当前代码中普通 `scroll` 事件也会请求滚动跟踪器刷新；跟踪器每次刷新都回调，而 `AiWorkChat.tsx` 在跟随状态下无条件把 `scrollTop` 写为 `scrollHeight`。同时，消息状态更新也会要求重测锚点，不能把“重测”误当成真实尺寸变化；这会在滚动动画/自然滚动期间以即时到底覆盖当前滚动帧。

#### 允许与禁止修改

- 允许修改 `packages/client/ui-chat/src/AiWorkChat.tsx`、`packages/client/ui-chat/src/conversation-scroll.ts`、`apps/cli/tests/client-performance.test.mjs` 和本续修合同。
- 不修改滚动容器布局或 CSS、工作区其他区域、滚动条外观、滚动位置持久化实现、设置中心、模型流、会话数据、权限、依赖或其他并行工作树差异。

#### 验收条件

- 自动跟随开启且消息布局未变化时，普通滚动刷新不再写入滚动位置；“回到底部”平滑滚动不被监听器在中途强制吸到底端。
- 自动跟随开启时，消息内容尺寸确有变化后仍贴合最新输出；明确向上滚动仍暂停跟随，向下回到现有 64px 区间仍恢复跟随。
- 滚动恢复、对话锚点跳转和 `appearance.advanced.reducedMotion` 的现有语义保持。
- 执行 `node --test apps/cli/tests/client-performance.test.mjs`、`pnpm --filter lfaa-web run build` 和目标文件 `git diff --check`。浏览器滚动交互和帧时间测量如未运行，分别明确记录为未实测。

#### 本次续修与验证记录（2026-10-02）

- 根因确认：滚动事件触发的锚点跟踪刷新每帧都会调用 `onChange`；自动跟随回调无条件执行 `scrollTop = scrollHeight`，会在“回到底部”平滑动画刚开始时把位置即时推到底端，也会抢占自然滚动的末帧。
- `packages/client/ui-chat/src/conversation-scroll.ts`：分开记录锚点是否要重测与 ResizeObserver/图片加载是否确认尺寸变化；只有后者进入自动跟随判定，测量与滚动回调仍按帧合并。
- `packages/client/ui-chat/src/AiWorkChat.tsx`：仅在自动跟随启用且观察器确认布局尺寸变化时写入底端；普通滚动帧与消息状态触发的锚点重测只更新锚点/状态，不覆盖浏览器当前滚动位置。
- `apps/cli/tests/client-performance.test.mjs`：验证滚动刷新和显式锚点重测不误报布局变化、观察器/内容加载变化仍触发跟随判定。`pnpm --filter @yubboo/lfaa run test -- tests/client-performance.test.mjs` 通过，13 项通过、0 失败。直接 `node --test` 不支持仓库测试所需的 TypeScript 参数属性；已改用包配置的 `tsx` 测试入口。
- `pnpm --filter lfaa-web run build` 通过 TypeScript 与 Vite 构建，产物写入根目录 `dist/apps/web/`；目标 `git diff --check` 通过。性能工作量核对：普通滚动仍最多每帧一次跟踪回调；本次移除了滚动帧对 `scrollTop` 的写入，内容尺寸变化时仍只按帧调整一次。没有采集真实帧时间或超过 50ms 的主线程任务。
- 浏览器限制：当前 Edge 标签清单接口报 `nodeRepl.fetch request failed`，Codex In-app Browser 没有现存标签；未在登录态复现或量测滚动/动画，运行中页面是否已加载本次产物也未确认。此项只由代码路径与定向回归确认，不能据此声称实际浏览器已顺滑验收。
- 设置中心只沿用 `appearance.advanced.reducedMotion` 控制显式程序化平滑滚动；未修改设置默认值、映射、持久化或 CSS 自定义属性。认证、权限、会话与消息 Owner 不变。

## LFAA-UI-MODE-TOGGLE-RESPONSIVE-01

### 用户目标与可观察表现

- 用户截图显示窄中间工作区的“常规 / AI Work”模式切换靠左；用户希望切换栏在中间区域视觉居中。
- 验收：宽屏与响应式/窄列布局下，模式切换栏都相对中间工作区标题栏水平居中；标题、操作按钮和模式切换不重叠，原有模式切换行为保持。

### 运行入口、Owner 与设置

- 入口：`apps/web` 的 Minecraft AI Work 工作区；共享标题栏在 `packages/client/ui-workspace/src/ApplicationWorkspace.tsx`，响应式样式在 `packages/client/ui-workspace/src/module-workbench.css`。
- 设置中心既有外观令牌：主题表面、边框、强调色、字体字号、玻璃模糊继续由现有 CSS 变量提供；本修复不新增配置或自定义属性，不改持久化。
- 数据/权限 Owner：不涉及数据、AI 请求、会话或权限。

### 允许修改

- `packages/client/ui-workspace/src/module-workbench.css`：调整共享标题栏的栅格定位，并让窄布局与交换 Dock 的模式栏居中。
- `docs/PROMPTS.md`：登记合同及实际验证记录。

### 禁止修改

- 不改模式切换业务、快捷键、路由、面板所有权或标题文案。
- 不新增依赖、设置项、CSS 自定义属性或动画。

### 验收条件

- 在宽屏与响应式窄列中，模式栏相对整个中间工作区标题栏居中，而不是依赖左右内容等宽；两侧标题和操作仍可用、不重叠。
- 模式切换行为保持；运行 Web 构建及本任务差异检查，并报告浏览器目视验收状态。

### 实施记录

- 中间标题栏改用左右等宽弹性轨道 + 固定模式栏的三列网格，模式栏在左右标题和操作宽度不等时仍按整个标题栏居中。窄布局与右侧 Dock 交换布局继续采用独立两行栅格，模式栏跨列居中。
- 沿用已有主题表面、边框、强调色、字体字号和玻璃模糊令牌；未增加外观设置、CSS 自定义属性、依赖或模式切换行为。
- Web TypeScript/Vite 构建通过，产物位于根 `dist/apps/web/`；`git diff --check` 通过。Codex In-app Browser 1280×720 本地页面中，打开左右工作区侧栏后目视确认模式栏仍居中且未与标题/操作重叠；实际小于 760px 的浏览器视口未模拟，窄视口验收未完成。

## LFAA-UI-AI-ANCHOR-PREVIEW-01

### 用户目标与可观察表现

- 参考用户图一，修复 Work 模式消息区左侧对话目录锚点：缩短锚点上下间距，减小鼠标移入时显示的悬浮预览卡宽度，并保留移入显示动画。

### 运行入口、Owner 与设置

- 运行入口：`apps/web` 的 Work 模式 AI Work 页面；锚点轨道覆盖 `.ai-work-chat__message-stage`。
- 视觉样式 Owner：`packages/client/ui-chat/src/ai-work-chat.css`；锚点内容、点击跳转和活动状态 Owner：`packages/client/ui-chat/src/AiWorkChat.tsx`；实际消息位置和当前锚点读取 Owner：`packages/client/ui-chat/src/conversation-scroll.ts`。
- 设置中心配置沿用 `appearance.theme`、`appearance.accentColor` 与 `appearance.advanced.separateModes` 选择的强调色，以及 `appearance.advanced.fonts` / `modeStyles[theme].fonts` 的界面与内容字体、`appearance.advanced.interfaceFontSize` 映射的现有主题令牌；减少动态效果沿用 `appearance.advanced.reducedMotion` 的工作台 CSS 控制。预览卡继续使用现有表面、文字、边框与焦点令牌；壁纸遮罩与模糊仍由既有工作区背景层负责，不新增或重置设置。
- 数据与权限 Owner：不涉及数据、权限、请求或业务操作。

### 当前合同

- 锚点按真实用户提问的会话顺序显示并等距分布，间距不再受各条消息正文长度影响；当前项仍按真实消息坐标和滚动位置确定，点击跳转、键盘焦点和触屏可见规则保持原样。
- 滚动位置对应的当前锚点只保留语义状态，不得在指针未悬停时变成长条或强调色；横杠仅随鼠标当前移入的锚点变长并使用强调色，键盘焦点也有清晰反馈。
- 指针移入锚点时显示更窄的提问预览卡并播放轻微淡入/横向归位动画；卡片最大宽度按中间工作区实际容器宽度收缩。预览卡可承接指针命中，指针从横杠移入卡片时卡片保持显示。键盘聚焦继续显示预览，减少动态效果设置继续生效。
- 继续使用当前主题、强调色、字号、字体、表面、文字、边框和焦点令牌，不新增设置项、CSS 自定义属性、事件、监听器或动画循环。

### 允许修改

- `packages/client/ui-chat/src/ai-work-chat.css`：仅调整对话锚点轨道、预览卡片尺寸/间距、指针与滚动活动状态的视觉反馈及卡片悬停命中区。
- `packages/client/ui-chat/src/conversation-scroll.ts`：仅将锚点展示坐标改为按序号等距计算；真实消息坐标继续用于当前锚点判定。
- `apps/cli/tests/client-performance.test.mjs`：在现有长会话锚点回归中覆盖正文坐标不均时目录标记仍等距。
- `docs/PROMPTS.md`：维护本合同、任务索引和实施记录。

### 禁止修改

- 不改变锚点数据、实际消息坐标的读取、活动项判断、会话消息、滚动与跳转语义、应用布局或右侧资源面板。
- 不新增或修改设置字段、默认值、持久化、设计令牌、依赖、DOM 事件、测试数据或临时脚本。
- 不覆盖 `AiWorkChat.tsx`、滚动 Owner 及本工作区其他未提交改动；不提交、发布或部署。

### 验收条件

- 锚点标记按顺序等距且纵向分布紧凑，即使对应消息正文长度差异很大也不改变标记间距；当前项仍随真实滚动位置更新。未悬停的滚动当前项不再抢占悬停样式，横杠随鼠标悬停目标变长并强调；指针从横杠进入预览卡后卡片仍可见，离开锚点与卡片后隐藏；键盘焦点路径保留。
- 已有主题、强调色、字体字号令牌继续控制预览内容；开启减少动态效果或系统要求减少动态效果时过渡遵循现有工作台规则。
- 运行 Web 构建和本任务 `git diff --check`；若可访问登录态页面，实测鼠标悬停、点击跳转与主题/减少动态效果设置。未实测项须在实施记录中明确标出。

### 实施记录

- 锚点轨道高度由 `24vh` 且最小 `180px` 收紧为 `clamp(64px, 8vh, 96px)`；预览卡最大宽度由 `480px` 收紧为 `340px`，并使用已存在的 `module-center__content` 容器宽度限制窄列布局；同步微调内边距与元素间距。移入/聚焦展示逻辑保留，入场改为 `150ms ease-out` 淡入并横向归位。
- 继续使用现有主题、强调色、表面/文字/边框、字体与字号令牌；`appearance.advanced.reducedMotion` 已由工作台全局规则控制过渡时长，本次没有新增设置、令牌或运行时订阅。没有新增 JS 测量、监听器或动画帧；悬浮只过渡 `opacity` 与 `transform`，不逐帧改变尺寸；未采集帧时间数据。
- `pnpm --filter lfaa-web run build` 复查时因当前未提交的 `AiWorkChat.tsx` 调用参数与 `conversation-scroll.ts` 函数签名不一致而在 TypeScript 阶段失败（`AiWorkChat.tsx:156`，TS2345）；本任务没有修改这两份文件。随后执行 `pnpm --filter lfaa-web exec vite build` 成功，最终样式产物位于根目录 `dist/apps/web/`。在 `http://127.0.0.1:3000/apps/minecraft/ai-work` 隔离预览中实际移入锚点，预览卡显示宽度约 340px；点击后跳至对应提问，再恢复到最新回复。未发送消息，完成后关闭临时预览标签。
- 本任务 `git diff --check -- docs/PROMPTS.md packages/client/ui-chat/src/ai-work-chat.css` 通过。外观与减少动态效果的设置映射已静态核对，但未切换用户偏好；逐帧性能未测。Edge 扩展标签列表不可用，交互通过 Codex 隔离预览完成。
- 用户补充验收：横杠长度与强调色应由鼠标实际移入位置驱动，并且悬浮卡片须能承接指针，避免横杠与当前滚动项状态混淆或移入卡片时悬浮中断。允许范围仍限本样式文件与本合同。
- 修复：移除 `.is-active` 对横杠长度/颜色的直接控制；横杠只在指针悬停到锚点时变长并着色，键盘聚焦继续突出；指针进入预览卡时横杠收回。预览卡改为可接收指针，并用卡片自身的透明伪元素补齐与锚点间的鼠标路径，悬浮仍只使用已有 opacity/transform 过渡。
- 当前变更验证：`pnpm --filter lfaa-web exec vite build` 与 `pnpm --filter lfaa-web run build`（TypeScript + Vite）均通过，产物位于根目录 `dist/apps/web/`；隔离登录态页面实际将鼠标移入横杠可显示对应提问卡，再移入卡片并让键盘焦点离开锚点后卡片仍保持显示。点击“回到底部查看最新回复”恢复原滚动位置后关闭临时标签；未发送消息。前次 TypeScript 参数签名错误在当前工作树已不再复现，本次没有改动 `AiWorkChat.tsx` 或 `conversation-scroll.ts`。
- 用户反馈锚点中一条看起来高于下面两条且间距不同。根因已在 `conversation-scroll.ts` 确认：展示 top 百分比直接取每条用户消息在整段消息区中的实际纵向坐标；相邻回复内容长度不同，会把三个标记挤出不均匀间距。修正目标是只把展示坐标改成按提问序号均匀分布，活动项仍按真实正文坐标判定。
- 等距实现：展示 top 改为 `(index + 1) / (anchors.length + 1) * 100`；DOM 实际 top 仍用于滚动活动项二分查找。长会话回归夹具让前两段实际正文坐标明显不等，并断言前三个显示坐标仍等距，同时保留活动项位置检查。
- 本轮验证：`pnpm --filter @yubboo/lfaa run test -- tests/client-performance.test.mjs` 通过（12/12）；`pnpm --filter lfaa-web run build` 的 TypeScript 与 Vite 阶段通过，产物在根目录 `dist/apps/web/`；本任务 `git diff --check` 通过。隔离登录态页面逐条键盘聚焦预览，目视确认相邻锚点间距一致；临时标签已关闭，未发送消息。未采集帧时间。

## LFAA-HARNESS-PLUGIN-CORE-01：智能体能力发现与接入闭环

### 用户目标与验收定义

- 将“发现东西、理解东西、安装/配置到正确 Owner、核验、供对应 Agent 实际使用”建设为 LFAA Harness 的基础智能体闭环。自然语言入口覆盖通用工作台及各应用 AI Work；模型按用户意图选工具与目标 App，不用关键词分支替代模型判断。
- 接入对象包括第三方 Plugins、Skills、Prompts、Tools、MCP 服务，以及 Minecraft 服务端插件和模组。它们是不同的能力类型，不强行采用同一种包格式、存储位置、权限或运行时。
- 统一层负责编排发现、来源检查、能力理解、兼容性/依赖/权限计划、应用目标路由、安装后验证和状态反馈；各类型仍由 LFAA 现有领域 Owner 安装、保存、执行并核验。不能只写入文件或设置一行就报告已可用。
- 完整闭环：模型识别用户目标并发现候选 → 检查来源/文档/声明能力 → 判断目标 App 和实际 Owner（有歧义时向用户询问）→ 依据当前权限合同调用该 Owner → 核验登记与运行事实 → 将能力按 App 范围提供给模型 → 后续工具调用返回真实结果，并支持更新、停用和移除。
- `dsh-wallpaper-engine` 是首个上游适配样本，不是系统的唯一安装对象。上游 Wallpaper/Appearance/Playback UI 与 Host/Client 功能由其官方插件源码提供，通过 LFAA 专用 DSH v1 兼容 Runtime、现有设置/右侧栏 Slots 和 Workbench 入口接入；插件 UI 未在 LFAA 重画。上游 Video/Web/Scene、播放列表、项目属性、音频和导入上传仍须登录浏览器、Steam 内容和桌面实测，不能由静态适配声称已通过运行验收。
- DSH Bundle 属于 LFAA-Harness 的 Profile 插件，由插件管理器检查、固定 commit、安装、装配、启停、受控更新和回读核验。当前只有 Wallpaper Engine 官方仓库的专用 `DshWallpaperEngineRuntime` 可适配；没有通用 Client/App Extension Host，任意其它 DSH Bundle 不可运行。插件 Host 与媒体由 Harness 插件 Runtime/Owner 管理；不得新增 Wallpaper Engine 专属 Daemon capability、任务、节点凭据或 Socket/API 媒体通道。Daemon 只承担现有游戏实例/节点领域职责；Minecraft 插件和模组才走 Minecraft/Daemon Owner。
- DSH 插件安装不代表兼容。Wallpaper Engine 只有官方仓库、稳定插件包身份、固定来源校验以及 DSH v1 Host/Client 锚点全部通过时才能启用；其 Host 仍在 LFAA Web Host Cordis Loader 进程内运行，不具备 AppContainer 隔离。其它 DSH 插件不执行；也不把 DSH 设置、布局、侧栏整套覆盖进 LFAA。

### 2026-10-04 DSH Wallpaper Engine 当前适配增补

- 本增补更新以上 Wallpaper Engine 状态描述；此前各日期实施记录保留为历史事实。官方 `elysia395/dsh-wallpaper-engine` 已由专用 `DshWallpaperEngineRuntime` 接入上游 Host/Client：Settings、右侧 QuickPanel、guide 小图标、RopeDock 和壁纸/外观/播放面板仍由上游提供；LFAA 消费其 Slots，不另画插件页面。Workbench 的主题、强调色、字体/字号、模糊、遮罩、对比度和减少动态效果继续归设置中心 Owner。
- 该例外只放行一个官方仓库/插件包和通过同一 Runtime 快照校验的 DSH v1 revision，不代表任意 DSH Bundle 可运行。插件源码位于受控 Profile 副本并由现有 Web Host Cordis Loader 托管，不提供 AppContainer 进程隔离；没有兼容合同或 Host/Client 锚点改变的新 revision 保持不可启用。
- 正常上游更新走 `capability_inspect` → `capability_install` 固定新 commit；同一官方插件、同一 App、先停用且快照仍通过 Runtime 合同时才替换源码。更新后显式保持停用，来源目录与插件私有运行数据分离；一般插件 ID 冲突策略不变。真实 Provider 安装操作、登录态浏览器、Steam 内容播放、Tauri/Electron 与帧时间仍须单独验收。

### 运行入口、配置与 Owner

- 运行入口：Web 与 Tauri Desktop 共用 `web` Profile 和 `core/agent-loop`；模型工具经 Core Tools/Agent Loop 登记和筛选。具体写入和执行仍由目标 Owner 完成，Daemon 不负责模型推理。
- 现有 Owner 盘点：项目 Skill 通过项目文件 Daemon 发现 `.agents/skills`、`.lfaa/skills` 并按需读取；内置 Writing Skills、Writing/Minecraft Prompts 分别由 `packages/skill/writing`、`packages/document/writing`、`packages/games/minecraft` 提供；内置 Tools 由业务包和 `packages/core/tools` 登记；MCP 服务由账户 `plugins.mcpServers` 配置并按 `applicationIds` 过滤；Minecraft 实例与节点文件归 `games/minecraft`、API Controller 和目标 Daemon。统一层不得再造这些 Owner 的第二套存储或执行器。
- 设置盘点：沿用 `permissions.mode`、`plugins.enabled`、各设置类别及业务设置服务。`plugins.enabled` 当前控制账户 AI 扩展策略，不能变成全局安装总闸。MCP 已有账户设置与 App 范围；Minecraft 执行方式和资源来自 `minecraft-runtime`。外观 UI 沿用 `appearance.theme/accentColor/fonts/interfaceFontSize/contrast/backgrounds/overlay/blur/reducedMotion/translucentSidebar` 和共享令牌。若某类型缺少真实所需设置，先按设置中心合同补控件、校验、持久化和映射。
- 统一接入服务只保存跨类型来源、版本、校验结果、安装任务与路由状态；内容和运行状态回写/读取各自 Owner。插件/模组的代码及用户提供的 Skill/Prompt 内容都不可信，必须与可信指令、授权和系统策略隔离。
- 模型负责理解自然语言并选择已登记工具；通用接入服务负责来源检查和类型路由；领域 Owner 负责落盘、设置、生命周期与真实状态；Agent Runtime 只消费目标 App 已验证且授权的能力。插件代码不得由 Cordis Loader 直接加载，必须通过适用平台的受限 Host 和最小 capability API。

### 当前合同与安全边界

- 管理工具按当前登录身份、目标 App 和已有授权合同筛选；写入/高风险操作遵循 `permissions.mode`。模型不能把一次安装请求扩展到其他 App、账户、节点或 Minecraft 实例。
- 对 Skills/Prompts：检查来源、许可证和内容；安装后作为不可信的任务资料，不能覆盖系统/仓库/用户规则、提高工具权限或伪造产品能力。Skills 必须通过对应 Skill Owner 注册并在正确 App 范围按需提供。
- 对 Tools/Plugins：必须有真实的解析、schema、权限和执行 Owner。第三方可执行代码不得在控制端主进程加载；声明 capability、依赖和入口均须验证，目标 Host 未支持时保持不可启用。
- 对 MCP：沿用账户服务配置、URL/协议校验、`applicationIds` 范围、连接 Runtime 和 MCP 工具风险合同；没有配置凭据/协议能力时不得宣称支持 OAuth、stdio 或未经授权的远端工具。
- 对 Minecraft 插件/模组：必须锁定真实实例、目标节点、Minecraft 版本与服务端核心兼容性，由该节点的 Daemon/实例 Owner 安装和核验；不得写入控制端插件目录或任意路径，不绕过实例状态、备份/恢复、EULA 和现有任务权限合同。
- 每一类安装均固定可审计来源/版本并验证目标 Owner 返回的登记和运行状态；失败可恢复，不能退回未确认主分支、伪造成功或将文件存在等同于可用。删除和升级只作用于相应 Owner 登记的目标数据。
- Wallpaper Engine 的上游能力、LFAA 对应模块/设置、已移植、未移植和实测状态逐项记录，不能用一个通用“已安装”状态冒充“已接入、可使用”。

### 允许修改

- 本合同和任务索引；Harness 架构/进度事实文档、各目标 Owner README 和来源适配说明。
- 通用发现/类型路由服务、插件源检索/归档、Agent Tools、Profile/Bundle 装配及其 API；只在明确缺口时新增共享类型适配包。
- `packages/skill/`、`packages/document/`、`packages/core/tools/`、`packages/mcp/` 与 Settings Owner：为 Skills/Prompts/Tools/MCP 增加经验证的来源安装、App 范围注册或设置控制，但不复制现有执行实现。
- `packages/games/minecraft/`、`packages/api/minecraft-controller/`、Minecraft Client 与 `packages/host/daemon/`：仅经 Minecraft 领域合同接入目标实例的插件/模组管理。
- `packages/client/` 对应 App/设置 UI，以及经检查后的 DSH/Wallpaper Engine 适配包和必要运行资源；新增界面须遵循现有外观配置和共享布局，不重排无关导航。
- 经确认的平台隔离 Host、构建注册、长期回归与文档；任何不支持的执行类型继续标记为不可启用。

### 下一阶段增量合同：MCP 来源检查、设置 Owner 安装与运行清单锁定

- 本阶段只打通 `mcp` 类型：用户提供 Streamable HTTP MCP 端点后，由模型调用已有 `capability_inspect` / `capability_install`；Owner 通过现有 MCP 协议实现完成真实 `initialize` 与 `tools/list` 检查，将该工具清单的 SHA-256 固定到账户 MCP 设置，并由 Agent Runtime 拒绝暴露与固定清单不一致的端点。
- 运行入口为现有 Web/Tauri `web` Profile 与 `core/agent-loop`；目标 Owner 是 `lfaa-settings` 的当前用户 `plugins.mcpServers`。安装目标只绑定一个 `targetApplicationId`，不自动扩大其它 App 范围，不改变账户 `plugins.enabled`、单服务 `enabled` 或 `permissions.mode`。
- 配置盘点：沿用 `plugins.enabled`（AI Work 扩展开关）、`plugins.mcpServers[].enabled`、`plugins.mcpServers[].applicationIds`、`permissions.mode` 和 `aiRuntime.requestTimeoutSeconds`。旧 MCP 记录没有清单摘要时保持现状；手动编辑服务的名称、地址或 App 范围时保留摘要，由运行时在清单变化时 fail closed。
- 验收目标：检查过程不持久化或执行远端能力；安装前重新连接并核对同一工具清单摘要；安装后回读当前用户设置并通过真实 MCP Runtime 再发现；扩展开关关闭时只报告已安装，不报告可用；安装成功后将这一个新服务的已核对工具加入当前 Agent Run 的下一次 Provider 请求，不重连无关服务、不重复发现每一轮工具；新工具仍由当前 App 和 permission mode 合同筛选/授权。
- 本阶段允许修改：`packages/boot/capability-mcp/`、`packages/bundle/base/package.json`、`packages/bundle/base/cordis.patch.yml`、`packages/settings/settings/src/service.ts`、`packages/api/remotes/src/route-contracts.ts`、`packages/core/tools/src/mcp-tools.ts`、`packages/core/agent-loop/src/execute-turn.ts`、`packages/core/agent-loop/src/runtime.ts`、`packages/client/connection/src/api.ts`、MCP 设置行的只读状态说明、能力安装/MCP/Agent Loop 定向回归、锁文件及与该接入直接相关的架构/Owner 文档。
- 本阶段禁止修改：其它能力类型的安装 Owner、已有 MCP 认证/stdio 能力范围、`plugins.enabled` / 用户设置默认值、现有 MCP 服务目标范围、工具风险和审批语义、Agent Prompt/关键词路由、外部 MCP 代码执行、远端主机访问策略；MCP 描述、响应与其他外部材料只能作为不可信数据，不能提升权限或覆盖用户/系统指令；不调用或执行第三方 MCP 安装脚本。

### 下一阶段增量合同：按账户与 App 安装并调用第三方提示词

- 本阶段只接入 `prompt` 类型：来源为用户指定的 GitHub 仓库固定提交；Owner 只读取所选 Markdown 文本，不执行仓库代码或脚本。仓库含多个候选时，模型按检查返回的相对文件路径重新检查并明确选择一个。
- 运行入口沿用四个现有 AI Work 与通用工作台；持久化沿用 `lfaa-settings` 的当前用户插件/外部能力设置，并为记录绑定唯一 `applicationId`、来源、commit、归档及内容 SHA-256、内容、启用状态。目标不跨账户或 App 扩大，重复安装、容量限制、目标冲突和来源漂移要显式处理。
- AI Work 暴露只读的当前 App 提示词清单/按 ID 加载能力；已安装内容按需返回给模型，并在系统提示中明确标作不可信资料，不能覆盖系统/开发者/用户授权、修改工具范围或声明新的产品能力。安装后模型可用安装结果中的 ID 在同一轮加载内容继续工作。
- 设置盘点：沿用 `permissions.mode` 决定安装写操作是否审批；`plugins.enabled` 继续作为 AI Work 扩展总开关，逐条 Prompt 的启用状态另外保存在其条目中。安装过程不改变总开关、外观设置或任何既有用户偏好。设置中心插件页只展示已登记提示词的真实账户/App/来源状态，不新增默认开关。
- 允许修改：`packages/boot/capability-prompt/`、Base Profile 装配、`packages/settings/settings/src/service.ts`、`packages/api/remotes/src/route-contracts.ts`、`packages/client/connection/src/api.ts`、`packages/client/ui-settings/src/SettingsPage.tsx`、`packages/core/tools/src/business-tools.ts`、`packages/core/agent-loop/src/execute-turn.ts`（只在当前 App 有已启用提示词时提供只读工具，并支持本轮安装后加入下一次模型请求）、需要明确不可信边界时的 `packages/core/agent-loop/src/runtime.ts`、提示词设置/能力 Owner/Agent Loop 定向回归、pnpm 锁文件及与本阶段直接相关的合同/架构/进度文档。
- 本阶段禁止修改：Skill/Plugin/MCP/Minecraft 适配器、既有 Writing/Minecraft Prompt Owner 与其业务模板、Provider/权限/审批实现、系统指令和授权模式、AI Work 布局、安装脚本执行或自动加载未经模型选择的提示词；第三方内容只作为数据交付，不获得代码执行入口。

### 禁止修改

- 不替换或复制 AI/业务工具、Settings、Account、节点和 Minecraft/SteamCMD/Writing 现有 Owner，不改变用户现有设置值。
- 不限制能力目录只能来自某一种内容类型或一个仓库；不以关键词脚本替代模型判断，也不让模型选择绕过类型合同、Host 或权限。
- 不把文本资料误作可执行能力；不把工具描述/MCP schema 误作授权；不向 UI、清单或日志暴露密钥。
- 不执行未信任包安装脚本、不在控制端主进程运行外部代码、不让 Minecraft 插件/模组跨实例或跨节点安装；不以测试名义绕过授权或 EULA。
- 不顺手重排工作台与应用侧栏布局，不提交、推送、发布或部署，不覆盖无关未提交改动。
- 不提交、推送、发布或部署；不覆盖或清理工作区既有的无关未提交修改。

### 验收条件

- 一句话请求经真实模型工具循环完成发现、类型/目标判断、来源和兼容性检查、权限处理、目标 Owner 安装及真实状态复核；真实 Provider 验收能继续使用刚安装的能力。测试替身不算模型端到端证据。
- 每种类型都落到对应 App/Owner/设置位置：Skill/Prompt 能被相应 Agent 读取；Tool/MCP 有真实可执行 schema、权限和结果；Minecraft 插件/模组出现在指定实例的真实运行目录并回报核验状态。无匹配能力或输入有歧义时明确询问/拒绝，不伪装成功。
- 至少各有一个非 Wallpaper Engine 的 Skill/MCP/Tool 示例和一个实例定向 Minecraft 插件或模组案例，证明核心按类型委托 Owner、而非写死单一插件。
- 能力调用通过目标 App 的 Agent Tool Directory 自主选择并返回真实 Owner 结果；卸载/更新只影响本来源登记的目标能力；跨用户、App、实例、节点或权限边界的操作拒绝。
- 运行各类型直接回归、包/API/Agent/Web 构建和适用 workspace Gate；确认新增控制接入现有设置，产物位于根 `dist/`。记录性能、浏览器交互、Provider 与 Daemon/桌面实测边界，不互相替代。

### 实施记录

- 已盘点设置：沿用当前 `permissions.mode`、账户 AI 扩展 `plugins.enabled` 和外观选项；没有新增设置值，也没有改变用户偏好。AI 管理工具按管理员身份独立显示，不被 `plugins.enabled` 关掉。
- 已实现首段通用核心：`packages/boot/plugin-manager/` 作为必需的 base Profile 插件提供 GitHub 候选搜索、仓库清单检查、commit SHA 固定、源码归档 SHA-256、ZIP 文件数/体积/路径/符号链接/CRC 校验、Profile 专属安装、版本冲突拒绝、清单读取与停用后移除。缺少 LFAA/DSH manifest 的普通仓库会被拒绝，不写入安装目录。每个 Profile 限 128 个插件，归档限 64 MiB，解压总量限 128 MiB；不执行包脚本，不在 Cordis 主进程加载第三方代码。
- 新增 `packages/boot/capability-installs/` 通用 Owner 适配器目录和 `capability_catalog/search/inspect/install/list/set_enabled/remove` Core Tools；四类 App 与通用工作台共用自然语言入口。普通用户能查询类型目录，目标适配器执行时仍须落实自身授权。此条记录形成时先接入 `plugin`，随后增加的 `skill` 和 `mcp` 适配器见下方实施记录；Prompts、第三方 Tools 与 Minecraft 插件/模组仍须各自的 Owner，不回退到插件安装。
- 插件安装记录新增目标 App；同一 Profile 插件只能按同一来源提交和目标 App 幂等复用，不会静默扩大范围。清单迁移到 v3，v1/v2 缺少 App 范围时保留原先全 App 可见性。设置中心插件清单显示目标 App；没有新增设置字段，继续沿用 `permissions.mode`、`plugins.enabled` 及插件管理员授权。`packages/api/plugin-controller/` 仍只开放认证后的读取、搜索和来源检查；HTTP 安装/启停/移除写路由保持 404。
- 搜索结果明确返回 `requiresInspection`，不再把未经检查的仓库标成“可安装”；清单升级到 v2 并兼容读取既有 v1 记录。Profile 重启或插件进程意外退出后按 Host 实际状态显示未启用；停用和移除会先等待 Host 退出、撤销 AppContainer ACL，再改写清单/文件。自然语言安装工具要求模型在安装后按 `canEnable` 继续启用并通过 `plugin_list` 核对状态。
- 新增 Windows x64 `WindowsAppContainerPluginRuntime`：只接受 LFAA v1、包内安全 `.mjs` 入口、无额外 capability 的插件；必须同时收到 Sandbox Host 启动标记和插件 JSONL `ready` 消息才标记启用，停用须收 `stopped` 并等待 Host 退出。复用原生 Sandbox Host，插件源只读、无网络、移除非白名单环境、Job Object 限单进程和 512 MiB 内存；每个 Profile 最多同时运行 4 个插件，离开后通过 Host 清理 ACL 与 AppContainer 配置。
- Web Profile 回归中发现当前工作树已有的 `workspace` Bundle 行引用了没有 Cordis `apply` 入口的项目目录包，导致整套 Web Profile 启动失败。已在该包补上可注入的只读目录登记服务入口，令 Profile 能实际装配并到达插件工具/API。
- 当前仍不支持声明额外 capability 的 LFAA 插件，也没有插件 capability API/IPC、插件 UI 注入或 DSH Client Runtime。Wallpaper Engine manifest 可识别但保持不可启用；本次通用 Host 样例证明 LFAA v1 生命周期，不等于 DSH 插件兼容或壁纸功能移植。
- 用户提供仓库当前固定提交 `2d244d8f0dc6150bbf430c2d3b48ad87fb5762e5` 已通过 GitHub codeload 源码归档只读解析：共 205 个文件，包名 `dsh-plugin-wallpaper-engine`、版本 `1.1.0`、许可证 MIT、bundle 入口 `cordis.patch.yml`，客户端通过 DSH manifest 注入 `@deepseek-ai/dsh-client-runtime`。源码 ZIP SHA-256 为 `2e2eb3d51c617ea7d01444cdfddb8a7430100d58a5404dad937343537588d0ce`；上游代码未在 LFAA 控制端执行。
- 首个样本功能清单已从上游 README/入口核对：Video/Web/Scene 三类实时渲染（Application 外部程序明确不支持）；Wallpaper Engine 只读库存、隐藏/分级/类型筛选、轮播与就绪后转场；JPG/PNG/MP4 上传、WebWallGL/WE API、属性控制、缩略图/帧率转码；画面滤镜、主题跟随、液态玻璃/侧栏、字体集/输入光标、吉祥物；系统输出音频反应、Now Playing/反向控制、可选在线歌词和中英界面。
- LFAA 当前只有按页面的静态背景图片 ID、账户外观设置与通用工作台主题层；尚无动态媒体背景/壁纸库存、WE 项目扫描/渲染/属性 API、插件媒体偏好存储、音频捕获/系统媒体会话、插件设置页或吉祥物入口。现有外观配置可复用主题/强调色/字体/字号/对比度/遮罩/模糊/减少动态效果，但不能冒充覆盖上游所有插件专属控制项。适配实现需先补齐由设置中心持有的缺失控制，再接入工作台与安全媒体 Host。
- 2026-10-01 用户进一步明确：目标不是单独的插件安装器，而是能从一句话驱动“发现—理解—按类型和 App 规划—委托正确 Owner 安装—注册到对应设置/运行位置—验证—供 Agent 调用”的能力接入闭环；类型包含 Skill、Prompt、Tool、MCP、Minecraft 服务端插件/模组及未来扩展。已盘点项目 Skill、Writing/Minecraft Prompt、Core Tools、MCP Settings/Runtime、Minecraft 实例与 Daemon 的现有 Owner。统一层不能合并或绕过这些 Owner。该日期时已实现 GitHub 插件与受限 LFAA v1 Host，其他 Owner 适配器尚未接齐；后续进度见 2026-10-02 记录。
- 本次定向回归共 8/8 通过：Web Profile 工具/API 权限、固定提交安装、非 Wallpaper Engine 的 LFAA v1 插件识别、清单迁移及重复安装状态、普通仓库拒绝、ZIP 路径穿越/符号链接/CRC 篡改拒绝、AppContainer 适配器 JSONL 启停握手与权限清理。`lfaa-plugin-manager` 与 `lfaa-workspace-workspace` 包构建、Windows Sandbox Host release 构建及 `git diff --check` 通过。工作区整体 TypeScript 检查仍在既有的 `packages/api/workspace-controller/src/index.ts:177` 和 `packages/settings/settings/src/service.ts:349,351` 报错；没有把它们算作本任务通过。Windows 本机 Sandbox Host `--probe` 返回 `windows-appcontainer-v1`，只确认本机 AppContainer/Job Object 基础能力，不证明已加载真实插件。未调用真实 LLM/Provider，未做已登录浏览器、Tauri 桌面、真实插件进程或界面帧时间验收。
- 设置中心“插件”页已接入管理员可读的 Profile 第三方插件清单、GitHub 候选搜索与只读来源检查；显示固定 commit、归档 SHA-256、许可证、合同、声明 capability 与隔离 Runtime 兼容状态。HTTP 插件接口仅保留读取/搜索/检查；写入 HTTP 路由已撤下，UI 不直接安装/启停/移除；这些变更只能由模型调用 Core Tools 并遵守权限/审批合同。没有增加或重置设置值，沿用当前 `permissions.mode` 与 Profile 插件清单。
- 本次相关包构建、`pnpm run build:control-plane` 与 `pnpm --filter lfaa-web run build` 通过；插件/沙盒定向回归 9/9 通过，覆盖通用目录、App 路由、旧清单迁移、目标隔离及 HTTP 写路由不能绕过工具授权。性能方面新注册发生于启动时，不增加轮询/请求/订阅；UI 只在插件设置分类读取清单。登录态浏览器交互、真实 Provider 自然语言工具循环、非插件 Owner 适配、DSH/壁纸运行、桌面与帧时间验收仍未完成。

- 设置中心“插件”页新增登录可读的真实能力路由清单，展示七种能力类型当前是否登记 Owner、支持的 App 与生命周期操作；GET /api/capabilities/catalog 只读且要求认证，插件来源/清单写入边界不变。App ID 列表集中到 packages/util/values/src/application-id.ts，设置偏好、API、Agent 和通用安装注册表共享同一来源。此项仅核对适配器登记状态，不声称完成资源安装、Host 启动或模型端到端验收。
- 通用安装链路要求领域 Owner 的 `inspect` 返回不可变 `resolvedRef` 与 JSON 检查详情，并公开类型目标 schema/校验；核心将来源、版本、目标、详情保存为 15 分钟有效、按用户/能力类型/目标 App/类型目标绑定且最多一次消费的内存凭证。`capability_install` 只接收 `capability_inspect` 返回的 `inspectionId`；插件适配器使用凭证中的已解析 commit 重新取源，并核对详情中的 commit、App 范围和空目标。凭证在安装开始前消费；超时、进程重启或结果未知时需重新检查，避免跨用户/App/实例使用、来源漂移及盲目重放。已对 `apps/cli/tests/plugin-manager.test.mjs` 做真实适配器闭环回归：固定 SHA、跨用户拒绝、跨 App 拒绝、插件目标合同校验、一次性消费及再读清单；原定向回归 9/9 通过；新增目标合同后的回归和构建待本轮复核。新类别仍没有领域 Owner，Wallpaper Engine 也仍未移植或运行。

- 2026-10-02 新增 `packages/boot/capability-skill/` 项目 Skill Owner 适配器，复用 GitHub 源码快照校验与现有项目文件 Daemon Owner：固定 commit/归档 SHA-256，只选取一个含 `SKILL.md` 的目录，经 `create_tree` 原子写入当前 Workspace/Minecraft 会话所选项目 `.agents/skills/<name>/`，随后用 `discover_skills` 回读。下载文本在检查结果中明确标为不可信；安装不执行仓库脚本。检查可将 Owner 选中的仓库内目录收敛进凭证目标；模型在多 Skill 仓库须从检查错误返回的目录中指定 `target.sourcePath` 后重新检查。绝对项目路径只保存在服务端票据中，模型仅得到项目标题摘要；安装前核心重新校验当前 App/目标与票据匹配。支持范围为单 Skill、最多 128 个 UTF-8 文本文件、合计 8 MiB；不支持二进制资源、同名覆盖、升级、启停和删除。该适配器登记不代表真实 Provider 安装后调用验收；Prompt/Tool/Minecraft 插件/模组及 DSH Wallpaper Engine 仍未接入。随后新增的 MCP 适配器见下方记录。
- 定向回归 18/18 通过，覆盖通用目标票据/审批摘要/上下文重验、Profile 能力目录实际装配、Skill 固定快照（含仓库根目录 Skill）与项目目录回读、项目文件树安全、原插件生命周期和写 API 边界。控制端 TypeScript 检查、`lfaa-capability-installs` / `lfaa-capability-skill` / `lfaa-plugin-manager` / `lfaa-tools` / `lfaa-base` 包构建、控制端构建、Web 构建和 `git diff --check` 通过；产物在根 `dist/`。本仓库当前未找到 `workspace-preflight` 或独立 quality/release Gate 脚本，未声称其通过。无新增设置字段；写操作继续经 `permissions.mode`，目标来自当前会话所选项目。真实 GitHub 下载、真实 Provider 自然语言循环、登录浏览器/桌面、在线 Daemon 项目、Wallpaper Engine 与 Minecraft 实机未验；测试中的远端源码和项目 Owner 使用替身，项目文件 Daemon 执行器则以临时目录回归。
- 2026-10-02 插件来源检查增加固定归档的静态运行要求报告，列出 DSH 最低版本、归档内 Host/Client 入口、bundle 补丁、Client 平台与注入项、peer dependencies、直接依赖名称和脚本名称；所有路径须匹配已校验归档文件，只读取 `package.json`，不执行依赖或脚本。自然语言检查详情会把该报告交给模型，设置中心插件来源检查页也展示这些 DSH 依赖声明，安装审批摘要显示当前隔离 Runtime 能否运行。该改动提升来源理解与失败预期说明；没有新增 DSH 执行能力。插件定向回归 6/6、控制端 TypeScript 检查、`lfaa-web` TypeScript/Vite 构建和 `git diff --check` 通过；未运行真实 Provider 或桌面/Wallpaper Engine，DSH bundle 当前仍不可启用。
- 本轮先补齐通用 Owner 核验合同：每类适配器必须在安装动作后，从自身真实清单/运行状态回读并返回 `ready`、`installed`、`incompatible` 或 `unknown` 之一；核心工具统一返回核验态，核验失败明确标为未确认并提示先查清单，不把写入动作本身当成完成。范围限定为 capability-install 核心、已接入的 Plugin/Skill Owner、对应定向回归和本任务文档；不改变设置值、App Owner、权限模式或 DSH 可运行状态。
- 2026-10-02 已落地 Owner 回读核验：`CapabilityInstallAdapter` 缺少 `verifyInstalled` 会在启动登记时失败；`capability_install` 消费一次性检查凭证后安装，再要求 Owner 用来源、固定版本、App 与类型目标回读。核心统一返回 `verified_ready`、`verified_installed`、`verified_incompatible` 或 `unverified`，对核验抛错/格式错误只输出 `unknown` 与先查清单提示，不暴露内部异常，也不重放已消费安装。Plugin Owner 回读 Profile 清单确认 repository/commit/App，并分别呈现启用、已安装或不兼容；本地 DSH fixture 的真实结果是已核验落盘但 `verified_incompatible`，仍不可运行。Skill Owner 将写入和回读拆开，核心随后通过 Daemon `discover_skills` 精确核对 Skill 名称与 `.agents/skills/<name>/SKILL.md` 路径，只有发现成功才返回 `verified_ready`。
- 本轮设置盘点继续沿用 `permissions.mode`、管理员插件授权、当前会话项目目标与既有外观设置；没有新增、重置或改写设置。定向回归 15/15 通过（通用安装票据、Owner 回读失败/禁止重放、Skill 项目写入/发现、DSH 不兼容真实状态、插件 API 权限边界）；控制端 TypeScript 检查和 `build:control-plane` 通过，`lfaa-capability-installs`、`lfaa-capability-skill`、`lfaa-plugin-manager` 单包构建通过，产物均在根 `dist/`。`git diff --check` 与本轮编辑的未跟踪源码/测试尾随空白扫描通过。未改 UI，因此未跑 Web build；未进行 Provider、登录浏览器、桌面、Wallpaper Engine、本机媒体会话或帧时间实测。该阶段强化安装核验合同，不等于 MCP/Prompt/Tool/Minecraft 插件/模组 Owner 已实现，也不等于 DSH Runtime/壁纸功能已适配。
- 2026-10-02 新增 `packages/boot/capability-mcp/` Owner 适配器：只接受用户直接提供的 Streamable HTTP MCP 地址，检查时调用真实 `initialize` 与 `tools/list`，不执行外部工具；安装前重连并核对 SHA-256 工具清单，再经 `lfaa-settings` 保存到当前账户、单一 App 的 MCP 服务记录。现有协议 Runtime 在工具清单摘要漂移时 fail closed；Agent Loop 安装后读取当前设置，仅重连这一个新服务并再次核对，把新工具加入当前 Agent Run 的下一次模型请求，后续由模型自行决定是否调用。运行和安装仍受 `plugins.enabled`、服务 `enabled`、`applicationIds`、工具范围与当前 `permissions.mode` 控制；未改用户开关，没有增加设置字段。设置中心连接行只读显示清单摘要状态。
- 该阶段定向回归 3/3 通过（真实本地 MCP HTTP 协议检查与安装、设置读回、App 隔离、漂移拒绝、Agent 同轮加入并实际调用）；控制端 TypeScript 检查、`lfaa-capability-mcp`、`lfaa-tools`、`lfaa-base` 包构建、`build:control-plane` 与 `build:web` 通过，产物位于根 `dist/`。测试使用本地 MCP fixture 和合成 Provider，不代表真实 Provider/公网服务或浏览器登录验收。该阶段之后 Prompt 安装又单独进入下一阶段合同；OAuth、stdio、公共 MCP 目录、第三方 Tool 执行合同、Minecraft 实例插件/模组仍未接入，DSH Wallpaper Engine 也仍未移植或运行。
- 2026-10-02 新增 `packages/boot/capability-prompt/` 提示词 Owner 适配器：从 GitHub 固定 commit 和归档 SHA-256 中选择一个 Markdown 文件，安装时重新下载并验证正文 SHA-256，再由 Settings Owner 按账户、App、来源路径登记；每账户最多 16 条、每条最多 24 KiB，不覆盖已有来源、不执行脚本。`plugins.prompts` 扩展现有账户设置记录，兼容旧客户端省略该字段时保留已安装条目；逐条启停/移除由设置 Owner 校验账户和 App。设置中心“插件”页只展示名称、目标 App、来源提交、内容摘要与真实启用状态。AI Tools 仅在扩展开关开启且当前 App 有已启用提示词时提供 `capability_prompts_list` 与 `capability_prompt_load`，避免空目录给每个模型请求增加无用工具；按 ID 加载前检查扩展总开关、单条启用态、App 归属和内容 SHA-256。模型安装后由 Agent Loop 回读 Settings Owner 核对 ID/App/摘要，再把提示词工具加入同一 Agent Run 的下一次模型请求；工具结果被系统规则标记为不可信资料，不获得权限。
- 提示词/MCP/Agent Loop 定向回归共 7/7 通过，覆盖多文件显式选择、内容漂移拒绝、账户/App 隔离、单条生命周期、正文摘要和扩展开关、旧客户端设置字段兼容，以及同轮安装后加载。控制端 TypeScript 检查、`lfaa-capability-prompt`、`lfaa-capability-mcp`、`lfaa-tools`、`lfaa-settings`、`lfaa-api-remotes`、`lfaa-base` 包构建、`build:control-plane` 与 `build:web` 通过；构建输出位于根 `dist/`。测试使用本地归档/设置/Provider 夹具，不代表真实 GitHub/Provider/公网 MCP、登录浏览器或桌面验收。未新增用户偏好默认值；安装写操作沿用 `permissions.mode`，AI 扩展总开关保持用户设置。第三方 Tool、Minecraft 插件/模组、DSH Wallpaper Engine 功能移植与实机运行仍未完成。

### 已撤销的错误架构历史：Wallpaper Engine Daemon 库存发现

本节记录的 Daemon Owner 方案已于 2026-10-02 撤销，不再是当前合同或允许实现方向。用户明确要求 DSH Bundle 作为 LFAA-Harness Profile 插件运行；Wallpaper Engine 不是 Minecraft/游戏节点能力。

- 本阶段为 `dsh-wallpaper-engine` 后续 LFAA 原生适配建立真实库存 Owner：管理员通过 `nodeId` 指定一个在线且声明 Wallpaper Engine 库存能力的 Daemon 节点后，认证 API 让该节点只读发现 Steam 库内 Wallpaper Engine 项目，并返回不含本机绝对路径的有限元数据列表。路由为 `POST /api/workspace/wallpaper-engine/inventory`。
- Daemon 扫描范围只来自本机 Steam 注册信息、标准 Steam 安装位置和已解析的 `libraryfolders.vdf`；先要求 Steam 库内存在 `steamapps/common/wallpaper_engine/wallpaper32.exe`，再遍历该安装目录的 `projects/defaultprojects`、`projects/myprojects`，并只遍历 VDF 中 `apps` 含 app id `431960` 的库之 `steamapps/workshop/content/431960`。请求不接收路径、Shell 或文件名；拒绝/跳过符号链接，读取项目 `project.json` 前校验普通文件、大小与 UTF-8 JSON，所有目录项和结果有界。
- 扫描经现有 `project-files` 节点任务链执行，不在控制端读取节点磁盘。新增的 Daemon capability 仅代表清单扫描能力，不授予媒体文件读取/流式播放或第三方插件执行权限。API 需验证账户身份、节点在线及该 capability；失败报告真实原因。
- API 按账户和节点合并并行的相同扫描，一个控制端进程同时最多执行 2 个库存扫描；结果不跨账户缓存，也不长期缓存。等待超时会取消排队任务或向运行节点请求停止只读扫描，不静默累积扫描队列。
- 设置盘点：库存只读查询不新增或修改账户设置；现有 `appearance.backgrounds` 仍只引用内置/账户上传图片，本阶段不得把 Wallpaper Engine 项目 ID 写入该字段，也不得显示为已应用。没有 UI 增量。
- 验收包括临时 Steam/VDF/项目目录夹具、Steam 库发现、元数据与路径不泄露、符号链接及恶意路径拒绝、扫描上限和超时，以及认证 API 对离线/不兼容节点的拒绝；直接 Daemon/API 包构建和相关回归通过。
- 本阶段不包含目录以外的自定义媒体源、Wallpaper Engine 插件启用、预览/媒体 HTTP 路由、Video/Web/Scene 渲染、播放设置、工作台壁纸层或用户可见的应用完成度；这些仍必须在后续合同中逐项实现并实测，不能把库存发现称作已接入壁纸。
- 2026-10-02 已接入 `wallpaper-engine-inventory-v1` Daemon 清单能力及管理员认证 API。按上游固定版本 `2d244d8f0dc6150bbf430c2d3b48ad87fb5762e5` 校准安装标记 `wallpaper_engine/wallpaper32.exe`、默认/自定义目录、431960 Workshop 库归属和 `project.json.file` 类型推断；只返回摘要 ID、标题、类型、来源和预览存在标记。节点任务不接受额外路径，结果经 API schema 再校验；账户/节点同请求并行合并，控制端同时最多扫描 2 个节点，等待超时会请求取消 Daemon 只读任务。
- 本阶段设置盘点沿用 `appearance.backgrounds` 及现有外观设置，不新增或改写设置字段，未新增 UI。扫描上限为 16 个 Steam 根、32 个库、96 个项目容器、每容器 1200 项及总计 600 个项目；VDF 上限 1 MiB，单个 `project.json` 上限 256 KiB。
- 相关回归 6/6 通过，覆盖 VDF 解析、Steam 多库合并、仅扫描含 431960 的 Workshop 库、默认/自定义来源、绝对路径不泄露、坏 JSON、符号链接、600 项封顶、任意路径拒绝、未发现 Steam/Wallpaper Engine 状态、认证/管理员/节点 capability 与同账户并行请求合并。控制端类型检查、Daemon/API 包构建、`build:control-plane` 与 `git diff --check` 通过，产物均在根 `dist/`。测试只用临时 Steam 库和 Daemon 任务夹具；本机真实 Steam、实际 Daemon 扫描、浏览器/桌面及媒体播放未验。

### 当前增量合同：DSH Wallpaper Engine 的 LFAA Harness 插件运行适配

- 参考源码固定为 DeepSeek Harness `639ed015397290b3745d163aafe02ffee4aa3f84` 与其中 `plugins/dsh-wallpaper-engine` 上游提交 `d1d82d12e581d04017da7e798957c55a65003b4c`。复用 DSH 的 Profile/Bundle 装配、插件生命周期、`dsh.client` 清单和模块图概念；DSH Host 插件在共享 Cordis 进程登记 `webServer` 路由，Client bundle 在 DSH 页面 Runtime 加载。LFAA 本阶段不引入共享进程执行方式，也未实现通用第三方 Host/Client Extension Host；固定提交由 LFAA 自有可信 Video Host 和既有工作台消费，不执行上游 Host/Client 入口。
- 目标仍是让用户在通用工作台或 AI Work 通过通用 `capability_*` 流程检查、安装固定来源并由 Plugin Owner 回读真实 Runtime 状态；本地选择/播放由外观设置提供。仅当 LFAA 原生适配真的就绪时，Plugin Owner 才能返回 `verified_ready`。DSH Host/Client 源码继续作为不可信来源材料，不在控制端主进程、Cordis Loader 或 LFAA 页面主 Realm 执行。
- 当前首条垂直切片只支持 Windows Steam 库中的 Video/MP4 项目：固定 DSH 来源提交可激活 LFAA 原生 Host，设置中心扫描真实项目并允许用户选择，工作台使用认证 Range 媒体路由播放。Web/Scene、播放列表/旋转、项目属性、音频、原始 DSH Client UI 和侧栏槽位明确未接入。
- 运行入口为 Web 与 Tauri 共用的 `web` Profile、LFAA-Harness 控制端和现有工作台。目标 Owner：插件安装清单与生命周期由 `packages/boot/plugin-manager` 持有；Steam 项目发现及受限媒体读取由同包 `WallpaperEngineHost` 持有；用户设置由 LFAA Settings Owner 持久化；播放器由 `packages/client/ui-layout` 承载。Wallpaper Engine 不经过 Daemon、Minecraft 任务或远程节点。
- Host 仅向认证控制器提供已发现项目 ID 和媒体流，不返回本机路径或通用文件系统 capability。目录/`project.json` 随 Steam 库扫描检查，库存缓存 5 秒；打开媒体时重新检查项目归属、路径、普通文件和符号链接。单段 Range 最多 64 MiB，最多 2 路；停用会取消现有流，进行中的打开请求会因生命周期代次变化失败。路由只允许账户当前设置中已启用并选中的项目读取。
- 设置盘点：沿用 `permissions.mode`、插件管理员权限和 `plugins.enabled`（AI Work 扩展开关）；新增外观 `appearance.wallpaperEngine.enabled/projectId`，默认分别为 `false` 与空字符串，服务端归一化旧账户记录并校验项目 ID，设置中心可扫描/选择/启停。既有 `appearance.backgrounds`、主题、遮罩、模糊、字体和减少动态效果仍由现有设置控制，不改写用户偏好。
- 插件流程保持真实状态：通过现有 `capability_*` 或插件管理 UI 检查、安装固定提交，再启用；非 Windows、来源提交不符、库存为空、无效媒体或超出并发限额均明确失败，不报告 ready。插件未启用或账户未选中项目时，媒体路由拒绝读取。
- 本轮定向回归应覆盖 Plugin Owner 固定来源匹配、Steam 项目发现/路径限制、Range/并发/停用清理和 Settings 默认值/旧记录迁移；相关包构建、Host/Client 类型检查、`git diff --check` 按可执行环境记录，输出只位于根 `dist/`。浏览器播放、真实 Steam 库、Tauri、帧时间、连续播放及真实 Provider Agent Run 分开记录；不做 Daemon 验收。
- 禁止：切换 `supports()` 标志来伪造 DSH 兼容；直接执行上游脚本或依赖安装 Hook；将 Host 插件加载进控制端主进程；在 LFAA DOM 注入完整 `lib/client.js` 逃过模块隔离；通过 `project-files` 文本输出、base64 整文件或任意 URL 代理承载视频；改变既有外观值、授权规则、Profile/App 范围或无关导航布局。
- 历史误实现与回滚：此前误将 Wallpaper Engine 库存扫描和媒体 Range 接入 Daemon capability/任务/Socket/API；用户指出该归属错误后已删除。此前 10/10 仅证明那条被撤销实现的合成传输回归，不是 Harness 插件验收。当前 DSH 通用 Bundle Runtime 与原始 Client UI 仍未移植；本轮交付的原生 Video 适配与真实 Steam/浏览器/桌面验收状态另记于下方日期记录。

### 2026-10-03 本轮实现与验收记录

- 按 DeepSeek Harness commit `639ed015397290b3745d163aafe02ffee4aa3f84` 复用现有 Profile/Bundle、Client Modules、Host WebServer carrier 与 HMR 基础；按 Wallpaper Engine 插件 commit `d1d82d12e581d04017da7e798957c55a65003b4c` 固定可运行来源。上游 Host/Client 入口仍不执行，未新增通用 DSH Client Extension Host。
- `packages/boot/plugin-manager` 为固定来源注册 Windows 原生 Video Host：读取 Steam 注册路径及 VDF 库，只返回 32 位项目摘要 ID；每个容器最多检查 1200 项，总计最多 600 项，单个项目 JSON 上限 256 KiB，Video 文件上限 4 GiB，库存缓存 5 秒。媒体路由使用认证用户当前选择，Range 单段最多 64 MiB，并发最多 2 路；停用时取消已打开流，生命周期变化时拒绝未完成读取。
- 新增外观 `appearance.wallpaperEngine.enabled/projectId`，默认 `false`/空字符串，旧账户缺字段时补安全默认；设置中心可扫描、选择并启停视频，工作台只在页面可见且减少动态效果未启用时开始播放，隐藏或减少动态效果时卸载媒体源。原有 `appearance.backgrounds` 不变。此首阶段仅 Windows MP4 Video；Web/Scene/上游 UI、真实 Provider 自动安装/启用闭环均未验。
- 定向回归：Plugin Manager 与 Wallpaper Engine Host 10/10、Settings 持久化/迁移 6/6、Web Profile 插件 Owner/API 认证与审批边界集成 1/1 通过。`tsconfig.host.json`、`tsconfig.client.json` 类型检查通过；Plugin Manager、Settings、API Remotes、Plugin Controller、Client Connection、UI Settings General、UI Settings、UI Layout 8 个包构建通过；控制端构建与 Web Vite 构建通过；`git diff --check` 通过。产物均位于根 `dist/`。Web 构建仍报告一个约 1.36 MB 的压缩前 JS chunk 超过 500 KB 提示。
- 本机 Windows Steam 只读验收发现 16 个 Workshop Video 项目，并从第一个项目经 Host 实际读取 64 字节 MP4 Range；未安装/启用真实插件或播放视频。浏览器/桌面播放仍未验。
- `pnpm` 构建入口此前因本地 lockfile/`node_modules` 一致性检查要求无交互删除并重装整个依赖目录，返回 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`；没有执行该清理，改用仓库自带的 `build-harness.mjs`、直接 TypeScript 和 Vite 命令完成上述检查。未重启正在运行的服务。
- 性能证据仅包括源码工作量边界：Steam 根最多 8 个、库最多 32 个、最多扫描 12,000 个项目目录项、单个 VDF 最多 1 MiB、单份项目 JSON 最多 256 KiB 且 JSON 总读取最多 16 MiB、最多返回 600 个项目、4 GiB 媒体上限、5 秒库存缓存、64 MiB 单段 Range、2 路并发及流/未完成请求的生命周期清理。尚未在浏览器或 Tauri 实测播放、CPU/GPU/帧时间、连续播放或实际 Steam 库。构建与合成临时目录回归不能替代这些验收。

## LFAA-UI-AI-APPROVAL-QUICK-ACTIONS-01

### 用户目标与可观察表现

- AI Work 因工具操作暂停并等待用户审批时，右下角审批提醒直接提供“批准本次操作”和“拒绝”两个动作；用户无需先打开会话，再在消息活动记录中找到审批卡。
- 提醒主体仍可点击打开对应 AI Work 会话；点击批准/拒绝只提交当前这一项审批，不改变权限模式或创建记忆授权。
- 提交成功后提醒显示真实处理结果；服务端拒绝、过期或其他失败时保留可用的会话入口并显示真实错误，不伪报成功。

### 运行入口、设置与 Owner

- 运行入口：`apps/web` 与共用 Client 的桌面 WebView 中，应用 AI Work 等待审批时显示的全局右下角提醒。
- 审批提醒事件由 `packages/client/ui-chat/src/AiWorkChat.tsx` 从现有 Agent 活动生成；通知载荷及类型由 `packages/client/resources/src/notification-runtime.ts` 定义；提醒和快捷操作由 `packages/client/ui-layout/src/Workbench.tsx` 呈现。
- 前端通过 `packages/client/connection/src/api.ts` 的 `decideAiApproval` 调用现有认证 API；账户、会话、App、工具版本、风险、目标范围与参数摘要校验仍由服务端审批 Owner 和 Agent Runtime 执行，快捷按钮不获得主机/Daemon 执行能力。
- 设置盘点：`general.permissionNotifications` 默认 `true`，控制 AI Work 审批提醒；`permissions.mode` 默认 `ask`，另有 `approve_remembered` 与 `full_access`，控制何时需要逐项审批及记忆授权。快捷批准固定为本次批准，不写记忆授权；不新增字段、不修改用户偏好或服务端策略。
- 外观设置继续使用当前 `.workbench-shell` 主题映射和 CSS 令牌：主题、强调色、界面字体/字号、对比度、壁纸遮罩、模糊、半透明与减少动态效果沿用现有配置。本次不新增 CSS 自定义属性、主题映射或设置项。

### 当前合同与安全边界

- 仅当通知类型为 `approval` 且包含本次服务端发来的 `approvalId` 时显示操作按钮；其他完成/错误提醒不显示审批动作。
- 点击“批准本次操作”或“拒绝”仅调用 `decideAiApproval(approvalId, decision)`。审批 ID 仍由服务端校验身份、记录状态并绑定原工具调用；Agent Runtime 仍按原审批记录轮询并消费一次性授权。
- 保留原有通知正文点击后打开关联会话的行为；不改变权限模式、记忆授权规则、审批有效期、工具参数、写入栅栏、审计或执行结果语义。
- 结果更新必须依据真实 API 返回；过期/冲突/网络错误要向用户显示，不能本地假定已批准或已拒绝。

### 允许修改

- `packages/client/resources/src/notification-runtime.ts`：给 AI Work 审批提醒载荷增加可选审批 ID。
- `packages/client/ui-chat/src/AiWorkChat.tsx`：在现有审批提醒中携带服务器发来的审批 ID；继续遵守 `general.permissionNotifications`。
- `packages/client/ui-layout/src/Workbench.tsx`：在全局右下角审批提醒中展示并处理单次批准/拒绝，复用现有审批 API，呈现真实成功或错误状态。
- `packages/client/ui-workspace/src/module-workbench.css`：为右下角提醒的按钮行补充响应式布局、令牌化颜色与键盘焦点反馈。
- `packages/client/ui-settings/src/SettingsPage.tsx`：更新审批提醒设置说明，反映通知卡现在可直接批准/拒绝。
- 本合同及任务索引；如验证发现必须同步的现有任务实施记录，可仅更新其与本行为直接相关的状态描述。

### 禁止修改

- 不改变服务端审批授权、权限模式、账户/会话/App 隔离、认证、审批过期、记忆授权、工具或 Daemon 执行行为；不增加第二审批服务或测试专用通路。
- 不修改通知总开关的默认值和持久化，不新增设置字段/CSS 变量/外部依赖；不改变其他完成与错误通知的打开/关闭行为。
- 不删除消息活动中的既有审批说明和会话入口；不提交、发布或部署；不覆盖或清理工作区既有未提交修改。

### 验收条件

- 等待审批的全局提醒可直接批准一次或拒绝一次，操作时有防重复提交状态；主体仍可打开会话，非审批通知不出现这些按钮。
- API 成功、审批已过期/已处理和网络失败均准确反映结果；无任何前端成功模拟或绕过服务端权限校验。
- `general.permissionNotifications` 仍控制审批提醒，三个权限模式和记忆授权语义不变；新增提醒样式使用现有外观设置令牌并支持窄视口、键盘焦点。
- 运行直接相关的审批/权限回归、完整 Web TypeScript/Vite 构建与本任务 `git diff --check`；实际浏览器操作可用时核对 toast 位置、窄宽度、直接动作和主题映射。未运行项如实登记。

### 实施记录

- 审批事件将服务端活动中的 `approvalId` 带入工作台通知；右下角提醒在待处理期间保持显示，可直接调用 `decideAiApproval` 批准本次或拒绝。请求期间两个按钮均显示忙碌并禁用；成功后通知展示结果并按普通提醒自动收起，API 错误保留审批按钮并显示错误。提醒主体仍可打开原会话。
- 通知类型只扩展可选审批 ID；未携带工具参数或范围数据，系统级浏览器通知只接收原 App/会话导航目标。服务端审批、权限模式和记忆授权逻辑未改。快捷批准不设置 `remember`，符合“仅批准当前这一次”。
- `general.permissionNotifications` 默认值及开关逻辑保持不变；提醒按钮使用现有 AntD 工作台主题与 CSS 表面、文字、强调色、焦点令牌，未增加配置、CSS 自定义属性或依赖。设置中心说明已同步。
- `pnpm --filter lfaa-web run build`（TypeScript + Vite）通过，产物位于根 `dist/apps/web/`；`pnpm --filter @yubboo/lfaa run test -- tests/execution-control.test.mjs` 12 项通过，覆盖三种模式和节点/任务归属边界；本任务 `git diff --check` 通过。
- 尚未在浏览器中生成真实待审批事件并点选批准/拒绝，因这会推进真实 Agent 工具调用；因此弹窗的实际交互与 Provider 侧继续执行尚未实测。`scripts/workspace-preflight.mjs` 在当前仓库不存在，也未运行不存在的 Gate。

## LFAA-UI-AI-INTERACTION-DOCK-01

### 用户目标与可观察表现

- 将当前分散在消息活动详情和右下角全局通知卡中的审批操作收敛为 AI Work 输入框上方唯一的交互栏；在当前会话中审批仅在此处批准本次或拒绝，活动列表只保留只读执行证据，右下角提示不再提供或重复审批操作。
- 当模型判断任务缺少会实质影响目标、安全、操作范围或结果的信息时，可调用通用 `lfaa_ask_user` 工具暂停当前 Agent Run，提出一个问题并给出 2–4 个模型生成的选项；用户可点选、在问题卡内输入补充，或跳过。答案作为真实用户消息记入当前会话并回传同一模型工具循环，当前 Agent 继续运行。
- 问题卡和审批卡复用同一个交互栏位置，同一活动 Agent Run 一次仅显示一个待处理交互；未接入 Provider 工具调用的能力不得以假 UI 冒充。页面关闭/宿主退出不重放运行或写操作。

### 运行入口、设置与 Owner

- 运行入口：`apps/web` 及共用 Client 的桌面 WebView；AI Work UI 由 `packages/client/ui-chat/src/AiWorkChat.tsx` 管理，真实会话与活动归 `packages/core/session/src/sessions.ts`，Agent Run 生命周期归 `packages/core/agent-loop/src/runs.ts` 与 `execute-turn.ts`，认证 API 由 `packages/api/session-controller/src/index.ts` 提供。
- 审批仍由 `packages/permission/*` 既有 owner 管理；输入答案必须绑定当前登录用户、活动 run、当前 questionId。业务参数、项目权限模式、一次性审批、审批有效期和 Daemon 执行边界均保持原合同。
- 设置盘点：`general.permissionNotifications` 默认 `true`，既有 UI 控制审批后台提醒；`general.questionNotifications` 默认 `true`、服务端已校验持久化，本任务将该既有设置接入澄清问题的通知中心/后台提醒；关闭通知不隐藏当前会话必需的交互栏。`permissions.mode` 默认 `ask`，并提供 `approve_remembered`、`full_access`；交互栏批准只作用于当前一次，权限语义不变。无新增设置字段。
- 外观沿用现有 `.workbench-shell` 设置映射与令牌：主题、强调色、文字对比度、界面/内容字体及字号、壁纸遮罩、模糊和减少动态效果；不新增 CSS 自定义属性、默认值或独立主题系统。

### 当前合同与安全边界

- `lfaa_ask_user` 仅由模型工具调用，通用参数为问题文本和 2–4 个选项；服务端校验问题长度、选项数量/长度和账户归属。它不执行业务写入、不要求审批、不改变模型或项目工具可用范围。
- 待答问题以当前 assistant 活动记录为权威，答案 API 必须验证认证账户、run 所有者、活动状态和 questionId 的一次性匹配。答案以当前会话用户消息持久化，并作为工具结果进入模型上下文；不接受通知点击或客户端本地状态替代服务端验证。
- 宿主重启或运行被取消后活动 run 仍按原规则中断；已失效问题不能接受答案或自动续跑。不会重放工具调用。UI 显示的选项文本按纯文本渲染。
- 审批卡只调用原有 `decideAiApproval(approvalId, decision)`；通知中心/浏览器通知只用于导航当前应用与会话，不显示第二份审批或问题操作卡。

### 允许修改

- `packages/core/session/src/sessions.ts`、`packages/client/connection/src/api.ts`：扩展真实活动/问题字段类型与持久化读取校验。
- `packages/core/agent-loop/src/runs.ts`、`packages/core/agent-loop/src/execute-turn.ts`：提供当前 run 单问题等待/一次性答案接收，以及模型可自主选择的通用提问工具；支持取消并清理等待者。
- `packages/api/remotes/src/route-contracts.ts`、`packages/api/session-controller/src/index.ts`：增加带认证、所有权、run 状态及 questionId 校验的问题回答路由。
- `packages/client/ui-chat/src/AiWorkChat.tsx`、`packages/client/ui-chat/src/ai-work-chat.css`：移除活动详情的审批按钮；在 composer 上方实现唯一审批/问题交互栏、选项、自由输入与跳过。
- `packages/client/resources/src/notification-runtime.ts`、`packages/client/ui-layout/src/Workbench.tsx`、`packages/client/ui-workspace/src/module-workbench.css`：撤销全局审批操作按钮；保留后台通知与会话导航，活动会话的审批/问题不生成重复右下角操作卡。
- `packages/client/ui-settings/src/SettingsPage.tsx`：将已有 `questionNotifications` 字段接入可操作设置，并说明审批/澄清通过 composer 交互栏处理。
- 本合同及索引、`docs/系统总体架构.md`：同步记录单一交互 Owner、真实模型提问协议和通知边界。

### 禁止修改

- 不改账号/权限/审批/业务工具/Daemon 的授权边界；不新增第二套审批状态服务、运行控制器、会话历史或并行问题协议；不按关键词或固定任务流程替模型决定是否澄清。
- 不改变现有完整权限语义、记忆授权、审批超时或审批写入栅栏；不把提问选项持久化到设置、浏览器存储或通知卡。
- 不改无关设置默认值、外观映射、项目目录、业务文件或用户既有工作区改动；不提交、发布或部署。

### 验收条件

- 当前 AI Work 的审批卡仅在 composer 上方出现，批准/拒绝复用服务端审批 API；活动详情及右下角 toast 不再出现同一审批的第二组操作。
- 模型提出澄清时，当前 Agent Run 停留在真实 waiting_input 状态，问题/选项经 SSE 和持久化活动呈现；选项、自由回答及跳过均生成当前会话用户消息并恰好恢复同一模型工具调用，不触发 followupBehavior 队列分支或重复工具执行。
- 过期 run、伪造或重复 questionId、其他账户答案均被拒绝；取消/重启清理等待，不自动续跑；模型/Provider不支持工具调用时明确显示真实错误。
- `general.permissionNotifications` 与 `general.questionNotifications` 分别控制对应后台提醒，设置变更经既有账户设置 Owner 生效；交互栏始终跟随适用外观与减少动态效果设置，无新增 CSS 变量。
- 完成本任务范围的服务端/客户端直接相关构建、既有回归与 `git diff --check`；可用登录态时以真实 Provider 工具调用在浏览器目视核对两类交互、选项/自由输入/跳过、单一卡片及窄视口；未实际运行项单列。

### 实现与验证记录

- 已实现模型可自主调用 `lfaa_ask_user`，当前 run 在同一个工具循环中等待答案；选项点击、补充回答或跳过都会作为当前会话用户消息持久化并回传该次工具调用。活动记录只读显示，审批/澄清操作统一位于输入框上方；全局右下角通知不再重复呈现这两类操作卡。
- 设置中心继续使用既有 `general.permissionNotifications`、`general.questionNotifications`、`permissions.mode` 和外观令牌；没有新增设置字段或 CSS 变量。
- `pnpm --filter lfaa-web run build` 通过（TypeScript + Vite，输出位于根 `dist/apps/web/`）。`pnpm --filter @yubboo/lfaa run build` 已检查本次 Agent Run 代码无剩余类型诊断，但被工作区中未由本任务修改的 `packages/api/workspace-controller/src/index.ts:48` 可选 `title` 类型错误阻塞。未运行测试；未用真实 Provider 发起审批/澄清交互，也未做登录态浏览器目视验收。

## LFAA-UI-AI-DRAFT-PERSISTENCE-01

### 用户目标

审查主要工作区状态在页面刷新后的真实归属与恢复路径；让 AI Work 未发送输入按当前账户和应用保存，在刷新后恢复，避免长文本草稿只存在 React/Workbench 内存。

### 本轮持久化盘点

- 已有持久化：账户设置及应用/模式偏好由控制端保存；AI Work 会话消息和运行轨迹由服务端 JSONL/SQLite Owner 保存；当前 AI Work 会话 ID、主要工作区滚动位置和 Dock 状态由浏览器保存；写作作品/大纲/章节/修订及编辑位置由控制端保存；Minecraft 实例、部署和任务由对应 Server/Daemon 保存。
- 已确认缺口：AI Work 未发送草稿只保存在 Workbench 内存，刷新或浏览器重启会丢失；本任务补齐按账户和应用隔离的浏览器草稿恢复。
- 文件管理器的文本编辑缓冲区只存在组件内存，必须显式点击保存；应用内关闭对话框会警告丢弃，但整页刷新可能绕过它。文本可能是凭据或受保护文件内容，本任务不将其写入浏览器持久存储，列为后续需明确数据 Owner 的专项。
- 设置中心账户偏好有 300ms 自动保存；数据根目录、SteamCMD/Minecraft 路径和邮箱使用独立业务 API 并要求显式保存，未提交输入会在刷新后丢失。绝对数据路径和邮箱验证用当前密码不适合无差别复制到浏览器存储；后续应为安全范围建立恢复/离页保护策略，不把它们静默自动提交。
- 文件管理器当前节点、目录、列表和搜索条件保存在组件状态及有界短期内存快照；同一 SPA 内切换可从快照预热，整页刷新或浏览器重启后内存快照清空，仍需重新选择在线节点并恢复目录。它是浏览上下文恢复缺口，不是远程文件数据丢失；目录值受路径安全合同约束，不在本任务写入浏览器。
- Minecraft 多核心部署向导的核心/版本/节点/实例参数只在组件状态中；刷新会回到设置中心默认值。它可作为后续非许可草稿恢复项，但 EULA 同意必须在每次实际部署时重新勾选，不能恢复许可同意。
- 写作正文与大纲通过控制端自动保存到 SQLite；输入停止约 750ms 后发起保存，切换/失焦会调用 flush。整页刷新恰逢防抖窗口或网络失败时仍需单独评估恢复保护，不把当前自动保存描述为零窗口保证。
- 临时通知、弹层、搜索输入、加载提示等不包含已提交业务事实，按临时 UI 状态处理；不为“所有 state”建立无差别长期存储。

### 当前合同

- AI Work 草稿由 `packages/client/ui-layout/src/Workbench.tsx` 继续按应用持有；`packages/client/store/src/ai-work-drafts.ts` 提供唯一的浏览器读取/写入 Owner。
- 草稿键使用稳定版本前缀并按账户 ID、应用 ID 隔离；非空文本防抖 250ms 写入当前浏览器 `localStorage`，`pagehide` 与工作台卸载时冲刷待写值；空文本删除对应草稿。读取和写入失败不阻断聊天交互。
- 仅保存最多由现有 composer `maxLength` 限制的未发送文本；不保存聊天消息、认证信息、Provider 密钥、权限配置或任务结果。已发送消息仍以现有服务端会话存储为准。浏览器草稿不跨设备同步。
- 账户切换、应用切换、会话切换、发送和清空保持现有语义；每个应用只保留一个当前未发送草稿。已发送输入会沿用现有 `onDraftChange("")` 清理路径。
- 设置中心盘点：没有控制 AI Work 草稿保留期限或同步范围的既有配置。本次不新增设置项、不变更默认值；无外观变更，现有主题映射继续生效。
- 旧 `LFAA-UI-APP-CONTEXT-01` 与 `LFAA-UI-SCROLL-RESTORATION-SHARED-01` 中“草稿不持久化”的历史规则，仅由本新合同覆盖为“草稿在当前浏览器按账户/App 持久化”；其余会话消息、账户配置和认证信息边界不变。

### 允许修改

- `packages/client/store/src/ai-work-drafts.ts`：实现账户/App 隔离的草稿键与容错读写。
- `packages/client/ui-layout/src/Workbench.tsx`：启动时恢复草稿，输入变化时防抖保存，并在 `pagehide`/卸载时冲刷和清理计时器。
- `apps/cli/tests/client-persistence.test.mjs`：验证账户/App 隔离、清空以及浏览器存储不可用时的降级行为。
- `docs/PROMPTS.md`、`docs/系统总体架构.md`：维护本合同、审查发现与现行存储事实。

### 禁止修改

- 不修改 AI 消息/任务 API、服务端会话格式、认证、权限或已提交消息的持久化 Owner；不将本地草稿伪装成跨设备账户同步。
- 不把任意文件编辑器内容、远程文件路径、Minecraft EULA 同意、认证/Provider 凭据写入浏览器存储。
- 不修改 File Manager、Writing、Minecraft 部署向导或设置中心实现；这些缺口只记录在盘点中，不扩大本轮实现边界。
- 不新增设置字段、依赖、数据库迁移、CSS 变量或后台请求；不覆盖或清理既有未提交修改，不提交、发布或部署。

### 验收条件

- 登录同一账户刷新后，AI Work 当前应用的未发送草稿恢复；切换应用时草稿互不串用；清空/发送后该应用草稿键被移除。
- 输入保存有界且有清理路径；刷新触发 `pagehide` 时先同步冲刷最新内存值；存储异常不影响继续输入、发送和浏览消息。
- 运行专用持久化回归、完整 Web TypeScript/Vite 构建和本任务差异检查。可用登录态浏览器时，分别实测输入后立即刷新、应用切换、草稿清空后刷新；未实测行为单独报告。

### 实施记录

- 合同在实现前登记。新增草稿存储 helper 按账户/App 生成版本化键；Workbench 首次挂载读取，输入后 250ms 防抖写入，`pagehide` 和卸载时冲刷并清理计时器，空草稿移除。没有在每次输入时同步写磁盘，也没有改服务端会话与已发送消息。
- 设置中心没有草稿保留时长或同步范围配置；本次未新增/修改设置项。草稿只保存在当前浏览器 `localStorage`，不跨设备同步；不写凭据、认证信息或权限配置。
- `pnpm --filter @yubboo/lfaa run test -- tests/client-persistence.test.mjs` 通过，2 项通过、0 失败，覆盖账户/App 隔离、清空与存储异常降级。
- `pnpm --filter lfaa-web run build` 通过，含 TypeScript 检查与 Vite production build，产物位于根目录 `dist/apps/web/`；本任务已跟踪文件的 `git diff --check` 通过。
- 登录态浏览器刷新验收未完成：Edge 标签连接返回 `nodeRepl.fetch request failed`；新开的本地 IAB 页面显示登录界面，没有可用登录态，因此没有输入凭据或发送测试消息。实际“输入后立即刷新再恢复”仍待登录态浏览器核验。
- 性能边界：每个应用最多一个 250ms 定时器，WorkBench 仅初始化时读取四个应用键，离页最多冲刷四个短文本；未采集真实浏览器帧时间。文件管理器未保存文本、写作自动保存防抖窗口和 Minecraft 部署向导草稿仍按本节盘点待后续专项处理。

## LFAA-UI-CLIENT-PERSISTENCE-CORE-01

### 用户目标

把客户端常用的可恢复状态持久化做成一个有版本、作用域、校验、异常降级和生命周期管理的共享能力，让 AI Work 草稿、会话选择及滚动恢复等消费者复用基础逻辑。

### 运行入口、设置与 Owner

- 运行入口：`apps/web` 及共用 Client 的桌面 WebView；基础实现位于 `packages/client/store`。
- 浏览器状态的存储 Owner 为共享 Client Store；各功能仍拥有自己的状态语义、序列化校验、作用域和何时写入策略。
- 设置盘点：当前没有通用浏览器状态持久化设置，也没有 AI Work 草稿保留期限/同步范围设置。本任务不新增或改动设置字段与用户偏好。
- 数据边界：通用浏览器存储仅服务显式选择的非敏感、可丢失客户端恢复状态。账户、会话消息、Agent/Minecraft 任务、写作正文、远程文件及其他业务事实仍由各自 Server/Daemon/领域 Owner 保存。

### 当前合同

- 在 `packages/client/store/src/browser-persistence.ts` 提供版本化、可作用域隔离的键构造、带类型编解码器的浏览器存储读/写/删除，以及可取消、可冲刷的防抖写入器；存储拒绝、损坏值和序列化异常不得打断界面交互。
- 防抖写入器负责计时、重复值避免、清空、`pagehide` 冲刷和卸载清理；调用方明确提供延迟、清空条件及值校验，不在每次按键时同步写入。
- 现有 AI Work 草稿键与滚动位置键格式保持兼容；AI Work 草稿、活动会话 ID 和滚动数值复用共享读写核心及生命周期能力。
- 现有 UI 状态的恢复期望不同：会话 ID 与滚动值立即写入；AI Work 草稿继续按账户/App 隔离、250ms 防抖、空文本删除。
- 不把浏览器持久化扩展为业务数据库、同步服务或通用自动保存；不得保存认证/Provider 密钥、密码、权限同意、EULA 同意、远程文件正文/路径或用户业务记录。
- 设置中心配置不新增/修改；既有主题、颜色、字体、壁纸和减少动态效果映射保持现状，不产生新 UI。

### 允许修改

- `packages/client/store/src/browser-persistence.ts`：共享浏览器存储键、codec、安全读写及防抖生命周期 Owner。
- `packages/client/store/src/ai-work-drafts.ts`、`packages/client/store/src/scroll-restoration.ts`：迁移到共享存储核心并保持原有键、节流/恢复及失败降级语义。
- `packages/client/ui-layout/src/Workbench.tsx`：AI Work 草稿调度和活动会话 ID 使用共享能力，保留账户/App 隔离。
- `apps/cli/tests/client-persistence.test.mjs`：覆盖作用域键、编解码、损坏/拒绝存储、防抖末值、清空、pagehide 冲刷及清理。
- 本合同与 `docs/系统总体架构.md` 中客户端存储 Owner 说明。

### 禁止修改

- 不迁移 Server/Daemon 业务存储，不修改 API、SQLite/JSONL 格式、账户权限或已提交业务记录。
- 不将其他表单、文件编辑器、Minecraft 向导或账户安全字段自动接入浏览器存储；后续消费者须先界定敏感等级、权威 Owner 和恢复语义，再显式调用共享能力。
- 不新增设置项、依赖、数据库迁移或持久化自动同步；不改动无关未提交文件，不提交、发布或部署。

### 验收条件

- 同一 key builder 对旧 AI 草稿、旧滚动位置及活动会话键生成兼容键；不同用户/App 的值不串用。
- 读取无值、损坏值或存储不可用时返回安全空值；写入、删除、JSON 编解码异常返回失败/降级，不抛入产品交互。
- 连续调度仅提交最新值；空草稿清除旧值；`pagehide` 会冲刷待写值；dispose 后移除监听、清理 timer 并按合同冲刷。
- `pnpm --filter @yubboo/lfaa run test -- tests/client-persistence.test.mjs` 与 `pnpm --filter lfaa-web run build` 通过；差异检查不引入空白错误。浏览器未实测项单列报告。

### 实施记录

- `packages/client/store/src/browser-persistence.ts` 实现通用版本/作用域键、字符串/有限数字/守卫式 JSON codec、异常安全浏览器读写与相同值短路；防抖写入器集中管理单个待写值、定时器、条件清除、`pagehide` 冲刷及 dispose 释放。
- AI Work 草稿、活动会话 ID 与滚动位置迁移到共享读写核心；草稿与滚动历史键格式保持不变，活动会话键沿用滚动存储命名空间，不需要数据迁移。草稿按原 250ms 策略写入；会话 ID 与滚动位置仍即时/按既有节流策略保存。
- `apps/cli/tests/client-persistence.test.mjs` 5 项回归通过，覆盖旧键兼容、账户/App 隔离、scope 编码、版本隔离、JSON 类型校验、坏值清理、存储异常、相同值短路、防抖末值、清空、`pagehide` 冲刷及卸载清理。
- `pnpm --filter lfaa-web run build` 通过，含 TypeScript 和 Vite production build，产物位于根 `dist/apps/web/`；目标 `git diff --check` 与新文件尾空白检查通过。
- 设置中心没有通用客户端持久化或草稿同步配置；本次未新增/修改设置项、主题令牌、API、Server/Daemon 存储 Owner 或业务数据格式。
- 登录态浏览器刷新未实测，当前没有可用登录态；因此即时输入刷新恢复与真实页面交互仍待核验。未采集浏览器帧时间；每个应用最多一个防抖 timer，生命周期由工作台 effect 绑定并在卸载时释放。
- `packages/client/store` 当前没有 package README；本次未新建宽泛包说明，相关存储职责已记入系统架构文档。

## LFAA-AI-WORKSPACE-PROJECTS-01

### 用户目标

在当前应用的 AI Work 输入框上方提供类似 ChatGPT/DSH 的项目目录选择与管理：按真实 Daemon 主机浏览/创建文件夹，选择或取消当前应用会话的项目，查看按项目分组的会话，并明确区分通用项目目录与 Minecraft 游戏实例。项目归属当前应用，不跨 App 混用；新建项目只登记目录并建立当前 App 内的会话分组，不创建新 App 或 Minecraft 实例。用户已确认管理“通用项目目录”；Minecraft 实例继续由 Minecraft 领域 Owner 管理。

### 运行入口、设置与 Owner

- 运行入口：`apps/web` 与共用 Client 的桌面 WebView；项目入口位于共享 `packages/client/ui-chat/src/AiWorkChat.tsx` Composer；会话分组由 `packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 展示。
- 项目注册与节点目录由 `packages/workspace/workspace` 作为单一业务 Owner；项目身份按账户、应用、Daemon 节点与真实目录持久化。目录浏览、规范路径验证及新建子目录由目标节点 Daemon 执行，不让浏览器直接访问文件系统。
- 会话项目归属随 `ai_sessions` 的权威 JSONL 会话记录持久化，认证 API 验证当前账户及项目所有权；已存在的无项目历史继续归入“未分组”。
- 已有文件所有者不合并：通用 `/files` 继续只管理节点 `LFAA_DATA_DIR`，保持管理员授权、节点能力检查及现有实例/凭据保护；通用 AI 项目文件操作绑定会话所选项目的节点和目录。Minecraft 实例路径、状态与操作始终归 Minecraft 领域服务，不能由通用项目选择覆盖。
- 设置盘点：沿用 `general.taskFolder` 作为现有默认任务目录/首次浏览位置；未配置时使用目标 Daemon 报告的实际主机 Home 目录。目录注册和会话项目关联不新增设置字段。Composer 与新管理界面继续使用当前外观设置及 `.workbench-shell` 主题映射，包含主题、强调色、字号/字体、对比度、壁纸、遮罩、模糊和减少动态效果；不新增 CSS 自定义属性、依赖或动画框架。

### 当前合同与安全边界

- 仅显示真实报告 `project-files-v1` 的已登记 Daemon 节点；本机节点标记“此计算机”，其他节点使用真实名称/在线状态，不把未知节点伪称为云端。离线项目保留目录和会话历史，但不能假报可浏览或可写。
- 项目记录含 UUID、账户 ID、应用 ID、节点 ID、Daemon 实际规范目录、标题及时间。相同账户/应用/节点的规范路径重复登记返回既有项目；不同应用或不同节点上的同名路径是不同项目。重命名只改标题。移除项目只删登记关系，不能删除主机文件夹或 AI 会话；原会话仍按保存的项目标题显示在“已移除项目”组并保留原目录上下文，不会自动绑定后来重登记的新项目身份。
- 用户可为新会话选择当前 App 的项目，也可将当前未运行的既有会话切换/移出本 App 项目；服务端必须拒绝跨 App 项目列表、绑定、文件上下文和管理操作。切换仅变更会话项目关联，不移动文件、不删历史、不停止/重放任务。现有消息、归档、会话 App 隔离继续生效。
- 目录枚举必须逐层、有界、稳定排序，只返回目录，不递归扫描整个盘；目录创建只允许在已确认的现有父目录下创建一个名称有效的子目录。读写路径和文件夹名通过请求体发送，不能放入 URL、普通日志或缓存；Daemon 校验绝对路径、规范路径和符号链接，API 校验认证账户、节点能力与项目 Owner。
- 已选择项目时，`project.files` 只能使用该会话项目的节点和根目录；模型不能覆盖节点或扩大根目录。项目选择只指定上下文，不代表读/写授权；工具仍服从 `permissions.mode`、现有审批/记忆授权、Agent 执行校验和 Daemon OS 账户权限。无项目会话继续沿用既有 `general.taskFolder` 与项目文件工具合同。
- 会话分组仅将当前 App 中已有会话投影到对应项目、“已移除项目”或“未分组”；不复制会话记录或消息，不推断项目路径自标题。搜索/列表与文件目录读取必须设定有界结果，防止长列表和过期请求覆盖新选择。
- 不改变 Minecraft、SteamCMD、Writing 的领域数据或工具权限；选择通用项目不能创建、切换、部署或修改 Minecraft 实例。

### 允许修改

- `packages/workspace/workspace/`：新增集中项目注册与持久化 Owner、类型、实现说明及 package README；源码保持在现有 `packages/workspace` 领域目录。
- `packages/storage/storage-sqlite/src/database.ts`：以原子、幂等版本迁移创建账户项目注册表，保留既有行及历史。
- `packages/host/daemon/src/project-files.mjs` 与 Daemon 装配/能力清单：增加受校验、限时等待且有界的目录浏览、目录校验和单层新建能力；超时明确表示结果未确认，不自动重放；保留当前 AI 文件操作。
- `packages/api/workspace-controller/` 与当前 API 包装配：提供认证的项目列表/创建/改名/移除、目录浏览/新建和会话关联入口；禁止路径参数进入 URL。
- `packages/session/session-persistence-jsonl/src/repository.ts`、`packages/core/session/src/sessions.ts`：持久化并返回项目关联；`packages/api/remotes/src/route-contracts.ts`、`packages/api/session-controller/src/index.ts`、`packages/core/agent-loop/src/runs.ts`、`packages/core/agent-loop/src/execute-turn.ts`、`packages/core/tools/src/business-tools.ts`、`packages/core/tools/src/project-tools.ts`：校验会话项目、传递受信项目上下文，并把项目文件工具限制在会话已选目录。
- `packages/client/connection/src/api.ts`、`packages/client/ui-chat/src/AiWorkChat.tsx`、`packages/client/ui-chat/src/ai-work-chat.css`、`packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 及该功能必需的包清单/工作区装配：实现项目选择与管理、当前会话绑定和会话侧栏分组。
- `apps/cli/tests/`：增加可长期维护的项目注册、目录校验、账户/节点隔离、会话归属和项目文件范围回归。
- `docs/系统总体架构.md`、`docs/开发计划.md`、`docs/harness-storage.md`、`docs/harness-packages.md`、`docs/harness-packages.json`、本合同及新 Owner 的 README：同步项目/会话/Daemon/文件管理职责、迁移版本、包状态与真实能力边界；必要的包名和依赖变化同步锁文件。

### 禁止修改

- 不把通用项目包装成 Minecraft 实例，不从通用项目目录推导游戏实例 ID/路径或改变 Minecraft 业务 Owner；新建项目不会创建新的应用 App。
- 不用现有管理员 `/files` 接口绕过认证/角色约束；不扩大 `/files` 到用户主目录，不向浏览器传递 Daemon 密钥或文件内容，不将项目绝对路径放进 URL/普通日志/长期浏览器存储。
- 不删除项目文件夹、会话、消息、运行任务或 `LFAA_DATA_DIR` 数据；不因项目移除自动隐藏/删除会话历史，不自动停止或重放任务。
- 不新增通用项目云端执行器或虚构 Cloud 能力；仅呈现 Daemon 实际报告的本机/远程节点。项目选择不得改变三种权限模式、设置默认值、实例路径或既有 file-manager 权限。
- 不修改与本功能无关的预存工作树差异；不提交、发布或部署。

### 验收条件

- 认证账户可浏览在线节点的真实目录、注册/创建项目、搜索/选择/改名/移除项目；相同规范路径不重复，异节点不串用；移除项目不会删除目录、会话、消息或运行任务。
- 新会话与项目正确关联；更改/清除现有会话项目后服务端与侧栏一致；旧会话仍可作为未分组会话打开；运行中会话不可更改项目。
- 项目文件工具使用会话保存的实际节点和根路径，越权改节点、越界路径、符号链接越界、非所有者项目及未知项目均被拒绝；无项目时旧 taskFolder 行为不回归；选择项目不能绕过 ask/approve_remembered/full_access 授权。
- 通用 `/files` 仍严格局限于管理员可访问的 `LFAA_DATA_DIR`；Minecraft 实例及运行态仍来自 Minecraft Server/Daemon Owner。
- 项目与会话按当前应用归属；新建项目创建的是当前 App 下的目录登记/AI 会话分组，不是新应用或游戏实例。
- 对新迁移前后、账户隔离、重复路径、节点离线/超时、目录并发操作、路径越界、会话分组/移除与工具权限运行目标回归；运行相关包构建、Web TypeScript/Vite 构建和 `git diff --check`，产物仅位于根 `dist/`。报告列表/目录规模和客户端订阅/请求生命周期；浏览器主题/桌面、真实远程节点与帧时间未实测时分别列明，不以构建替代实机验收。

### 本轮实现及核查（2026-10-01）

- 输入区项目菜单支持有界列表/搜索、目录选择、一级新建、重命名和移除登记；新会话可以绑定项目，空闲会话可以改绑/取消；侧栏按项目展示会话。已移除登记的项目仍保留既有会话和目录元数据，不删除磁盘文件或消息。项目文件 Tool 读取会话内的受信节点与目录，不接受模型扩大的根路径。
- Daemon 目录枚举最多扫描 5000 项、最多返回 500 个文件夹；账户项目列表最多返回 200 项，服务端搜索可检索更早登记项。路径验证和读写仍在 Daemon；项目选择不修改 permissions.mode。通用 /files 保持管理员数据根目录边界，Minecraft 实例保持 Minecraft Owner。
- 设置沿用 general.taskFolder 作为目录浏览默认起点；主题与界面外观沿用 Appearance 及工作台主题映射。本轮未新增设置字段或 CSS 自定义属性。
- node --test apps/cli/tests/project-files.test.mjs apps/cli/tests/workspace-projects.test.mjs apps/cli/tests/agent-runtime.test.mjs：4 项通过，覆盖目录数据根保护、项目账户/节点隔离、Windows 路径去重、200 项结果上限/历史搜索、会话关联与历史保留。
- pnpm run build：通过，含 Harness 能力包、Web TypeScript/Vite、控制端和 CLI；构建输出在根 dist/。`git diff --check`：通过。
- 性能边界证据：项目查询最多取 200 条并可服务端搜索更早项目；目录枚举扫描上限 5000、返回上限 500；侧栏分组用项目索引映射避免逐会话扫描全部项目。真实浏览器请求时序、渲染帧时间和远程 Daemon 延迟未测，不能据此声称交互性能已验收。
- 未运行认证浏览器、实际本机/远程 Daemon 项目浏览、Tauri 外观或帧时间测量；本地回归使用隔离临时目录，不代表目标机器端到端验收。

### 缺陷复现与修正合同（2026-10-01）

- 用户反馈：Minecraft AI Work 下项目功能无法使用，且项目与当前应用的关系不明确。截图显示项目列表返回“找不到请求的接口”，创建窗口没有可选节点。
- 本机只读复现：`GET /api/workspace/projects` 返回 404；`GET /api/ai/sessions?appId=minecraft` 返回 401（证明会话路由存在并执行认证）。源码和根 `dist/apps/control-plane` 已包含 workspace controller，但端口 3000 上的控制端进程早于该构建启动，未加载新路由。
- 源码缺陷：项目表和 API 以账户为范围，没存当前 App；Minecraft、Workspace 项目目录混在一个列表中。必须加入应用归属并在服务端列表、登记、会话绑定、工具上下文和项目管理 API 校验同一 App。
- 用户语义：项目是当前 App 下的真实目录登记和会话分组；不会生成新的应用、实例或云端工作区。Minecraft 游戏实例生命周期保持独立。
- UI 必须把项目接口加载失败与会话列表错误分开显示，并在新建面板解释项目与当前 App 的关系、给出 Daemon 缺失的明确原因。
- 修复记录：数据库版本 35 已在运行中的本机数据目录迁移到 38；`workspace_projects` 当前为 0 条。迁移仅新增 `app_id` 并保留旧记录为待归属，不移动或删除文件。
- 回归：`node --test apps/cli/tests/workspace-projects.test.mjs apps/cli/tests/agent-runtime.test.mjs apps/cli/tests/project-files.test.mjs` 通过（4/4）；`pnpm run build` 首次在 npm CLI 组装时报缺少 `workspace.json`，完整顺序重跑通过，产物在根 `dist/`；`git diff --check` 通过。
- 运行态：旧控制端 PID 43012 启动早于此次构建，返回 404。停止已确认的 LFAA Web/Daemon 进程树后，以 `pnpm lfaa web` 加载新构建；健康检查 200，未认证的项目列表和会话列表均返回 401 `authentication_required`（路由已注册并进入认证闸门）。本机 Daemon 启动。Windows `pnpm dev` 包装器调用 `powershell.exe` 时，现有 `scripts/start-dev.ps1` 解析失败；本轮未改动该启动器。
- UI 限制：Edge 自动化连接返回 `nodeRepl.fetch request failed` 且未枚举出标签页，因此没有验证登录态的项目浏览、新建、会话绑定和视觉呈现。需要在现有浏览器刷新后做账户态交互验收；不能把匿名 API 检查或构建说成完整 UI 验收。

## LFAA-LOCAL-GIT-WORKTREES-01

### 目标与运行入口

在现有 AI Work 项目会话上提供真实 Git 状态、改动文件与差异摘要、账户可见的隔离 AI Worktree，以及对隔离工作树的明确确认恢复。Web 与 Tauri 共用当前客户端/API；控制端只经认证 API 读取项目登记、设置和会话；所有 Git 子进程只在该项目所属且报告 `git-workspace-v1` 的 Daemon 上执行。Pull Request、GitHub OAuth、远端 push/merge、代码审查 Runtime 和 screenshot 中其他集成入口不属于此合同。

### 设置、数据与权限 Owner

- `settings.git.branchPrefix` 是账户设置，默认 `codex/`，创建 Worktree 时唯一读取并由 Git 检查合法引用；未采用 force push、PR 或远端行为。
- 现有外观设置继续控制 Git 变更面板的主题、强调色、字体/字号、对比度、背景遮罩/模糊与减少动态效果；不得通过组件局部常量覆盖用户偏好。
- `workspace_projects` 与会话项目绑定仍是项目/会话 Owner；项目和 Git Worktree 归属继续按 `workspace` / `minecraft` 的 `appId` 隔离（项目应用归属迁移 38）。新增 Git Worktree 元数据记录账户、应用、源项目、Daemon 节点、受管路径、分支与恢复基线。真实仓库状态和 diff 的唯一 Owner 是目标 Daemon 上的 Git。
- 控制端不直接读取任意主机路径。API 从当前账户项目记录解析节点和根目录，Daemon 校验仓库顶层、规范路径、数据目录边界和管理工作树根；请求路径只放在 JSON body/内部队列，不进入 URL 或普通日志。
- 页面读取受账户认证与项目所有权校验约束。创建/恢复/移除是明确用户操作；Agent 对普通文件写入继续服从现有 `permissions.mode`、审批及 Daemon OS 身份，不由 Git 能力绕过。
- 项目浏览、会话项目绑定、Git 状态、恢复和删除都绑定当前 `appId`；通用 AI Work 与 Minecraft AI Work 可分别登记同一目录，不能跨 App 读取或移除对方项目。

### 当前合同与安全边界

- 创建隔离工作树不得 stash、checkout、reset、stage、提交或覆盖源目录；用独立临时 Git index 构造包含源目录已跟踪及未忽略未跟踪改动的快照，再从该快照创建新分支。忽略文件不会被复制。失败时清理临时 index 和部分工作树；不能确认清理时报告真实残留位置。
- 受管 Worktree 位于 Daemon `LFAA_DATA_DIR` 下专属 Git 工作树根，仅通过受认证创建并登记。普通项目目录仍拒绝访问 `LFAA_DATA_DIR`；项目文件工具仅在受管 Worktree 项目登记后可访问其真实目录。
- 状态和变更摘要取自 `git status` / `git diff`，输出有界、路径稳定排序、拒绝外部 diff/textconv；必须区分已跟踪差异、未跟踪文件、截断状态，不把模型文字作为 Git 事实。刷新或重启后可按账户、会话和项目元数据重新读取。
- 恢复仅允许受管 Worktree：恢复其记录的起始 commit，并移除非忽略未跟踪文件；不使用 `git clean -x`，不触碰源项目、忽略文件、其他 Worktree 或任意绝对路径。清理整个受管 Worktree 需二次确认并经 Git Worktree 路径校验。
- 不自动提交、推送、合并、应用差异到源项目或重放中断中的命令。AI Work 项目上下文与会话归属继续使用现有 Owner。
- 读取一次 Git 快照使用单个受限 Daemon 任务，无轮询式全仓扫描；页面仅在项目/会话改变、用户刷新或操作完成时加载并取消过期请求；diff/文件/进程输出有严格字节、时间和条数上限。

### 允许修改

- `packages/storage/storage-sqlite/src/database.ts`、`packages/storage/storage-domain/src/migration.ts`：增加幂等账户隔离的 Git Worktree 元数据迁移。
- `packages/workspace/workspace/src/index.ts` 与 README：扩展项目 Git Worktree 元数据读写，维持项目注册唯一 Owner。
- `packages/host/daemon/src/daemon.mjs`、`packages/host/daemon/src/git-workspace.mjs`、`packages/jobs/jobs/src/ai-host-tasks.ts`、`packages/api/remotes/src/route-contracts.ts`：登记 Git Worktree Daemon 能力，执行固定 Git 操作集合并限制时长/结果大小。
- `packages/api/workspace-controller/src/index.ts` 与 API 包清单：提供账户隔离的状态、创建隔离 Worktree、恢复、删除受管工作树 API。
- `packages/settings/settings/src/service.ts`、`packages/api/settings-controller/src/index.ts`、`packages/api/remotes/src/route-contracts.ts`、`packages/client/connection/src/api.ts`、`packages/client/ui-settings-general/src/default-settings.ts`、`packages/client/ui-settings/src/SettingsPage.tsx`：加入有服务端校验与持久化的 Git 分支前缀设置，并启用 Git/Worktrees 设置入口。
- `packages/client/ui-chat/src/WorkspaceProjectPicker.tsx`、`packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 与关联 UI/CSS：创建和选择 AI Worktree，在 AI Work 右侧展示真实 Git 状态、分支、变更文件与有界 diff，并提供已确认的恢复/删除。
- `apps/cli/tests/`、本合同、当前架构文档、相关 package README：增加直接回归并同步 Owner/能力边界。

### 禁止修改

- 不触碰已有不相关未提交改动，不进行 `git reset`/`stash`/`checkout`/`clean` 于当前仓库，不 stage/commit/push/发布/部署。
- 不通过 Shell 字符串开放任意 Git 子命令，不接受浏览器提交可执行命令、可替换 Owner 的节点 ID 或未经 Owner 校验的本机路径。
- 不向源项目自动应用 AI 分支差异；不把恢复表述为可撤销源目录修改；不删除忽略文件、原仓库数据、用户会话或其他工作树。
- 不实现或显示 PR/GitHub、force push、远端合并、自动合并、审查/监控修复、浏览器/电脑控制或云端功能为已接入。

### 验收条件

- 旧数据库可原子升级且原账户/项目/会话/任务保留；新 Git 元数据账户隔离，源项目与受管 Worktree 均可跨刷新/服务重启恢复其身份和基线。
- 在测试仓库验证包含 staged、unstaged、非忽略未跟踪内容的快照能进入新 Worktree；源 HEAD、真实 index、工作区文件逐字节不变；非法引用、非 Git/无 HEAD 仓库、符号链接越界、超限输出/超时、跨账户/跨节点/越权请求拒绝。
- AI Work 选择受管 Worktree 后，现有 `project.files` 和 Shell 项目上下文在该 Worktree 路径执行；右侧状态/摘要与 Git 输出一致，更新后无需刷新可见，刷新后仍可重新读取；未跟踪与截断信息标示准确。
- 两次确认后恢复只把受管 Worktree 返回记录基线并移除非忽略未跟踪文件，源目录、其他工作树与 ignored 文件保持不变；删除受管树只清除这一注册工作树。
- 运行 SQLite 迁移/Owner/Daemon/API 直接回归、相关包构建、Web 构建和 `git diff --check`，产物仅在根 `dist/`。记录结果/输出上限和性能边界；未接真实 Daemon/浏览器时明确标出，不将构建通过称为端到端验收。

### 实际实现与核查（2026-10-01）

- `packages/host/daemon/src/git-workspace.mjs` 在真实项目所属 Daemon 执行固定 Git 操作；创建快照使用独立临时 index，不 stage、checkout、stash 或改写源项目；分支前缀使用账户设置 `git.branchPrefix`。受管树保存在节点 `<LFAA_DATA_DIR>/git-worktrees/<UUID>`。
- 项目列表、会话绑定、Git 状态、恢复和删除均要求当前 `appId`；`workspace` 与 `minecraft` 独立选择，同一真实目录可分别登记。设置中心 Worktrees 页显示两种 App 的受管树。
- 设置中心 Git 页持久化账户分支前缀，Worktrees 页与项目选择菜单可管理 LFAA 受管工作树；AI Work 与 Minecraft AI Work 的右侧面板按需从对应 Daemon 读取真实分支、文件状态、行数和 diff。UI 复用既有 Appearance 主题令牌、强调色、字体/字号、遮罩/模糊与减少动态效果映射，没有增加 CSS 自定义属性或绕开现有外观设置。
- 恢复仅对有账户登记和基线的受管树开放，经过两步确认后执行 `reset --hard <baseline>` 和 `clean -fd`；不使用 `-x`，忽略文件保留。删除工作树有二次确认并验证 UUID/分支，不删除源仓库分支；向源项目应用改动、提交、推送、合并、PR、GitHub 与自动审查未实现。
- 输出/工作量边界：Git 单项默认超时 12 秒，快照 add 30 秒、worktree add 60 秒；差异最多 128 KiB、最多呈现 200 个文件，未跟踪文本扫描最多 1 MiB。页面不轮询，只在选择项目、用户刷新或 AI 操作完成时读取状态，并丢弃过期请求。
- `node --test apps/cli/tests/git-workspace.test.mjs apps/cli/tests/project-files.test.mjs apps/cli/tests/workspace-projects.test.mjs apps/cli/tests/database-migrations.test.mjs`：9 项通过，覆盖 staged/unstaged/未跟踪快照、源 HEAD/index/文件不变、真实 diff、基线恢复、ignored 文件保留、受管树删除、数据根访问限制、迁移 37/38、账户与 App 隔离、同一目录按 App 分别登记和会话项目归属校验。
- `pnpm run build:harness`：68 个能力包通过；`pnpm run build:web`：客户端 TypeScript 与 Vite 构建通过；`pnpm run build:control-plane`：控制端构建通过。产物位于根 `dist/`；最终 `git diff --check` 通过。
- 尚未连接并操作已登录 Web/Tauri、实际在线本机或远程 Daemon，也未测量帧时间；本地测试使用真实 Git 与临时仓库，但不代表真实目标机端到端验收。AI 选中的普通源项目只显示 Git 状态；安全恢复仅对新建的受管 AI Worktree 开放。

## LFAA-AI-AUTONOMOUS-TOOLS-01

### 目标与运行入口

在当前包架构的 AI Work 中，让模型能够直接复用会话已选项目的在线 Daemon 和目录作为 Shell 默认目标；让对话活动显示简洁中文摘要而不泄露工具参数/结果协议 JSON；让已配置 MCP 服务可由账户在设置中心明确选择可用 App，再由 Agent Loop 把该范围内的真实工具交给 Provider 自主选择。Provider 请求仍使用当前函数调用循环和 `tool_choice: auto`，不添加关键词路由或第二套执行器。

### 设置、数据与权限 Owner

- `general.integratedShell`、`general.taskFolder`、`aiRuntime.commandTimeoutSeconds`、`plugins.enabled`、`plugins.mcpServers` 和 `permissions.mode` 继续由设置中心、Settings Service 與现有权限 Owner 管理；MCP 新增的 `applicationIds` 属于每个服务的账户配置，旧记录缺少该字段时补为 `workspace`，不重置用户偏好。
- 当前会话项目上下文由 workspace/session Owner 提供；Shell 仍通过 AI Host Task 队列派发给具备 `agent-shell-v1` 的真实 Daemon。选中项目只提供默认节点与工作目录，不构成目录沙盒或额外权限。
- MCP 地址仍由账户配置并经服务端 URL 校验；只连接启用的服务及当前 App 范围内的服务。工具调用继续绑定真实服务响应，并经当前 App 的 `permissions.mode` 和逐项审批执行。
- AI Activity 属于 Session Owner。活动文案只改变用户显示投影；完整模型工具调用参数、结果、任务真实状态和错误仍按现有模型历史/任务 Owner 保存并回传，不把展示摘要当执行证据。

### 允许修改

- `packages/core/tools/src/business-tools.ts`、`packages/core/tools/src/project-tools.ts`：让 Shell 工具参数可省略节点/目录，并在用户未显式指定时使用选中项目目标作为默认值。
- `packages/core/tools/src/mcp-tools.ts`、`packages/core/agent-loop/src/execute-turn.ts`：按 MCP 设置的 App 范围发现工具；保持 Provider 的模型选工具循环、审批和真实结果回传；把活动展示改为中文摘要，不把 JSON 参数/结果写入 Activity。
- `packages/settings/settings/src/preferences/service.ts`、`packages/settings/settings/src/service.ts`、`packages/api/remotes/src/route-contracts.ts`、`packages/client/connection/src/api.ts`、`packages/client/ui-settings-general/src/default-settings.ts`、`packages/client/ui-settings/src/SettingsPage.tsx`：复用当前 App ID 权威清单，新增每个 MCP 服务的可用 App 多选、默认值、服务端验证、持久化和类型映射。
- `apps/cli/tests/`、`docs/PROMPTS.md`、`docs/系统总体架构.md`、`docs/开发计划.md`：增加直接回归并同步能力范围及验收结果。若相关包已有 README，再同步其契约；不得为不存在的旧 README 写假路径。

### 禁止修改

- 不改用关键词、意图分类或写死的产品任务流代替模型对已暴露工具的选择；不丢弃模型工具参数/工具结果或伪造完成状态。
- 不把选中项目包装成 Shell 安全沙盒；不绕过现有账户认证、Daemon 在线/能力校验、权限模式、审批、任务租约、取消和不重放规则。
- 不隐藏待审批操作的业务说明和目标范围；不在用户 Activity 展示原始参数 JSON、完整日志、MCP 协议对象或原始节点响应。
- 不注册未连接真实 Host 的 PTY、浏览器或桌面操控假工具；不通过未配置/未授权的 MCP 服务执行外部操作，不安装未经评估的新依赖。
- 不更改无关未提交文件，不重置、暂存、提交、推送、部署或发布。

### 验收条件

- Shell 参数省略 nodeId/workingDirectory 时，若会话选中项目则派发到该项目的真实节点和根目录；显式模型参数仍按原有校验执行，审批绑定最终实际参数；无项目时仍遵循设置中的任务目录和 Daemon 节点选择。
- Activity 标题与详情为可读摘要，不泄露模型工具 JSON/大段日志；模型历史收到与修改前同等完整的工具参数和结果；审批等待文案仍含工具操作与目标范围。
- MCP 服务 App 范围经 UI 保存、API Joi 校验及 Settings Service 读取；旧账户记录默认仅 workspace；未选中的 App 不建立该 MCP 连接也不向 Provider 暴露其工具；选中的 App 能获得真实动态 schema，并仍要求原有权限审批。
- 保留 `tool_choice: auto`，直接回归证明模型返回的工具调用名按目录匹配并执行，而不是由用户文本关键词路由；相关包与 Web 构建通过，产物只进入根 `dist/`。
- 使用当前真实 Provider 与在线 Daemon 做无副作用的模型选工具验收；需要 Shell 写/高风险操作时严格等待现有逐项审批。若缺少登录态、Provider、节点或实际 PTY/浏览器/桌面驱动，记录具体阻塞，不伪称完成。

### 实施与核验记录（2026-10-01）

- `host_execute_command` 的节点参数改为可选；当前会话绑定项目时，未显式提供节点/目录就使用项目登记的 Daemon 节点和根目录，显式模型参数优先。无项目时仍要求模型查询并选择真实在线 Shell 节点；设置中心任务目录继续作为路径回退值，Shell 不因此变成路径沙盒。
- Agent Activity 只显示按工具领域归类的中文状态摘要；不再投影函数名、参数 JSON、节点原始结果或大段命令输出。相同完整工具结果仍回传模型历史。审批卡保留工具业务说明与授权目标范围。
- MCP 服务可在“设置中心 > 连接”选择应用范围；服务关闭或当前 App 不在范围内时不会建立 MCP 连接。App ID 沿用 `APPLICATION_IDS` 唯一清单，旧服务配置只补为 `workspace`。
- 通过 `agent-runtime.test.mjs`、`mcp-tools.test.mjs` 共 2 项回归；`pnpm run build:control-plane` 与 `pnpm run build:web` 通过；`git diff --check` 通过，产物位于根 `dist/`。
- 只读检查到本机 `/api/health` 返回 200、SQLite 有 1 个账户和 1 个报告 `agent-shell-v1` 的在线节点。真实 Provider 工具调用未执行：Edge 自动化连接返回 `nodeRepl.fetch request failed`，且正在运行的控制端通过文件存储独占锁拒绝了第二进程读取 Provider 配置；没有绕过身份验证、读取密钥或停用运行中的控制端。故步骤 4 仍待登录浏览器连接恢复后实测。
- 本仓库当前没有可用的 `workspace-preflight` 脚本入口。原生交互式 PTY、浏览器 Host 和桌面操控 Host 仍未接入；MCP 只会在用户配置真实服务并为当前 App 授权后暴露其实际能力。

### 最终回复自然语言要求（2026-10-02）

用户反馈 AI Work 最终回复直接展示了工具错误 JSON、内部字段名和状态值；活动轨迹已有摘要，但通用 Agent 系统提示没有约束最终回复的呈现方式。

- 目标运行入口仍为各 App 的 AI Work Agent Loop；最终回复由已配置 Provider 生成，完整工具结果继续作为推理证据回传模型。
- 默认面向用户用自然语言说明结论、真实状态、错误原因和下一步；不要原样复制工具/API/MCP/Daemon JSON、协议字段、布尔标记或内部状态枚举。用户明确要求代码、命令、日志、JSON 等技术原文，或任务本身要求交付这些内容时，按需准确给出并用自然语言说明。
- 设置中心继续负责已选 Provider/模型和运行参数；本任务不增加回复风格开关，也不更改用户偏好。无专用新增设置。
- 允许修改 `packages/core/agent-loop/src/runtime.ts`，并在 `apps/cli/tests/agent-runtime.test.mjs` 验证 Provider 收到该回复规则；同步本合同、系统架构和开发计划。`packages/core/agent-loop` 当前没有 README。
- 禁止通过删减或改写工具结果、过滤回复中的所有 JSON/代码，或更改 AI Markdown 渲染来伪装满足要求；执行和审批事实必须完整保留。
- 验收：Agent 系统消息要求默认自然语言转述机器结果，同时允许按用户目标提供技术原文；原始工具结果仍完整进入模型历史；定向回归与相关包构建通过。真实 Provider/登录浏览器验收单独记录，提示词约束不保证每个 Provider 输出绝对一致。

### 可折叠真实工作轨迹（2026-10-02）

- 运行入口为所有 App 共用的 AI Work 对话区。Session Owner 持久化 `AiActivityItem`，Agent Loop 负责真实发布状态；Client 只呈现这些事件和时间戳，不另造任务状态源。
- 目标状态覆盖真实消息/活动状态：排队、模型思考、流式回复、工具执行、等待审批、等待用户补充、结果待确认、步骤完成/失败，以及整轮完成/停止/失败。审批和澄清仍使用既有交互栏。
- 折叠摘要让用户看见当前步骤和真实耗时；展开后按时间顺序显示已有活动的动作、状态、说明和耗时。持续时间使用服务端活动时间戳或已持久化 `durationMs`，不生成模拟进度或推测状态。
- 活动内容只展示可公开的操作摘要与真实状态，不展示模型隐藏推理、工具参数 JSON、命令全文/日志或原始节点/API 响应；动作名称优先复用 LFAA 内建工具描述，审批操作细节继续由现有审批卡负责。
- 外观沿用设置中心的 `appearance.theme`、强调色、界面/内容字体与字号、对比度、当前 App 壁纸、遮罩透明度、模糊和减少动态效果映射；不新增外观或活动配置。模型和审批仍分别由现有 AI Runtime 与 `permissions.mode` 管理。
- 允许修改 `packages/core/agent-loop/src/execute-turn.ts`、`packages/client/ui-chat/src/AiWorkChat.tsx`、`packages/client/ui-chat/src/activity-duration.ts`、`packages/client/ui-chat/src/ai-work-chat.css`、`apps/cli/tests/ai-work-activity-duration.test.mjs` 以及本任务已有架构/计划记录。`packages/client/ui-chat` 当前没有 README。
- 禁止暴露隐藏思维文本、写入参数或整段执行日志；不新增工具/API/数据库字段，不改审批、授权和任务执行语义，不将 queued/unknown/失败说成成功，不在不同 App 建立重复轨迹实现。
- 验收：真实活动状态映射到可读摘要和带状态/用时的可折叠时间线；刷新后历史轨迹和耗时仍准确；键盘可操作并具有可读展开状态；定向回归、聊天包与 Web 构建通过。真实浏览器的壁纸/字号/主题适配和交互另行实测并如实报告。

### 可折叠工作轨迹实现记录（2026-10-02）

- AI Work 折叠摘要现显示模型思考、回复、工具准备/执行、子 Agent 协调、能力加载、审批/补充等待及整轮完成/停止/失败；详情逐项显示真实动作、活动状态、说明和服务端耗时。Minecraft 与 SteamCMD 常用操作使用具体自然语言名称。
- 审批等待轨迹不再包含审批摘要中的原始参数 JSON；审批卡仍由原有交互栏展示操作与目标范围。没有增加任务状态源、API、数据库字段、工具或用户配置。
- `node --import tsx --import ./register-package-loader.mjs --test tests/ai-work-activity-duration.test.mjs`：8 项通过；`node --import tsx --import ./register-package-loader.mjs --test tests/agent-runtime.test.mjs`：1 项通过。
- `pnpm --filter lfaa-client-ui-chat run build`、`pnpm --filter lfaa-agent-loop run build` 和 `pnpm run build:web`：通过，产物位于根 `dist/`。Web 构建输出 Vite 大 chunk 提示。
- 未在登录态浏览器或真实 Provider 上执行交互验收；主题、字号、壁纸和动态效果已复用现有外观令牌，本次未实测其运行时映射。

### 补充实现与核验记录（2026-10-02）

- 在 Agent Loop 通用系统指令中加入最终回复规则：默认自然语言解释工具证据，用户明确要求或任务需要时仍可准确交付代码、命令、日志和 JSON；未改动 Provider 的工具结果内容，也没有增加设置中心配置。
- `node --import tsx --import ./register-package-loader.mjs --test tests/agent-runtime.test.mjs`：1 项通过，确认回复规则进入 Provider 系统消息，既有后台任务、协议恢复和取消回归通过。
- `pnpm --filter lfaa-agent-loop run build`：通过，输出写入根 `dist/packages/`；`git diff --check` 通过。
- 未用真实 Provider 复验回复措辞，也未在登录态浏览器验收；提示词遵从度仍取决于所选 Provider。

## LFAA-HARNESS-BUNDLE-CLIENT-RUNTIME-01

### 目标与运行入口

继续完成 LFAA Harness 的通用资源安装闭环与 DSH Bundle/Client Runtime。用户可在 AI Work 用自然语言要求安装已发布资源；模型根据真实 `capability_catalog` 选择类型、检查来源和目标，再调用对应 Owner。当前已实现的 `plugin`、`skill`、`prompt`、`mcp` 继续由各自 Owner 负责；新增类型只有在其应用 Owner、启停/移除和调用 Runtime 都已接通后才可登记为可用。未知类型必须明确报告未支持，不能靠扩展名或通用复制伪装成“什么都能安装”。

运行入口为 Web 与 Tauri 共用的 `web` Profile、LFAA Harness Host/Client Runtime，以及现有 AI Agent Loop。DSH `dsh.bundle` 按 Profile 有序补丁层装配；`dsh.client` 由 Host 扫描当前已装配条目、生成版本化客户端模块图，经 LFAA Web carrier 提供资源，再由 LFAA Client Runtime 懒加载并按实际生命周期挂卸。安装后需要模型、Profile Host、LFAA Client、目标 App/项目各自回读证明，不能仅凭文件落盘回报可用。

### 设置、数据与权限 Owner

- Bundle 来源快照、固定提交/摘要、Profile 选择和 Host 启停由 `packages/boot/plugin-manager` 与 `packages/boot/app-boot` 唯一持有；客户端包来源清单与浏览器加载由 `packages/client/modules` 唯一持有；HTTP/资源传输复用 `packages/host/webserver`。自然语言工具与安装凭证继续归 `packages/boot/capability-installs`。Skill、Prompt、MCP 和未来 Minecraft 插件/模组继续留在其应用领域 Owner，不能迁进插件目录。
- 安装沿用管理员约束、三种 `permissions.mode` 和既有 AI 工具审批；来源必须固定版本。Profile Bundle 的启用状态、Client 是否进入图和实际 Host Fiber 状态分别汇报。UI 只沿用设置中心现有 `plugins.enabled`、`appearance.*` 与权限设置；本阶段不新增或重置用户偏好。
- DSH 是兼容协议和包组织参考，不创建第二套 Agent、应用、Profile 数据库、设置服务、Identity 或 Daemon。Wallpaper Engine Host 只归 LFAA Harness Plugin Host；任何音乐、UI 或普通 Harness 插件均不得进入 Daemon/Minecraft 任务路径。

### Wallpaper Engine 完整接入目标增补（固定上游快照）

- 本次目标是接入用户提供的本地仓库 `H:\deepseek-harness\plugins\dsh-wallpaper-engine` 所在提交 `d1d82d12e581d04017da7e798957c55a65003b4c` 的可用功能；上游明确不支持的 Application 壁纸仍须如实标识。不能把现有 MP4 播放切片当成完整接入。
- Host 功能按上游真实路由及生命周期接入 LFAA `webServer`：Video、Web/HTML、Scene/WebWallGL、项目与属性读取、文件/媒体/预览、Scene 实时帧和音频、播放控制/系统音频状态、上传/目录导入/移除、播放列表与媒体准备/进度、字体集、配置、诊断及 About。每一路由必须保留登录认证、Profile 数据根、路径与文件类型校验、上传/响应尺寸上限、生命周期取消及受控出站访问；不启动第二个 HTTP 服务。
- Client 功能通过 DSH `dsh.client` 原始入口和 LFAA 现有 ClientModuleSystem 加载：壁纸层与回退/看门狗、选择器/筛选/隐藏恢复/相册布局、播放列表和轮播、Scene/Web 属性面板、音轨/音频响应、快速面板/吉祥物、右侧栏标签、设置分区、字体集与插件自有展示。LFAA 只为上游 `settings.section`、`sidebar.right.pane.tab`、`sidebarRightTabs` 和 `@deepseek-ai/dsh-client-runtime` 声明提供明确兼容层；不得伪装成当前 DSH 官方源码中不存在的包。
- LFAA Settings 继续拥有账户级动态壁纸选择/启用事实：`appearance.wallpaperEngine.enabled/projectId`；上游设置页通过现有 DSH Host route bridge 更新该账户设置，不维护第二份选择状态。项目 ID 必须支持上游的视频、网页、场景及自定义上传 ID。`appearance.theme`、强调色、界面/内容/代码字体字号、对比度、`overlay`、`blur` 和减少动态效果仍由 LFAA 控制。Wallpaper Engine 专属配置、字体集、上传媒体及缓存沿用上游唯一配置格式，写入当前 Profile 的插件运行数据目录；没有账户归属的文件操作必须沿用已有 Host 认证并补齐角色/来源/路径校验。
- Wallpaper Engine 设置页和右侧栏由 LFAA 设置区与现有右侧上下文栏消费 DSH Slot，提供 `settings.section`、`sidebar.right.pane.tab`、`sidebarRightTabs` 与 `sidebarRight` 扩展点；不启动或呈现第二套 DSH 页面外壳。DSH Desktop 专用的额外 loopback media-origin 不得在 LFAA Web 中暗中启动第二个 HTTP 服务；LFAA Web 使用认证后的现有 WebServer 媒体路由，Desktop 专属配置如实标为不适用。
- 上游代码须按固定提交与包清单校验后才能由 Profile loader 接入；不得把任意已安装插件主入口直接导入控制端主进程。Host 路由只能复用 LFAA WebServer，并核验登录、Profile 数据根和资源路径。若本轮尚未完成 Host Adapter、原始 Client 兼容层或任何上游功能，必须在能力状态和交付记录中逐项列为未接入，不能以 MP4 适配器回报全兼容。

### 允许修改

- `packages/boot/plugin-manager/`、`packages/boot/app-boot/`：复用 DSH Profile/Bundle 声明及顺序语义，补齐安装 Bundle 到实际 Profile composition 和可核验的 Host lifecycle。
- `packages/client/modules/`、`packages/client/web/`、`packages/host/webserver/`、`packages/bundle/` 与相应组合清单：按 DSH `dsh.client` 双端模块图协议接通版本化 bundle route、页面启动清单、懒加载、失败状态和卸载清理；优先复用上游现成可兼容包/实现，不新增平行模块运行协议。
- `packages/boot/plugin-manager/src/github-source.ts`、`npm-source.ts`、`npm-archive.ts`：仅在 GitHub 快照缺少清单声明的 DSH Host/Client 构建入口时，验证同包名/版本、同 GitHub 仓库、相同 `gitHead` 和 NPM SHA-512 SRI，并安全读取官方发布 TAR；不得执行包脚本。
- `packages/boot/capability-installs/` 与 `apps/cli/tests/`：仅在对应 Owner 及 Runtime 已接通时扩展准确的类型目录、模型工具操作和直接回归。
- Wallpaper Engine 当前 Host/Client 适配涉及 `packages/boot/plugin-manager/`、`packages/boot/app-boot/`、`packages/client/modules/`、`packages/client/ui-settings/`、`packages/client/ui-workspace/`、`packages/client/ui-layout/`、`packages/host/webserver/`、对应连接/设置 Owner、Profile Bundle、定向长期回归与其真实 Owner 文档；扩展点只放入这些现有 Owner。

### LFAA-WALLPAPER-ENGINE-FULL-DSH-01

- **目标与上游：** 使用本机已克隆的 DeepSeek Harness 源码作为接入参考，固定 Harness `639ed015397290b3745d163aafe02ffee4aa3f84` 和 `elysia395/dsh-wallpaper-engine` `d1d82d12e581d04017da7e798957c55a65003b4c`。接入上游 `dsh-plugin-wallpaper-engine` 的 Host 与 Client 入口、Bundle patch、Client Module 图和 HMR；不是以 LFAA 原生 Video 组件代替上游功能。上游本身不支持启动 Application/EXE 壁纸，该类型不得伪装成可用。
- **运行入口与 Owner：** Web 与 Tauri 共用现有 `web` Profile；插件清单、固定提交核验、启停及 Profile 插件运行数据归 `packages/boot/plugin-manager`；Host 路由、认证与唯一 HTTP 服务归 `packages/host/webserver`；DSH Bundle/Client Module 生命周期归 `packages/boot/app-boot` 和 `packages/client/modules`；账户壁纸选择继续归 Settings Owner 的 `appearance.wallpaperEngine.enabled/projectId`；上游设置区映射到 LFAA Settings，上游右侧栏映射到 `ApplicationWorkspace`。不进入 Daemon、Minecraft 或节点任务。
- **功能范围：** 接入上游当前源码实际支持的 Video、Web 与 Scene 实时渲染、播放列表/轮播/过渡、项目属性、上传与导入、音频/Now Playing/频谱相关控制、过滤/评级/隐藏恢复、字体集、外观/播放/系统设置、QuickPanel 与诊断、媒体准备与进度/回退。实际平台或系统依赖缺失时显示真实未就绪原因；不能以空按钮、模拟库存或成功状态替代。
- **设置与数据：** `appearance.wallpaperEngine.enabled/projectId` 默认值保持 `false`/空字符串；服务端 ID 校验扩展为上游真实项目和自定义上传 ID 的安全格式。当前账户的选择/启用由 Settings 持久化；上游其余插件设置、上传、字体集和缓存沿用上游格式，放在 `plugins/runtime-data/profiles/<Profile>/dsh-plugin-wallpaper-engine/`。LFAA Appearance 继续拥有主题、强调色、字号/字体、对比度、遮罩、模糊和减少动态效果的账户偏好；DSH 主题色/字体集只覆盖 Workbench 中已映射的文字、AI Markdown、代码块和节点终端令牌，不改写账户 Appearance 数据或工作台其他 CSS 变量。
- **Host 与安全边界：** 固定插件通过受控 Cordis Loader 加载；只允许精确仓库、提交、包名、版本、Host/Client 入口及补丁声明。设置/管理 API 复用已认证的 LFAA WebServer；`/api` JSON parser 不得预先消费插件的原始请求体。Scene 大型包允许固定官方 Host 的专用 loopback 媒体源，必须逐次核对绑定 `127.0.0.1`、临时端口、仅 Scene 文件与诊断路由、token/字面/realpath 围栏及 Fiber 清理器锚点；任何变化均拒绝启用。此特例不扩展为通用插件 HTTP 服务，沙箱 Web 壁纸资源不得获得任意 API/存储能力。停用、Profile 卸载、Web Host 关闭时必须撤销 Bundle、路由、计时器、流和媒体监听。
- **Client 扩展点：** 复用 LFAA React 根和主题树；插件仅在登录后装入，注销时卸载。提供 DSH `settings.section` 和 `sidebar.right.pane.tab` 槽，分别由现有 Settings 首层导航与 Workbench 右上下文栏消费；为上游提供同生命周期 `sidebarRightTabs`/`sidebarRight` 服务，不增设第二个应用 Shell 或长期存活的独立 React 应用根。DSH `shortcuts.register` 映射到 LFAA 快捷键设置与 Workbench 命令分发，新增 `shortcuts.wallpaperSidebarToggle` 字段默认空数组；DSH `locale` 映射账户 `general.language`，随用户设置改变并按插件生命周期撤销。DSH `theme.getTheme/setTheme` 由 LFAA `appearance.theme` Owner 提供；颜色/字体令牌按固定 DSH 角色清单映射到 LFAA Markdown、代码块与任务终端，默认值跟随 Appearance，覆盖只在 Workbench 主题树内生效且卸载恢复。不得直接把整份上游 bundle 注入 DOM 绕开 Client Modules。
- **允许修改：** 上述 Owner 包、`packages/settings/settings/`、相关包说明、`docs/PROMPTS.md`、`docs/系统总体架构.md`、`docs/开发计划.md`、Profile/Bundle 组合、直接回归。不得触碰无关差异、改变已有用户偏好、访问或改写用户 Steam 内容，不安装/启用真实插件，不重启正在运行的 LFAA Web/Daemon。
- **验收：** 静态回归覆盖精确上游来源、Host 生命周期和撤销、认证/账户隔离、原始 Body/Range/流取消、Scene 单服务器约束、Client 登录/注销同步与 Slot 呈现、快捷键注册/释放与 Settings 持久化、语言词典/切换/释放、主题偏好与颜色/字体角色映射及 Workbench 范围清理。执行受影响 Owner 构建、控制端/Web 构建和差异检查，产物只写根 `dist/`。在不重启现有服务前提下，可做源级或隔离浏览器检查；实际 Steam Scene/Web/Video 播放、上传、音频、桌面/Tauri 和帧时间单列为未验证，构建不得代替运行验收。
- **状态说明：** 此合同取代同仓较早 Wallpaper Engine MP4 首阶段记录中的“当前能力”口径；旧记录作为历史证据保留。只有当前代码和本节末尾的新实施记录可以声明本次交付能力。
- 优先复用固定提交的上游 DSH Client HMR、模块图和 UI Slot 包；LFAA carrier 只承接 Host/HTTP 与认证边界，浏览器 URL 必须从任意 SPA 深层路由正确解析。
- 必须先更新本合同，再改代码；修改 Owner、公开协议或 package dependency 时同步更新当前架构、实际存在的相关 README、工作区依赖和根 `dist/` 构建配置。

### 禁止修改

- 不把 Wallpaper Engine、音乐、Client UI 或一般插件实现成 Daemon、Minecraft capability、节点任务或 Socket。Daemon 继续只服务真实节点/游戏任务。
- 不直接加载未审阅的插件 Host 代码进控制端主进程，不绕过 Profile/权限/来源固定/依赖审批边界，也不把下载、安装或清单登记说成 Host/Client 已运行。
- 不把任意技能、提示词、Tool、MCP、Minecraft 插件/模组都写成 DSH Bundle。不得把 DSH `plugin-manager` 或 `app-boot` 的完整 Host/Profile/Permission 栈作为第二套系统安装进 LFAA；当上游实现与 LFAA Owner 不兼容时，复用其公开包协议/生命周期语义并在 LFAA Owner 边界适配。
- 不调用 DSH 已删除或 NPM 发布与上游主分支不一致的旧 Client Runtime 版本来声称当前兼容。依赖版本、peer 范围、许可证和真实导出必须在安装前核验；执行第三方 `prepare`/安装脚本仍遵循现有授权与依赖脚本规则。
- 不改变现有设置默认值、工作台导航和外观偏好；不执行 Daemon 验收来代替 Harness Runtime 验收；不触碰不相关未提交差异，不重置、暂存、提交、推送、发布或部署。

### 验收条件

- DSH Profile 的 Bundle 层顺序、包清单引用、App 范围与来源版本可从真实 Profile 状态回读；启用后实际 Host 进入就绪态，停用/移除后对应资源与生命周期真实清理；加载失败明确显示错误且不会被汇报为 ready。
- GitHub 仓库未提交 `main`/`./client` 构建文件时，只接受 NPM `gitHead` 与 GitHub 固定提交一致且 SHA-512 SRI 有效的同仓库发布包；归档路径、链接、特殊文件、尺寸或摘要失败时不写入安装目录。
- 一个真实 DSH 客户端 Bundle 的 `dsh.client` 入口可经 Host 图、LFAA Web carrier、Client Runtime 成功加载到声明目标 App，启用/停用/重试状态可核验；无效 revision、路径穿越、未登记包和浏览器同步失败不得读取别的内容或返回 SPA HTML 假脚本。
- 上游 DSH Client HMR 从 Host 的当前 Bundle 图向已登录客户端同步变更；`/plugins/events` 只允许认证访问，公开 `/plugins` 仍只提供只读 GET/HEAD bundle 资源。
- AI Agent Loop 使用真实模型可在一次运行内按用户指令识别已实现资源类型、调用正确 Owner、遵循权限授权、安装并回读；未实现类型及不兼容 DSH 版本准确拒绝，不采用写死关键词流程。
- 运行必要的 Owner、Profile Bundle 组合、Client bundle Host route/Client loader 回归与包/控制端/Web 构建；构建输出仅在根 `dist/`。报告实际浏览器/Tauri、真实模型与插件服务验收范围，不能以合成 Provider、安装清单或构建代替端到端运行证据。

### 2026-10-02 阶段实施记录

- GitHub 插件快照若声明 DSH `main` 或 `./client` 构建入口但归档缺文件，安装器现在会通过官方 `registry.npmjs.org` 查询同名同版本发布物；要求 NPM `gitHead` 与已解析 GitHub commit 相同，NPM 与 GitHub 的仓库地址相同，tarball 域名固定为官方 registry，并以 SHA-512 SRI 验证压缩包。安全 TAR 读取拒绝路径穿越、重复路径、链接/特殊文件、损坏校验和、超量文件/字节。任何 `prepare`、`build` 或其他包脚本都不执行。
- 已用用户给出的 `dsh-wallpaper-engine` 做只读核验：当前 GitHub 快照缺少 package.json 所声明的 `lib/index.js` 与 `lib/client.js`；官方 NPM `1.2.0` 发布物包含这些文件，`gitHead` 与该仓库快照提交一致。LFAA 安装器仍将它标记为 DSH Runtime 不兼容；本记录只完成来源构建产物对账，未完成 Bundle Runtime、Client Runtime 或壁纸插件运行。
- 定向回归 `tests/plugin-manager.test.mjs` 通过 9/9，覆盖同提交发布物补齐、错误 `gitHead`/SRI、恶意 TAR 路径和链接；`pnpm --filter lfaa-plugin-manager run build` 通过，输出在根 `dist/packages/boot/plugin-manager/`。真实 NPM 网络由只读核验确认；运行服务、浏览器、Tauri、Host 插件生命周期和 Client bundle 加载仍未验。
- 按用户本轮明确的复用方向，后续 Bundle/Client Runtime 必须以 DeepSeek Harness 当前源码中的 `@deepseek-ai/dsh-client-modules` 双端合同和 `@deepseek-ai/dsh-client-ui-slots` 为上游实现基线；LFAA 只写 Host/Web carrier、应用生命周期与 LFAA UI extension point 适配，不另造并行 bundle 图、浏览器模块表或通用 UI slot 引擎，也不进入 Minecraft Daemon。上游核对基于 `deepseek-ai/deepseek-harness` commit `639ed015397290b3745d163aafe02ffee4aa3f84`。
- 已在 Web Profile 的 `web-app` Bundle 装入官方 `@deepseek-ai/dsh-client-modules` 与 `@deepseek-ai/dsh-client-ui-renderer`，并由 LFAA `packages/client/modules` 将官方 `ClientModuleSystem` 接到现有 Cordis Loader；DSH Loader Fiber 与 LFAA React UI 共用现有 Context。Host carrier 复用当前 Express/HTTP Server，页面注入及 `/plugins` 资源来自上游 Client Modules 服务。Web Vite 的 `node:module` 浏览器占位与 Node 环境字段沿用 DSH 官方 Web 构建配置，避免在浏览器执行 `createRequire`。
- 本阶段验证：`pnpm run build:web`、`pnpm run build:control-plane`、`pnpm --filter lfaa-client-modules run build` 均通过；`dsh-carrier`、`dsh-profile`、`http-delivery` 定向回归通过 8/8。Profile 回归确认 Host 模块 ACTIVE、注入图和公开 bundle GET 工作。当前 `127.0.0.1:3000` 的只读探测中 `/__dsh/index-injections` 和 `/plugins` 返回现有 SPA HTML，因此它不能作为本次 Host 运行证据；没有重启用户正在运行的服务，也没有启动新的浏览器/Tauri 会话。真实浏览器里的 Client Fiber、React UI 及壁纸插件尚未验收。Web 构建报告一个 1.36 MB JS chunk 超过 500 KB 警告；本阶段未作浏览器首屏/帧时对比。
- 壁纸插件仓库快照仍声明 `@deepseek-ai/dsh-client-runtime` 注入项；其客户端入口使用 `settings.section`、`sidebar.right.pane.tab`、`sidebarRightTabs` 等 DSH UI 服务/槽位。当前 DSH 源码树的运行时分包与这些声明不完全同名，LFAA 也没有这些 DSH UI owner；必须先在 LFAA 的现有设置中心/工作台 Owner 上完成明确的适配映射，并按固定提交验证包契约，不能仅因安装成功就启用或汇报兼容。此发现按只读检查的 Wallpaper Engine GitHub commit `2519949644a0bc58a065f419918f9a7fbd8ea106` 记录。
- 按用户强调的上游复用原则，继续采用官方固定提交 `639ed015397290b3745d163aafe02ffee4aa3f84` 中的 `@deepseek-ai/dsh-client-hmr`，没有自行实现第二套客户端更新通道。Web Profile 的 `web-app` Bundle 装入同版本上游包，Host 图变化由官方 HMR 通过 `/plugins/events` 同步；carrier 只允许该精确事件路由并默认要求 LFAA 登录态，公开 `/plugins` 仍限 GET/HEAD。HMR 的相对 URL 通过 Web 入口 `<base href="/">` 支持 `/apps/...` 深层路由。
- HMR 已加入 `dsh-carrier` 与 `dsh-profile` 定向回归：分别核验认证边界/路由保留，以及 Profile Host 实际装配状态和事件路由；真实浏览器里的持续事件连接与插件即时启停仍须单独核验。
- 当前验证结果：`pnpm install --lockfile-only --ignore-scripts --frozen-lockfile` 通过；定向 `dsh-carrier`、`dsh-profile`、`http-delivery` 回归通过 8/8；`pnpm run build:web`、`pnpm run build:control-plane`、`pnpm --filter lfaa-app-boot run build`、`pnpm --filter lfaa-web-app run build`、`pnpm --filter lfaa-client-modules run build` 均通过，输出仅写根 `dist/`；`git diff --check` 通过。Web 构建仍报告一个约 1.36 MB JS chunk 警告。未启动浏览器/Tauri，也未重启正在运行的本机服务，因此持续 SSE、深层路由实载和客户端插件启停尚未验收。
- 本轮按用户提供的 GitHub 地址刷新来源：GitHub HEAD 与官方 NPM `dsh-plugin-wallpaper-engine@1.2.0` 的 `gitHead` 均为 `d9988b3e1fa0c47d1032c67303e972ef47d5eb1c`。该版本 `dsh.client.inject` 仍声明 `@deepseek-ai/dsh-client-runtime`，而 DSH 固定上游提交 `639ed015397290b3745d163aafe02ffee4aa3f84` 的源码树没有该包；插件 Client 还依赖 `settings.section`、`sidebar.right.pane.tab` 与可选 `sidebarRightTabs` 服务。不能用陈旧 NPM Runtime 冒充当前 DSH 兼容；须把该兼容入口映射到 LFAA 当前设置和侧栏 Owner 后，才可接通并验收此插件。当前 DSH HMR 已接入，但安装清单尚未动态装入此插件，因此本阶段仍不报告壁纸插件可运行。

### 2026-10-04 接入实施记录

- 按固定 DSH `639ed015397290b3745d163aafe02ffee4aa3f84` 与 Wallpaper Engine 插件 `d1d82d12e581d04017da7e798957c55a65003b4c` 完成 Host/Client 适配，并将上游设置区、右侧栏、shell overlay、快捷键、语言和主题服务接入现有 LFAA Owner。上游真实支持的 Video/Web/Scene、播放列表/轮播/过渡、属性、导入上传、音频控制、筛选评级、字体集、QuickPanel/诊断和媒体准备仍由上游 Client 提供；Application/EXE 壁纸不支持，不显示为可用。
- DSH `shortcuts.register` 绑定到账户快捷键设置和工作台命令分发；新增 `shortcuts.wallpaperSidebarToggle`，默认空数组。回归发现既有快捷键字符校验遗漏 `+` 与反引号，会导致快捷键设置整类回退；白名单已补齐两个分隔符，保留现有长度及字符范围校验。
- DSH `locale` 随账户 `general.language` 更新，并在插件注销时撤销词典/监听；DSH `theme.getTheme/setTheme` 由 `appearance.theme` Owner 提供。上游颜色与字体角色按固定允许清单映射到 LFAA 外观令牌、Markdown、代码块和节点终端，覆盖限于 Workbench 且可恢复；没有新增外观偏好或默认值。
- 设置消费现有 `appearance.wallpaperEngine.enabled/projectId`（默认 `false`/空）、`appearance.theme`、已映射的外观字体/字号及颜色令牌，以及 `general.language`。新增快捷键只登记到既有快捷键设置，未增加其它设置项；Settings、主题与 Workbench 仍走共享外观 Owner。
- 定向 DSH/插件管理回归 14/14 通过，覆盖固定来源与生命周期、Host carrier 认证、Profile 装配、快捷键持久化及注册/撤销、语言切换/撤销、主题 Owner 和 Workbench 令牌清理。`lfaa-settings`、`lfaa-client-ui-workspace`、`lfaa-client-ui-theme`、`lfaa-client-ui-chat`、`lfaa-client-ui-layout`、`lfaa-plugin-manager` 包构建，Control Plane 构建，Web TypeScript 检查与 Vite 构建均通过；产物仅写根 `dist/`。Web 构建有一个约 1.36 MB 的 JS chunk 警告。`git diff --check` 通过。`workspace-preflight`/独立 quality 或 release Gate 在当前仓库不存在。
- 本记录证明静态适配与隔离生命周期回归，不证明真实上游插件已安装/启用。按本合同禁止安装/启用真实插件及重启现有 LFAA 服务；没有验证登录态浏览器中的插件 UI、Steam Scene/Web/Video 播放、上传、音频、Tauri/Electron 壁纸效果或实际帧时间。这些运行门仍未完成；上游不支持的 EXE/Application 也不在接入范围。
- 2026-10-04 补齐上游右侧 `guide.icon` 的 LFAA 小图标入口、点击聚焦/展开行为与 `shell.overlay` 消费，未重画上游 RopeDock、QuickPanel、Wallpaper/Appearance/Playback 界面。DSH Slot 位于 `.workbench-shell`，共享主题、强调色、字体/字号、模糊、遮罩、对比度和减少动态效果继续来自 LFAA Settings；插件自己的壁纸/轮播/播放设置保持上游 Owner。定向 DSH/runtime 回归 14/14、workspace/layout 包构建与 Web 构建通过。真实登录态 UI 与媒体行为仍未验。

## LFAA-WALLPAPER-ENGINE-UI-COMPLETE-01

### 用户目标与可观察行为

- 完整显示固定上游 `dsh-wallpaper-engine` 自己的壁纸、外观和播放界面及其真实已实现能力，不重画、删减或改写上游 UI。
- 在 LFAA 工作台中提供上游注册的小图标入口；点击后打开并聚焦 LFAA 右侧上下文栏，收起状态也能展开。上游 RopeDock 吉祥物仍负责原有拖动、点击、手势和快捷键行为。
- 上游设置页与右侧栏内容继续由 DSH Client/Slots 渲染；Settings Center 继续是 LFAA 共享主题、颜色、字体、字号、玻璃模糊、背景遮罩、对比度和减少动态效果的权威 Owner。Wallpaper Engine 自身媒体/轮播/音轨等领域设置继续由上游插件维护，不在 LFAA 复制第二套业务配置。
- 上游固定源保持只读；通过兼容适配层接入，以后更新仍由受控来源/版本与兼容合同管理，不维护上游 fork。

### 运行入口、Owner 与设置盘点

- 运行入口：Web Profile 的 `web` Bundle 与共享 `packages/client/**` Workbench；Tauri Desktop 共用该 Client。DSH 插件安装、Profile 生命周期和受控 Host 由 `packages/boot/plugin-manager` Owner 管理，插件设置数据由该 Host 的 Profile 运行数据目录管理，账户当前壁纸选择由 Settings Owner 管理。
- 上游 `sidebarRightTabs.register` 的 `guide` 图标属于 DSH 右侧栏入口合同；LFAA `SidebarRightRuntime` 管理登记、选择和展开，`ApplicationWorkspace.tsx` 消费图标并渲染上游 `sidebar.right.pane.tab` Slot。插件注册/卸载必须同步添加/撤销 UI 入口。
- 共享外观沿用 `appearance.theme`、当前主题强调色（含 `advanced.separateModes/modeStyles`）、`sidebarColor`、字体与字号、`overlay`、`blur`、`advanced.contrast`、`advanced.translucentSidebar` 和 `advanced.reducedMotion`。默认值、账户持久化与校验不变；DSH 插件外观控件继承这些共享令牌。插件独有的壁纸遮罩/裁切/滤镜、玻璃保真度、轮播、转场、音量和播放列表等仍由上游配置真源负责。
- 账户当前壁纸沿用 `appearance.wallpaperEngine.enabled/projectId` 与 `general.language`；快捷键沿用 `shortcuts.wallpaperSidebarToggle`。本任务不新增设置字段或替换既有用户偏好。

### 允许修改

- `packages/client/ui-workspace/src/sidebar-right-runtime.ts`：为上游 guide icon 增加准确类型，并让入口能按已登记 tab 激活及展开右侧栏。
- `packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 与 `packages/client/ui-workspace/src/module-workbench.css`：渲染插件注册的图标入口，保留无图标 tab 的可读回退，并使用现有工作台外观令牌。
- `packages/client/ui-theme/src/dsh-theme-tokens.css`、`packages/client/ui-theme/src/dsh-theme-bridge.ts` 及必要的 Workbench 主题绑定：使独立挂载的上游 RopeDock/overlay 也继承 LFAA 当前共享外观，且在卸载/切换时正确清理。
- `apps/cli/tests/` 中本任务直接相关的既有 DSH/工作台回归、`docs/PROMPTS.md` 及真实受影响的架构/包说明。

### 禁止修改

- 不改 `H:\deepseek-harness\plugins\dsh-wallpaper-engine` 上游源码、样式、资源或自己的页面组件；不把插件 UI 重实现为 LFAA 页面。
- 不把上游不支持的 EXE/Application 能力显示为可用；不以按钮、图标或静态构建声称插件已经运行。
- 不把 LFAA 已有外观设置映射到语义不同的插件字段，不增加第二份共享外观配置，也不让插件私有存储覆盖 LFAA 共享外观偏好。
- 不安装/启用真实插件，不重启当前 LFAA Web/Daemon 服务，不改不相关工作树差异，不提交/发布/部署。

### 验收条件

- 上游 `guide` entry 的 icon、title、description 在 LFAA 右侧栏入口中可访问；点击图标会激活该 entry 对应的已登记 tab，并在收起时展开右栏；卸载后入口与回调均撤销。无图标的其它插件 tab 保持原有文字入口。
- 上游自身 RopeDock 入口、壁纸/外观/播放面板和 Settings Slot 按固定来源继续装配；LFAA 修改共享主题/强调色/字体/字号/玻璃模糊/对比度/减少动态效果后，上游 UI 同一工作区内即时跟随，不复制插件私有媒体设置。
- 执行与 guide/runtime 生命周期、Settings 外观映射直接相关的长期回归、受影响包构建、Web 构建和 `git diff --check`；报告根 `dist/` 产物与静态工作量检查。
- 登录态 Web 实际 UI、Settings 控件逐项交互、Wallpaper Engine Steam 库/Scene/Web/Video 播放、导入/上传、播放列表、音频、Tauri/Electron 和帧时间属于真实运行验收；未执行时不得称为完整运行验收。

### 实施记录

- 本轮开始前合同已登记。实现细节与实际验证结果追加在下方，不改写已完成的历史记录。
- 2026-10-04：`ApplicationWorkspace` 将已登记 guide 图标渲染为小型可访问按钮；点击调用 `SidebarRightRuntime.control.openTab(kind)`，激活上游 tab 并展开收起的右侧栏；无图标 tab 仍为文字入口。`Workbench` 只在拥有上下文栏的应用路由消费 `shell.overlay`，因此上游 RopeDock 继续使用自身组件/资源并进入 LFAA 同一主题容器。上游工作台 Slots 继续消费壁纸、外观、播放和 Settings 面板，没有复制插件领域功能。
- 设置仍读取 `appearance.wallpaperEngine.enabled/projectId`、`appearance.theme`、强调色、`advanced.separateModes/modeStyles`、`sidebarColor`、字体/字号、`overlay`、`blur`、`advanced.contrast`、`advanced.translucentSidebar`、`advanced.reducedMotion`、`general.language` 和 `shortcuts.wallpaperSidebarToggle`；无新增设置。实际登录态插件 UI、Steam 内容、上传、音频、桌面与帧时间未运行验收。

## LFAA-DSH-SLOT-EMPTY-STATE-01

### 用户目标与可观察行为

- DSH Client 扩展区没有 renderer 或没有 Slot 内容时，不再留下空白设置页/插件面板；用户能看到真实的“当前无插件内容”状态，并能从壁纸设置空态跳到现有插件状态页。
- 插件自身界面和能力仍通过上游 DSH Slot 原样提供；空态仅是 Slot 的 fallback，不替换或仿造插件 UI。

### 运行入口、Owner 与设置盘点

- Web/Tauri 共用现有 Client React 根。`DshSlotOutlet` bridge 归 `packages/client/modules/src/client/index.ts`；Settings 归 `packages/client/ui-settings/src/SettingsPage.tsx`；右侧栏归 `packages/client/ui-workspace/src/ApplicationWorkspace.tsx`；安装、启用和 Profile 状态仍归现有 plugin-manager/Profile Owner。
- 不新增设置字段、不改默认值或持久化。共享外观沿用设置中心已经接入的 `appearance.*` 主题和外观令牌；当前壁纸选择继续使用 `appearance.wallpaperEngine.enabled/projectId`；插件安装/启用状态继续读取既有 Profile 状态。

### 修改边界与验收

- 允许修改 `packages/client/modules/src/client/index.ts`、`packages/client/modules/src/client/slots.ts`、`packages/client/ui-renderer/src/render.tsx`、`packages/client/ui-settings/src/SettingsPage.tsx`、`packages/client/ui-workspace/src/ApplicationWorkspace.tsx`、`packages/client/README.md`、`apps/cli/tests/dsh-slot-outlet.test.mjs` 与本合同的实施记录。先确认 DSH 上游 Slot `fallback` 的公开行为，再按 LFAA Owner 透传，不改 `H:\deepseek-harness` 上游源码。
- 空态不增加轮询、监听器、计时器、请求或状态缓存，不改变认证、授权、Slot owner 或插件生命周期；空态只在没有 Slot 内容时渲染。可选 `shell.overlay` 保持静默。
- 不安装/启用插件，不修改运行数据，不重启正在运行的 LFAA Web/Daemon，不改不相关差异。
- 验收：回归覆盖无 DSH renderer 时 LFAA fallback、上游 renderer 收到 fallback、Wallpaper Engine Settings 的插件状态入口、右侧插件 tab 的缺内容状态，以及可选 `shell.overlay` 没有伪告警；运行相关 Client 包构建、Web 构建、定向回归和目标差异检查，产物仅写根 `dist/`。浏览器目视/点击验收单独报告，不以源码或构建代替。

### 实施记录

- 2026-10-04：检查 `H:\deepseek-harness` 的上游 Slot 类型与 renderer，确认 `RenderOpts.fallback` 在无单槽/keyed/list 内容时渲染；LFAA bridge 原先只接受并传递 `entryKey`，renderer 缺失则直接返回 `null`。
- 将 Slot Context/Outlet 移到同包 `client/slots.ts`，由原 `client/index.ts` 重导出，保持调用路径兼容并隔离运行时依赖，便于独立回归。`DshSlotOutlet` 现在在本地 renderer 缺失时显示本地 fallback，并在 DSH renderer 可用时同时透传 `entryKey` 与 `fallback`；UI Renderer Host 类型已补齐 fallback。
- Wallpaper Engine Settings 空态提供跳转到既有“插件”状态页的按钮；已登记但没有 Slot 内容的右侧插件 tab 会显示未加载说明。可选 `shell.overlay` 不设 fallback。外观沿用当前设置/工作区主题树，不新增设置字段；`appearance.wallpaperEngine.enabled/projectId`、Profile 插件启停状态及其 Owner 均未改动。
- 2026-10-04：定向回归 8/8 通过（本任务 3 项 Slot 检查，加上 DSH Runtime/Profile/Host carrier 相关回归）。`lfaa-client-modules`、`lfaa-client-ui-renderer`、`lfaa-client-ui-settings`、`lfaa-client-ui-workspace` 包构建通过；Web TypeScript 与 Vite 构建通过，产物写入根 `dist/`。第一次 Web 检查发现并清理了未使用的 React import 后重跑通过。目标跟踪文件 `git diff --check` 与新增源文件空白扫描通过。Vite 报告一个 1.36 MB 的主 JS chunk 超过 500 KB 提示；本次没有新增轮询、监听或异步工作，帧时间未测。浏览器中的空态视觉/点击、真实插件 Client Runtime 加载及媒体行为未验；没有安装/启用插件或重启服务。

## LFAA-WALLPAPER-ENGINE-UPSTREAM-UPDATES-01

### 用户目标与可观察行为

- Wallpaper Engine 的 UI、资源和领域功能继续来自用户指定的官方插件仓库；正常的上游版本/commit 更新不需要复制或维护一份 LFAA 插件 UI fork。
- LFAA Runtime Adapter 只适配稳定 DSH/LFAA 边界；每次安装的源仓库、commit、归档摘要、插件清单和运行副本摘要仍须逐层核验。插件来源检查与安装都调用 Runtime 的同一份快照兼容校验，兼容合同改变时明确拒绝替换/运行，不静默加载不兼容版本。

### 运行入口、Owner 与设置盘点

- 运行入口与数据归属不变：`packages/boot/plugin-manager` 的 Web Profile 插件 Runtime；源代码与提交由现有 Plugin Manager 固定/校验，Profile 插件私有数据仍存现有 `runtime-data` Owner，账户当前壁纸仍由 `appearance.wallpaperEngine` Settings Owner 持有。
- 不新增设置、默认值、持久化或执行权限；不读取或修改 `H:\deepseek-harness\plugins\dsh-wallpaper-engine` 上游文件。

### 允许修改

- `packages/boot/plugin-manager/src/dsh-wallpaper-engine-runtime.ts`：将固定提交特例转为 exact repository + installed revision 输入的兼容适配，提供安装快照合同校验，清单 version 与 Plugin Record 一致校验，副本按每次安装的 commit/adapter revision 隔离。
- `packages/boot/plugin-manager/src/index.ts`：让 Plugin Runtime Adapter 可报告快照合同校验，并只为同一官方 Wallpaper Engine 插件增加经检查/审批后的安全版本替换；保留通用插件 ID 冲突策略，启用中的插件必须先停用，升级失败恢复原安装。
- `apps/cli/tests/dsh-wallpaper-engine-runtime.test.mjs`、`apps/cli/tests/plugin-manager.test.mjs`：覆盖同一官方仓库不同 version/commit 在 DSH 公共接口未变时可适配和受控升级，以及错误仓库/清单、缺少兼容锚点、启用态升级时拒绝运行或覆盖。
- `packages/boot/plugin-manager/README.md`、`docs/系统总体架构.md`、`docs/PROMPTS.md`：记录提交校验仍然固定、兼容版本边界、更新入口和真实更新状态。

### 禁止修改

- 不放宽 Plugin Manager 对官方仓库提交、归档 SHA、路径/文件类型、Manifest 与运行副本内容摘要的校验；不接受其他仓库/插件 ID，也不自动跟踪未解析的 `main`。
- 不因“上游更新”自动执行安装、启用、发布或重启现有服务；新 revision 仍须由 Plugin Manager 取得并核验成一个明确 commit。
- 不把 DSH ABI 改变、媒体 Host 新依赖或新的插件能力假报为兼容；不能通过字符串补丁安全适配的版本保持不可启用。

### 验收条件

- Runtime 不在业务代码重复锁定单一 Wallpaper Engine version/commit；包版本必须等于已校验安装记录，Profile 运行副本与摘要必须按该记录的 commit 和 Adapter revision 独立隔离。
- 两个由测试夹具表示、插件 ID/官方仓库相同且 DSH 注入和 Host/Client 适配锚点兼容的 version/commit 均可通过；错仓库、错 manifest、无效 commit 与失配的宿主/界面锚点必须拒绝，且不进入 Loader。
- `capability_inspect` 与 `capability_install` 使用相同的 Runtime 快照核验结果；不兼容 revision 不得覆盖当前已安装版本。
- 只有 Plugin Manager 完成来源检查并产生新的固定 commit 后，才允许替换同一官方插件；升级必须经过现有检查/审批链、绑定同一个 App，并要求插件已停用。其他仓库的同 ID 冲突策略不变。
- 旧版已生成运行副本不被覆盖或删除；新 commit 使用新副本路径，原 `runtime-data` 不迁移、不清空。升级安装目录失败时恢复旧目录与清单。正常上游版本只通过 Plugin Manager 的固定源安装/更新，不改上游 UI 代码。
- 运行适配直接回归、Plugin Manager 与 Web 构建、差异检查通过；真实更新/启用及插件 UI/媒体仍单独报告，不以动态版本夹具代替真实来源验收。

### 实施记录

- 本轮开始前合同已登记；源输入与现有版本冲突策略已完成只读核对，后续实施结果追加于此。
- 2026-10-04：移除 Runtime 对 `1.2.0` 与单一 commit 的硬编码；只接受官方仓库、稳定 DSH 包身份、与已安装记录一致的语义版本/commit/归档摘要和 DSH manifest。Plugin Manager 来源检查、首次安装与官方同源更新调用相同的 Runtime 快照合同校验；Host WebServer 与 Client RopeDock/生命周期锚点有变化时显示不可兼容并保留旧版本。每个 commit/适配器修订使用隔离运行目录；经现有 `capability_inspect` → `capability_install` 检查/审批后，可替换同一官方插件的已停用版本，更新后保持停用，Profile 运行数据保留。LFAA UI fork 不随插件 UI 变更维护。
- 指向插件版本仍须固定到明确 commit；不会自动跟踪 `main`。插件管理器和 Runtime 不加载不兼容新源，也不覆盖已启用版本。Plugin Manager/runtime 目标回归 16/16，插件管理器、UI Workspace、UI Layout 构建通过，Web TypeScript + Vite 构建通过；产物只在根 `dist/`，Vite 保留约 1.36 MB chunk warning。真实上游新版本、插件安装启用、登录浏览器和 Steam 媒体/桌面验收未执行。

## LFAA-UI-AI-STREAM-CARET-COMPACT-01

### 用户目标与可观察表现

- 修复 AI Work 正在回复时粉色流式光标落到正文下一行的问题，让它紧跟最后一段仍在输出的文字。
- 收紧红框中 AI 回复的活动/工具状态行与下方问题/审批交互卡之间的纵向空白。

### 运行入口、设置与 Owner

- 运行入口：`apps/web` 与共用 Client 的桌面 WebView；目标 App 为 Minecraft AI Work。
- 消息与活动轨迹由 `packages/client/ui-chat/src/AiWorkChat.tsx` 管理，Markdown 与样式由 `packages/client/ui-chat/src/AiMarkdown.tsx` 和 `packages/client/ui-chat/src/ai-work-chat.css` 管理；滚动恢复与跟随继续归现有滚动 Owner。
- 不新增设置。继续读取工作台映射的 `appearance.theme`、`appearance.accentColor`、界面/内容字体与字号、对比度、壁纸遮罩、模糊和减少动态效果设置；本次只用现有强调色绘制流式光标，既有设置映射不变。
- 不改会话、消息、工具活动、审批、模型请求、认证、授权或持久化。

### 允许修改

- `packages/client/ui-chat/src/AiWorkChat.tsx`：移除作为 Markdown 块容器兄弟节点的流式光标。
- `packages/client/ui-chat/src/ai-work-chat.css`：在末尾文本段落行内绘制光标；消息内容短于滚动视口时将消息列贴近底部交互卡，内容溢出时保持原滚动。
- `docs/PROMPTS.md`：登记本合同与实际验证记录。

### 禁止修改

- 不改变消息排序、历史滚动、自动跟随、锚点跳转、滚动位置恢复或输入框/审批卡行为。
- 不调整主题设置、默认值、持久化或外观映射；不增加 CSS 自定义属性或依赖。
- 不修改其他未提交工作，不部署、发布、上传或提交 Git。

### 验收条件

- 普通文本流式回复中的光标与最后一个文本段落处于同一行，不再增加额外空行高度。
- 当消息内容未溢出时，红框中的空白使用 12px 消息列底部内边距加既有工作区间隔；消息内容溢出时仍可自然滚动及恢复位置。
- 执行 Web 构建及本任务差异检查；若存在直接覆盖本行为的现有回归则执行定向回归。登录态浏览器目视与真实 Provider 流式回复未执行时，明确记录为待实测。

### 实施记录（2026-10-02）

- 移除 `AiWorkChat.tsx` 中作为 Markdown 容器兄弟节点的光标；由样式在流式回复最后一个段落/标题的行内尾部绘制，使普通文本回复不再多出一行。
- 用户补充截图确认红框位于最新 AI 回复活动状态行与问题交互卡之间。消息列底部对齐之后固定 34px 下内边距仍使间距偏大；下内边距已从 34px 收到 12px。活动区原有 14px 上边距保持不变，历史内容仍使用同一滚动容器。
- 继续使用工作台的 `appearance.*` 映射和强调色；未新增配置、自定义属性或依赖。纯 CSS 调整不增加订阅、请求或持续性主线程工作，未进行浏览器帧时间测量。
- `pnpm --filter lfaa-client-ui-chat run build` 通过，输出位于根 `dist/packages/`；`pnpm --filter @yubboo/lfaa run test -- tests/client-performance.test.mjs` 通过，12/12；本任务差异 `git diff --check` 通过。
- `pnpm --filter lfaa-web run build` 的 TypeScript 与 Vite 构建通过，产物位于根 `dist/apps/web/`；Vite 有大于 500KB 的分块提示，未调整与本任务无关的拆包策略。`pnpm --filter lfaa-client-ui-chat run build` 通过；`pnpm --filter @yubboo/lfaa run test -- tests/client-performance.test.mjs` 通过 12/12；CSS 解析及本任务 `git diff --check` 通过。
- 未在登录态浏览器中观察修改后的留白或真实 Provider 流式回复，待实测。

## LFAA-UI-AI-RUN-REFRESH-01

### 用户目标与可观察表现

- AI Work 页面刷新后若服务端 Agent Run 仍活动，应跟随同一个 Run；待回答的澄清问题仍保持可见，不创建新模型轮次，也不重放工具或节点副作用。
- 活动状态行从会话/活动记录的原始服务端时间戳计算时长。Run 等待用户回答或审批时，消息标签、摘要文案和流式光标都明确显示等待状态；页面刷新不能把时长重置成刚重新订阅后的时间，也不能把等待误报为正在处理。

### 运行入口、设置与 Owner

- 运行入口：Web 与共用 Client 桌面 WebView；`packages/client/ui-chat/src/AiWorkChat.tsx` 恢复会话、重新订阅并渲染持续时间；`packages/client/connection/src/api.ts` 对已有 runId 使用 GET 事件流，对新任务才 POST；服务端持久化时间戳由 `packages/core/session/src/sessions.ts` 提供。
- 权威状态仍归服务端会话与 Agent Run Owner；本任务只调整 Client 的时间计算和状态文案，不改 Run/审批/澄清生命周期。
- 设置盘点：没有新增或修改设置。既有 `general.questionNotifications` 与 `general.permissionNotifications` 仅控制后台提醒，不控制当前交互栏；外观继续使用现有工作台主题令牌和 Appearance 映射。

### 允许修改

- `packages/client/ui-chat/src/AiWorkChat.tsx`：按持久化的 Run/活动时间戳呈现真实持续时间及等待状态。
- `packages/client/ui-chat/src/activity-duration.ts`：提供纯函数，集中计算活动状态显示和秒数。
- `apps/cli/tests/ai-work-activity-duration.test.mjs`：覆盖页面重挂载后沿用原时间戳、澄清/审批等待文案及已有 Run 通过 GET 恢复。
- `docs/PROMPTS.md`：登记合同及验证记录。

### 禁止修改

- 不将刷新恢复改成新建 Run；不改变已有 runId 的 GET 订阅路径、问题答案 API、审批合同、权限模式或节点任务语义。
- 不把待答状态移到浏览器本地存储，不隐藏或自动回答澄清问题，不触发任务/工具重放。
- 不修改设置中心、外观令牌、CSS 变量、无关页面、Server/Daemon Owner 或其他未提交工作。

### 验收条件

- 同一持久化 `createdAt`/`startedAt` 在模拟页面刷新后的新 `now` 下继续累计时长；`waiting_input` 与 `approval_required` 显示等待文案。
- `streamAiChat({ runId })` 使用原 runId 发出 GET 事件订阅且不带新任务请求正文；新 Run 的 POST 行为保持不变。
- 运行聊天包直接构建、相关持久化/客户端回归和本任务差异检查；真实登录态刷新与帧时间若未运行须明确标为未验。

### 实施与验证记录

- 根因核对：会话恢复找到未结束 assistant 消息后，以其原 runId 调用 `streamAiChat`；客户端对已有 runId 发 GET `/api/ai/runs/:runId/events`，只有新任务才 POST `/api/ai/chat/stream`，因此浏览器刷新会重新订阅原 Run，不会另建模型轮次。页面计时器却从组件挂载时重新计时，消息仍显示“正在回复”并保留流式光标，导致待答澄清看起来像重新执行。
- 活动摘要改用服务端持久化的 Run `createdAt` 或活动 `startedAt` 计算时间；等待用户补充信息/审批时改为等待文案，并隐藏流式处理标签和光标。刷新后澄清问题继续显示，仍须由用户作答。
- 设置中心没有新增或修改项；既有 `general.questionNotifications`、`general.permissionNotifications` 和 `permissions.mode` 语义不变。继续使用工作台 Appearance 映射，未新增 CSS 变量或依赖。每秒时钟更新沿用原有单个 `setInterval`，没有新增读取请求、订阅或观察器；未测实际浏览器帧时间。
- `pnpm --filter @yubboo/lfaa run test -- tests/ai-work-activity-duration.test.mjs` 通过 4/4；`pnpm --filter @yubboo/lfaa run test -- tests/client-performance.test.mjs` 通过 13/13。`pnpm --filter lfaa-client-ui-chat run build` 与 `pnpm --filter lfaa-web run build` 通过，产物均位于根 `dist/`；Web 构建保留既有大于 500KB 分块提示。目标文件 `git diff --check` 通过。
- 仓库没有 `scripts/workspace-preflight.mjs`、`workspace-preflight` 或独立 quality/release Gate 命令，故未运行这些不存在的门禁。Edge 当前没有可读取的标签页，浏览器状态读取返回 `nodeRepl.fetch request failed`；登录态刷新、Provider 交互和视觉帧时间仍待实测。

## LFAA-UI-AI-STOP-BUTTON-ACCENT-01

### 用户目标与可观察表现

- 将 AI Work 输入区右下角的运行中停止按钮做成用户截图中的强调色圆形按钮，并显示白色方块停止图标。
- 按最新反馈把停止圆钮缩为 32×32px、方块放大为 10×10px；此尺寸只用于运行中停止按钮，不改变普通发送按钮。
- 按钮背景随设置中心当前生效的强调色变化；停止当前 AI Run 的现有动作不变。

### 运行入口、设置与 Owner

- 运行入口：Web 与共用 Client 桌面 WebView；`packages/client/ui-chat/src/AiWorkChat.tsx` 渲染输入区和运行中停止动作，`cancelAiRun` 继续负责取消当前 Run。
- 设置盘点：设置中心“外观 > 强调色”写入账户 `appearance.accentColor`，默认值为 `#3457d5`；当外观启用按主题分别设置时，使用 `appearance.advanced.modeStyles[resolvedTheme].accentColor`。现有 Appearance 控件、服务端允许颜色校验、账户设置持久化和前端映射均已接入。
- `packages/client/ui-layout/src/Workbench.tsx` 按当前主题解析生效强调色，并在 `.workbench-shell` 设置 `--settings-accent`；停止按钮使用这一共享令牌，沿用现有反色文字和焦点环。主题、对比度、壁纸遮罩、模糊、字体/字号和减少动态效果均保持既有设置映射，不新增设置或覆盖用户偏好。
- 权威状态仍为 AI Work 当前活动 Run；本次只改按钮外观，不改会话、模型请求、停止/取消生命周期、授权、消息或持久化。

### 允许修改

- `packages/client/ui-chat/src/AiWorkChat.tsx`：仅替换运行中停止按钮的危险样式和叉号图标，保留现有取消回调、可访问名称与发送态分支。
- `packages/client/ui-chat/src/ai-work-chat.css`：设置停止按钮专属的强调色圆形尺寸并绘制实心方块图标；复用 `--settings-accent` 和现有主题令牌，不增加 CSS 自定义属性。
- `docs/PROMPTS.md`：登记本合同、设置盘点和验证记录。

### 禁止修改

- 不改变 `cancelAiRun` 调用、停止语义、Run 状态、发送按钮、无活动时的提交按钮或输入区布局。
- 不把停止按钮的尺寸规则套用到普通发送按钮。
- 不新增颜色选择项、默认值、设置持久化、服务端校验、依赖、动画或其他页面样式。
- 不修改无关未提交工作，不部署、发布、上传或提交 Git。

### 验收条件

- 活动 Run 时按钮呈现强调色实心圆和居中的反色实心方块；强调色切换时无需组件内硬编码颜色即可同步变化。
- 停止按钮为 32×32px，方块为 10×10px；普通发送按钮仍使用原有 36×36px 尺寸。
- 按钮仍有“停止生成”的可访问名称和提示，键盘焦点环保留，点击仍只取消当前活动 Run。
- 非活动状态的发送按钮和其他输入操作不变；主题色由工作台令牌继承，不破坏浅色/深色主题。
- 执行聊天包构建、Web 构建及本任务差异检查；没有直接覆盖按钮交互的现有回归时不新增一次性测试。未完成登录态浏览器目视或外观切换验证时明确标为待实测。

### 实施与验证记录

- 运行中停止按钮改为 `type="primary"`，使用现有 `.ai-work-chat__composer-submit.ant-btn-primary` 强调色样式；白色方块通过 `currentColor` 继承按钮文字颜色。取消按钮原有 `aria-label`、提示和 `cancelAiRun` 回调保持不变，移除不再需要的危险态背景规则。
- 按用户后续反馈，仅将运行中停止按钮缩为 32×32px，并把中心方块放大到 10×10px；通过停止态专用 class 限定尺寸，普通发送按钮保持 36×36px。聊天包及 Web 已重建，最终 CSS 产物确认同时保留两组尺寸。
- 设置中心配置核对：`SettingsPage.tsx` 保存 `appearance.accentColor`；默认值为 `#3457d5`，后端 schema 限制为外观面板提供的六种颜色，`saveUserSettings` 持久化到账户 `user_settings`。启用主题分别设置时，`Workbench.tsx` 选中当前主题的 `modeStyles[resolvedTheme].accentColor`，再注入 `.workbench-shell` 的 `--settings-accent`。组件消费该令牌，未修改控件、类型、默认值、校验或持久化。
- 聊天包构建通过，输出写入根 `dist/packages/`；Web TypeScript/Vite 构建通过，输出写入根 `dist/apps/web/`，生成 CSS 含强调色按钮和方块图标规则。Vite 报告一个大于 500KB 的既有 JS 分块提示；本任务没有调整拆包策略。
- CSS 解析与目标文件 `git diff --check` 通过。无直接覆盖停止按钮呈现的组件回归；未新增测试。停止回调和可访问名称经源码核对；未在登录态浏览器中实际切换强调色或目视浅/深色主题，浏览器验收待做。按钮样式为静态 CSS，没有新增订阅、请求、动画或持续主线程工作；未测浏览器帧时间。
- 根 `package.json` 与 `scripts/` 未提供 `workspace-preflight`、quality 或 release Gate，本任务未运行不存在的 Gate。

## LFAA-AI-CONTEXT-REUSE-01

### 目标与运行入口

新一轮 AI Work 继续使用历史用户对话、澄清答复与助手答复，但不把历史已完成轮次的完整 `assistant.tool_calls` 和 `tool` 返回体再次发送给 Provider。它们仍完整保存在会话模型记录中；当前 Agent Run 的工具调用、真实结果、审批和后续模型判断保持原样。

运行入口是 `packages/core/session/src/sessions.ts` 的历史投影，AI Work 的 Web/Desktop 共用 `packages/core/agent-loop/src/execute-turn.ts` 消费该历史并发起模型请求。

### 设置、数据与权限 Owner

- 会话消息、内部模型协议和模型历史由 Session Owner 持久化；本任务只改变新一轮模型请求的历史投影，不删除或改写已存储的 `model_history`。
- Agent Loop 继续使用设置中心现有的 `aiRuntime.maxModelRequests`、`maxToolCalls`、`maxOutputTokens`、`requestTimeoutSeconds` 与当前 Provider/模型设置。本任务不新增设置项；设置中心没有历史上下文裁剪配置。
- 用户、App、项目/节点上下文、工具可用范围及权限仍由既有 Session、Settings、Tools、Permission 与 Daemon Owner 执行。

### 允许修改

- `packages/core/session/src/sessions.ts`：为已完成历史轮次生成对话投影，保留历史用户消息、轮内用户引导输入、已回答/跳过的澄清问题和助手最终答复；不向新一轮重放旧 `tool_calls` 与工具结果。
- `apps/cli/tests/agent-runtime.test.mjs`：验证模型上下文体积下降、历史答复和引导输入仍在、完整工具协议仍保存在 Session 持久化记录中。
- `docs/PROMPTS.md`、`docs/系统总体架构.md`、`docs/开发计划.md`：同步上下文投影边界、任务状态和验证证据。

### 禁止修改

- 不删除、截断或覆盖已持久化的原始工具协议、结果、活动轨迹或审计证据。
- 不压缩当前 Agent Run 内仍需模型继续判断的工具结果；不跳过真实状态查询、审批、参数校验、权限检查或操作结果核实。
- 不截断本轮用户输入，不改变 Provider、工具选择、MCP App 范围、工具调用预算或用户设置，不加入关键词路由和固定启动流程。
- 不修改与本任务无关的已有工作区改动，不暂存、提交、推送、部署或发布。

### 验收条件

- 新一轮历史不包含上轮已完成的普通 `tool` 消息或 `assistant.tool_calls`，但保留此前用户目标、助手最终答复、轮内用户引导及澄清回答/跳过选择。
- 同一运行中的工具协议和真实结果仍完整进入后续模型请求；历史原始 `model_history` 仍完整持久化。
- 定向回归使用大体积合成工具结果，比较重建前后模型历史序列化长度；直接运行 Agent Runtime 回归、Agent Loop/Session 构建与 `git diff --check`。
- 不连接用户 Provider/Daemon，不读取真实会话数据库。Provider 实际用量下降和登录态 Web/Desktop 体验需在运行环境复测，不能由合成夹具或构建代替。

### 实施与验证记录

- `historyForTurn()` 为新 Agent Run 重建历史时，保留旧轮次的用户输入、模型历史中的用户引导、用户澄清回答/跳过选择和助手最终答复，不再重放旧轮次的 assistant 工具调用协议与普通工具返回体。已持久化的 `model_history` 未修改；当前 Agent Run 内的模型循环和工具结果回传未改。
- 设置中心核对：继续使用既有 `aiRuntime.maxModelRequests`（默认 12）、`maxToolCalls`（默认 24）、`maxOutputTokens`（默认 2048）及 `requestTimeoutSeconds`（默认 90 秒）；未新增设置项或改变用户值。当前设置中心没有历史上下文预算配置。
- 定向回归 `pnpm --filter @yubboo/lfaa run test -- tests/agent-runtime.test.mjs` 通过 1/1。合成历史含重复 12,000 次的大体积工具结果；对照序列化字符数从 132,595 降至 198（减少 99.85%），旧用户输入、澄清回答、引导与最终答复仍在，持久化模型历史仍保留原始工具返回。该数字是合成夹具中历史片段的结构性证据，不代表完整 Provider 请求的 Token 折扣比例。
- `pnpm --filter lfaa-agent-loop run build`、`pnpm --filter lfaa-session run build`、`pnpm --filter @yubboo/lfaa run typecheck`、`pnpm run build:control-plane` 和 `git diff --check` 均通过；控制端产物写入根 `dist/apps/control-plane/`。
- 当前仓库没有 `scripts/workspace-preflight.mjs`，根命令也没有 quality/release Gate，未运行不存在的门禁。未连接真实 Provider、Daemon 或登录态浏览器；实际 Provider 用量下降、端到端启动时延及 Web/Desktop 运行态仍待复测。

## LFAA-UI-AI-WORK-OUTPUT-FOCUS-01

### 用户目标与可观察行为

- AI Work 中央回复输出列在鼠标移出时按账户偏好模糊，以露出工作区壁纸；鼠标进入中央输出列或键盘焦点进入其中时恢复清晰。
- 外观设置提供启用开关及百分比强度；新字段默认启用、强度 33%，范围 0–100%，模糊半径映射为 0–24px，失焦透明度映射为 100%–0%（强度 100% 时完全透明）。进入回复列后恢复清晰和完全不透明。旧账户保存的 px 值换算为百分比，并保留其他已保存的高级外观偏好。
- 仅对支持精确悬停的指针设备生效；触屏保持清晰。减少动态效果开启时不做模糊过渡。
- 展开助手回复中的工作轨迹后，鼠标移出/移入仍即时切换虚化与清晰状态，无需再次点击回复区；鼠标点击产生的焦点不得锁定清晰态，键盘可见焦点继续保持内容清晰。
- 整页刷新会重建浏览器文档并丢失 `:hover`；同一标签页刷新时按刷新前的回复列内/外状态恢复。首次没有可恢复状态时先显示可读内容，收到首个指针事件后按实际命中区域恢复虚化，不要求额外点击。只保存内/外状态，不保存消息内容。
- 设置手动保存成功或失败时，在视口中央短暂显示主题适配的悬浮反馈卡；保留自动保存与服务端输入校验。

### 运行入口、设置与 Owner

- 运行入口：Web 与共用 Client 桌面 WebView；`packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 按 `ai-work` 模式挂载 `packages/client/ui-chat/src/AiWorkChat.tsx`，`packages/client/ui-chat/src/ai-work-chat.css` 渲染中央滚动回复列。
- 设置入口：设置中心“外观 > 背景显示”；现有账户级 `appearance` 设置保存主题、壁纸、遮罩和玻璃模糊，通用玻璃模糊不控制透明的回复画布。本任务在 `appearance.advanced` 使用 `aiWorkOutputFocusBlurEnabled` 与 `aiWorkOutputFocusBlurPercent`；强度以 0–100% 表示，映射到 0–24px 模糊半径和 100%–0% 失焦透明度。兼容已保存的 `aiWorkOutputFocusBlurAmount`，按原 px 值换算为百分比后继续保留效果。
- 设置 Owner：`packages/settings/settings/src/service.ts` 的账户设置读取/持久化和后端默认值；`packages/api/remotes/src/route-contracts.ts` 校验 HTTP 输入；`packages/client/connection/src/api.ts` 提供 Client 类型与默认值；`packages/client/ui-settings/src/SettingsPage.tsx` 提供设置控件；`packages/client/ui-layout/src/Workbench.tsx` 把账户值映射为工作台 CSS 令牌供共享 Client 使用。
- 继续遵循现有浅/深色主题、账户字体与字号、壁纸及遮罩、通用玻璃模糊和减少动态效果设置；不覆盖这些既有偏好。

### 允许修改

- `packages/client/connection/src/api.ts`：高级外观设置类型及 Client 默认值。
- `packages/settings/settings/src/service.ts`：高级外观字段默认值、旧 px 值迁移与旧账户兼容读取。
- `packages/api/remotes/src/route-contracts.ts`：新百分比和旧 px 字段的服务端范围校验。
- `packages/client/ui-settings/src/SettingsPage.tsx`：增加外观设置开关和 0–100% 强度滑块。
- `packages/client/ui-settings/src/SettingsPage.css`：为手动保存结果提示卡提供主题适配的居中悬浮样式与减少动态效果处理。
- `packages/client/ui-layout/src/Workbench.tsx`：将账户百分比换算为 0–24px 模糊令牌和 100%–0% 透明度令牌，并映射状态属性。
- `packages/client/ui-chat/src/AiWorkChat.tsx`：追踪回复列内/外指针状态，并用现有浏览器持久化能力按用户、App 和标签页作用域恢复；仅在状态边界变化时写入。
- `packages/client/ui-chat/src/ai-work-chat.css`：中央回复列的悬停/键盘聚焦显隐、模糊与透明度平滑过渡、触屏保护与减少动态效果处理。
- `apps/cli/tests/file-storage.test.mjs`：验证账户设置持久化、百分比边界及旧 px 设置迁移。
- `docs/系统总体架构.md`、`docs/PROMPTS.md`：同步外观设置事实、任务合同和验收记录。

### 禁止修改

- 不改变消息内容、会话、滚动/自动跟随、审批与澄清、输入区、左右工作台面板及背景渲染 Owner。
- 不把现有整站玻璃模糊设置改作回复文本虚化强度；不增加客户端 API/Socket 订阅、请求、计时器或持续动画。页面离开状态保存监听必须在卸载时移除，且持久化只包含指针内/外标记。
- 不新增依赖，不重置用户已有外观值，不修改与本功能无关的未提交工作；短暂提示只在显式保存操作后显示，并清理自动关闭计时器；不部署、发布、上传或提交 Git。

### 验收条件

- 设置开关即时生效且重载后保留；强度范围校验为 0–100%，映射到 0–24px 模糊和 100%–0% 失焦透明度，100% 时回复内容完全透明，鼠标移入或键盘聚焦后恢复清晰不透明；旧 px 设置迁移后保留等效强度，旧账户已有高级外观字段不因新字段缺失而回退到整组默认值。
- 当前 Client 外观 payload（含新百分比字段）可通过服务端 schema；手动保存成功/失败会在视口中央给出可读反馈，重复触发时复用单个卡片与计时器。
- 在鼠标/键盘和触屏设备分别核对清晰规则；模糊仅覆盖中央回复列，交互卡、输入框、滚动与回到底部行为不变。
- 展开活动轨迹 `<details>` 后，将指针移出和移入消息列均可触发预期过渡，不需点击消息列重置焦点；键盘用 `Tab` 聚焦工作轨迹时仍保持清晰可读。
- 鼠标移入/移出中央回复列时只切换消息列的数据属性与既有持久化，不为指针边界变化重新渲染整个聊天树；模糊和透明度继续使用单次连续过渡，不出现内容闪烁或位移。
- 指针停在回复列内刷新页面后，内容无需再次移动或点击即可保持清晰；停在列外刷新后保持虚化。没有已保存位置时先清晰显示，首个鼠标/笔输入事件后按实际指针命中区域切换；触屏不启用此跟踪。
- 运行相关设置持久化回归、设置/聊天包构建及 Web 构建；检查没有新订阅/持续主线程工作。未完成登录态浏览器悬停、设置保存和浅/深色实测时准确标明待验。

### 实施与验证记录

- 外观高级设置新增 `aiWorkOutputFocusBlurEnabled`（默认启用）和 `aiWorkOutputFocusBlurPercent`（默认 33%，映射为 7.92px，Joi 与 UI 限定 0–100%，对应 0–24px）。设置中心提供开关与百分比强度滑块；旧账户缺少新键时只补默认值，旧 `aiWorkOutputFocusBlurAmount` px 值按原比例迁移，保留已保存的主题、模糊、字号和字体。
- `Workbench.tsx` 按账户百分比映射 `--settings-ai-work-output-focus-blur` 与 `--settings-ai-work-output-focus-opacity`；精确鼠标设备在中央 920px 消息列失焦时同时模糊并淡出，100% 强度完全透明；悬停或键盘聚焦时清晰且完全不透明，触屏设备无此规则。滤镜与透明度使用 360ms 柔和缓动，减少动态效果时仍关闭过渡。没有新增 JS 订阅、请求、计时器或持续工作。
- 展开活动轨迹后的失焦异常定位为 `<summary>` 的鼠标点击留下 `:focus-within`，使父消息列即使指针移开仍匹配清晰态；现改用消息列悬停或 `:has(:focus-visible)` 保持清晰，鼠标点击焦点不再锁定状态，键盘可见焦点继续生效。
- 刷新异常的根因是整页刷新会重建文档，浏览器不会保证恢复 CSS `:hover`；单靠悬停选择器会让刷新前仍停在回复列内的指针暂时落入虚化态。本轮用现有按用户/App/标签页隔离的浏览器持久化只记录 `inside`/`outside`，挂载时恢复 `data-pointer-active`，不保存消息或凭据。没有记录时先保持内容可读，首个非触屏指针移动后按真实命中区域更新，因此无需额外点击；指针区域不变时不重复写存储或触发 React 状态更新，`pagehide` 监听在卸载时移除。
- 2026-10-02 使用已登录的 `http://127.0.0.1:5173/apps/minecraft/ai-work` 做刷新验收：指针在回复列外刷新后 `data-pointer-active=false`、`opacity=0`、`filter=blur(24px)`；指针移入回复列后刷新，`:hover=false` 但 `data-pointer-active=true`、`opacity=1`、`filter=none`，确认可见且不需要再次点击。当前设置中心的 `aiWorkOutputFocusBlurEnabled` 与 `aiWorkOutputFocusBlurPercent` 继续控制开关及 0–100% 强度，未改用户偏好。
- 设置分类的显式“保存”入口统一经 `persistSettings()` 显示视口居中成功/失败卡，卡片共用单个可取消计时器并在卸载时清理；自动保存失败继续显示原分类错误，不混入手动保存结果反馈。
- 设置回归 `pnpm --filter @yubboo/lfaa run test -- tests/file-storage.test.mjs` 通过 6/6，覆盖旧设置兼容、账户持久化、百分比边界和旧 px 换算；加入失焦透明度和 `:focus-visible` 修复后，聊天包构建通过，布局包构建通过。连接、设置 Owner、API、聊天、布局、设置 6 个目标包构建及 `pnpm run build:control-plane` 通过，产物位于根 `dist/`。Web 构建通过；期间一次重建在 TypeScript 检查阶段遇到主题引导文件的 `HTMLElement.dataset` 类型错误，后续重建通过。Vite 提示一个既有 JS 分块超过 500KB，本任务未调整拆包。
- 截图中的“提交内容格式不正确”来自远程路由 Joi 请求校验失败的通用提示。当前 Client 百分比 payload 已由 Joi 回归覆盖；排查时发现端口 3000 的旧 `lfaa web` 进程早于当前控制端构建。最终复核端口进程启动时间晚于 `dist/apps/control-plane/index.js` 构建时间，且 `/api/health` 返回 200，因此当前本地服务已加载新合同。登录态保存交互未自动操作，浏览器端仍待用户实际保存确认。
- 构建后的 AI Work CSS 已静态确认包含开关数据属性、强度令牌、悬停/键盘选择器与减少动态效果规则。`git diff --check` 通过。新增工作只在指针状态变化时触发 CSS filter；实际帧时间及大消息列表滚动下的绘制开销未测。

### 续修合同（2026-10-03）

- 用户反馈中央回复区的虚化在鼠标移入/移出时像闪屏、画面抖动，过渡不够平滑。
- 用户截图红框中的“回到底部”按钮位于 `.ai-work-chat__message-list` 之外，因此之前只给消息列设置的虚化规则没有覆盖该按钮；它也必须跟随同一失焦强度虚化。
- 当前代码检查确认：回复列内外边界变化会调用 `setOutputPointerLocation`，触发 `AiWorkChatView` 整体重新渲染；该树包含完整消息/Markdown 列表，存在打断滤镜过渡和重复绘制的风险。此为静态代码证据，运行时帧耗时尚未测量。
- 续修范围：仅把内外状态切换改为 ref 驱动的 `data-pointer-active` 更新；保留按用户/App/标签页保存的边界状态、现有设置映射、滤镜强度、淡出效果、键盘可见焦点、触屏保护与减少动态效果规则。不调整消息、滚动或布局。
- 验收：边界变化不触发聊天 React state 更新；消息列和“回到底部”按钮在回复区失焦时共同使用相同虚化/透明度强度，悬停或键盘可见焦点时按钮恢复清晰且仍可操作；触屏和减少动态效果行为保持。已有刷新恢复与持久化逻辑保持；聊天包和 Web 构建通过。浏览器移入/移出手感及帧时间需与静态/构建结果分开记录。

### 续修实施记录（2026-10-03）

- 移入/移出时不再调用 `setOutputPointerLocation`；ref 保存当前位置，直接更新回复列的 `data-pointer-active` 并沿用现有账户/App/标签页持久化。刷新恢复在布局 effect 中同步恢复 ref 和 DOM 属性，因此指针边界切换不触发 `AiWorkChatView` 重渲染。现有 360ms 滤镜/透明度过渡和触屏、键盘及减少动态效果规则保持。
- 使用设置中心现有 `appearance.advanced.aiWorkOutputFocusBlurEnabled`、`appearance.advanced.aiWorkOutputFocusBlurPercent` 与 `appearance.advanced.reducedMotion`；本次未改设置字段、默认值或用户偏好。
- `pnpm --filter lfaa-client-ui-chat run build` 通过，包产物位于根 `dist/packages/`。`pnpm --filter lfaa-web run build` 串行重跑通过 TypeScript 与 Vite 构建，产物位于根 `dist/apps/web/`；构建保留既有超过 500KB 的分块提示。首次并行构建因 pnpm workspace-state 文件重命名冲突失败，串行重跑成功。
- `git diff --check -- docs/PROMPTS.md packages/client/ui-chat/src/AiWorkChat.tsx` 通过。仓库未找到 `workspace-preflight`、quality 或 release Gate 命令，未运行不存在的 Gate。
- 本次续修未运行自动化回归；已有外观设置持久化回归覆盖设置数据，不覆盖这里的鼠标绘制体验。
- Edge 浏览器连接仍返回 `nodeRepl.fetch request failed`，没有登录态的真实移入/移出目视或帧时间数据；不把静态检查和构建通过表述为手感验收。
- 本轮完成登录态浏览器的指针内/外刷新验收；设置保存反馈卡的实际保存交互、浅/深色主题切换、触屏设备行为及真实帧时间仍未测。仓库脚本目录与根命令未发现 `workspace-preflight` 或独立 quality/release Gate，未运行不存在的门禁。

### 按截图补齐浮动按钮（2026-10-03）

- 红框中的“回到底部”按钮在消息列表外；在消息列记录为失焦时，通过已有 `data-pointer-active` 状态给按钮应用同一模糊半径、透明度与 360ms 过渡。按钮悬停或键盘可见焦点时恢复清晰；触屏、减少动态效果及既有按钮操作保持。
- 继续使用 `appearance.advanced.aiWorkOutputFocusBlurEnabled`、`appearance.advanced.aiWorkOutputFocusBlurPercent` 和 `appearance.advanced.reducedMotion`；没有新增设置、CSS 自定义属性或持久化状态。
- `pnpm --filter lfaa-client-ui-chat run build` 通过。`pnpm --filter lfaa-web run build` 在 `render.tsx` 的 DSH JSX 类型和 `SettingsPage.tsx` 图标类型处失败；这些文件有其他未提交改动，本轮未修改。独立 `pnpm exec vite build` 完成 2032 模块转换及 chunk rendering，但构建期间源码变化，`lfaa-build-state` 拒绝登记产物，因此不记为 Web 构建通过。
- 浏览器仍不可连接；浮动按钮的目视、键鼠和触屏实测未完成。

### 续修合同（二）（2026-10-04）

- 用户确认“回到底部”按钮与中间回复区属于同一交互区域；指针从消息内容移到该按钮或消息舞台空白处时，整块中央区域都必须保持清晰。现有指针命中仍以 `.ai-work-chat__message-list` 为界，故按钮虽是消息舞台的子元素，却会使命中状态切为失焦。
- 用户反馈 360ms 过渡仍显得太快；将回复内容与浮动按钮的虚化/显现统一延长至 720ms，使用平滑的缓入缓出曲线。
- 允许修改范围：`packages/client/ui-chat/src/AiWorkChat.tsx`、`packages/client/ui-chat/src/ai-work-chat.css`、本合同及任务索引。不改消息、会话、滚动行为和其他布局，不新增设置或存储值。
- 验收：以整个 `.ai-work-chat__message-stage` 作为指针边界，范围包含消息列表、锚点轨道、滚动区域及“回到底部”按钮；指针在该舞台内移动时状态保持清晰，离开舞台后整块消息内容和按钮共同虚化。焦点、触屏、设置强度及减少动态效果行为保持；指针边界仍不触发 React 重渲染。运行聊天包构建并通过当前 Vite 页面核对 DOM/样式；真实指针连续移入/移出与帧时间如无法由自动化实测则单独标明。

### 续修实施记录（二）（2026-10-04）

- `AiWorkChat.tsx` 将指针边界和 `data-pointer-active` 更新目标从消息列表调整为整个 `.ai-work-chat__message-stage`，所以消息列表、锚点轨道、滚动区域和浮动“回到底部”按钮共同命中。边界变化继续直接更新 DOM 属性并沿用既有持久化，不触发 React state 更新；刷新恢复也以消息舞台为准。
- `ai-work-chat.css` 在虚化开启时让消息列表和浮动按钮共享 `720ms cubic-bezier(0.4, 0, 0.2, 1)` 的滤镜与透明度过渡；基础清晰态和虚化态均保留过渡声明，避免进入时动画缺失。现有键盘焦点、触屏保护、强度和减少动态效果规则保持。
- 设置中心继续使用 `appearance.advanced.aiWorkOutputFocusBlurEnabled`、`appearance.advanced.aiWorkOutputFocusBlurPercent`、`appearance.advanced.reducedMotion`；未新增或修改设置字段、默认值、存储值及 CSS 自定义属性。
- `pnpm --filter lfaa-client-ui-chat run build` 通过，`git diff --check -- docs/PROMPTS.md packages/client/ui-chat/src/AiWorkChat.tsx packages/client/ui-chat/src/ai-work-chat.css` 通过。现有 5173 Vite 页面已热更新加载本次 TSX/CSS；浏览器只读检查确认鼠标停在浮动按钮上时 `buttonHovered=true`、按钮属于消息舞台、`stageHovered=true`、`data-pointer-active=true`，消息和按钮的 `filter` 均为 `none`、透明度均为 `1`，两者计算样式的过渡时长均为 `0.72s`。
- 上述检查核实了按钮悬停时整块回复区保持清晰及 CSS 过渡配置；未实测真实鼠标连续快速移入/移出，也未测量帧时间。未运行自动化测试或 Web 构建；仓库未提供 `workspace-preflight`、quality 或 release Gate。

### 续修合同（三）（2026-10-04）

- 用户反馈点击左侧导航刻度跳转后，鼠标离开中间回复区仍保持清晰，必须再点击页面才虚化。
- 源码路径显示 `ConversationAnchorRail` 的刻度按钮点击会跳转但没有显式区分/释放鼠标点击留下的焦点；回复区 CSS 通过 `:has(:focus-visible)` 为键盘焦点保持清晰，该规则可能覆盖 `data-pointer-active="false"`。需要修复鼠标激活后遗留的焦点态，同时保留键盘可见焦点的可读性。实际 Edge 焦点状态待浏览器验收确认。
- 允许修改范围：`packages/client/ui-chat/src/AiWorkChat.tsx` 与本合同记录；不改变锚点定位、滚动跟随、消息/会话状态、设置、持久化键或全局虚化区域。
- 验收：鼠标点击导航刻度仍正常跳转，焦点不再锁住回复区的清晰态；鼠标移出整个消息舞台后，消息列表和“回到底部”按钮按现有 720ms 过渡虚化，不需额外点击；键盘激活刻度时可见焦点继续保持回复内容清晰。运行聊天包构建并检查 Vite 页面中的 pointer/focus/CSS 状态；浏览器不可复现时如实标明。

### 续修实施记录（三）（2026-10-04）

- `ConversationAnchorRail` 刻度按钮现在按 `click.detail` 区分激活来源：指针点击后显式释放按钮焦点再执行原锚点跳转；键盘激活的 `detail === 0` 保留焦点。这样不会让鼠标点击留下的 `:focus-visible` 状态继续覆盖回复区的失焦虚化，滚动/锚点逻辑不变。
- 设置中心仍使用 `appearance.advanced.aiWorkOutputFocusBlurEnabled`、`appearance.advanced.aiWorkOutputFocusBlurPercent`、`appearance.advanced.reducedMotion`；本轮未改字段、默认值、持久化、CSS 令牌或用户偏好。
- `pnpm --filter lfaa-client-ui-chat run build` 未能进入包构建脚本，pnpm 的自动依赖状态检查在替换 `node_modules/.pnpm/lock.yaml` 时返回 `EPERM`。直接运行该包脚本的底层命令 `node ../../../scripts/build-harness.mjs package`（工作目录 `packages/client/ui-chat`）通过，构建 1 个能力包到根 `dist/packages/`。`git diff --check -- docs/PROMPTS.md packages/client/ui-chat/src/AiWorkChat.tsx` 通过。
- 可用的登录态 IAB 页面在改动前通过刻度点击与指针移出核对时，`focus-visible=false`、`data-pointer-active=false` 且回复已虚化，因此没有复现用户报告的锁焦现象。随后该临时页因 Vite 无法获取 DSH Client Runtime 启动图而失去控制端连接；当前 `127.0.0.1:3000/api/health` 连接被拒绝，5173 页面路由返回 500。Edge 扩展连接也不可用，所以改动后的真实 Edge 点击/移出交互尚未验收；没有重启运行服务。
- 未运行自动化测试、Web 构建或帧时间测量；不能据包构建宣称真实 Edge 手感已通过。
- 复测补充：后续只读探测中 3000 健康接口与 5173 页面均恢复 200，未重启服务。在 Vite 登录态 IAB 页读取到 16 个导航刻度和 30 条消息；鼠标模拟点击第一根刻度后焦点回到 `BODY`、舞台仍为 `data-pointer-active=true`，指针移至舞台外后变为 `false`，且消息列表和“回到底部”按钮均为 `blur(24px)`、透明度 `0`，过渡时长 `0.72s`。刷新后指针在舞台外时仍恢复该虚化状态，无需额外点击。
- 同页以 Enter 键激活刻度后，按钮保持 `:focus-visible`；舞台指针状态仍为外侧，但过渡完成后消息内容为 `filter:none`、透明度 `1`，确认键盘可见焦点仍可读。上述为 Vite/IAB 浏览器交互核验，不等同于 Edge 扩展窗口或物理鼠标逐帧验收；未测帧时间。

### 续修合同（四）（2026-10-04）

- 用户按最新截图明确虚化命中范围：仅红框内的居中回复列保持清晰；指针越过红框，消息内容及其他输出控件按原设置虚化。红框左右边缘与居中输入卡片对齐，纵向从消息舞台顶部覆盖至输入卡片底部；左侧刻度轨道在范围外。
- AI Work 输入文本框始终保持清晰和可编辑；输入卡片中的上下文标签、计数和操作控件继续按红框命中状态虚化，不对输入区整体施加父级滤镜。
- 允许修改范围：`packages/client/ui-chat/src/AiWorkChat.tsx`、`packages/client/ui-chat/src/ai-work-chat.css`、本合同与任务索引。不改消息、会话、锚点定位、滚动或设置字段；因指针边界语义收窄，将短暂指针位置缓存版本从 1 升至 2，避免把旧整舞台命中状态误读成红框内状态。
- 设置继续使用 `appearance.advanced.aiWorkOutputFocusBlurEnabled`、`appearance.advanced.aiWorkOutputFocusBlurPercent`、`appearance.advanced.reducedMotion`；不得写死新的强度或改变用户偏好。
- 验收：以输入卡片实时左右边缘和消息舞台顶部/输入卡片底部构成指针命中矩形；框内清晰，框外按设置渐进虚化；输入文本框在两种状态都无 `filter` 且透明度为 1；鼠标边界变化不触发聊天 React state 更新。运行聊天包构建，并在当前 Vite 页面检查红框内外的消息、按钮、输入文本框与输入卡片其他控件样式；帧时间及真实 Edge 鼠标手感仍单独报告。

### 续修实施记录（四）（2026-10-04）

- `AiWorkChat.tsx` 现在以聊天容器的 `data-pointer-active` 保存输出焦点；指针判断使用消息舞台顶部、输入卡片底部和输入卡片实时左右边缘构成矩形，因此左右壁纸及刻度轨道在框外，整个输入卡片位于框内。高频指针坐标合并为每帧至多一次的边界读取，离开、卸载和 `pagehide` 时取消待处理帧；状态仍直接写 DOM 属性并复用已有会话存储，不触发 React 状态更新。
- 将瞬时指针位置缓存 key 的版本从 1 升至 2，避免旧整舞台范围的 `inside` 被误当成新红框内；只影响指针状态，不影响账户设置与消息数据。
- `ai-work-chat.css` 在框外对消息列表、“回到底部”、输入卡片上下文/计数和操作区应用现有模糊强度与 720ms 过渡；只对卡片子区域设置滤镜，输入文本框与卡片外观不受父级滤镜影响。键盘可见焦点、触屏保护、减少动态效果继续生效。
- 使用既有 `appearance.advanced.aiWorkOutputFocusBlurEnabled`、`appearance.advanced.aiWorkOutputFocusBlurPercent`、`appearance.advanced.reducedMotion`；没有新增控制项、默认值或 CSS 自定义属性，也未改已有用户偏好。
- `node ../../../scripts/build-harness.mjs package`（工作目录 `packages/client/ui-chat`）通过，1 个能力包写入根 `dist/packages/`；`git diff --check -- docs/PROMPTS.md packages/client/ui-chat/src/AiWorkChat.tsx packages/client/ui-chat/src/ai-work-chat.css` 通过。
- 现有 5173 登录态 IAB 页面热更新后以坐标点按验证边界：红框外侧 `rootState=false`，720ms 过渡完成后消息和回到底部为 `blur(24px)`、消息透明度 0，上下文与操作区为 `blur(24px)`；输入框始终 `filter:none`、透明度 1。红框内侧 `rootState=true`，消息、按钮及卡片辅助控件均 `filter:none`、消息透明度 1。3000 健康接口与 5173 页面均返回 200，未重启服务。
- 本次为浏览器坐标点按触发的指针交互核验，不等同于真实物理鼠标连续移入/移出；没有帧时间测量，也未运行 Web 全量构建或自动化测试。聊天包构建覆盖本次 TSX/CSS 编译。

### 续修合同（五）（2026-10-04）

- 用户要求左侧对话刻度轨道和消息区右侧滚动条也参与 AI Work 回复区的显现/虚化状态，与消息内容及“回到底部”按钮保持同步。
- 指针命中矩形仍沿用截图红框定义：输入卡片的实时左右边缘、消息舞台顶部至输入卡片底部；新增视觉目标不扩大命中区域。输入框始终清晰可编辑。
- 刻度轨道和滚动条的可见状态也跟随红框指针状态：指针位于红框（包括输入框）时，消息、刻度轨道和滚动条均清晰可见；离开红框后一起虚化。允许修改 `packages/client/ui-chat/src/ai-work-chat.css`、`packages/client/ui-workspace/src/module-workbench.css` 与本合同、任务索引。不改变鼠标命中计算、消息与滚动行为、设置字段、持久化或输入区。
- 继续使用 `appearance.advanced.aiWorkOutputFocusBlurEnabled`、`appearance.advanced.aiWorkOutputFocusBlurPercent`、`appearance.advanced.reducedMotion`。刻度轨道、消息视口（含其右侧原生滚动条）、回复内容和回到底部按钮共享当前虚化半径、透明度及过渡；输入文本框和输入卡片底色不应用父级滤镜。
- 验收：Vite 页面中在红框内（含输入框）检查消息、刻度和滚动条均清晰可见；移出红框后这些区域按同一设置联动虚化；输入框在两种状态下保持 `filter:none` 和透明度 1。核对设置开关关闭、强度及减少动态效果规则未回退；聊天与工作区包构建及差异检查通过。浏览器截图核对原生滚动条是否确实受父视口滤镜影响；物理鼠标和帧时间单独说明。

### 续修实施记录（五）（2026-10-04）

- `ai-work-chat.css` 将滤镜目标从消息内层列表移到消息滚动视口，使回复内容与右侧滚动条跟随同一焦点状态；左侧刻度轨道复用相同设置半径、透明度和 720ms 过渡。红框内指针状态（包括输入卡片）显式保持刻度轨道可见，键盘焦点和减少动态效果规则保留。
- `module-workbench.css` 让虚化功能开启且红框命中时显示 AI Work 原生滚动条滑块，包括指针位于输入框时；虚化关闭时继续使用原来的滚动条显示条件。没有更改滚动逻辑、命中区域、输入框或用户设置值。
- 使用既有 `appearance.advanced.aiWorkOutputFocusBlurEnabled`、`appearance.advanced.aiWorkOutputFocusBlurPercent`、`appearance.advanced.reducedMotion`，未新增配置和 CSS 自定义属性。
- 在 `packages/client/ui-chat` 与 `packages/client/ui-workspace` 分别执行 `node ../../../scripts/build-harness.mjs package`，各构建 1 个能力包并输出至仓库根 `dist/packages/`；针对 `docs/PROMPTS.md`、AI Work TSX/CSS 与工作区 CSS 的 `git diff --check` 通过。
- 现有 5173 IAB 页面中用坐标点击输入区和红框外区域核验：输入区状态显示消息、刻度轨道与滚动条；红框外状态下输出区域一起虚化/按当前透明度消隐，输入卡片仍清楚。3000 健康接口与带 HTML Accept 头的 5173 页面请求均返回 200，未重启服务。
- 浏览器核验使用坐标点击，不等同于连续物理鼠标移入/移出；未测量帧时间。设置开关/强度/减少动态效果未通过修改偏好做切换验收，相关选择器继续绑定既有外观配置。

### 续修合同（六）（2026-10-04）

- 用户按最新截图要求扩大清晰命中区，避免鼠标在左侧刻度轨道附近时锚点消失。输出区红框为一个矩形：横向从 AI Work 消息舞台左边缘至输入卡片右边缘，纵向覆盖消息舞台本身；下方输入卡片按其自身实时矩形另行纳入。两个区域的并集内消息、刻度和滚动条保持清晰可见，离开并集后按既有设置虚化。
- 输入框和输入卡片底色继续保持清晰；不改变消息、会话、锚点定位与滚动行为，不新增或修改设置字段。
- 允许修改 `packages/client/ui-chat/src/AiWorkChat.tsx` 与本合同、任务索引和实施记录。红框语义变更需把瞬时指针缓存版本由 2 升至 3，防止历史 inside/outside 值套用新边界。
- 继续使用 `appearance.advanced.aiWorkOutputFocusBlurEnabled`、`appearance.advanced.aiWorkOutputFocusBlurPercent`、`appearance.advanced.reducedMotion`。
- 验收：Vite 页面中鼠标处于上方大红框左侧刻度区域、消息区域和下方输入卡片时均维持消息/刻度/滚动条清晰；离开两块红框的并集后同步虚化；包构建及 `git diff --check` 通过。物理鼠标连续过渡和帧时间单独说明。

### 续修实施记录（六）（2026-10-04）

- `AiWorkChat.tsx` 将清晰命中区改为两块矩形的并集：消息舞台左边缘至输入卡片右边缘、覆盖消息舞台高度的上方输出区，以及输入卡片自身矩形。该区域覆盖左侧锚点轨道；边界按实时 DOM 矩形计算，不改消息滚动或锚点位置。
- 指针位置缓存版本从 2 升至 3，避免旧命中区域的临时 inside/outside 状态套用到新区域；设置字段、默认值、持久化与用户偏好不变。
- 继续使用 `appearance.advanced.aiWorkOutputFocusBlurEnabled`、`appearance.advanced.aiWorkOutputFocusBlurPercent`、`appearance.advanced.reducedMotion`，未新增配置。
- `node ../../../scripts/build-harness.mjs package`（工作目录 `packages/client/ui-chat`）构建通过，1 个能力包写入根 `dist/packages/`；`git diff --check -- docs/PROMPTS.md packages/client/ui-chat/src/AiWorkChat.tsx packages/client/ui-chat/src/ai-work-chat.css packages/client/ui-workspace/src/module-workbench.css` 通过。3000 健康接口与 5173 AI Work 页面均返回 200；仓库中未找到 `workspace-preflight` 脚本。
- Vite 5173 登录态页面热更新后，点按左侧刻度能跳转锚点；指针处于刻度轨道及输入框时，消息、刻度、右侧滚动条均显现，输入框保持可编辑；移至红框外后输出区按当前外观设置一起淡出，输入框保持清晰。3000 控制端和 5173 Vite 未重启。
- 这是浏览器坐标点按与截图核验，不等同于连续物理鼠标移动；未测帧时间。设置开关、强度和减少动态效果未切换用户偏好做逐项验收。

### Vite 热更新菜单（2026-10-03）

- 用户要求通过 Vite 查看本次 AI Work 虚化修复，并在 `lfaa.bat` 启动菜单增加数字入口。真实菜单由 `scripts/install-dependencies.ps1` 提供，批处理只转发到该脚本。
- 入口为 `lfaa.bat` → `scripts/project-menu.mjs` → `scripts/install-dependencies.ps1` → `pnpm --filter lfaa-web run dev`。Vite 固定使用 `127.0.0.1:5173`；`apps/web/scripts/wait-for-server.mjs` 等待现有控制端健康，Vite 复用该控制端的 API、Socket.IO 与 DSH 页面注入。
- 允许修改：`scripts/install-dependencies.ps1`、`README.md`、`docs/harness-cli.md` 与本合同。Vite 入口仅启动前端，不重启或停止 3000 控制端及其 Daemon；已由当前工作区 Vite 占用 5173 时核验页面响应后复用，其他占用只报告进程名和 PID，不杀进程或换端口。
- 验收：子菜单数字 4 可启动 Vite，并在就绪后显示 `http://127.0.0.1:5173/apps/minecraft/ai-work`；按 Ctrl+C 只结束 Vite。真实鼠标移入/移出手感与帧时间仍单独标记为浏览器验收。
- 设置中心配置：本入口不新增或改变设置；页面仍读取既有 AI Work 虚化开关、强度与减少动态效果设置。
- 实际验收：从 `lfaa.bat` 选择 `2` → `4` 后，现有 `127.0.0.1:3000/api/health` 返回就绪，Vite 报告 `127.0.0.1:5173` 启动成功；登录态 AI Work 页在 5173 打开，DOM 含当前消息与“回到底部”按钮。未重启 3000 控制端或 Daemon。菜单运行时核对 Node.js `24.16.0`（CLI 清单要求 `>=24.15.0`）与 PATH 中 pnpm `11.17.0`。
- 工作区根 `package.json` 在本任务开始前已是 Electron 应用清单，缺少原工作区的 `engines` 与 `packageManager` 字段；未改写该并发工作。为使本菜单入口可用，Vite 分支按实际 CLI 清单检查 Node.js，并调用当前 PATH pnpm；其他菜单仍沿用原有工作区检查。
- Vite 页面控制台报告 DSH Client Modules 未从当前控制端取得预期 preload，DSH UI Renderer 随后使用本地 React 根回退；AI Work 页面仍可见且从 Vite 源码加载。读取运行态确认消息列和“回到底部”按钮都为 `blur(24px)`、`opacity: 0`，并应用同一 `360ms cubic-bezier(0.22, 1, 0.36, 1)` 过渡。该页面不是完整 DSH Client Runtime 验收。
- PowerShell AST 语法检查与 `git diff --check -- scripts/install-dependencies.ps1 README.md docs/harness-cli.md docs/PROMPTS.md` 通过。没有运行自动化测试或构建；Vite 留在 5173 供用户查看，鼠标实移入/移出手感和帧时间仍未测。
- 用户再次选择 `2` → `4` 时遇到 `Port 5173 is already in use`；确认占用者正是本工作区 Vite（PID 31800），页面路由与控制端 `/api/health` 均返回 HTTP 200。菜单现已核验同工作区 Vite 的进程身份和页面响应后复用，未知占用继续不触碰。首次复测发现 PowerShell 默认 `Accept` 请求头会令 Vite 返回 404；健康探测改用页面对应的 `Accept: text/html` 后，重新运行菜单选择 `2` → `4` 成功显示复用信息。复测前后 Vite PID 仍为 31800、控制端 PID 仍为 12720，浏览器 AI Work 页保持可见，未重启控制端或 Daemon。

## LFAA-UI-SESSION-RESTORE-STARTUP-01

### 用户目标

减少已登录用户刷新应用页面时工作台恢复前的等待，避免重复读取与当前有效会话无关的初始化状态。

### 运行入口、设置与 Owner

- 运行入口：`apps/web` 与共用 Client 桌面 WebView；认证恢复界面由 `packages/client/ui-renderer/src/App.tsx` 管理，认证与初始化状态由 Account API 提供。
- 会话验证 Owner：`/auth/me`；首次安装状态只在 `/auth/me` 明确返回 401 后，通过 `/auth/setup-status` 决定显示登录或首次管理员设置。
- 设置盘点：此路径没有相关设置中心配置；不新增或更改设置字段、默认值、持久化或外观映射。
- 数据边界：不缓存账户身份、会话凭据、账户设置或业务数据到浏览器；服务端会话与授权校验仍为权威。

### 当前合同

- 已登录页面刷新先验证 `/auth/me`；有效会话不请求 `/auth/setup-status`，随后并行读取账户偏好与设置，并复用 Workbench 模块预热请求。
- `/auth/me` 仅明确返回 401 时才读取 `/auth/setup-status`；非 401 的网络或服务端错误仍显示可重试的会话恢复错误，不能误显示登录页或绕过认证。
- 浏览器完整刷新仍会重建当前文档中的 JavaScript/React/Cordis 运行时；本任务移除不必要的恢复等待，不伪称跨刷新保留内存运行时。

### 允许修改

- `packages/client/ui-renderer/src/App.tsx` 与紧邻的纯 session-bootstrap helper：调整会话恢复请求顺序并保持既有 UI 状态转换。
- `apps/cli/tests/client-session-restore.test.mjs`：验证已登录、未登录/首次设置与服务端错误三种分支的请求顺序。
- `docs/PROMPTS.md`：登记本合同与实际验证记录。

### 禁止修改

- 不跳过 `/auth/me`、不提前渲染账户内容、不放宽服务端认证/授权、不在浏览器持久化身份/设置/会话数据。
- 不改变首次管理员设置、密码登录、通行密钥登录、偏好/设置数据格式或应用路由语义。
- 不修改无关未提交文件，不引入新依赖，不部署、发布、上传或提交 Git。

### 验收条件

- 有效会话只调用 `/auth/me` 后读取偏好/设置；不先串行调用 `/auth/setup-status`。
- `/auth/me` 返回 401 时仍读取 `/auth/setup-status`；其他错误不读取该接口并保留重试错误状态。
- 运行本任务定向回归与 `pnpm --filter lfaa-web run build`；构建产物只写入根 `dist/apps/web/`。登录态浏览器耗时实测若不可用，明确报告。

### 实施与验证记录

- 刷新前的认证路径先串行读取公开 `/auth/setup-status`，再检查受保护的 `/auth/me`。现在已登录刷新只检查 `/auth/me`，有效身份确认后仍并行读取偏好/设置并预热 Workbench；首次设置状态只在 `/auth/me` 返回 401 后查询。
- `apps/cli/tests/client-session-restore.test.mjs` 定向回归通过 3/3：覆盖有效会话、401 首次设置分支与 503 错误保留。`pnpm --filter lfaa-web run build` 通过 TypeScript 检查和 Vite production build，产物写入根 `dist/apps/web/`。构建仍有既存的 1.36 MB 未压缩入口分块提示；本次没有调整拆包策略。
- 性能证据：已登录刷新移除一个位于身份验证之前的串行 HTTP 往返；没有登录态浏览器测量可报告，实际节省时长未测。浏览器硬刷新仍须重新创建页面运行时，并校验 HttpOnly 会话及重新对账 Host 实时状态；本次没有缓存凭据、设置或业务数据，也没有新增设置中心配置。
- 本机 `/api/health` 返回 HTTP 200；当前没有可读取的登录态浏览器标签，因此登录态页面刷新耗时、页面闪现和真实请求瀑布未实测。

## LFAA-UI-SETTINGS-REFRESH-PRELOAD-01

### 用户目标

直接刷新 `/settings` 或 `/admin/users` 时，不显示“正在加载/恢复工作台”提示或旋转器；认证与代码在后台完成准备，页面就绪后直接呈现。在其他直接刷新工作台路由时，也尽早准备共享工作台代码。

### 运行入口、设置与 Owner

- 运行入口：`apps/web` 与共用 Client 桌面 WebView；路由与会话恢复由 `packages/client/ui-renderer/src/App.tsx` 管理，共享工作台与设置页模块由 `packages/client/ui-layout/src/Workbench.tsx` 管理。
- 设置盘点：`appearance.theme` 已有 `light | dark | system` 配置，默认 `system`；账户设置 API 仍是权威值。只允许把这一枚主题模式写入当前标签页的 `sessionStorage` 作为首帧外观提示；它不是设置持久化 Owner，服务端读取后立即校正；不新增/修改设置字段、默认值、校验或账户设置持久化。
- 数据与权限 Owner：`/auth/me`、账户偏好/设置 API 与设置分类 API 保持原 Owner。提前加载只允许下载和解析前端模块；不得挂载设置页、读取账户分类数据或提前展示账户内容。主题提示只存枚举值，不含身份、凭据、其他账户设置或业务数据；存储不可用/值无效时安全退回默认画布。

### 当前合同

- 对 `/settings` 与 `/admin/users` 直达刷新，App 在会话校验期间启动 Workbench 模块加载；Workbench 模块就绪后复用现有单一 Promise 启动 SettingsPage 模块加载。认证及偏好/设置恢复与这段代码加载并行，认证状态未确认前不渲染账户页面。
- 刷新期间的初始化与懒加载回退使用无文案、无旋转器的空画布；控制端错误、认证错误和用户主动进入设置分类后的真实数据读取状态仍按各自 Owner 展示。
- `/tasks`、`/files` 与受支持的 `/apps/<app>/<mode>` 直达路由继续尽早预热共享 Workbench 模块；应用内设置页模块仍由现有空闲、悬停和键盘焦点入口按需预热。
- 预热失败不得形成未处理拒绝；懒加载仍可重试。模块预热不得重复创建模块请求、挂载 SettingsPage 或调用设置分类数据 API。
- 硬刷新会重建当前文档的 JavaScript/React 运行时；本合同优化首屏代码加载重叠和用户可见阶段，不声称复用跨刷新内存或免除认证、设置与 Host 状态核验。
- Web HTML 在 CSS/React 启动前读取标签页主题提示，同步设置文档的浅/深色底色；WorkBench 以账户 API 返回的 `appearance.theme` 和当前系统主题复核后覆盖提示并更新该标签页存储。

### 允许修改

- `packages/client/ui-renderer/src/App.tsx`：为直达工作台路由启动并等待已登记的代码预热，同时保留现有认证与设置恢复顺序。
- `packages/client/ui-renderer/src/workbench-preload.ts`：提供可单测的路由分类及失败收敛预热流程。
- `packages/client/ui-layout/src/Workbench.tsx`：导出复用现有设置页加载 Promise 的预热入口，并按当前 `appearance.theme` 更新页面主题提示。
- `packages/client/ui-theme/src/appearance-theme-bootstrap.ts`：安全读取/写入单一主题模式提示并解析 system 模式。
- `apps/web/index.html`：在首个文档绘制前应用合法主题提示的画布底色。
- `apps/cli/tests/client-workbench-preload.test.mjs`：覆盖设置路由的两级预热、其他工作区路由及非工作区路由。
- `apps/cli/tests/client-appearance-theme-bootstrap.test.mjs`：覆盖主题枚举、system 解析和存储失败回退。
- `docs/PROMPTS.md`：维护本合同和实际验证记录。

### 禁止修改

- 不跳过 `/auth/me`，不提前挂载账户内容；主题提示不得代替服务端设置或存入身份、会话凭据、其他账户设置和业务数据；不改 API、授权、路由语义或设置分类读取时机。
- 不改变设置项、默认值、持久化、服务端校验、主题映射和页面布局；不引入依赖，不修改无关未提交工作。
- 不部署、发布、上传或提交 Git。

### 验收条件

- 定向回归证明 `/settings` 与 `/admin/users` 先共用 Workbench 加载，再调用其设置页预热；失败不会抛出未处理拒绝；`/tasks`、`/files` 和受支持 App 路由预热 Workbench；登录页/应用中心路由不因该 helper 下载模块。
- 页面初始化与 Workbench/SettingsPage 懒加载回退不显示工作台加载文案、旋转器或替代进度提示；认证/控制端错误仍可见。
- 深色/浅色/System 提示在文档绘制前读取；System 按当前系统外观解析；Workbench 加载服务端设置后同步校正。无效值和禁止存储环境均安全回退。
- 认证成功所需的账户 API 与模块预热并行；模块预热不触发设置分类数据 API，页面仍只在认证成功后挂载。
- 运行定向回归与 `pnpm --filter lfaa-web run build`，确认产物仅写入根 `dist/apps/web/`。若登录态浏览器不可用，明确报告没有测得真实刷新耗时、网络瀑布与首屏闪动。

### 实施与验证记录

- `App.tsx` 在受保护的设置、文件、任务和应用工作区路由进入认证恢复时启动共享 Workbench 模块；有效会话确认后，继续把 Workbench（以及设置路由所需的 SettingsPage）预热与偏好/账户设置 API 并行等待。认证页仍不会挂载账户页面。
- `Workbench.tsx` 暴露设置模块预热入口，SettingsPage 懒加载、空闲预热、悬停/键盘预热与直达路由预热共用同一个 Promise。失败会清理模块缓存，预热拒绝被收敛，懒加载仍可重试。
- 刷新会话初始化、Workbench 根 Suspense 与直达设置页 Suspense 均改为静默空画布（保留页面默认画布底色和 `aria-busy`，不显示文案或旋转器）；控制端/认证错误和分类真实数据读取状态仍保留。
- HTML 首帧脚本只从当前标签页 `sessionStorage` 读取 `light | dark | system` 主题模式，深色提示在认证/设置请求前同步设定文档与地址栏主题色。Workbench 的 `useLayoutEffect` 按账户 API 的 `appearance.theme` 和当前系统明暗立即校正并刷新提示；登出、会话失效或认证恢复确认匿名时清除提示。Server API 仍是唯一权威，不持久化其他账户字段。
- `apps/cli/tests/client-workbench-preload.test.mjs` 与 `apps/cli/tests/client-appearance-theme-bootstrap.test.mjs` 共通过 8/8，覆盖路由预热、主题枚举、system 解析、应用/清除和存储异常。`pnpm --filter lfaa-web run build` 通过 TypeScript 检查和 Vite 构建，产物位于根 `dist/apps/web/`；SettingsPage 仍为独立动态分块。Vite 提示现有入口分块约 1.36 MB（gzip 约 390 KB），本任务未调整拆包。
- 设置模块代码导入不挂载 `SettingsPage`；账户分类读取仍由设置页面挂载后的既有 Owner 触发。未新增设置字段、默认值、服务端校验、账户持久化或外观映射；浏览器仅有每标签页的单一主题模式提示。
- 结构上的等待链由“认证/账户读取结束后再依次加载 Workbench 与 SettingsPage”改为“路由模块预热与认证并行，并与账户读取共同等待”；启动期的工作台/设置页加载提示已静默。没有登录态浏览器标签，因此实际刷新耗时、请求瀑布、首屏闪动与帧时间未实测；完整硬刷新仍会重建当前页面的 JS/React 运行时，不能跨刷新复用内存。仓库没有 `scripts/workspace-preflight.mjs`，也未发现可运行的 quality/release gate。

## LFAA-UI-AI-WORK-REFRESH-STABILITY-01

### 用户目标与当前证据

- 用户在刷新 `/apps/minecraft/ai-work` 时观察到“回到底部”按钮、输入框提示和模型选择器抖动/闪烁。
- 当前浏览器复测显示：工作区节点首次挂载后输入框先显示“正在读取活动 Provider…”，模型按钮先显示“模型未配置”；约 250ms 后账户读取完成，提示和模型名同时替换，原先未显示的“回到底部”按钮也在消息恢复后的跟踪帧中挂载。三个控件的外框坐标与尺寸保持不变，主要变化来自首次绘制后的状态替换和延后挂载。

### 运行入口、设置与 Owner

- 运行入口：`apps/web` 的 `/apps/minecraft/ai-work` 与共享 Client WebView；AI Work 消息、Provider 展示状态和刷新恢复由 `packages/client/ui-chat/src/AiWorkChat.tsx` 负责，共享滚动位置由 `packages/client/store/src/scroll-restoration.ts` 恢复。
- 设置盘点：沿用 `appearance.advanced.reducedMotion` 控制程序化平滑滚动；主题、颜色、字体字号、壁纸和模糊继续从工作台已有令牌读取。不新增或改变设置控件、默认值、校验、持久化和映射。
- 数据与权限 Owner：活动 Provider 与模型仍由账户 AI API 返回；会话和消息仍属于当前用户、App 与会话。浏览器不得缓存 Provider 账户、消息正文、凭据或设置来冒充当前服务端状态；认证、授权和 AI 请求不变。

### 当前合同

- 消息滚动位置恢复完成时，在首次浏览器绘制前同步计算“回到底部”按钮状态，避免恢复位置后由异步锚点观察帧再插入按钮。
- Provider 读取期间输入框继续使用稳定的自然语言占位提示；未配置/读取失败的既有真实提醒仍由错误或配置状态展示。
- 模型按钮读取期间不显示虚假的“未配置”状态；为模型名保留稳定的控制宽度，账户数据返回后再显示真实模型，避免相邻控件横移。
- 页面滚动、跟随最新、手动跳转、消息恢复、模型选择和减少动态效果语义保持；不新增轮询、动画、存储或请求。

### 允许与禁止修改

- 允许修改 `packages/client/ui-chat/src/AiWorkChat.tsx`、`packages/client/ui-chat/src/ai-work-chat.css`、`packages/client/ui-chat/src/conversation-scroll.ts`、`apps/cli/tests/client-performance.test.mjs` 和本合同的完成记录。
- 不改 API、服务端、数据库、会话/消息/Provider Owner、设置中心、工作台布局、权限、模型请求、CSS 自定义属性或依赖；保留其他未提交改动，不部署、发布、上传或提交 Git。

### 验收条件

- 定向回归覆盖刷新恢复时滚动按钮状态的判定；登录态页面在消息恢复后首个布局绘制中同步确定按钮状态，滚动跟踪器不得在消息未就绪时覆盖它。
- `pnpm --filter @yubboo/lfaa run test -- tests/client-performance.test.mjs` 和 `pnpm --filter lfaa-web run build` 通过，构建产物位于根 `dist/apps/web/`。
- 在当前登录态源码预览刷新 AI Work，核对输入框提示、模型选择器几何尺寸，以及滚动按钮随消息恢复只切换一次并保持正确；明确区分源码预览与当前运行服务验收。

### 实施与验证记录

- `AiWorkChat.tsx` 将滚动跟踪器延后到消息恢复就绪后创建，并在切换会话时清除旧会话的滚动初始化标记。先由共享滚动恢复钩子还原位置，再由布局 effect 同步决定跟随状态和“回到底部”按钮，避免空消息布局的异步观察结果覆盖恢复位置。
- 输入框在 Provider 读取期间保持“向 LFAA AI 提问…”；模型读取期间使用“模型”过渡标签，并为选择器保留 134px 稳定宽度，数据返回后显示真实模型。没有新增请求或持久化。
- `client-performance.test.mjs` 定向回归通过 16/16；`pnpm --filter lfaa-web run build` 的 TypeScript 检查与 Vite 构建通过，输出在根 `dist/apps/web/`。构建仍报告已有约 1.36 MB 主入口 chunk 警告。
- 登录态 Vite 源码预览刷新采样：输入提示从首次出现起稳定为“向 LFAA AI 提问…”；模型按钮先显示“模型”，约 109ms 后更新为 `deepseek-flash`，按钮始终宽 134px、横坐标 954.2px；消息恢复前滚动区高度等于视口且按钮不显示，消息到达后滚动区高度为 11235px、`scrollTop=0`，“回到底部”按钮出现并保持，没有重复闪现或布局横移。此采样是源码预览实测，不是逐帧分析。
- 没有重启 `127.0.0.1:3000` 的当前运行服务：只读检查确认它仍返回旧入口 `assets/index-BklkTM2Z.js`，本次构建入口为 `assets/index-DNVQMxSN.js`。该启动器托管本地 Daemon，而 Daemon 当前有运行中的 Minecraft 实例，关闭服务会停止实例；因此当前运行服务的新构建加载与真实刷新仍待实例可安全停止后核验，浏览器源码预览确认的是本次源码行为。

## LFAA-UI-AI-MODEL-CARD-01

### 用户目标

优化 AI Work 底部模型选择器：点击后显示清晰、易操作的模型浮卡，并让模型对应的真实思考参数可配置。参数必须随当前 Provider 返回的具体模型能力变化，与设置中心保存和运行时使用的 AI 账户配置完全一致；不得把其他模型的能力、统一档位或“无/关闭”伪装为思考强度。

### 运行入口、设置与 Owner

- 运行入口：`apps/web` 的 Minecraft、SteamCMD、Writing AI Work，以及复用同一客户端包的桌面 WebView；入口组件为 `packages/client/ui-chat/src/AiWorkChat.tsx`。
- 设置盘点：AI 账户现有 `ai_accounts.model_id`、`models_json`、`reasoning_mode` 分别保存模型、Provider 模型目录及思考参数；控制端设置服务是元数据、校验与持久化 Owner。`UserSettings.aiRuntime.speed` 是现有快速/平衡/深入输出长度策略，不是模型思考能力，本任务不改其含义。界面继续读取 `appearance` 的主题、强调色、字体/字号、背景、遮罩/模糊和减少动态效果设置，不增加设置项或改变默认值。
- 数据与权限 Owner：模型目录及能力由已配置 Provider 模型查询结果进入 `lfaa-settings`；账户思考参数由设置 API 校验和保存，Agent Runtime 只发送该模型能力明确允许的参数。浏览器只读模型公开元数据和账户状态，不接触 Provider 密钥。
- 文档检查：仓库没有 `docs/DEVELOPMENT.md`、`docs/PROJECT_PLAN.md`，本次遵循根目录 `开发规范.md`、`docs/系统总体架构.md` 与现行 `docs/开发计划.md`；原来没有 client/settings group README，本合同增加对应职责说明。

### 当前合同

- 模型卡片展示真实账户及 Provider 模型目录中的模型；模型切换后立即按返回账户的当前模型能力更新可用思考参数，并经现有 API 保存。
- 思考参数选项只来自当前模型目录明确返回的 Provider 能力元数据（目前解析 `effort.supported_levels` 与 `default_level`）；不得按品牌或模型名称猜测、给所有模型套同一档位，或在能力未知时虚构选项。没有可验证的模型专属控制时，不显示思考档位滑块，并说明请求不发送思考参数。
- “无/关闭”不能作为最低思考强度或伪造出的档位；只展示当前模型实际支持的思考力度。若 Provider 只提供真实的开关而没有强度档位，应明确标示为开关能力，不映射为强度。
- 设置中心和 AI Work 共用同一思考选项生成逻辑及同一 `ai_accounts.reasoning_mode` 保存字段；`default` 表示省略请求思考字段并遵循 Provider 默认，不等于无或关闭。发送时控制端再次校验，Runtime 不向 Provider 发送未被模型目录确认的值。旧目录中来源不明的能力元数据不得继续冒充官方能力。
- 浮卡遵循 `.workbench-shell` 的主题令牌与外观设置；点击操作清楚、键盘可达、窄工作区可用。无额外轮询、重复订阅或每帧测量；关闭或切换时正确结束弹层生命周期。

### 允许修改

- `packages/settings/settings/src/service.ts`：仅解析、标记、校验 Provider 模型目录实际提供的思考元数据，并让模型切换/账户保存使用当前模型能力。
- `packages/settings/settings/src/model-capabilities.ts`：Provider 模型思考能力的纯解析与校验函数。
- `packages/core/agent-loop/src/runtime.ts`：仅将已确认且当前账户选中的模型思考参数应用到真实 Provider 请求。
- `packages/client/connection/src/api.ts`：同步已有账户模型能力数据类型。
- `packages/client/ui-settings-models/src/model-options.ts`：维护设置页与 AI Work 共用的模型能力标签及可选项。
- `packages/client/ui-chat/src/AiWorkChat.tsx`、`packages/client/ui-chat/src/ai-work-chat.css`、`packages/client/ui-chat/package.json`、`pnpm-lock.yaml`：实现模型浮卡、选择和现有账户 API 持久化，声明共享选项包依赖。
- `packages/client/ui-settings/src/SettingsPage.tsx`：只在确保设置中心展示与 AI Work 相同的有效模型能力选择时修改。
- `apps/cli/tests/ai-model-thinking-controls.test.mjs`、`docs/PROMPTS.md`、`docs/系统总体架构.md`、`packages/client/README.md`、`packages/settings/README.md` 同步能力回归、Owner 事实及 client/settings group 职责。

### 禁止修改

- 不改 AI Runtime 的快速/平衡/深入含义、聊天上下文、Agent/Provider 执行协议、身份权限、密钥处理或设置中心布局。
- 不新增模型、虚构供应商能力、固定全厂商档位、回退到名称推测、擅自覆盖用户已保存的有效能力选择，或新增独立于设置中心的思考强度存储。
- 不新增依赖、CSS 自定义属性、遥测或无关动效；不部署、发布、上传或提交 Git。

### 验收条件

- 定向回归覆盖模型目录能力的可信来源、未知/旧来源能力不显示、不发送；模型切换后可用参数更新；非法参数被服务端拒绝；Runtime 仅按当前模型实际能力发送已选参数。
- 设置中心和 AI Work 对同一模型生成完全相同的有效选择项，并经同一账户字段保存；没有已确认强度档位时不展示统一的思考强度控件。
- `pnpm --filter lfaa-client-ui-chat run build`、相关 Settings/Agent/Server 包构建、直接相关回归与 `pnpm --filter lfaa-web run build` 通过；所有构建产物仅写入根 `dist/`。
- 静态检查确认主题令牌、缩放布局、键盘可达及无重复请求/订阅；有可用的登录态浏览器时走查桌面和窄工作区。未实测的浏览器、Provider、设置持久化或帧时间必须明确列出。

### 实施与验证记录

- `AiWorkChat.tsx` 将原模型下拉改为主题适配的点击浮卡，提供目录内模型搜索/选择、真实模型名与上下文/输出上限、模型思考力度刻度和恢复 Provider 默认；模型切换后保留目标模型仍支持的已选力度，否则回到 Provider 默认。目录超过 60 个时只渲染 60 条匹配结果，筛选在本地进行；滑块拖动只做本地预览，释放或键盘改档后才向现有账户 API 保存。
- 设置中心和浮卡共用 `ui-settings-models` 的同一选项列表与 `ai_accounts.reasoning_mode`。模型目录支持档位来自控制端实际收到的 `effort.supported_levels` / `default_level`；`none`、`off`、`disabled` 不进入可选档位。`default` 代表不发送思考参数并由 Provider 按其默认值处理；当目录没有可验证的思考能力时不显示滑块，Runtime 不加思考字段。切换模型沿用现有真实目录重查与模型连通测试流程。
- 原 `aiRuntime.speed` 已从容易误解的“推理档位”独立菜单移入卡片，明确标为“输出长度策略”，仍写入原设置字段，只调整 LFAA 输出长度限制。浮卡继承 `.workbench-shell` 的外观令牌；未新增设置项或 CSS 自定义属性。
- 官方来源核对：DeepSeek 当前 `/models` schema 明确返回模型级 `effort.supported_levels` 和可选 `default_level`，说明列表按推荐顺序展示且不包含用于关闭思考的 `none`；实现仅消费 Provider 目录元数据，不按模型名映射其他厂商档位。[DeepSeek Lists Models](https://api-docs.deepseek.com/api/list-models/)。其他 Provider 的真实目录响应未逐账户验证，目录未返回相同可验证能力时保持无力度控件。
- `pnpm --filter @yubboo/lfaa run test -- tests/ai-model-thinking-controls.test.mjs` 通过 5/5，覆盖动态档位/默认来源、停用值过滤、来源不明能力、账户持久化、切换保留有效档位、拒绝非法值及 Runtime 请求字段；使用隔离临时数据库和合成 Provider 响应，没有调用真实 Provider。
- `lfaa-settings`、`lfaa-agent-loop`、`lfaa-client-ui-settings-models`、`lfaa-client-ui-chat`、`lfaa-client-ui-settings` 包构建通过；控制端 `dist/apps/control-plane/` 构建通过；`pnpm --filter lfaa-web run build` 的 TypeScript/Vite 构建通过，产物位于 `dist/apps/web/`，仍有仓库既有的 500 KB chunk 提示。构建和定向回归没有验证帧时间。
- `git diff --check` 通过；仓库中未找到 `workspace-preflight` 脚本入口。Edge CUA 会话返回 `nodeRepl.fetch request failed`，没有登录态浏览器可供操作；当前改动的桌面/窄工作区视觉与实际 Provider 切换仍待交互验收。没有重启当前运行服务。

## LFAA-REPO-AI-GUIDES-01

### 用户目标

- 参考 `H:\deepwrite` 与其公开 GitHub 仓库的 `.github`、`.agents`、`.claude`、`.codex` 组织方式，以及 Git 提交、桌面测试打包和补丁发布技能，为 LFAA 建立自己的 AI 助手入口和可复用指导，并整理根目录中的文档位置。
- 只参考目录组织和流程拆分思路；LFAA 根 `AGENTS.md`、`开发规范.md`、`docs/系统总体架构.md` 与当前架构和安全边界是唯一约束，不复制 DeepWrite 的规则、产品假设、平台流程或代码。

### 运行入口、Owner 与设置

- 本任务是仓库协作文档、GitHub 模板和 AI 流程技能，不实际执行 Git 提交、桌面打包或版本发布，也不改 Web、控制端、Daemon、桌面或 LFAA Harness 的产品运行入口。
- `.agents/skills/` 是仓库 AI 技能的唯一正文来源；当前 LFAA 项目文件工具会发现项目 `.agents/skills`，因此其中内容必须是适用于本仓库代码维护的只读流程说明，不能藏入脚本、凭据、产品权限或虚构能力。
- `.claude/skills/` 与 `.codex/skills/` 仅保留指向同一规范正文的轻量入口，不能维护独立副本或互相冲突的规则。
- 不涉及设置中心配置、运行数据、身份或业务 Owner；沿用根 `AGENTS.md`、`开发规范.md`、`docs/系统总体架构.md` 与本文件作为约束来源。

### 允许修改

- 本合同与任务索引、根 `README.md`、`docs/系统总体架构.md`。
- 新增 `.agents/README.md` 与本仓库开发、Owner 导航、验证交付、Git 提交、桌面测试打包、补丁发布六类纯文本技能；新增 `.claude/README.md`、`.codex/README.md` 与对应的轻量技能入口。
- 新增 `.github/ISSUE_TEMPLATE/` 问题/功能表单和 Pull Request 模板；不新增会启动 CI、部署或发布的工作流。
- 将根 `design-qa.md` 原样移至 `docs/quality/design-qa.md`，并修正 README 与目录结构文档中的现行入口。

### 禁止修改

- 不改应用或包源码、用户设置/数据、权限与授权实现、构建脚本、依赖、锁文件或正在运行的服务。
- 不覆盖或回退当前工作树中的并行修改；不复制 DeepWrite 文件正文，不把本仓库项目指南冒充为系统级授权。
- 不提交、推送、发布、部署，不增加自动测试或 CI 工作流；不把文档静态检查表述成运行时验收。

### 验收条件

- 四个目录各有与 LFAA 当前仓库职责匹配的内容；根 `AGENTS.md` 和现行开发/架构规范仍是权威来源。
- 各 AI 工具入口指向 `.agents/skills/` 下唯一正文；六个技能覆盖代码变更合同、Owner/包职责定位、验证与交付、Git 提交、当前桌面打包测试及补丁/正式发布，并清楚限定为 LFAA 仓库维护流程。
- Git 提交技能只在用户明确要求提交时适用，保护其他暂存和工作树内容；打包发布技能以当前 LFAA 入口和根 `dist/` 规则为准，不复制 DeepWrite 的身份、版本、产物路径、更新清单或平台假设；macOS 流程未建立时必须明确停止并报告。
- GitHub 模板使用 LFAA 的真实验收字段；没有加入未经验证的 CI 命令或外部动作。
- 根目录不再放置历史视觉 QA 文档；原文保留，README 和架构目录树可找到新路径。
- 执行 `git diff --check`、模板/链接及文件清单核对，并检查 `workspace-preflight` 与适用 quality/release Gate 是否存在；缺少入口必须报告，不能伪称通过。产品构建、浏览器和运行时验收不属于本次文档改动。

### 实施与验证记录

- 新增 `.github/` 问题表单与 PR 模板；新增 `.agents/skills/` 六份纯文本维护技能，并让 `.claude/skills/`、`.codex/skills/` 的同名入口读取唯一正文。Git、打包与发布技能分别以 LFAA 当前提交边界、Windows x64 Tauri 正式入口及 `docs/updata-log.md` / 根 `dist/` 规则为准；不增加产品执行能力、CI 工作流或外部发布行为。
- 打包脚本审查发现 `apps/desktop-tauri/scripts/package-windows.mjs` 的预期安装包路径仍硬编码 `0.1.1`。本轮按合同不改构建脚本；新技能要求后续正式版本在脚本路径与当前元数据不一致时先停止并修复，再执行打包。
- 根 `design-qa.md` 已移至 `docs/quality/design-qa.md`；`git hash-object` 与原 `HEAD:design-qa.md` Blob 摘要一致，确认文件内容未改变。README 和总体架构目录树已指向新路径及新增 AI/GitHub 目录。
- Claude/Codex 六个技能入口到 canonical `.agents` 正文的路径和名称、全部 SKILL frontmatter 与新增文件尾随空白扫描通过；`skill-creator` 的 `quick_validate.py` 对三份新正文校验通过，`git diff --check` 通过。当前 README/架构中没有遗留根级 QA 文档引用；新增文件未被忽略。
- GitHub Issue YAML 使用当前 Python 环境中的 PyYAML 解析通过。`scripts/workspace-preflight.mjs` 不存在，根 `package.json` 未登记 workspace-preflight、quality 或 release Gate。未运行产品测试/构建、浏览器、Provider、Daemon 或设备验收；这些不属于本次纯文档/模板任务。
- 设置中心配置：不涉及。未重启服务，未提交或推送。

## LFAA-AI-INSTRUCTION-CONSISTENCY-01

### 用户目标

- 审查整个项目中 AI 可见的规范、技能、运行时 System Prompt、任务状态和 README 能力说明；发现与当前登记能力冲突的旧说明时直接修正。
- 以根 `AGENTS.md`、`开发规范.md`、`docs/系统总体架构.md`、当前工具登记/实现和任务合同为权威；保留权限、安全与能力 Owner，不把规范目标误写成已实现能力，也不把已实现能力误写为未接入。

### 运行入口、Owner 与设置

- 本任务只调整仓库 AI 协作规则、项目状态说明和 Minecraft AI 领域提示词；不改变 Agent Loop、Minecraft 工具/API、Daemon、权限校验或设置中心，也不读取或迁移真实用户数据。
- Minecraft 能力事实由 `packages/games/minecraft` 业务服务/实时工具目录和目标 Daemon 能力决定；领域提示词只能据实引导，不自行维护过期核心白名单。
- 子 Agent 当前实现与待办以 `docs/系统总体架构.md`、`docs/harness-agent-delivery.md`、`docs/开发计划.md` 和相应实现为准；带历史日期的合同保留当时结论，但不得代表当前能力状态。
- 设置中心配置：不涉及。

### 允许修改

- 根 `AGENTS.md` 中大模型驱动规则的目标约束、能力现状边界和当前 checkout 路径适用规则说明。
- `README.md` 中 AI/Minecraft 能力摘要、数据库迁移版本和工作副本数据路径描述。
- `docs/开发计划.md` 中子 Agent 当前能力与后续待办的概述；`docs/PROMPTS.md` 本任务索引、文档时效说明、历史合同状态注释和实施记录；`docs/harness-cleanup.md` 的历史快照标注；`.agents/skills/lfaa-code-change/SKILL.md` 的任务合同选取规则；`docs/workspace-audit.md` 中历史运行数据观察的时点与适用范围；`docs/workspace-audit-cleanup.json` 的目标 checkout 和授权适用范围。
- `docs/harness-storage.md` 中 SQLite v31 作为当时迁移步骤而非当前数据库最高版本的说明。
- `packages/games/minecraft/src/minecraft-prompt-library.ts` 中通用 Minecraft Controller、生命周期及未支持生态路由提示词。

### 禁止修改

- 不改工具/API/Daemon 执行逻辑、权限与 EULA 校验、数据库/设置、用户数据、构建配置或并行工作树内容；不直接访问或清理历史清单中的旧绝对路径，不把历史清理授权视为当前授权。
- 不把 17 个静态核心名表述为每个节点、版本、功能都可执行；运行时以实际工具目录、服务校验与节点能力为准。
- 不删除历史任务证据，不把当前顺序子 Agent 扩写成并行调度或外部 Agent 交接，不把全权限描述成越过当前用户目标或业务校验。

### 验收条件

- 通用 AI 规则区分“模型驱动已接入能力”的硬性架构原则与“产品当前已接入能力”的现状清单。
- 当前 README、开发计划、System Prompt 与架构一致：Minecraft 通用管理先查实时目录/工具/节点；只在 Vanilla 专项提示词中限定 Vanilla；不否认已登记的多核心或顺序可执行子 Agent。
- 历史合同继续保留原结论并明确时间/后续状态来源；最新版本和运行数据路径不指向旧数据库版本或其他工作副本的绝对路径。全仓审计中的 `H:/LFAA/data` 与 `user_version=35` 明确标为当时只读观察，不冒充当前选中数据目录或当前 schema；不读取真实数据确认。用户确认 `H:/LFAA` 与 `H:/LFAA1` 是同一项目改名前后的根目录名；旧绝对路径映射到当前 checkout 后仍须逐项核实，历史清理授权不能代替当前授权。
- `git diff --check`、差异/路径静态审查和 Minecraft 包构建脚本通过；优先使用 `pnpm --filter lfaa-games-minecraft run build`。若 pnpm 的依赖状态检查因需要清理模块目录而在无 TTY 下中止，不得用 `CI=true` 或自动确认绕过；可从包目录直接运行脚本实际调用的 `node ../../../scripts/build-harness.mjs package` 并记录差异。不运行服务、不做真实游戏/Provider/Daemon 任务验收。

### 实施与验证记录

- 修正根 `AGENTS.md`，明确大模型驱动规则是实施约束而非能力清单，并指向当前架构、开发计划、工具和节点实时回报。
- 更新 README 的 AI/Minecraft 能力范围，说明当前顺序可执行子 Agent、在线 Daemon Shell、动态多核心能力、Native/AppContainer 边界；去除数据库版本 31 与其他工作副本的固定绝对数据路径，改为迁移版本 38 和运行时配置确认规则。
- 更新 `docs/开发计划.md` 子 Agent 状态；给 `docs/PROMPTS.md` 增加历史合同时效规则并标记旧 Harness 清理记录；明确 `docs/harness-cleanup.md` 是 2026-09-30 快照。
- 修正 Minecraft 通用 System Prompt：不再以旧 Vanilla-only 静态白名单拒绝当前多核心能力；通用生命周期和未支持生态分流改为检查当前工具、目录、领域服务和 Daemon 能力。Vanilla 专项部署模板仍只约束官方 Vanilla。
- 修正总任务索引中仍标为“待实施”的 Agent 协作状态，改为“进行中”并列出已交付的顺序子 Agent 与真实剩余项；将旧 Harness 清理合同里的待办进一步标为任务完成时的历史状态。为全仓审计快照增加时点提示，明确 `H:/LFAA/data`、`user_version=35` 是 2026-10-01 的只读观察，不代表当前数据路径或 schema。
- 隔离历史清理清单：其 59 个目标绝对路径记录于项目改名前的 `H:/LFAA`。用户确认它与当前 `H:/LFAA1` 是同一项目；路径应映射并逐项复核，不能直接执行旧绝对路径，也不能继承清单中的历史清理授权。本轮没有访问、删除或核验那些目标。
- 在根 `AGENTS.md` 与代码变更 Skill 中加入历史绝对路径规则：先映射至已确认的当前 checkout；用户确认的目录改名不视为另一项目，但真实的其他工作副本不因历史链接而被访问，历史授权也不继承。
- 设置中心配置：不涉及。未修改权限/业务执行 Owner，未重启服务，未提交或推送。
- 验证：`git diff --check` 通过；负向搜索确认 README/当前开发计划/架构/通用 Minecraft Prompt 不再包含“一次只读子 Agent”“Paper 未接入”“任意 Shell 未接入”“数据库版本 31”或 `H:/LFAA/data` 等旧当前态声明。`pnpm --filter lfaa-games-minecraft run build` 因 pnpm 依赖状态检查尝试清理模块目录、无 TTY 而中止；未设置 `CI=true`、未自动确认。随后从 `packages/games/minecraft` 运行其包脚本实际调用的 `node ../../../scripts/build-harness.mjs package`，成功并输出至根 `dist/packages/`。这验证了包构建器的转译/输出，不是 TypeScript 类型检查或真实 Minecraft/Provider/Daemon 验收；未运行服务或游戏任务。

## LFAA-CLI-WEB-LOCK-RECOVERY-01

### 用户目标

- 从 Windows 工作台启动 Web 时，若当前数据目录的配置写锁仍由 LFAA Web CLI 进程持有，先结束该持锁进程，再按原正式入口启动一次 Web。
- 锁已陈旧时交由 `FileLease` 的现有事务回收；持锁 PID 无法确认为 LFAA Web CLI、进程身份变化或无法停止时，停止启动并说明原因。

### 运行入口、Owner 与设置

- 运行入口：`lfaa.bat` → `scripts/project-menu.mjs` → `scripts/install-dependencies.ps1` → `pnpm lfaa web`。
- 配置写锁归 `packages/storage/storage-json` 的 `FileLease` 与 `packages/storage/storage-domain` 所有，位置为当前 `LFAA_DATA_DIR/storages/.configuration.lock`；存活 PID 的终止只由 Windows 工作台在启动 Web 前协调，陈旧锁仍由原存储 Owner 在数据库事务内回收。
- 数据目录必须复用 `packages/util/home-paths` 现有解析和 `.env`/外部环境优先级。设置中心配置：不涉及。

### 允许修改

- `scripts/install-dependencies.ps1` 的 Web 启动预检；`docs/harness-cli.md` 对应的工作台行为说明；本合同及任务索引。
- 只停止锁中 PID 经 Windows 进程信息确认仍为 LFAA Web CLI 的进程本身，不结束其整个进程树，不删除或改写锁文件。

### 禁止修改

- 不更改 `FileLease` 的锁协议、数据目录配置、数据库事务、Web/Daemon 运行能力或其他菜单命令。
- 不按端口号杀进程，不结束无法确认为 LFAA Web CLI 的进程，不清理用户数据，不重启当前运行中的服务以作验收。

### 验收条件

- 启动前按真实 `.env`、外部环境变量与现有数据目录解析规则定位 `.configuration.lock`。
- 存活且身份匹配的 Web CLI PID 只被停止一次；确认进程退出后只执行一次原 `pnpm lfaa web` 命令。
- 不存在锁、锁 PID 已退出、锁格式损坏、PID 被复用/身份不符、终止失败等情况均不得误杀或主动删除锁；陈旧锁交由原存储逻辑处理。
- PowerShell 语法与差异空白检查通过。不得为验证终止逻辑而停止当前真实服务；本轮不宣称完成真实 Web 重启验收。

### 实施与验证记录

- `scripts/install-dependencies.ps1` 在源码/构建指纹检查后、`pnpm lfaa web` 前，使用 LFAA 现有 `.env` 优先级和 `home-paths` 解析当前数据目录，再读取 `storages/.configuration.lock`。仅当记录的 PID 仍是 Node 进程、命令行匹配 `apps/cli/bin/lfaa.mjs web`，且复查锁身份、命令行和进程创建时间一致时，才强制结束该 PID；确认退出后继续原有一次 Web 启动。
- 写锁格式错误、持有者仍存活但进程类型/命令不符、锁身份变化或终止未能确认都会中止启动。已退出的锁 PID不由菜单删除锁文件，沿用 `FileLease` 通过数据库事务回收。只停止控制端 PID，不结束它的本机 Daemon 子进程树；文档同步说明 Windows x64 Web 的本机 Daemon 托管行为。
- 设置中心配置：不涉及。
- 验证：PowerShell AST 语法检查通过；复用真实 Node resolver 的只读调用返回绝对数据目录；`git diff --check -- docs/PROMPTS.md docs/harness-cli.md scripts/install-dependencies.ps1` 通过。未启动 Web、未终止真实进程、未运行自动测试或构建；本地真实 PID 终止与重启行为未验。当前仓库未找到 `scripts/workspace-preflight.mjs`。

## LFAA-DESKTOP-UPDATE-RELEASE-01

### 用户目标

- 发布 LFAA 0.1.2 Windows Electron 安装包，使已安装的 0.1.1 能读取稳定版更新清单、提示新版并在用户同意后下载和安装；支持桌面端手动检查。
- 修复本次安装/启动所必需的 Electron 打包问题，沿用同一应用运行时与现有本机服务生命周期。

### 运行入口、Owner 与设置

- 运行入口：`apps/desktop-electron` Windows x64 NSIS 安装包；更新检查由 Electron 主进程负责，Renderer 通过受限 preload IPC 发起手动检查。
- 更新权威：`docs/updata-log.md` 是唯一项目版本日志；`update.json` 是被签入 `main` 的 stable 更新清单；Electron Generic Release feed 与对应 GitHub Release assets 提供安装源。
- 设置中心盘点：当前没有自动更新设置项、用户级更新开关或更新源选择；本次不新增或绕过设置。状态页继续复用现有主题与设置令牌。
- 目标平台限于 Windows Electron。Android、Tauri、macOS、Linux 和 Web 不宣称已具备原生更新能力。

### 允许修改

- `apps/desktop-electron/**` 中更新主进程、受限 preload、关于/更新界面、NSIS 配置、安装资源和直接关联回归。
- 修复桌面运行包加载所需的 `apps/cli/package-loader.mjs`；必要时同步该入口的精确打包器依赖映射。
- 修复正常推送脚本对 `packages/credentials/**` 第一方源码的过宽排除，并补入提交 `553ad39` 依赖的凭据授权、凭据记录与凭据流程工作区包；仍排除这些包内的 `node_modules` 与所有本机密钥/运行数据。
- 加入已被 Web Vite 配置引用的 `apps/web/scripts/web-asset-retention.d.mts` 声明，使候选源码可通过既定 TypeScript 构建门禁。
- `docs/PROMPTS.md`、`docs/updata-log.md`、`update.json` 以及直接相关架构/验收事实文档。
- 通过隔离 worktree 构建仅含本合同修改的 Windows Electron 包；用户已明确要求完成 0.1.2 演示，允许提交本合同限定的版本/更新记录文件、更新 `main`、创建 0.1.2 稳定 Release 并上传安装包、`latest.yml` 与 blockmap。

### 禁止修改

- 除 `packages/credentials/**` 中被 `pnpm-lock.yaml`、包清单和当前代码明确引用的第一方源码、本轮所需的 Web 声明文件及 version/update 文件外，不带入当前主工作区其他未提交文件；不改变应用权限、更新安全校验、本机服务 Owner 或数据目录；不做静默下载/安装。
- 不覆盖或重启当前运行中的 3000 Web/Control Plane/Daemon；构建产物只写该隔离 checkout 的根 `dist/`。
- 不发布 Tauri、Android、macOS、Linux 或 Web 更新包，不声称完成这些平台的验收；不加入未被实际构建验证的 Release asset。

### 验收条件

- 当前 0.1.1 安装包读取 `main/update.json` 后，Release feed 版本匹配 0.1.2 才可弹出升级；不一致时不得下载。
- 用户同意后才下载；拒绝后不下载；下载完成后再次询问安装。手动检查能报告最新版/有新版/失败/不支持状态。
- 定向更新回归、清单校验、桌面包构建和发行文件核验通过；源码提交、`main` 清单与稳定 Release/tag 对应 0.1.2；不把自动化结果冒充已实际完成安装升级。

### 实施与验证记录

- `lfaa.bat` 菜单 6 的提交 `553ad39` 已正常以 fast-forward 推到 `main`，脚本没有执行强推；复核发现 `scripts/install-dependencies.ps1` 的 `Get-BlockedGitPaths` 将所有名为 `credentials` 的目录一概过滤，导致 `packages/credentials/**` 第一方源码未进入该提交。已将过滤收窄为允许该第一方源码目录，同时仍拦截其中的 `node_modules`，并继续拦截其他凭据目录、密钥和运行数据；已用 PowerShell AST/路径判定回归核对。
- 为使 0.1.2 在干净源码中构建，补入当前 lockfile、workspace 清单和导入实际引用的授权、凭据记录及凭据流程包源码，以及 Vite 已引用的 `web-asset-retention.d.mts` 类型声明。未带入主工作区其余未提交 UI、设置或测试改动。
- 隔离 worktree 的 `pnpm run build:desktop:electron:win` 最终通过，包含 Web、Control Plane、Daemon/Sandbox Host、Electron NSIS 打包和 packaged-runtime 验证；首次构建因缺失上述 `.d.mts` 声明失败，补齐后重跑通过。设置中心没有新增或修改配置；复用现有主题/设置令牌，更新偏好仍由现有桌面更新交互管理。
- 定向验证通过：`pnpm --dir apps/desktop-electron run test:update-manifest`（18/18）、`pnpm --dir apps/desktop-electron run validate:update-manifest`、`node --test apps/desktop-electron/tests/installer-package.test.mjs`（2/2）、Electron 更新入口与清单的 `node --check`、凭据路径过滤 AST 回归及 `git diff --check`。
- 已将版本源码提交并 fast-forward 推送至 `main`：`ad61f72`（0.1.2 发布准备）和 `badcc73`（Electron Release 文件名稳定化）。正式 GitHub Release/tag 为 [LFAA 0.1.2](https://github.com/yubboo/LFAA/releases/tag/0.1.2)。线上 `main/update.json` 为 enabled stable 0.1.2；Release 仅含 `latest.yml`、`LFAA-0.1.2.exe` 和对应 `.blockmap`。线上 `latest.yml` 指向实际安装包名称，安装包下载 URL 返回 HTTP 200，Release API 中安装包 SHA-256 为 `a92588c92e87a7859ad29d737e78c7b204f38f0517517b526f7beb6df7700ce5`。
- 安装包未做 Authenticode 签名。未实际启动用户安装的 0.1.1、点击更新并完成安装升级；此项仍需桌面实机验收。`workspace-preflight` 入口在本仓库不存在，未运行。隔离 worktree 中旧的带空格命名临时安装包清理被自动策略拦截，保留原文件，未通过其他方式删除。

## LFAA-DESKTOP-ELECTRON-AUTO-UPDATE-01

### 用户目标

- 为 LFAA 增加项目自有的版本更新 JSON 清单，并让用户指定的 Electron 桌面端自动检查、下载并安装后续 Windows x64 更新。
- 参考用户提供的 DeepWrite `update.json` 字段思路；协议、URL、版本和内容均以 LFAA 当前仓库与实际发布源为准，不复制其他项目的数据或约定。

### 运行入口、Owner 与设置

- 运行入口：已打包的 `apps/desktop-electron/src/main.mjs`；Windows x64 NSIS 桌面壳负责更新生命周期，`apps/desktop-electron/package.json` 负责 updater 依赖与发布源配置。
- 当前 Electron 主进程负责启动和关闭本机控制端与 Daemon；更新安装前须沿用现有关闭流程，不绕过实例/服务生命周期或覆盖安装目录的 `data/`。
- 版本权威仍是 `docs/updata-log.md`；Electron 包元数据须与当前项目版本一致。`update.json` 是供桌面更新器消费的发布清单投影，不新增第二个版本权威，不因本补丁自动增加正式版本。
- 设置中心盘点：当前没有桌面自动更新开关或更新源配置。本任务不新增独立设置存储；按用户要求启用自动检查/下载，并在需要关闭应用安装时通过 Electron 原生确认处理。

### 允许修改

- `apps/desktop-electron/src/main.mjs`、`apps/desktop-electron/src/update-manifest.mjs`、`apps/desktop-electron/scripts/update-manifest.mjs` 与 `apps/desktop-electron/tests/update-manifest.test.mjs`：仅负责更新清单验证、Electron 自动检查/下载、用户可见提示、安装前的既有服务关闭及可诊断日志。
- `apps/desktop-electron/package.json`、`pnpm-lock.yaml`：添加官方协议要求的 updater 依赖、Windows x64 NSIS 发布元数据和所需清单打包配置；不触及 Tauri 构建目标。
- 根目录 `update.json`：新增 LFAA 更新清单，采用参考清单的 `releaseNotes` 数组；发布日期只精确到更新日志提供的日期；字段、URL、版本与现行 LFAA 发布源核对一致。
- 与 Electron 包职责直接相关的 `README.md`、`docs/系统总体架构.md`、`docs/PROMPTS.md` 和直接回归夹具。

### 禁止修改

- 不修改 Tauri 更新流程、Web/Control Plane/Daemon 业务 API、用户数据格式、认证授权或 Minecraft 执行 Owner；不删除或迁移安装目录 `data/`。
- 不改变当前正式版本或追加正式版本日志，不创建 Git tag/Release，不推送、上传、签名、部署或发布安装包，不提交 Git。
- 不在无有效更新源或清单校验失败时静默安装、不执行未校验的任意下载地址、不把缺失签名/真实发布验收表述为通过；不新增与任务无关的依赖或设置项。

### 验收条件

- 清单包含已确认的 LFAA 项目版本、稳定渠道、发布日期、版本说明、强制更新及最低支持版本语义；字段和地址均来自 LFAA 项目，不残留 DeepWrite 信息。GitHub Release 的 `latest.yml`、NSIS 安装包由发布者手动上传；根 `update.json` 通过 `raw.githubusercontent.com/<owner>/<repo>/main/update.json` 提供。
- 只有打包 Electron 桌面端自动检查更新；下载成功与失败均有可诊断记录，普通启动不等待网络；可延后安装时须明确提示，确认安装时先完成现有本机服务关闭，并保留安装目录的数据树。
- 更新源与 updater 版本/产物协议由官方 electron-builder v26 文档核验；包版本、更新清单和唯一版本日志之间有一致性校验。源码中不出现可被网页内容注入的任意 IPC 或 Node 能力。Windows 注销/关机事件发生时延期启动更新安装器。
- 直接相关的清单/版本逻辑回归、Electron 主进程语法与 Windows x64 Electron 打包检查通过，构建产物只写入根 `dist/`；外部 Release、已签名包、真实下载升级和安装环境验收分别如实记录。

### 实施与验证记录

- 已新增根 `update.json`、Electron Generic Release 更新源与 `electron-updater` 6.8.9；清单字段采用参考清单的 `releaseNotes` 数组，发布日期保留版本日志提供的 `YYYY-MM-DD` 精度。运行时从 Electron Builder 生成的 `resources/app-update.yml` 读取 Generic 更新源，因为打包后的 `package.json` 不保留 `build.publish`。清单校验与当前 `docs/updata-log.md`、包版本及 Release 地址一致。更新器只在打包 Windows Electron 中检查；启动时不等待网络。发现比当前包更新的版本后自动下载，完成后显示确认；安装前先按既有流程关闭本机服务，Windows 会话结束期间延期安装。
- 官方协议核查：[electron-builder v26 Auto Update](https://www.electron.build/v26/docs/features/auto-update/)；[electron-builder v26 Windows 配置](https://www.electron.build/v26/docs/win/)。Generic feed 需由发布者提供 `latest.yml` 与安装包；当前仓库未配置 Authenticode 发布者名称/证书，因此未声称签名验证或签名包验收通过。Release 上传、发布、真实更新下载与安装未执行。
- 设置中心：不涉及；当前没有桌面自动更新开关或更新源设置，本次按用户要求启用 Electron 自动检查，不新增设置存储。
- 验证通过：`node --test apps/desktop-electron/tests/update-manifest.test.mjs`（9/9）；`node --check apps/desktop-electron/src/main.mjs`、`apps/desktop-electron/src/update-manifest.mjs`、`apps/desktop-electron/scripts/update-manifest.mjs`；`node apps/desktop-electron/scripts/update-manifest.mjs validate`；`git diff --check`。
- Electron 构建：第一次 `pnpm run build:desktop:electron:win` 的 Web 构建因构建期间 Host/插件源码变化触发源码指纹门禁；第二次 Web 构建通过，但 Control Plane TypeScript 检查被 `packages/boot/plugin-manager/src/dsh-wallpaper-engine-runtime.ts:46` 的 `Loader | undefined` 到 `DynamicLoader` 转换错误阻断，未进入 Electron NSIS 打包。该文件不属于本任务改动。失败清理过的 `dist/apps/control-plane` 已从原有 Electron 运行树快照恢复；不完整输出保存在 `dist/.tmp/control-plane/incomplete-build-20261003`。现有桌面安装包未被覆盖。
- 仓库 Gate：未找到 `scripts/workspace-preflight.mjs`，根 `package.json` 也没有 quality/release 脚本；上述直接回归、清单校验和正式桌面构建是本任务可用的定向检查。
- 性能/运行检查：自动检查仅由打包 Windows Electron 在启动 3 秒后触发一次；清单请求有 8 秒超时且不阻塞窗口，未设置周期轮询；无真实桌面交互或帧时间测量。
- 未验收：Electron NSIS 新安装包、Release 下载、Authenticode 签名、真实升级安装及关机/注销中的桌面行为。没有执行 Release 上传、发布或 Git 推送。

## LFAA-DESKTOP-UPDATE-CONSENT-CHECK-01

### 用户目标

- 新版本发布后，当前可运行的 Windows Electron 桌面端在启动后及运行期间定期检查并向用户提示；用户可选择下载更新或暂缓。
- 用户可在应用内手动检查更新；若已是最新版本，明确显示当前版本和“已是最新”；若有新版，显示版本与更新说明并提供更新/暂缓选择。

### 运行入口、Owner 与设置

- 运行入口：已打包的 `apps/desktop-electron/src/main.mjs`；安全 IPC 只由 `apps/desktop-electron/src/preload.cjs` 暴露；共享设置界面由 `packages/client/ui-settings/src/SettingsPage.tsx` 提供。
- 更新源和版本：复用现有 `update.json`、Electron Generic Release feed、`electron-updater` 与 `apps/desktop-electron/src/update-manifest.mjs` 校验；`docs/updata-log.md` 仍是唯一项目版本权威。
- 能力范围：本轮只实现当前已打包的 Windows Electron Host。Android 尚无应用 Host/安装包，Tauri 尚未接入更新器；界面必须如实说明，不伪装为已支持。Web 不执行桌面安装更新。
- 设置中心盘点：没有自动更新开关或更新源设置。本轮不增加配置和用户偏好；沿用共享设置主题、颜色、字体和减少动态效果等现有令牌。

### 允许修改

- Electron 更新主进程、受限 preload IPC、更新状态类型及对应长期回归；可更新 `apps/desktop-electron/package.json` 注册相关测试命令。
- 共享 Settings 界面，增加用户可发现的软件版本与手动检查入口；可修改其直接相关类型和测试。
- `docs/PROMPTS.md` 索引与本合同；仅在平台能力/Owner 事实改变时同步架构或开发计划。

### 禁止修改

- 不新增第二个更新源、版本日志、API、用户设置存储或共享更新服务；不信任 Renderer 提供的版本、下载 URL 或安装路径。
- 自动检查必须网络超时且不阻塞启动；启动发现更新只能提示，未经用户明确选择不能下载。下载和安装必须核对清单版本与已配置 Release feed，并沿用现有关闭本机服务流程；用户暂缓不得终止服务或开始安装。
- 不把 Android、Tauri、Linux、macOS 或 Web 标为已支持更新，不构造虚假平台结果；不新增独立安装器或静默更新。
- 不修改正式版本/更新日志，不创建 Release、上传、发布、签名、提交 Git，不重启/覆盖当前 Web、Control Plane 或 Daemon 服务，不触碰真实用户数据。

### 验收条件

- 自动检查在启动后执行并每 6 小时复查；手动检查与自动检查串行复用单一更新 Owner。唯一调度计时器在应用退出时清理，不并发重复请求。
- 当前、暂缓、下载中、失败和不支持状态均有清晰结果；窗口关闭后不留下重复订阅、计时器或未处理请求。
- Windows Electron 新版本提示显示版本及发布说明；用户拒绝后不下载。用户接受后才下载，下载完成后再询问立即安装/稍后安装；已有 `mandatory`/最低支持版本语义保持一致。
- 安全 IPC 仅暴露固定的版本/检查能力；非打包 Electron、非 Windows、未知来源 Renderer 均不能触发本机更新。
- 运行相关更新回归、Settings/Connection 包构建、Electron 主进程语法与更新清单校验、差异检查。产物只写根 `dist/`。分别记录自动化证据与未做的真实 Release/桌面/Android 验收。

### 实施与验证记录

- Electron 主进程在窗口打开 3 秒后检查官方 `update.json`，运行期间每 6 小时复查；Settings 的“关于与更新”页可手动检查并显示当前版本/最新版本/暂缓或下载状态。版本号从 `app.getVersion()` 读取，没有复制硬编码版本。
- 发现版本后先显示更新说明和“下载并更新/暂不更新”；只有明确接受后才调用 `electron-updater.downloadUpdate()`。下载完成沿用既有安装确认与本机服务关闭链路；同一版本暂缓后自动检查不重复打扰，手动检查可再次询问。现有 mandatory/minimumSupportedVersion 语义保留。
- 更新业务由一个可测的 Electron 更新协调器负责；自动/手动检查合并并串行执行。受限 preload 只暴露当前版本与固定检查 IPC，主进程仅接受主窗口主 frame 请求；清单仍须通过 HTTPS 来源、版本与 Release feed 校验。应用退出时清理唯一的检查计时器。
- Android 尚无应用 Host/安装包，Tauri 尚无更新器，Web 无原生安装能力；三者界面明确标注未接入，没有虚构支持状态。设置中心未增加配置或用户偏好，界面复用现有主题与设置行样式。
- 验证通过：`npm run test:update-manifest`（更新清单及更新流程 18/18）；`node node_modules/typescript/bin/tsc --noEmit -p tsconfig.client.json`；Connection 与 UI Settings 定向包构建；Vite 前端生产构建输出到隔离 `dist/.tmp/desktop-update-check/web` 并确认包含新页面；Electron 主进程/preload/更新协调器语法检查；`node apps/desktop-electron/scripts/update-manifest.mjs validate`；`git diff --check`。Vite 仅显示仓库现有的大分块提示。
- 未运行：Electron NSIS 重打包、真实桌面窗口、GitHub Release 下载/安装、Tauri 与 Android 验收。本地包与仓库更新清单均为 `0.1.1`；本轮未查询线上 Release，也未触发真实更新提示。3000 端口一直在监听，本轮未重启或覆盖其 Web/Control Plane 产物；最后核实时进程 PID 为 67336。`scripts/workspace-preflight.mjs` 与根 quality/release 脚本不存在。
- 临时输出清理：自动策略拒绝删除本轮隔离的 `H:\LFAA1\dist\.tmp\desktop-update-check` 目录；目录仍位于根 `dist/.tmp`，未触及源码或服务。

## LFAA-HARNESS-PRODUCT-DIRECTION-01

### 用户目标

- 将 LFAA 明确为独立的 `LFAA-Harness` 产品，参考 DeepSeek-Harness 的纯净 Harness 项目形态；以 LFAA 自己的 Harness Runtime、插件合同及业务能力组成产品，不把开发机快照或外部另装插件作为发行内容。
- 桌面端 Windows/macOS 以 Electron 为主要构建方向；Linux 和 Android 是后续平台目标。当前是否支持必须按实际 Host、打包链和设备验收记录，不能把目标写成已实现。
- LFAA 自有基础能力按 Harness 插件/Bundle/Profile 装配；发行包可携带仓库内经过登记的第一方能力和运行所需依赖。用户从外部安装的插件、运行数据、账户凭据、缓存与开发环境状态不进入源码发布包或安装包。干净克隆和开发盘打包应生成同一类干净产品。

### 当前入口、Owner 与设置

- 产品装配：`packages/boot/app-boot/`、`packages/bundle/*`、`apps/cli/config/profiles/*` 与 `packages/boot/plugin-manager/`。
- 桌面入口：`apps/desktop-electron/` 与仍存在的 `apps/desktop-tauri/`；当前根 `build:desktop:win` 实际指向 Tauri，Electron Windows x64 安装包有独立构建入口。
- 纯净发行边界：Electron `prepare-runtime.mjs` 与 electron-builder `extraResources` 清单；外部插件与运行数据由 `LFAA_DATA_DIR` 下的插件/数据 Owner 管理，不属于开发源码工作区。
- 本任务只更新规范、当前事实和路线文档，并修复根工作区 `package.json` 被错误替换为 Electron 包清单的问题；不修改应用设置或用户数据。

### 允许修改

- `开发规范.md`：增加 LFAA-Harness 产品身份、插件模型、平台路线、纯净源码与发行物的权威规则。
- `docs/系统总体架构.md`、`docs/开发计划.md`、`README.md`：对齐目标平台、当前实现和未完成差距，清理 Tauri 正式目标与用户明确 Electron 方向间的冲突。
- `.agents/README.md` 与 `.agents/skills/lfaa-desktop-package-test/SKILL.md`：同步后续桌面打包与纯净安装验收入口，避免技能继续把 Tauri 旧默认路线当作产品目标。
- `docs/PROMPTS.md`：记录本合同、审查发现、修改范围和实际验证。
- 根 `package.json`：恢复仓库原有的 workspace manifest；桌面 updater 依赖继续由 `apps/desktop-electron/package.json` 管理。
- `pnpm-lock.yaml`：只恢复根 importer 与根 workspace manifest 的依赖映射，保留其它 workspace importer 和包版本改动。
- 只读检查 Profile/Bundle、插件数据路径与 Electron 安装包暂存清单。

### 禁止修改

- 不在本任务中实现 macOS、Linux 或 Android Host/安装包，不把这些平台标成已支持。
- 不删除 Tauri 源码或其它已有未提交改动；不复制 DeepSeek-Harness 代码或宣称 LFAA 已接入 DSH Runtime。
- 不把第三方运行库误列为外部插件；允许 lockfile 固定且运行 LFAA 第一方能力必需的依赖，禁止把外部安装的插件内容或插件数据放进发行树。
- 不扫描、复制、迁移、清理或改写真实用户运行数据；不发布、上传、签名、安装或推送任何发行物。

### 验收条件

- 根开发规范把“LFAA-Harness 是自有 Harness 产品”“基础功能插件化”“桌面 Electron（Windows/macOS）为目标、Linux/Android 后续规划”“干净克隆/开发环境生成无用户数据及外部插件的产品包”作为明确规则。
- 架构、路线图和 README 将目标与现状分开：当前 Electron 构建为 Windows x64；macOS、Linux 桌面及 Android 尚未完成平台发行验收；现有根桌面发布命令仍指向 Tauri 时，记录为需要迁移的偏差。
- 桌面打包技能明确 Electron 产品目标、现行 Tauri 默认命令偏差、Windows-only 当前包配置和纯净安装验收要求。
- Profile/Bundle、外部插件的安装数据边界和 Electron 暂存范围有实际源文件依据；未生成可安装归档时明确标注未完成包内验证。
- 根 `package.json` 恢复 `name=lfaa`、pnpm 工作区版本/引擎、工作区脚本，并可解析为 JSON；Electron updater 依赖仍位于桌面子包清单。
- 运行文档差异空白与引用检查；不运行无关产品构建或测试。设置中心：不涉及。

### 实施与验证记录

- 根 `开发规范.md`、系统架构、开发计划、README 和桌面打包 Skill 已统一为 LFAA-Harness 自有产品；基础功能通过第一方 Profile/Bundle 插件化装配；Windows/macOS Electron 为桌面目标，Linux/Android 为后续目标；发布 ZIP/安装包不含外部安装插件、用户运行数据、开发机配置或秘密。明确允许锁文件固定的运行依赖，这些依赖不等于用户另装插件。
- 当前已偏离目标：根 `build:desktop:win` 仍调用 Tauri；Electron 只有 Windows x64 NSIS 配置，没有 macOS 安装/签名构建链；Linux 桌面和 Android Host/安装包未实现。开发计划已登记迁移待办，未在本任务里改发布构建路由或实现新平台。
- 当前插件架构已有 Cordis Profile/Bundle 装配；`apps/cli/config/profiles/desktop/package.json` 装配 `lfaa-base` 与 `lfaa-web-app`。第三方插件由 `lfaa-plugin-manager` 放在 `LFAA_DATA_DIR/plugins/profiles/<Profile>`；Electron Builder 暂存来源是根 `dist/.tmp/desktop-electron/runtime` 和部署依赖，没有复制 `data/` 或外部插件安装目录的步骤。源码级检查支持“当前打包脚本没有主动复制用户插件/数据”这一结论；NSIS 归档未生成，因此不能声称最终安装包内容已验收。部分 DSH 对标目录只是占位，不能算可用插件。
- 发现根 `package.json` 被桌面 Electron 包清单替换，缺少 `name=lfaa`、pnpm 元数据与全部 workspace scripts；`pnpm-lock.yaml` 根 importer 也被改成直接依赖 `js-yaml`，与根清单不符。本轮从当前 HEAD 精确恢复根清单和锁文件根 importer；Electron updater 依赖仍由 `apps/desktop-electron/package.json` 及对应 lock importer 管理，保留其它 workspace 锁文件变更。最终根清单与 `HEAD` 相同，没有留下无关 package 差异。
- 设置中心：不涉及；本任务没有新增运行时选项。
- 验证通过：根与 Electron `package.json` JSON/目标配置静态核对、根 importer 与 workspace 依赖映射核对、桌面 Profile 和两个 Bundle 清单核对、Electron 暂存与外部插件数据目录静态边界核对、架构文本结构核对、`git diff --check`。
- 未运行：产品回归、Web/Control Plane/Daemon/Electron 构建、源码 ZIP、NSIS 归档检查、干净克隆构建、异盘安装/首次启动和全仓秘密扫描。NSIS 构建最近一次已在自动更新合同记录为被 `packages/boot/plugin-manager/src/dsh-wallpaper-engine-runtime.ts:46` 的既有 TypeScript 错误阻断；本任务未重跑该产品构建。仓库仍未找到 `scripts/workspace-preflight.mjs`。

## LFAA-PLUGIN-INSTALL-ACTIVATE-01

### 用户目标与可观察行为

- 用户在 AI Work 对话中明确说“安装这个插件”后，模型使用现有来源检查与一次性安装凭证；Plugin Owner 对当前 Runtime 明确兼容且可启用的插件，在同一安装操作中完成启用，并回读 Profile 清单和真实运行状态。
- 服务下次启动时，Plugin Owner 按 Profile 清单恢复此前明确启用且当前仍兼容的插件，让运行状态与 DSH Profile Bundle 选择一样跨进程重启保持。
- 只有 Owner 返回 `ready` 才能报告可用；不兼容仍保持不可运行。新 revision 更新继续遵守 Wallpaper Engine 更新合同：保留原安装、核对固定提交，更新完成后保持停用。
- 自动启用失败时保留已核验安装记录，向模型返回“已安装但未启用”和可继续执行的真实生命周期动作；不得返回成功或重复消费安装凭证。

### 运行入口、Owner 与设置盘点

- 运行入口：Web Profile 的现有 `capability_install` Agent Tool；来源检查由 `capability_inspect` 固定 commit；Profile 插件安装和运行只归 `packages/boot/plugin-manager`。DSH Client Modules 继续观察 Cordis Loader 新 entry 并在认证恢复时同步启动图。
- `capability_install` 原有管理员授权、危险操作审批、App 绑定、15 分钟一次性凭证和 Owner 回读合同全部保留；自动启用属于同一已授权插件安装生命周期，不新增权限、审批绕过或跨 App 影响。
- 设置盘点：不新增/修改设置与默认值；不改账户 `plugins.enabled`、`permissions.mode`、壁纸 `appearance.wallpaperEngine.enabled/projectId` 或其他外观偏好。启用状态由 Profile 插件清单和 Runtime Owner 持有。
- 性能/可维护性：安装、启用和回读顺序执行一次；不新增轮询、订阅、缓存、后台任务或媒体路径。超时/启用失败不重放已消费来源检查凭证。

### 允许修改

- `packages/boot/plugin-manager/src/index.ts`：在对话插件 Owner 中对新安装或同 revision 的未启用兼容插件执行真实 Runtime 启用；服务启动时恢复已登记的启用态；更新不同 revision 时保持停用；保留已有独占修改、目标校验和失败状态。
- `packages/boot/capability-installs/src/index.ts`：明确 `installed` 与 `ready` 的后续动作，要求模型按 Owner 清单继续生命周期或准确报告未就绪；在既有审批摘要中说明兼容新插件会尝试自动启用。
- `apps/cli/tests/plugin-manager.test.mjs`、`packages/boot/plugin-manager/README.md`、`docs/系统总体架构.md`、本合同实施记录。

### 禁止修改

- 不改变来源固定、Manifest/归档/兼容锚点核验、插件权限、管理员授权、现有危险操作审批和 Profile/App 隔离。
- 不因自动启用而改变更新后保持停用的既有约定；不执行插件脚本、不启用不兼容来源、不把任意 DSH Bundle 放入宿主进程。
- 不安装/启用当前真实用户插件、不读写真实运行数据、不重启 Web/Daemon/桌面服务，不改 UI、账户设置或上游 `H:\deepseek-harness`。

### 验收条件

- 定向回归证明：兼容的新插件经 `capability_install` 返回 `verified_ready` 且 Runtime 实际活动；新 Profile Manager 实例能恢复上次已启用的兼容插件；不可兼容插件保持禁止启用；自动启用失败返回核验后的 `installed` 并保留诊断；已安装更新 revision 保持停用。
- 运行 Plugin Manager / Capability Install 相关直接回归、包构建与 `git diff --check`；构建产物只写根 `dist/`。真实 Provider、当前 Profile、登录浏览器、桌面和插件 UI/媒体未验时明确报告。

### 实施记录

- 2026-10-04：与 DSH `plugin_manager install_bundle` 对照，确认 DSH 默认 `enabled=true`、启动时按 Profile Bundle 重新装配、安装后选择 Bundle 并触发当前 Profile Reload；LFAA 对话工具原先只调用 `manager.install()`，Owner 回读得到 `installed`，并把后续启用交给模型另一轮工具调用；LFAA 启动端也没有从插件 Profile 清单恢复持久化的 `enabled` 记录。LFAA 上游 Host Loader 事件会被 DSH Client Modules 增量扫描，认证恢复会从 Host 取回完整启动图，因此缺口在安装启用与进程重启恢复生命周期，而非 Slot 页面绘制。
- `PluginManager.installForCapability` 在同一 Profile 互斥区间内执行固定 commit 安装与受支持 Runtime 启用，再由 Capability Install Owner 回读状态；同 revision 的已停用插件也会启用。服务启动时，`restoreEnabledPlugins` 只恢复 Profile 清单明确标记为 `enabled` 的记录，并沿用 Runtime 适配器、并发上限和 Owner 状态核验；逐个失败会记录诊断并继续处理其余插件。不同 Wallpaper Engine revision 仍经过同源更新合同并保持停用。Runtime 启动失败保留安装记录并以 `verified_installed` 报告；对话工具下一步先查 Owner 清单，再按真实状态和现有权限尝试生命周期操作，原始第三方异常路径不回传。
- 定向回归通过：Plugin Manager 与 Capability Install 合并运行 15/15，覆盖兼容 DSH Host Loader 启动、新 Manager 实例恢复持久化启用状态、不可兼容状态、同 revision 自动启用、更新后保持停用、启用失败诊断与恢复；`lfaa-plugin-manager`、`lfaa-capability-installs` 包构建和 `pnpm run build:control-plane` 通过，产物位于根 `dist/`。`git diff --check` 与本轮新增/修改测试文件尾随空白检查通过。
- 设置盘点：未新增/修改设置；继续使用当前 App/Profile 插件清单和现有 `permissions.mode`、管理员授权与审批合同；不修改账户 `plugins.enabled`、壁纸 `appearance.wallpaperEngine.enabled/projectId` 或外观设置。没有新增监听、轮询、缓存或后台工作；没有采集浏览器帧时间。
- 没有安装真实用户插件、修改运行数据或重启服务。当前仓库默认 `data/plugins/profiles/web/inventory.json` 不存在，但运行服务的数据目录可能由外部环境指定，故未把它推断成正在运行服务的全局状态。真实 Provider、当前服务 Profile、登录浏览器、上游 Client HMR、Wallpaper UI/播放/媒体和桌面验收未运行；本轮 Cordis Loader 替身回归证明启用/重启恢复与 Owner 核验逻辑，不代替上述运行验收。现有运行中的服务尚未加载本次新 Control Plane 构建。

## LFAA-UI-APP-CENTER-ENTRY-01

### 用户目标与可观察行为

把 `/` 应用中心作为 LFAA 内进入或切换 SteamCMD、Minecraft、写作和通用任务能力的唯一交互入口。用户先在中心选择入口，再在所选工作区内操作；直接打开 App 深链、从其他 App 使用快捷键切换、或恢复其他 App 的会话时，先回到应用中心。

### 运行入口、Owner 与设置

- Web 与共享 Desktop Client 入口由 `apps/web`、`packages/client/ui-renderer/src/App.tsx` 和 `packages/client/ui-layout/src/Workbench.tsx` 装配；`App.tsx` 拥有浏览器路由，Workbench 拥有中心页与 App 内导航。
- App 工作区路由为 `/apps/<app>/<mode>/...`，通用任务兼容路由为 `/tasks`；路由标记只说明用户已从中心进入当前 App，不构成认证或授权。Server API 继续独立校验身份和权限。
- 设置中心已有配置继续生效：`general.defaultMode` 决定三个业务 App 的默认模式；`general.showServiceStatus` 控制顶栏连接状态；`general.defaultStandaloneChat` 不再让登录恢复绕开中心，改为在中心页标记通用任务为默认入口。设置字段、默认值、API、校验和持久化不变。
- 应用外观继续使用主题、强调色、字体/字号、对比度、应用中心壁纸、遮罩、模糊和减少动态效果的已有映射；不增加设置项、CSS 自定义属性、图片或动画依赖。

### 当前合同与验收条件

- 登录或恢复账户后，进入 App 能力时首先显示应用中心；`defaultStandaloneChat` 开启时仍先显示中心，只在通用任务按钮上标记默认入口。设置/用户管理既有路由保留。
- 从中心点击三个 App 卡片或通用任务按钮，才建立对应的导航来源并进入其工作区。直接进入 `/apps/...`、`/tasks` 或对应浏览器历史项时，若没有匹配的中心入口标记，则替换到 `/`。
- 已进入 App 后，同一 App 的子路由、常规/AI Work 切换、文件与设置往返继续工作。不同 App 的快捷键与最近会话先返回中心并聚焦目标 App 卡片；跨 App 会话在目标卡片提供明确的“继续所选会话”入口，点击后才进入目标 AI Work。
- 顶栏不再提供绕过中心的“任务工作区”直达项；左一现有“应用中心”按钮继续返回 `/`。保留现有三张 App 卡片、真实接入状态、`defaultMode` 模式按钮、已选 App 偏好和服务状态控制。
- Web TypeScript/Vite 构建、目标文件差异检查通过；若本地登录态浏览器可用，核实中心进入、深链拦截、跨 App 快捷键/会话、回退/前进和既有主题适配。未实测的项目须单独报告。

### 允许修改

- `packages/client/ui-renderer/src/App.tsx`：标记从应用中心发起的 App 导航，拦截没有有效来源的 App 深链与历史恢复，并保持登录后的应用中心入口。
- `packages/client/ui-layout/src/Workbench.tsx`：明确中心页入口说明；将通用任务快捷入口绑定到应用进入回调；使跨 App 快捷键和会话恢复先回中心；移除顶栏任务工作区直达项。
- `packages/client/ui-layout/src/workbench.css`、`packages/client/ui-theme/src/responsive.css`：只调整中心页相关结构或焦点反馈，继续使用现有主题令牌；不新增 CSS 自定义属性。
- `packages/client/ui-settings/src/SettingsPage.tsx`：把 `defaultStandaloneChat` 的说明改成中心页默认入口偏好，保留原账户字段和值。
- `docs/系统总体架构.md`、`docs/开发计划.md`、`docs/harness-agent-delivery.md`、`docs/设置中心审查与整改待办.md`、`docs/PROMPTS.md`：同步路由事实、设置语义、本合同和完成记录。

### 禁止修改

- 不改 Server/Daemon 的认证授权、业务 API、数据库字段、Agent 工具或 App 能力实现；客户端中心入口不是安全边界。
- 不改变常规/AI Work 的业务模式、同 App 子路由、用户已保存偏好值、`general.defaultMode`、`general.showServiceStatus` 或其持久化。
- 不增加应用切换面板、快捷键、依赖、图片、假能力状态或模拟会话；不部署、发布、上传、提交 Git 或重启现有服务。

### 实施与验证记录

- `App.tsx` 在 history state 中标记从中心进入的 App，并在未登录直链、登录恢复、无匹配标记的历史返回/前进中将 `/apps/...` 与 `/tasks` 替换回 `/`；服务端认证授权没有变化。设置与用户管理原有路由保留。
- 登录态 `http://127.0.0.1:5173/` 浏览器核验：应用中心标题、三个业务 App 卡片与通用任务入口可见；直接打开 `/apps/minecraft/normal` 和 `/tasks` 均回到 `/`；从中心的通用任务按钮进入 `/tasks`，从中心进入当前已选写作 AI Work 到 `/apps/writing/ai-work`；浏览器后退回中心、前进恢复写作 AI Work；从写作 AI Work 触发 `Ctrl+Alt+2` 后回到 `/` 并聚焦 Minecraft 常规入口。操作后保留写作 AI Work 为已选 App/模式。未触发真实的跨 App 最近会话通知，相关跳转逻辑只做静态核对。
- 设置映射：设置中心读取到 `general.defaultStandaloneChat=false`，与当前应用中心的“进入通用任务”文案相符；切换控件仍写入原账户字段，默认模式和连接状态继续由 `general.defaultMode`、`general.showServiceStatus` 控制。为保留账户原偏好，本轮没有切换该设置以验证另一分支；两种文案分支由构建前的源码绑定静态确认。主题、强调色、字体/字号、对比度、应用中心背景、遮罩、模糊和减少动态效果沿用现有令牌，没有新增或重置设置。
- `pnpm --filter lfaa-web run build` 通过，TypeScript 与 Vite 生产构建成功，输出到根 `dist/apps/web/`；Vite 保留既有大 chunk（最大约 1.36 MB）的体积警告。目标文件 `git diff --check` 通过。浏览器检查使用 Vite 源码热更新入口；没有重启 `127.0.0.1:3000` 的运行服务。仓库根未发现 `workspace-preflight` 或 `quality:full` 脚本，未运行。
- 性能/安全静态核对：没有新增请求轮询、计时器、观察器或缓存；已有 `popstate` 与快捷键订阅有卸载清理。路由标记只提供入口体验，不作为授权条件；未测量帧时间，也未运行 Provider、Daemon 或桌面验收。

## LFAA-UI-APP-CENTER-POLISH-02

### 用户目标

继续优化 `/` 应用中心的界面，让标题、通用任务入口、三个专业 App、接入状态和模式按钮形成清楚易用的视觉层级，同时延续应用中心作为进入 App 能力的统一入口。

### 运行入口、Owner 与设置中心配置

- Web 入口：`pnpm --filter lfaa-web run build`；页面 Owner 为 `packages/client/ui-layout/src/Workbench.tsx`，应用中心结构及模式入口在 `Workbench`，视觉样式由 `packages/client/ui-layout/src/workbench.css` 与 `packages/client/ui-theme/src/responsive.css` 共同拥有。
- 设置盘点：继续读取 `appearance.theme`、`accentColor`、`fonts`、`interfaceFontSize`、`contentFontSize`、`contrast`、`backgrounds.appCenter`、`overlay`、`blur` 与 `reducedMotion` 的现有主题令牌映射；应用入口仍使用 `general.defaultMode`、`general.defaultStandaloneChat` 和 `general.showServiceStatus`。本任务不新增或修改设置字段、默认值、服务端校验、持久化或映射。
- 页面背景、字体字号、表面透明度和模糊必须继续遵循账户外观偏好；不能把某个主题、字体或强调色硬编码成全局外观。

### 当前合同与验收条件

- 应用中心标题区使用明确的中心主标题、简短操作说明和现有通用任务入口；三张真实 App 卡片在其下方清楚呈现，状态与常规/AI Work 两个入口不混淆。
- 加强卡片标题、接入状态和模式按钮的层级与可读性；按钮触达面积适合鼠标、触控和键盘。保留已选 App/模式标记、目标聚焦样式和真实接入文案。
- 继续保持桌面 3 列、窄桌面 2 列、移动端 1 列的既有断点与自然滚动；第二行卡片维持居中，不产生横向溢出。
- 不增加新内容源、假状态、外部图片、CSS 自定义属性、依赖、观察器、轮询或重型动效；已有用户主题、动态效果偏好、入口路由和操作行为保持一致。
- 运行 Web TypeScript/Vite 构建和目标文件 `git diff --check`。如果本地登录态页面可用，浏览器检查宽桌面、双列窄桌面、手机视口、键盘焦点、用户背景/颜色令牌与横向溢出；无法连接时明确记录环境限制，不重启现有后端或实例。

### 允许修改

- `packages/client/ui-layout/src/Workbench.tsx`：仅调整应用中心标题、分组说明和既有应用入口的呈现结构；不改变路由或偏好写入。
- `packages/client/ui-layout/src/workbench.css`：调整应用中心标题、应用卡片、状态和模式按钮样式；只使用现有主题令牌，不新增 CSS 自定义属性。
- `packages/client/ui-theme/src/responsive.css`：仅同步应用中心新结构在 1050px、720px 与矮视口下的适配。
- `docs/PROMPTS.md`：维护本合同与完成/验证记录。

### 禁止修改

- 不改 `App.tsx` 路由守卫、认证授权、业务能力、卡片选择与模式切换行为、通知/会话流程或设置中心 UI。
- 不安装依赖、不生成/下载图片、不改用户外观或应用偏好、不重启运行服务，不提交、发布或部署。
- 不使用无用户价值的滚动锁定、轮播、跑马灯、自动播放或新增 GSAP 能力；减少动态效果设置必须有效。

### 实施与验证记录

- `Workbench.tsx` 将中心标题、用途说明和通用任务按钮排为居中主视觉，并给三张 App 卡片增加可见的“专业应用”分组标题与模式提示；没有改变入口回调、当前 App 标记、接入状态或用户设置行为。
- `workbench.css` 强化卡片封面、标题、接入状态和两种模式按钮层级；状态使用主题表面/文字令牌，按钮等宽并提供 44px 触达高度。应用中心沿用当前主题、强调色、字体字号、对比度、背景图、遮罩透明度、模糊及减少动态效果设置；没有新增/重置设置或 CSS 自定义属性。
- `responsive.css` 维持 1050px/720px 断点与 3/2/1 列，保持窄桌面第三卡居中；移动端通用任务按钮铺满可用宽度，模式按钮继续等宽。矮屏布局继续自然滚动。
- `pnpm --filter lfaa-web run build` 通过，TypeScript 和 Vite 生产构建成功，输出到根 `dist/apps/web/`。Vite 保留已有大 chunk 体积提示，最大约 1.36 MB；目标文件 `git diff --check` 通过。未运行自动化测试。
- 浏览器目视未运行：`127.0.0.1:3000` 当前拒绝连接；已有 Vite PID 13568 在 `127.0.0.1:5173` 返回 HTTP 404，本轮 CUA IAB 也拒绝打开本地页。没有重启或停止现有服务；桌面、窄屏的最终渲染和帧时间尚未实测。
- 性能静态核对：没有新增网络请求、轮询、计时器、观察器、缓存或动效依赖；保留现有 CSS 悬停过渡及 `reducedMotion` 全局禁用规则。视觉对比度和帧时间因浏览器页不可用而未实测。

## LFAA-WALLPAPER-ENGINE-END-TO-END-01

### 用户目标与故障证据

- 用户要求安装并启用官方 `elysia395/dsh-wallpaper-engine` 后，在 LFAA-Harness 的设置中心与工作台中直接使用插件自身完整界面和上游真实功能；不得重画或删减插件 UI，也不得把静态 Slot、安装记录或构建成功当作可用。
- 当前 `apps/web/vite.config.ts` 仅代理 `/api`、`/socket.io`。浏览器实际需要从同源 `/__dsh/index-injections` 取认证后的模块图、从 `/plugins` 取 Client bundle/HMR 事件，并把上游 `/wallpaper-engine/*` API 与媒体请求交给同一个已认证 Control Plane。缺少代理时，SPA 会把请求响应成 HTML/404，Client 启动图、插件 bundle 和全部 Host API 都无法正常工作。
- 本机只读运行核验曾观察到 5173 只有 Vite 前端、3000 Control Plane 无监听；因此当时页面显示的空 Profile/API 请求失败不是对真实插件清单的有效核验，也不证明插件已经安装。
- 修复代理并通过标准启动入口启动 Control Plane 后，真实 `web` Profile 的 `__DSH_BOOT__` 只有 Client Modules/UI Renderer/HMR 三个基座包，没有 `dsh-plugin-wallpaper-engine`；`/wallpaper-engine/inventory` 未命中 Host 路由并落入 SPA fallback 返回 HTML，这不是插件 API 的成功响应。由于浏览器设置页/API 状态请求失败且当前 Codex 浏览器页未渲染 React UI，无法从插件 Manager Owner 核实持久清单究竟缺失还是未启用；只确认当前运行 Host 没有提供该插件 Client/路由。
- 继续通过真实浏览器复现空白页后，Vite/React 启动和静态资源均返回 200；浏览器捕获 `<ScopeProvider>` 的 React 挂载错误。固定 DSH Renderer 源码确认它在渲染 root 前无条件查找 `session-maybe` Scope Adapter，缺失时抛出 `scope 'session-maybe' rendered without an installed adapter`。对照 `H:\deepseek-harness\packages\bundle\web-app\cordis.patch.yml`，上游 Bundle 在 Renderer 后加载 `@deepseek-ai/dsh-client-ui-session` 并由它安装真实 Session adapter；LFAA 的精简图不加载该 DSH Session Owner，也没有把 LFAA 运行/会话对象映射成 DSH Session。Wallpaper Engine 当前只注册根级 Settings 与右侧栏槽，因此 Host 要提供明确的“无 DSH Session”投影供根级插件渲染；不伪造 Session id，也不冒充支持需要 DSH Session/SessionProvider 的其他扩展。
- 本轮已按用户批准，通过 LFAA `capability_install` 一次性安装并启用官方仓库提交 `0e9171817530272685f42b66e007a0831e2035c9`（v1.2.0）；Plugin Manager 已确认 Profile 安装记录，但自动启用失败，当前状态为 `installed`。没有再次安装或覆盖该提交。
- 用同一官方提交在 `dist/.tmp` 隔离目录经 LFAA `DshWallpaperEngineRuntime` 生成运行副本后，发现 `adaptHostSource()` 的 `mediaOriginInfo()` 正则在返回对象的第一个 `}` 处提前终止，留下原函数尾部 `}));`；生成的 `lib/index.js` 在该位置语法无效，原生插件载入因此失败。旧合成夹具的 `mediaOriginInfo()` 只返回简单表达式，且 Fake Loader 不运行插件 apply，未覆盖该真实形态。本地 `H:\deepseek-harness\plugins\dsh-wallpaper-engine` 为 `d1d82d12…`，不是本次安装的 `0e917181…`，不得用其替代已核验提交。
- 真实 Cordis Loader 回归进一步发现：上游 Host/Client 都把具名 `function apply` 放进插件导出；Cordis 会将可构造函数判作 class 插件并使用 `new`，因此主体虽运行但普通返回值清理器不进入 Fiber 生命周期。LFAA 固定来源转换器需要把两侧实际导出包装为非构造箭头回调，并等待 LFAA Loader 触发的 Fiber 清理完成；这属于 LFAA-Harness 的 ABI 适配，不修改 Cordis、上游源码、Profile 或设置。
- 用户再次明确：LFAA-Harness 是产品、Profile/插件生命周期、授权、设置与运行状态的唯一 Owner；DSH 仅提供此第三方插件既有 ABI 与行为参考。不得把产品、开发计划或能力 Owner 转移给 DSH，也不得把此固定来源兼容适配扩展成通用 DSH 宿主。

### 运行入口、Owner 与设置

- 产品运行入口属于 LFAA-Harness：Web 的 Vite 同源开发页和生产 Control Plane 页面；Vite 仅负责转发，Profile/装配、插件来源核验与生命周期归 LFAA `packages/boot/plugin-manager`，认证 HTTP 与路由归 LFAA `packages/host/webserver`，上游代码只在该固定来源兼容适配器内运行。DSH ABI/Client Modules 是协议互操作依赖，不是 LFAA 产品或生命周期 Owner。
- `/__dsh` 由 Control Plane 的 DSH WebServer Carrier 发布启动图；`/plugins` 由官方 Client Modules 发布只读 bundle、并承载已认证 HMR 事件；`/wallpaper-engine` 由官方插件 Host 路由提供，继续使用现有 LFAA 登录会话、Profile 数据根和文件校验。浏览器代理不得剥除 Cookie、改写路径或新增绕过认证的出口。
- 设置继续由现有 Owners 持有：账户壁纸选择 `appearance.wallpaperEngine.enabled/projectId`，共享外观主题/强调色/字体字号/遮罩/模糊/对比度/减少动态效果及 `general.language`、`shortcuts.wallpaperSidebarToggle`；插件自己的媒体、播放列表、字体集和诊断配置继续存放上游既定 Profile 运行数据。默认值和用户偏好不变。
- 性能要求：无新轮询、重复订阅或无界缓存；代理对上传/媒体 Range/长连接只流式转发，不缓冲大正文；测试/隔离环境与真实 `LFAA_DATA_DIR` 分离。

### 允许修改

- `apps/web/vite.config.ts`：补齐精确 DSH/Wallpaper 同源开发代理及故障诊断，不改变生产 Host 路由。
- `apps/web/src/dev-proxy.ts`：定义 Web 开发入口共享的 Control Plane 路由表，供实际 Vite 配置和端到端回归共同使用。
- `apps/cli/tests/dsh-wallpaper-dev-proxy.test.mjs`：增加长期回归，用临时本机 HTTP Host 与隔离 Vite 实例证明三类 DSH/插件路径、方法、Cookie、Range 头按原路径送达，并在清理路径关闭监听。
- `packages/client/modules/src/client/index.ts`：在 DSH Renderer 开始挂载前安装明示“当前无 DSH Session”的 Scope Adapter；无会话投影稳定为空，不映射/虚构 LFAA Session，收到显式 DSH Session target 时拒绝，未安装 session-area Renderer，保持需要 DSH Session 的扩展不可用。适配器由 DSH client-modules bridge 同一 Client Context 持有。
- `packages/client/modules/src/client/session-scope.ts`：实现上述 absent-only Session scope adapter，并在官方 DSH `uiSession` Owner 已装配时让其保持唯一权威。
- `packages/client/README.md`：维护 DSH Client 集成支持边界，说明根级 Slots 可用而 DSH Session 范围仍不可用。
- `apps/cli/tests/dsh-client-session-scope.test.mjs`：覆盖无会话投影、稳定快照、无隐式 session-area 能力，以及显式 DSH Session target 的失败行为。
- `packages/boot/plugin-manager/src/dsh-wallpaper-engine-runtime.ts`：修复 LFAA 自有 Plugin Manager 的固定来源转换器，使上游 Host 的兼容函数替换保持合法 JS、Host/Client `apply` 回调进入 Cordis 生命周期且卸载完成后再返回，并在不匹配时失败关闭；以新 adapter revision 隔离旧运行副本，不改变 Profile、账户设置、鉴权与上游 UI。
- `apps/cli/tests/dsh-wallpaper-engine-runtime.test.mjs`：将回归夹具改为包含上游真实 `mediaOriginInfo()` 的嵌套返回对象与非构造 Host/Client 导出包装，并以真实 Cordis Loader 与 LFAA WebServer Carrier 验证启动、路由登记、Host 清理器执行和卸载；另在隔离目录使用获批官方提交验收完整 Host。
- `apps/cli/tests/plugin-manager.test.mjs`：同步通用 Capability Install/Plugin Manager 回归中的 Wallpaper Engine 假归档，使其包含当前固定来源检查要求的 Host/Client 导出锚点；只修测试输入，不放宽或改写生产兼容检查。
- `packages/boot/plugin-manager/README.md`：说明 LFAA-Harness 持有 Profile、生命周期、Host 路由与设置映射，DSH 只作为这个插件的 ABI 兼容输入；记录真实改写边界与验证。
- `docs/PROMPTS.md`、确有需要时的 `apps/web` 或 `packages/boot/plugin-manager` Owner README 与 `docs/系统总体架构.md`：记录接线边界与真实验证状态；如后续追踪发现代理/Scope Adapter 外另一个根因，先在本合同记下证据和准确允许文件，再实现。

### 禁止修改

- 不修改 `H:\deepseek-harness\plugins\dsh-wallpaper-engine` 上游 UI/功能，不重做插件业务界面，不把功能迁入 Daemon/Minecraft，不用假库存、占位响应或自动“成功”代替 Host 回应。
- 不绕过用户认证、DSH Carrier 鉴权、Profile/App 数据隔离、插件来源提交/归档校验、管理员审批或现有插件兼容检查；不对 `/plugins/events` 或 `/wallpaper-engine/*` 增加公开访问。
- 不安装、更新或移除真实用户插件，不改 Profile 清单、账户设置、壁纸文件或 Steam 内容，不停掉/重启正在运行的 Control Plane、Daemon、桌面或现有 Vite 服务；若 Control Plane 当前未运行且其端口空闲，允许用 `pnpm lfaa web --no-local-daemon` 启动单独的 Control Plane，通过现有 Owner 只读核验/恢复已启用的 `web` Profile，不启动 Daemon。正常启用流程生成的适配器运行副本限于当前 Profile 的插件运行数据目录。Web/Control Plane 构建产物仅写根 `dist/`。
- 对本轮已批准安装的 `0e917181…`，不得重复安装、更新、移除或直接改写 Profile 源码/清单；故障修复只能更新 LFAA 仓库中受版本控制的适配器。隔离复现不得读取或写入真实 Profile/Steam 数据。当前运行中的 Control Plane/Vite/Daemon 不重启。
- 不把 DSH 描述成 LFAA-Harness 产品或生命周期 Owner；不新增依赖于外部 DSH 应用进程的运行要求，不复制/维护上游 UI，不把固定来源适配扩成通用 DSH 插件宿主。

### 验收条件

- Vite 同源开发环境对 `GET /__dsh/index-injections`、版本化 `/plugins/*` bundle、`/plugins/events`、全部 `/wallpaper-engine/*` 路由保留方法、路径、认证 Cookie、Range 与流式行为并送达 Control Plane；代理错误保留可诊断状态，不把响应伪装成有效 Client 图。
- 独立的长期回归在隔离 Vite/HTTP Host 中验证转发与请求头，不访问真实账户或运行数据；随后执行定向测试、Web 类型检查/构建、Control Plane/插件 Owner 直接构建（若本轮 Owner 代码改变）和 `git diff --check`。确认所有产物位于根 `dist/`。
- DSH Renderer 首次挂载前具有明确的无 DSH Session adapter：Root-scope Wallpaper Engine UI 正常渲染；未映射的显式 Session target 和 SessionProvider 仍 fail-closed。
- Runtime 回归证明 LFAA Plugin Manager 将兼容固定来源交给 LFAA Cordis Loader，LFAA Client 承载上游 Settings/Wallpaper/Appearance/Playback UI，并在停用时卸载；Host 路由仍由 LFAA Carrier 与既有认证、Profile 数据边界管理。
- 将官方 v1.2.0 的完整 Host/Client 源码置于独立数据根运行真实 Cordis Loader/Carrier：Host 注册完整 API 路由，插件停用返回后所有路由撤销；Host/Client 改写副本均通过 Node 语法检查，Client 的上游 UI/Slot 结构不得被删减。
- 本机浏览器对真实登录 Profile 的 Settings、右侧图标入口和实际插件响应仅在保留现有服务、用前述许可启动缺失 Control Plane 的前提下验收；不得执行安装/更新/删除或改动账户偏好。若当前 Profile 没有启用的兼容插件或 Host 启动失败，须回报 Owner 的真实状态，不得因源代码接线测试通过声称真实插件已可用。
- LFAA Runtime 定向回归必须对嵌套对象返回的 Host 源码产物执行解析与真实 Cordis 生命周期，确认夹具 Host 路由经 LFAA Carrier 注册、启用进入 ACTIVE、停用后撤销；验证只使用隔离测试源码与独立数据根。相关 Owner 构建输出仍只在根 `dist/`。

### 实施与验证记录

- 2026-10-04：修复 Vite 开发服务只转发 `/api`、`/socket.io` 的缺口；现在 `/__dsh` 启动图、`/plugins` Client bundle/HMR 与 `/wallpaper-engine` 全部请求走原路径转发到现有 Control Plane。代理不读/缓冲上传正文，不改 Cookie/Range/方法；生产 Control Plane 与认证规则不变。抽出的路由表由 Vite 配置及回归共同消费。
- 新增隔离 Vite + 临时 HTTP Host 回归，真实经过 Vite 验证启动图、Client bundle、SSE HMR、设置 PUT、上传 POST 和 Range 媒体请求，逐项核验路径、Cookie、方法、正文、Range 和流响应；`dsh-wallpaper-dev-proxy`、DSH Profile/Carrier、Wallpaper Runtime、Slot、Plugin Manager/Capability Install 定向回归合计 24/24 通过。`pnpm --filter lfaa-web run build` 的 TypeScript 与 Vite 生产构建通过，输出根 `dist/apps/web/`；保留已有 1.36 MB chunk 体积提示。`git diff --check` 另行核验。
- Control Plane 原先不在运行；经用户请求的本地验收范围，使用 `pnpm lfaa web --no-local-daemon` 启动现有 `web` Profile，未停止/重启 5173 Vite、未启动 Daemon。`/api/health` 返回 ready，5173 的 `/__dsh/index-injections` 经代理返回 200 JSON，基座三个 DSH bundles 均为 200。
- 2026-10-04：真实浏览器确认空白页是 DSH Renderer 的强制 Scope Adapter 前置条件未满足；上游 DSH 正常启动链会装入 `ui-session`，但 LFAA 不能直接复用它（LFAA 没有该 DSH Sessions/Remote Client Owner，且不得创建第二个 Session 系统）。现在将补入无会话投影适配器，只服务根级 Wallpaper Engine Slots；插件用到的上游 Host/Client 业务和组件仍来自固定上游包。此项修复尚待实现及浏览器复验。
- 2026-10-04：`packages/client/modules/src/client/session-scope.ts` 增加空 Session 投影；DSH 启动图准备完成后、LFAA UI mount 前安装。显式 session target 抛出真实未支持错误；不提供伪造的 `SessionProvider` area；若官方 `uiSession` Owner 已存在则不覆盖。`apps/cli/tests/dsh-client-session-scope.test.mjs` 与 DSH Profile/Carrier、Wallpaper Runtime/Slot、Plugin Manager/Capability Install 定向套件 25/25 通过；`pnpm --filter lfaa-web run build` 的 TypeScript 与 Vite 构建通过，输出 `dist/apps/web/`，保留已有约 1.36 MB chunk 提示；`git diff --check` 通过。
- 真实浏览器复验：在清理旧 console 后刷新 5173，React `ScopeProvider` 错误不再出现，`#root` 已渲染 LFAA 登录界面，不再白屏。当前浏览器没有 LFAA 登录态，所以不能进入 Settings 验收插件 UI；Control Plane 当前实际 `__DSH_BOOT__` 仍没有 Wallpaper Engine Client entry，`/wallpaper-engine/inventory` 仍落入 HTML fallback。插件 Profile 的持久清单因此依然不能确认，且没有执行安装、启用、更新、移除或真实媒体操作。代理和无会话 Scope 修复证明“前端可挂载”，不证明“Profile 插件已就绪”或完整壁纸能力已验收。
- `docs/系统总体架构.md` 与 `packages/client/README.md` 已同步记录 absent-only DSH Session 边界、Wallpaper Engine 当前根级 Slot 支持面，以及依赖真实 DSH Session 的扩展仍不受支持。
- 实际运行 `web` Profile 的启动图无 Wallpaper Engine 条目，Host 也没有对应路由；持久插件清单无法通过当前浏览器状态页/API 认证读取，故不下结论称“未安装”，也不推断其是否仅处于停用状态。本次没有执行用户 Profile 的安装、升级、移除或偏好/媒体数据变更。真实插件 UI/壁纸功能仍不可验收，且当前浏览器页为空白；不能把代理修复或旧的合成 Runtime 测试说成完整接入。需要通过现有受认证、固定来源的 Plugin Manager/`capability_inspect` → `capability_install` Owner 流程核对并恢复真实状态。
- 设置不变：继续使用 `appearance.wallpaperEngine.enabled/projectId`、`appearance.theme`、强调色、外观字体/字号、遮罩、模糊、对比度、减少动态效果、`general.language` 与 `shortcuts.wallpaperSidebarToggle`；本轮没有增添或重置设置，也没有修改插件运行数据。
- 2026-10-04：用户明确 LFAA-Harness 必须始终是产品与插件 Owner。精确复现将本次安装提交的真实 `lib/index.js` 交给 LFAA 兼容改写器，发现 `mediaOriginInfo()` 对象字面量导致改写副本留下多余括号并无法解析；这就是 `installed` 但不能启用的已确认根因。测试假 Host 未包含这个嵌套函数结构，是旧回归遗漏原因。该时点按本条允许范围开始修复 LFAA 插件运行时、补真实 Loader/Carrier 回归并更新 Owner 说明；不重装、不重启当前服务。后续记录包含已完成的代码修复及其验证。
- 2026-10-04：LFAA `adaptHostSource()` 将 Host 函数改写锚点限制为具名多行函数的同级闭合括号，格式压成单行时失败关闭；`adapter-4` 与旧运行副本隔离。再以真实 LFAA Cordis Loader 发现具名 `function apply` 会被误分类为 class 插件，导致官方 Host 返回的清理函数未被 Fiber 托管；LFAA 私有运行副本现将 Host 默认导出与浏览器 Client bundle 导出包装为箭头回调，并在停用时显式等待 Fiber teardown 后才返回。
- 精确官方提交 `0e9171817530272685f42b66e007a0831e2035c9` 隔离烟测通过：真实 Host ACTIVE、38 条路由已登记，`disable()` 完成后路由数归零；准确官方 Client 的兼容副本语法检查通过。`apps/cli/tests/dsh-wallpaper-engine-runtime.test.mjs` 3/3 通过，含真实 Cordis Loader/LFAA WebServer Carrier 的激活、返回清理函数执行与卸载回归，以及单行未知锚点失败关闭。
- `pnpm --filter lfaa-plugin-manager run build`、`pnpm --filter @yubboo/lfaa run typecheck`、`pnpm run build:control-plane` 和相关文件 `git diff --check` 通过；生成物只在根 `dist/`。仓库没有 `scripts/workspace-preflight.mjs`，未运行该不存在的 Gate。
- 发现 `apps/cli/tests/plugin-manager.test.mjs` 的通用 Capability Install 假归档仍用旧 Host/Client 形态，不能满足固定来源检查的新兼容锚点；已在本合同登记并同步测试夹具，保留生产侧 fail-closed 校验。插件安装、API、Profile、Carrier、Slot、Session scope、Vite 代理与 Wallpaper Runtime 相关 9 个回归文件合计 28/28 通过。
- 较早的只读快照：当时 `5173/settings?section=plugins` 显示准确的 `dsh-plugin-wallpaper-engine v1.2.0 / 0e917181…` 为“已安装，未启用”，运行 UI 与壁纸播放尚未验收。该阶段未重启 Control Plane/Vite/Daemon、未重新安装，也未改写清单、账户设置或 Steam 内容；此状态已由下方 2026-10-04 实际运行验收记录更新。
- 设置盘点结果不变：只沿用 `appearance.wallpaperEngine.enabled/projectId`、`appearance.theme`、强调色、外观字体/字号、遮罩/模糊/对比度/减少动态效果、`general.language` 和 `shortcuts.wallpaperSidebarToggle`；本轮未增加、写入或重置任何设置值。
- 2026-10-04 实际运行验收：缺失生成文件 `dist/apps/control-plane/packages/util/home-paths/src/index.mjs` 导致 Control Plane 初次启动失败；运行 `pnpm run build:control-plane` 后该模块与 `workspace.json` 均生成，再按现有入口启动 `web` Profile，`/api/health` 返回 `ready`，保留原有 Vite `5173`。通过 LFAA AI Work 的 `capability_list` → `capability_set_enabled` → `capability_list` 启用既有准确提交，没有重装；Profile Owner 清单回读 `enabled`、`reason=null`，来源提交不变。设置页刷新后显示“插件 Runtime 已确认运行”。
- 真实登录浏览器加载上游完整 Settings UI（壁纸库、外观、播放、系统、扩展、关于）；壁纸选择器显示 39 个 Everyone/G 可播放条目及隐藏/类型/分级筛选。LFAA 通用工作台右侧注册了壁纸引擎小图标；打开抽屉后可见壁纸列表、外观和播放分区及上游控制项。Control Plane 日志记录来自已加载 Client 的 `/wallpaper-engine/settings` PUT 200 与 `/wallpaper-engine/client-diag` POST 204。没有选择壁纸或触发播放，所以实际壁纸应用、媒体播放与帧时间仍未验收；LFAA 的 `appearance.wallpaperEngine.enabled/projectId` 和现有外观偏好没有改动。
- 安装目录归属核对：DSH 默认 Home 是 `%USERPROFILE%\.dsh`，Profile 位于 `%DSH_HOME%\profiles\<name>`；LFAA 当前 `web` 插件源码仍由 LFAA Owner 安装在 `H:\LFAA1\data\plugins\profiles\web\elysia395-dsh-wallpaper-engine`，不能因使用 DSH ABI 而写入 DSH Home。插件 Settings 当前显示的 `C:\Users\yu\.dsh-wallpaper-engine\uploads` 是上游插件自己的媒体上传目录，与 DSH Harness Home 及插件源码目录都不同。上游 `DSH_WE_DATA_DIR` 控制的主数据目录已指向 LFAA Runtime 数据根，但上传目录另有用户配置/默认路径解析；本轮没有迁移或更改该路径及文件，不能将其描述成已迁入 LFAA 数据根。

## LFAA-SESSION-KERNEL-01：LFAA Session 内核

### 用户授权与目标

用户明确要求以 `H:\deepseek-harness\packages\core\session` 源码为基准，在 LFAA-Harness 建立完整的 LFAA Session 内核。用户确认本轮范围为“完整复刻 Session 内核”。LFAA Session 是 LFAA 自有实现，继续遵守本仓库的包边界、账户与 App 隔离、Host 和 UI 约定。

### 运行入口、Owner 与设置

- 运行入口：Control Plane 的 Agent Loop (`pnpm lfaa web`)；生产对话由现有 `packages/core/agent-loop` 驱动。
- 唯一 Session Owner：现有 `lfaa-session` (`packages/core/session`)；认证路由继续归 `packages/api/session-controller`；持久化继续归 `packages/session/session-persistence-jsonl`，SQLite 会话头只作为当前权限查询和索引所需投影。
- DSH Session 仅作源代码与行为参考。不得新建并行 Session 服务、会话表、JSONL 根目录或身份/App/权限实现；既有 LFAA `sessionId`、AI Work API、项目上下文与会话数据必须兼容。
- UI 继续由 LFAA AI Work 和既有主题/工作台 Owner 管理。本任务不复制 DSH 聊天 UI、布局、CSS 或设置页；已有外观、App 选择和会话交互不回退。
- 设置盘点：复用现有 AI Runtime Provider/模型、`permissions.mode`、`general.followupBehavior` 与已登记项目上下文。Session 内核不新增或重置设置，不改变审批、授权、EULA 或用户偏好。

### 目标能力与允许修改

- 在唯一 `lfaa-session` Owner 内实现 DSH `core/session` 的核心语义：类型化仅追加事件、连续且经过校验的序号、无损 JSON 快照与不可变事件、Surface 消息派生与替换、请求 Header/Context 折叠、历史 Tool 定义恢复、精确前缀 fork、崩溃尾部 Tool 结果修复，以及持久性 flush/恢复边界。
- 将当前 Agent Loop 的真实用户输入、已准备模型请求、模型响应/失败、Tool 调用/结果、活动、取消/中断、用量和会话元数据纳入真实事件；不得用合成成功、模型文本或 API 状态伪造 Owner 结果。模型请求历史从权威 Session 事件派生或按本合同说明与既有兼容投影之间的关系。
- 复用当前 JSONL/SQLite 迁移和文件安全合同。升级旧会话格式必须幂等、有校验、保留原始用户/助手文本、工具协议、活动、用量、项目绑定、归档状态和账户/App Owner；未完成的副作用仍须显示结果未确认，不能自动重放。
- 允许修改：`packages/core/session/**`、`packages/session/session-persistence-jsonl/**`、`packages/core/agent-loop/**`、`packages/api/session-controller/**`、直接相关的 `apps/cli/tests/**`、本包 README、`docs/PROMPTS.md`、`docs/系统总体架构.md`、`docs/开发计划.md` 与必要的 Agent 交付事实文档。新增文件须落入上述职责边界。
- 若复用 DSH MIT 代码，保留其版权与许可通知并记录适配文件；若按行为重新实现，保留准确的上游来源/版本与行为差异说明。`H:\deepseek-harness` 为只读参考仓库。

### 禁止修改

- 不修改或复制 DSH UI，不把 LFAA UI 改成 DSH 工作台，不在本轮迁移 DSH 的其它 Harness 包或新增第二套 Session/Agent Loop/Provider/身份/权限/节点服务。
- 不移除或覆盖当前工作树已有改动，不删除或重写用户会话数据，不静默丢弃旧事件、不降低格式校验、不对已有未确认 Tool/Daemon 副作用自动重放。
- 不改变认证授权和账户/App/项目/节点隔离；不让 DSH/第三方 Client 插件自动获得会话历史、原始模型工具参数或写权限。
- 不新增依赖、设置项、外部服务、发布/部署行为或不相关清理；所有构建产物仅写仓库根 `dist/`。

### 验收条件

- 针对 Session 内核的长期回归覆盖：序号/事件不可变与拒绝损坏载荷、Surface 消息投影、请求/Tool 历史重建、fork 精确边界、未完成 Tool 的中断闭合、写入/恢复/迁移幂等及账户/App 隔离；所有数据均使用隔离测试目录/账户。
- Agent Loop 的新增事件来自实际运行边界；刷新 UI 只恢复展示，不创建新 Run 或重复执行 Tool。新写入及历史数据恢复结果与现有 LFAA UI/API 兼容。
- 直接相关 Session、JSONL、Agent Loop、Session API 回归与包构建通过；Control Plane/Web 构建、`workspace-preflight` 和 `git diff --check` 按变更范围执行并记录。确认产物位于根 `dist/`。
- 报告事件增量派生/缓存、写入订阅和恢复工作量证据；明确未执行的 Provider、登录浏览器、桌面、Daemon 和真实副作用验收，不能以构建代替。

### 实施记录

- 2026-10-04：用户确认“完整复刻 Session 内核”。在现有 LFAA `lfaa-session`、Agent Loop 与 `session-persistence-jsonl` Owner 内完成 LFAA 适配：新增严格事件快照/连续序号、增量 Surface append/闭区间 replace/来源引用、请求 Header/Context 折叠、历史与动态 Tool History、真实成功/失败模型流、精确前缀 fork、预发布/发布生命周期、未决 Tool 修复、旧消息/项目/用量幂等导入；JSONL 是唯一事件日志，账户/App/API/UI Owner 不变，未改 UI/设置或迁移用户数据。适配边界：LFAA 使用 1 起始序号、UUID 与 ISO 时间；未接入 DSH Cordis SessionProvider 和 plugin-owned message projection，LFAA 当前没有对应 Session Event 扩展 Owner。
- 验证：Session/JSONL 回归 9/9、既有 `file-storage` 回归 6/6、`agent-runtime` 回归 1/1 分项通过；Agent Runtime 曾在前次运行间歇失败，单独重跑通过。`core/session`、`session-persistence-jsonl`、`core/agent-loop` 三个包构建、`tsconfig.host.json` 类型检查、Control Plane 构建、`git diff --check` 与新增文件行尾检查通过，产物位于根 `dist/`。`workspace-preflight` 脚本缺失，未运行；未改 UI，Web 构建未运行；真实 Provider、登录浏览器、桌面和 Daemon 副作用未验。性能边界：SessionStore LRU 最多 32 个实时对象，Surface/事件历史保留完整且随会话增长；本轮没有大型真实会话的时间/内存曲线测量。

## LFAA-HARNESS-DSH-CAPABILITY-PARITY-01：DSH 非界面能力完整复刻与优化路线

### 用户目标

以 DeepSeek Harness 的包能力为完整参照，将全部非界面运行能力纳入 LFAA 开发进度计划，按依赖、安全风险和用户价值排序实施；适配 LFAA 的唯一责任归属并优化性能、安全与可维护性。不得复刻 DSH 的界面页面、组件、布局或样式。

### 当前合同

- 本任务是路线登记，不授权本轮实现包能力。上游目录以 `docs/harness-packages.md` / `docs/harness-packages.json` 所登记的 316 个 DSH 两级包为基线；DSH 对照版本为 `639ed015397290b3745d163aafe02ffee4aa3f84`。清单中的 `implemented` 只说明 LFAA 已有源码或装配，不等于完成上游行为对齐或真实验收；`placeholder` 不得描述为可用。
- 产品保持 LFAA 自有 Harness。目标是能力与行为对齐，不默认逐行移植上游实现；复用上游实现或依赖须核实许可、版本、维护状态和运行时兼容性。LFAA 的账户、应用（App）、工作区（Workspace）、权限、设置、会话（Session）、主机/守护进程（Host/Daemon）与业务服务继续由现有唯一责任归属管理，不创建第二套 Harness、身份、会话、权限或业务执行服务。
- 必须贯彻“LFAA-Harness 万物皆插件”：除启动、插件装配、生命周期调度与权限隔离所需的最小 Harness 内核外，所有可用能力都作为 LFAA 第一方插件或能力包登记、组合和运行。宿主内核只提供加载、协调、隔离与生命周期机制，不藏入绕开插件登记的平行业务实现；各插件仍调用唯一业务、数据、设置和执行责任归属，遵守现有认证、授权和节点边界。纯内部库可作为插件依赖，但不得借此把可用产品能力移出插件体系。
- 界面排除范围是 DSH 页面、React 前端框架组件、布局、主题/样式和纯展示模块。底层服务、状态模型、程序接口（API）/远程调用、客户端传输与模块生命周期、工具/命令、设置行为和被界面调用的业务能力仍属于目标；由 LFAA 现有界面和设置中心承载用户交互，需要新增界面时实现 LFAA 原生适配，不复制 DSH 视觉实现。
- 优先级按依赖先后、安全前置和通用用户价值确定：P0 Harness 运行时/数据/权限基础；P1 智能体、模型、上下文和通用认知工具；P2 本机文件与进程执行及通用工程能力；P3 多智能体、远程集成、自动化与扩展互操作；P4 DSH 实验性能力。`util`、`runtime-diagnostics` 与 `test-support` 是跨阶段支撑，测试支持不得进入产品运行树。详细分组顺序登记在 `docs/开发计划.md`。
- 本次文档目标入口：`docs/开发计划.md` 的 Harness 路线和待办索引；只调整路线，不改产品运行入口、代码、数据、设置或权限。未来实现仍按对应任务合同分别记录 Web/Control Plane、Daemon、Desktop 或其他真实运行入口。
- 当前责任归属以 `docs/系统总体架构.md` 和源码为准：`boot/bundle` 负责装配，`core` 负责 Harness 核心，`api/host` 负责主机能力和认证通信，`client` 负责浏览器运行时，领域包负责业务和执行，Daemon（守护进程）负责节点真实操作。未来每个阶段开始前要按目标包确认实际调用链和唯一责任归属。
- 本路线新增或改写的计划、合同、包说明和交付说明正文使用简体中文；包名、路径、代码标识、协议名及产品专名保留原文，首次出现的专业概念应有中文解释。
- 本轮设置中心盘点结果：不增删或修改设置项。未来每项能力实施前，必须检查相关配置的权威 Owner、默认值、服务端校验、持久化和前端映射；缺少配置时先独立登记设置中心合同。

### 允许修改

- `docs/开发计划.md`：将 DSH 非 UI 能力完整度列为顶层执行主线，登记 P0–P4 优先级、每阶段能力范围、优化重点和完成条件，并新增待办编号。
- `docs/系统总体架构.md`：记录 LFAA-Harness“万物皆插件”原则及最小运行内核边界。
- `docs/PROMPTS.md`：登记本路线任务索引与当前合同。

### 禁止修改

- 不实现或重构任何运行时代码，不更改 `docs/harness-packages.md` / `.json` 的包状态，不增删包目录，不安装、更新或移除依赖。
- 不修改 DSH 仓库、LFAA Profile/Bundle、Settings、Session 数据或第三方插件运行数据；不启动、重启或停止 Web、Control Plane、Daemon、Desktop、游戏实例或其他服务。
- 不复制 DSH UI，也不把“目录有代码”“包能构建”或“插件可加载”写成能力已等价完成。
- 不把实验性 DSH 能力标为稳定支持；不把测试设施装入产品运行树。

### 验收条件

- 开发计划新增 P0–P4 路线，覆盖 316 个上游目录的非 UI 运行能力；每个 DSH 包在后续实现合同中可映射到阶段、LFAA Owner、设置/数据/权限归属和真实验收，不存在未归类能力。
- 路线与系统架构一致地落实“万物皆插件”，明确最小 Harness 内核边界，并要求全部可用能力纳入插件登记、组合和生命周期管理。
- 本路线新增或改写的文档正文使用简体中文；保留的包名、代码标识和专有名词有必要的中文释义。
- 明确排除 DSH UI 呈现实现，同时纳入这些界面背后的服务、API、状态、工具、设置和非视觉运行时；LFAA 已有业务能力优先复用或优化，不因对标 DSH 而重复实现。
- 路线明确每阶段的性能、安全、可维护性验收、真实环境验证边界、实验能力状态和“未实现不得宣称可用”的状态规则。
- `LFAA-HARNESS-01` 的目录登记状态与本路线能力状态严格区分；`LFAA-SESSION-KERNEL-01`、`LFAA-HARNESS-PLUGIN-CORE-01` 等现有合同保留原 Owner 和范围。
- 文档差异、Markdown 结构和路径引用检查通过；本次不运行产品测试或构建。

### 实施记录

- 2026-10-04：用户要求把 DSH 全部非 UI 能力按优先级复刻并优化，并明确 LFAA-Harness“万物皆插件”及文档使用中文。本合同只负责将完整路线和架构约束写入文档；包能力实现与真实验收仍待后续阶段合同。

## LFAA-HARNESS-DSH-CORE-01：DSH Core 能力的 LFAA 适配

### 用户目标与授权

- 用户明确要求以 `H:\deepseek-harness\packages\core` 为参考，把 DSH Harness 核心能力实现到自有 LFAA-Harness，并登记版权/许可来源。
- 用户确认采用“按 LFAA 现有 Owner 适配”：保留 LFAA 会话存储、设置、权限和工具执行归属；不为追求目录或接口相同而复制第二套基础设施。
- 参考版本：DeepSeek Harness `0.2.0-rc.2`，提交 `639ed015397290b3745d163aafe02ffee4aa3f84`。上游根 LICENSE 与 core 子包元数据均标为 MIT，版权所有者为 DeepSeek。

### 运行入口、Owner 与设置

- 运行入口：`pnpm lfaa web` 启动的 Control Plane；后台 AI Run 仍由 `packages/core/agent-loop` 驱动。
- Agent/Loop Owner：`packages/core/agent`、`packages/core/agent-loop`；认证与 Run API 继续归 `packages/api/session-controller`。
- Session Owner：`packages/core/session`；持久化由 `packages/session/session-persistence-jsonl` 的既有 JSONL 事务日志负责，SQLite 只保留当前索引/授权查询所需投影。具体 Session Kernel 能力与数据兼容条件继续受 `LFAA-SESSION-KERNEL-01` 约束。
- Model Owner：`packages/settings/settings` 提供账户、当前激活模型及模型能力；Core 不保存第二份默认模型或密钥。
- Tool Owner：`packages/core/tools`、`packages/interaction/permission-presets` 与各领域服务/Daemon；可见范围不替代执行时的认证、授权、参数校验和审批。
- 设置盘点：沿用 AI 与模型、AI Runtime、Plugins、项目权限模式、跟进方式和外观设置；本任务不新增/改默认值/重置设置或增加界面。

### DSH Core 到 LFAA 的实现映射

- `agent` / `agent-loop`：复用 LFAA 后台 Run、排队/steer、取消、结果订阅和子 Agent；不另建模型客户端、Session 服务或 Agent Loop。
- `session`：沿用 LFAA Session 与 JSONL 日志、账户/App 隔离及 UI/API 投影；按 `LFAA-SESSION-KERNEL-01` 补齐可适配的事件、历史重建和恢复能力，不迁移用户数据到新根目录。
- `tools`：复用真实 LFAA 工具注册、MCP/项目工具、Daemon/领域 Owner 和权限审批；扩展可见性不成为授权。
- `scope`：实现并使用统一的 App/子 Agent 工具可见范围过滤；过滤只限制暴露面，不更改业务授权规则。
- `agent-default-model`：把运行模型解析集中到 Core 适配包，但唯一数据来源仍为设置中心的 `resolveActiveAiModelConfiguration`。
- `agent-tool-presentation`：将真实已登记工具映射为 Provider 原生 function schema。当前只实现 LFAA 已接入的 native function calling。
- `system-prompt`：把现有固定身份/输出、权限、App、扩展提示词和领域运行上下文按确定顺序组合，保留现有安全文本与当前 LFAA Prompt Owner。
- PTC/`run_code`、双呈现模式和 DSH 私有 Agent/Session API 不在本轮接入；当前没有对应的 LFAA 隔离运行时，不得展示或宣称可用。

### 允许修改

- `packages/core/scope/**`、`agent-default-model/**`、`agent-tool-presentation/**`、`system-prompt/**`：实现上列 LFAA 适配包、中文包说明与导出。
- `packages/core/agent/**`、`agent-loop/**`、`session/**`、`tools/**`：接入作用域筛选、模型选择与提示词/工具呈现；保持现有接口与数据兼容。
- `packages/session/session-persistence-jsonl/**`：仅在落实 `LFAA-SESSION-KERNEL-01` 所需时改动既有日志 Owner。
- `tsconfig.host.json`、`tsconfig.client.json`：登记新工作区包的类型解析路径。
- `docs/harness-packages.md`、`docs/harness-packages.json`、`docs/系统总体架构.md`、`docs/开发计划.md`、`docs/PROMPTS.md`、`THIRD_PARTY_NOTICES.md` 与必要的包说明/锁文件。

### 禁止修改

- 不改 DSH checkout，不复制 DSH UI，不复用未核验/未登记的运行时代码，不接入 PTC 或未经隔离的动态执行。
- 不新建 Provider、Agent Loop、Session 根目录、数据库/会话表、身份、权限、审批、Daemon 执行服务或重复的模型设置。
- 不更改用户会话数据、现有 API 的账户/App/项目隔离、三个权限模式、EULA 确认或现有 LFAA 工具风险。
- 不添加设置、外部依赖、部署/发布动作或无关重构；构建只输出到根 `dist/`。

### 验收条件

- 新增 Core 包均有真实调用方，且不会因单纯目录/状态存在而宣称支持 PTC；范围过滤不能绕过工具执行权限。
- 默认模型、提示词顺序、native 工具 schema、会话恢复均沿用各自唯一 Owner；启动/卸载清理与账户/App 隔离保持不变。
- 直接相关包构建、Control Plane 类型/构建和 `git diff --check` 通过；产物只位于根 `dist/`。真实 Provider、浏览器、Daemon 和副作用工具未实测时如实标明。
- 性能记录静态工作量/内存边界；没有实际浏览器帧时间数据时标为未测。
- 版权说明准确指出 DSH/DeepSeek、MIT、来源版本/提交，并区分引用与实际复制的代码；本轮若无复制代码，不把 LFAA 新代码错误标为 DeepSeek 版权所有。

### 实施记录

- 2026-10-04：用户确认按 LFAA 现有 Owner 适配。本轮新增 Scope、默认模型适配、原生工具呈现和 System Prompt 组合包，并接入 Agent/Agent Loop/Tools/Session 的现有实现；会话事件继续由唯一 Session/JSONL Owner 持久化。记录 DeepSeek `0.2.0-rc.2` / `639ed015397290b3745d163aafe02ffee4aa3f84` 的 MIT 版权与许可，不复制上游源码。8 个直接包构建、`tsconfig.host.json` 与 `tsconfig.client.json` 类型检查及 `git diff --check` 通过；Control Plane 正在运行，因此未覆盖其 `dist/apps/control-plane` 产物。当前 checkout 未提供 `workspace-preflight` 命令或脚本，无法运行；自动化测试未运行，真实 Provider、浏览器、Daemon 与 PTC 未验/未接入。性能静态边界：SessionStore 最多缓存 32 个 Session，单个会话的权威历史保留完整并随历史增长；未测浏览器帧时间或真实会话规模。

## LFAA-HARNESS-DSH-P0-01：完成 DSH 非界面能力路线的 P0 阶段

### 用户目标与授权

用户明确要求先完成 P0，并进一步澄清：DSH 是安全、性能、可维护性和能力设计的参考，不是要求逐包照搬或重构 LFAA。目标是沿用 LFAA-Harness 的插件架构和唯一 Owner，保留用户认可的现有功能与差异化；只把适合 LFAA 场景的能力复用或适配为插件，不复刻 DSH 界面。

### 运行入口、责任归属与设置

- 主要运行入口为 `pnpm lfaa web` 启动的 Control Plane；按目标包包含客户端运行时、API、Core、存储、设置和插件装配链。Daemon 仅在本阶段确有 P0 接口责任时纳入，不替代现有节点执行责任归属。
- `docs/开发计划.md` 的 DSH P0 包索引是能力盘点清单，不自动等于 LFAA 的功能待办。每项先标明 LFAA 场景、Owner、决策（复用/适配/暂缓/不适用）及依据；只有 LFAA 确有缺口且纳入其产品目标的能力才进入 P0 验收。`packages/client/ui-*` 不作为 DSH 复刻目标；LFAA 现有界面与产品功能按自身需求继续维护。
- `LFAA-HARNESS-DSH-CORE-01`、`LFAA-SESSION-KERNEL-01` 及当前已有相关任务合同继续拥有其登记的细分范围；本合同统筹 P0 完成状态，不覆盖或抹除它们的未提交实现。开始改动任何已有变更文件前须先对照其当前差异，保留可用实现并补足直接缺口。
- 使用现有设置中心与数据责任归属，不预设新增设置。每个改动包须核实入口、调用方、身份/账户/App/项目/节点隔离、默认值、持久化、服务端校验和前端映射；新增配置必须先有独立设置合同。
- 产品能力以 LFAA 第一方插件/能力包登记并受统一组合及生命周期管理。只有加载、装配、调度、隔离所需的最小 Harness 内核可以保留为宿主机制；工程测试支撑不作为可用产品能力，也不得进入产品装配。

### 逐包完成策略

- 先依据 DSH 固定提交 `639ed015397290b3745d163aafe02ffee4aa3f84`、当前 LFAA 源码、现有任务合同和 `docs/harness-packages.json`，为 P0 索引中的能力登记 LFAA 场景、唯一 Owner 与决定：插件化能力、已有等价实现（附调用链证据）、暂缓或不适用。目录存在和 `implemented` 状态不能作为等价证据；不得为了包名一一对应而重写已稳定的 LFAA 功能。
- 对每项 P0 能力采取“优先复用唯一责任归属；缺失时在其 Owner 内插件化实现；不另建第二套身份、设置、会话、权限、API 或业务执行服务”。纯工具库作为插件依赖时，要说明被哪个插件能力消费。
- 不要求机械复制上游包目录或代码；但不得把真实 P0 能力标成“已复用”而没有源码入口、调用方、回归或真实运行证据。确属重复、弃用或超出产品边界的能力，须记录依据并在包清单中保持准确状态。
- 先完成 LFAA 场景筛选和设置/数据/权限盘点，再按依赖顺序完成已选 P0 能力。安全、性能、可维护性可借鉴 DSH 的成熟做法，但必须符合 LFAA 当前接口和责任边界。所有文档正文使用简体中文，专业标识首次出现应有中文解释。

### 允许修改

- 开发计划 P0 索引列出的职责包；`packages/client` 仅允许 `web`、`modules`、`connection`、`store`、`hmr`、`locale` 等非界面包，禁止修改 `packages/client/ui-*` 来复制 DSH 界面。
- `apps/cli/tests/**` 中与 P0 直接相关的长期回归、上述包的 `README.md`、`docs/harness-packages.md` / `.json`、`docs/harness-p0-audit.md`、`docs/系统总体架构.md`、`docs/开发计划.md`、`docs/PROMPTS.md`，以及新增工作区包所需的类型路径/锁文件登记。
- 为贯彻“万物皆插件”，允许 `packages/core/tools/**` 作为 `interaction/tool-ask-user` 插件的既有执行工具注册扩展点；仅扩展工具元数据和每轮调用上下文，不迁移业务 Owner、不改变权限风险或现有工具授权。
- 为补齐 P0 凭据引用能力，允许新增 `packages/credentials/credentials/**`，并在 `packages/settings/settings/src/index.ts`、`src/service.ts` 及包元数据中由设置中心注册其加密 AI 账户适配器；允许将 `packages/core/agent-default-model/**` 改为消费该凭据服务的第一方插件，并调整 `packages/core/agent-loop/**`、`packages/bundle/base/**` 接线。密文和密钥文件仍只由设置中心持有，禁止增加第二份秘密存储或把秘密返回到浏览器。
- 为补齐 P0 通用凭据记录与授权流程，允许新增 `packages/credentials/credential-flows/**` 第一方插件；该包与现有负责登录 Cookie/角色校验的 `packages/credentials/authorization/**` 完全分离。扩展 `packages/credentials/credentials/**` 提供有界的 API Key/授权记录模型及记录变更事件；扩展 `packages/settings/settings/src/index.ts`、`src/service.ts`、包元数据和 `packages/storage/storage-domain/src/configuration.ts`，将按账户与插件所有者隔离的记录以 AES-256-GCM 密文写入 Settings 唯一配置存储，并继续使用其现有密钥文件；扩展 `packages/bundle/base/**`、新增 `apps/cli/tests/credentials-authorization.test.mjs` 及相关工作区包路径/锁文件登记。凭据 Flow 插件负责插件自有流程、单凭据单次尝试、取消/卸载清理、请求交互回调及“本次尝试确实提交记录”确认；不得自行创建登录提供方、API/UI 路由或用户设置，具体提供方与交互入口须由后续 P0 合同增补。
- 用户后续明确 DSH 包仅作参考，故 DeepSeek Platform 登录、赠金和设备账户是可选产品能力，不因上游存在或目录列为 P0 就自动实施。LFAA Settings 已持有 Provider API 账户/密钥；只有确认了 LFAA 用户场景和唯一 Owner 后，才新增相关插件与 API。若实施，仍必须遵守前项关于加密凭据、账户隔离、state/PKCE、回调和不向浏览器暴露秘密的边界。
- 根 `.gitignore` 对名为 `credentials` 的目录有运行数据排除规则；允许仅为 `packages/credentials/` 下的第一方源码包增加精确例外，并继续忽略其中的 `node_modules`、密钥及运行数据，避免插件源码无法进入版本控制。
- 为兼容新旧 Host 构建交错期间的登录态恢复，允许 `packages/client/connection/**` 在 Typert Remote 明确返回路由 `404 not_found` 时读取原有认证 `/auth/me` 路由；新 Host 仍优先走 Typert，其他错误不得降级。Host 路由仍由 Identity Owner 认证，兼容成功后可在 Host 升级并验收完成时移除。
- 为恢复 P0 Host 构建门禁，允许对既有 `packages/document/writing/src/service.ts` 中 `DEFAULT_WRITING_SPECIALIST_ID` 的未使用导入做无行为删除；不得借此扩展写作领域能力。
- 为不覆盖活动中的 Control Plane 产物，允许在 `scripts/build-harness.mjs` 增加显式 `host-staging` 构建目标，完整产物只能写入 `dist/.tmp/p0-control-plane/`；默认 `host` 目标、运行指纹登记和现有发布入口语义保持不变。
- 为验证 Web 构建而不误登记活动构建指纹，允许 `apps/web/vite.config.ts` 仅在输出目录等于默认 `dist/apps/web` 时登记运行指纹；本次完整 Web 构建输出到 `dist/.tmp/p0-web/`，不得覆盖默认 Web 产物或登记为活动构建。
- 为让审批等待脱离 AI 循环的定时轮询，允许新增 `packages/interaction/user-approval/**` 作为通道中立的一次性变更通知插件，并接入 `packages/core/agent-loop/**`、`packages/api/session-controller/**`、`packages/bundle/base/**`、`packages/bundle/web-app/**`；审批记录、权限策略和最终状态仍由 `packages/interaction/permission-presets/**` 唯一持有，通知服务不得创建第二份审批状态或绕过认证授权。
- 为按 P0 优先级建设类型化 Remote 基础，允许实现 `packages/typert/protocol/**`、`registry/**`、`loader/**`、`generator/**`，补充 Host/Client 类型路径、相关 Bundle 装配、`apps/cli/tests/**` 的长期回归与中文能力文档。协议与注册表不得接管 API 路由、认证授权或业务数据；生成工件须由真实 Host/Client 消费，未接入的部分保持待办状态，不得仅凭包可构建标为完成。
- 为完成 Typert Remote 的第一个真实 Host/Client 闭环，允许扩展既有 `packages/api/gateway/**`、`packages/api/account-controller/**` 与 `packages/client/connection/**`：Gateway 只提供登录认证后的传输适配，Account Controller 继续负责账户读取与方法授权，Client Connection 复用现有同源 Cookie/API 错误处理。允许调整 Web Bundle 对上述插件的依赖装配。该切片不迁移其他 REST/Socket 接口，不创建第二套认证、账户或业务服务；先完成插件级类型描述和真实 Client 调用，再继续生成器对更多包的接入。
- 为让 Typert 生成器作为工程期能力运行而不进入产品运行树，允许新增 `packages/typert/generator/**` 与中文说明，并对 `scripts/harness-workspace.mjs`、`scripts/build-harness.mjs` 增加可复用且可回归的按包元数据排除工程期支持包过滤；生成物只覆盖登记的源码目标，`--check` 模式用于验证其与源合同一致。该生成器先服务账户 Remote 的真实 Host/Client 双端合同，账户 Owner 保留运行时精细校验。
- 为完成通道中立的用户提问服务，允许新增 `packages/interaction/user-questions/**` 插件，并接入既有 `packages/core/agent-loop/**` 与 `packages/bundle/base/**`；Agent Run 仍拥有当前运行的问题状态、HTTP 回答和 Session 记录，服务只登记可撤销回答者并按账户/App/Run 隔离分派，不增加持久化、设置或 UI。
- 只有在 P0 实现确实需要、且先登记 Owner 与修改理由后，才允许扩展到直接依赖的第一方职责包；每次扩展先更新本合同的准确路径边界。

### 禁止修改

- 不修改 DSH checkout；不覆盖、回退、清理或重写本工作树已有改动，不修改 P1–P4 能力或无关领域 UI。
- 不新建平行身份、凭据、权限、审批、设置、Session、数据库、API/Remote 或 Agent 执行服务；不绕过账户/App/项目/节点边界、认证、授权、校验或 EULA。
- 不增添未经独立设置合同登记的配置，不因对标而安装未核验依赖；不把测试支撑装入发布运行树，不把占位、构建通过或包可加载写成能力等价。
- 不启动、停止或重启正在运行的 Web、Control Plane、Daemon、Desktop 或游戏实例；构建产物只能写入仓库根目录 `dist/`。

### 验收条件

- 开发计划 P0 索引中的每项能力均有 LFAA 场景、唯一责任归属和复用/适配/暂缓/不适用决定；选入的必需能力有实现或调用链证据，暂缓项不冒充已完成。
- 选入 LFAA P0 的产品能力纳入第一方插件/能力包组合和生命周期，除最小宿主内核与工程支撑外，无隐藏的平行业务路径；安装、启停、失败清理和卸载不遗留订阅、路由、文件句柄或执行资格。不得为了上游包名覆盖重写现有 LFAA 能力。
- 直接相关长期回归覆盖账户/App/项目/节点隔离、权限拒绝、持久化/迁移、装配/卸载与错误恢复；目标包和相应 Control Plane/Web 构建通过，产物只写入根 `dist/`。
- 通用凭据记录在进程重启后可回读，磁盘只见密文；记录按账户、插件所有者和记录 ID 隔离，普通配置读取不返回记录载荷；授权 Flow 不能跨插件写入记录，未在本次尝试提交记录时不得报告授权成功，重复尝试、取消和插件卸载均释放活动状态与回调。
- 记录工作量/时延/数据规模证据；真实登录浏览器、模型服务商、桌面、远程节点或 OS 沙箱未验时逐项标明未验，不以构建替代。
- 更新包清单和架构/开发计划事实；`git diff --check` 通过。仅当已选入 LFAA P0 的能力满足上述条件、暂缓/不适用项有依据且没有未解决的项目运行阻塞时，才将本合同与 P0 阶段标为完成。

### 实施记录

- 2026-10-04：用户要求先完成 P0。已按计划索引核对 61 个上游包目录：其中 34 个有实现源码/装配登记、27 个仍占位；逐包职责、LFAA Owner、复用证据和真实缺口记录于 `docs/harness-p0-audit.md`。包状态仅代表源码存在，不代表能力等价，P0 仍进行中。
- 2026-10-04：补充沙箱策略与执行结果合同、受管子进程参数合同，并把 `interaction/tool-ask-user` 作为第一方插件装入基础 Bundle；Agent Loop 改用注册工具和既有 Run 问题通道。6 项定向回归通过；包构建、全量类型检查和最终差异检查结果待本轮收尾登记。没有新增或修改设置；没有真实 OS 沙箱/进程提供方或登录验收。
- 2026-10-04：新增 `lfaa-credentials` 引用注册表；设置中心以只读来源暴露按用户和账户 ID 校验的已加密 AI 密钥，`lfaa-agent-default-model` 改为必需插件并由 Agent Loop 注入消费。账户加密存储仍是设置中心唯一 Owner，未新增设置和秘密副本。该来源的静态消费者白名单已实际拒绝未获准的插件，但通用凭据记录/授权流程、DeepSeek Platform 登录、Typert 和 Storage Hub 当时仍未实现，P0 继续进行中。
- 2026-10-04：新增 `lfaa-storage-hub` 纯注册插件；现有 JSON 原子文件与 SQLite 单例连接分别通过后端适配插件注册，支持单文档/逐记录 KV、版本拒绝、插件卸载撤销和逐记录备份，不迁移设置、账户或 JSONL Session Owner。隔离回归 2/2、Host 类型检查、storage Hub/JSON/SQLite/base 包构建通过，产物均在根 `dist/packages/`。设置中心未新增或修改配置；Control Plane/Web 组合构建未运行，避免覆盖当前运行服务正在使用的产物目录；P0 仍进行中。
- 2026-10-04：修复真实启动顺序中的 v40 迁移缺口：SQLite 插件先登记后端，KV 首次打开时再验证迁移；`storage-domain` 在会话 JSONL 迁移完成后推进 SQLite 至 v41。隔离存储与 Agent Run 合并回归 11/11、Web Profile 启动/HMR 认证回归 1/1、Carrier 路由回归 2/2 通过；Host 类型检查及受影响包构建待本轮复核。启动失败现列出插件状态和 Cordis 失败原因。Control Plane/Web 构建仍未运行，避免覆盖活动产物；未新增或修改设置，P0 未完成。
- 2026-10-04：复核 Host/Client 类型检查均通过；Storage Hub、SQLite、Storage Domain、App Boot 包构建通过。新增 `host-staging` 并完成 Control Plane 隔离构建；Web 暂存构建 2042 个模块成功，产物分别位于根 `dist/.tmp/p0-control-plane/`、`dist/.tmp/p0-web/`。修正 Vite 指纹钩子为读取最终解析输出目录后再次构建；活动 `dist/apps/web/build-state.json` 与 `index.html` 的 SHA-256 和修改时间在暂存构建前后完全一致。合并的凭据、交互、沙箱/子进程、存储、Agent Run、Profile 和 Carrier 回归 14/14 通过。Vite 报告最大 JS 分块 1,362.43 kB（gzip 390.80 kB），当前只记录该既有 UI 构建警告，不在本 P0 变更中改 UI。没有新增或修改设置；Control Plane/Web 浏览器、真实 Provider、桌面、Daemon 与 OS 沙箱验收未做。Typert、通道中立审批/问题服务、DeepSeek Platform 登录和 Session 投影/检查点等能力仍未完成，P0 继续进行中。
- 2026-10-04：新增 `lfaa-user-approval` 通知插件；Agent Loop 在等待前注册账户/审批 ID 监听、重读 `permission-presets` 唯一持久化状态，Session Controller 只在审批决定提交后唤醒；移除 800 毫秒 SQLite 轮询，不改变审批策略、参数哈希、用户界面或秘密数据。新增隔离、超时、取消、卸载和真实 Agent 写工具审批回归，合并 P0 回归 15/15；Host 类型检查及一次性审批、权限、Agent Loop、Session Controller、Base Bundle、Web Bundle 六个包构建通过。Control Plane 隔离构建通过；Web 隔离构建 2044 个模块通过，活动 Web 指纹文件和入口文件在最终构建前后哈希与时间戳一致。此前一次快照与并行 `lfaa web` 启动重叠，待启动完成后已重新核验。没有新增或修改设置。通用审批应答者/其他通道适配、Typert、用户问题服务、DeepSeek Platform 登录、通用凭据授权持久化、Session 检查点/投影、真实 Provider/桌面/Daemon/OS 沙箱和浏览器交互验收仍未完成；P0 继续进行中。
- 2026-10-04：P0 Typert 首批运行时落地：新增协议/有界 JSON 校验、Cordis 注册/校验/本地调用与按 Fiber 撤销的插件加载桥接；两个定向回归通过，Host 类型检查及 protocol、registry、loader 三个包构建通过。基础 Bundle 加载 registry 和 loader，未新增设置。Client 类型检查未通过，报错位于本工作未修改的 `packages/client/ui-settings/src/SettingsPage.tsx:2760`；Control Plane/Web/浏览器端到端未因此构建。TypeScript 生成器、`api/remotes` 与真实 Host/Client 仍未接入，故 Typert 和 P0 均保持进行中。
- 2026-10-04：补齐 Typert 第一个真实 Host/Client Remote 闭环。`api/gateway` 通过现有登录认证挂载一元调用路由，`api/account-controller` 将原 `/auth/me` 读取迁为带逐方法授权和严格输入/输出解析的 `auth/me` 插件贡献；Host 和 Client 共用 `api/account-controller/src/client-contract.ts` 的静态方法类型，`client/connection` 复用现有同源 Cookie/API 错误链。Host/Client 一元 JSON 输入输出总量限制为 4 MiB；断连会取消等待，业务副作用是否可撤销仍由各方法 Owner 定义。隔离 Web Profile Host/Client 回归及此前 P0 定向回归合计 19/19 通过；protocol、registry、loader、API Remotes、API Gateway、账户控制器、Client Connection 七包构建通过；Client 全量 TypeScript 检查与只含 P0 Host 包的隔离类型检查通过。最新全量 Host 检查被 P3 `packages/computer-use/computer-use/src/index.ts` 中未声明 `desktopRevision` 的错误阻断，该包不属本合同，本轮未改。`git diff --check` 通过，构建产物仅位于根 `dist/packages/`。为恢复此前 Host 检查，只给既有 JSONL 重写实现补入缺失的 `randomUUID` 导入，没有改其会话语义。未改设置中心配置，也未覆盖运行中的 Web/Control Plane 产物。Typert TypeScript 生成器、流协议、其余 API/Socket 迁移仍未完成；Control Plane/Web 完整组合构建、浏览器 UI、真实 Provider、Daemon 与桌面验收未做，P0 继续进行中。
- 2026-10-04：新增 `lfaa-typert-generator` 工程期生成包及 `lfaa-user-questions` 回答者注册插件；账户 `auth/me` 生成描述符与 JSON Schema 并由 Host/Client 实际消费，`agent-run` 作为问题服务首个回答通道。P0 定向回归 26/26、生成物检查、P0 Host 隔离类型检查、Client 全量类型检查和 8 个包构建通过。没有新增或修改设置；其他 Remote/流、交互通道、平台登录、Session 耐久性、失败回滚及真实组合验收未完成，P0 继续进行中。
- 2026-10-04：新增 `apps/cli/tests/app-boot-rollback.test.mjs` 与 `apps/cli/tests/app-boot-plugin-runtime-rollback.test.mjs`，通过真实 Web Profile 验证启动失败清理、可选插件启用失败后回滚、跨进程恢复已保存的停用状态；隔离生命周期回归 2/2 通过。没有改运行服务或设置中心配置；禁用失败和手动重载失败分支仍未验，P0 继续进行中。
- 2026-10-04：新增 `lfaa-credential-flows` 插件并扩展凭据注册表，以 Cordis 活动插件身份绑定消费者、记录拥有者和授权尝试；Settings 复用现有加密配置文档和密钥文件，使用 AES-256-GCM 并将账户/插件/记录 ID 纳入关联数据。跨进程持久化、密文、账户/插件/引用隔离、篡改拒绝、Flow 并发/取消/卸载与本次提交确认回归 10/10 通过；六个直接包构建通过。没有新增设置或平台登录/API/UI 入口。DeepSeek Platform 提供方、其他交互通道、Typert 双向流、Session 检查点/投影及完整 Profile 组合验收未完成，P0 继续进行中。
- 2026-10-04：用户明确 DSH 仅作安全、性能、维护和能力设计参考，P0 必须按 LFAA 场景筛选，不得逐包复刻或重构已认可功能。将 DeepSeek Platform OAuth 记为暂缓，并撤销未接入的 Platform 包草案及锁文件条目；为 `packages/credentials/` 第一方源码包增加精确 Git 忽略例外，仍排除其中的依赖和密钥。排查截图中的登录恢复 404，确认当前 Vite Client 请求 Typert Remote，而运行中的旧 Host 仅有原认证 `/auth/me`；`loadCurrentUser()` 现在只在 Typert 明确返回 `404 not_found` 时回退旧认证路由，不对 401、断网或协议错误降级。`typert-gateway.test.mjs` 1/1 通过。直接读取本机代理确认旧 Host 两路由状态；当前 Edge 自动化没有可访问标签页，因此真实登录态页面恢复仍未验。没有重启 Web/Control Plane、没有改用户设置或覆盖运行构建产物；P0 继续进行中。
- 2026-10-04：按用户最新澄清完成 P0 场景审计与收口：LFAA 继续使用自己的 SSE、单一 Session/JSONL Owner、Settings 加密记录、permission-presets 授权和 WebServer/Carrier；DSH V0–V4 格式转换、无消费者的 Typert 双向流/Agent 命令/其他交互通道、第二投影 Owner 与持久投影缓存均不作为 P0，真实 OS 沙箱与本机/Daemon 进程提供方归 P2。为 `workspace-projects.test.mjs` 更新已过期的 SQLite 当前版本预期（38→43），保持历史 v37→v38 迁移用例不变。包内执行的 P0 回归 57/57、补充 Profile/承载/Workspace/Client/审批回归 27/27、数据目录回归 6/6 通过；95 个能力包构建、Control Plane 隔离构建、Client 全量 TypeScript 检查和 Web 隔离 Vite 构建通过。当前本机 Vite/旧 Host 组合在隔离浏览器中显示正常登录表单，原 `404 not_found` 错误不再阻断；测试浏览器没有用户登录态，用户 Edge 已保存会话未验证。`workspace-preflight` 脚本不存在，未运行；Web 构建仅有既有大分块警告。没有改 Settings 配置，没有停止/重启运行服务或覆盖 `dist/apps/web`、`dist/apps/control-plane`。LFAA 场景筛选后的 P0 完成；P1–P4 与所有真实 Provider/Daemon/桌面/OS 沙箱验收仍保持各自阶段状态。

## LFAA-WALLPAPER-ENGINE-COMPOSITING-01：LFAA 工作台壁纸合成与外观映射

### 用户目标

- 修复官方 Wallpaper Engine 在当前 LFAA 浏览器中已启用但壁纸层未能显示、AI Work 主面板未正确消费外观透明度/模糊的集成问题。LFAA 继续作为唯一产品、Profile、设置和工作台 Owner；复用上游插件播放与 UI。

### 运行入口、Owner 与设置

- 运行入口：现有 Web `5173/tasks` 通用任务 AI Work 与 `/apps/<app>/ai-work` 共用的工作台。
- 壁纸播放、`html` 级壁纸底色和 `body[data-we-wallpaper]` 活动标记由 LFAA Profile 中固定来源 Wallpaper Engine Client 提供；页面背景级联由 `packages/client/ui-theme`/`packages/client/ui-layout` 共同持有，AI Work 主面板由 `packages/client/ui-chat` 持有。
- 沿用 Settings Owner 的 `appearance.overlay`（默认 37，持久化且服务端校验）与 `appearance.blur`（默认 14）。`Workbench.tsx` 已分别映射为 `--settings-background-surface-opacity` 和 `--settings-glass-blur`。不新增设置、不重置账户偏好，也不将插件自己的配置迁入 LFAA Appearance。

### 允许修改

- `packages/client/ui-chat/src/ai-work-chat.css`：仅修复 Wallpaper Engine 活动时 AI Work 根面板消费 LFAA 表面透明度/模糊映射。
- `packages/client/ui-layout/src/workbench.css`：仅修复 Wallpaper Engine 活动时 `html` 根画布背景与负 z-index 壁纸层的合成级联。
- `docs/PROMPTS.md`：本合同及实际验收记录。

### 禁止修改

- 不改上游插件源码、安装 Profile、LFAA 插件适配器、插件启停状态、账户壁纸选择、播放列表、音量和 Appearance 设置值；不重新选择壁纸，不上传或改动媒体/Steam 数据。
- 不增加第二套背景/壁纸渲染器、Runtime、扩展槽或专属配置；不改变没有 Wallpaper Engine 时 AI Work 的既有表面外观。

### 验收条件

- Wallpaper Engine 活动时 `html` 根背景优先采用上游提供的壁纸底色令牌，负 z-index 媒体层在 LFAA 文档画布上可见；AI Work 主面板读取上述既有 CSS 令牌，透明度依 `appearance.overlay`、模糊依 `appearance.blur`。插件未活动时保留原始样式。
- 保留当前所选壁纸和运行中的 Vite/Control Plane，不重启服务、不改用户设置；通过真实浏览器确认壁纸可透过 AI Work 主面板可见，且文字与输入区仍可用。
- 运行直接相关的 Web 构建和最终 `git diff --check`；构建输出仅写入根 `dist/`。本任务不做帧时间测量，也不声称不同媒体类型均已验证。
- CSS-only 修复不添加订阅、计时器或 DOM 生命周期；不新增设置与持久化写入。

### 实施记录

- 2026-10-04 修复前真实浏览器观察：当前 Wallpaper Engine Client 已加载，`body[data-we-wallpaper]` 存在，工作区壁纸层及 1024×1024 预览图请求成功，图层 z-index 为 -2；但 `html[data-lfaa-bootstrap-theme="dark"]` 与 `:root` 的 LFAA 根背景规则优先于上游低特异性 `html { background-color: var(--we-wallpaper-underlay) }`，并且 `body:has(.workbench-shell[data-theme="dark"])` 以更高优先级将 body 背景设为不透明深色，因此负层壁纸仍被页面画布盖住。另有 `.workbench-shell[data-background-image="true"] .ai-work-chat { background: transparent }` 特异性高于先前新增的 `body[data-we-wallpaper] .ai-work-chat`，使 AI Work 根面板绕过 `appearance.overlay` 表面透明度。由此确认不是缺少 Slot；需修正 html/body 根画布背景级联，并让 AI Work 壁纸态选择器覆盖该透明背景规则。

## LFAA-KNOWLEDGE-LIBRARY-01：账户 Markdown 知识与方法库

### 用户目标与运行入口

- 为 AI Work 增加与 Skills、Prompts、Experts、Tools、MCP 同一能力管理入口的 Markdown 资料库。资料支持知识、用户 Skill、用户 Prompt、领域专家方法四种文本类型；可由用户上传，也可在用户明确要求时由对话总结并保存。
- 模型按任务需要搜索并读取少量资料，不把整个库注入系统提示词或每轮历史。搜索结果包含有限片段，读取工具有字符上限；正文只在模型实际调用工具时进入上下文。
- 支持连接账户已登记的 Workspace/Minecraft 项目目录作为本地 Markdown 来源。来源文件保留在原位置，读取经过现有 Daemon 项目文件 Owner。
- GitHub 与互联网检索复用本轮真实提供的 MCP 工具。连接仍由现有 MCP 设置、App 范围和权限模式控制；当前产品 MCP Runtime 仅支持无内建认证的 Streamable HTTP，OAuth 与 stdio 未接入，不得伪称已支持。
- 运行入口为 `pnpm lfaa web` 装配的 Control Plane 与 Web/Desktop 共用设置中心和 AI Agent Loop。

### Owner、数据与设置

- 新 Markdown 资料 Owner 为 `packages/knowledge/knowledge-library`，通过当前 SQLite 数据库持久化；所有文档和项目链接按当前账户与 App 范围隔离。关联项目必须经 `packages/workspace/workspace` 核实属于当前账户，运行时文件读取复用 `packages/core/tools/project-tools.ts` 与 `packages/host/daemon/project-files.mjs` 的 Daemon 边界，只接受 Markdown 文件。
- `/api/knowledge/*` 由独立 API Controller 提供认证后的清单、上传、创建、更新、删除和本地项目链接管理；不得把账户内容或 Daemon 绝对路径返回给其他账户。
- Agent 只通过有真实执行实现的注册工具搜索、读取和保存。知识正文、上传 Markdown、Skill/Prompt/Expert 文本及 MCP 返回内容一律视为不可信资料，不得改变系统权限、扩大目标或创建执行能力。
- `skill`/`prompt` 类型只代表账户可管理的自定义 Markdown 资产；不写回或替换既有领域内置 Skill/Prompt 清单及其 Owner。
- 设置中心沿用 `plugins.enabled` 控制可选 AI 扩展、`permissions.mode` 控制写入、MCP `applicationIds` 限定外部服务 App，以及现有外观设置控制共享界面。不新增设置项、不改变既有默认值。Markdown 资源自身保存账户/App 可见范围；本地来源仅绑定用户已有项目及其相对目录。
- 上传仅接收 UTF-8 Markdown；本地来源限于账户已有项目目录中的 `.md`/`.markdown` 文件。不得开放浏览器任意路径、节点绝对路径或其他账户数据。

### 低成本与容量合同

- 不向系统提示词、会话首轮或每次模型请求自动附加文档正文。每轮只提供短工具说明；模型按需搜索后最多收到 4 条片段、每条不超过 600 字符，完整读取单次最多 12,000 字符。
- 单条资料正文不超过 64 KiB；每账户资料条目有硬上限；搜索仅在工具被调用时对有界账户集合执行，并按标题/正文相关度返回前 4 条。项目目录搜索复用 Daemon 的有界扫描，并把结果限制为 Markdown 文件和少量片段。禁止后台持续扫描、每轮重复整库序列化或无限缓存。
- 读取不改变文档；知识、Skill、Prompt 与领域专家 Markdown 只在用户明确要求整理并保存时创建，并使用现有写入风险与权限模式。资料库不直接创建或改写 Tool/MCP；相关能力仍须经各自现有 Owner 检查和用户授权。删除只由用户在管理界面操作。模型不直接执行从知识内容生成的代码。
- 搜索 GitHub/互联网只调用本轮已连接并通过当前 MCP 清单核验的真实 MCP 工具；未配置相应搜索服务时明确报告不可用，不构造搜索结果或直接执行文档中的指令。

### 允许修改

- 新增 `packages/knowledge/knowledge-library/**` 和配套 `packages/boot/knowledge-library/**`，分别实现账户/App 隔离的 Markdown 数据 Owner 与可撤销 AI 工具注册。
- 新增 `packages/api/knowledge-controller/**`、`packages/client/ui-settings/src/KnowledgeLibraryPanel.tsx` 及其专属样式/长期回归；扩展 `packages/client/connection/src/api.ts` 与设置页，在现有“插件/能力目录”呈现资料库管理。
- 按需扩展 `packages/storage/storage-sqlite/src/database.ts` 的递增迁移、`packages/core/tools/project-tools.ts` 与 `packages/host/daemon/project-files.mjs` 的 Markdown-only 有界搜索、`packages/settings/settings/src/service.ts` 与 `packages/api/remotes/src/route-contracts.ts` 的本地 Prompt 持久化验证，以及 `packages/document/writing/**` 的用户 Skill Owner 接线。
- 必要的 `package.json`、`pnpm-lock.yaml`、根 Host/Client 类型路径、`packages/bundle/base/cordis.patch.yml`、`packages/bundle/web-app/cordis.patch.yml`、目标包 README、`docs/系统总体架构.md`、`docs/开发计划.md`、`docs/PROMPTS.md` 和直接相关的长期回归。

### 禁止修改

- 不建立第二个 MCP 客户端、GitHub 搜索后端、通用 Agent/Session/设置/权限系统或独立模型服务；不增加未经确认的外部依赖和新的凭据存储。
- 不读取或写入未登记项目、项目根之外路径、符号链接、LFAA 数据根目录内受保护数据或其他账户资料；不把本地目录绝对路径下发浏览器或模型作为操作授权。
- 不把 Skill/Prompt/Expert 的 Markdown 当成 Tool/MCP 可执行实现；Tool/MCP 仍须通过现有 Owner 的来源检查、授权和真实运行核验。不可用的类型保持不可用。
- 不将完整 Markdown 库放进系统提示词、每轮模型消息或浏览器缓存；不改变 `plugins.enabled`、权限模式、MCP App 范围、用户外观偏好或现有 MCP 身份认证能力。
- 不重启正在运行的 Web、Control Plane、Daemon、Desktop 或 Minecraft；构建输出只写根 `dist/`。

### 验收条件

- Markdown 上传、手工管理和对话保存可在账户/App 范围内检索、读取、更新和删除；另一账户及未授权 App 无法读取资料。重复 ID、超限正文、非 Markdown 上传和过期/离线本地来源均明确失败。
- 对话工具仅在 `plugins.enabled` 开启时提供。Skill/Prompt/Expert 作为用户 Markdown 文本按需读取；知识来源始终是不可信内容，写入审批遵循 `permissions.mode`，模型无删除工具或任意代码执行通道。
- 本地来源只对已登记 Workspace/Minecraft 项目进行相对路径读取；Daemon 拒绝路径越界、符号链接、非 Markdown 和受保护目录。当前节点离线或来源文件不存在时不返回旧内容。
- 模型工具 schema 与固定提示说明不包含资料正文；search 返回不超过 4×600 字符，read 不超过 12,000 字符；资料上限和目录扫描上限可测量，无后台轮询、无界队列或跨账户缓存。
- MCP 在线搜索使用当前已配置 App 范围内的真实工具；无相应 MCP 时如实说明。MCP 的 OAuth/stdio 及未经运行的 GitHub/网页服务不标为已接入。
- 相关数据库迁移、Owner/API/客户端定向构建和长期回归通过；实际登录后的设置界面上传/链接/删除、真实 Provider 工具调用、外部 MCP GitHub/网页搜索及目标 Daemon 浏览器验收分别记录，不以构建替代。Web 构建产物只写根 `dist/`；最终检查工作树差异并运行 `git diff --check`。

### 实施记录

- 2026-10-04：用户确认知识、Skills、提示词在明确要求时可直接保存；Tools 与 MCP 仍须由现有 Owner 检查和授权。
- 2026-10-04：完成 SQLite v42 迁移、账户/App 隔离的 Markdown Owner、认证 API、设置中心管理面板及四个按需 Agent 工具。资料正文不会自动进入提示词；搜索最多 4 条×600 字符，单次读取最多 12,000 字符，单账户资源上限 128。上传接受 UTF-8 Markdown；本地来源绑定当前账户已登记的 Workspace/Minecraft 项目，并通过 Daemon 对 Markdown 做有界搜索/读取。对话保存只接受用户明确要求，类型为知识、Skill、Prompt 或领域专家方法；不直接创建 Tool/MCP。
- 2026-10-04 验证：定向回归 2/2；Host 与 Client TypeScript 检查通过；storage SQLite/domain、knowledge Owner、core tools、boot runtime、API controller、Daemon、client connection、settings UI、base bundle 与 web-app bundle 共 11 个能力包构建通过，产物在根 `dist/packages/`；`git diff --check` 通过。仓库未提供 `workspace-preflight`/quality Gate 脚本。未执行登录浏览器目视、真实 Provider 工具调用、在线 Daemon、实时 GitHub/网页 MCP 或帧时间验收；未重启服务。
- 2026-10-04 修复后真实浏览器核查：保留用户当前设置值，计算样式确认 `html` 使用插件提供的 underlay，`body` 与 Workbench 根画布透明，AI Work 主面板读取 `--settings-background-surface-opacity` 和 `--settings-glass-blur`；页面可透出壁纸，右侧栏和 Settings 原生界面继续挂载。所选 Scene 卡片仍显示“静态帧 / 兼容模式”，此结果只验收画布合成与外观令牌，不代表实时 Scene 渲染成功；后者登记到 `LFAA-WALLPAPER-ENGINE-LIVE-SCENE-01`。

## LFAA-WALLPAPER-ENGINE-LIVE-SCENE-01：LFAA 固定来源适配器保留 Scene 实时媒体传输

### 用户目标

- 修复 Wallpaper Engine 插件已安装、已启用且 UI 已挂载，但 Scene 壁纸退回静态帧、不能完整适配 LFAA 工作台使用的问题。LFAA-Harness 始终是产品、插件生命周期、Profile、设置与数据 Owner；DSH 是 ABI 和插件上游参考。

### 运行入口、Owner 与设置

- 运行入口：Web Profile 的固定官方 Wallpaper Engine Host/Client，Host 由 LFAA `Plugin Manager` 与既有 Cordis Loader 装载，Client 通过 LFAA 已有 Settings/右侧栏 Slots 挂载。
- 当前故障证据：真实浏览器中插件库与原生设置 UI 已加载，但 Scene 项显示“静态帧 / 兼容模式”；Plugin Profile 中 `sceneLive=true` 且没有持久失败原因，Host 诊断记录当前 Scene `reason=transfer`。LFAA 适配器旧 revision 将 `ensureSceneMediaOrigin()` 与 `mediaOriginInfo()` 改写成空值，导致大型 `scene.pkg` 退回低吞吐的主应用源。由此确认问题在 LFAA Host 来源适配，不是缺少 UI 插槽或外观设置项。
- 上游 ABI：Scene 大型媒体包需通过官方 Host 懒启动的 `127.0.0.1` 临时端口媒体源传输；Web 页面/设置仍由 LFAA 的现有 Host/WebServer 与 Slots 承载。`mediaOriginNeeded()` 只决定需要 DSH Desktop 能力头绕过的 Web 壁纸是否使用该媒体源；LFAA Web 不启用此 Desktop 专用分支，但必须保留 Scene 单独的媒体源路径。
- 外观设置仍由 LFAA `appearance.overlay` / `appearance.blur` 映射；Wallpaper Engine 当前选择由 `appearance.wallpaperEngine.enabled/projectId` 归账户 Settings Owner 持有，Scene 实时设置和媒体诊断归插件 Profile 数据持有。本任务不改写任何设置、选择、插件状态或用户媒体数据。

### 允许修改

- `packages/boot/plugin-manager/src/dsh-wallpaper-engine-runtime.ts`：固定官方来源 Host 适配、严格媒体边界锚点和运行副本 revision。
- `apps/cli/tests/dsh-wallpaper-engine-runtime.test.mjs`：验证 Scene origin 保留及 loopback/路径围栏/清理器锚点变更时 fail-closed。
- `packages/api/knowledge-controller/src/index.ts`：移除无效且未使用的 Gateway 导入；保留该 Controller 现有的路由 Owner 注册方式。
- `tsconfig.host.json`：补全已登记 `lfaa-workspace-workspace` 包的 Host 类型解析映射，不改包 Owner、数据结构或运行路径。
- `packages/boot/plugin-manager/README.md`、`docs/系统总体架构.md`：同步 LFAA Owner 和 Host 媒体边界事实。
- `docs/PROMPTS.md`：本合同和本次真实验证记录。

### 禁止修改

- 不改安装来源、固定插件源码、Profile/runtime-data、账户设置、壁纸选择、播放列表、外观、音量或上传目录；不改 DSH，也不扩展为通用 DSH 插件宿主。
- 不增加 Daemon API、通用 HTTP 服务、第二个业务 Owner 或额外用户设置；媒体监听必须受固定上游代码锚点保护，只绑定 `127.0.0.1` 临时端口，只挂载 Wallpaper Engine Scene 资源及上游诊断端点，并随插件 Fiber 清理。
- 不重启或中断当前 Vite、Daemon、桌面进程或 Minecraft 实例。用户已明确授权：规范 Control Plane 构建成功后，只重启当前 Control Plane 并刷新现有 LFAA 页面；若构建失败，不重启旧版本来冒充验收。

### 验收条件

- LFAA 继续仅适配精确固定的官方 Wallpaper Engine 来源；官方 `ensureSceneMediaOrigin()` 与 `mediaOriginInfo()` 保持真实行为，`mediaOriginNeeded()` 的 DSH Desktop 专用能力头决策仍由 LFAA Web 固定关闭。
- 如上游媒体服务监听地址、临时端口、`/wallpaper-engine/scene-files` 路由、资源 token/字面与 realpath 路径围栏或 Fiber 清理锚点变化，来源检查必须拒绝启用，不得静默扩大网络或文件访问范围。
- 为 adapter revision 递增以强制新运行副本；定向回归覆盖保留媒体服务及安全锚点拒绝，修复 Host 编译阻塞后运行规范 Control Plane 构建和 `git diff --check`，所有产物仅写仓库根 `dist/`。
- 按用户授权只重启 Control Plane 并刷新现有页面；动态 Scene 需确认库存返回真实 `sceneMediaBase`、传输完成且 Scene 进入实时渲染。不得改动用户设置来制造验收结果。

### 实施记录

- 2026-10-04 核对固定上游源码 `0e9171817530272685f42b66e007a0831e2035c9`：上游 `ensureSceneMediaOrigin()` 会独立懒启动媒体源，`mediaOriginInfo()` 返回实际地址/端口；来源以外观设置和插件 UI 均已加载为证，故根因收敛为 LFAA 旧适配器把 Scene 媒体源强制清空。官方固定提交中的媒体源绑定 `127.0.0.1` 随机端口、将请求限制于 Scene 文件与诊断路由、使用 token 和字面/realpath 双路径围栏，并注册 Fiber 清理器。
- `packages/boot/plugin-manager/src/dsh-wallpaper-engine-runtime.ts` 升级 `adapter-5`：保留官方 Scene media origin 与诊断回读，只关闭依赖 DSH Desktop 能力头的 `mediaOriginNeeded()` 分支；逐项核对 loopback/临时端口、Scene 路由、token 路径围栏及 Fiber disposer。来源形态变化时 `inspectSnapshot` 以具体缺失锚点拒绝启用。新 revision 使用独立路径，不覆盖 `adapter-4` 或 Profile 用户数据。
- `node --import tsx --import ./register-package-loader.mjs --test tests/dsh-wallpaper-engine-runtime.test.mjs`（`apps/cli`）通过 3/3，覆盖真实 Cordis Loader/Carrier 生命周期，确认 Scene/mediaInfo 保留，并确认改成 `0.0.0.0`、删除 Scene 路由或卸载清理器都会 fail-closed。
- `pnpm --filter lfaa-plugin-manager run build` 通过，输出位于根 `dist/packages/`。`node node_modules/typescript/bin/tsc --noEmit -p tsconfig.client.json` 通过；`node ../../node_modules/vite/bin/vite.js build --config vite.config.ts`（`apps/web`）通过，产物位于根 `dist/apps/web/`，保留已有大 chunk 警告。
- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.host.json` 未通过，错误落在未修改的 `packages/api/knowledge-controller/src/index.ts`（未使用/不存在的 `registerRoutes` 导入）与缺少 `lfaa-workspace-workspace/src/index.js`；Plugin Manager 包构建和定向运行回归独立通过。
- 真实浏览器在本次改动前已确认壁纸层可透过 AI Work 主面板，主面板读取当前 `--settings-background-surface-opacity` 与 `--settings-glass-blur`；这些设置值、账户壁纸选择和插件 Profile 配置均未更改。运行中的 Host 仍使用旧适配副本；本次未重启服务，所以 Scene 进入实时渲染、返回真实 `sceneMediaBase` 与大包传输成功尚待服务按正常维护窗口重载后复验。

## LFAA-UI-WORKBENCH-RESPONSIVE-02：AI Work 窄屏 Dock 联动和拉伸

### 用户目标

- AI Work 右侧上下文栏在中间工作台缩窄时参与网格布局并挤压中心内容；中心内容区保持 260px 最小宽度，符合用户提出的 200–300px 范围。
- 右侧栏在可并排的窄屏尺寸下仍可拖拽调整；空间不足以并排时使用可调整宽度的浮层，不遮断工作台输入入口。
- 保持左右栏展开状态与现有偏好，减少窄宽拖拽造成的卡顿。

### 运行入口、Owner 与设置

- 运行入口：Web /apps/minecraft/ai-work，工作台容器宽度由 `useWorkbenchMetrics` 的 `ResizeObserver` 观察；验证使用当前运行中的 5173 Vite 页面，不重启服务。
- Owner：`packages/client/ui-dockkit/src/ResizableWorkbench.tsx` 持有拖拽与尺寸约束；`workbench-layout.config.ts` 定义中心与侧栏宽度/断点；`ApplicationWorkspace.tsx` 持有工作台开合偏好并渲染 AI Work 右栏；`workbench.css` 与 `module-workbench.css` 定义布局和右栏内容密度。
- 偏好：右栏宽度、左右栏开合状态仍使用现有 Workbench/Chrome 本地持久化；导航布局仍由 `settings.general.navigationLayout` 控制。主题、颜色、遮罩透明度与背景模糊继续读取现有外观映射；本次不新增设置，也不重置已存值。
- 当前证据：Compact 与 Mobile CSS 将右栏设为覆盖层并隐藏右侧拖拽柄；Compact/Mobile 切换逻辑会折叠右栏；中心最小宽度计算至少为 420px。普通拉伸已使用 requestAnimationFrame 合并 Pointer 更新，且现有规则在拉伸时暂停背景模糊。

### 当前合同

- 在宽度允许左右栏、右栏最小宽度和 260px 中心区并存时，让左右栏正常参与网格；更窄但足以容纳右栏和 260px 中心区时，保持右栏 Dock 并让左栏作为 Overlay；小于并排空间时，右栏 Overlay 仍可调宽度。
- 分隔拖拽的宽度上限必须来自当前真实容器空间，不得以超出剩余空间的静态最大值绕过中心区最小宽度；鼠标和触摸使用现有 Pointer / RAF 路径，取消、失焦和隐藏页面时继续清理交互状态。
- Settings 复用 `ResizableWorkbench` 时保持单左栏布局与已有断点行为；现有右栏开合/宽度偏好不得被响应式重置。
- 右栏窄宽布局优先使用容器本身宽度适配；不修改业务数据、AI Work 输入/消息、API 或服务端行为。

### 允许修改

- `packages/client/ui-dockkit/src/ResizableWorkbench.tsx`、`workbench-layout.types.ts`、`workbench-layout.config.ts`、`workbench.css`：窄屏右栏布局模式、260px 中心区约束及右栏拖拽边界。
- `packages/client/ui-workspace/src/ApplicationWorkspace.tsx`、`module-workbench.css`：应用工作区的右栏 Dock 选择、既有 Chrome 状态衔接与窄栏内容密度。
- `apps/cli/tests/client-workbench-responsive.test.mjs`：验证 AI Work 响应式中心宽度与原通用工作台配置隔离。
- `packages/client/README.md`、`docs/PROMPTS.md`：同步组件使用边界和本次验收结果。

### 禁止修改

- 不改变 AI Work 消息、锚点、输入、业务数据/API、Daemon/Minecraft 实例；不改设置中心 Owner 或现有 `settings.general.navigationLayout`、外观偏好。
- 不新增侧栏设置项、重复宽度状态或 React 每次 Pointer 移动渲染；不新增依赖。
- 不重启/中断当前 Vite、Control Plane、Daemon、桌面进程或 Minecraft 实例；不部署、发布或提交 Git；所有构建产物只写根目录 `dist/`。

### 验收条件

- 桌面三栏、紧凑双 Dock、窄屏右 Dock + 左 Overlay、物理宽度不足时可调宽度的右 Overlay 状态与输入区边界明确；中心区最小宽度为 260px，只在容器宽度本身更小时退让。
- 右栏可拖拽、键盘 separator 操作与宽度持久化有效；拖拽 max 不得压穿中心区下限；既有 RAF 合帧、外观令牌和减少动态效果保持生效。
- 执行相关长期回归/构建与 `git diff --check`；在 5173 现有页面核对至少桌面、窄 Dock、Overlay 三档布局和手动拖拽。报告实际帧时间测量情况，不以构建通过替代交互流畅度验收。

### 完成记录

- 2026-10-04：Web 构建与响应式断点回归通过，验证 850px AI Work 进入 Compact 且中心下限为 260px、488px 进入 Mobile，同时通用工作台仍保留 420px 下限。当前运行中的 5173 页面视口约 888px，右栏展开后确认作为 Dock 挤压中心；拖动右分隔条宽度从约 250px 调至约 281px。测试期间页面曾显示 Vite DSH Runtime 启动图错误；随后 `/api/health`、`/__dsh/index-injections` 与 5173 工作区 HTML 均返回 HTTP 200，浏览器控制在重载后超时，无法再确认该标签的最终画面。独立 488px 浏览器会话被登录页拦截，没有尝试认证，因此 Mobile Overlay 档、物理设备触控和实际帧时间未实测。没有重启 Vite、Control Plane、Daemon 或 Minecraft。

## LFAA-AI-MEMORY-01

### 用户目标

为 LFAA-Harness 设置中心的“个性化”接入账户级对话记忆控制：启用/停用记忆、控制是否允许从用过工具的聊天生成记忆、删除当前账户的全部记忆，并在后续 AI Work 对话中使用已保存记忆提供个性化上下文。

### 当前合同

- 目标运行入口为 Web/Tauri 共用的 AI Work 与设置中心；AI 请求由 `packages/core/agent-loop` 执行，设置由账户级 Settings Owner 持久化，个人记忆由独立 Conversation Memory Owner 按已认证账户隔离保存。现有工具审批记忆和知识库/Markdown 资料不属于本功能。
- 仅启用后新完成的根级 AI Work 聊天轮次可生成记忆；不得扫描、回填、总结或上传启用前历史。记忆默认关闭；停用后不得读取或生成。子 Agent/委派运行不单独读取或写入账户记忆。
- 是否从使用过工具的聊天生成记忆是独立开关，默认关闭。允许时也只向当前已配置 Provider 发送本轮用户输入及助手最终自然语言回复，不发送原始工具参数、工具输出、凭据或会话历史。生成请求必须有界、无工具调用，并且失败不能改变主回答的成功状态。
- 保存内容为少量、短小、可编辑性暂不提供的偏好/稳定背景摘要；限制单条数、长度和总字节数。记忆作为不可信个性化上下文注入后续合格的根级 AI Work 请求，不得覆盖系统、安全要求或当前用户指令。
- 清除只删除当前账户的对话记忆，不删除聊天、设置、审批授权或知识库资料；清除与并行生成竞争时，删除后的旧请求不得把记忆重新写回。用户设置和记忆均不得跨账户读取。
- 设置中心盘点：新增账户设置 `personalization.memoryEnabled`（默认 `false`）及 `personalization.memoryFromToolChats`（默认 `false`）；统一经 Settings Owner 校验、持久化和前端类型/default 映射。开关仅在“个性化”分类控制本能力，不在组件内另存偏好。界面继续使用现有外观设置映射。
- 性能与维护：不增加后台扫描/轮询；每个符合条件的完成轮次最多发出一次有界整理请求，限制并发、输入/输出 token 和超时，统计 Provider 用量，显示真实整理活动；无变化不写数据库；清理所有临时订阅/任务。记忆读取仅加载受限摘要，不重复订阅会话。

### 允许修改

- `packages/settings/settings/src/service.ts`、`packages/api/settings-controller/src/index.ts`、`packages/api/remotes/src/route-contracts.ts`：加入 personalization 设置分类的默认、类型校验、账户持久化及经认证的清除路由。
- `packages/client/connection/src/api.ts`、`packages/client/ui-settings/src/SettingsPage.tsx` 及确有需要的设置组件：映射设置类型/请求，在现有“个性化”导航页提供两个开关、删除确认和准确的范围说明。
- `packages/core/agent-loop/src/execute-turn.ts`、`runtime.ts` 及其包清单：在根级 AI Work 完成与后续请求中接入有界提取和记忆上下文；主回答失败/取消时不得生成。
- 新增单一 Conversation Memory Owner 及其存储迁移、包清单与 README；优先沿用现有 SQLite/user 身份 Owner，不使用知识库表或审批授权表。
- 直接相关测试、`docs/PROMPTS.md`、`docs/系统总体架构.md`、`docs/开发计划.md` 与目标包 README/Gate：记录 Owner、设置、隐私边界和实际验收状态。

### 禁止修改

- 不读取或处理启用前历史聊天；不将记忆发送到 LFAA 自建或远端新服务；不引入新的 Provider、模型决策工作流或第三方依赖。
- 不把记忆与工具审批授权、Session 历史、知识库文件/检索或“自定义指令”混为同一数据；不暴露原始工具协议、秘密或任意账户数据。
- 不绕过认证、账户归属、设置校验或权限；不以关键词分支、固定回复、模拟数据或空按钮冒充真实能力。
- 不写真实用户记忆/设置用于测试，不重启现有服务，不提交、发布或部署；所有构建产物仅写仓库根 `dist/`。

### 验收条件

- 设置中心显示并持久化默认关闭的记忆总开关及工具聊天开关；刷新回读正确。工具开关关闭时工具轮次不触发记忆整理；总开关关闭时不读取、不生成。
- 只从启用后完成的根级轮次生成；子 Agent、失败和取消轮次不生成；无工具聊天按总开关处理；工具聊天需第二开关显式允许。整理输入不包含工具原始内容，Provider 请求有界且其失败不影响已完成回答。
- 后续根级请求只收到当前账户已保存、长度有界的不可信记忆上下文；其他账户不可见。删除后立即为空，刷新/后续请求仍为空，并发中的旧整理不能复活记忆。
- 记忆数据由 SQLite 迁移创建并账户外键隔离；Owner 对内容与规模强校验。直接回归覆盖迁移、规范化/限额、账户隔离、开关路由、并发清除及 Provider 失败。
- 按 `lfaa-validation` 执行 workspace-preflight（若仓库存在）、Owner 定向回归、相关包构建、Web 构建与 `git diff --check`，产物均在根 `dist/`。需分别报告未实测的登录浏览器、真实 Provider、用量和运行中服务；源码/构建证据不得冒充端到端验收。

## LFAA-AI-MEMORY-01-R1

### 用户目标

修补 LFAA-AI-MEMORY-01 使用反馈中发现的风险和可用性不足：记忆整理输入先做本地敏感内容过滤；记忆正文不留在模型请求历史快照中，删除时清理账户已有快照；记忆整理不得拖延主回答完成；用户可在设置中心查看、编辑或删除已保存记忆。

### 当前合同

- 延续 `LFAA-AI-MEMORY-01` 的用户范围：只处理启用后完成的根级 AI Work 轮次，不回填启用前聊天；已有功能默认关闭、账户隔离、工具聊天独立开关和 Provider/用量边界不变。
- 输入过滤在本机 Agent Loop/Conversation Memory Owner 边界执行，再向当前 Provider 发送；检查并移除明显的凭据、账号秘密、邮箱、手机号、身份证号和私钥块。无法以正则可靠识别的敏感内容仍可能进入模型整理请求，界面须如实说明边界；不得声称可完全识别。
- Provider 请求的 `<conversation-memory>` 正文不得进入 Session 的 request/context、assistant/attempt 或模型历史投影。清除记忆时，由 Session Owner 按当前账户重写相关会话日志并校验 hash chain，移除此前写入的记忆正文后，再清除 Conversation Memory Owner；其他账户会话不得读取或改写。
- 主回答内容和主 Provider 用量必须先持久化并发出完成事件；记忆整理作为有界后台后处理运行，其失败/取消只记活动诊断，不回滚已完成回答。记忆 Provider 用量仍须归属于触发的助手消息且纳入账户用量汇总。
- 设置中心仅加载当前账户的短小记忆列表；支持逐条编辑/删除和 revision 并发保护。保存继续由 `lfaa-conversation-memory` 校验内容、数量、长度、敏感数据与账户范围；冲突时回读，不静默覆盖。保留现有两个 personalization 设置默认值和主题映射。

### 允许修改

- `packages/storage/storage-sqlite/src/database.ts`、`packages/core/conversation-memory/`、`packages/core/agent-loop/src/execute-turn.ts`：把 SQLite 支持版本递增到 v43；本地过滤整理来源；生成有界提示与后台后处理；保持真实 Provider 用量。
- `packages/session/session-persistence-jsonl/src/persistence.ts`、`packages/core/session/src/sessions.ts`：在 Session Owner 中安全重写指定账户日志，清除持久化记忆块并保持事务校验；对新 Session 模型快照剥离记忆块。
- `packages/api/settings-controller/src/index.ts`、`packages/api/remotes/src/route-contracts.ts`、`packages/client/connection/src/api.ts`、`packages/client/ui-settings/src/SettingsPage.tsx`：增加账户认证的读取/保存路由与设置中心查看/编辑交互。
- 直接相关的长期回归、目标包 README、`docs/系统总体架构.md`、`docs/开发计划.md` 与本合同。

### 禁止修改

- 不读取、整理或回填启用前历史聊天；不传输原始工具参数/输出、整个历史会话或秘密；不改变 Provider 选择和既有数据 Owner。
- 不添加新的设置项、依赖、后台服务、轮询、模型或推测敏感识别成功；后台整理失败不改变主回答状态。
- 不改与本合同无关的会话、账户、设置、存储或运行代码；不重启当前服务，不提交、发布或部署。所有构建产物仅写根 `dist/`。

### 验收条件

- 回归验证：敏感输入会在本机被过滤；新快照不包含 `<conversation-memory>` 正文；清除只重写当前账户历史并让日志链可恢复；账户隔离与旧整理 CAS 保持通过。
- v43 Conversation Memory 数据库迁移完成后，可在新进程安全重开；源端与构建入口都接受 v43。
- Agent Loop 完成事件先于记忆 Provider 请求结束；主用量与记忆用量均被真实记录，整理错误不改变回答状态。
- 设置中心在当前账户可查看、编辑、逐条删除和全量清除；刷新后回读正确；revision 冲突不覆盖较新结果。
- 运行对应定向回归、相关包构建、Web 构建和 `git diff --check`；按本轮实际条件报告浏览器、真实 Provider、数据库磁盘清理和异步用量刷新边界，不以静态/构建证据替代。

### 完成记录

- 2026-10-04：完成本轮加固。Conversation Memory、Session JSONL、Session Kernel/Owner、Agent Loop、Settings API 与个性化设置页覆盖本地输入过滤、记忆正文快照剥离、删除时当前账户历史快照脱敏/日志链重算、回答先完成再后台整理，以及记忆查看/编辑/逐条删除；同一轮加入 SQLite v43 启动支持上限，保证升级后的数据库能被新进程重开。定向回归 14/14、9 个受影响包构建、`git diff --check` 通过。当前 Host/Client TypeScript 与 Web/Vite 构建均被已有 `packages/api/account-controller` 导入 `client-contract.generated.js`、而工作树仅有 `.generated.ts` 阻断；未改动该并发文件。`workspace-preflight` 未找到；登录浏览器、真实 Provider/异步用量刷新和活动服务未验，也未重启服务。
- 2026-10-04：接入账户级 personalization 设置、SQLite v43 Conversation Memory Owner、AI Work 有界整理和上下文注入、认证删除 API 与设置页。历史范围只处理启用后新完成的根级轮次，不回填旧聊天；记忆默认关闭，工具聊天另需允许。Conversation Memory 回归 1/1、Knowledge Library 迁移回归 2/2、10 个受影响包构建及 Web 类型检查/构建通过；包清单 JSON、测试脚本语法和 `git diff --check` 通过。控制端构建被当前工作树中的 `computer-use` 未使用变量/重复类型声明和 Agent Loop 消息持久化类型不匹配阻断；Harness API 集成回归随后在 CLI 导出子进程将源端 v43 数据库误判为旧 dist 支持上限 v42 时停止，未执行到 Provider 记忆整理断言。登录浏览器与真实 Provider/用量未测。仓库未找到 `workspace-preflight`。

## LFAA-AI-NATURAL-LANGUAGE-PLUGIN-INSTALL-01

### 用户目标与可观察行为

- 在 LFAA 内置 AI Work 中，用户只需表达“安装这个插件”并给出 GitHub 仓库地址；模型根据当前 App 和目标类型，自主选择本轮已登记的 LFAA 能力工具，不要求用户罗列 `capability_*` 名称、步骤或插件 ID。
- 用户提供明确 GitHub 插件来源时，模型先读取当前 App 的 Plugin Owner 清单以识别同源已安装项；已就绪则停止，已安装且 `canEnable=true` 则只启用并再次读取清单。不得把普通“安装”扩展成升级；只有用户明确要求更新时才能检查和安装新 revision。
- 当前 App 没有同源记录时，模型直接用 `capability_inspect` 固定来源版本，再用返回的 `inspectionId` 调用 `capability_install`。无需先搜索候选或为已知的插件目标查询通用目录；安装审批仍由当前 `permissions.mode` 决定。Owner 自动启用新安装的兼容插件并回读真实状态。
- 启用后必须根据 Plugin Owner 返回的清单确认 ID、来源、提交、App、状态及 `canEnable`；只有实际状态为 enabled/ready 才报告可用。任何 Owner 错误、来源不匹配、不可启用或状态未知都停止继续副作用并简洁报告具体结果，不得重试安装。
- “一句话”简化用户输入，不扩大 Runtime 兼容面：只有现有 Owner 接受且当前 Runtime 支持的来源才能运行；不兼容的 DSH Bundle 仍保持禁用并如实说明。

### 运行入口、Owner 与设置盘点

- 运行入口：Web/Tauri 共用 `web` Profile 的 AI Work；模型工具循环归 `packages/core/agent-loop`，工具语义与能力路由归 `packages/boot/capability-installs`，Profile 插件清单及实际生命周期归 `packages/boot/plugin-manager`。
- 设置/权限：沿用当前 App、管理员角色、`permissions.mode` 与现有审批合同。通用 `capability_*` 工具不由 `plugins.enabled` 控制；不改 `plugins.enabled`、账户壁纸 `appearance.wallpaperEngine.enabled/projectId` 或其他外观设置。
- 性能/维护：仅在用户明确提出插件操作时由模型调用清单/来源检查/写工具；不新增后台扫描、重试、轮询或并行执行，不新增配置项和依赖。

### 允许修改

- `packages/boot/capability-installs/src/index.ts`：改进给模型看的能力工具说明，让直接来源、当前 App、同源已安装状态与后续 Owner 动作清晰可由模型自主规划。
- `packages/boot/plugin-manager/src/index.ts`：在 Agent 的清单回读中暴露由 Plugin Owner 根据真实兼容状态计算的 `canEnable`，不改变持久化清单格式和生命周期行为。
- `packages/boot/capability-installs/README.md`、`packages/boot/plugin-manager/README.md`、`docs/系统总体架构.md`、本合同与任务索引：同步模型输入/输出与 Owner 边界。
- `apps/cli/tests/capability-installs.test.mjs`、`apps/cli/tests/plugin-manager.test.mjs` 及需要的 Agent Loop 定向回归：覆盖工具可见合同、直接来源检查流程指引、同源清单 `canEnable` 与失败/启用回读。

### 禁止修改

- 不新增关键词分支、安装编排服务或绕过模型的固定执行工作流；不让用户承担内部工具名与调用次序的说明工作。
- 不运行未受支持的 DSH Bundle，不扩大 `DshWallpaperEngineRuntime` 或通用 LFAA Runtime 的兼容声明；不执行第三方安装脚本。
- 不因用户只说“安装”而更新已安装插件；不绕过管理员授权、`permissions.mode` 或审批；不改账户插件总开关、壁纸选择和外观设置。
- 不写真实用户 Profile/数据、不重启 Web、Control Plane、Daemon 或桌面、不提交/发布/部署。

### 验收条件

- Provider 可见的工具说明支持直接 URL 安装目标：能区分显式来源与候选搜索、默认使用当前 App、直接调用来源检查，并遵循检查凭证、权限审批和 Owner 后续动作。
- 同 App 清单中的同源 ready 项不会重复安装；同源 `installed && canEnable` 项只走启用与清单回读；不可启用、来源不同、目标不同或未知状态不会被误报成功，也不会触发未经请求的更新/移除。
- 定向回归证明 `capability_list` 回传来源/版本/提交/App/真实状态与 `canEnable`，启用失败保留 Owner 原因；工具仍经现有角色、App、目标和审批边界执行。
- 运行能力安装与 Plugin Manager 相关回归、直接包构建、必要的 Host 类型检查和 `git diff --check`；所有产物写入仓库根 `dist/`。真实 Provider 自然语言选择、登录浏览器、真实外部 GitHub 和当前 Profile 运行状态分别报告，合成工具循环不冒充其验收。

### 完成记录

- 2026-10-04：工具说明现支持直接 GitHub URL、当前 App 默认目标和模型自主选择 Owner 生命周期；Plugin Owner 清单回读暴露由真实兼容状态计算的 `canEnable`。定向回归 16/16、Wallpaper Engine Runtime 回归 3/3、两个直接包构建、Host 类型检查和差异空白检查通过；真实 Provider、登录浏览器与当前 Profile 实际状态未验。

## LFAA-COMPUTER-USE-LOCAL-01：本机电脑操控

### 用户目标与可观察行为

让 LFAA-Harness 能在用户明确启用后，通过本机桌面观察当前屏幕并执行鼠标/键盘操作；模型必须收到真实截图并根据后续截图核对动作结果。未获准的工具不可见或不可执行，未取得真实驱动结果时不得报告成功。

### 运行入口、Owner 与设置盘点

- 运行入口：仅 LFAA `desktop` Profile 的本机 Control Plane；当前 Windows 桌面宿主以已登录用户身份启动该 Profile。Web Profile 和远程 Daemon 不装配、不可发现或执行桌面操控工具。
- 外部驱动：优先核实并接入 Cua Driver 的官方 Node SDK；LFAA 自有包负责适配、生命周期、工具范围、审批、图像反馈与状态，不依赖 DSH Runtime，也不要求用户另装 DSH。
- 设置 Owner：`packages/settings/settings` 增加账户级 `computer-control` 分类，`enabled` 默认 `false`，由设置 API 校验与持久化；前端连接类型、默认值和当前“电脑操控”设置入口同步接入。禁用时不向模型提供控制工具，并在每次执行时再次校验。
- 权限：只允许当前本机 Control Plane 中的互动桌面驱动；观察工具为 read，鼠标/键盘输入按 dangerous 走当前 `permissions.mode` 与完整参数审批范围。用户开启功能开关不替代逐项审批模式；取消等待不承诺撤销已经送达操作系统的输入。
- 视觉：截图是暂态模型输入，需沿用已有 Provider 请求链的标准图像内容协议；不将 base64/截图字节写入 Session、活动轨迹或客户端 API。历史恢复时丢弃截图并要求重新观察。
- 性能与维护：驱动惰性初始化；只在模型实际调用时截屏/操作；有界图像尺寸与结果长度；卸载/退出需关闭驱动并等待在途调用完成；不建立后台截图、重试或轮询。

### 允许修改

- `packages/computer-use/computer-use/**` 与新增/现有对应 README、`package.json`：第一方 CUA Driver 适配、运行期与工具定义。
- desktop Profile 专属 Bundle/Profile 装配；不得装入 `web` Profile 或 Daemon。
- `packages/settings/settings/**`、`packages/storage/storage-domain/src/configuration.ts`、`packages/api/remotes/src/route-contracts.ts`、`packages/api/settings-controller/src/index.ts`、`packages/client/connection/src/api.ts`、设置默认值与电脑操控设置 UI：完成账户设置类型、默认值、严格校验、持久化、读取和呈现闭环。
- `packages/core/tools/**`、`packages/core/agent-loop/**`、`packages/core/session/**`：按桌面 Profile 和账户开关过滤工具，复用审批链，将已界定的截图输入给 Provider，并在会话持久化/请求记录中清除图像载荷。
- 与上述直接变更对应的 `apps/cli/tests/**` 长期测试、锁文件、`docs/系统总体架构.md`、`docs/开发计划.md`、`docs/harness-packages.md` 及本合同的索引/完成记录。

### 禁止修改

- 不在 Web Profile、远程 Daemon、普通 Shell、浏览器页面或独立服务器中授予任意桌面输入能力；不把权限扩大到非交互会话或其他用户桌面。
- 不运行上游远程安装脚本，不安装/启动全局桌面驱动进程，不在本轮实际点击、输入或读取用户屏幕；驱动 API 只用隔离替身做自动验证。
- 不通过 `plugins.enabled`、`permissions.mode` 的弱化、隐藏 UI 或批准记忆扩展权限；不把 `full_access` 解释成绕过显式电脑操控开关。
- 不持久化/输出截图、图像数据、授权材料或未经必要脱敏的屏幕文本；不向不支持图像输入的 Provider 伪报已观察屏幕。
- 不提交、发布、部署、启动或重启用户服务；构建产物仅写根 `dist/`，保留工作树中已有的并行改动。

### 验收条件

- 设置接口、前端默认值、数据库/配置 Owner 与 UI 共同证明新账户默认关闭，账户间互不影响，非法字段被拒绝，刷新/重启后设置保留。
- desktop Profile 的工具清单只在 Windows 桌面运行且该账户已启用时出现；web Profile 与远程 Daemon 不装配相关包且其工具清单中没有桌面工具。禁用后工具执行的二次检查拒绝调用。
- 工具只开放有界观察、鼠标与键盘动作；完整参数按现有审批和 permission mode 判定，取消/异常不伪造完成。对图像结果、会话历史和请求审计的测试证明截图原始字节不会持久化。
- Provider 收到的是标准多模态截图输入，结果回传后 Agent 能发起下一次观察并核验；不支持图像输入的模型须明确失败，不得假称其可见屏幕。
- 运行直接相关的回归、包构建、Control Plane/Web 构建或类型检查、`git diff --check`；报告 Windows 真实交互桌面、实际 Provider、截图识别和 packaged desktop 验收分别是否完成。纯构建/替身测试不算真实桌面验收。

### 完成记录

- 2026-10-04：新增 `lfaa-computer-use` 并仅装配到 Windows `desktop` Profile；以锁定的 Cua Driver TypeScript SDK `0.32.0` 在本机 Control Plane 内提供观察、点击、非敏感文本输入、快捷键和滚动工具。电脑操控账户设置默认关闭，设置分类由 Configuration Owner 校验与持久化，API 对未知字段严格拒绝。输入动作沿用现有 dangerous 权限合同；截图作为标准 `image_url` 仅供当前 Provider 请求使用，旧截图在新观察到达时从运行内存释放，截图字节、键入文本参数和桌面工具返回不会写入会话历史。Agent Run 观察状态互相隔离，桌面操作串行化；子 Agent 不继承电脑操控工具，Profile 卸载等待在途驱动操作并关闭原生运行时。
- 定向回归 1/1 通过，覆盖设置默认值、账户隔离、API 未知字段拒绝、Profile 限定、工具可见性/风险、逐轮观察/旧截图、图片输入与会话脱敏、驱动懒初始化/卸载清理；9 个受影响包构建、Control Plane 类型检查/构建、Web 类型检查/构建、JSON 清单核验和 `git diff --check` 通过。Web 构建仍报告一个既有的 1.36 MB 压缩前 JS chunk 超过 500 kB 警告。
- 当前未执行真实 Windows 屏幕观察/点击/键入、真实 Provider 图像请求、设置页面浏览器交互或隔离安装后的桌面验收；未安装全局驱动服务，也未启动/重启用户服务。仓库未发现 `workspace-preflight` 命令或脚本。

## LFAA-COMPUTER-USE-SETTINGS-UI-RECOVERY-01：电脑操控设置页崩溃修复

### 用户目标与可观察行为

- 打开“设置中心 > 电脑操控”只显示电脑操控能力设置，不初始化、探测或执行屏幕/鼠标/键盘驱动操作。
- 账户级开关是用户授予 Agent 本机电脑操控能力的配置；开关打开后，当前运行组合已装配且支持的电脑操控工具才可由模型按任务自主选择。导航或切换开关本身不代表执行桌面动作。
- 新增设置字段缺失或旧账户/旧服务返回不完整设置对象时，设置中心仍能显示，缺失字段按默认关闭处理。

### 运行入口、Owner 与设置盘点

- 运行入口：Web/Desktop 共用 `packages/client/ui-settings/src/SettingsPage.tsx`；设置数据由 `packages/settings/settings` 保存，Agent 工具是否可见及每次执行授权仍由已有 Agent Loop 与工具 Owner 决定。
- 设置：仅使用已有账户级 `computerControl.enabled`，默认关闭；不新增应用名单、不改 `permissions.mode` 或配置持久化格式。
- 性能/安全：设置页不请求运行时扩展目录；不创建驱动、不读取屏幕、不发送输入；运行时装配与工具执行边界保持不变。

### 允许修改

- `packages/client/ui-settings/src/SettingsPage.tsx`、`packages/client/ui-settings/src/computer-control-settings.ts`、`apps/cli/tests/computer-use-settings-ui.test.mjs`：修复缺失设置字段处理，移除对运行时插件状态的错误依赖，使开关准确表达模型能力授权。
- `packages/computer-use/computer-use/README.md`、`docs/系统总体架构.md` 与本合同：说明设置页仅作授权配置、模型按需选择工具的行为。

### 禁止修改

- 不改 CUA Driver、电脑操控工具实现、权限审批/持久化 Owner、模型 Provider 或 Profile 装配。
- 不因导航或开关动作调用任何桌面工具；不访问、点击、输入或读取用户的真实桌面。
- 不重启用户服务、不提交/发布/部署；保留工作树中的并行修改，构建产物只写根 `dist/`。

### 验收条件

- 带有 `computerControl.enabled`、缺少 `computerControl`、以及默认关闭三种设置输入下，设置页均不会因电脑操控分类渲染失败。
- 页面导航不加载运行时扩展、不创建 CUA Driver、不产生桌面输入；开关开启后设置保存为账户级授权，工具可见性仍由既有运行时开关与真实工具装配决定。
- 运行直接相关回归、设置 UI 包与必要 Host/Web 构建、`git diff --check`；尝试当前登录态浏览器验收，受登录或浏览器连接阻塞时如实记录，不以静态/构建结果冒充页面实测。

### 完成记录

- 2026-10-04：设置页不再加载运行时扩展清单或依据插件状态禁用账户授权开关；缺少/非法 `computerControl.enabled` 时按默认关闭读取。页面文案明确导航与开关只设置 Agent 授权，模型按任务选择已装配工具。
- 设置兼容回归 1/1、电脑操控隔离回归 1/1、`lfaa-client-ui-settings` 包构建、Web 类型检查/构建和 `git diff --check` 通过。构建产物落在仓库根 `dist/`。
- 登录态浏览器未验：Codex 内置浏览器当前只显示登录页，Edge 浏览器连接不可用；未访问用户登录数据。Windows 实际桌面、真实 Provider 和打包桌面未验。仓库未找到 `workspace-preflight` 命令/脚本。

## LFAA-UI-AI-WORK-MESSAGE-ACTIONS-01

### 用户目标

参考截图为 AI Work 的用户提问和助手回答增加完整内容复制、对回答提交直接反馈，以及从某条完整回答创建新聊天并继承截至该回答的上下文，便于当前会话变长后继续交流。

### 当前合同

- 目标入口为 Web `apps/web` 的 AI Work；共享交互归 `packages/client/ui-chat/src/AiWorkChat.tsx`，因此同一实现也供装配该组件的桌面入口使用。消息、会话和反馈数据的唯一 Owner 是 `lfaa-session`，由认证后的 `session-controller` API 暴露；客户端只调用现有 Control Plane。
- 复制用户提问时写入完整原始文本；复制助手回答时写入完整 Markdown 源文本，不从可能截断或重新渲染的 DOM 抽取。按钮只在有可复制内容时启用，复制结果提供明确的成功/失败反馈。
- 助手完整回答下提供正向/负向评价入口。用户可选类别并填写可选补充说明；只有提交成功后显示已反馈状态。反馈经认证后写入对应会话事件，绑定账户、会话与已完成助手消息；消息读取接口回传已提交状态，刷新后仍可见。每条助手消息最多接受一条反馈，限制类别数和文本长度，不接受正在生成/失败回答的反馈。
- 从一条已完成助手回答创建新聊天：服务端只按当前账户拥有的源会话和目标消息建立精确 Session 事件前缀分支；分支继承原 App 和截止该回答的用户/助手上下文，后续消息独立写入新 Session。普通分支保留源项目绑定，不接受客户端事件序号、上下文正文、账户、App 或任意目录，不重放已完成轮次的工具副作用。
- 对已绑定原始 Workspace/Minecraft 项目且 Daemon 在线并具备 `project-files-v1` 与 `git-workspace-v1` 能力的会话，额外提供“在新工作树中创建分支”：通过现有 Workspace Owner 创建并登记 AI Worktree；新会话只可绑定到由源项目派生、同账户/同 App/同 Daemon 的受管 Worktree 项目。新工作树创建失败时不创建分支；工作树成功登记但 Session 创建失败时保留该登记并明确报告，允许从项目列表复用。无项目、源项目本身为 Worktree、项目列表未能确认源项目或节点不满足能力时不显示此选项。该路径会按用户显式选择调用现有 Daemon Git Worktree Owner；普通聊天分支不触发 Git 或 Daemon 操作。
- 设置中心盘点：本功能不新增配置。界面继续使用已有主题、强调色、文字颜色、字体字号和减少动态效果映射；不写入新的 CSS 自定义属性。外观由当前 Settings Owner 持续控制。
- 性能边界：复制仅执行点击触发的系统剪贴板写入；反馈和分支仅由用户点击发起一次有界请求。无常驻轮询、计时器、观察器或全局事件监听器。反馈 payload 有固定上限；前缀 fork 仅在显式操作时读取并复制所选前缀。

### 允许修改

- `packages/client/ui-chat/src/AiWorkChat.tsx`、`ai-work-chat.css`：为用户与助手消息呈现复制、反馈与分支操作；提交状态与提示遵循现有外观令牌。
- `packages/client/ui-primitives/src/WorkbenchIcon.tsx`：为消息操作提供可复用的复制、评价与分支线性图标。
- `packages/client/connection/src/api.ts`：增加反馈、按消息创建 Session 分支和在工作树创建分支的请求封装。
- `packages/api/session-controller/src/index.ts`、`packages/api/workspace-controller/src/index.ts`、`packages/api/remotes/src/route-contracts.ts`：增加认证路由与有界请求校验；Workspace Owner 校验工作树归属后将 Session 分支绑定到其真实项目上下文。
- `packages/core/session/src/kernel.ts`、`sessions.ts`：校验并持久化消息反馈事件；按已完成助手消息解析服务端 fork 前缀并接受已由 Workspace Owner 校验的目标项目上下文；会话消息投影返回已提交反馈。
- `packages/core/session/README.md`、`packages/client/README.md`、Workspace/Session Controller README，以及 `docs/系统总体架构.md`：说明唯一 Owner、接口语义和 UI 接入。
- `apps/cli/tests/session-kernel-persistence.test.mjs`、`apps/cli/tests/session-kernel.test.mjs` 与直接相关的客户端性能/交互回归：覆盖反馈校验、账户隔离、持久化恢复、消息精确前缀分支及无副作用重放。
- `docs/PROMPTS.md`：维护本合同、任务索引与实际完成记录。

### 禁止修改

- 不另建会话、身份、反馈数据库、Provider 或 Agent Runtime；不暴露模型协议、工具参数/结果或秘密。
- 普通聊天分支不触发 Git/Daemon；仅用户显式选择新工作树分支且真实 Owner 能力可用时调用现有 Git Worktree Owner，不触发 Minecraft 实例操作。不得创建或删除现有以外的工作区实现。
- 不新增设置项、第三方依赖、虚构成功状态、超出用户选择消息的历史上下文或后台副作用。
- 不改与消息动作无关的 AI Work 布局、工作台导航、模型选择、权限合同和未提交的既有改动；不重启现有服务。
- 不提交、发布或部署。所有构建产物仅写仓库根目录 `dist/`。

### 验收条件

- 完整复制用户原文与助手 Markdown；复制状态可感知，剪贴板不可用时明确报错。
- 正负向反馈都能选择理由并提交补充说明；成功后该回答显示已反馈，刷新后状态仍由 Session Owner 返回；未完成回答、越权会话和不合法/超限输入被拒绝。
- 从较早回答创建普通分支后，分支消息准确截止于该回答，继承源 App/项目上下文；源会话保持不变，后续分支消息落入新会话，不会重新派发历史工具调用。
- 符合条件时在新工作树创建分支：工作树由现有 Workspace Owner 登记，新会话绑定到正确的派生项目，账户/App/源项目关系经服务端验证；不符合条件时无该入口。工作树与 Session 之间的部分失败状态必须可见且不伪报完成。
- 执行 Session 持久化/分支及反馈定向回归、相关包构建、Web 构建和 `git diff --check`；如有登录态浏览器则核对消息动作与反馈弹窗交互。分别报告真实浏览器、剪贴板权限、Provider 和帧时间是否实测。

### 完成记录

- 2026-10-04：实现用户提问与完整助手 Markdown 复制、Session 持久化正负反馈、按完整回答创建普通 Session 前缀分支；对具备真实 Workspace 项目和在线 Git Worktree Daemon 的会话增加新工作树分支，并由 Workspace Controller 校验项目来源及账户/App/Daemon 归属。没有新增设置；现有外观令牌、壁纸遮罩/模糊和减少动态效果继续生效。
- 验证：Session 内核持久化/分支回归 10/10 通过；`lfaa-session`、`lfaa-api-workspace-controller`、`lfaa-client-connection`、`lfaa-client-ui-chat` 包构建通过，产物位于根 `dist/`；`git diff --check` 通过。Web 全量构建未通过：被既有 `packages/client/ui-settings/src/SettingsPage.tsx:2760` 中 `"personalization"` 与当前类型联合不匹配的 TS2367 阻断；该文件不属于本任务改动。登录态 IAB 页面为空白，复制/反馈/分支弹窗交互未能实测，剪贴板、Provider 和帧时间亦未实测。
- 已发现的宿主限制：当前 `ApplicationId` 声明包含 `workspace`，但 SQLite `ai_sessions.app_id` 检查约束仍仅允许 `steamcmd/minecraft/writing`；在隔离回归数据中，创建 `workspace` Session 会被 SQLite 拒绝。该既有存储迁移未包含在消息操作改动内，因此不能据此声称 Workspace App 的端到端会话验收通过；当前内核目标项目分支回归用数据库支持的 `minecraft` App 验证。

## LFAA-UI-AI-WORK-EDIT-MESSAGE-01

### 用户目标

在 AI Work 已发送的用户问题旁提供编辑入口。编辑时可补充或改写原文后重新发送；如果这条问题当前仍在生成回复，先停止并等待该运行结束，再允许发送，避免旧运行和修订问题并发执行。

### 当前合同

- 目标入口为 Web `apps/web` 的 AI Work；消息交互仍由共享 `packages/client/ui-chat/src/AiWorkChat.tsx` 持有。账户、App、项目上下文、消息与 Session 日志仍由现有 `lfaa-session` 和认证 Session Controller 管理。
- 只允许编辑有独立助手消息配对的真实用户轮次；模型运行中的引导/澄清补充消息不是独立轮次，不提供编辑入口。选择当前活动轮次时先调用现有取消 API，并通过该 run 的事件流等待服务端报告终态；取消失败或等待失败时不创建分支、不发送修订问题。
- 点击发送后，客户端只提交源会话和目标用户消息 ID。Session Owner 验证当前账户、目标是可编辑的独立用户轮次，并从该轮 `turn/start` 之前推导精确前缀（排队轮次尚无 `turn/start` 时在目标用户事件前截断）；不得接受客户端提供的边界、上下文正文、App、账户或项目替换值。
- 修订内容使用现有聊天输入长度上限与认证/限流合同。新 Session 沿用源 App 和项目上下文；源会话消息、反馈和运行记录不被修改或删除，旧问题之后的回答/事件不进入新分支。修订文本作为新分支上的新用户轮次通过既有 Agent Loop 和 Provider 链路发送，历史工具调用不重放。
- 内联编辑器提供“取消”和“发送”，初始内容为被选中的完整原始提问。失败时保留可恢复的编辑文本并显示明确错误；成功后切换到新会话，原会话继续保留在列表中。
- 设置中心盘点：无新配置。输入与操作样式读取现有主题/文字/强调色令牌及字体字号映射；遵循已接入的减少动态效果设置，不新增 CSS 自定义属性。
- 性能/生命周期：只有用户点击时发生一次取消、一次有界 Session fork 和一次新 AI 请求；等待活动 run 仅建立临时事件订阅，并在终态、错误或取消时解除，不新增常驻轮询、观察器或订阅。

### 允许修改

- `packages/client/ui-chat/src/AiWorkChat.tsx`、`ai-work-chat.css`：呈现用户问题编辑按钮、内联编辑器、停止状态、取消/发送与错误恢复。
- `packages/client/connection/src/api.ts`：封装从用户消息之前创建 Session 分支的认证 API。
- `packages/api/session-controller/src/index.ts`、`packages/api/remotes/src/route-contracts.ts`：新增消息前缀分支路由并校验消息 ID；用户文本继续由现有 `/ai/chat/stream` 输入 Schema 限制。
- `packages/core/session/src/sessions.ts` 与 `packages/core/session/README.md`：在唯一 Session Owner 中校验独立用户轮次并按精确前缀分支。
- `packages/api/session-controller/README.md`、`packages/client/README.md`、`docs/系统总体架构.md`：记录编辑、取消等待、前缀边界和源会话保留语义。
- `apps/cli/tests/session-kernel.test.mjs`、`apps/cli/tests/session-kernel-persistence.test.mjs` 与必要的现有客户端交互回归：覆盖前缀验证、活动轮次/独立输入判定、账户隔离、源会话不变和持久化恢复。
- `docs/PROMPTS.md`：维护本合同索引和真实完成/验证记录。

### 禁止修改

- 不覆盖、删除或在原 Session 内重写已发送用户消息及后续历史；不另建会话/身份/Provider/Agent/存储 Owner，不重放历史 Tool/Daemon 操作。
- 不通过断开浏览器流伪装为停止运行；活动任务必须使用现有认证取消 API，并等待真实终态。取消不回滚已经完成的外部副作用，错误提示不得声称其已撤销。
- 不允许编辑模型引导、澄清答案等 run 内辅助消息；不在其他轮次仍活动时并发创建修订请求。
- 不新增设置、第三方依赖或任何假成功状态；不改变 AI Work 消息版式以外的工作台布局、导航、权限或已有配置。
- 不重启现有服务，不提交、发布或部署；构建产物仅写仓库根目录 `dist/`。

### 验收条件

- 用户可在提问消息旁打开内联编辑器，原文完整预填；取消后退出编辑且原会话不变，发送时执行现有 12000 字符限制。
- 编辑活动中的配对问题会先请求停止并等待服务端终态；等待期间发送不可用。停止或跟随失败时不创建 Session/Provider 请求，并保留编辑文本。
- 新会话准确继承目标问题前的已完成上下文，并带上源 App/项目；不包含被编辑问题、其助手回复及后续事件。源会话完整保留，改写问题只在新会话执行一次。
- 不接受其他账户会话、引导消息、无配对助手轮次、伪造消息 ID 或无效输入；取消、网络错误和 Provider 失败清晰可见。
- 执行 Session 精确前缀及持久化定向回归、相关包构建、Web 构建和 `git diff --check`；如有登录态浏览器，再核对内联编辑、取消活动运行及发送流程。报告浏览器、Provider、副作用停止确认和帧时间的真实验收边界。

### 完成记录

- 2026-10-04：在用户问题旁增加编辑入口和内联编辑器。活动回复编辑时调用现有认证取消 API，并等待该 run 的服务端终态；发送时由 Session Owner 校验独立用户轮次并从问题前创建新 Session，保留源会话和其后续记录，再通过现有 Agent Loop 提交修订问题。未新增设置或 CSS 自定义属性。
- 验证：Session 内核及持久化回归 11/11 通过；`lfaa-session`、`lfaa-api-session-controller`、`lfaa-client-connection`、`lfaa-client-ui-chat` 构建通过，产物位于根 `dist/`；`git diff --check` 通过。Web 构建被既有 `packages/client/ui-settings/src/SettingsPage.tsx` 中 3 个 TS6133 未使用声明阻断，该文件不属于本任务改动；未找到 `workspace-preflight`；登录态浏览器页面为空白，内联编辑、停止活动回复和修订发送未做运行态验收，真实 Provider 与物理帧时间未测。

## LFAA-UI-AI-WORK-IDLE-BLUR-01

### 用户目标与可观察行为

- AI Work 回复区在页面有鼠标、键盘、滚动、触屏等用户活动时保持清晰；活动停止达到外观设置的延迟后，回复内容、左侧刻度轨道、右侧滚动条和“回到底部”控件一起虚化；再次活动时一起恢复清晰，不再依据鼠标是否跨过回复区域边界切换。虚化状态不对大型滚动层逐帧动画。
- 输入框始终可读、可编辑，输入卡片自身底色不应用滤镜。触屏等没有鼠标的设备也按页面用户活动空闲状态工作。
- 外观设置使用账户级 `appearance.advanced.aiWorkOutputFocusBlurEnabled`、`aiWorkOutputFocusBlurPercent` 和 `aiWorkOutputFocusBlurIdleSeconds`；延迟默认 60 秒（1 分钟），范围 60–3600 秒且按整分钟设置。强度百分比映射为 0–8px 模糊半径，不再降低内容透明度；旧账户的无效延迟恢复为 1 分钟默认值，不重置其他外观偏好。
- 空闲状态是瞬时页面状态，不持久化鼠标位置；离开/隐藏页面须清理唯一计时器和事件监听。活动高频更新不得触发 React 聊天树重渲染、反复重设计时器或持续轮询。

### 运行入口、设置与 Owner

- 运行入口：Web `apps/web` 与共用 Client 桌面 WebView；`packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 装载 `packages/client/ui-chat/src/AiWorkChat.tsx`，共享样式位于 `packages/client/ui-chat/src/ai-work-chat.css`，滚动条样式位于 `packages/client/ui-workspace/src/module-workbench.css`。
- 设置入口：设置中心“外观 > 背景显示 > AI Work 回复区聚焦”。`packages/settings/settings/src/service.ts` 负责账户设置默认值、兼容读取、校验与持久化；认证设置 API 经 `packages/api/remotes/src/route-contracts.ts` 校验；Client 类型和默认值来自 `packages/client/connection/src/api.ts`；设置控件由 `packages/client/ui-settings/src/SettingsPage.tsx` 保存；`packages/client/ui-layout/src/Workbench.tsx` 提供现有强度令牌。
- 空闲计时只由 Client UI 生命周期维护，不新增 API、Socket、持久状态、依赖或后台服务。页面隐藏时暂停，恢复可见时从清晰态重新计时。
- 继续使用 `appearance.advanced.reducedMotion`；开启减少动态效果时瞬时切换虚化状态，不做过渡动画。主题、字体、字号、壁纸和遮罩继续按现有外观 Owner 生效。

### 允许修改

- `packages/settings/settings/src/service.ts`、`packages/client/connection/src/api.ts`：新增延迟字段类型、默认值及旧账户兼容读取。
- `packages/api/remotes/src/route-contracts.ts`：校验延迟为 60–3600 秒且必须是 60 的整数倍。
- `packages/client/ui-settings/src/SettingsPage.tsx`：说明并配置空闲开关、延迟与强度。
- `packages/client/ui-chat/src/AiWorkChat.tsx`、`packages/client/ui-chat/src/output-idle-blur.ts`：用可撤销的单一空闲控制器替换回复区指针内外状态与会话持久化；用户活动复位计时，隐藏/卸载清理。
- `packages/client/ui-chat/src/ai-work-chat.css`、`packages/client/ui-workspace/src/module-workbench.css`：让输出内容、刻度、滚动条及回到底部控件使用同一空闲状态和现有强度映射，保持输入框和输入卡片底色清晰；不对大型滚动层执行逐帧滤镜动画。
- `packages/client/ui-layout/src/Workbench.tsx`：把强度百分比映射到 0–8px 模糊半径，不再改变内容透明度。
- `apps/cli/tests/file-storage.test.mjs`、`apps/cli/tests/client-ai-work-idle-blur.test.mjs`：覆盖账户默认值、校验、兼容持久化、计时复位/触发/暂停/清理及 UI 状态绑定。
- `scripts/runtime-build-state.mjs`、`apps/cli/tests/workspace-maintenance.test.mjs`：仅忽略 Vite 在 `apps/web` 下生成的精确命名时间戳配置临时 bundle，并验证该文件不污染指纹、真实 Web 源码变化仍使指纹变化；这是 Web 构建输出被短生命周期临时文件误判的直接修复。
- `packages/settings/README.md`、`packages/client/README.md`、`docs/系统总体架构.md`、`docs/PROMPTS.md`：同步设置与运行行为事实和验收记录。

### 禁止修改

- 不改消息、会话、锚点定位、滚动/自动跟随、输入发送、右侧栏、权限或壁纸 Owner；不保留 hover/键盘焦点作为另一套虚化开关。
- 不持久化鼠标坐标/内外状态，不新增持续轮询、反复重置的高频计时器、API 请求、依赖或无关 CSS 自定义属性；不重置账户已有外观偏好。
- 不改用户外的运行服务，不重启 Vite、Control Plane、Daemon 或桌面，不提交、发布或部署；构建产物仅写仓库根 `dist/`。

### 验收条件

- 新账户延迟默认 60 秒，范围限制为 60–3600 秒并按 60 秒递增；旧账户的缺失或无效值归一到 60 秒，保留其开关、强度、主题和其他外观值。非法延迟由服务端 schema 和设置 Owner 拒绝。
- 页面任一鼠标移动/按键/滚动/触屏交互后回复、刻度、滚动条和回到底部状态清晰；无活动达到配置时长后同步虚化；再次活动时同步恢复。输入框和输入卡片底色始终清晰可用。
- 高频活动只更新时间戳；同一时刻最多一个待处理 idle timeout；隐藏页暂停；卸载或禁用后监听器及计时器均清理。状态更新不引起 React 聊天树重渲染。
- 运行外观设置持久化回归、空闲控制器回归、设置/聊天/工作区相关包构建、Control Plane 与 Web 构建及 `git diff --check`。页面任意真实鼠标移动和输入都应立即恢复清晰；无活动至少 1 分钟后才虚化。复用现有 5173 登录态页面做行为核对时不重启服务；没有浏览器连接或登录态时如实标明未验。未实测物理鼠标帧时间则单独说明。

### 完成记录

- 2026-10-04 原实现：AI Work 虚化改为空闲计时控制；页面活动统一恢复清晰，静止到配置延迟后同步虚化回复内容、刻度、滚动条和回到底部控件，输入框与输入卡片保持清晰。该版本延迟为 5 秒，且旧验证没有覆盖当前 3000 进程加载旧合同后的保存失败；因此不能作为本次故障已修复的依据。
- 本轮修复跟进：设置改为默认 1 分钟、范围 1–60 分钟；活动监听提前到捕获阶段，强度上限降为 8px 且移除透明度映射和大型滚动层滤镜过渡。验证：空闲计时/UI 接线 3/3、账户设置校验与持久化 1/1、Web 指纹回归 4/4；七个相关包、Control Plane 和 Web 构建通过，`git diff --check` 通过。当前 3000 服务 PID 66600 于 16:52 启动，早于当前客户端与 API schema 源码；现在磁盘 Control Plane 产物已在 23:25 重建，但运行进程仍持有旧内存模块。`parseBody` 对 schema 不符返回截图中的通用 400；外观设置的当前请求字段与旧进程合同存在版本差异，能解释该分类保存失败。其余各分类和 Wallpaper Engine 的实际请求体未从浏览器 Network 面板取得，不能据此宣称每项都已定位。按合同不重启服务；CUA 当前找不到 5173 标签页，Edge 自动化也不可用，因此未验证登录态页面保存、实时虚化体验或物理帧时间。未找到 `workspace-preflight` 入口。

## LFAA-UI-PLUGIN-WORKSPACE-01

### 用户目标

按用户选定的 A 方案重排设置中心“插件”页：以单页分区工作台管理插件和扩展能力，缩短主视图、清晰区分数据 Owner 与能力状态，降低混杂感。

### 当前合同

- 运行入口：Web 设置中心 `packages/client/ui-settings/src/SettingsPage.tsx`，由 Web/Tauri 共用设置 UI。只改插件页布局与导航归属，不新增插件、连接或知识数据面。
- 分区：`总览`、`能力目录`、`我的资料库`、`第三方插件`、`MCP 连接`、`运行诊断`。同一时刻只呈现当前分区；知识库面板首次打开时才挂载，切换分区后保留草稿与本地交互状态。
- Owner：账户 `plugins.enabled`、`plugins.prompts`、`plugins.mcpServers` 沿用 UserSettings/Settings Owner 和现有保存/重置合同；能力目录、安装路由和 Cordis 运行状态继续来自现有 Runtime/Plugin Owner；Profile 第三方插件清单与检查仍由 Plugin Manager 管理；知识资料 CRUD 继续委托当前 Knowledge Library API/SQLite Owner。MCP 设置中心“连接”入口跳转到同一工作区的 MCP 分区，不复制表单、状态或存储。
- 视觉：沿用外观设置已映射的主题、强调色、字体、字号、壁纸表面透明度、模糊和减少动态效果；不新增配置、CSS 自定义属性或依赖。
- 状态文字必须对应真实 Owner 返回的数据；登记、已安装、启用和运行分别描述，不把配置状态伪报为在线。
- 性能：只呈现所选页面分区；知识面板按需首次挂载并保持其编辑状态，避免重复读取和切换时丢失草稿；无新增后台轮询或全局事件订阅。插件分区数据加载继续复用现有按分类加载和快照缓存。

### 允许修改

- `packages/client/ui-settings/src/SettingsPage.tsx`：插件分区类型、分栏/导航呈现、总览摘要和既有页面区块归类；MCP 全局设置导航进入同一数据源的 MCP 分区。
- `packages/client/ui-settings/src/SettingsPage.css`：工作区分区导航和总览卡片样式，沿用现有设计令牌并适配窄容器。
- 本合同的索引、验收记录；如实现影响共享设置契约，才更新对应事实文档。

### 禁止修改

- 不调整 Settings、Knowledge Library、Plugin Manager、Cordis 或 MCP 的 API、持久化、权限和执行语义；不把不同 Owner 的数据合并存储。
- 不引入假数据、无法工作的按钮、未经登记的能力和虚构连接/运行状态；不改变 `plugins.enabled` 以外的设置默认值或用户偏好。
- 不顺带重排设置中心其他分类，不删除或覆盖并行工作树中的改动；不重启服务、提交、发布或部署。
- 不新增后台加载、轮询或无界列表处理；构建产物仅写仓库根 `dist/`。

### 验收条件

- 页面提供六个语义明确的分区且仅呈现当前分区；总览能快速查看扩展总开关及真实能力/插件/MCP 概况；知识资料面板不占据插件首页，首次按需挂载后切换分区不丢编辑草稿。
- `连接` 导航与插件工作区的 MCP 分区读写相同 `plugins.mcpServers`，保留现有保存与安全提示，离开/进入不丢设置。
- 第三方插件检查与 Profile 清单、能力目录与 Runtime 登记、Cordis 诊断、知识资料 CRUD 都继续调用各自现有 Owner；不跨 Owner 伪造数量或状态。
- 直接 UI 包构建与 `git diff --check` 通过；静态核对现有设置令牌映射。浏览器目视、MCP 实际服务连接、Provider 加载和帧时间分别如实报告。

### 完成记录

- AI Work 右侧 Git 摘要现可展开受 Daemon 200 文件上限约束的文件列表；点击单文件进入联动审阅器，可查看真实 Git diff、切换统一/并排、过滤空白/import、词级差异、换行、展开/折叠差异区块、复制完整补丁文本或 `git apply` 命令。只在用户主动打开完整文件时经 `project-files-v1` 分段读取；支持 Markdown 预览、完整文件复制和 2 MiB UTF-8 普通文本编辑保存。保存使用 SHA-256 防并发覆盖；失败保留草稿；界面根据文件主要行尾格式写回，并拒绝写入符号链接/特殊文件。嵌套项目的 Git 仓库相对路径与项目文件相对路径分开传递。
- 未新增设置或 CSS 自定义属性；复用 `.workbench-shell` 的 Appearance 主题、强调色、界面/代码字体与字号、遮罩/模糊、diff 标记、减少动态效果。`project-tools` 的 Agent 操作枚举未增加 `write`；补丁命令只复制剪贴板，不自动执行。
- `node --test apps/cli/tests/project-files.test.mjs apps/cli/tests/git-workspace.test.mjs`：5/5 通过，覆盖分页、Unicode/CRLF 写入、旧摘要拒绝、Git 单文件 diff/空白过滤/大文件与嵌套项目路径。
- `pnpm --filter lfaa-web run build`：Client TypeScript 与 Vite 构建通过，产物位于 `dist/apps/web/`；Vite 报告现有大 chunk 警告。`node scripts/build-harness.mjs packages` 构建 97 个能力包到 `dist/packages/`。
- 最后一次 `pnpm run build` 的 Harness 97 包构建和 Web TypeScript/Vite 阶段通过；控制端编译在未改动的 `packages/credentials/deepseek-account/src/index.ts:56` 因模块声明 `@deepseek-ai/cordis` 不存在而停止，CLI 阶段未运行。此前初始全量构建通过早于最终路由/编辑细节，不能替代本次控制端验证。
- `git diff --check` 通过。当前仓库没有 `scripts/workspace-preflight.mjs` 或同名根脚本，未能运行该 Gate。只读浏览器状态检查未发现可用标签页，Edge 自动化返回 `nodeRepl.fetch request failed`；未做登录态界面、真实 Daemon、Provider、主题切换或物理帧时间验收，也未重启服务。

## LFAA-WALLPAPER-ENGINE-APPEARANCE-BOOT-01：外观单一 Owner 与插件启动无闪切

### 用户目标

- 修复刷新后 LFAA 设置中心外观先显示、Wallpaper Engine Client 随后接管画布造成的闪烁/抖屏与重复初始化。LFAA-Harness 继续拥有产品画布和共享外观；官方插件只负责壁纸播放及其专属控件和效果。

### 运行入口、Owner 与设置

- 运行入口：`pnpm lfaa web` 的 Web Client 启动；`apps/web/main.tsx` 先启动不含 Wallpaper Engine 的安全基础图，再由 `packages/client/ui-renderer/src/App.tsx` 恢复用户与设置，`packages/client/modules/src/client/index.ts` 在认证后同步 Profile Client 图。
- 当前证据：账号主题由 Web 首屏 bootstrap 和 Workbench 映射；登录态 Client Profile 图在 React 挂载后由 `useEffect` 异步请求并同步，因此插件画布样式晚于 LFAA Workbench；App effect 清理函数还会在认证 effect 重建时触发一次未认证同步。Wallpaper Engine 插件当前 `themeFollow=false`，本次不将其认定为 LFAA 主题被插件改写的原因。
- 外观/数据 Owner：`appearance.theme`、`appearance.overlay`、`appearance.blur`、`appearance.advanced.reducedMotion` 与 `appearance.advanced.translucentSidebar` 仍归设置中心账户设置；`appearance.wallpaperEngine.enabled/projectId` 控制 LFAA Profile 的插件接入；插件壁纸及其原生面板内部玻璃、播放与主题专属选项仍归插件 Profile。此任务不增加设置项、不改默认值或持久化。
- 复查确认：插件启用且选中项目时，`appearance.backgrounds.*` 仍作为账户保存偏好，但不应成为可见壁纸层；它只在 Wallpaper Engine 未取得画布 Owner 时显示。LFAA 的 `overlay/blur` 仅作用于 LFAA 自有壳层表面，插件 Profile 的壁纸 `scrim/blur/glass` 继续作用于插件壁纸与插件控件；不合并或互写两边配置。

### 允许修改

- `packages/client/ui-renderer/src/App.tsx`：在已启用 Wallpaper Engine 的认证工作区第一次显示前等待 Client Profile 图同步完成；失败时释放 LFAA 工作区并保留真实错误日志；避免 App effect 清理时误发卸载同步。
- `packages/client/modules/src/client/index.ts`、`packages/client/modules/src/client/auth-sync.ts`：令已启动的未认证基础图同步幂等；同一认证目标的并发调用复用进行中的同步；登录与注销仍按现有 LFAA Session 状态装载/卸载 Profile 图。
- 复查修复：`packages/client/ui-layout/src/Workbench.tsx`、`workbench.css` 与同包纯函数；从首帧按 `appearance.wallpaperEngine.enabled/projectId` 决定壁纸画布 Owner。插件拥有已选壁纸时，保留 LFAA 外观令牌用于 LFAA 产品表面，但不再绘制 `appearance.backgrounds` 的第二张壁纸。
- 若核实到画布 Owner 事实需要更新，允许补充 `docs/系统总体架构.md` 的 Wallpaper Engine/LFAA 外观归属说明。
- `apps/cli/tests/` 中与 Client Auth/Wallpaper Runtime 生命周期直接相关的长期回归、相关包 README（仅当本次引入新的公开 Owner 事实时）及本合同实施记录。
- 本次复查的纯策略回归可新增在 `apps/cli/tests/`；更新本合同的复查记录。

### 禁止修改

- 不让插件接管 LFAA 全局主题、账户外观设置或产品 Shell；不复制插件外观设置到第二套 LFAA Store，也不把插件私有设置错误解释为 LFAA 公共遮罩/模糊设置。
- 不改 `data/plugins` 中上游源码、Profile 配置、用户当前壁纸/播放列表/音量及任何外观偏好；不新增定时器/轮询；不重启服务，不清理其他工作树改动。
- 不以隐藏错误或伪造 ready 状态跳过加载失败；构建产物只写根 `dist/`。

### 验收条件

- 壁纸接入启用时，刷新不会先绘制未合成的 LFAA 工作区再切换到插件层；插件 Profile Client 图只同步/加载一次，同步失败仍能进入 LFAA 并记录真实诊断。
- 只要 `appearance.wallpaperEngine.enabled=true` 且 `projectId` 非空，首次 Workbench Render 就标记插件为壁纸画布 Owner，并抑制 LFAA 所选背景图；插件壁纸未激活期间只显示稳定主题画布，不短暂显示另一张账户壁纸。关闭引擎或项目 ID 为空时，LFAA 所选背景行为保持原样。
- 未启用壁纸插件时不等待其 Profile Client 图；退出登录时插件图仍能按现有生命周期卸载。
- LFAA 主题、字体、遮罩、模糊、减少动态效果和侧栏选项继续控制各自 LFAA 表面；插件壁纸/面板专属玻璃与播放设置继续由插件控制，避免对同一节点叠加两层模糊/遮罩。
- 运行新增定向回归、Client/UI Renderer 相关包构建/类型检查及 `git diff --check`。真实登录页面刷新、黑闪/抖屏与帧时间须单独记录；构建不替代浏览器实测。

### 完成记录

- 2026-10-04：认证态且 `appearance.wallpaperEngine.enabled=true` 时，Workbench 首次显示前等待 Client Profile 图同步；同步失败会记录原错误并释放 LFAA 工作区。移除认证 effect 清理时的伪注销同步；Client 同步对已应用目标幂等、同目标并发合并、旧 revision 结果丢弃。未增加/改写外观字段、默认值或用户偏好；未改插件源码、Profile 数据、壁纸/播放状态或运行服务。
- 验证：`dsh-client-module-auth.test.mjs` 3/3、`lfaa-client-modules` 与 `lfaa-client-ui-renderer` 构建、`git diff --check` 通过。`tsc --noEmit -p tsconfig.client.json` 仍被既有未跟踪 `packages/client/ui-workspace/src/GitChangeReview.tsx:328` 的 `"unified"` 参数类型错误阻断；该文件不属于本任务且未修改。真实认证态刷新无法验收：Edge 扩展浏览器当前不可连接；临时 LFAA 页无登录会话，恢复接口返回“找不到请求的接口”。未测物理闪烁、GPU 帧时间及桌面运行。

### 2026-10-04 复查：首帧壁纸画布 Owner

- 前次记录只证明 Client Profile 图同步门控/幂等，不证明插件壁纸已在首帧接管画布。当前复核到 `Workbench` 仍无条件把 `appearance.backgrounds[route]` 写入 `.workbench-shell`；只有插件异步挂载 `body[data-we-wallpaper]` 后才由 CSS 隐藏这层，因此刷新时会先显示账户背景、再切换到插件背景。前次“无闪切”结论范围过宽，现将整体目标重新标记为复查修复中。
- 本轮验收目标：按 `appearance.wallpaperEngine.enabled/projectId` 在 Workbench 首次渲染同步决定壁纸画布 Owner；插件持有时令账户背景不参与画布绘制，同时继续应用 LFAA `theme/accent/fonts/overlay/blur/reducedMotion/translucentSidebar` 到 LFAA 自有壳层表面。插件 Profile `scrim/blur/glass/themeFollow/objectFit` 不被 LFAA 设置覆写；插件未激活期间只保留稳定主题画布，不先闪现另一张 LFAA 背景。
- 只读核对到当前账户 `wallpaperEngine.enabled=true` 且有项目 ID，LFAA 路由背景仍保存 Minecraft 世界图；Wallpaper Engine Profile 的 `scrim=0.25`、`wallpaperBlur=0`、`glassAlpha=15`、`objectFit=cover` 属插件 Owner。当前截图能证明页面状态存在 LFAA 背景和插件壁纸的先后画面，不能单独证明同一帧的双层合成。
- 实现：新增纯策略 `resolveWallpaperCanvasOwnership`。引擎开关为 true 且项目 ID 非空时，Workbench 首次 Render 即标记插件为 canvas Owner、将账户背景 URL 设为 `none`，但仍标记工作区有壁纸供 LFAA 表面令牌生效；关闭引擎或项目 ID 为空时原账户背景逻辑不变。把共享表面透明度/模糊从依赖异步 `body[data-we-wallpaper]` 改为依赖首帧已知的 Owner 属性，因此媒体层激活不再二次改换 LFAA 壳层材质。插件原生 Profile 控件未纳入这些选择器。
- 设置与用户数据：只读取已有 `appearance.wallpaperEngine.enabled/projectId`、当前路由的 `appearance.backgrounds.*`，并继续映射 `appearance.theme/accentColor/advanced.fonts/advanced.interfaceFontSize/overlay/blur/advanced.reducedMotion/advanced.translucentSidebar`。插件 Profile 的 `scrim/wallpaperBlur/glassAlpha/objectFit` 仍由插件独立持有。没有新增设置，没有修改用户偏好、插件 Profile、壁纸选择或运行服务。
- 验证：`node --test apps/cli/tests/wallpaper-canvas-ownership.test.mjs` 3/3 通过；`pnpm --filter lfaa-client-ui-layout run build` 通过；`pnpm --filter lfaa-web run build` 通过（Web 产物写入 `dist/apps/web/`，仍报告既有约 1.36 MB chunk 警告）；`pnpm exec tsc --noEmit -p tsconfig.client.json` 通过；本轮文件 `git diff --check` 通过。`workspace-preflight` 对应的 `.mjs` 与 `.ps1` 脚本均不存在。
- 真实登录态浏览器刷新、屏幕闪烁/抖屏与帧时间、桌面 WebView 本轮未验：当前无法连接已登录 Edge 页面；没有重启服务。构建成功不能替代这部分运行验收。

### 2026-10-06 用户补充：首次进入与窄屏闪屏

- 用户反馈：插件必须刷新后才完全加载；全屏未观察到闪烁，窄屏会闪屏。当前运行入口为既有 `127.0.0.1:3000` Web 服务，验证窗口使用当前已登录浏览器，不创建第二个服务端口。
- 首次进入历史证据：旧登录态页面曾记录 `client-modules: HTML did not preload @deepseek-ai/dsh-client-modules/client.js`，并退回本地 React 根。Host 的注入文件与 bundle 后续均返回 200；本轮在 Web 构建并重载后的实际冷加载验收已在下方记录。
- 窄屏证据：旧会话在 640×900 CSS 像素视口观察到壁纸接管画布，4 个 `backdrop-filter` 层及较大 AI Work 面板面积是待核查的重绘风险，不等于已证明闪屏根因。修复后当前浏览器重新进入 AI Work，在 1600/938/640 宽度均显示同一壁纸；640px 下常规↔AI Work 切换后壁纸 iframe 与背景保留，插件诊断有 `live-ready` 和持续 `live-fps`。用户现有空闲虚化设置持续生效，验收未改它；本次视觉观察不能替代 GPU/物理屏幕帧时间测量。
- 当前 3000 服务在本轮控制端构建后已用确认归属的同一 LFAA Node 服务重启；重载首个深层路由后首次加载已出现 Scene `first-frame-ok`，随后有 `live-ready/live-fps`，不需再次刷新。旧 `client-modules HTML did not preload` 错误早于本次会话；本次没有新增浏览器 error 日志。
- 本轮补充允许范围：`packages/boot/plugin-manager/src/dsh-wallpaper-engine-runtime.ts`、`apps/cli/tests/dsh-wallpaper-engine-runtime.test.mjs`、Plugin Manager README、系统总体架构与相关任务索引/记录。适配器仅修正固定官方同源 iframe 文档响应的帧头，不更改认证、Scene 文件处理、Range、路径围栏或用户设置。
- 禁止修改用户的壁纸、播放列表、外观偏好、Wallpaper Engine Profile 或其 `data/plugins` 上游源码；不动 Minecraft 实例/Daemon，不增加服务或端口，不绕过认证和权限，不清理其他工作区改动。构建后如需使 Web 产物生效，只允许在确认 PID/命令行仍对应当前 LFAA `127.0.0.1:3000` 服务后重启这一服务；不重启其他进程。
- 验收结果：在登录浏览器重新载入首个深层路由后无需二次刷新，DSH Wallpaper Engine 壁纸层和 Scene iframe 可见；Scene 诊断记录 `first-frame-ok`、`live-ready` 与 30 FPS。1600/938/640px 视口均显示壁纸，640px 下常规↔AI Work 往返后 iframe 保留。Runtime 定向回归 3/3、`pnpm run build:control-plane`、`pnpm run build:web` 和 `git diff --check` 通过。界面当前沿用账户空闲模糊设置；此次检查没有改变该设置。没有硬件高刷采集工具，物理闪屏和 GPU 帧时间未验。

### 2026-10-06 补充：Scene 实时渲染源与唯一 Web 端口

- 旧浏览器会话曾在同一 Node 进程上看到 3000 之外的临时媒体监听，并因 iframe 内容不加载而回退；本轮 adapter-7 已关闭该媒体监听，Scene 的 `mediaBase` 只指向当前 3000 Host。
- 用户授权维持本机 LFAA 服务在 3000，按本合同在必要构建后只重启已核实归属 LFAA 的该进程。浏览器须验证冷进入无需二次刷新、场景 iframe持续 live、`mediaBase` 不含第二端口、3000 Scene Range 请求完成，以及 1600/938/640 宽度和窄屏进出工作区稳定。浏览器无法提供高刷屏硬件测量时，须把视觉检查与物理帧时间区分报告。
- 插件已有同源 `/wallpaper-engine/scene-files/:token/*` 挂载，由 LFAA `DshWebServerCarrier` 的认证中间件保护，并直接复用上游 `handleSceneFiles(..., 'app')`、Range 与两层路径围栏。所有 LFAA Profile 的 Scene `mediaBase` 为空时 Client 回落到当前页面 origin，因此继续使用既有 WebServer 监听器和用户指定的唯一 `127.0.0.1:3000` 开发入口；不新增代理、不放宽鉴权、不写用户数据。诊断 `/media-origin` 必须返回无独立媒体源，且任何插件调用都不能启动第二监听。
- `packages/boot/plugin-manager/src/dsh-wallpaper-engine-runtime.ts` 已升级至 `adapter-7`：核验官方 `lib/routes/scene-serve.js` 的场景路由、资源路径围栏、缓存头和 `serveFile` 锚点，只对 `rest === 'index.html'` 写 `X-Frame-Options: SAMEORIGIN`；去掉运行副本中的独立媒体监听，保留 Host 同源认证 Scene 文件路由、Range 和双层路径围栏。适配来源发生结构变化时拒绝启用。
- `apps/cli/tests/dsh-wallpaper-engine-runtime.test.mjs` 增加同源帧头范围、场景路由/路径围栏 fail-closed 和 adapter-7 运行副本断言。同步更新 Plugin Manager README 与系统总体架构事实，没有编辑用户 Profile 上游源码或更改壁纸/外观偏好。
- 构建并重启唯一的 LFAA `127.0.0.1:3000` 服务后，浏览器在 AI Work 冷载入首个深层路由无需二刷；Scene iframe 持续 `live-ready`，诊断 `live-fps` 报 `rnd=30/cap=30`。1600、938、640px 视口均可见壁纸；640px 下常规↔AI Work 切换未拆除 Scene iframe。当前端口核对只见 3000。硬件物理闪屏与 GPU 帧时间未测。

## LFAA-UI-GIT-CHANGE-EDITOR-01

### 用户目标与运行入口

把 AI Work 的 Git 变更摘要升级成与编辑器联动的变更审查工作区：能查看当前项目/AI Worktree 实际改了哪些文件和行，打开单文件差异与完整文本，必要时直接编辑保存；从右侧变更摘要、文件列表和编辑器之间可相互定位。界面参照附件中的变更卡片和差异工具栏，不接入 PR、远端 Git 或自动审查服务。

### Owner、数据与设置

- 入口：Web 与共用 Client 桌面 WebView 的 `packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 右侧上下文栏，AI Work 当前项目的 `GitChangeSummary` 是唯一导航入口；文件列表、差异和编辑器使用同一项目及状态快照。
- Git 状态/差异只来自目标 Daemon 的现有 Git Workspace Owner；项目文件读取/保存复用 `project-files-v1` 任务执行器。认证 Workspace Controller 从当前账户与 `appId` 项目登记解析节点、根目录，浏览器只提交项目 ID 与安全的项目相对路径；Daemon 继续验证真实路径、符号链接、普通文本和文件大小。
- 编辑保存须携带最近读取的 SHA-256；文件在编辑期间发生变化时拒绝覆盖并要求重新读取。不能把浏览器任意绝对路径、Git 子命令或未经核验补丁交给 Daemon。
- 支持已登记项目中的 UTF-8 普通文本文件，沿用 Daemon 已有 2 MiB 文件上限和受界读取；二进制、超限、删除中或截断数据明确禁用编辑。保存是用户主动操作，不自动写回源项目以外的位置、不提交/推送/合并。
- 设置中心：无新增设置；使用 `.workbench-shell` 现有主题、强调色、文字/界面字体、代码字体与字号、对比度、壁纸遮罩/模糊、diff 标记和减少动态效果映射，不新增 CSS 自定义属性或依赖。

### 必须支持的交互

- 变更摘要显示真实文件数、增删行数、分支/基线和每文件状态/增删行数；列表完整遵守 Daemon 返回的 200 文件上限，超过时显示截断，不丢弃状态提示。单击文件打开对应差异；“查看全部/显示文件”进入同一审查器并可折叠文件列表。
- 单文件差异显示真实统一 diff，可在统一/并排呈现、自动换行、隐藏空白改动、隐藏 import 改动、单词级差异和展开/折叠所有 diff 区块间切换；Markdown 文本可切换渲染预览。过滤只影响视图，不改变 Git 输出或保存内容。
- 支持刷新状态、跳转到当前文件文本、切换完整文件/差异、编辑/保存/放弃未保存修改、键盘进入完整视图（Ctrl+Shift+F）及关闭返回原文件/聊天。编辑前后保持当前项目、App、选中文件和右侧变更列表关联；保存成功后读取真实 Git 状态更新行数和列表。
- 对受管 AI Worktree 显示有明确确认的恢复到登记基线操作；这是整棵受管工作树恢复，不伪装成“撤销某条 AI 回复”。普通源项目不显示恢复操作。复制 `git apply` 仅能复制完整、未截断的真实补丁命令/内容，产品不执行该命令；若当前 Daemon 未提供可验证的完整补丁则保持禁用并解释原因。
- 不模拟 Codex 的 ChatGPT App Tools 等来源。侧栏只展示 LFAA 可证明的项目、源项目/Worktree 关系、分支和 Git 状态。

### 允许修改

- `packages/client/ui-workspace/src/GitChangeSummary.tsx`、`ApplicationWorkspace.tsx`、`module-workbench.css` 及必要的新 UI-workspace 组件：升级右侧摘要并实现项目内变更审查/文本编辑器联动。
- `packages/client/connection/src/api.ts`：封装经认证的项目文件读取与带摘要校验的写入接口。
- `packages/api/workspace-controller/src/index.ts`、相关 route contract/README：按账户、App、项目登记和节点能力校验后派发有界读取/写入任务。
- `packages/host/daemon/src/project-files.mjs`：扩展现有安全文本执行器的编辑读取分页与摘要校验写入；Agent Tool 的操作范围不得因此静默扩张。
- `apps/cli/tests/project-files.test.mjs`、相关 Git/API 回归、当前架构及本合同：覆盖路径/大小/并发摘要和差异视图边界，更新事实记录。

### 禁止修改

- 不新增平行 Git 服务、编辑器数据 Owner、身份/Session 或任意 Shell API；不把“变更摘要”说成 Git 提交、PR 或 AI 消息级文件归因。
- 不在源项目中提供整树重置；不自动应用 Git 补丁、提交、推送、合并或删除文件。工作树恢复仍只使用现有受管 Worktree Owner 和确认合同。
- 不引入未经项目规则批准的第三方 IDE/差异库；不引入假 diff、假保存成功、未验证的文件来源或无界文件列表。
- 不改用户已有设置、不重启现有服务、不提交/发布/部署；所有构建产物只写根目录 `dist/`。

### 验收条件

- 已登记 Workspace/Minecraft AI Work 项目右侧摘要可查看真实状态；从列表打开单文件差异后可定位、刷新、浏览完整文件并在允许类型内编辑保存，成功后同一面板显示更新后的真实 Git 状态。
- 对账户/App/项目越权、路径穿越、符号链接越界、删除/二进制/超限文件、并发改写摘要过期均拒绝；失败时保留编辑草稿并给出可恢复说明。
- 差异工具栏各切换只改变展示；布局跟随外观配置；新增读取仅在用户打开/刷新/加载完整文件时触发，未选择文件时不读内容，所有请求按项目/文件变化取消过期结果。
- 运行 project-files/Git 定向回归、受影响包构建、Web 构建、`git diff --check` 及仓库要求的真实存在 Gate；尝试登录态浏览器验收。分别报告 Daemon、Provider、浏览器、主题切换和物理帧时间未覆盖项。

### 完成记录

- 已接入右侧真实 Git 变更摘要、最多 200 项文件列表、单文件统一/并排差异和截图中对应的差异浏览操作；支持空白/import/单词差异显示选项、折叠区块、自动换行、刷新、完整文件/Markdown 预览、完整补丁或 `git apply` 命令复制（仅复制，不执行）。
- 文本编辑通过项目文件 Owner 分页读取并以 SHA-256 防止覆盖并发修改；保存保留原换行风格。文件路径、账户/App/项目绑定、UTF-8、2 MiB 上限、符号链接和二进制限制由服务端校验；没有扩大模型 `project-tools` 写入权限。
- 设置中心没有新增设置；界面沿用现有外观主题、强调色、字体字号、遮罩/模糊、diff 标记和减少动态效果映射。改动文件和职责见本任务允许修改范围及相关 package README。
- 验证：`node --test apps/cli/tests/project-files.test.mjs apps/cli/tests/git-workspace.test.mjs` 5/5；`node scripts/build-harness.mjs packages` 构建 97 个能力包通过；`pnpm --filter lfaa-web run build` 的 TypeScript 与 Vite 构建通过，产物位于根 `dist/`；`git diff --check` 及新增任务文件尾随空白检查通过。
- 完整根构建曾在未改动的 `packages/credentials/deepseek-account/src/index.ts:56` 因 `TS2664` 找不到 `@deepseek-ai/cordis` 模块增补目标而失败，Control Plane/CLI 后续阶段未完成；仓库未提供 `scripts/workspace-preflight.mjs`，该 Gate 未运行。
- 登录态浏览器不可用（无可用标签页，Edge 自动化连接失败），因此浏览器视觉交互、真实 Daemon/Provider 端到端、主题切换和物理帧时间未验收；未重启服务。

## LFAA-UI-AI-WORK-SIDE-CHAT-01

### 用户目标与运行入口

在 AI Work 工作区右侧工具栏增加“侧边聊天”，支持工具栏点击、`/side` 输入命令打开及设置中心快捷键（默认 `Ctrl+Alt+S`）。用户可在主聊天继续执行任务时，在侧栏针对当前会话提问；关闭侧栏不停止侧聊 Run，展开侧栏也不改变主聊天的活动消息、跟进队列、模型选择或取消控制。

### Owner、上下文与安全边界

- UI 入口由 `packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 统一控制；主聊天命令只调用打开侧栏回调，右栏侧聊使用自己的 Session、消息状态、AbortController 和 SSE 订阅，不调用主聊天的 Busy、续问、取消或选中会话回调。
- 侧聊创建通过认证 Session Controller，并由现有 `lfaa-session` 在源 Session 的最新已记录事件序号建立精确前缀分支；账户、App、项目绑定继承源会话。源会话不写入侧聊事件。快照包含已提交的用户消息与完整助手回答，不复制内存中的未持久化流式片段；复制前缀中未闭合的轮次/工具由现有 fork 修复语义在侧聊分支中安全闭合，不重放副作用。
- 新侧聊 Session 持久化其源 Session ID 与快照序号。Session Controller 在创建与专用流入口校验账户所有权和源会话关系；Agent Loop 的统一 Run Owner 在每次运行时强制 `allowedToolNames: []`、`canAskUser: false`、`memoryEligible: false`，跳过 MCP 发现并使用解释上下文的系统提示词。该限制也覆盖普通聊天流及排队续问，不能只依赖前端隐藏按钮。
- 侧聊复用当前应用已启用 Provider 与 Agent Loop；不新建 Provider、模型、Session Store、Agent、Daemon API 或权限设置。主任务原有工具调用、授权与事件订阅完全独立。
- 设置中心配置：在现有账户级 `shortcuts` 中新增 `openSideChat`（默认 `Ctrl+Alt+S`），补齐服务端默认值、校验/持久化、客户端类型与默认映射及快捷键 UI；重复快捷键复用现有冲突校验。快捷键在聊天输入框聚焦时仍应打开侧栏。侧聊 UI 沿用现有 Appearance 主题、字体/字号、强调色、背景透明度/模糊与减少动态效果映射；不新增样式变量或外观设置。

### 允许修改

- `packages/core/session/src/kernel.ts`、`packages/core/session/src/sessions.ts`：类型化保存侧聊来源标记，在 Session Owner 中建立活动会话快照分支并验证账户/父会话关系。
- `packages/api/session-controller/src/index.ts`：认证创建侧聊分支并为侧聊 Session 提供专用流路由；`packages/core/agent-loop/src/runs.ts`、`execute-turn.ts`：由统一 Run Owner 对普通提交、专用流和排队续问按来源标记执行无工具、不澄清、不写记忆限制，并跳过 MCP 发现。
- `packages/client/connection/src/api.ts`：封装侧聊分支创建与独立 SSE 流。
- `packages/client/ui-chat/src/AiWorkChat.tsx`、必要的侧聊面板组件及 `ai-work-chat.css`：解析 `/side`、实现独立消息/输入/流状态和自然语言错误提示。
- `packages/client/ui-workspace/src/ApplicationWorkspace.tsx`、`module-workbench.css`：右栏入口、可配置快捷键和侧栏显示/隐藏联动。
- `packages/settings/settings/src/service.ts`、`packages/api/remotes/src/route-contracts.ts`、`packages/client/ui-settings-general/src/default-settings.ts`、`packages/client/ui-settings/src/SettingsPage.tsx`：已有快捷键分类的类型、默认、服务端校验与设置 UI。
- 对应的 Session/Controller/UI 定向回归、包 README、`docs/系统总体架构.md`、`docs/开发计划.md` 与本合同完成记录。

### 完成记录

- 已实现右侧工具栏入口、`/side`（后缀可作为侧聊草稿）及设置中心快捷键 `shortcuts.openSideChat`；侧聊使用独立 Session、消息、草稿、SSE 和取消订阅，不读取主 Run ID 或控制主聊天。侧聊快照包含打开时 Session Owner 已记录的上下文，明确提示未持久化流式文本和进度不可见。
- Agent Loop 按 Session 来源标记在唯一 Run Owner 处覆盖调用方配置，普通提交和 `appendAiRunInput` 排队续问均无法获得工具、MCP 发现、用户澄清或账户记忆写入；主会话任务与侧聊运行独立。
- 设置中心新增账户级 `shortcuts.openSideChat`，默认 `Ctrl+Alt+S`；旧快捷键记录读取时继承该默认值。服务端快捷键字符校验同步支持 `+` 和既有默认 `Ctrl+``，并由回归覆盖默认集合与旧配置兼容。侧聊使用现有 Appearance 主题、字体、字号、强调色、透明度、模糊和减少动态效果配置；未新增 Appearance 配置或 CSS 自定义属性。
- 验证：`node scripts/build-harness.mjs` 构建 95 个能力包通过；`pnpm --filter lfaa-web run build` 的 TypeScript 与 Vite 构建通过，产物位于根 `dist/`；从 `apps/cli` 使用 `node --import tsx --import ./register-package-loader.mjs --test tests/agent-runtime.test.mjs tests/session-kernel.test.mjs tests/session-kernel-persistence.test.mjs`，13/13 通过；`git diff --check` 通过。仓库未提供 `workspace-preflight` 或独立 quality/release Gate。
- 登录态浏览器交互、主任务与真实 Provider 同时运行、主题切换和物理帧时间未验收；未重启服务或执行提交、发布、部署。

### 禁止修改

- 不停止、排队、注入或取消主任务；侧栏的发送/关闭/报错不得通过主聊天 Session API 修改主运行状态。
- 不把主会话活动 Run ID、AbortController、followup 或未持久化流式回答复制到侧聊；界面需说明侧聊使用开启时已记录的上下文快照。
- 不给侧聊开放 Shell、项目文件、Daemon、MCP、子 Agent 或用户澄清工具；服务端必须拒绝超出只读解释用途的能力。
- 不修改其他应用工作流、用户已有快捷键/外观偏好或无关脏文件；不提交、部署、重启服务，构建产物只写根目录 `dist/`。

### 验收条件

- 右侧工具栏点击、输入 `/side` 和默认/用户自定义快捷键均可打开当前 AI Work 会话的侧聊；快捷键在输入区域焦点内也有效。`/side` 后的可选文本作为侧聊草稿保留，不误发给主聊天。
- 主 AI Work 有活动 Run 时打开、发送多轮侧聊、关闭/重开侧栏，主任务 Run ID、用户消息、SSE 和取消状态都不变化；侧聊可独立流式回复并恢复其已持久化消息。
- Session Owner 回归覆盖活动主会话快照、只读拷贝范围、来源关系校验、账户隔离和主会话不变；Controller/Agent Loop 回归证明所有侧聊路径均无可用 Tool/用户澄清能力。
- 运行 Session/Controller/Settings 与 UI 定向回归、相关包构建、Web 构建、`git diff --check` 和现存仓库 Gate；分别报告 Provider、登录态浏览器、服务端并发运行、主题适配及物理帧时间未实测项。不得把包/Web 构建描述成真实 Provider 或浏览器验收。

## LFAA-AI-PLAN-MODE-01

### 用户目标与运行入口

在 AI Work 增加“先讨论计划、用户确认后再执行”的协作模式。支持 `/plan` 进入、`/plan <需求>` 边进入边提交目标、`/plan off` 退出；普通自然语言明确表达“先做计划再实践”时，由当前 Provider 模型理解意图并开启计划模式。计划讨论可跨多轮持续，用户可继续补充/修订；可通过明确的“批准并执行”操作或模型按用户明确自然语言确认，将任务交回同一 Agent Loop 执行。

### Owner、状态与权限

- 入口：AI Work 共用聊天 `packages/client/ui-chat/src/AiWorkChat.tsx`；Web 与桌面继续共享 Client 实现。
- 唯一持久化 Owner：`lfaa-session` 的 JSONL Session 事件日志，以 `session/plan-mode` 状态事件记录模式；会话列表返回当前状态。新分支按现有 Session 前缀事件语义继承计划上下文；重载后按日志恢复。
- 模式切换：显式 slash command 经认证 Session Controller 校验账户与 App；自然语言只由已选 Provider 模型选择 Agent Loop 注册的计划模式工具，不新增关键词分类器、模型账户或后台服务。
- 执行闸门：唯一 Run Owner/Agent Loop 在真实工具执行边界检查当前 Session 模式。规划期间只允许经参数校验后风险为 `read` 的工具；写入/危险工具、电脑操控和领域子 Agent 均不得派发。模型从规划模式发起转换时，该 Provider 响应中的并行任务工具调用一律记为 `not_started`，须在下一次模型请求重新选择。
- 退出规划并执行只能来自用户显式批准按钮或模型对当前用户明确批准语句的理解；模式退出后仍经现有 Tool Scope、权限模式、逐项审批、领域 Owner 和 Daemon 合同执行，不绕过任何授权。规划回复本身不能证明任务已经执行。
- 设置中心盘点：不新增配置或默认值。模型/Provider、App、工具允许范围、权限模式、AI Runtime 预算继续使用当前设置 Owner；模式状态由 Session Owner 持久化；UI 沿用现有 `appearance.theme`、强调色、字体/字号、对比度、壁纸遮罩/模糊及减少动态效果映射。

### 允许修改

- `packages/core/session/src/kernel.ts`、`packages/core/session/src/sessions.ts`、Session README：类型化并校验计划模式事件，提供账户隔离的读取/设置方法并将状态投影到 `AiSessionView`。
- `packages/api/remotes/src/route-contracts.ts`、`packages/api/session-controller/src/index.ts`、Controller README：校验 slash 命令模式字段与无活动运行的显式切换路由。
- `packages/core/agent-loop/src/runs.ts`、`execute-turn.ts`、Agent Loop README：向模型注册计划模式转换能力、注入计划协作约束，并在工具派发前强制只读边界与并行调用 defer 规则。
- `packages/client/connection/src/api.ts`、`packages/client/ui-chat/src/AiWorkChat.tsx`、`ai-work-chat.css`：`/plan`、模式状态说明、“批准并执行”确认入口和自然语言模式切换后的状态刷新。
- `apps/cli/tests/**` 中 Session/Agent Loop/Controller 的定向回归、`docs/系统总体架构.md`、`docs/开发计划.md` 与本合同验收记录。

### 禁止修改

- 不写自然语言关键词正则/硬编码意图路由；不把计划模式做成只有前端状态或只有 System Prompt 的软提示。
- 计划讨论期间不允许任何写入、危险操作、电脑动作或子 Agent 派发；不得在用户批准前自动退出模式或自动执行计划。
- 不另建 Agent、Session、计划数据库、Tool 授权、设置项或后台服务；不更改已有权限模式语义，不重放历史工具调用。
- 不改 DSH 参考仓库；`H:\deepseek-harness\packages\plan` 只用于行为对照。保留所有既有脏工作区内容，不停止/重启服务，不提交、部署、发布或清理；构建产物只写根 `dist/`。

### 验收条件

- `/plan` 可进入并在 UI 明确显示当前会话处于计划讨论状态；`/plan <需求>` 把去掉命令的完整需求作为用户消息提交；`/plan off` 可退出但不启动任务。刷新、切换会话和 Session 分支均显示正确的持久状态。
- 模型可根据自然语言先请求进入计划模式；进入动作与任何其他任务工具调用同时返回时，其他调用均有 `not_started` 证据并未派发。模式切换工具及模型请求保存在现有 Session 证据中。
- 计划讨论仍可使用只读能力；所有非只读、领域委派、电脑操控在执行点被拒绝，且不会通过完全权限或排队续问绕过。读工具失败按原错误路径返回。
- 用户点击“批准并执行”或明确自然语言同意后才退出计划模式；之后任务使用原权限/审批/Owner 并继续当前 Session 上下文。继续讨论/要求修改时保持计划模式。
- 运行 Session 状态/账户隔离与 Agent Loop 工具派发定向回归、受影响包构建、Web 构建、`git diff --check` 及当前仓库实际存在的必需 Gate。Provider 自然语言理解、登录态浏览器、真实 Daemon/工具副作用、桌面表现和物理帧时间分别报告是否实测。

### 完成记录

- `/plan`、`/plan <需求>`、`/plan off` 已接入共享 AI Work；新会话的首次请求可随消息一起设置状态。计划状态通过 `session/plan-mode` JSONL 事件持久化、恢复并按 Session 前缀分支；自然语言状态转换由当前模型专用工具触发，并经 SSE 即时同步到 UI。
- Agent Loop 在工具派发点执行只读闸门；模型切换模式时并行任务调用记为 `not_started`。批准后继续使用现有权限、工具审批和业务 Owner；不新增设置项、Session、Agent 或数据库。
- Session 内核/持久化与 Agent Runtime 定向回归 15/15 通过，覆盖账户隔离、活动任务状态变更拒绝、JSONL 重启恢复、分支继承、侧聊拒绝、全权限下写入拦截、只读调用、计划批准后仍走写入审批和模式 SSE 事件。
- `pnpm --filter @yubboo/lfaa run build` 通过；`pnpm --filter lfaa-web run build`（客户端 TypeScript 检查及 Vite 构建）通过；`git diff --check` 通过。Web 构建输出 Vite 大 chunk 警告。
- 仓库未发现 `workspace-preflight` 或 `quality:full` 可执行入口，因此未运行这些 Gate。合成 Provider 仅验证 Loop 接受预期计划工具调用，不证明真实模型能正确理解自然语言；登录态浏览器/移动布局、真实 Daemon 工具副作用、桌面表现和物理帧时间未验。

## LFAA-UI-AI-WORK-SETTINGS-COMPAT-01

### 用户目标与运行入口

修复 AI Work 页面在当前设置响应缺少新增 `shortcuts.openSideChat` 字段时整个工作区崩溃的问题。当前 5173 登录态浏览器可复现：从应用中心进入任一 AI Work 后，React 报 `Cannot read properties of undefined (reading 'map')`，根因是 `ApplicationWorkspace` 对新快捷键数组直接调用 `.map()` 和 `.some()`。

### Owner、设置与边界

- 目标入口为共享 Client 的 `apps/web` AI Work；组件 Owner 为 `packages/client/ui-workspace/src/ApplicationWorkspace.tsx`。Session、Agent 与消息能力不参与本故障。
- 当前账户快捷键唯一配置 Owner 是 Settings；界面首选 `settings.shortcuts.openSideChat`，缺少该新增字段时回退到现有 `DEFAULT_USER_SETTINGS.shortcuts.openSideChat`。尊重已保存的空数组，不覆盖用户主动清空的快捷键。
- Web/桌面共享同一 Client，因此兼容保护同时覆盖各 Work 应用和桌面壳；不新增设置、存储、服务端接口或常量副本。
- 性能与生命周期：仅在组件渲染时读取当前设置对象；不增加请求、订阅、定时器或监听器。

### 允许修改

- `packages/client/ui-workspace/src/ApplicationWorkspace.tsx`：安全解析侧边聊天快捷键，并在按钮展示与键盘监听中统一使用解析结果。
- `packages/client/ui-chat/src/client/index.ts`：登记同包 `AiWorkSideChat` 组件，使现有懒加载 ID 有真实 Client Module Owner。
- `packages/client/ui-workspace/package.json`：声明读取现有设置默认值包的直接依赖和 Client 注入关系。
- `packages/client/README.md`、本文件：记录兼容行为、模块登记、合同和实际验收结果。

### 禁止修改

- 不更改现有快捷键默认值、设置 API、账户设置数据、权限、Session 或聊天行为；不在工作区组件复制硬编码默认值。
- 不调整布局、主题、壁纸、插件或其他 Work 功能；保留工作区既有脏改动和运行服务，不重启服务、不提交、不发布。
- 所有包构建输出只写仓库根 `dist/`。

### 验收条件

- 当 `openSideChat` 缺失、有效或为空数组时，所有应用 AI Work 均能正常渲染；缺失字段显示既有设置默认快捷键并能触发侧聊，空数组保持“未分配”。
- 从 `ApplicationWorkspace` 打开侧聊时，懒加载模块已在 Client Module Registry 登记，不出现“浏览器模块未装配”或错误边界清空整个工作区。
- 对现有设置默认值包与工作区包构建，并在当前 5173 登录态页面打开 Minecraft、SteamCMD、写作和通用任务的 AI Work，检查无 React 错误且页面主体可见；不发送消息或触发任务。
- 运行 `git diff --check`；不把包构建说成浏览器验收，也不以一次应用验证代表所有应用通过。

### 完成记录

- 2026-10-05：按登录态 5173 页面的 React 堆栈定位到 `settings.shortcuts.openSideChat.map()` / `.some()` 在旧 Host 响应字段缺失时崩溃；补充安全回退到 Settings Owner 的 `DEFAULT_USER_SETTINGS.shortcuts.openSideChat`，明确保留用户主动保存的空数组。随后复现第二处错误：懒加载请求的 `AiWorkSideChat` 未登记到 Client Module Registry，故在 `ui-chat` Client 入口补齐注册，并声明工作区读取 Settings 默认值包的直接依赖和 Client 注入关系。
- 设置与性能边界：只读取已装配的快捷键设置；未新增设置项、API、请求、订阅、计时器或持久化。侧聊快捷键继续使用现有 `shortcuts.openSideChat`，缺失字段使用现有默认值 `Ctrl+Alt+S`。
- 验证：`pnpm --filter lfaa-client-ui-workspace run build`、`pnpm --filter lfaa-client-ui-chat run build`、`pnpm --filter lfaa-web run build`、`node --test apps/cli/tests/agent-runtime.test.mjs`（1/1，覆盖缺失旧快捷键字段时继承 Settings 默认值）和 `git diff --check` 通过。Web 构建报告一个大于 500KB 的既有分块警告。
- 2026-10-05 登录态 IAB 验收：Minecraft、SteamCMD、写作和通用任务 AI Work 页面主体均显示，无 React slot 错误边界；Minecraft、SteamCMD、通用任务侧聊入口显示 `Ctrl+Alt+S`。打开侧聊后 Client 组件已正常挂载，但当前运行中的 Control Plane 对侧聊会话接口返回“找不到请求的接口”；未发送聊天消息、未重启运行服务。该运行态接口问题与本次页面空白根因分开记录。
- 物理键盘帧时间、真实 Provider/Daemon 侧聊端到端、桌面壳验收未运行。工作区已有大量并行改动，本轮保留原样，未清理或提交。

## LFAA-SETTINGS-APPEARANCE-WALLPAPER-ID-01

### 用户目标与运行入口

修复设置中心账户外观分类保存失败。目标入口是 5173 Web 设置中心的“立即保存”，通过 Settings Owner 的 `PUT /settings/appearance` 写入当前账户设置。重新登录态复测已收到通用格式错误；真实账户外观配置中的 Wallpaper Engine 项目 ID 是数字字符串，导致共享外观 Schema 拒绝整个保存。

### Owner、设置与边界

- 账户设置由 `packages/settings/settings/src/service.ts` 提供默认值、归一化、账户隔离与持久化；API 请求 Schema 必须接受此 Owner 已支持的值，不得用并行规则阻止既有已保存数据。
- `appearance.wallpaperEngine` 默认 `{ enabled: false, projectId: "" }`。Settings Owner 接受空 ID，或最多 180 个 ASCII 字母、数字、下划线、连字符；空 ID 会使开关归一化为关闭。保留当前账户的启用状态和项目 ID。
- DSH Wallpaper Engine 插件自己的设置路由是另一数据 Owner。截图中的同一条设置页全局错误不能证明该独立路由失败，本合同不改变插件路由、内容或运行配置。
- 本故障没有新增设置项。保持 `appearance.advanced.aiWorkOutputFocusBlurEnabled`（默认开启）、`aiWorkOutputFocusBlurIdleSeconds`（默认 60 秒、范围 60–3600 秒且整分钟递增）与 `aiWorkOutputFocusBlurPercent`（默认 33%、范围 0–100）的账户持久化和前端映射不变。

### 允许修改

- `packages/api/remotes/src/route-contracts.ts`：让外观 API Schema 的 Wallpaper Engine `projectId` 字符集和上限与 Settings Owner 一致。
- `apps/cli/tests/file-storage.test.mjs`：将现有外观账户保存回归覆盖数字/字母 ID、非法字符和超长 ID。
- `packages/settings/README.md`、本文件：记录 Owner 契约、根因、边界和实际验收结果。

### 禁止修改

- 不放宽认证、账户隔离或其他外观字段校验；不迁移、重置或改写用户的外观设置和 Wallpaper Engine 项目 ID。
- 不更改 DSH 插件设置路由、设置中心其他类别、空闲虚化行为或用户偏好；不停止 Vite、Daemon 或 Minecraft 实例。
- 不提交、推送、发布或清理构建产物；控制端重载使用现有 `--no-local-daemon` 参数。
- 仅使用已有账户外观设置，不添加 API 请求、轮询、监听器或新配置。构建产物仍只写根目录 `dist/`。

### 验收条件

- API 外观 Schema 接受 Settings Owner 支持的数字/字母/下划线/连字符 ID（最多 180 字符）及空字符串；拒绝非法字符和超长 ID。
- 隔离回归覆盖历史外观值、虚化设置默认值、Wallpaper Engine ID 校验及账户持久化；生产控制端数据不参与测试。
- 相关回归、Control Plane 构建、设置页登录态保存和重载核验通过；健康接口与 5173 的页面代理保持正常，Vite 和 Daemon 进程保持原 PID。
- 另行报告未覆盖的设置类别、独立插件设置路由及 Provider/Daemon/桌面验收；不得以一次外观页保存宣称所有设置类别全部验收。

### 完成记录

- 2026-10-05：对照 Settings Owner 与当前账户配置定位根因：Owner 接受最多 180 字符的数字/字母/下划线/连字符项目 ID，API Schema 却要求 32 位十六进制，导致整个 `appearance` 分类 PUT 被拒绝。将 API 校验对齐 Owner；没有迁移或改写用户配置。
- 验证：`apps/cli/tests/file-storage.test.mjs` 定向回归 1/1 通过（数字和一般合法 ID 被接受，非法字符及超长 ID 被拒绝）；`pnpm --filter @yubboo/lfaa run build` 控制端构建通过；`git diff --check` 通过。5173 登录态 Appearance 页提交当前设置显示“保存成功”，刷新后仍显示原外观设置；`http://127.0.0.1:3000/api/health` 返回 `status: ok`。保留现有 Vite 进程，只重启了使用 `--no-local-daemon` 的 Control Plane。
- 范围：本次确认并修复的是共用账户 `appearance` 分类整包保存错误；常规分类另做当前值同值保存烟雾检查并通过，刷新后设置页正常加载。导航至 Wallpaper Engine 插件设置页未看到通用账户设置错误提示，但插件自己的保存未验；未逐项提交其余设置分类。AI Work 空闲虚化实际计时、帧时间、Daemon/桌面行为未复测。

## LFAA-AGENT-WORKFLOW-CANVAS-01

### 用户目标与运行入口

在 Minecraft 常规工作区提供无限画布式 Agent 工作流编辑器。用户可摆放多个 Agent 节点、连线表达依赖、保存版本并手动运行；执行时每个节点按依赖顺序通过现有 Agent Loop 在同一 Minecraft Session 内运行，节点可选的 Minecraft Tools 仅作为该节点的 Agent 工具允许范围。首版只支持无环有向图，分叉全部执行、汇合等待所有上游节点，不支持循环、定时触发或其他 App。

入口为共享 Client 的 Minecraft 常规模式“工作流”页面；Web 与桌面共用实现。画布只负责编辑与呈现；Agent Loop、Minecraft 业务服务和目标 Daemon 持有实际工具调用、授权、审批、持久任务和真实执行结果。

### Owner、设置与权限

- 工作流定义与运行快照由新增 `packages/workflow/workflow` 唯一 Owner 管理，按账户隔离保存 SQLite 记录；运行记录引用现有 AI Session/Run，Session 事件仍归 JSONL Session Owner。数据库迁移保留已有数据。
- Agent 节点由现有 `packages/core/agent-loop` 启动，节点所选 Tool 名称作为 `allowedToolNames` 范围传入；参数校验、风险判断、用户审批、澄清和真实 Minecraft 操作继续由当前 Tool、Minecraft、Permission、Session 与 Daemon Owner 执行。页面不得直接执行工具或 Daemon 操作。
- 界面复用 Minecraft 当前外观配置和共享设计令牌：`appearance.theme`、强调色、字体/字号、对比度、Minecraft 背景/遮罩/模糊、`appearance.advanced.reducedMotion`。使用既有 `permissions.mode`、`aiRuntime` Provider/模型/预算与 `minecraftRuntime` 部署时限；不新增或重置设置。
- 独立人类 EULA 同意仍必须由用户明确给出；模型、工作流节点或“完全权限”均不能代替。未完成的 Agent Run 不自动重放；控制端重启后对应 Workflow Run 标记为中断，恢复副作用须由用户核查后显式新建运行。

### 允许修改

- 新增 `packages/workflow/workflow/**`：类型化 DAG、边界校验、账户隔离的工作流定义/运行 Owner、顺序节点协调与真实 Agent Run 结果追踪。
- 新增 `packages/api/workflow-controller/**`：认证的工作流列表/保存/删除/运行/查询/取消接口；节点可用工具目录按当前账户角色及 Minecraft App 范围过滤。
- `packages/storage/storage-sqlite/src/database.ts`：递增数据库迁移，建立账户隔离的工作流定义和运行快照。
- `packages/client/ui-minecraft/**` 与 `packages/client/connection/**`：Minecraft 工作流路由、无限画布编辑器、工具节点范围选择、保存与真实运行状态展示；使用现有主题和减少动态效果设置，不另建主题变量或本地业务存储。
- 必要的 Profile/Bundle/API 装配、目标包 README、`docs/系统总体架构.md`、`docs/开发计划.md` 和本合同记录。

### 禁止修改

- 不新建第二套 Agent Loop、模型/Provider、会话、工具注册、权限审批、Minecraft 业务规则或 Daemon 执行器；不从浏览器直连 Daemon。
- 不实现循环、隐式并行副作用、自动重试副作用、计划任务、跨 App 工作流、条件表达式脚本或任意代码节点；无环图运行时按确定性拓扑顺序串行执行。
- 不把模型输出、工具提交、进程存在或页面状态冒充节点成功；成功状态必须来自现有 Agent Run 与工具/Daemon 真实结果。
- 保留当前工作树中的其他未提交和未跟踪改动；不清理、不提交、不推送、不部署、不重启 Web/Control Plane/Daemon 或 Minecraft 实例。所有构建输出仅写根 `dist/`。

### 验收条件

- 能在 Minecraft 常规模式创建、拖放、连线、编辑、保存、重新读取和删除工作流；保存后画布坐标、节点说明、工具范围和依赖一致。
- 服务端拒绝无效 App/Tool、越界节点数或文本长度、断裂/重复边、循环、孤立节点和不可达图；所有读写按当前账户隔离，不能通过提交伪造 `userId` 绕过。
- 手动运行创建持久 Workflow Run；节点严格依赖图拓扑顺序串行执行，等待上游真实 Agent Run 完成后再启动后继；节点记录能回读真实 Agent Run/Session ID、状态、失败信息和完成时间。取消不启动后续节点；未知或中断结果不得重放。
- Agent Run 继续受 Minecraft App Tool Scope、`permissions.mode`、Tool 风险/审批、用户澄清和 EULA 人类同意约束；无 Provider、节点工具范围越界、节点离线及 Agent/Daemon 失败均如实报告。
- 画布拖动、缩放、连线与状态更新不产生重复订阅/重叠请求；轮询页面不可见时暂停、恢复时重新对账，组件卸载时清理监听器/动画帧；限制单图节点/边数量并控制执行历史增长。
- 运行工作流 Owner/API/UI/相关宿主的直接构建与仓库要求的适用 Gate；登录态浏览器检查画布编辑/刷新恢复/运行进度，且在用户明确 EULA 同意后才做目标 Daemon 部署验收。Provider、桌面和帧时间未测时分别报告，不以构建替代运行验收。

### 完成记录

- 2026-10-05：用户同意开始实现无限画布式工作流；登记本合同。当前工作树已有大量其他未提交改动，本任务按上述范围保留并避开清理。
- 2026-10-05：新增账户隔离的工作流定义/运行 Owner、认证 API、SQLite v44 迁移和 Minecraft 无限画布入口。节点依赖按无环图拓扑顺序交给现有 Agent Loop 在同一 Minecraft Session 串行执行；权限、审批、EULA 与真实操作继续归现有 Owner。未新增设置，沿用合同列出的权限、AI Runtime、Minecraft Runtime 和外观配置。
- 2026-10-05：`pnpm exec tsc --noEmit -p tsconfig.host.json`、`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm run build:control-plane`、`pnpm run build:web` 均通过，`git diff --check` 通过。Web 构建仍提示已有大于 500 KB 的代码块。
- 2026-10-05：在隔离临时数据目录启动 Control Plane/Web（`127.0.0.1:3319`，禁用本机 Daemon），浏览器确认三节点自动避让、两条有向依赖、手动拖动、保存/刷新后节点与依赖恢复、缩放和已保存状态。浏览器使用测试账户与临时数据库；未点击“运行”，真实 Provider、Minecraft Daemon/实例执行、桌面与帧时间未验。浏览器验收页面保留为可查看交付。
- 2026-10-05：隔离启动曾遇到 `workflow_runs` 表缺失。根因是 SQLite 包先在文件存储迁移前加载到 v30，随后 Storage Domain 只迁移至 v43；新增 v44–v46 未接入该正式编排入口。已将三步迁移加入 `retireLegacyFileTables()` 的两个路径；后续全新隔离实例在启动时到达 v46，工作流保存、执行、刷新恢复均通过浏览器验收。浏览器 Console 的 DSH Client/UI Renderer 回退提示与扩展槽状态不属于本合同验收范围。

## LFAA-WORKFLOW-CANVAS-DATAFLOW-01

### 用户目标与运行入口

把工作流从 Minecraft 专属实现拆成跨 App 的核心能力：核心拥有带版本的图定义、App/账户作用域、持久化、校验、运行记录和稳定扩展合同；共享编辑器只负责展示和编辑；App/领域插件按自身 Owner 注册节点及执行适配器。Minecraft 是首个适配器。其他 App 可复用核心和编辑器，但只有注册了真实节点执行能力的 App 才能运行相应工作流。

Minecraft 节点适配器调用现有 Agent Loop、Minecraft Tools 和 Daemon Owner；工作流核心不导入 Minecraft、Agent Loop、Tool、权限或 EULA 实现。未知节点在缺少其插件时保留原始版本化配置并显示为不可运行占位；插件恢复后再按合同解析。核心/编辑器/引擎使用可卸载注册生命周期。当前第三方任意代码插件运行时不具备通用隔离合同，本任务不宣称任意第三方工作流引擎已可安全安装。

### Owner、设置与权限

- `packages/workflow/workflow` 是图/存储/运行合同的唯一 Owner；数据库按账户与 `ApplicationId` 隔离。v44 Minecraft 工作流升级到 v45 App 作用域、v46 当前节点运行字段；旧定义、节点、坐标、边和运行历史均保留。`packages/storage/storage-domain/src/migration.ts` 在文件存储迁移后执行 v44–v46，覆盖空库与旧库启动顺序。
- 节点、引擎和客户端节点视图只通过稳定、版本化的注册合同接入；注册由 Cordis 插件 `owner.effect()` 管理，卸载后撤销能力。节点执行回调必须通过该 App 现有领域 Owner，不得从核心绕过权限。
- 共享编辑器使用 React Flow 作为渲染/交互适配器，服务端图定义仍是事实来源。图校验和执行只能由服务端注册的节点运行时完成，浏览器不能直接执行 Tool 或 Daemon 操作。
- Minecraft 页面沿用 `appearance.theme`、强调色、字体/字号、对比度、Minecraft 背景/遮罩/模糊与 `appearance.advanced.reducedMotion`；执行继续使用 `permissions.mode`、`aiRuntime` 与 `minecraftRuntime`。其他 App 沿用同一外观 Owner 和各自运行配置。不新增设置项。
- 稳定图文档和持久化核心可保留，而节点/引擎/视图插件可替换；停用缺少能力的插件后相关图只进入 unavailable 状态，不删除定义或伪称运行成功。

### 允许修改

- `packages/workflow/workflow/**`：与 App 无关的版本化图/端口合同、注册目录、账户+App 隔离持久化、运行记录和可替换执行提供方接口。
- `packages/storage/storage-sqlite/src/database.ts` 与 `packages/storage/storage-domain/src/migration.ts`：递增迁移并把既有 v44 Minecraft 工作流标记为 Minecraft App 范围，同时将 v44–v46 接入实际启动迁移链。
- `packages/workflow/dag-engine/**`、`packages/workflow/minecraft-adapter/**` 及必要 Bundle 装配：顺序 DAG 执行提供方和 Minecraft 节点适配器；副作用继续交现有 Minecraft、Agent Loop、Tool、Permission、Session、Daemon Owners。
- `packages/api/workflow-controller/**`、`packages/client/connection/**`：认证的 App-scoped 工作流 API 与共享 DTO；服务端验证 App ID 和已注册节点范围。
- `packages/client/ui-workflow/**`：共享图编辑器、渲染适配、未知节点占位、保存/执行状态；`packages/client/ui-minecraft/**` 仅负责 App 入口与节点定义/显示适配。
- 必要的 Bundle/Profile 装配和依赖声明；`docs/PROMPTS.md`、`docs/系统总体架构.md`、`docs/开发计划.md` 与相关包 README。

### 禁止修改

- 不新建第二套 Agent Loop、Session、Provider、Tool、权限/审批、Minecraft 业务或 Daemon 执行实现；不改变现有 EULA 和副作用边界。
- 不通过客户端提供的 `userId`/`appId` 代替会话身份校验；读写必须按已认证账户和当前 App 双重隔离。
- 不执行任意代码、条件脚本、计划任务、自动重试或隐式并行副作用；此阶段的内置 DAG 执行器保持确定性串行执行。
- 不把未注册、已卸载或示例节点呈现成可执行能力；未知节点须保留数据但不可运行，节点成功与结果必须来自真实服务端执行。
- 不丢弃旧节点的必需字段/元数据、不重置用户偏好；不得把项目内部注册接口描述为已具备安全的通用第三方插件商店。
- 保留当前工作树的其他未提交/未跟踪文件；不清理、不提交、不推送、不部署、不重启现有服务或 Minecraft 实例。构建输出仅写根 `dist/`。

### 验收条件

- v44 数据迁移后，既有工作流仍属于 Minecraft，定义、坐标、节点、边及运行历史均可读取；其他 App 列表看不到 Minecraft 工作流。
- 同一个账户下不同 App 的列表/读取/保存/运行互相隔离；服务端拒绝未登记的 App 范围、节点类型和端口。
- Minecraft 节点适配器卸载后，原图定义与未知节点配置不丢失，相关图明确不可运行；重新加载适配器后仍可解析。节点/引擎注册退出无残留。
- 通用文本/Agent/结果数据流只通过已登记的节点 handler 执行；结果、错误、取消和运行快照都来自服务端节点执行。Minecraft Agent 仍受原有 Tool Scope、`permissions.mode`、审批、澄清与 EULA 控制。
- 共享编辑器可用于 Minecraft 首个适配器，页面能创建、连接、编辑、保存、刷新恢复；渲染不识别的节点显示占位并保留配置。Web 与桌面复用同一实现，使用现有外观/减少动态效果设置。
- 注册表和数据合同足以让另一个 App 通过包注册节点进入同一核心；没有对应 App 节点提供方的 App 只显示不可用状态，不声称已完成应用接入。任意第三方引擎安全安装仍作为后续能力。
- 运行定向回归、迁移检查、受影响包/入口构建、适用 Gate 与 `git diff --check`；按用户先前要求做当前浏览器页面交互验收。真实 Provider/Daemon、桌面和帧时间未测时分别注明。

### 完成记录

- 2026-10-05：交付 App 中立的图/运行核心、可撤销节点与引擎登记、独立顺序 DAG 引擎、Minecraft Agent 节点适配器、App-scoped API 和共享 React Flow 编辑器。核心只提供通用文本输入/结果节点；Minecraft 是首个领域适配器，其他 App 可沿稳定合同注册自己的执行能力。缺失节点包会保留定义并进入 unavailable 状态；任意第三方代码插件的安全安装仍未实现。
- 2026-10-05：`tsc --noEmit -p tsconfig.host.json`、`tsc --noEmit -p tsconfig.client.json`、`workflow-core.test.mjs`（1/1）、`agent-runtime.test.mjs`（1/1）、`knowledge-library`（2/2）、`storage-hub`（2/2）、`workspace-projects`（1/1）、`writing-book-profiles`（1/1）、`conversation-memory`（1/1）、Control Plane 构建、Web 构建与 `git diff --check` 通过。`harness-agent-api.test.mjs` 在现有“记忆生成后应写入偏好”断言失败，失败发生在与本工作流无关的对话记忆场景。
- 2026-10-05：独立临时数据目录、3321 端口的浏览器验收完成：新建 Minecraft 工作流，添加文本输入与结果节点、连线、编辑并保存；顺序 DAG 两节点均成功并返回输入文本，刷新后定义、边和运行记录恢复。确认空库正式装配会迁移至 schema v46。只验证了通用文本节点链；真实 Minecraft Agent、EULA、Provider、Daemon、桌面和帧时间未测。原有 3319 服务未重启。
- 2026-10-05：设置中心未新增配置。共享页面沿用 `appearance` 配置，Minecraft 执行继续读取现有 `permissions.mode`、`aiRuntime`、`minecraftRuntime` 及 EULA/Daemon/工具 Owners。构建产物只写入根 `dist/`；保留工作树中的其他未提交修改。

## LFAA-LOCAL-STORAGE-SQLITE-01

### 用户目标与运行入口

检查 LFAA 的本地数据根目录、结构化数据、会话事件和资源文件的真实持久化方式，并参考 `H:\Nomi`、当前 DSH 源码、ComfyUI 官方仓库及 OpenAI 官方公开的数据管理说明，减少不必要的自研存储机制。将账户设置、Provider 配置和应用目录等结构化配置从单份整库 JSON 文档迁至现有 SQLite 数据库的逐记录表；继续使用 JSONL 作为 Session 事件权威日志，用文件系统保存大型资源、模型缓存、项目和游戏内容。SQLite/JSONL/文件根仍来自现有 `LFAA_DATA_DIR` 与领域 Owner。

当前 Windows 环境中发现 `H:\LFAA1\data` 与 `C:\Users\yu\.LFAA\data` 都存在数据库，故本任务不改默认路径、不搬迁、不合并、不删除任何现存数据。已知超级管理员账号只用于用户明确要求的既有服务浏览器验收；不得在真实数据根新建管理员，不得把凭据写入仓库、测试、日志、文档、截图或记忆。

### Owner、设置与权限

- `packages/storage/storage-domain/src/configuration.ts` 是配置记录的唯一 Owner；`packages/storage/storage-sqlite/src/database.ts` 管 schema 与事务；`packages/storage/storage-domain/src/migration.ts` 负责旧 JSON/SQLite 格式导入及启动编排；现有设置、Provider、应用目录服务仍通过 `configuration` API 读写。
- schema 版本递增至 v47。v31–v46 配置从 `<LFAA_DATA_DIR>/storages/configuration.json` 导入；更早 SQLite 配置按既有 v31 升级流程写成 JSON 暂存来源，再由 v47 导入。行、加密凭据和迁移状态同一 SQLite 事务写入，校验账户/节点归属；JSON 来源文件保留为只读回退材料。迁移前缺失/损坏/不匹配数据明确失败，不恢复默认、不覆盖冲突；迁移后从 SQLite 回读。
- 设置中心配置不新增、不重置；其账户归属、Provider 激活唯一约束、加密字段与权限语义保持不变。会话 JSONL 的序列、哈希链、未确认工具调用恢复语义不变。
- 插件 Storage Hub 仍只负责可选 KV 后端登记；不得接管设置、身份、Session 或领域数据 Owner。保留 JSON 后端供需要人类可读/可移植文件的插件显式选择。

### 允许修改

- `packages/storage/storage-sqlite/src/database.ts`：新增 schema 迁移版本、按记录配置表与迁移状态表。
- `packages/storage/storage-domain/src/configuration.ts`、`migration.ts`：导入旧格式、SQLite 原子记录写入、账户隔离和回读验证；保留既有单控制端锁合同。
- `apps/cli/tests/file-storage.test.mjs`、`apps/cli/tests/credentials-authorization.test.mjs` 与版本断言：新库、v31–v46 JSON 来源、旧 SQLite 来源、重复启动、损坏来源、账户/节点隔离、事务回滚和敏感明文不落盘。
- `packages/settings/settings/src/service.ts`、`packages/settings/settings/src/preferences/service.ts`：仅更新文件头中的存储事实说明，不改变设置 API 或行为。
- `packages/storage/storage/README.md`：说明 Storage Hub 与领域数据 Owner 的边界及当前 SQLite/JSONL 用法。
- `docs/harness-storage.md`、`docs/系统总体架构.md`、`docs/开发计划.md` 与本合同：更新当前存储事实和参考结论。

### 禁止修改

- 不把会话事件搬入 SQLite；不将大型素材、模型、项目/世界文件塞入 SQLite/JSON 配置。
- 不引入 PostgreSQL/外部云数据库，不增加平行存储抽象、第二套设置/Session Owner 或新用户数据目录。
- 不改写或合并 `H:\LFAA1\data` 与 `C:\Users\yu\.LFAA\data`，不读写用户凭据值；测试只用 `dist/.tmp/` 的隔离数据目录及合成数据。
- 不新建真实管理员、不重启/终止现有 Control Plane、Daemon 或 Minecraft 实例，不开临时替代端口；浏览器验收只使用用户指定的 5173 Vite 与既有账户。
- 保留当前工作树无关的未提交/未跟踪内容；构建输出只写根 `dist/`；不提交、不推送、不部署。

### 验收条件

- 设置和 Provider/目录配置以单记录 SQLite 事务写入；跨多记录操作原子提交，重复同值保存不产生修订，写入失败后旧内存状态不前移。
- v31–v46 JSON 与 v0–v30 旧 SQLite 配置均能幂等迁移，写入数据与来源逐项一致；迁移中断可重试，迁移后重启从 SQLite 回读；来源损坏、缺失或归属不匹配时拒绝启动且原始来源保持不变。
- 设置仍通过认证账户隔离；用户/节点删除与应用现有引用边界一致；密钥明文不进入数据库、配置文件、测试断言或日志。
- Session JSONL、SQLite WAL/外键/账户事务及文件资源目录继续各归其 Owner；不出现本地数据根自动搬动。
- 执行定向迁移/配置回归、Host/Client 类型检查、Control Plane/Web 构建和 `git diff --check`。浏览器登录使用已有管理员，验证读取、保存、刷新回读；若 5173 未监听或现有后端未加载新构建，准确记录阻塞，不创建新端口或重启受保护服务。

### 参考结论

- Nomi 当前代码：Electron `userData` 是稳定设置根；用户偏好采用原子 JSON 文件；项目/素材使用独立可配置项目根与项目内文件，部分轻量 UI 偏好保留在 localStorage。按数据体量/归属选择介质，不把全部都放进单一数据库或浏览器缓存。
- DSH 当前源码：Session 使用版本化 JSONL 持久化；结构化 KV 可选 JSON 或 SQLite；SQLite 每条配置记录独立行写入，适合定点更新。LFAA 沿用当前 Owner 与单进程合同，不直接依赖另一 workspace 的实现包。
- ComfyUI 官方：通过 `--user-directory` 控制本地用户数据根，工作流与用户设置随该用户目录保存；生成输出、模型等仍走独立文件目录。
- ChatGPT 官方公开的是云端数据的账户保存、删除、临时聊天、导出、保留和隐私控制，未公开内部数据库/文件存储实现；不得据此声称 ChatGPT 使用某种本地数据库。

### 完成记录

- 结构化配置已改为现有 SQLite 数据库中的逐记录写入；迁移来源校验、原子导入、修订冲突检测、账户/节点归属校验及加密 Provider 凭据分表由当前 Storage Domain/SQLite Owner 管理。Session JSONL 与大型文件目录保持原 Owner。`H:\\LFAA1\\data` 和 `C:\\Users\\yu\\.LFAA\\data` 均未搬迁、合并或修改；未新增/重置设置中心选项，未读取或保存管理员凭据。
- 定向验证：Host 与 Client 类型检查通过；`file-storage.test.mjs`、`credentials-authorization.test.mjs`、`workflow-core.test.mjs` 合计 9/9 通过；`agent-runtime`、`knowledge-library`、`storage-hub`、`workflow-core`、`workspace-projects`、`writing-book-profiles` 定向回归合计 8/8 通过。SQLite、Storage Domain、Control Plane 隔离构建及 Web 隔离构建通过；Web 构建仍提示既有大 chunk。`git diff --check` 通过。
- `harness-agent-api.test.mjs` 未能在当前运行产物上通过：测试启动了根 `dist/apps/control-plane` 中的 v46 代码，而当前源码数据库 schema 为 v47，报“数据库版本 47 高于支持版本 46”。3319/3321 服务仍使用该旧产物；为保护正在运行的服务，没有覆盖产物、重启或另开端口。此项回归因此仍未验证新版本。
- 用户指定的 Vite 5173 当前没有监听；现有 3319 和 3321 仍健康运行但使用旧版 Control Plane。未登录账户，未执行浏览器页面读写验收。仓库没有 `workspace-preflight` 脚本或命令。

## LFAA-LOCAL-DATA-CATALOG-01

### 用户目标与运行入口

把既有 `LFAA_DATA_DIR` 作为唯一数据根，在根目录内按账户设置、账户素材、工作流文档、Markdown 知识、控制面关系数据、会话事件、游戏/环境、凭据、缓存、模型与备份分别管理，避免可变文档和图片正文继续塞入 SQLite。用户级安装版数据根仍由当前桌面/启动器放在 Windows 用户目录；项目/便携版仍跟随项目目录。`resolveDataDirectory`、Electron/Tauri 数据根选择、环境变量覆盖和迁移入口均保持原行为；绝不自动合并 `H:\LFAA1\data` 与 `C:\Users\yu\.LFAA\data`。

设置与应用偏好由 Storage Domain 按用户写入原子 JSON；外观背景二进制、工作流图文档和 Markdown 资料正文落在每个用户的独立文件目录。SQLite 继续权威管理账户、权限、任务、运行记录、Provider 密文、跨表关系与小型索引/元数据；工作流运行状态与资料库项目来源保持其现有 SQL Owner。Session 事件继续使用 JSONL。用户实际选择的项目路径、Daemon 上的游戏实例/存档、受管理环境、凭据、缓存和备份保持原目录 Owner；`models/` 只登记为预留类别，不伪造本地模型运行时。

不新增 SQLite schema 版本。v47 及更早既有配置、背景图片、工作流图和资料正文在原子文件写入、逐项校验成功后才清理对应旧来源：设置记录从 `configuration_records` 移除，工作流定义与知识正文列改为当前 schema 允许的 `{}`/单空格标记，背景 BLOB 清为 0 字节。迁移可重复运行，冲突或损坏即拒绝覆盖。迁移只在应用实际使用的单一 `LFAA_DATA_DIR` 内执行，不搬根、不改用户偏好、不删除旧数据根。

### Owner、设置与权限

- `packages/util/home-paths/src/data-layout.mjs` 提供根目录类别与稳定用户目录映射，不解析或改变数据根本身。`packages/settings/settings` 仍是设置语义与外观 API Owner，`packages/storage/storage-domain` 负责设置/偏好原子持久化与旧配置迁移。
- 背景图片归 Settings Owner；只把受类型/尺寸校验的二进制写入用户 `assets/backgrounds/`，SQLite 保留账户隔离的媒体元数据，不存图片字节。
- `packages/workflow/workflow` 仍是图定义与运行唯一 Owner；工作流图正文放用户 `projects/<appId>/workflows/`，SQLite 只保留账户/App 索引和运行所需关联。节点/引擎注册、图校验、权限与领域副作用边界不变。
- `packages/knowledge/knowledge-library` 仍是 Markdown Owner；正文放用户 `knowledge/<scope>/`，SQLite 保留账户/App/类型/标题/摘要/哈希与项目来源关系。读回必须校验 SHA-256；文件缺失或校验失败时不返回正文。
- 所有用户目录由稳定账户 ID 的不可逆路径段映射，不能把未经编码的客户端值拼成路径。文件写入采用同目录临时文件、fsync 与原子替换；迁移/写入遵循控制端单写者租约。
- 目录分类嵌套在原数据根：`users/<账户 SHA-256>/settings`、`assets/backgrounds`、`projects/<appId>/workflows`、`knowledge/<scope>`；顶层 `models/` 仅预留，既有 `games/`、`sessions/`、`credentials/`、`environments/`、`cache/`、`backups/` 各归其当前 Owner。
- 不增加设置中心选项，不重置已有外观、语言、Provider、Minecraft Runtime、权限或 General 偏好。Provider 密文仍由既有凭据 Owner 加密并存 SQLite/credentials。

### 允许修改

- `packages/util/home-paths/src/data-layout.mjs`、配套类型/包入口和 `packages/storage/storage-json/src/index.ts`：新增目录映射及原子二进制文件写入。
- `packages/storage/storage-domain/src/configuration.ts`、新增的用户文件持久化模块及 `migration.ts`：设置/偏好逐用户 JSON、旧 SQL 幂等迁移、校验、账户删除清理；不改 schema。
- `packages/settings/settings/src/service.ts`、`preferences/service.ts`：改用文件型设置 Owner；背景元数据留 SQL、图片字节迁入用户素材目录。
- `packages/workflow/workflow/src/service.ts`、`packages/knowledge/knowledge-library/src/index.ts`：迁移灵活图定义与 Markdown 正文到用户文件，保留现有关系和运行元数据。
- 上述包的依赖清单、直接相关的长期回归、`packages/storage/storage/README.md`、Settings/Workflow/Knowledge README、`docs/harness-storage.md`、`docs/系统总体架构.md`、本合同及必要的 `pnpm-lock.yaml`。

### 禁止修改

- 不改 `LFAA_DATA_DIR` 默认解析、用户级/项目级根目录选择、Electron/Tauri 外壳数据根、项目迁移 UI、端口、用户 Home、环境变量覆盖或启动器行为；不创建并合并第二个根目录。
- 不触碰当前真实 `data/`、`C:\Users\yu\.LFAA\data` 或远程 Daemon 文件；不读取/记录真实账户凭据；不新建超级管理员。
- 不增加 SQLite v48 或任何新表/索引；不迁移账户、会话、授权/审批、任务、运行状态、Provider 密文、项目来源关系、游戏实例、写作章节/修订。
- 不移动用户真实项目、游戏/存档、模型权重、环境、密钥、缓存或备份。远程内容继续留在对应 Daemon；本地模型功能尚不存在。
- 不更改工作流节点执行/权限合同、知识内容信任标记、搜索上限、设置默认值或 Appearance 外观映射。
- 测试回归只使用 `dist/.tmp/` 隔离数据；用户已授权将统一运行验收改为控制端 `3000`，端口被占用时先核实 PID/命令行，再重启 LFAA 进程。通过 `pnpm lfaa web --no-local-daemon` 启动；沿用当前 `LFAA_DATA_DIR` 解析，不另开 Vite 端口、不启动本机 Daemon、不搬迁或合并数据根。保留所有既有改动，不提交/推送/发布。

### 验收条件

- 数据目录映射测试覆盖固定数据根下 `database/users/settings/assets/projects/knowledge/models/games/sessions/credentials/backups` 的边界，并证明根解析规则不变。
- 旧 SQLite/JSON 用户设置与偏好、背景 BLOB、工作流图、Markdown 正文迁移后逐项回读一致；重复启动幂等；冲突/损坏时不覆盖原件；设置记录在验证后移除，工作流/知识正文列保留 schema 允许的占位标记，图片 BLOB 清为 0 字节，既有关系/元数据保留。
- 新增设置/偏好、背景图、工作流、知识内容写入正确用户目录并可重启回读；账户/A、App 作用域隔离；文件缺失/篡改拒绝回传正文；同值设置保存不刷盘。
- SQLite schema 仍为 v47，无新 schema 迁移。Host/Client 类型检查、存储/设置/工作流/资料库相关回归、直接相关包/入口构建及 `git diff --check` 通过；确认构建仅写仓库根 `dist/`。
- 浏览器若 5173 正在运行，只读验收设置与素材读写/刷新；账户登录和实际浏览器交互未进行时如实说明。真实用户根、远程 Daemon、桌面安装版路径和重启后的真实数据迁移不在隔离回归证据范围内。

## LFAA-MINECRAFT-PLAYER-CONNECTIVITY-01：LFAA 世界联机中心

> 历史记录：用户随后将范围扩展为跨游戏的单一 Connectivity App；当前开发目标与边界以 `LFAA-GAME-CONNECTIVITY-APP-01` 为准。此处保留当时的验收记录，不再作为当前产品合同。

### 用户目标与运行入口

在 Minecraft 常规工作区加入独立的“LFAA 世界联机中心”，供用户在本地服务端部署/启动完成后选择玩家联机路线。开服、部署、实例启停仍由既有 Minecraft 页面和 Host Owner 管理；进入联机页、选择方式或复制地址不得调用部署/启动/停止接口，也不得将公网映射状态并入实例状态。

首期展示三条彼此独立的路线：LFAA 内置穿透（当前未接入，明确不可用）、用户自行安装/运行的穿透服务（人工配置/交接）、房间域名服务（人工在官方服务创建房间并把实际返回地址带回 LFAA）。当前 NotfyLink 首页未发现可供 LFAA 调用的公开 API/SDK；允许链接其官网作为外部入口，不猜测私有协议、自动化页面或应用接口。

### Owner、设置与权限

- Minecraft 实例名称、节点和运行状态仅从既有 `MinecraftInstance` API 读取；本机目标端口从该实例已保存的 `serverProperties.serverPort` 读取，缺失时使用账户 `minecraft-runtime.minecraftDefaultPort`。
- 外网地址及真实隧道/房间状态由外部服务创建并负责。本期不创建持久网络路由 Owner；输入地址只保存在当前页面状态，用于格式检查和复制，不写 SQLite、设置、浏览器持久存储或 Minecraft 实例。
- UI 使用现有 `appearance` 主题、颜色、字体与字号映射及 `interfaceFontSize`；不新增设置项，不重置用户偏好。
- 本页只读 Minecraft 实例；复制本地目标或用户手动填写的公网地址不扩大访问权限，也不执行主机命令。

### 允许修改

- `packages/client/ui-workspace/src/ApplicationWorkspace.tsx`、必要的共享菜单 CSS：增加独立联机导航入口和路由分类。
- `packages/client/ui-minecraft/src/MinecraftWorkspace.tsx`、新增的 `MinecraftConnectivityPanel.tsx`、本包 CSS 与 README：呈现实例选择、三条路线、手动地址交接和复制。
- 本任务合同、`docs/系统总体架构.md`、`docs/开发计划.md` 与受影响 package README。

### 禁止修改

- 不将联机逻辑塞进部署向导、provision API、实例启停、任务生命周期、Minecraft 属性保存或 `minecraft_instances` 状态；不因网络状态自动启动/停止 Minecraft。
- 不新增数据库 schema/表、设置中心选项、并行实例/凭据/权限 Owner、任意二进制执行、端口开放或防火墙规则；不把用户输入地址、正在运行的外部工具或 UI 标签说成已验证的公网连通。
- 不复制 NotfyLink 的产品名、视觉、文案或资产；品牌只可作为房间域名路线的外部官方入口标注。
- 不安装、启动、停止或下载外部服务；不声明 NotfyLink API/SDK 能力。内置隧道未有真实 Relay/Daemon Owner 前必须禁用。

### 验收条件

- 侧栏存在与“部署”“实例”分开的“联机”导航；该页面读出实际实例和已保存端口，能独立浏览而不改变部署/启停状态。
- 三条路线状态真实且互不耦合；未接入内置穿透不能操作，手动路线可以打开官方服务页面、填入返回地址、校验基本地址格式和复制。提示明确说明格式校验不代表连通。
- 网络页面不新增订阅、轮询、计时器或无界缓存；沿用现有 Minecraft 数据读取与主题/字体设置，使用现有 `minecraftDefaultPort` 回退。
- 执行 Minecraft UI 与工作区包构建、适用类型检查及 `git diff --check`；记录真实浏览器交互、Provider API、Daemon 和外网实测是否完成。构建产物只写根 `dist/`。

### 完成记录

- 2026-10-06：增加独立“联机”分类和 LFAA 世界联机页。该页读取 Minecraft 实例与保存端口；内置穿透保持不可用，自备穿透/房间域名走外部人工配置与地址交接。NotfyLink 仅提供官方站点跳转；页面不创建房间、不启动隧道、不探测公网、不触碰部署/启停或新增持久化状态。仅复用现有 `minecraft-runtime.minecraftDefaultPort` 和 Appearance 字体/主题映射。
- 定向验证：Minecraft UI 包、Workspace 包构建通过；`pnpm exec tsc --noEmit -p tsconfig.client.json` 通过；`pnpm --filter lfaa-web run build` 通过，产物写入根 `dist/apps/web/`。构建报告已有大 chunk 警告；`git diff --check` 通过。
- 未运行单元/集成测试、浏览器交互、Daemon Provider 或真实公网连接验收；自动房间创建和内置 Relay 尚未接入，外部地址仅做格式校验与复制。

## LFAA-GAME-CONNECTIVITY-APP-01：跨游戏联机服务

### 用户目标与运行入口

把联网做成独立 LFAA App，游戏 App 只提供真实服务目标（Daemon 节点、TCP/UDP 协议和本地端口）并调用该 App；部署/启动/停止继续由各游戏自己的领域 Owner 管理。App 提供三条互不绑定的路线：由有官方 API 的第三方 Provider 适配器管理令牌、节点和映射；用户自备且已运行的穿透程序只做地址/目标交接，不由 LFAA 控制进程；LFAA 自有房间域名 Relay 由房主命名房间、选游戏目标，生成玩家地址并显示真实在线/离线状态。LFAA 不集成 NotfyLink，不复制其品牌、页面资产、产品名称或原文。

首批跨游戏合同要支持 TCP 与 UDP。Minecraft Java 房间域名可由 Relay 解析客户端握手主机名并路由；其它 TCP 游戏使用独立公网端口，UDP 游戏（如饥荒联机版）使用分配端口并在地址中明确显示端口。域名本身不能让普通 UDP 协议携带房间标识，不能承诺所有游戏都只输域名。状态只依据 Relay/Daemon/Provider 的真实握手和回报，不把房间记录存在、进程启动或格式校验说成公网可达。

### Owner、设置、凭据与持久化

- 唯一跨游戏业务 Owner 为新 `packages/network/game-connectivity`：拥有目标类型/协议合同、路由状态、房间名唯一性、Provider Adapter Registry 与消费 App 登记。Minecraft 可注册自己的目标读取/校验适配器；未注册服务端能力的 App 不显示伪造目标。通用目标仅接受在线 Daemon、本机回环目标和合法端口，校验账户归属及 Host ACL。
- 控制端新 API Controller 校验账户认证、角色/所有权、参数和操作频率。Provider 密钥使用现有 `lfaaCredentials` / Settings 加密记录 Owner，不能进入一般设置 JSON、客户端长缓存、URL、日志或地址响应。只有查到供应商官方 API 规格的适配器才能启用；本轮官方来源无法确认 SakuraFrp 可用 API 契约时，Sakura 操作显示未接入，不逆向网页登录、猜测端点或自动化私有面板。
- 路由/房间是账户数据而非 Minecraft 实例状态；复用既有 `LFAA_DATA_DIR` 与 `atomicWrite`，保存在 `connectivity/routes.json`，每条记录绑定创建账户 ID、列表和变更 API 按账户过滤，带版本、修订和回读校验。该全局文件 Owner 同时负责不同账户间的房间名/公网端口唯一分配。不增加 SQLite schema/table，不把数据放入设置中心，不与游戏部署任务或实例生命周期耦合。
- 不新增账户/身份/权限/外观设置。App 使用既有登录态、角色/认证 API、全局权限合同和 Appearance 共享映射。Relay 运营域名、公开监听地址、TLS/共享密钥和限额属于部署环境配置，不写入账户设置或示例真实秘密。
- LFAA Room Relay 是独立可部署运行入口，房间控制 API 与玩家数据平面分开。Daemon 只在用户明确创建/启用路由后连接 Relay，且目标必须与已认证在线节点身份绑定；停用或删路由撤销对应通道。不能执行任意命令、开本机防火墙、自动变更路由器，不能让 Relay 访问用户未授权的本地地址。

### 允许修改

- `packages/util/values/src/application-id.ts`、应用中心/全局路由/工作区注册：增加独立 Connectivity App ID 与入口。
- 新 `packages/network/game-connectivity/**`、`packages/api/connectivity-controller/**`、`packages/client/ui-connectivity/**` 和 `packages/client/connection/src/api.ts`：实现唯一业务 Owner、账户隔离文件仓储、认证 API、真实功能 UI 及 Consumer/Provider 合同。
- `packages/host/daemon/**`、`apps/daemon/**` 与新 `apps/connectivity-relay/**`：实现节点端有界 TCP/UDP Relay Agent、可独立部署公网 Relay；只新增固定结构化网络操作。
- `packages/games/minecraft/**`：仅登记真实 Minecraft Java TCP 服务目标及其端口读取适配器；不改变开服、EULA、部署、实例/进程启停 Owner。没有真实 Steam 游戏服务端/DST 部署 Manager 时，不伪称已完成对应 App 自动传入实例目标。
- `packages/bundle/base/cordis.patch.yml`、`packages/bundle/web-app/cordis.patch.yml`、工作区构建包清单/入口、受影响 README、`docs/系统总体架构.md`、`docs/开发计划.md`、本合同及直接相关长期回归。
- `packages/host/webserver/src/http-delivery.ts` 与 `apps/cli/package-loader.mjs`：仅修复 Web 构建替换静态资源后的入口一致性，以及源码态第三方传递依赖的解析上下文；配套 `apps/cli/tests/http-delivery.test.mjs`、`apps/cli/tests/package-loader.test.mjs` 回归。

### 禁止修改

- 不修改 Minecraft 或其它游戏开服成功条件、实例状态、安装/升级/启停/任务队列和 EULA；创建、选择或删除联网路由不得触发游戏进程操作。
- 不新增 SQLite schema/table、不扩写通用 user-settings、不把凭据写进路由文件；不引入独立账户体系或绕开现有认证、授权和账户隔离。
- 不将“自备穿透”变为 LFAA 对外部二进制的启动/下载/更新/终止管理，不混同为 LFAA 内置 Relay 或 Provider API。
- 不猜测 SakuraFrp/其他服务的 API、签名算法、套餐限制或开放协议；不反向代理/自动化供应商网页登录。没有可核验官方 API 的 Provider 维持未接入。
- 不将用户未提供的公网域名、TLS 证书、Relay 节点、DNS 或供应商令牌编进源码；联机功能开发/安装本身不改 DNS、防火墙、路由器，不部署公网 Relay、开放公网监听或重启现有服务。若独立故障修复明确要求本地 Web 重启，先核对 PID、启动参数和 Daemon/Minecraft 生命周期影响，再按用户当轮恢复请求处理；不得因此重启 Daemon 或 Minecraft。
- 不将 TCP 域名解析宣传成任意 UDP 游戏均可纯域名接入；不虚构玩家数、连接质量、Provider 节点或连通状态；限制 stream/datagram、连接数、速率与队列，断开/卸载时撤销套接字、计时器和订阅。

### 验收条件

- 应用中心有独立“LFAA 联机服务”App，配置页面不嵌入游戏部署流程；所有导航可直接刷新并保留现有应用中心入口保护。Minecraft 只提供已运行 Java 实例目标与真实保存端口；通用 TCP/UDP 目标可跨 App 复用。
- Provider Adapter Registry 展示每个真实官方适配器能力；密钥通过既有 Credentials Owner 保存/删除和消费，永不从读接口返回；官方文档缺失的 Provider 清楚禁用。自备路线只显示用户实际输入的地址和目标，不报告 LFAA 进程状态。
- Relay 缺少部署配置时创建操作明确不可用；配置齐全时创建房间持久化账户隔离记录，Relay/Daemon 状态只在双方真实心跳/连接确认后转换，地址来自运营域名与实际分配端口。Minecraft Java TCP、通用 TCP 与 UDP 的端口/协议分别精确呈现。
- 路由校验拒绝账户越权、离线节点、协议/端口异常、外部任意主机目标、房间冲突、超限载荷与未授权撤销；文件原子替换，损坏时拒绝并保留原件。
- 完成直接包构建、Client/Host 类型检查、有效的定向安全与存储回归及 `git diff --check`，确认构建仅写根 `dist/`。报告 Provider 官方 API、登录浏览器、在线 Daemon、Relay 公网、DNS/TLS 和不同游戏实机验收边界；源码构建不能替代公网连通性验收。

### 2026-10-06 用户范围确认

- 只保留一个跨游戏的“LFAA 联机服务”应用 App；LFAA 内置穿透、第三方 Provider、自备穿透、房间域名和游戏目标统一在此 App 中按插件/适配器扩展，不再创建第二个网络 App。Minecraft 等游戏 App 仅提供服务目标并跳转到这个联机 App。
- 用户确认要求参考 MCTier README 的完整功能范围，包括跨端组网大厅/邀请与公开大厅、节点/虚拟域名/诊断、语音与小队、聊天室、文件/屏幕共享、远程控制、房间工具及便捷管理；由 LFAA 以自身产品设计和实现，不复制 MCTier 代码、UI、文案或资产，不将它伪装成原项目插件。
- 用户确认只采用 LGPL-3.0 的 EasyTier 做独立网络引擎路径。MCTier 自有代码保持不接入；其公开仓库没有 LFAA 可直接安装的插件包，且官方信令服务端未随客户端源码提供。EasyTier 的 crate/CLI 接入须遵守其 LGPL 与官方管理接口，不猜测非公开协议。
- 当前仍仅有一个原生 Connectivity App；游戏目标走已登记的 App 适配器，网络/协作功能通过本 App 插件边界接入。所有未完成的功能必须显示为未接入，不显示“已接入”或可操作的假状态。完整 MCTier 功能范围是本任务验收目标，分阶段实现不得将基础组网子集宣称为整体完成。
- 用户随后要求继续开发，并明确每个开发切片都必须由实现者自行验收。本阶段只实现官方 EasyTier Windows x64 运行包的管理员触发安装、固定版本摘要校验、解压路径校验、核心程序版本核验及联机 App 中的真实节点就绪状态；不启动 EasyTier 网络实例，不触碰网卡、路由、防火墙或 Minecraft 生命周期，不将安装成功显示成组网/公网已连接。后续阶段接 EasyTier 官方结构化管理 RPC，并继续按真实能力边界分期。

### 当前阶段：EasyTier 官方运行包受控安装与验收

#### 运行入口、Owner 与设置

- 运行入口：LFAA 联机服务 App 的“组网引擎与联机扩展”页面；安装由已认证的 Windows x64 Daemon 在目标节点执行。
- 固定任务由 Connectivity Owner 保存在 `LFAA_DATA_DIR/connectivity/easytier-install-tasks.json`，经绑定节点身份的 Daemon 领取/完成 API 传送；不经过 AI Host Job/Shell，也不新增 SQLite 表。安装权限仅管理员可用，任务列表只返回创建账户自己的摘要。
- EasyTier 版本和官方资产校验值由 `packages/network/game-connectivity` 的单一只读发布清单持有；节点运行包保存在 `LFAA_DATA_DIR/environments/easytier/v2.6.4`，下载暂存于同一节点的数据根目录。安装后的状态只来自 Daemon 对核心可执行文件版本的核验及心跳能力回报。
- 本阶段不新增设置中心配置。安装路径和版本属于 LFAA 管理的运行时，不作为用户偏好；App 使用现有 Appearance/共享组件主题。

#### 允许修改

- `packages/network/game-connectivity/**`：唯一 EasyTier 固定版本/资产清单与 App 侧状态合同。
- `packages/host/daemon/**`：领取 Connectivity Owner 的固定 EasyTier 安装任务、官方资产摘要/大小校验、受限解压、版本核验和安装能力心跳。
- `packages/api/remotes/**`：登记 EasyTier 能力心跳字段，并复用节点绑定 Bearer 身份校验合同。
- `packages/api/connectivity-controller/**`、`packages/client/connection/**`、`packages/client/ui-connectivity/**`：管理员认证触发安装、仅任务创建者读取任务状态、按节点真实能力展示版本与任务结果。
- `packages/bundle/base/**`、`packages/bundle/web-app/**`、`packages/client/web/**`、`packages/client/ui-workspace/**`：将 Owner/API/UI 接入正式 Profile 与 Web Client 启动图；`tsconfig.host.json`、`tsconfig.client.json`、`pnpm-lock.yaml`：登记工作区包解析与依赖。
- 受影响 README、`packages/host/daemon/README.md`、`packages/network/game-connectivity/README.md`、`packages/api/connectivity-controller/README.md`、`THIRD_PARTY_NOTICES.md`、`docs/系统总体架构.md`、`docs/开发计划.md`、本合同与 `apps/cli/tests/**` 中直接相关的长期回归。

#### 禁止修改

- 不运行/安装本轮下载的 EasyTier 二进制，不更改用户 `LFAA_DATA_DIR`、活动 Daemon、Web、Minecraft、网络接口或防火墙。
- 不启动/停止 EasyTier 网络，不调用或模拟 EasyTier 组网状态；UI 只显示“未安装/版本已核验/节点离线/Daemon 版本不支持/安装任务状态”。
- 不接受调用方 URL、散列、路径、可执行文件名、Shell 内容或任意命令；只可安装固定清单里的 EasyTier v2.6.4 Windows x86_64 官方 ZIP，摘要和大小必须匹配，解压前拒绝路径越界、符号链接和不安全条目。
- 不增加设置中心项、数据库表或新的通用进程/权限 Owner；不影响 Minecraft 安装、启动、停止、重启、实例状态及任务租约语义。

#### 验收条件

- 未授权用户不能安装；离线、不支持平台或未报告安装任务能力的节点不能接收任务；节点侧只接受唯一登记的安装操作和发布版本。
- Daemon 在节点数据根目录安全下载固定官方 ZIP，校验 SHA-256 和字节数后才解压到隔离暂存区；拒绝错误摘要、错误版本、路径穿越、符号链接和已有损坏目标，不覆盖或清理其它数据。
- 安装成功需同时满足归档摘要、EasyTier 核心程序退出码和 `--version` 输出匹配；无此证据则任务失败。重复安装应安全返回已核验版本，不重复下载或覆盖。任务过期标为结果未知且不自动重放。
- 心跳只在真实探测版本成功后报告 `connectivity-easytier-v2.6.4`；联机 App 用节点能力显示版本，仅管理员可提交任务，普通账户不能读取他人任务。
- 为固定任务校验、安装器暂存/摘要失败/版本不匹配/idempotency、API 角色/任务归属和 Daemon 派发新增定向长期回归；执行 Host/Client 类型检查、受影响包构建、Web 构建及 `git diff --check`，产物只能写仓库根 `dist/`。
- 自验收必须至少运行定向回归、构建和一个使用临时目录与注入依赖的安装器功能验收；不下载、解压或运行 EasyTier 到用户环境。真实 Windows 二进制下载及签名、完整 EasyTier 网络实例、RPC 对等状态、其他平台、浏览器登录操作、公网 Relay 和实机游戏连接分别标明未验收。

#### 本轮实现与验收记录（2026-10-06）

- 任务传输与 AI Host Shell 队列分离，由 Connectivity Owner 持久化在账户隔离 JSON 文件；认证 Daemon 固定节点领取和回报，租约过期后为 `unknown` 且不自动重放。正式 Web Profile 包含 API Controller，Web Client 启动图注册 Connectivity Workspace。
- 本轮自验收：`connectivity-easytier-owner.test.mjs` 与 `connectivity-easytier-runtime.test.mjs` 5/5 通过；`execution-control.test.mjs` 12/12 通过；API Profile 集成测试 1/1 通过，覆盖管理员限制、账户隔离、Daemon 绑定节点领取/完成、重复任务、迟到回报和过期不重放。API 测试标准加载入口无法解析当前 CLI 依赖树中的 `@deepseek-ai/cosmokit`、`chokidar` 与 `readdirp`，因此使用仅位于 `dist/.tmp` 且已清理的临时解析器从锁定的 pnpm store 加载依赖；没有修改 `apps/cli/package-loader.mjs`。
- Host/Client TypeScript 检查、Daemon `node --check`、12 个受影响能力包构建及 Vite 生产构建通过。Web 构建写入 `dist/.tmp/connectivity-web-validation`，并从生成资源确认 Connectivity Workspace 已进入正式拆分包；Vite 提示现有大代码块超过 500 KB。为避免影响正在运行的 LFAA（127.0.0.1:3000），本轮没有覆盖 `dist/apps/web` 或 `dist/apps/control-plane`。Control Plane 临时构建槽 `dist/.tmp/p0-control-plane` 已有内容，故未覆盖重跑。
- `git diff --check` 通过；`workspace-preflight` 脚本在当前 checkout 不存在，未运行。此前 `pnpm run build:web` 包装命令触发无 TTY 的 node_modules 清理确认并安全中止，未改动 node_modules。
- 未运行已登录浏览器验收、真实 Daemon 下载/安装、Windows EasyTier 网络实例、真实外网/玩家连接或帧时间测量；未新增设置中心配置，UI 沿用 Appearance 与共享主题映射。

#### 2026-10-06 白屏故障修复与运行验收

- 在 `127.0.0.1:3000/apps/minecraft/ai-work` 用浏览器复现到 `#root` 为空：运行中 Web 进程持有启动时读入的旧 `index.html`，旧入口引用 `/assets/index-CGxlmenP.js`；随后 Web 构建清理并替换静态资源，旧 JS 返回 404。磁盘上的新入口改为引用 `index-UfGLS1lh.js`，该文件存在。
- `serveFrontend` 对带 DSH 注入的 SPA 页面改为异步读取当前 `index.html` 后再注入，避免 Web 进程缓存旧哈希资源名；HTTP 回归覆盖服务运行期间替换入口文件。
- 重启时发现包解析器先前将第三方包内的传递依赖也改由 CLI 清单解析，导致 Cordis 找不到其 `@deepseek-ai/cosmokit`。现仅对来源于 `node_modules` 的外部模块保留原解析上下文；CLI/发布态外部依赖仍使用原有 CLI ESM 条件解析路径，并补充回归。
- `http-delivery.test.mjs` 与 `package-loader.test.mjs` 合计 8/8 通过。`node scripts/build-harness.mjs host`、Client TypeScript 检查及 Vite Web 生产构建通过，产物仅写入根 `dist/`；Vite 保留已有超过 500 KB chunk 警告。`runtime-build-state.mjs web` 返回 `[]`。pnpm 包装命令因无 TTY 的依赖目录清理确认中止；没有清理或重装 `node_modules`。
- 重启前核实原进程参数为 `web --no-local-daemon`，进程树没有托管 Daemon/Minecraft 子进程，也没有 Java 游戏进程。恢复后的 Web 进程 PID 为 67336，3000 端口监听正常；`/api/health` 为 200，未登录的 `/api/ai/sessions` 为 401，认证边界保留。
- 干净浏览器会话实际打开 AI Work 路由后看到可交互的登录页，根节点已挂载；Minecraft 常规模式路由同样渲染登录页；当前入口主 JS、样式及页面拆分包均成功加载，未观察到页面 JS 异常。浏览器会话没有现成登录凭据，因此未能验收登录后的应用中心卡片、常规模式内部控件、AI Work 对话与联机操作；Codex 内置浏览器自动化初始化同时返回 Windows 系统路径错误。源码/当前构建已登记联机 App 卡片、路径、Minecraft 跳转及 `ConnectivityWorkspace` 模块，但这些登录态交互不能计作已验收。未测量浏览器帧时间，也未验收真实 Provider、Daemon 安装、EasyTier 网络、公网 Relay、DNS/TLS 或玩家连接。

#### 2026-10-06 Minecraft 与联机常规模式二次白屏修复与复验

- 根因复核：活动请求日志中的旧工作区哈希 `ApplicationWorkspace-B9dAFsoh.js` 曾返回 404；它属于上一代入口 `index-UfGLS1lh.js`，该入口映射在 `dist/.tmp/connectivity-web-validation` 快照中可复现。当前正式入口为 `index-CS76G6lD.js`，映射到 `ApplicationWorkspace-BlntrgeT.js`。旧标签页保留了上一代模块映射，而正式资源目录当时没有历史代际记录；旧版页面还没有当前的一次性自动恢复逻辑，因此错误边界会停留在“工作区暂时无法显示”。
- 仓库已有 `apps/web/scripts/web-asset-retention.mjs` 保留当前及最近两代哈希资源。为让运行中的旧标签页恢复，本轮从上一代构建快照核对同名文件 SHA-256 后，将缺少的 72 个哈希资源恢复到正式 `dist/apps/web/assets/`，并初始化正式资源历史。随后重建 Web，保留记录为三代、每代 205 个资源，清理 0 个仍受保留集引用的资源；构建输出目录仍为仓库根 `dist/apps/web/`。
- `packages/client/modules/src/client/stale-chunk-recovery.ts`、`packages/client/modules/src/client/index.ts`：在 LFAA 懒加载 Owner 捕获真实 `import()` 静态资源失败，在当前标签页只触发一次自动刷新，并于新页面稳定窗口后释放保护；会话存储不可用时不循环刷新。
- `packages/client/ui-renderer/src/ClientRenderBoundary.tsx`、`packages/client/ui-renderer/src/render.tsx`：为两种现有 React 根提供可见渲染错误提示与手动刷新入口，失败原因保留在控制台；本轮修正边界组件关联文件注释中的旧路径。
- `apps/cli/tests/client-stale-chunk-recovery.test.mjs`、`apps/cli/tests/web-asset-retention.test.mjs`：覆盖旧哈希模块单次恢复、刷新防环、近期代际保留、过期资源清理与历史记录路径校验。
- 本轮不新增设置中心配置；恢复过程使用浏览器标签页会话存储，错误界面使用现有 Appearance/Ant Design 主题。
- 验收结果：定向回归 7/7；Client TypeScript 检查通过；Vite Web 生产构建通过（2222 个模块，既有 >500 KB chunk 警告仍在）；`runtime-build-state.mjs web` 返回 `[]`。Minecraft 与联机路由 HTTP 均返回 200，旧 `B9dAFsoh` 与当前 `BlntrgeT` 模块均返回 200，上一代快照的 205 个哈希资源全部返回 200；健康 API 为 200，未认证 AI API 仍为 401，3000 服务 PID 保持 67336 未重启。
- 独立匿名浏览器打开两个常规模式路由均呈现可交互登录界面，未观察到页面异常；这不代表登录后 App 内部控件验收。Codex 内置浏览器控制初始化仍返回 Windows 路径错误，无法远程清除用户当前标签页已缓存的 React 错误边界；该标签页需要点一次现有“刷新页面”以载入当前入口。未测帧时间；也未验收真实 Provider、Daemon 安装、EasyTier 网络、公网 Relay、DNS/TLS 或玩家连接。

## LFAA-DESKTOP-ELECTRON-STARTUP-INSTALLER-01：桌面启动依赖与 Windows 安装体验修复

### 用户目标与运行入口

- 修复用户安装 Windows Electron 版后桌面端无法启动的问题。已观察的 `desktop.log` 报错为 Control Plane 无法从安装运行树加载 `@trycua/cua-driver`，使桌面 Profile 的必需插件初始化失败。
- 同步修正安装包体验：使用 LFAA 自有图标；安装前明确展示本机安装/运行须知并要求用户选择同意，拒绝时退出；安装页展开详情并记录真实安装组件；始终创建桌面快捷方式。
- 运行入口为 `apps/desktop-electron/package.json` 的 Windows x64 NSIS 包装链；Control Plane 使用现有 `apps/cli/package-loader.mjs` 与部署到 `app-runtime/apps/cli/node_modules` 的生产依赖。安装时不启动或覆盖当前 Web/Control Plane/Daemon 服务。
- 依赖归 `lfaa-computer-use` 包声明，发布运行依赖由 CLI pnpm deploy 结果持有；桌面准备脚本负责把依赖树放进 Electron `extraResources`。本任务不得通过改变插件必需性、跳过 Profile 插件或吞掉加载错误掩盖依赖遗漏。
- 本任务不新增或修改设置中心配置；安装提示只说明既有运行路径、数据与可选桌面操控能力，不更改这些偏好。

### 允许修改

- `apps/cli/package-loader.mjs`：让打包态 ESM 外部依赖按真实 CLI `package.json` 和随包 `node_modules` 解析，保留源码态所属能力包解析。
- `apps/desktop-electron/package.json`、`apps/desktop-electron/nsis/installer.nsh`、`apps/desktop-electron/scripts/prepare-runtime.mjs`：配置图标、强制确认、显示安装详情、快捷方式重建，并在打包前验证所需运行依赖已部署。
- `apps/desktop-electron/assets/**`：提供 LFAA `.ico` 和简体中文安装/本机运行须知源文件；只复制到根 `dist/.tmp/desktop-electron/build-resources` 作为打包输入。
- `apps/desktop-electron/tests/**`：为安装清单、图标/须知资源和运行依赖检查增加直接回归。
- 本合同及索引；仅当实际修改改变公共桌面行为或事实时，更新相应架构/包文档。

### 禁止修改

- 不改变 desktop Profile 装配、必需插件失败策略、认证、授权、桌面操控开关或 CUA 调用方式。包解析只修复打包态 ESM 对随包 CLI 依赖的定位，不扩大包名白名单或访问边界。缺依赖必须让打包失败并给出明确路径，不能静默降级。
- 不改变数据根、用户设置、账户、现有安装目录数据、自动更新语义或更新日志版本；普通补丁不自动增加正式版本号，不提交、上传、签名或发布。
- 不安装本轮生成的安装包，不终止、重启或覆盖现有 3000 服务/其它活动服务，不创建或迁移真实用户数据。
- 不伪造百分比、安装完成状态或并未执行的安装步骤；安装须知只能陈述代码和配置已证实的行为，不虚构法律条款或未经确认的隐私承诺。

### 验收条件

- 打包后的 `app-runtime/apps/cli/node_modules/@trycua/cua-driver/package.json` 存在且由随包 loader 从真实 CLI 依赖树成功解析；桌面准备脚本会在构建阶段对缺失依赖 fail closed，并指出需核对的路径。
- 构建产物具有 LFAA `.ico`；编译后的安装脚本包含须知接受页；桌面快捷方式设为每次安装/重装均确保存在。NSIS 进度条反映实际文件安装进度，详情面板记录安装目录和实际组件摘要，不显示伪造的分组件百分比。
- 使用打包内置的 Node 与 Loader 调用桌面 Profile 的真实 `lfaa-computer-use` 插件 `apply`，确认 ESM CUA Driver 导入成功且不启动服务、触碰用户数据或调用桌面驱动。
- 执行 Electron 相关回归、清单校验、Windows x64 package-only 构建、安装器/运行树静态核对和 `git diff --check`。不得为包构建重建或覆盖正在使用的 Web、Control Plane、Daemon；所有新产物限制在根 `dist/`。
- 明确区分：依赖解析或包内检查不等于实际安装启动验收。未实际安装/启动时标明待用户安装验证；另行说明代码签名、自动更新 Release 和真实鼠标键盘操作未验范围。

### 完成记录（2026-10-06）

- 原安装日志证实 CUA Driver 从桌面 Control Plane 编译树无法解析。修正打包态 Loader 的外部 ESM 依赖回退，使 `import` 条件从随包 CLI 依赖目录解析；保留源码态按所属能力包解析。桌面准备脚本会比对部署出的 `@trycua/cua-driver` 与源码声明版本，缺失/不匹配时终止打包。
- 安装器使用 LFAA 黑底白色 L 标识多尺寸 `.ico`；通过 electron-builder 的 NSIS License 页面展示简体中文安装与本机运行须知，接受前不能继续交互安装；默认展开安装详情并写入实际组件摘要；`createDesktopShortcut: "always"` 对应生成脚本的 `RECREATE_DESKTOP_SHORTCUT`。
- 随包 Node/Loader 调用打包态 `lfaa-computer-use.apply` 的导入与工具注册通过；调用只载入模块并登记工具，没有启动 Control Plane/Daemon、访问真实用户数据或执行桌面操控。

## LFAA-DESKTOP-ELECTRON-LICENSE-ENCODING-01：修复 NSIS 安装须知中文乱码

### 用户目标与运行入口

- 修复用户截图中 Windows NSIS 安装器 License 正文中文乱码，并重新构建一个可检查的新候选安装包。
- 运行入口为 `apps/desktop-electron/package.json` 的 Windows x64 NSIS 构建链；License 文本由 `nsis.license` 指定，electron-builder 将其交给 NSIS。
- 责任 Owner：桌面安装包资源与 `prepare-runtime.mjs` 构建准备链；须知文本仍由 `apps/desktop-electron/assets/installation-notice.txt` 单一持有。
- 不新增设置中心配置；安装须知不读取用户偏好或运行设置。

### 允许修改

- `apps/desktop-electron/assets/installation-notice.txt`：保留简体中文内容并使用 NSIS 可识别的 UTF-8 BOM 编码。
- `apps/desktop-electron/scripts/prepare-runtime.mjs`：构建前校验须知 BOM，并将经校验的原始字节写入根 `dist/.tmp/desktop-electron/build-resources`。
- `apps/desktop-electron/tests/installer-package.test.mjs`、`apps/desktop-electron/scripts/verify-packaged-runtime.mjs`：验证源资源编码，并允许对 `dist/apps/desktop-electron` 内的隔离输出目录执行随包运行树验收。
- 本合同和任务索引；不调整安装须知语义、安装行为、设置或正式版本号。

### 禁止修改

- 不覆盖正在打开的 `dist/apps/desktop-electron/LFAA 0.1.1.exe`；新候选必须输出到根 `dist/apps/desktop-electron/` 下独立目录。
- 不安装新候选、不替换现有安装、不停止或重启 Web、Control Plane、Daemon、桌面服务，也不执行发布、上传或签名。
- 不以普通文本解码外观代替编码校验；不声称已完成安装器界面验收，除非实际打开新候选并检查正文。

### 验收条件

- 定向安装器回归检查确认源须知 UTF-8 BOM 和关键中文正文；准备脚本拒绝无 BOM 输入并将原始字节输出至构建资源目录。
- Windows x64 NSIS 构建产物位于根 `dist/` 的独立候选目录；核对源须知与 electron-builder 构建资源的 SHA-256 相同，资源含 UTF-8 BOM 且关键中文可解码。实际安装界面目视验收需单独记录，不用构建资源核验代替。
- 执行 `git diff --check`。说明真实安装界面是否目视验收、是否安装候选、签名状态和未完成边界。

### 完成记录（2026-10-06）

- 根因：`apps/desktop-electron/assets/installation-notice.txt` 原为无 BOM UTF-8；当前 electron-builder 的显式 `nsis.license` 路径直接将该文件交给 NSIS，没有走为本地化许可证追加 UTF-8 BOM 的转换分支，导致 NSIS 将中文正文错误解码。保留须知文字，只为源文件添加 UTF-8 BOM。
- `prepare-runtime.mjs` 现在在打包前检查 BOM，并把校验后的原始字节写入 `dist/.tmp/desktop-electron/build-resources/installation-notice.txt`；定向安装器回归 2/2 通过。构建资源与源须知 SHA-256 均为 `8DD610FB539E6A8A4B9F2F18B90D0A1B8B9F1C0BA19DAEAA5EBB73F40F13D68C`，BOM 和关键中文解码检查通过。
- Windows x64 NSIS 候选构建成功：`dist/apps/desktop-electron/license-bom-candidate-20261006/LFAA 0.1.1.exe`；`verify-packaged-runtime.mjs` 对该隔离候选验收通过，真实随包 CUA Driver 导入与工具注册通过。构建与验收未覆盖用户安装、启动交互或须知页面目视；候选 Authenticode 状态为 `NotSigned`。此前打开的根输出 `LFAA 0.1.1.exe` 未覆盖，现有 Web/Control Plane/Daemon 服务未重启或停止。
- 设置中心配置：无；本次未增加或更改设置项。`workspace-preflight` 在当前仓库未找到，未运行。
- 验证通过：Electron 安装清单与更新清单回归 11/11；CLI Loader 回归 1/1；更新清单版本校验；三个桌面脚本/Loader 语法检查；`git diff --check`；Windows x64 NSIS 包构建与随包插件导入检查。产物为 `dist/apps/desktop-electron/LFAA 0.1.1.exe`，158451467 字节。设置中心未新增或改动配置，版本日志未改版。
- 标准 `pnpm --filter lfaa-desktop-electron run package:win` 被 pnpm 工作区状态预检中止：无 TTY 时请求清理整个 `node_modules`。为保护工作区，未执行该清理；使用现有依赖直接运行 Electron Builder 的 package-only 命令，随后手动运行相同的随包插件验收。未重建 Web/Control Plane/Daemon，未安装 Setup，未重启 3000（仍由 PID 42080 监听）。
- 尚未实测：安装器窗口中的同意/拒绝点击、桌面快捷方式的实际创建及完整 Electron 窗口启动；本轮没有签名验证、Release 更新下载或鼠标/键盘操作测试。需在当前用户界面安装新 Setup 后确认这些 OS 交互结果。

## LFAA-CLIENT-WORKSPACE-RENDER-RECOVERY-01

### 用户目标与运行入口

- 修复登录后 Minecraft 常规模式与 Connectivity 常规模式显示“工作区暂时无法显示”的客户端渲染失败；页面必须能进入可用的业务面板，错误时应提供足以区分客户端异常与控制端 API 错误的摘要。
- 运行入口为当前 Web 的 `apps/web` 与共享 React 工作台；问题路径经过 `packages/client/ui-layout/src/Workbench.tsx`、`packages/client/ui-workspace/src/ApplicationWorkspace.tsx`，业务面板分别由 Minecraft 与 Connectivity Client Module 懒加载。
- 已发现的确定风险：`ApplicationWorkspace` 在渲染控件时直接对多个 `settings.shortcuts` 字段调用 `.map()`；历史 Host/Settings 响应可能缺少后来新增的快捷键字段，而同一包已针对 `openSideChat` 做默认值兼容。该风险已由定向回归覆盖，但是否就是用户当前截图的实际运行时异常，必须以登录态运行验收或错误边界的真实摘要确认。

### Owner、设置与边界

- Shortcut 与 Appearance 背景默认值唯一归 `packages/client/ui-settings-general/src/default-settings.ts`；读取兼容只在客户端补默认，不写回、不覆盖已保存的合法空数组、背景值或“无背景”选择，不新增设置项或服务端配置。
- 工作区布局和 React 错误呈现归现有 Client Owner；不更改 Connectivity API、EasyTier/Daemon 生命周期、Minecraft 部署/启停或账户/权限合同。
- 浏览器错误摘要只显示错误名和经过路径/链接/凭据模式脱敏且有长度上限的消息，不显示堆栈、不把异常发送到服务端。
- 性能与生命周期：快捷键与背景解析不新增订阅、请求、轮询或定时器；背景解析结果在工作台渲染中记忆化，错误摘要在边界捕获时生成一次。

### 允许修改

- `packages/client/ui-settings-general/src/default-settings.ts`：导出针对部分/旧版快捷键对象和背景对象的默认解析器，保持有效用户值优先。
- `packages/client/ui-layout/src/appearance-background-slot.ts`、`packages/client/ui-layout/src/Workbench.tsx`：统一路由背景槽映射；Connectivity 复用 appCenter 背景，并对缺失外观项安全回退。
- `packages/client/ui-workspace/src/ApplicationWorkspace.tsx`、`packages/client/ui-layout/src/Workbench.tsx`：对工作区渲染及快捷键匹配统一使用解析后的快捷键。
- `packages/client/ui-renderer/src/ClientRenderBoundary.tsx` 与同包纯错误摘要函数：错误页面显示安全摘要。
- `apps/cli/tests/**`：增加默认解析与敏感内容脱敏的定向回归。
- 本合同及任务索引；仅当当前实现证实 Owner 或产品事实有变化时修改架构文档。

### 禁止修改

- 不通过假账户、测试权限、Mock API 或降低权限绕过真实会话。
- 不吞掉渲染异常、不把错误状态当成功、不移除错误边界；不将堆栈、认证头、Cookie、令牌或任意本机路径写入服务端日志或界面。
- 不重启/终止现有 3000 服务或影响 Minecraft 实例；不以未登录浏览器、HTTP 200 或构建通过声称登录后工作区验收成功。
- 不调整无关主题、布局、设置字段、Connectivity Provider 或 EasyTier 接入行为。

### 验收条件

- 缺少 `shortcuts` 对象、缺少部分快捷键项及显式合法空数组都由同一设置 Owner 解析：缺项回退默认，用户保存的 `[]` 保持为空。
- Connectivity 常规模式映射到 `appCenter` 背景槽；缺失 Appearance 背景项回退到当前默认值，且保留已保存背景及“无背景”。
- 两个常规工作区对兼容后的快捷键读取不因历史设置缺项抛异常；其它字段不被重写。
- 错误摘要回归覆盖典型 React TypeError、超长消息、链接/本机路径和凭据样式内容；堆栈和敏感值不得呈现。
- 执行新增定向回归、受影响 Client 类型检查与 Web 构建、`git diff --check`，构建只写根 `dist/`。
- 尝试在用户当前登录浏览器实际打开 `/apps/connectivity/normal`；若浏览器自动化不可用，必须记录具体工具阻塞，并将登录后页面、真实 API、布局帧时间分别标为未验，不用匿名登录页替代。

### 本轮实现与验证记录（2026-10-06）

- 在设置默认值 Owner 增加兼容解析：缺失或无效的快捷键项使用现有默认值，合法空数组保持不变；ApplicationWorkspace 的按钮、全局快捷键和导航轨统一读取解析结果，避免旧 Host 响应触发数组访问异常。
- 客户端 React 错误边界显示异常类型和经过本机路径、链接及凭据模式脱敏并限制长度的摘要；完整异常仍只写浏览器控制台，不上送服务端。
- 定向回归 4/4、`tsc --noEmit -p tsconfig.client.json` 和 `git diff --check` 通过；Vite Web 生产构建处理 2223 个模块并写入根 `dist/apps/web`，现有 >500 KB chunk 警告保留，资源保留器记录 3 代并清理 72 个过期资源。`runtime-build-state.mjs web` 返回 `[]`。
- 当前 3000 服务仍由 PID 67336 提供，未重启；Connectivity/Minecraft 常规路由和 `/api/health` 返回 200，新入口 JS 返回 200。`agent-browser` 只能取得隔离匿名会话并显示登录页；Codex CUA 初始化报“failed to write kernel assets: 系统找不到指定的路径 (os error 3)”，无法检查用户的登录标签页或其控制台。因而当前 React 异常的确切摘要、登录后组件挂载、真实联机 API 操作和帧时间仍未验收；若刷新后错误仍存在，页面现在会显示摘要供继续定位。
- 未新增设置中心配置，复用现有快捷键默认值及 Appearance/Ant Design 主题。`workspace-preflight` 在当前 checkout 不存在，未运行。

#### 2026-10-06 `startsWith` 客户端渲染异常定位与修复

- 用户提供边界摘要 `TypeError: Cannot read properties of undefined (reading 'startsWith')` 后，确认 `Workbench` 主渲染路径把 `/apps/connectivity/normal` 的 `connectivity` 应用 ID 当作 Appearance 背景键读取；`backgrounds.connectivity` 不存在，随后对 `undefined` 调用 `.startsWith()`。Minecraft 等工作区的旧版部分背景响应也可能触发同类异常。
- 新增纯路由映射 `appearanceBackgroundSlotForRoute`，Connectivity 与 Workspace 统一复用 `appCenter`；外观默认 Owner 增加缺项解析，保留合法背景与“无背景”；工作台对渲染用解析值记忆化，并让设置页返回背景读取采用相同映射。
- 定向回归 6/6、Client TypeScript 检查、`git diff --check` 与 Vite Web 生产构建通过；Vite 处理 2224 个模块并只输出到根 `dist/apps/web`，保留既有 >500 KB chunk 警告；`runtime-build-state.mjs web` 返回 `[]`。
- 3000 端口仍由 PID 67336 提供，未重启。Connectivity/Minecraft 常规路由与 `/api/health` 返回 200，未认证 AI API 仍为 401。尝试检查当前登录浏览器时，Codex CUA 再次因 `failed to write kernel assets: 系统找不到指定的路径 (os error 3)` 初始化失败；因此登录后 React 挂载和联机面板仍未能从浏览器实测，HTTP 200 不作为该项验收证据。未新增设置中心配置；读取现有 Appearance 背景默认值及共享外观主题映射。

#### Windows Electron 已安装包与共享 Client 版本差异核查

- 用户反馈桌面窗口出现“工作区暂时无法显示”。目标运行入口是已安装的 `apps/desktop-electron` 本机控制端 + `dist/apps/web`，数据/API 仍归现有 Control Plane 与 Settings Owner；桌面页面不是由开发 Web 的 3000 进程提供。
- Web 与桌面共用 `packages/client/**` 源码，但各自构建/打包、安装目录和资源快照独立；Web 构建不会替换已安装 Electron 的 `resources/app-runtime/dist/apps/web`。Connectivity 的 Appearance 背景仍复用 `appCenter`，不增加设置或安装器配置。
- 已观察：本机 `LFAA.exe` 运行于 `D:\软件\LFAA`，其工作区 HTML 引用 `index-CS76G6lD.js`（随包资源时间 2026-10-06 16:08）；当前源码 Web 输出引用 `index-B4P1wNI1.js`（2026-10-06 16:32）。随包 `Workbench-DIcVtx2j.js` 仍把工作区应用 ID 直接用作背景键并对其值调用 `.startsWith()`；当前源码已改为统一槽映射。该桌面安装包没有包含已修复的共享 Client 构建，解释了用户看到的错误页；这属于打包与桌面验收缺口，不是有意取消桌面支持。
- 允许生成 Windows x64 Electron 本地安装候选并核对包内 Web 资源/依赖；禁止替换 `D:\软件\LFAA` 已安装程序、安装包、重启/终止当前 Electron/Control Plane/Daemon 或影响游戏进程。安装态复验须等用户明确安排桌面重启/安装窗口。
- 本次目标仅覆盖 Windows x64 Electron 候选与包内资源核对。当前项目记录的 macOS Electron 包与安装验收未完成，Linux 桌面和 Android 是后续平台目标；不能把共享 Client 源码描述成这些平台已发行。
- Windows x64 本地候选已重建：更新清单校验通过；Electron `win-unpacked` 运行树的 `index.html` 与当前 Web 构建 SHA-256 相同，`Workbench-10ATt6bh.js` 包内/源码 SHA-256 相同；包内 `@trycua/cua-driver@0.32.0` 导入与工具登记核验通过。安装候选为 `dist/apps/desktop-electron/LFAA 0.1.1.exe`，158535671 字节；Authenticode 状态为 `NotSigned`，未发布。
- 为避免 `package:win` 中的 pnpm workspace install 清理整个开发依赖树，本次复用先前已部署到 `dist/.tmp/desktop-electron/server-deploy` 且版本核对通过的生产依赖，执行 `prepare-runtime.mjs`、Electron Builder NSIS x64 和既有随包核验；没有安装到用户目录。当前 CUA 无法操控用户桌面，安装器点击、实际 Windows 安装/升级、登录态工作区和真实服务恢复均未验收。当前日志显示原桌面端 Daemon/Control Plane 在 16:46:18 收到 `SIGTERM`、Control Plane 于 16:46:59 退出；本次构建没有对 `D:\软件\LFAA` 安装目录或这些进程执行替换/重启。

## LFAA-DESKTOP-ELECTRON-INSTALL-PROGRESS-01：NSIS 安装期间显示文件写入详情

### 用户目标与运行入口

- 修复 Windows 安装界面在写入/复制程序文件时详情区为空的问题；保留 NSIS 实际总进度条，并让详情区能显示当前安装文件条目。
- 运行入口为 `apps/desktop-electron/package.json` 的 Windows x64 NSIS 构建；实际文件复制由锁定的 `app-builder-lib@26.15.3` NSIS 模板 `templates/nsis/installSection.nsh` 调用 `installApplicationFiles` 完成。
- 安装器与模板行为归现有 Electron Builder/NSIS 链；只通过 pnpm 锁定的依赖补丁调整交互安装时的详情输出，不改变安装目标、文件集、许可页、快捷方式、卸载或保留用户数据流程。

### Owner、设置与边界

- 不新增或读取设置中心配置；进度由 NSIS 安装器自身报告，非用户偏好。
- 根因已由锁定模板确认：复制文件前在非静默安装中执行 `SetDetailsPrint none`，项目 `customInstall` 钩子则在复制完成后才重新开启详情。
- 仅在该模板的现有 `IfNot ${Silent}` 分支内将详情输出切换为 `both`；静默安装分支保持不变。总进度由 NSIS 原有文件提取流程继续报告。
- 不新增运行时轮询、事件订阅或后台进程；安装详情随 NSIS 文件操作即时输出，不另行缓存文件清单。

### 允许修改

- 根 `package.json`、`pnpm-lock.yaml` 及根 `patches/` 下的 pnpm 补丁：锁定并补丁 `app-builder-lib@26.15.3` 的 NSIS 模板。
- `apps/desktop-electron/tests/installer-package.test.mjs`：增加补丁内容与静默分支保持不变的回归。
- 本合同及任务索引；不更改桌面版本号、安装资源、应用行为或设置中心。

### 禁止修改

- 不覆盖现有 `dist/apps/desktop-electron/LFAA 0.1.1.exe` 或此前的 License 修复候选；本轮构建必须写入根 `dist/apps/desktop-electron/` 下的全新独立目录。
- 不点击、安装、替换或卸载用户当前正在使用的安装程序；不停止或重启桌面、Web、Control Plane、Daemon、Minecraft 实例；不签名、发布或上传候选包。
- 不编写整套自定义 NSIS 安装脚本、不绕过用户同意页/权限、不修改静默安装行为；不声称已目视验收安装器，除非实际打开隔离候选并检查安装页面。

### 验收条件

- 回归确认根补丁只将 `IfNot ${Silent}` 内的安装详情模式由 `none` 改为 `both`，且原静默分支及 `installApplicationFiles` 顺序未被改写。
- 直接运行 Electron 安装器定向回归及 `git diff --check`；Windows x64 NSIS 包构建至隔离候选目录，并核对候选实际产物、NSIS 构建采用的锁定模板补丁和既有随包运行树验收。
- 如未实际打开安装候选，必须将“详情面板真实显示文件名”和现场进度视觉检查标记为未验；构建/模板证据不能替代安装器界面验收。
- 交付逐项列出本次变更文件绝对路径与职责，说明无设置中心变更，并报告实际构建结果和未覆盖的安装、静默安装及设备边界。

### 本轮实现与验收记录（2026-10-06）

- 锁定的 `app-builder-lib@26.15.3` 在复制应用文件前对非静默安装执行 `SetDetailsPrint none`，而项目 `customInstall` 在复制之后才开启详情。通过 pnpm 根补丁只把该交互安装分支改为 `SetDetailsPrint both`，使 NSIS 原生总进度继续工作，并让文件复制条目进入现有详情窗格；静默安装分支没有改动。
- `apps/desktop-electron/tests/installer-package.test.mjs` 新增检查，直接解析 electron-builder 当前关联的 `app-builder-lib` 模板，确认详情指令位于文件复制宏前且静默分支仍被条件保护；安装器定向回归 3/3 通过。
- 更新清单校验通过；`prepare-runtime.mjs` 核验并准备桌面运行目录通过。Windows x64 NSIS 候选成功构建至 `dist/apps/desktop-electron/install-progress-candidate-20261006/LFAA 0.1.1.exe`，大小 158535122 字节，SHA-256 为 `4F263F2918DD53B46A61FF5BFB96E9EE1AE49070772FD8E45012427BE5E2D7EC`，Authenticode 状态为 `NotSigned`。`verify-packaged-runtime.mjs` 对该候选的 CUA Driver 导入与工具注册核验通过。
- 变更没有新增设置中心配置；没有新增长期进程、计时器、轮询或事件订阅，详情使用 NSIS 已有文件操作输出。未测安装过程性能或视觉帧时间。
- `git diff --check` 通过；复核锁文件和 pnpm 补丁指向 `app-builder-lib@26.15.3`，当前 Electron Builder 依赖链接解析到已补丁模板。`scripts/workspace-preflight.mjs` 在当前 checkout 不存在，未运行。候选未安装、未打开安装器界面，因此实际窗格是否逐个显示文件名、安装中总进度视觉状态和静默安装交互均未验收；未签名、未发布。用户正在运行的安装窗口和服务未触碰。

## LFAA-DESKTOP-DAEMON-INTEGRATION-CLARITY-01：桌面内置 Daemon 与独立节点构建职责

### 用户目标与运行入口

- Windows 桌面版作为一个产品安装和启动；桌面主进程自动启动本机 Control Plane 与 Daemon，Daemon 继续作为独立节点进程，由现有认证任务与节点 Owner 控制。
- 远程节点继续通过现有 HTTPS 连接身份接入；只有独立节点运行/维护和桌面发行打包需要处理节点宿主构建，普通桌面用户无需手动构建或启动 Daemon。
- 目标入口为 Electron 桌面 Windows 安装链、根目录构建脚本及 `lfaa.bat` 的 Harness 启动菜单。

### Owner、设置与边界

- Electron `main.mjs` 负责启动和退出本机 Control Plane、Daemon 子进程；Daemon 节点执行归 `packages/host/daemon` 与 `daemon-app`；远程节点连接凭据和任务路由沿用当前 Control Plane/API Owner。
- `build:daemon` 实际构建 Windows Sandbox Host 并检查 Daemon 源码；将命令改为准确标示 `lfaa-sandbox-host.exe` 的职责，桌面打包链继续自动调用它并将产物随包装入。
- 不新增设置中心配置。节点身份、HTTPS 校验、用户数据目录、端口、进程生命周期与控制授权保持现有合同。

### 允许修改

- 根 `package.json` 与 `apps/daemon/package.json`：重命名沙箱宿主构建入口并更新 Electron Windows 打包依赖。
- `scripts/install-dependencies.ps1`：标明 Web/桌面自动托管本机 Daemon 与独立节点模式的区别，修正沙箱宿主构建提示。
- `docs/系统总体架构.md`、`packages/host/daemon/README.md` 与本合同：同步说明桌面集成、独立进程和远程节点的现有能力范围。

### 禁止修改

- 不合并 Control Plane 与 Daemon 进程，不改变 Electron 启动/关闭代码、Daemon 身份/HTTPS/任务协议、游戏数据、用户目录或权限边界。
- 不触碰当前工作树中已有改动的 Electron 安装资源、运行时组装、更新逻辑或安装器回归文件；不构建、安装、发布或替换桌面安装包，不停止运行中的 Web、Daemon 或游戏进程。
- 不把未接入的 Linux/macOS 远程 Daemon 服务安装、云端部署或开机自启描述成已完成。

### 验收条件

- Electron Windows 打包脚本在自身流程中构建 Sandbox Host，并把可执行文件放进单一桌面安装运行树；普通 Harness 构建与桌面安装包构建的产物范围在菜单/文档中写清。
- 启动菜单明确：常规桌面由桌面外壳自动启动本机 Daemon；独立 Daemon 模式用于独立节点/维护，不能误导为日常桌面启动步骤。
- 根与包级 JSON 可解析、PowerShell 脚本语法可解析、`git diff --check` 通过；不覆盖或运行当前桌面候选包。
- 最终说明逐项列出变更文件、未变更的设置中心配置、执行的静态检查及未进行的桌面/远程节点运行验收。

### 本轮实现与静态核对（2026-10-06）

- 将 `build:daemon` 改名为 `build:windows-sandbox-host`，包级原生构建名改为 `build:sandbox-host`。Desktop Windows 构建仍在同一个发行命令中编译此宿主，随后把本机 Daemon 运行树和宿主装入单一安装包；Electron 启动代码保持现状，由桌面主进程独立启动/关闭 Control Plane 和 Daemon 子进程。
- 根菜单 `3` 现在明确表示构建 Web、Control Plane 与 CLI 运行树，不是桌面安装器；菜单提供 Electron Windows 安装包实际命令，并注明本机 Daemon 随桌面自动启动。单独 Daemon 项改为“独立节点”模式。
- 更新系统架构与 Daemon Host README，区分桌面集成发行、本机独立进程、远程 HTTPS 节点接入和尚未接入的远程安装器/系统服务托管。
- 定向静态检查通过：根与 Daemon 包级 JSON 解析及脚本依赖核对通过；PowerShell AST 解析通过；`git diff --check` 通过。未运行构建、测试、Electron 安装包、当前浏览器、桌面安装、远程 Windows 节点或系统服务验收；不影响本机运行进程和 `dist/`。
- 未新增或修改设置中心配置；本轮仅修改构建入口命名、菜单说明和架构/包文档，没有新增运行时订阅、轮询或主机进程。

## LFAA-DESKTOP-ELECTRON-INSTALL-SMOOTHNESS-01：安装进度平滑与包名统一

### 用户目标与运行入口

- 针对用户截图中 NSIS 安装文件状态行快速闪烁进行修复；保留 NSIS 总体文件进度，并确认“复制到：<路径>”显示的是用户选择的程序安装目标目录。
- 下一 Windows x64 Electron 包的输出目录和安装器文件名采用 `LFAA-<版本号>`（例如 `LFAA-0.1.1`、`LFAA-0.1.1.exe`），不添加用途或日期后缀。
- 运行入口是 `apps/desktop-electron/package.json` 的 Windows x64 NSIS 构建。NSIS 模板在 `$INSTDIR` 上执行 `SetOutPath` 后提取应用文件；账户数据保留仍由现有 `customRemoveFiles` 覆盖安装/卸载流程负责。

### Owner、设置与边界

- 不新增设置中心配置；输出目录、NSIS 详情模式及应用文件目标归现有 Electron Builder 配置与 NSIS 模板。
- 官方 NSIS 文档说明 `listonly` 只把操作状态输出到详情列表，不更新状态栏；因此单独使用它会令截图中的状态提示行空白。交互安装需先向状态栏写入一次稳定的目标目录提示，再切换到 `listonly` 处理后续文件操作，避免逐文件覆盖该行；总体进度和静默分支不变。
- “复制到”是 `SetOutPath $INSTDIR` 的状态信息，不执行第二份应用副本；不改变用户选定的安装目录、升级迁移、数据保留或安装文件集。
- 不新增循环、轮询、事件订阅或产品运行进程；详情由 NSIS 自身的文件提取流程输出。

### 允许修改

- `patches/app-builder-lib@26.15.3.patch`、`pnpm-lock.yaml`：交互安装先写稳定状态提示，再切换到 `listonly` 并同步补丁哈希。
- `apps/desktop-electron/nsis/installer.nsh`：提供安装文件复制前的一次性目标目录提示。
- `apps/desktop-electron/package.json`：把 NSIS 安装器产物名改为 `LFAA-${version}.${ext}`；本轮隔离输出目录为 `dist/apps/desktop-electron/LFAA-0.1.1/`。
- `apps/desktop-electron/tests/installer-package.test.mjs`：覆盖详情模式、静默分支、`SetOutPath $INSTDIR` 顺序与版本化安装包命名。
- 本合同和任务索引；不更改 `productName`、安装目标、数据保留逻辑、项目版本或设置中心。

### 禁止修改

- 不复用或覆盖既有 `LFAA 0.1.1.exe`、`install-progress-candidate-20261006`、`license-bom-candidate-20261006` 等候选；允许在确认目录只包含本合同本轮刚生成的 `LFAA-0.1.1` 候选后重建该短命名目录；不写入根 `dist/` 以外位置。
- 不操作用户当前安装中的窗口，不向 `D:\软件\LFAA` 安装、复制或替换文件，不重启/停止桌面服务、Web、Control Plane、Daemon 或游戏进程。
- 不改 `$INSTDIR` 目标与 `customRemoveFiles` 数据恢复路径；不声称已目视确认闪烁消失，除非真实打开新候选安装页面检查。

### 验收条件

- 定向回归证明 NSIS 只在非静默分支先以 `textonly` 显示一次目标目录提示，再切换到 `listonly`；两条指令位于 `SetOutPath $INSTDIR` 与 `installApplicationFiles` 文件提取之前，静默分支不变；Electron Builder 安装器文件名模板为 `LFAA-${version}.${ext}`。
- 更新清单校验与运行目录准备通过；Windows x64 NSIS 候选构建到短路径 `dist/apps/desktop-electron/LFAA-0.1.1/LFAA-0.1.1.exe`，随包运行树核验通过，记录大小、摘要与签名状态。
- “复制到”语义依据模板和回归检查核实；未实际在隔离目标安装时，不报告桌面升级、文件覆盖/保留运行行为通过。未打开 UI 时明确说明闪烁视觉复验未做。
- 执行定向回归、`git diff --check` 和可用仓库 Gate；逐项列出修改文件绝对路径、设置中心配置及实际验收边界。

### 本轮实现与验收记录（2026-10-06）

- 最终将 `app-builder-lib@26.15.3` 交互安装分支设为 `SetDetailsPrint listonly`。NSIS 官方参考说明该模式将操作状态只写入详情列表，状态栏不再逐操作更新；这是针对截图闪烁行的修复判断，实际 UI 闪烁消失与否尚未目视复验。静默分支保留原有条件，总体进度条未改。
- 核实配置允许用户选择安装目录；NSIS 模板先执行 `SetOutPath $INSTDIR`，再由 `installApplicationFiles` 解压程序文件。“复制到：D:\软件\LFAA”是当前安装目标提示，不是第二份程序副本。升级时 `data/` 恢复仍由 `customRemoveFiles` 执行，本轮未改。
- 安装器文件名模板为 `LFAA-${version}.${ext}`；隔离输出目录为 `dist/apps/desktop-electron/LFAA-0.1.1/`，最终文件 `LFAA-0.1.1.exe`。大小 158535109 字节，SHA-256 为 `6CB90EFC24FE5A69958B031D8826BFD366CAC31661ED201A06E5E9A68C729417`，Authenticode `NotSigned`。
- 定向安装器回归 3/3、更新清单校验、运行目录准备、Windows x64 NSIS 构建、候选包 CUA Driver 随包导入/工具注册核验和 `git diff --check` 均通过。`workspace-preflight` 脚本在当前 checkout 不存在，未运行。
- 未新增设置中心配置、运行进程、计时器、轮询或事件订阅；未安装候选包、未操作用户当前安装目录或运行中服务。构建模板没有运行时性能开销，安装页面帧时间未测。

### 用户截图反馈补充合同（2026-10-06）

- 用户反馈候选包进度条仍推进，但原状态提示区域变空。根因是 `listonly` 将安装操作状态仅送往详情列表，不再写入状态栏；前版的无闪烁调整遗漏了稳定状态提示。
- 本轮在自有 `nsis/installer.nsh` 定义单次状态提示“正在安装到：$INSTDIR”，并由受锁定补丁的 NSIS 模板在非静默文件提取前调用；调用后继续 `listonly`，使后续文件状态不覆盖单行提示。不要把该静态提示描述成逐文件实时进度。
- 直接回归验证宏定义、非静默调用顺序、`listonly`、提取顺序及静默分支；重新构建短命名 Windows x64 候选并核验产物。无法目视安装器 UI 时，明确保留该验收缺口。
- `node --test apps/desktop-electron/tests/installer-package.test.mjs` 3/3 通过；更新清单校验、`prepare-runtime.mjs`、最终 Windows x64 NSIS 构建和 `verify-packaged-runtime.mjs dist/apps/desktop-electron` 通过。最终候选 `dist/apps/desktop-electron/LFAA-0.1.1.exe` 为 158752360 字节，SHA-256 `A82A71C6BB8ACD491A59E72455CA4595D794DAE9153CEA2936BB88E5B4F2A1B1`，Authenticode `NotSigned`；`latest.yml` 文件名/大小与包一致；`git diff --check` 通过。`workspace-preflight` 脚本不存在，未运行。
- 未安装候选或操作用户现有安装目录/运行服务；当前环境未执行安装器页面的目视检查，因此状态提示是否在真实 UI 中持续显示、视觉闪烁是否消失，仍待实机验收。无设置中心配置变更；无运行时进程、计时器、轮询或事件订阅变更。

## LFAA-WEB-VERSION-UPDATE-CHECK-01：Web 显示项目版本并检查官方更新清单

### 用户目标与运行入口

- 用户在 Web 设置中心“关于与更新”查看当前 Web 构建的 LFAA 版本，点击后从 LFAA 官方 `update.json` 检查是否有更新；显示最新版本与更新说明，并提供官方发布页入口。
- 主要运行入口是 `apps/cli/bin/lfaa.mjs web` 提供的 `dist/apps/web`；`apps/web` Vite 开发/生产构建生成同一套共享 Client。
- 当前版本从 `apps/cli/package.json` 读取并注入 Web 构建；Web、CLI、Electron 包版本须一致。更新源从 `apps/cli/package.json` 的 GitHub 仓库元数据推导，限制为该仓库的 HTTPS 官方清单与 Release 页面。
- 更新清单协议以现有 `update.json` 和 Electron 更新合同为准；Web 只做手动只读检查，发现更新后展示清单内容并链接官方发布页，不从浏览器自动下载、安装、替换或重启应用。
- 设置中心配置盘点：无更新源或自动更新偏好设置；本任务不新增持久化设置，更新检查只由用户点击触发。

### 允许修改

- `apps/web/vite.config.ts` 与 Web 构建元数据读取/类型/定向测试：注入当前项目版本、官方清单地址和发布页；版本不一致或仓库地址不符合预期时构建失败。
- `packages/client/connection/src/`：提供共享 Client 可读的构建版本常量。
- `packages/client/ui-settings/src/SettingsPage.tsx` 与其纯更新清单读取/校验帮助模块：支持 Web 手动检查并展示状态；保留 Electron Host 的下载与安装流程。
- `apps/web/tests/`：覆盖版本元数据、稳定版本比较、合法/无效清单与更新状态判定。
- `docs/系统总体架构.md` 与 `README.md`：同步官方清单同时供 Electron 自动更新和 Web 手动检查的事实，以及 Web 不执行程序安装的边界。
- 本合同及索引。

### 禁止修改

- 不改 `update.json`、项目版本、`docs/updata-log.md` 或 Electron 自动下载/安装流程；不把 Web 或 Tauri 标成已支持桌面安装更新。
- 不由页面加载、后台计时器或轮询触发外网请求；不并发发送重复检查，不向官方清单请求传递账户信息或凭据。
- 不信任清单内的任意下载 URL/HTML；显示文本须作为普通文本渲染，发布链接只使用构建时校验的 LFAA 官方仓库地址。
- 不新增 API、服务、用户设置、权限绕行或模拟更新状态；不影响控制端身份/授权、Daemon、Minecraft 与用户运行数据。

### 验收条件

- Web About 页面显示本次构建的项目版本；Electron 仍显示 `app.getVersion()` 提供的宿主版本，Tauri 不因此获得更新器能力。
- Web 按钮真实 GET 官方 HTTPS `update.json`，校验 schema、稳定版版本号、版本标题、发布日期、更新说明、最低支持版本及仓库地址；报告已是最新、发现新版、清单停用或可诊断失败。
- 单次请求有界超时、不可重叠，并在离开 About 或组件卸载时中止；没有自动轮询或持续订阅。
- 运行 Web 更新逻辑定向回归、Client TypeScript 检查、Web 构建至根 `dist/` 及 `git diff --check`。用户授权重启后，只重启经 PID 与命令行核实的当前 `lfaa web --no-local-daemon` 进程；先确认没有需保护的本机 Minecraft 进程，再从当前 127.0.0.1:3000 浏览器会话验收页面显示和真实官方清单检查。无登录态浏览器不得冒充页面验收。

### 本轮实现与验收记录（2026-10-06）

- `apps/web` 构建时从 CLI、Web、Electron 包元数据注入一致的项目版本，并从 CLI 仓库元数据生成固定的官方清单/Release 地址。Settings About 显示 `LFAA 0.1.1`；用户点击后才读取官方 `update.json`，校验版本、日期、说明、最低版本及地址，展示清单结果和官方发布页。Web 不自动下载、安装、替换或重启程序。
- `pnpm --filter lfaa-web run test:version-update` 7/7 通过；`pnpm exec tsc --noEmit -p tsconfig.client.json` 通过；`pnpm run build:web` 通过（2226 modules，产物位于根 `dist/apps/web`）；`git diff --check` 通过。Vite 输出保留既有大分块警告。`workspace-preflight` 在当前仓库不存在，未运行。构建状态工具仅报告无关 Host 产物过期，本任务没有重建 Host。
- 重启前确认 3000 端口为 PID 67336 的 `lfaa.mjs web --no-local-daemon`，本机 Java/Minecraft 进程数为 0；仅重启该 Web 进程，新 PID 58492。重启后 `/api/health` 和 About 页面均 HTTP 200；已有登录态浏览器重新点击检查后显示官方 `LFAA 0.1.2`、三条更新说明及官方 Release 链接。
- 更新请求仅由按钮触发，最多一个在途请求，超时 8 秒，离开 About 或卸载时中止；没有轮询、持续订阅或增长中的缓存。未新增或读取设置中心配置；使用现有 About 页面主题样式。未做帧时间测量（本次功能无动画或持续渲染工作）；桌面安装器和其他平台仍按各自流程验收。

## LFAA-DESKTOP-UPDATE-PROMPT-UI-01：工作台内静音更新弹窗

### 用户目标与运行入口

- 把 Windows Electron 发现新版、下载完成待安装、下载失败及受控退出失败提示从 Windows 原生消息框改为 LFAA 工作台内的自有提示；参照用户提供的现代圆角更新弹窗，明确版本、发布日期、更新说明和下一步操作，不播放系统提示音。
- 更新决策仍由 `apps/desktop-electron/src/main.mjs` 单一持有；仅提示界面移至共享 Client `packages/client/ui-layout/src/Workbench.tsx`，IPC 通过 `apps/desktop-electron/src/preload.cjs` 和 Connection 类型定义传递。
- 设置中心盘点：不增加自动下载、跳过版本或提示音配置。更新提示使用现有外观主题、强调色、字体、字号及减少动态效果映射；全局 AI Work `notificationSound` 配置只控制 AI Work 通知，本功能不得读取或播放该提示音。

### 允许修改

- Electron 更新提示 IPC、主进程提示桥接及其直接回归；只向当前可信主窗口发送经校验的清单展示字段，并核对响应请求 ID、阶段和动作。
- Client Connection 中桌面更新提示类型，`Workbench` 全局工作台内提示呈现及其直接样式；下载、安装与延后决策继续回到原 Electron 更新协调器。
- 本合同实施记录和索引。

### 禁止修改

- 不改变更新源、清单校验、自动检查间隔、mandatory 语义、下载/安装顺序和关闭本机服务的流程；未经用户同意不下载或安装。
- 不保留更新流程使用的原生 `showMessageBox`/`showErrorBox`，不调用 Web Audio/系统通知/提示音；不可显示提示时安全地延后或记录错误，不暗中接受更新。
- 不新增设置项、定时器轮询、独立服务、外部 UI 依赖或新的更新状态 Owner；不影响 AI Work 通知音和其他非更新提示。

### 验收条件

- 单元回归覆盖 Renderer 未就绪时待送达提示、有效/无效决策、强制更新不可延后的动作，以及窗口关闭/等待超时的安全延后与清理。
- 更新发现、下载完成、更新下载失败和服务关闭失败均不再调用系统消息框；提示 UI 明确呈现真实版本、日期/说明与对应可用操作，所有操作返回现有主进程 Owner。
- Client 类型检查、更新 Owner/提示桥接定向测试、UI 包构建及 `git diff --check` 通过；待决提示并发上限、计时器清理和 Renderer 重载重发有定向回归覆盖。真实打包 Electron 桌面提示目视验收若环境不可用，必须明确标注未验，不能把静态与构建结果描述为视觉验收。
- 最终列出全部改动文件绝对路径、设置中心配置使用情况、验证结果及未验收边界；所有构建产物只写入根 `dist/`。

### 本轮实现与验收记录（2026-10-06）

- 将自动/手动发现更新、下载完成、下载失败和本机服务关闭失败提示统一改为共享工作台 Modal。更新卡片显示 LFAA 版本、发布日期、更新说明和当前阶段动作；延后、下载、安装仍通过原主进程更新 Owner 决策，不增加跳过版本或自动下载偏好。更新流程不再调用 Electron 原生消息框，不触发其系统声音；AI Work 通知音链路未修改。
- 增加受限 IPC 与待决提示桥接。Renderer 只有在监听安装后才标记就绪；页面加载期间的提示会排队，刷新后重新发送。主进程校验 Renderer、请求 ID、阶段动作及 mandatory 规则；同时最多保留一个决策弹窗，窗口关闭和 15 分钟等待超时均安全延后/关闭提示并清除计时器，不会误下载或安装。
- 设置中心配置盘点：未新增配置；沿用现有 `appearance.theme`、`appearance.accentColor`、界面/正文字体和字号、对比度、遮罩透明度、模糊、减少动态效果；不读取 `general.notificationSound`。
- `pnpm --filter lfaa-desktop-electron run test:update-manifest` 24/24 通过；Electron `main.mjs`、preload 与提示桥接 Node 语法检查通过；Client TypeScript 检查通过；`pnpm --filter lfaa-client-ui-layout run build` 通过；最终 `pnpm run build:web` 通过（2226 模块，产物位于 `dist/apps/web`；仓库现有 >500 KB chunk 提示仍在）；`git diff --check` 通过。Web 指纹复核为当前；Host 指纹返回 `host` 过期。
- 未构建 Electron 安装候选：`dist/apps/control-plane` 的 Host 构建指纹相对当前源码过期，直接桌面打包会把旧 Control Plane 与新桌面主进程混装；本轮没有覆盖正在运行的 Host 产物，也没有重启当前应用/服务。Codex CUA 浏览器初始化仍因 Windows 路径错误失败，未能在真实 Electron 窗口触发更新弹窗或检查声音；因此本轮证明的是回归、类型和构建，不声称已完成桌面目视验收。真实安装包视觉仍待隔离桌面候选验收。

## LFAA-DESKTOP-UPDATE-DEFER-SUPPRESSION-01：进程内暂缓同版本更新提示

### 用户目标与运行入口

- 用户选择“暂不更新”后，同一应用进程内的自动检查与设置页手动检查均不再重复提示该版本；退出并重新启动应用后，允许再次提示。
- 本合同修订 `LFAA-DESKTOP-UPDATE-CONSENT-CHECK-01` 中“同一版本暂缓后手动检查可再次询问”的旧行为；旧记录保留为历史，本合同定义当前规则。
- 运行入口为 Windows Electron `apps/desktop-electron/src/main.mjs`，唯一更新流程 Owner 为 `apps/desktop-electron/src/update-flow.mjs`；共享设置页只发起现有手动检查并展示结果。
- 设置中心盘点：没有更新开关、跳过版本设置或相关持久化偏好。本任务只复用更新流程已有的内存状态，不新增设置、账户写入或磁盘状态；Web/Tauri/Android 不受影响。

### 允许修改

- `apps/desktop-electron/src/update-flow.mjs` 中同版本暂缓判定及其直接长期回归。
- 本合同、任务索引及必要交付记录。

### 禁止修改

- 不新增第二套更新状态 Owner，不把暂缓状态写入设置、账户、文件或跨进程存储。
- 不改变更新源、检查间隔、版本比较、Release feed 校验、mandatory/最低支持版本、下载/安装顺序或提示 UI。
- 不重启或覆盖正在运行的 Web、Control Plane、Daemon；不打包、发布或安装 Electron 候选包。

### 验收条件

- 暂缓同一版本后，后续自动检查及手动检查均返回暂缓状态，不再请求 Release feed 或显示更新提示，也不开始下载。
- 创建新的更新流程实例（对应应用完整退出后重新启动）后，该版本可重新触发提示。
- 运行 Electron 更新流程直接回归和差异检查；说明未做的 Electron 实机/安装包验收，并列出全部变更文件及设置中心配置使用情况。

### 本轮实现与验收记录（2026-10-06）

- 根因为更新流程只让自动检查遵守 `deferredVersion`，手动检查会绕过暂缓判断。现由 Electron 更新协调器对自动与手动检查统一按版本判断；同一版本暂缓后，即使 6 小时自动复查或用户再次手动检查，也只返回 `deferred`，在读取清单后不再触发 Release feed 检查、更新提示或下载。该状态仍是协调器闭包中的进程内存变量，完整退出会清除，未写入账户设置或磁盘。
- 设置中心盘点：无桌面更新或跳过版本设置；未新增、修改或读取任何设置中心配置。设置页手动检查入口与外观、通知设置未改。
- `pnpm --filter lfaa-desktop-electron run test:update-manifest` 通过，24/24；更新流程、Electron 主进程与 preload 的 `node --check` 通过；目标文件 `git diff --check` 通过。未运行构建、workspace-preflight 或根质量/发布 Gate：本 checkout 中 `scripts/workspace-preflight.mjs` 不存在，根 `package.json` 未登记质量/发布 Gate；本次仅改更新协调器及文档，无界面与装配变化。
- 未构建 Electron 安装候选或在真实桌面窗口操作；因此验收证明覆盖更新流程的自动/手动分支与重启后重问行为，不证明当前已安装版本已包含修复。没有重启或覆盖任何运行中服务。

## LFAA-DESKTOP-UPDATE-PACKAGE-REBUILD-01：重建静音更新提示 Electron 候选包

### 用户目标与运行入口

- 重建 Windows x64 Electron 安装候选，使新候选包含当前工作台静音更新 Modal、主进程提示桥接与“暂不更新”同版本进程内抑制逻辑；产物名按现有用户约定使用 `LFAA-版本号.exe`。
- 唯一桌面入口为 `apps/desktop-electron` 的 `package:win`；包运行树由 `scripts/prepare-runtime.mjs` 从根 `dist/apps/web`、`dist/apps/control-plane`、Daemon Sandbox Host 和锁定运行依赖组装。项目版本从 `docs/updata-log.md`、CLI/Web/Electron 元数据和 `update.json` 对账。
- 设置中心盘点：无自动更新、跳过版本或提示音控制项；不修改设置，不把暂缓状态持久化。

### 允许修改

- 只更新构建脚本管理的 `dist/apps/desktop-electron/` 和 `dist/.tmp/desktop-electron/` 候选/临时产物。
- 若生产依赖的 `pnpm deploy` 因 Electron 打包专用补丁不属于目标生产依赖而拒绝执行，只在该次 deploy 命令局部启用 `allowUnusedPatches`；保留随后的工作区安装严格校验，不改全局/工作区补丁策略。
- 允许对 `apps/desktop-electron/package.json` 的 `package:win` 增加上述局部 deploy 参数；其它依赖、版本和构建步骤不改。
- `docs/PROMPTS.md` 本任务索引与实际验收记录。

### 禁止修改

- Web PID 58492 当前使用 `dist/apps/web` 与 Control Plane。两者构建指纹有效时不再执行会覆盖 `dist/apps/web`、`dist/apps/control-plane` 或 `dist/apps/daemon` 的全量入口构建。
- 不安装、启动或升级候选，不重启 Web、Control Plane、Daemon 或现有桌面应用；不签名、发布、上传、提交或改变项目版本/更新日志。
- 不清理 `dist/` 全根目录；只允许按桌面打包脚本的职责重建指定桌面临时运行树和 Electron 产物。
- 不将 `allowUnusedPatches` 写入 `pnpm-workspace.yaml` 或持久化 pnpm 配置，不忽略 Electron 安装依赖真正使用补丁时的应用失败。

### 验收条件

- 构建前核对 Windows x64/Node、更新清单与项目版本、Host/Web 指纹、活动服务 PID 及构建实际管理的精确路径。
- Electron 更新流程回归与更新清单校验通过；安装候选位于根 `dist/apps/desktop-electron/`，名称为 `LFAA-<package version>.exe`，核对大小、SHA-256、签名状态和实际包版本。
- `verify-packaged-runtime.mjs` 对候选中的真实运行树执行 CUA Driver 插件导入验收；静态核对打包 `main.mjs`/preload 与工作台资源确实包含本轮更新提示代码。
- 不将构建或包内模块导入称为安装/启动验收；最终列出全部改动文件、设置中心配置、命令结果和未运行步骤。

### 本轮实现与验收记录（2026-10-06）

- 首次标准打包在生产依赖 `pnpm deploy` 阶段被工作区 Electron-only 补丁 `app-builder-lib@26.15.3` 判为未使用并失败。按 pnpm 官方 `allowUnusedPatches` 配置语义，只在该生产 deploy 子命令增加 `--config.allowUnusedPatches=true`；随后的完整工作区 `pnpm install` 保持原严格策略，安装器测试确认补丁仍实际应用。未改 `pnpm-workspace.yaml` 补丁注册、补丁正文或全局 pnpm 设置。
- `pnpm --filter lfaa-desktop-electron run package:win` 最终通过；pnpm 恢复工作区 110 个项目依赖，CUA Driver `0.32.0` 版本匹配；Electron Builder `26.15.3` 生成 `dist/apps/desktop-electron/LFAA-0.1.1.exe`，大小 `158465772` 字节，SHA-256 `FAA2B3ED334C9FA3F73A1E948BD9283C0F27DFD0DF695C577EAFE429CF53ABDF`，Authenticode 状态 `NotSigned`。`latest.yml` 版本、文件名、大小及 SHA-512 与安装包一致；未上传或发布。
- `node apps/desktop-electron/scripts/update-manifest.mjs validate` 通过；`pnpm --filter lfaa-desktop-electron run test:update-manifest` 24/24；`node --test apps/desktop-electron/tests/installer-package.test.mjs` 3/3；Electron Builder 随包验收输出“桌面 Profile CUA Driver 导入与工具注册通过”。从实际 `app.asar` 提取核对 `main.mjs`、`preload.cjs`、`update-flow.mjs` 与 `update-prompt-broker.mjs`；同版本暂缓判断存在于包内，更新提示调用自有 broker，没有原生消息框调用。实际打包 Web 资源 `Workbench-CLWl6wvD.js` 与 CSS 均包含工作台更新弹窗。
- 构建前后 Host/Web 指纹均为当前（`[]`）；未重建/覆盖其活动输出。PID 58492 的 Web `/api/health` 构建期间与结束后均为 HTTP 200。没有安装或启动 NSIS 候选，也没有重启任何服务；因此确认新候选内容正确，但尚未目视验收启动后的真实 Electron 弹窗。桌面更新逻辑无设置中心配置变更；没有增加轮询、计时器、订阅或用户数据写入。
- 适用的 `scripts/workspace-preflight.mjs` 不存在，根 `package.json` 没有质量/发布 Gate；这两项未运行。最终 `git diff --check` 通过。

## LFAA-APP-VERSION-REBASE-01：将更新版本线设为 0.0.1 → 0.0.2

### 用户目标与运行入口

- 用户要求以 `LFAA 0.0.1` 为已安装基线，将已删除的 GitHub `0.1.2` 更新目标改为 `LFAA 0.0.2`，生成 Windows Electron `LFAA-0.0.2.exe` 候选。
- 项目版本 Owner 为 `docs/updata-log.md`；Web/Electron 更新清单是该版本的投影；当前实际产品版本由 CLI、Web 与 Electron 包元数据共同构建并验证。
- Electron 候选 Web 资源应在 `dist/.tmp/desktop-electron/` 独立构建，再装入包运行树，不覆盖当前 Web 服务使用的 `dist/apps/web`。
- 设置中心配置盘点：无版本号或更新源设置；本任务不新增或修改设置。

### 允许修改

- `docs/updata-log.md`、`update.json`，把本轮正式候选版本设为 `0.0.2`、最低支持版本设为 `0.0.1`；保留既有日志条目作为历史记录。
- `apps/cli/package.json`、`apps/web/package.json`、`apps/desktop-electron/package.json` 的产品版本对齐至 `0.0.2`。
- `apps/web/package.json` 中将 Web 候选构建输出到根 `dist/.tmp/desktop-electron/web-candidate` 的脚本；Electron 准备运行树时从该候选目录复制 Web 资源，不读写正式运行中的 Web 产物。
- `apps/web/tests/` 与 `apps/desktop-electron/tests/` 中直接验证版本元数据、`0.0.1 → 0.0.2` 比较和更新流程的长期回归。
- 本合同索引与验收记录；构建工具管理的根 `dist/apps/desktop-electron/` 与 `dist/.tmp/desktop-electron/` 产物。

### 禁止修改

- 不回写或删除 #1–#11 既有更新日志，不把已删除的 GitHub `0.1.2` 重新发布或上传；仅生成本地候选。
- 不覆盖 `dist/apps/web`、`dist/apps/control-plane`、`dist/apps/daemon`，不重启或替换当前 Web、Control Plane、Daemon 或已安装桌面应用。
- 不清理根 `dist/`；仅允许清理 Electron 脚本管理的桌面临时目录及桌面安装候选。
- 不改变更新源、签名策略、mandatory 语义、检查节奏、下载/安装 Owner 或用户数据。

### 验收条件

- `docs/updata-log.md`、CLI/Web/Electron 产品版本及 `update.json.version/title/publishedAt/releaseNotes` 一致为 `0.0.2`；`minimumSupportedVersion` 为 `0.0.1`。
- 定向回归确认基线 `0.0.1` 可发现 `0.0.2` 更新，更新包内 Web 构建版本为 `0.0.2`。
- Windows x64 Electron `package:win` 及随包运行树验收通过；核对包名、内部版本、哈希、签名状态、工作台更新提示资源及暂缓逻辑。
- 确认构建期间未改写正在运行 Web 使用的 `dist/apps/web` 指纹；明确报告尚未执行的真实安装/更新/视觉验收及外部发布。

### 实施与验收记录

- 版本链现为 `0.0.1 → 0.0.2`：`docs/updata-log.md` 新增 #12 `LFAA 0.0.2`，保留 #1–#11 历史；CLI、Web、Electron 包版本及 `update.json` 均为 `0.0.2`，最低支持版本为 `0.0.1`。此前 GitHub `0.1.2` 已由用户删除；本轮未访问、上传或重新发布任何 GitHub Release。
- Electron `package:win` 先把 Web 源码构建到 `dist/.tmp/desktop-electron/web-candidate`，再从该候选组装 Electron 运行树，避免覆盖当前服务使用的 `dist/apps/web`。候选包内 `package.json` 为 `0.0.2`；从 `app.asar` 核实更新下载提示使用工作台 prompt broker、更新流程没有原生消息框调用、同版本暂缓判断存在；随包 Web 资源包含 `0.0.2` 和“暂不更新”。
- `pnpm --filter lfaa-web run test:version-update` 通过 7/7；`pnpm --filter lfaa-desktop-electron run test:update-manifest` 通过 24/24；`node --test apps/desktop-electron/tests/installer-package.test.mjs` 通过 3/3；`node apps/desktop-electron/scripts/update-manifest.mjs validate` 与 `git diff --check` 通过。Web 候选构建输出 2226 个模块至隔离候选目录；Vite 报告既有大分块提示。
- `pnpm --filter lfaa-desktop-electron run package:win` 通过，生成 `dist/apps/desktop-electron/LFAA-0.0.2.exe`，大小 `158463208` 字节，SHA-256 `09629CF014B4FB4C0922794C7137A4A4327B86191AED40286C70E00CD0901D2F`；`latest.yml` 的版本、包名、大小和 SHA-512 与安装包一致；Authenticode 为 `NotSigned`。随包 CUA Driver 导入与工具注册验收通过。
- 构建前后 `dist/apps/web/index.html` SHA-256 均为 `A0868D7DAD49FE42809CB9A1FE7CC66D1FEAAA5273CBD9A9E445EFF7250DA28B`，`build-state.json` 均为 `B6F64C725D0C3EDD77BEF16B605AB79205B53CEBA4CD52743A16DB3613B6D81B`；PID 58492 的 `http://127.0.0.1:3000/api/health` 返回 HTTP 200，构建期间未重启服务。设置中心无版本或更新源配置，本轮未新增/改动设置；版本映射使用既有产品设置页和 Electron 更新流程。
- 此次修改只增加一次打包用的候选 Web 构建工作量；未进行浏览器交互帧时间测量，未安装/启动安装包，未目视检查真实 Electron 更新弹窗，也未进行真实下载升级。当前安装为 `0.1.1` 的客户端不会把 `0.0.2` 视为更高版本；要验证 `0.0.1 → 0.0.2` 自动升级，需要先使用 `0.0.1` 基线安装。没有代码签名、GitHub 上传或 Release 发布。仓库没有 `scripts/workspace-preflight.mjs`，根 `package.json` 没有额外质量/发布 Gate；未运行。

## LFAA-DESKTOP-UPDATE-RELEASE-003：修复更新源 404 提示并发布 LFAA 0.0.3

### 用户目标与运行入口

- 当前桌面版本为 `0.0.2`。用户报告 Electron 请求 `https://github.com/yubboo/LFAA/releases/latest/download/latest.yml` 返回 404；运行时截图显示更新错误正文把原始 HTTP 响应头及 GitHub 会话 Cookie 展示到了界面。
- 修复范围是桌面更新唯一 Owner `apps/desktop-electron/src/update-flow.mjs` 与其 `main.mjs` 调用/日志、更新回归；更新检查失败只能向 UI 与日志输出脱敏摘要，不保留原始响应头、Cookie、响应体或调用栈。
- 本轮正式目标为 `LFAA 0.0.3`。版本 Owner 为 `docs/updata-log.md`，更新清单为 `update.json`；桌面 Release feed 需要同时提供 Windows 安装程序及 `latest.yml`。
- 用户指定的发布说明：新增可插件化工作流核心并完善数据分层管理；修复 Electron 桌面启动依赖，补齐带安装须知确认、详细进度、品牌图标和桌面快捷方式的 Windows 安装器；接入桌面版自动与手动检查更新，下载与安装前明确征求用户选择。
- 设置中心无更新源/版本开关，本轮不增加或修改设置；继续使用现有“关于与更新”和 Electron 更新 Owner。

### 允许修改

- Electron 更新流程错误对外信息与直接相关长期回归；只提供有限、安全的 HTTP 状态摘要，禁止把上游错误全文写入用户界面或日志。
- 本版本产品元数据、`docs/updata-log.md`、`update.json`、受影响发布说明与本任务合同；Windows x64 Electron 打包输出。
- 为发布本版本所需的精准 Git 提交、`main` 推送、`0.0.3` Release Tag 与 GitHub Release 资产（`LFAA-0.0.3.exe`、`latest.yml` 及安装器 blockmap）。提交内容须逐项审阅，且不得混入未经授权或未完成的并行改动。

### 禁止修改

- 不更改 GitHub Actions/凭据/访问策略，不将用户截图中的会话 Cookie 或任何 Token 写入代码、提交、日志或发布说明。
- 不重写 Git 历史、不强推、不删除或覆盖现有 tag/release；仅当目标名称尚不存在时创建 `0.0.3`。
- 不在真实主机上安装候选、停止/重启当前服务或客户端；不发布 npm、商店或其他平台版本。

### 验收条件

- 更新流程遇到含 Cookie、响应头和堆栈的 HTTP 错误时，对用户与日志只显示脱敏摘要，并保留针对 404 的可读提示。
- 更新/安装器回归、版本清单校验、Windows x64 NSIS 包构建通过；包名、版本、大小和 `latest.yml` 哈希匹配。
- 先审阅并只提交授权差异，随后推送 `main` 并建立官方 `0.0.3` Release，资产可从 `releases/latest/download/` 下载。
- 明确记录没有真实安装/桌面视觉/自动升级验收的边界。用户截图包含 GitHub 会话 Cookie，提醒用户结束该会话并重新认证。

### 实施与本地验收记录

- `apps/desktop-electron/src/update-flow.mjs` 现在只向 UI 和日志返回有限的安全错误摘要；HTTP 404 显示“官方更新文件尚未发布或暂时不可用（HTTP 404），请稍后重试。”，不会输出原始响应、响应头、Cookie 或堆栈。主进程更新错误事件和自动检查日志使用同一摘要 Owner；回归使用合成 Cookie 标记确认敏感响应不会泄露。
- CLI/Web/Electron 包元数据与 `update.json` 均为 `0.0.3`，最低支持版本为 `0.0.1`；保留历史 `0.1.2` 记录为 #13，并把本次 `0.0.3` 写为 #14。设置中心没有版本/更新源控制项，本次未新增或改动设置。
- 更新、安装器和工作区恢复回归合计 44 项通过；CLI workspace 用例使用仓库注册加载器 6/6 通过。更新清单校验和 `git diff --check` 通过。构建后的 `app.asar` 已核实包含 `0.0.3` 产品版本、更新错误脱敏逻辑和工作台提示 Broker。
- `pnpm --filter lfaa-desktop-electron run package:win` 在合并远端 `main` 的 3 个提交后重新通过；Vite 隔离构建 2226 个模块，既有大分块警告仍在。生成 `dist/apps/desktop-electron/LFAA-0.0.3.exe`，大小 158463589 字节，SHA-256 `01D6F89C108F2D11D60E7A4AA3E263826E2FF6069445765FE37F2674C3953F77`；`latest.yml` 中版本、文件名、大小及 SHA-512 均与安装包匹配；随包 CUA Driver 导入与工具注册通过。Windows Authenticode 状态为 `NotSigned`。
- 构建期间 `pnpm install` 按已清理空白符的 `app-builder-lib@26.15.3` 补丁更新了 `pnpm-lock.yaml` 的补丁哈希，变更仅对应此次补丁文件，已纳入本次发布提交。`http://127.0.0.1:3000/api/health` 构建后返回 HTTP 200，未重启当前服务，也未覆盖 `dist/apps/web`。
- 本地验收完成，尚未推送 GitHub `main`、创建 Release 或实际安装/启动候选；发布执行结果将在完成后补记。未进行桌面更新弹窗目视及真实自动升级验收。

## LFAA-DESKTOP-UPDATE-EXPERIENCE-004：桌面更新入口与 LFAA 0.0.4 安装包

### 用户目标与运行入口

- 当前桌面更新能力由 Windows Electron 主进程 `apps/desktop-electron/src/main.mjs` 拥有；共享工作台通过受信任 preload/IPC 显示更新提示，设置中心“关于与更新”负责手动检查与用户可控偏好。
- 用户要求按截图为新版本增加顶部“更新”入口及发布说明卡片，并提供“跳过此版本 / 稍后 / 下载更新”选择；同意“以后自动下载并安装更新”后才可静默下载及在准备好时安装。
- 自动下载安装偏好只保存在当前 Electron 用户数据目录，默认关闭。宿主采用该设置前仍须验证签名格式/版本清单/真实 Release Feed；安装继续经现有本机服务优雅关闭流程，并向用户明确说明重启 LFAA 与停止本机托管服务的影响。
- “稍后”仅对当前进程内的当前版本生效；“跳过此版本”持久记住且只忽略选定版本，新版本仍可提示。自动下载不得覆盖已跳过/已暂缓决定。
- 本轮正式目标版本 `LFAA 0.0.4`；唯一版本日志 `docs/updata-log.md` 新增 #15，CLI/Web/Electron 元数据与 `update.json` 投影一致，最低支持版本保持既有配置。
- 交付 Windows x64 Electron NSIS 文件至根 `dist/apps/desktop-electron/LFAA-0.0.4.exe`。只构建和本地验收，不提交、不推送、不创建/改动远端 Release、不上传。

### 设置中心与数据/权限归属

- 设置中心“关于与更新”增加自动下载并安装开关和后果说明；Windows Electron UI 调用仅向当前受信任主窗口开放的 IPC。
- 设置属于此台 Electron 安装实例的设备偏好，不写入账户服务或跨设备同步。Owner 为 Electron 主进程本地 JSON 存储，路径从 `app.getPath("userData")` 派生；只接受白名单布尔值及有效单版本号，默认关闭，使用临时文件原子替换持久化。
- 外观沿用现有主题、字号、字体、对比度与减少动态效果映射；更新入口不播放系统通知音。

### 允许修改

- 当前 Electron 更新流程、更新 prompt broker、受信任 IPC/preload、本地更新偏好 Owner 及直接相关长期回归。
- 共用 Client Connection 更新类型、Workbench 顶部状态/说明卡片和当前桌面更新 Modal、SettingsPage“关于与更新”。
- `apps/desktop-electron`、`apps/web`、`apps/cli` 产品版本元数据；由 `docs/updata-log.md` 投影生成的 `update.json` 与直接相关生成/校验回归；桌面构建输出仅写根 `dist/`。
- 本合同、`docs/updata-log.md` 和描述桌面更新 Owner/行为的架构事实。

### 禁止修改

- 不变更官方更新源、Electron Release feed/签名校验、发布通道、检查频率、强制更新、最低支持版本或 404 脱敏边界。
- 不改变 Web、Tauri、Android 的更新行为；不写入账户设置 API；默认关闭自动下载/安装，不绕过用户选择、可信 renderer 校验、版本校验或本机服务优雅退出。
- 不重启或停止当前 Web、Control Plane、Daemon、Minecraft 或桌面服务；不得让打包过程覆盖正在被 3000 端口服务使用的 `dist/apps/web`。
- 不访问或修改远端 GitHub Release/Tag，不提交、推送、上传或发布，不清理既有版本安装包。

### 验收条件

- Electron 定向回归验证偏好默认关闭/保存/重载/拒绝非法输入、跳过版本持久化、稍后仅进程内抑制、更新入口数据事件、自动下载安装决策及下载/安装确认 Broker；检查无设置时不会自动下载/安装。
- 相关 Client 类型检查、设置 UI 与 Workbench 包构建、更新清单校验、版本投影与 `git diff --check` 通过。
- Windows x64 Electron `package:win` 通过；核对安装程序路径/文件名/0.0.4 版本、`latest.yml` 文件名/大小/hash 与 exe 匹配、包内 Web 版本和更新 Owner 文件。构建前后记录 3000 服务健康及现有 `dist/apps/web` 指纹。
- 明确区分源码/自动化/包内核对与真实更新服务器、真实弹窗视觉、下载升级和安装首次启动；未实测项如实报告。不得用已构建表述远端 Release 已可用。

### 实施与本地验收记录

- Electron 主进程保持唯一更新 Owner；`update-preferences.json` 位于 app userData，默认关闭自动下载安装并只记录一个被跳过的 SemVer。IPC 只对白名单布尔设置开放且校验当前主窗口主 frame；“稍后”继续使用本进程内 deferred 状态。新版本经清单和 Release feed 匹配后才推送给顶部更新入口，下载和自动安装仍使用现有 updater 与优雅关闭本机服务流程。
- 设置中心“关于与更新”新增设备级开关并说明重启 LFAA/关闭本机服务的影响；不写账户设置。Workbench 复用主题/字体/色彩 token，订阅器在卸载时撤销，初始偏好/更新可用状态各读取一次；没有新增轮询、定时器或通知声音。
- Electron 更新清单、Flow、Prompt Broker 和新偏好 Store 定向回归 32/32；主进程、preload、更新流程和偏好 Store Node 语法检查、JSON 清单校验、`git diff --check` 通过。`pnpm --filter lfaa-web run build:desktop-candidate` 的 `tsc --noEmit -p tsconfig.client.json` 与 Vite 构建通过，转换 2226 个模块；存在既有超过 500 kB 的 chunk 警告。
- `pnpm --filter lfaa-desktop-electron run package:win` 通过；Electron Builder 生成 NSIS x64 包并通过随包 CUA Driver 导入/工具注册核验。`app.asar` 中 package 版本为 `0.0.4`，包含更新主进程、preload、Flow、偏好 Store；随包 Web JS/CSS 可检索到“跳过此版本”“以后自动下载并安装更新”及顶部入口/卡片样式。
- 安装器为 `dist/apps/desktop-electron/LFAA-0.0.4.exe`，大小 158466057 字节，SHA-256 `0251609B6992EB722C898DDEE74AE4638C48FC9933E5325712B51073DE455D22`；`latest.yml` 版本、文件名、大小及 SHA-512 与 exe 匹配；Authenticode 为 `NotSigned`。用户交付目录 `dist/apps/desktop-electron/LFAA-0.0.4/` 含 exe、blockmap 和 `latest.yml`。
- 构建前后 `http://127.0.0.1:3000/api/health` 均返回 HTTP 200；`dist/apps/web/index.html` SHA-256 保持 `A0868D7DAD49FE42809CB9A1FE7CC66D1FEAAA5273CBD9A9E445EFF7250DA28B`，`build-state.json` 保持 `B6F64C725D0C3EDD77BEF16B605AB79205B53CEBA4CD52743A16DB3613B6D81B`，未重启活动服务或改写正式 Web 目录。`workspace-preflight` 脚本不存在；未运行不存在的 Gate。
- 未安装或启动候选包，未进行 Electron 实际弹窗视觉、真实更新服务器下载或版本升级验收；当前真实运行账户/服务环境不适合直接执行隔离安装。没有提交、推送、Tag、修改 GitHub Release 或上传资产。浏览器交互帧时间未测。

## LFAA-DESKTOP-ELECTRON-BUILD-MENU-01：菜单 3 与版本递增 Electron Windows 构建

### 用户目标与运行入口

- 用户在 `lfaa.bat` 菜单选择 `3` 时构建 Windows Electron x64 NSIS 安装包；等价命令为 `pnpm run build:win`，产物位于根目录 `dist/apps/desktop-electron/`。
- 当前正式产品版本为 `0.0.4`；本轮发现 `dist/apps/desktop-electron/LFAA-0.0.4.exe` 和 `latest.yml` 已匹配存在，已据实登记为已生成。下一次新包目标为 `0.0.5`，构建入口需要求填写新版本更新说明。
- 版本权威是 `docs/updata-log.md`；`apps/cli/package.json`、`apps/web/package.json`、`apps/desktop-electron/package.json` 与 `update.json` 是该版本的产品元数据投影。
- Windows Electron 桌面构建依赖 Control Plane、Windows Sandbox Host 与包内隔离 Web 候选；不要构建覆盖正在运行 Web 服务使用的 `dist/apps/web`。

### Owner、设置与边界

- 根 `scripts/install-dependencies.ps1` 拥有交互菜单；根 `package.json` 拥有统一 `build:win` 入口；Electron 包负责 Windows 安装器封装和 `latest.yml`。
- 版本构建协调脚本根据更新日志中的“Windows Electron 包状态”决定使用现存待构建版本或开始下一修订版，要求用户填写新版本更新说明，并同步唯一版本日志、三个产品包版本、更新清单。
- 安装器文件和构建缓存只能写入根 `dist/apps/desktop-electron/`、`dist/.tmp/desktop-electron/` 及各自身拥有的根 `dist/apps` 子目录。
- 不新增设置中心配置；不更改更新渠道、最低支持版本、签名、Daemon 权限和生命周期。

### 允许修改

- `scripts/install-dependencies.ps1`、根 `package.json`：将菜单 `3` 与 `pnpm run build:win` 接至同一 Electron Windows 构建入口。
- 根 `scripts/`：新增版本校验/递增和桌面发行构建协调脚本。
- `apps/desktop-electron/package.json`：保留 Windows x64 NSIS 构建步骤，拆分面向用户的统一入口与内部已准备版本的封装步骤。
- `apps/desktop-electron/tests/`：为待构建版本复用、已生成后版本递增、元数据一致性与安装器完成记账增加长期回归，并更新测试脚本入口。
- `开发规范.md`、`.agents/skills/lfaa-patch-release/SKILL.md`、`docs/系统总体架构.md`、`docs/updata-log.md` 与本合同。
- `packages/client/ui-settings/src/SettingsPage.tsx`：把开发者面板中的旧硬编码版本替换为现有构建/桌面运行时版本 Owner。

### 禁止修改

- 本轮不构建、不安装、不启动安装器、不覆盖 `dist/apps/desktop-electron/` 中既有候选，不重启端口 3000 服务或桌面进程。
- 不改变普通 `pnpm run build` 的 Harness 运行树职责；Electron 安装器仅由 `pnpm run build:win`、菜单 `3` 或其等价 Windows Electron 入口生成。
- 不推送 GitHub、创建 Tag/Release、上传安装包、签名或提交 Git；不清理旧构建产物与用户数据。
- 若桌面构建前置失败且尚未生成 Electron 安装器，保留当前待构建版本供重试；一旦 `electron-builder` 生成与 `latest.yml` 匹配的安装器，该版本即记为已使用，后续不得重用。若安装器先生成、完成记账尚未执行，下一次运行入口会按文件和清单版本自动补记。

### 验收条件

- 根菜单显示 `3` 为 Windows Electron 安装包构建并给出产物路径；选择 `3` 实际调用统一 `build:win` 命令；根脚本可通过 `pnpm run build:win` 触发相同流程。
- 当前 `0.0.4` 安装器文件与 `latest.yml` 已存在；完成记账后下次构建应产生 `0.0.5`、连续更新日志编号和必填的本次更新说明，并同步 CLI/Web/Electron 版本及 `update.json`。
- 构建失败时能够区分尚未生成安装器的可重试状态与已经生成、版本已消耗的状态；修订号不回退、不重复。
- 定向回归覆盖版本解析/递增、初次待构建版本、版本已消耗后的升级、更新清单同步、失败前置条件不误记完成；根/包清单与 PowerShell AST 校验和 `git diff --check` 通过。
- 设置中心无新增或修改项。实际 Electron 打包、安装器目视、签名、发布与用户升级均由用户后续执行，本轮不得声称已验收。

### 实施与本地验收记录

- 根菜单 `3` 已改为调用 `pnpm run build:win`；该入口先读取唯一更新日志状态，再依次构建 Control Plane、Windows Sandbox Host 和隔离的 Web 候选，不触碰正式 `dist/apps/web/`。Electron 包提供转发入口与内部 `package:win:prepared`，成功生成后通过安装器与 `latest.yml` 匹配校验登记完成。
- 当前 `dist/apps/desktop-electron/LFAA-0.0.4.exe` 存在，`latest.yml` 的 `version` 与 `path` 均为 `0.0.4` / `LFAA-0.0.4.exe`；执行 `node scripts/desktop-package-version.mjs complete` 成功将 #15 状态标为已生成。没有重新构建、安装或启动安装器。
- 新增 5 项版本构建回归，覆盖沿用待构建版本、匹配产物记账、下一包同步递增、进程中断后补记，以及元数据不一致时拒绝写入。完整 Electron 更新/版本回归通过 37/37。
- 开发者页项目版本改为读取现有 `lfaaProjectBuildInfo`，不再硬编码旧版本；`lfaa-client-ui-settings` 包构建通过。构建入口与版本文件不增加设置中心配置；Node 语法、三份 JSON、更新清单校验、PowerShell AST、工作树与当前代码差异空白检查均通过。未运行 Electron 打包，安装器后续由用户执行。

## LFAA-GIT-PUSH-CREDENTIAL-PATH-GUARD-01：正常推送历史路径误报

### 用户目标与运行入口

- 用户选择工作台菜单 6“正常推送 GitHub main”并确认推送；脚本在 Git 历史路径检查中将 `packages/credentials` 拦截，导致远端 `main/update.json` 仍为 `0.0.3`，桌面 `0.0.3` 客户端无法发现已发布的 `0.0.4`。
- 运行入口为根目录 `scripts/install-dependencies.ps1` 的正常 GitHub 推送流程；目标 Owner 为该脚本的历史路径/敏感内容扫描与 Git push 编排。
- `packages/credentials` 是受版本控制的第一方源码包。Git 历史枚举会返回目录树对象路径 `packages/credentials`（无末尾斜杠）以及包内文件路径；白名单边界必须覆盖两种形态。

### 设置、数据/权限 Owner 与验收条件

- 不涉及设置中心配置。只读取 Git 索引、对象路径、文件大小及历史敏感内容，不读写产品运行数据。
- 仅允许精确的第一方根包 `packages/credentials` 及其后代路径通过通用 `credentials` 目录名规则；其他运行数据、依赖、秘密目录、敏感扩展名、凭据文件名、历史大对象和内容级凭据扫描继续执行。
- 用 PowerShell AST 加载并运行真实 `Get-BlockedGitPaths` 函数的 Pester 回归，覆盖第一方目录树/文件允许及其他凭据目录/敏感扩展名拒绝；通过 PowerShell 解析及 `git diff --check`。
- 用户已在菜单 6 中确认正常推送。本轮只允许正常 fast-forward 推送到 `origin` 的 `main`；任何路径、体积或高风险秘密扫描阻断以及远端非快进均停止，不绕过扫描、不强推、不改写历史。

### 允许修改

- `scripts/install-dependencies.ps1` 中 `Get-BlockedGitPaths` 对第一方源码包的边界匹配。
- `scripts/tests/install-dependencies-path-guard.Tests.ps1` 对真实 PowerShell 函数的直接回归。
- 本合同及其实施验收记录。

### 禁止修改

- 不放宽历史凭据内容模式、运行数据/依赖/密钥/大文件规则；不跳过任何安全 Gate。
- 不强制推送，不重置、变基或改写已有提交；不改变 origin URL 或推送目标。
- 不触碰 `packages/credentials` 内的源码或运行数据，不改其他产品行为。

### 实施与验收记录

- `Get-BlockedGitPaths` 的第一方源码例外现在匹配 `packages/credentials` 本身及其后代路径。其他凭据目录仍被拒绝；位于包内的 `.pem` 和 `credentials.json` 仍被拒绝。
- `scripts/tests/install-dependencies-path-guard.Tests.ps1` 通过 Pester 3.4.0，2/2；`scripts/install-dependencies.ps1` PowerShell AST 解析通过，`git diff --cached --check` 通过。
- 对 HEAD 的 1628 条历史路径扫描、超过 25 MiB 对象扫描与高风险历史凭据扫描全部通过；存在 2 条现有通用凭据赋值启发式非阻断提醒。修复与回归两文件的 staged 路径/高风险凭据扫描通过。
- 按用户在菜单 6 中的确认，提交 `68716b1773349e2df3531932f9ebab9bd09a0968` 与其父提交 `3bb810c` 通过普通 fast-forward 推送至 `origin/main`，没有强推。推送后 GitHub `main/update.json` 返回 HTTP 200、版本 `0.0.4`；`releases/latest/download/latest.yml` 返回 HTTP 200、版本 `0.0.4`。未能在用户的桌面安装实例中实际点击“检查更新”复验。
- 不涉及设置中心配置。用户工作区中另外存在的 `docs/updata-log.md`、`update.json` 与 `开发规范.md` 变更未纳入修复提交；`docs/PROMPTS.md` 含其他并行版本构建合同变更，也未推送。
