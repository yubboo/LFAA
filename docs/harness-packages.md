# LFAA Harness 目录对标清单

<!-- 由 scripts/check-workspace.mjs --write 生成，不手工维护计数或路径。 -->

参考 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)，上游基线 commit `639ed015397290b3745d163aafe02ffee4aa3f84`。

当前 378 个两级目录、207 个实际 workspace 包（205 个产品源码/组合包，2 个工程/测试包），171 个占位目录。控制端/节点运行树含 179 个包；客户端源码包单独进入 Web 构建。

`implemented` 仅表示有 package.json 和源码/装配；不代表已经进入 Profile、通过运行验收或与 DSH 等价。`placeholder` 不可执行。产品能力现状见 [系统总体架构](系统总体架构.md)，历史核验见 [P0 记录](archive/audits/harness-p0-audit.md)。

每个目录单独标注职责，来源为 `scripts/package-responsibilities.mjs`，由 Gate 对实际包树逐项核对；占位行描述目标职责。源码入口、静态消费者和 Bundle 声明完整记录在同名 JSON 中，它们不冒充运行验收。

| 仓库相对目录 | 包名 | 状态 | 专属职责 | 源入口/证据边界 | 来源 |
|---|---|---|---|---|---|
| [packages/acp/acp](../packages/acp/acp) | — | placeholder | 外部 Agent Client Protocol 互操作合同与接入适配 | 占位不可执行 | DSH 同名目录 |
| [packages/api/account-controller](../packages/api/account-controller) | lfaa-api-account-controller | implemented | 账户认证、个人资料与身份 API，调用身份 Owner | [源码](../packages/api/account-controller/src/index.ts)；2 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/api/agent-git-controller](../packages/api/agent-git-controller) | lfaa-api-agent-git-controller | implemented | Agent 本机 Git 仓库登记、会话绑定与固定操作认证 API | [源码](../packages/api/agent-git-controller/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/api/ai-video-controller](../packages/api/ai-video-controller) | lfaa-api-ai-video-controller | implemented | 账户 AI 视频项目与生成任务的认证 API | [源码](../packages/api/ai-video-controller/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/api/browser-controller](../packages/api/browser-controller) | lfaa-api-browser-controller | implemented | 浏览器预览台与本机 Browser Owner 的认证 API 适配 | [源码](../packages/api/browser-controller/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/api/connectivity-controller](../packages/api/connectivity-controller) | lfaa-api-connectivity-controller | implemented | 联机目标、连接配置与节点网络操作 API | [源码](../packages/api/connectivity-controller/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/api/gateway](../packages/api/gateway) | lfaa-api-gateway | implemented | 共享认证 API Gateway 与 Controller 路由承载 | [源码](../packages/api/gateway/src/index.ts)；14 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/api/github-connection-controller](../packages/api/github-connection-controller) | lfaa-api-github-connection-controller | implemented | GitHub OAuth 授权状态和只读仓库资源的认证 API 适配 | [源码](../packages/api/github-connection-controller/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/api/job-controller](../packages/api/job-controller) | lfaa-api-job-controller | implemented | 节点任务查询、派发与取消的协议适配 | [源码](../packages/api/job-controller/src/index.ts)；1 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/api/knowledge-controller](../packages/api/knowledge-controller) | lfaa-api-knowledge-controller | implemented | 账户知识库和 Markdown 资料来源管理 API | [源码](../packages/api/knowledge-controller/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/api/local-model-controller](../packages/api/local-model-controller) | lfaa-api-local-model-controller | implemented | 认证 LFAA 本机模型目录、下载、进度、取消和卸载 API | [源码](../packages/api/local-model-controller/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/api/minecraft-controller](../packages/api/minecraft-controller) | lfaa-api-minecraft-controller | implemented | Minecraft 核心、实例、部署、配置和任务 API | [源码](../packages/api/minecraft-controller/src/index.ts)；1 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/api/plugin-controller](../packages/api/plugin-controller) | lfaa-api-plugin-controller | implemented | 插件清单、安装和生命周期管理 API | [源码](../packages/api/plugin-controller/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/api/remotes](../packages/api/remotes) | lfaa-api-remotes | implemented | 类型化远程调用的认证传输适配 | 仅组合/清单；未证实运行 | DSH 同名目录 |
| [packages/api/session-controller](../packages/api/session-controller) | lfaa-api-session-controller | implemented | 会话、消息、Agent Run、审批和流协议 API | [源码](../packages/api/session-controller/src/index.ts)；1 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/api/settings-controller](../packages/api/settings-controller) | lfaa-api-settings-controller | implemented | 设置读取、验证和保存的认证 API | [源码](../packages/api/settings-controller/src/index.ts)；1 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/api/steamcmd-controller](../packages/api/steamcmd-controller) | lfaa-api-steamcmd-controller | implemented | SteamCMD 节点工具安装与校验 API | [源码](../packages/api/steamcmd-controller/src/index.ts)；1 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/api/terminal-controller](../packages/api/terminal-controller) | lfaa-api-terminal-controller | implemented | 目标节点交互终端认证中继与事件通道 | [源码](../packages/api/terminal-controller/src/index.ts)；1 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/api/workflow-controller](../packages/api/workflow-controller) | lfaa-api-workflow-controller | implemented | 账户工作流目录、定义与运行状态 API | [源码](../packages/api/workflow-controller/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/api/workspace-controller](../packages/api/workspace-controller) | lfaa-api-workspace-controller | implemented | 账户项目、受管 Worktree 与文件操作 API | [源码](../packages/api/workspace-controller/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/api/workspace-files](../packages/api/workspace-files) | lfaa-api-workspace-files | implemented | Workspace 文件协议与请求适配 | [源码](../packages/api/workspace-files/src/index.ts)；1 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/api/writing-controller](../packages/api/writing-controller) | lfaa-api-writing-controller | implemented | 账户作品、章节、资料、提案与导入导出 API | [源码](../packages/api/writing-controller/src/index.ts)；1 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/attachment/attachment](../packages/attachment/attachment) | — | placeholder | 附件描述、引用及模型输入装配合同 | 占位不可执行 | DSH 同名目录 |
| [packages/attachment/attachment-local](../packages/attachment/attachment-local) | — | placeholder | 本机附件来源读取和资源适配 | 占位不可执行 | DSH 同名目录 |
| [packages/boot/app-boot](../packages/boot/app-boot) | lfaa-app-boot | implemented | Cordis 启动、Profile 装配、配置和共享生命周期 | [源码](../packages/boot/app-boot/src/index.ts)；22 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/boot/capability-installs](../packages/boot/capability-installs) | lfaa-capability-installs | implemented | 通用能力安装计划、来源检查和结果回读协调 | [源码](../packages/boot/capability-installs/src/index.ts)；5 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/boot/capability-mcp](../packages/boot/capability-mcp) | lfaa-capability-mcp | implemented | MCP 安装来源与配置 Owner 的适配 | [源码](../packages/boot/capability-mcp/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/boot/capability-prompt](../packages/boot/capability-prompt) | lfaa-capability-prompt | implemented | 外部 Prompt 安装、固定版本/摘要检查及账户设置适配 | [源码](../packages/boot/capability-prompt/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/boot/capability-skill](../packages/boot/capability-skill) | lfaa-capability-skill | implemented | 项目 Skill 来源核验、Daemon 原子安装与发现回读 | [源码](../packages/boot/capability-skill/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/boot/cmdline](../packages/boot/cmdline) | — | placeholder | 命令行参数解析和启动选择适配 | 占位不可执行 | DSH 同名目录 |
| [packages/boot/config-editor](../packages/boot/config-editor) | — | placeholder | Profile/启动配置编辑适配 | 占位不可执行 | DSH 同名目录 |
| [packages/boot/hmr](../packages/boot/hmr) | lfaa-hmr | implemented | 开发插件与源码热重载生命周期 | [源码](../packages/boot/hmr/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/boot/knowledge-library](../packages/boot/knowledge-library) | lfaa-knowledge-library-runtime | implemented | 知识资料目录和按需读取的工具装配适配 | [源码](../packages/boot/knowledge-library/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/boot/plugin-manager](../packages/boot/plugin-manager) | lfaa-plugin-manager | implemented | 第三方插件来源核验、安装、装载、资源和回滚管理 | [源码](../packages/boot/plugin-manager/src/index.ts)；3 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/browser-use/browser-use](../packages/browser-use/browser-use) | lfaa-browser-use | implemented | 浏览器观察和操作的驱动服务合同 | [源码](../packages/browser-use/browser-use/src/index.ts)；1 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/bundle/acp-app](../packages/bundle/acp-app) | — | placeholder | ACP 应用的能力组合补丁 | 占位不可执行 | DSH 同名目录 |
| [packages/bundle/base](../packages/bundle/base) | lfaa-base | implemented | 共享 Control Plane 基础能力的有序组合 | [源码](../packages/bundle/base/src/index.ts)；0 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/bundle/daemon-app](../packages/bundle/daemon-app) | lfaa-daemon-app | implemented | 目标节点身份、执行与任务领取的组合 | 仅组合/清单；未证实运行 | LFAA 扩展 |
| [packages/bundle/desktop-computer-use](../packages/bundle/desktop-computer-use) | lfaa-desktop-computer-use | implemented | 桌面/本机 Web 电脑操控能力组合 | 仅组合/清单；未证实运行 | LFAA 扩展 |
| [packages/bundle/headless](../packages/bundle/headless) | — | placeholder | 无 UI 运行入口的可选能力组合 | 占位不可执行 | DSH 同名目录 |
| [packages/bundle/sdk-app](../packages/bundle/sdk-app) | — | placeholder | SDK 服务应用的能力组合 | 占位不可执行 | DSH 同名目录 |
| [packages/bundle/sdk-minimal](../packages/bundle/sdk-minimal) | — | placeholder | SDK 最小运行能力组合 | 占位不可执行 | DSH 同名目录 |
| [packages/bundle/web-app](../packages/bundle/web-app) | lfaa-web-app | implemented | Web Host、认证 API 与客户端资源组合 | [源码](../packages/bundle/web-app/src/index.ts)；0 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/client/connection](../packages/client/connection) | lfaa-client-connection | implemented | 认证 REST/Remote、Socket/SSE、响应合同和客户端请求协调 | 仅组合/清单；未证实运行 | DSH 同名目录 |
| [packages/client/file-upload](../packages/client/file-upload) | — | placeholder | 客户端文件上传协议与进度交互 | 占位不可执行 | DSH 同名目录 |
| [packages/client/hmr](../packages/client/hmr) | — | placeholder | 客户端模块开发热更新 | 占位不可执行 | DSH 同名目录 |
| [packages/client/locale](../packages/client/locale) | — | placeholder | 客户端语言资源与语言设置映射 | 占位不可执行 | DSH 同名目录 |
| [packages/client/modules](../packages/client/modules) | lfaa-client-modules | implemented | 客户端模块/Slots 的懒加载、装卸与作用域 | [源码](../packages/client/modules/src/index.ts)；17 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/client/product-analytics](../packages/client/product-analytics) | — | placeholder | 客户端产品指标上报适配与隐私边界 | 占位不可执行 | DSH 同名目录 |
| [packages/client/resources](../packages/client/resources) | lfaa-client-resources | implemented | 客户端共享资源读取、缓存与撤销 | 仅组合/清单；未证实运行 | DSH 同名目录 |
| [packages/client/shortcuts](../packages/client/shortcuts) | — | placeholder | 客户端快捷键服务和登记协议 | 占位不可执行 | DSH 同名目录 |
| [packages/client/store](../packages/client/store) | lfaa-client-store | implemented | 客户端账户、路由及偏好投影状态 | 仅组合/清单；未证实运行 | DSH 同名目录 |
| [packages/client/ui-agent-preset](../packages/client/ui-agent-preset) | — | placeholder | Agent 预设的选择与展示界面 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-approval](../packages/client/ui-approval) | — | placeholder | 审批请求和真实决定的界面 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-attachment](../packages/client/ui-attachment) | — | placeholder | 附件选择、预览与状态界面 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-brand-official](../packages/client/ui-brand-official) | — | placeholder | 产品品牌视觉组件 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-chat](../packages/client/ui-chat) | lfaa-client-ui-chat | implemented | AI Work 输入、消息、公开轨迹、提问和结果界面 | [源码](../packages/client/ui-chat/src/index.ts)；3 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/client/ui-commands](../packages/client/ui-commands) | lfaa-client-ui-commands | implemented | 键盘命令匹配和交互派发 | [源码](../packages/client/ui-commands/src/index.ts)；2 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/client/ui-connectivity](../packages/client/ui-connectivity) | lfaa-client-ui-connectivity | implemented | 联机 App 工作台和网络任务界面 | [源码](../packages/client/ui-connectivity/src/index.ts)；2 个静态消费者；0 个组合声明 | LFAA 扩展 |
| [packages/client/ui-conversation](../packages/client/ui-conversation) | — | placeholder | 会话对话容器与消息交互组件 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-deliverables](../packages/client/ui-deliverables) | — | placeholder | 真实交付物与产物展示界面 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-directory-picker-browse](../packages/client/ui-directory-picker-browse) | — | placeholder | 通过服务浏览目录的选择界面 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-directory-picker-native](../packages/client/ui-directory-picker-native) | — | placeholder | 平台原生目录选择的客户端适配 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-dockkit](../packages/client/ui-dockkit) | lfaa-client-ui-dockkit | implemented | 共享容器尺寸、Dock/Overlay、拖拽和面板布局 | [源码](../packages/client/ui-dockkit/src/index.ts)；5 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/client/ui-goal](../packages/client/ui-goal) | — | placeholder | 目标状态和操作展示 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-input-trigger](../packages/client/ui-input-trigger) | — | placeholder | 输入触发器与快捷交互组件 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-jobs](../packages/client/ui-jobs) | — | placeholder | 后台任务及节点真实进度展示 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-layout](../packages/client/ui-layout) | lfaa-client-ui-layout | implemented | 全局导航、工作台布局和共享设置映射 | [源码](../packages/client/ui-layout/src/index.ts)；2 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/client/ui-message-feedback](../packages/client/ui-message-feedback) | — | placeholder | 消息反馈交互组件 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-minecraft](../packages/client/ui-minecraft) | lfaa-client-ui-minecraft | implemented | Minecraft 领域界面与真实状态展示 | [源码](../packages/client/ui-minecraft/src/index.ts)；2 个静态消费者；0 个组合声明 | LFAA 扩展 |
| [packages/client/ui-model-selection](../packages/client/ui-model-selection) | — | placeholder | 模型目录选择和能力参数展示 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-open-in-app](../packages/client/ui-open-in-app) | — | placeholder | 平台应用打开动作的客户端入口 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-permission-presets](../packages/client/ui-permission-presets) | — | placeholder | 权限预设选择界面，不实现授权策略 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-plan](../packages/client/ui-plan) | — | placeholder | 计划模式和计划结果展示 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-plugin-manager](../packages/client/ui-plugin-manager) | lfaa-client-ui-plugin-manager | implemented | 插件安装、停用和故障管理界面 | [源码](../packages/client/ui-plugin-manager/src/index.ts)；2 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/client/ui-primitives](../packages/client/ui-primitives) | lfaa-client-ui-primitives | implemented | 跨应用可复用的基础交互组件 | [源码](../packages/client/ui-primitives/src/index.ts)；11 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/client/ui-reference](../packages/client/ui-reference) | — | placeholder | 上下文引用与来源展示 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-renderer](../packages/client/ui-renderer) | lfaa-client-ui-renderer | implemented | React 根挂载、账户路由和 Slots 容器 | [源码](../packages/client/ui-renderer/src/index.ts)；1 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/client/ui-schedule](../packages/client/ui-schedule) | — | placeholder | 定时任务配置与实际状态界面 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-session](../packages/client/ui-session) | — | placeholder | 会话选择、恢复和生命周期交互 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-settings](../packages/client/ui-settings) | lfaa-client-ui-settings | implemented | 设置中心页面组合与共享控件 | [源码](../packages/client/ui-settings/src/index.ts)；3 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/client/ui-settings-account](../packages/client/ui-settings-account) | lfaa-client-ui-settings-account | implemented | 账户及 Provider 凭据配置界面 | [源码](../packages/client/ui-settings-account/src/index.ts)；4 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/client/ui-settings-agent-loop](../packages/client/ui-settings-agent-loop) | — | placeholder | Agent 循环预算设置界面 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-settings-general](../packages/client/ui-settings-general) | lfaa-client-ui-settings-general | implemented | 通用偏好、任务目录和交互设置界面 | [源码](../packages/client/ui-settings-general/src/index.ts)；4 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/client/ui-settings-models](../packages/client/ui-settings-models) | lfaa-client-ui-settings-models | implemented | 模型/思考档位的共享选项和设置映射 | 仅组合/清单；未证实运行 | DSH 同名目录 |
| [packages/client/ui-settings-plugin-inventory](../packages/client/ui-settings-plugin-inventory) | — | placeholder | 已登记插件清单设置界面 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-settings-plugins](../packages/client/ui-settings-plugins) | — | placeholder | 插件及扩展来源设置界面 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-settings-session-log](../packages/client/ui-settings-session-log) | — | placeholder | 会话记录设置界面 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-settings-shell](../packages/client/ui-settings-shell) | — | placeholder | Shell 运行偏好设置界面 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-settings-subagent](../packages/client/ui-settings-subagent) | — | placeholder | 子 Agent 模型、数量和委派设置界面 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-settings-web-search](../packages/client/ui-settings-web-search) | — | placeholder | 网页搜索 Provider 设置界面 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-shortcuts](../packages/client/ui-shortcuts) | lfaa-client-ui-shortcuts | implemented | 账户快捷键配置控件 | 仅组合/清单；未证实运行 | DSH 同名目录 |
| [packages/client/ui-sidebar](../packages/client/ui-sidebar) | lfaa-client-ui-sidebar | implemented | 共享侧栏及导航树组件 | [源码](../packages/client/ui-sidebar/src/index.ts)；6 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/client/ui-sidebar-browser](../packages/client/ui-sidebar-browser) | lfaa-client-ui-sidebar-browser | implemented | 浏览器侧栏内容展示 | [源码](../packages/client/ui-sidebar-browser/src/index.ts)；2 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/client/ui-sidebar-documentpreview](../packages/client/ui-sidebar-documentpreview) | — | placeholder | 文档预览侧栏展示 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-sidebar-files](../packages/client/ui-sidebar-files) | lfaa-client-ui-sidebar-files | implemented | 统一文件列表、预览、编辑与回收站界面 | [源码](../packages/client/ui-sidebar-files/src/index.ts)；2 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/client/ui-sidebar-right](../packages/client/ui-sidebar-right) | — | placeholder | 共享右侧上下文栏展示 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-sidebar-terminal](../packages/client/ui-sidebar-terminal) | — | placeholder | 终端侧栏展示和会话交互 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-skill](../packages/client/ui-skill) | — | placeholder | Skill 摘要和加载状态界面 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-slots](../packages/client/ui-slots) | — | placeholder | 插件 UI 插槽渲染协议和容器 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-subagent](../packages/client/ui-subagent) | — | placeholder | 子 Agent 委派任务与结果展示 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-theme](../packages/client/ui-theme) | lfaa-client-ui-theme | implemented | 共享主题、外观令牌、基础及响应式样式 | 仅组合/清单；未证实运行 | DSH 同名目录 |
| [packages/client/ui-tool](../packages/client/ui-tool) | — | placeholder | 工具调用合同与真实状态展示 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-trajectory](../packages/client/ui-trajectory) | — | placeholder | 公开执行轨迹展示，不暴露隐藏推理 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-user-questions](../packages/client/ui-user-questions) | — | placeholder | 用户澄清问题与答案交互 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-workflow](../packages/client/ui-workflow) | lfaa-client-ui-workflow | implemented | 工作流定义和画布界面 | [源码](../packages/client/ui-workflow/src/index.tsx)；1 个静态消费者；0 个组合声明 | LFAA 扩展 |
| [packages/client/ui-workflow-run](../packages/client/ui-workflow-run) | — | placeholder | 工作流运行状态与节点结果界面 | 占位不可执行 | DSH 同名目录 |
| [packages/client/ui-workspace](../packages/client/ui-workspace) | lfaa-client-ui-workspace | implemented | App 工作区、项目、Git 审阅与共享任务界面 | [源码](../packages/client/ui-workspace/src/index.ts)；2 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/client/ui-writing](../packages/client/ui-writing) | lfaa-client-ui-writing | implemented | 写作作品、章节、资料和提案界面 | [源码](../packages/client/ui-writing/src/index.ts)；2 个静态消费者；0 个组合声明 | LFAA 扩展 |
| [packages/client/web](../packages/client/web) | lfaa-client-web | implemented | 共享浏览器应用启动入口与样式装配 | [源码](../packages/client/web/src/index.ts)；1 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/compaction/command-compact](../packages/compaction/command-compact) | lfaa-command-compact | implemented | 显式压缩命令适配 | [源码](../packages/compaction/command-compact/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/compaction/compaction](../packages/compaction/compaction) | lfaa-compaction | implemented | 上下文压缩服务及引擎合同 | [源码](../packages/compaction/compaction/src/index.ts)；2 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/compaction/compaction-basic](../packages/compaction/compaction-basic) | lfaa-compaction-basic | implemented | 基础有界摘要压缩引擎 | [源码](../packages/compaction/compaction-basic/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/compaction/compaction-image-offload](../packages/compaction/compaction-image-offload) | lfaa-compaction-image-offload | implemented | 上下文图像留存/卸载的压缩策略 | [源码](../packages/compaction/compaction-image-offload/src/index.ts)；0 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/compaction/compaction-tool-result-pruner](../packages/compaction/compaction-tool-result-pruner) | lfaa-compaction-tool-result-pruner | implemented | 工具结果剪裁策略，不改权威事件 | [源码](../packages/compaction/compaction-tool-result-pruner/src/index.ts)；0 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/computer-use/computer-use](../packages/computer-use/computer-use) | lfaa-computer-use | implemented | 本机桌面观察、输入、应用发现和真实启动适配 | [源码](../packages/computer-use/computer-use/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/context/agent-instructions](../packages/context/agent-instructions) | — | placeholder | Agent 工程指令发现与上下文引用 | 占位不可执行 | DSH 同名目录 |
| [packages/context/file-reference](../packages/context/file-reference) | — | placeholder | 文件引用合同及解析 | 占位不可执行 | DSH 同名目录 |
| [packages/context/file-reference-local](../packages/context/file-reference-local) | — | placeholder | 本机文件引用来源适配 | 占位不可执行 | DSH 同名目录 |
| [packages/context/session-reference](../packages/context/session-reference) | — | placeholder | 既有会话引用与上下文适配 | 占位不可执行 | DSH 同名目录 |
| [packages/context/time-context](../packages/context/time-context) | — | placeholder | 时间和时区上下文提供 | 占位不可执行 | DSH 同名目录 |
| [packages/context/tmux-context](../packages/context/tmux-context) | — | placeholder | tmux 会话上下文来源适配 | 占位不可执行 | DSH 同名目录 |
| [packages/core/agent](../packages/core/agent) | lfaa-agent | implemented | AI 扩展元数据与按需指令登记，Agent 类型/投影合同 | [源码](../packages/core/agent/src/index.ts)；3 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/core/agent-default-model](../packages/core/agent-default-model) | lfaa-agent-default-model | implemented | 当前账户及子 Agent 模型解析 | [源码](../packages/core/agent-default-model/src/index.ts)；1 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/core/agent-loop](../packages/core/agent-loop) | lfaa-agent-loop | implemented | 模型回合、按需能力选择、授权往返、执行结果与停止协调 | [源码](../packages/core/agent-loop/src/index.ts)；5 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/core/agent-tool-presentation](../packages/core/agent-tool-presentation) | lfaa-agent-tool-presentation | implemented | 注册工具到模型函数协议的单一映射 | [源码](../packages/core/agent-tool-presentation/src/index.ts)；2 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/core/conversation-memory](../packages/core/conversation-memory) | lfaa-conversation-memory | implemented | 账户对话记忆提取、校验和持久化协调 | [源码](../packages/core/conversation-memory/src/index.ts)；2 个静态消费者；0 个组合声明 | LFAA 扩展 |
| [packages/core/scope](../packages/core/scope) | lfaa-scope | implemented | 能力可见范围与 Cordis 作用域合同 | [源码](../packages/core/scope/src/index.ts)；4 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/core/session](../packages/core/session) | lfaa-session | implemented | 账户会话事务、事件与 JSONL 恢复门面 | [源码](../packages/core/session/src/index.ts)；11 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/core/system-prompt](../packages/core/system-prompt) | lfaa-system-prompt | implemented | 核心指令/权限/上下文组合，不按 App 注入领域全文 | [源码](../packages/core/system-prompt/src/index.ts)；3 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/core/tools](../packages/core/tools) | lfaa-tools | implemented | 公共工具合同、参数校验、可撤销注册与 Run 工具发现 | [源码](../packages/core/tools/src/index.ts)；28 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/credentials/authorization](../packages/credentials/authorization) | lfaa-authorization | implemented | 凭据访问授权合同 | 仅组合/清单；未证实运行 | DSH 同名目录 |
| [packages/credentials/credential-flows](../packages/credentials/credential-flows) | lfaa-credential-flows | implemented | 凭据获取/连接流程适配 | [源码](../packages/credentials/credential-flows/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/credentials/credentials](../packages/credentials/credentials) | lfaa-credentials | implemented | 受保护秘密存储与访问服务 | [源码](../packages/credentials/credentials/src/index.ts)；7 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/credentials/credentials-local](../packages/credentials/credentials-local) | — | placeholder | 本机凭据存储提供方 | 占位不可执行 | DSH 同名目录 |
| [packages/credentials/deepseek-account](../packages/credentials/deepseek-account) | — | placeholder | DeepSeek 账户认证来源适配 | 占位不可执行 | DSH 同名目录 |
| [packages/credentials/deepseek-account-platform](../packages/credentials/deepseek-account-platform) | — | placeholder | DeepSeek 平台账户凭据适配 | 占位不可执行 | DSH 同名目录 |
| [packages/deliverables/tool-present](../packages/deliverables/tool-present) | — | placeholder | 交付物呈现工具协议 | 占位不可执行 | DSH 同名目录 |
| [packages/deliverables/workspace-changes](../packages/deliverables/workspace-changes) | — | placeholder | 工作区真实修改及产物引用收集 | 占位不可执行 | DSH 同名目录 |
| [packages/document/office-to-pdf](../packages/document/office-to-pdf) | — | placeholder | Office 文档到 PDF 的真实转换适配 | 占位不可执行 | DSH 同名目录 |
| [packages/document/tool-writing](../packages/document/tool-writing) | lfaa-tool-writing | implemented | 绑定当前账户作品的写作读取/提案工具合同 | [源码](../packages/document/tool-writing/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/document/writing](../packages/document/writing) | lfaa-document-writing | implemented | 作品、章节、资料、修订、提案事务与本机正文存储 | [源码](../packages/document/writing/src/index.ts)；3 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/experimental/agent-team](../packages/experimental/agent-team) | — | placeholder | 实验多 Agent 团队协作运行合同 | 占位不可执行 | DSH 同名目录 |
| [packages/experimental/agent-team-profile](../packages/experimental/agent-team-profile) | — | placeholder | 实验团队 Profile 配置 | 占位不可执行 | DSH 同名目录 |
| [packages/experimental/api-speech-to-text](../packages/experimental/api-speech-to-text) | — | placeholder | 实验语音转写 API 适配 | 占位不可执行 | DSH 同名目录 |
| [packages/experimental/auto-review](../packages/experimental/auto-review) | — | placeholder | 实验自动审查能力，不新增权限旁路 | 占位不可执行 | DSH 同名目录 |
| [packages/experimental/browser-use-chrome-devtools-mcp](../packages/experimental/browser-use-chrome-devtools-mcp) | — | placeholder | Chrome DevTools MCP 浏览器驱动适配 | 占位不可执行 | DSH 同名目录 |
| [packages/experimental/browser-use-playwright-mcp](../packages/experimental/browser-use-playwright-mcp) | — | placeholder | Playwright MCP 浏览器驱动适配 | 占位不可执行 | DSH 同名目录 |
| [packages/experimental/browser-use-runtime](../packages/experimental/browser-use-runtime) | — | placeholder | 实验浏览器驱动运行承载 | 占位不可执行 | DSH 同名目录 |
| [packages/experimental/browser-use-stagehand-native](../packages/experimental/browser-use-stagehand-native) | — | placeholder | Stagehand 原生浏览器驱动适配 | 占位不可执行 | DSH 同名目录 |
| [packages/experimental/client-ui-agent-team](../packages/experimental/client-ui-agent-team) | — | placeholder | 实验团队协作界面 | 占位不可执行 | DSH 同名目录 |
| [packages/experimental/client-ui-voice-input](../packages/experimental/client-ui-voice-input) | — | placeholder | 实验语音输入界面 | 占位不可执行 | DSH 同名目录 |
| [packages/experimental/computer-use-cua-driver-mcp](../packages/experimental/computer-use-cua-driver-mcp) | — | placeholder | CUA MCP 桌面驱动适配 | 占位不可执行 | DSH 同名目录 |
| [packages/experimental/computer-use-cua-driver-native](../packages/experimental/computer-use-cua-driver-native) | — | placeholder | CUA 原生桌面驱动适配 | 占位不可执行 | DSH 同名目录 |
| [packages/experimental/inspector](../packages/experimental/inspector) | — | placeholder | 实验运行时检查器 | 占位不可执行 | DSH 同名目录 |
| [packages/experimental/ptc-runtime-python](../packages/experimental/ptc-runtime-python) | — | placeholder | 实验 Python 隔离执行提供方 | 占位不可执行 | DSH 同名目录 |
| [packages/experimental/schedule-bundle](../packages/experimental/schedule-bundle) | — | placeholder | 实验定时任务能力组合 | 占位不可执行 | DSH 同名目录 |
| [packages/experimental/speech-to-text](../packages/experimental/speech-to-text) | — | placeholder | 实验语音识别服务合同 | 占位不可执行 | DSH 同名目录 |
| [packages/experimental/speech-to-text-sensevoice](../packages/experimental/speech-to-text-sensevoice) | — | placeholder | SenseVoice 语音识别提供方 | 占位不可执行 | DSH 同名目录 |
| [packages/experimental/tool-agent-team](../packages/experimental/tool-agent-team) | — | placeholder | 实验团队委派/控制工具 | 占位不可执行 | DSH 同名目录 |
| [packages/experimental/voice-input-bundle](../packages/experimental/voice-input-bundle) | — | placeholder | 实验语音输入能力组合 | 占位不可执行 | DSH 同名目录 |
| [packages/experimental/webworker-packer](../packages/experimental/webworker-packer) | — | placeholder | 实验 WebWorker 构建封装 | 占位不可执行 | DSH 同名目录 |
| [packages/experimental/webworker-runtime](../packages/experimental/webworker-runtime) | — | placeholder | 实验 WebWorker 执行运行时 | 占位不可执行 | DSH 同名目录 |
| [packages/extensions/cordis-client-runner](../packages/extensions/cordis-client-runner) | — | placeholder | 客户端 Cordis 扩展运行适配 | 占位不可执行 | DSH 同名目录 |
| [packages/extensions/cordis-host-runner](../packages/extensions/cordis-host-runner) | — | placeholder | Host Cordis 扩展运行适配 | 占位不可执行 | DSH 同名目录 |
| [packages/extensions/tool-cordis](../packages/extensions/tool-cordis) | — | placeholder | Cordis 扩展操作工具 | 占位不可执行 | DSH 同名目录 |
| [packages/extensions/ui-cordis](../packages/extensions/ui-cordis) | — | placeholder | Cordis 扩展状态和交互界面 | 占位不可执行 | DSH 同名目录 |
| [packages/feedback/command-feedback](../packages/feedback/command-feedback) | — | placeholder | 显式反馈命令适配 | 占位不可执行 | DSH 同名目录 |
| [packages/feedback/message-feedback](../packages/feedback/message-feedback) | — | placeholder | 消息反馈状态与记录服务 | 占位不可执行 | DSH 同名目录 |
| [packages/fs/fs](../packages/fs/fs) | lfaa-fs | implemented | 统一文件库、账户资源与文件任务合同 | [源码](../packages/fs/fs/src/index.ts)；7 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/fs/fs-local](../packages/fs/fs-local) | lfaa-fs-local | implemented | 本机项目文件访问提供方 | [源码](../packages/fs/fs-local/src/index.ts)；1 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/fs/fs-observation-policy](../packages/fs/fs-observation-policy) | — | placeholder | 文件观察、刷新与缓存失效策略 | 占位不可执行 | DSH 同名目录 |
| [packages/fs/fs-sandbox](../packages/fs/fs-sandbox) | — | placeholder | 隔离文件访问提供方 | 占位不可执行 | DSH 同名目录 |
| [packages/fs/tool-fs](../packages/fs/tool-fs) | lfaa-tool-fs | implemented | 项目文件读写/删除工具适配 | [源码](../packages/fs/tool-fs/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/fs/tool-fs-search](../packages/fs/tool-fs-search) | lfaa-tool-fs-search | implemented | 有界文件名/正文检索工具 | [源码](../packages/fs/tool-fs-search/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/fs/tool-str-replace-editor](../packages/fs/tool-str-replace-editor) | lfaa-tool-str-replace-editor | implemented | 带基准校验的精准文本替换工具 | [源码](../packages/fs/tool-str-replace-editor/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/games/minecraft](../packages/games/minecraft) | lfaa-games-minecraft | implemented | Minecraft 核心、实例、部署与生命周期领域服务 | [源码](../packages/games/minecraft/src/index.ts)；4 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/games/runtime-manager](../packages/games/runtime-manager) | lfaa-runtime-manager | implemented | 设备运行环境发现、解析、安装与真实任务服务 | [源码](../packages/games/runtime-manager/src/index.ts)；4 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/games/steamcmd](../packages/games/steamcmd) | lfaa-games-steamcmd | implemented | SteamCMD 工具安装和校验领域服务 | [源码](../packages/games/steamcmd/src/index.ts)；4 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/games/tool-minecraft](../packages/games/tool-minecraft) | lfaa-tool-minecraft | implemented | Minecraft 模型工具与原业务服务适配，合同按需选择 | [源码](../packages/games/tool-minecraft/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/games/tool-runtime](../packages/games/tool-runtime) | lfaa-tool-runtime | implemented | 运行环境模型工具与 RuntimeManager 适配 | [源码](../packages/games/tool-runtime/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/games/tool-steamcmd](../packages/games/tool-steamcmd) | lfaa-tool-steamcmd | implemented | SteamCMD 模型工具与原节点任务服务适配 | [源码](../packages/games/tool-steamcmd/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/goal/command-goal](../packages/goal/command-goal) | — | placeholder | 显式目标控制命令 | 占位不可执行 | DSH 同名目录 |
| [packages/goal/goal](../packages/goal/goal) | — | placeholder | 目标状态及生命周期合同 | 占位不可执行 | DSH 同名目录 |
| [packages/goal/goal-round-driver](../packages/goal/goal-round-driver) | — | placeholder | 目标驱动回合调度适配 | 占位不可执行 | DSH 同名目录 |
| [packages/goal/tool-goal](../packages/goal/tool-goal) | — | placeholder | 目标创建/查询/控制工具 | 占位不可执行 | DSH 同名目录 |
| [packages/guard/repeat-tool-reminder](../packages/guard/repeat-tool-reminder) | — | placeholder | 重复工具行动提醒，不替代领域防重 | 占位不可执行 | DSH 同名目录 |
| [packages/guard/timeout-policy](../packages/guard/timeout-policy) | — | placeholder | 执行超时策略合同 | 占位不可执行 | DSH 同名目录 |
| [packages/hooks/hook-protocol](../packages/hooks/hook-protocol) | lfaa-hook-protocol | implemented | 模型请求前后钩子与可撤销事件协议 | [源码](../packages/hooks/hook-protocol/src/index.ts)；1 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/hooks/hooks-claude-code](../packages/hooks/hooks-claude-code) | — | placeholder | Claude Code 生命周期钩子适配 | 占位不可执行 | DSH 同名目录 |
| [packages/hooks/hooks-codex](../packages/hooks/hooks-codex) | — | placeholder | Codex 生命周期钩子适配 | 占位不可执行 | DSH 同名目录 |
| [packages/host/daemon](../packages/host/daemon) | lfaa-host-daemon | implemented | 节点身份、心跳、任务领取、进程/文件执行与回报 | [源码](../packages/host/daemon/src/index.ts)；17 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/host/directory-picker](../packages/host/directory-picker) | — | placeholder | Host 目录选择服务合同 | 占位不可执行 | DSH 同名目录 |
| [packages/host/directory-picker-auto](../packages/host/directory-picker-auto) | — | placeholder | 目录选择提供方自动适配 | 占位不可执行 | DSH 同名目录 |
| [packages/host/directory-picker-browse](../packages/host/directory-picker-browse) | — | placeholder | 服务端目录浏览选择适配 | 占位不可执行 | DSH 同名目录 |
| [packages/host/directory-picker-native](../packages/host/directory-picker-native) | — | placeholder | 平台原生目录选择提供方 | 占位不可执行 | DSH 同名目录 |
| [packages/host/frontend-static](../packages/host/frontend-static) | — | placeholder | 前端静态资源托管适配 | 占位不可执行 | DSH 同名目录 |
| [packages/host/git](../packages/host/git) | lfaa-host-git | implemented | 本机 Git 状态、差异、提交和分支固定操作执行 Owner | [源码](../packages/host/git/src/index.ts)；4 个静态消费者；0 个组合声明 | LFAA 扩展 |
| [packages/host/open-in-app](../packages/host/open-in-app) | — | placeholder | 平台应用打开能力提供方 | 占位不可执行 | DSH 同名目录 |
| [packages/host/plugin-inventory](../packages/host/plugin-inventory) | — | placeholder | Host 插件清单和能力检查 | 占位不可执行 | DSH 同名目录 |
| [packages/host/product-telemetry-otel](../packages/host/product-telemetry-otel) | — | placeholder | 产品指标 OpenTelemetry 提供方 | 占位不可执行 | DSH 同名目录 |
| [packages/host/project-files](../packages/host/project-files) | lfaa-host-project-files | implemented | 本机与 Daemon 共用的受限文件执行器 | 仅组合/清单；未证实运行 | LFAA 扩展 |
| [packages/host/runtime-environment](../packages/host/runtime-environment) | lfaa-runtime-environment | implemented | Host 配置与运行位置服务合同 | [源码](../packages/host/runtime-environment/src/java-runtime.mjs)；3 个静态消费者；0 个组合声明 | LFAA 扩展 |
| [packages/host/webserver](../packages/host/webserver) | lfaa-host-webserver | implemented | 共享 HTTP/Socket 服务和静态资源承载 | [源码](../packages/host/webserver/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/identity/anonymous-user-id](../packages/identity/anonymous-user-id) | — | placeholder | 匿名用户标识来源适配 | 占位不可执行 | DSH 同名目录 |
| [packages/identity/auth](../packages/identity/auth) | lfaa-identity-auth | implemented | 账户身份、认证和账户隔离权威 | [源码](../packages/identity/auth/src/index.ts)；10 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/integrations/github](../packages/integrations/github) | lfaa-github-integration | implemented | GitHub App Device Flow、账户令牌与只读 REST 数据 Owner | [源码](../packages/integrations/github/src/index.ts)；1 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/interaction/commands](../packages/interaction/commands) | — | placeholder | 通用交互命令登记协议 | 占位不可执行 | DSH 同名目录 |
| [packages/interaction/permission-presets](../packages/interaction/permission-presets) | lfaa-permission-presets | implemented | 三模式授权、审批记忆与执行范围权威 | [源码](../packages/interaction/permission-presets/src/index.ts)；8 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/interaction/tool-ask-user](../packages/interaction/tool-ask-user) | lfaa-tool-ask-user | implemented | 模型结构化澄清工具 | [源码](../packages/interaction/tool-ask-user/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/interaction/user-approval](../packages/interaction/user-approval) | lfaa-user-approval | implemented | 用户审批请求、通知及真实决定服务 | [源码](../packages/interaction/user-approval/src/index.ts)；2 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/interaction/user-questions](../packages/interaction/user-questions) | lfaa-user-questions | implemented | 账户/Run 范围的问题等待和答案路由 | [源码](../packages/interaction/user-questions/src/index.ts)；1 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/jobs/jobs](../packages/jobs/jobs) | lfaa-jobs | implemented | 真实任务队列、租约、结果、日志和取消服务 | [源码](../packages/jobs/jobs/src/index.ts)；10 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/jobs/jobs-local](../packages/jobs/jobs-local) | — | placeholder | 本机后台任务执行提供方 | 占位不可执行 | DSH 同名目录 |
| [packages/jobs/tool-jobs](../packages/jobs/tool-jobs) | — | placeholder | 后台任务查询/控制工具 | 占位不可执行 | DSH 同名目录 |
| [packages/knowledge/knowledge-library](../packages/knowledge/knowledge-library) | lfaa-knowledge-library | implemented | 账户知识、Prompt、Skill、专家资料及项目来源目录 | [源码](../packages/knowledge/knowledge-library/src/index.ts)；2 个静态消费者；0 个组合声明 | LFAA 扩展 |
| [packages/llm/deepseek-llm-api-extensions](../packages/llm/deepseek-llm-api-extensions) | — | placeholder | DeepSeek Provider 专属协议扩展 | 占位不可执行 | DSH 同名目录 |
| [packages/llm/llm](../packages/llm/llm) | lfaa-llm | implemented | 模型请求、流、错误、能力和用量的实际 Provider Owner | [源码](../packages/llm/llm/src/index.ts)；12 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/llm/llm-deepseek](../packages/llm/llm-deepseek) | — | placeholder | DeepSeek 模型 Provider 适配 | 占位不可执行 | DSH 同名目录 |
| [packages/llm/llm-deepseek-account](../packages/llm/llm-deepseek-account) | — | placeholder | DeepSeek 账户方式的模型连接适配 | 占位不可执行 | DSH 同名目录 |
| [packages/llm/llm-deepseek-api-key](../packages/llm/llm-deepseek-api-key) | — | placeholder | DeepSeek API Key 方式的模型连接适配 | 占位不可执行 | DSH 同名目录 |
| [packages/llm/llm-local-runtime](../packages/llm/llm-local-runtime) | lfaa-llm-local-runtime | implemented | LFAA 本地模型目录、固定 Hub 下载、适配器注册与受管推理进程核心 | [源码](../packages/llm/llm-local-runtime/src/index.ts)；4 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/llm/llm-minimax-h3](../packages/llm/llm-minimax-h3) | lfaa-llm-minimax-h3 | implemented | LFAA 官方 MiniMax-H3 FL2VA Diffusers 原生模型目录识别与视频适配 | [源码](../packages/llm/llm-minimax-h3/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/llm/llm-moss-image](../packages/llm/llm-moss-image) | lfaa-llm-moss-image | implemented | LFAA 官方 MOSS-Image Diffusers 原生模型目录识别与生图适配 | [源码](../packages/llm/llm-moss-image/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/llm/llm-pi-ai](../packages/llm/llm-pi-ai) | lfaa-llm-pi-ai | implemented | PI AI 模型协议桥接提供方 | [源码](../packages/llm/llm-pi-ai/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/llm/llm-retry](../packages/llm/llm-retry) | lfaa-llm-retry | implemented | 有界 Provider 重试策略，不重放工具副作用 | [源码](../packages/llm/llm-retry/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/llm/plugin-package-inventory-deepseek](../packages/llm/plugin-package-inventory-deepseek) | — | placeholder | DeepSeek 插件包目录适配 | 占位不可执行 | DSH 同名目录 |
| [packages/llm/token-meter](../packages/llm/token-meter) | lfaa-token-meter | implemented | 模型上下文/输出令牌估算合同 | [源码](../packages/llm/token-meter/src/index.ts)；2 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/lsp/lsp](../packages/lsp/lsp) | — | placeholder | 语言服务协议与服务合同 | 占位不可执行 | DSH 同名目录 |
| [packages/lsp/lsp-stdio](../packages/lsp/lsp-stdio) | — | placeholder | stdio 语言服务进程提供方 | 占位不可执行 | DSH 同名目录 |
| [packages/lsp/tool-lsp](../packages/lsp/tool-lsp) | — | placeholder | 代码导航和语言服务工具 | 占位不可执行 | DSH 同名目录 |
| [packages/mcp/mcp-client](../packages/mcp/mcp-client) | lfaa-mcp-client | implemented | MCP 连接池、发现、按需目录/调用和账户/配置回收 | [源码](../packages/mcp/mcp-client/src/index.ts)；3 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/mcp/mcp-resources](../packages/mcp/mcp-resources) | — | placeholder | MCP 资源列表与按需读取适配 | 占位不可执行 | DSH 同名目录 |
| [packages/network/game-connectivity](../packages/network/game-connectivity) | lfaa-game-connectivity | implemented | 游戏联机目标、连接配置及节点网络任务领域 | [源码](../packages/network/game-connectivity/src/index.ts)；4 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/plan/plan-mode](../packages/plan/plan-mode) | — | placeholder | 计划模式状态与执行范围合同 | 占位不可执行 | DSH 同名目录 |
| [packages/preset/agent-preset](../packages/preset/agent-preset) | lfaa-agent-preset | implemented | 主/子 Agent 预设元数据登记，不持有领域正文 | [源码](../packages/preset/agent-preset/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/preset/agent-preset-registry](../packages/preset/agent-preset-registry) | — | placeholder | Agent 预设目录登记服务 | 占位不可执行 | DSH 同名目录 |
| [packages/preset/domain-experts](../packages/preset/domain-experts) | lfaa-domain-experts | implemented | 领域与写作角色元数据、稳定 ID 及按需专家正文 | [源码](../packages/preset/domain-experts/src/index.ts)；1 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/preset/persona](../packages/preset/persona) | — | placeholder | 可选 Agent 人格配置与指引 | 占位不可执行 | DSH 同名目录 |
| [packages/prompt/minecraft](../packages/prompt/minecraft) | lfaa-prompt-minecraft | implemented | Minecraft 提示词正文 Owner、摘要及按需加载登记 | [源码](../packages/prompt/minecraft/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/prompt/prompt](../packages/prompt/prompt) | lfaa-prompt | implemented | 复用 AiExtensions 的 Prompt/Expert 目录、正文加载及账户安装提示词工具 | [源码](../packages/prompt/prompt/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/prompt/writing](../packages/prompt/writing) | lfaa-prompt-writing | implemented | 写作任务提示词正文 Owner、摘要及按需加载登记 | [源码](../packages/prompt/writing/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/ptc-runtime/ptc-runtime](../packages/ptc-runtime/ptc-runtime) | — | placeholder | Programmatic Tool Calling 隔离执行合同 | 占位不可执行 | DSH 同名目录 |
| [packages/ptc-runtime/ptc-runtime-node](../packages/ptc-runtime/ptc-runtime-node) | — | placeholder | Node.js PTC 执行提供方 | 占位不可执行 | DSH 同名目录 |
| [packages/runtime-diagnostics/invariants](../packages/runtime-diagnostics/invariants) | — | placeholder | 运行不变量和诊断证据检查 | 占位不可执行 | DSH 同名目录 |
| [packages/sandbox/sandbox](../packages/sandbox/sandbox) | lfaa-sandbox | implemented | 隔离执行服务与能力报告合同 | [源码](../packages/sandbox/sandbox/src/index.ts)；3 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/sandbox/sandbox-local](../packages/sandbox/sandbox-local) | — | placeholder | 本机隔离执行提供方 | 占位不可执行 | DSH 同名目录 |
| [packages/sandbox/sandbox-policy](../packages/sandbox/sandbox-policy) | lfaa-sandbox-policy | implemented | 隔离策略和真实能力校验 | [源码](../packages/sandbox/sandbox-policy/src/index.ts)；4 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/sandbox/sandbox-windows-acl](../packages/sandbox/sandbox-windows-acl) | — | placeholder | Windows ACL 隔离执行提供方 | 占位不可执行 | DSH 同名目录 |
| [packages/schedule/schedule](../packages/schedule/schedule) | lfaa-schedule | implemented | 账户定时触发、派发和真实执行回执 | [源码](../packages/schedule/schedule/src/index.ts)；1 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/sdk/client](../packages/sdk/client) | — | placeholder | 旧上游 SDK 客户端目录预留，不取代 sdk-client | 占位不可执行 | DSH 同名目录 |
| [packages/sdk/protocol](../packages/sdk/protocol) | — | placeholder | 旧上游 SDK 协议目录预留，不取代 sdk-protocol | 占位不可执行 | DSH 同名目录 |
| [packages/sdk/sdk-client](../packages/sdk/sdk-client) | lfaa-sdk-client | implemented | 认证 REST/SSE SDK 客户端 | [源码](../packages/sdk/sdk-client/src/index.ts)；0 个静态消费者；0 个组合声明 | LFAA 扩展 |
| [packages/sdk/sdk-protocol](../packages/sdk/sdk-protocol) | lfaa-sdk-protocol | implemented | SDK 请求、结果、事件和错误合同 | [源码](../packages/sdk/sdk-protocol/src/index.ts)；1 个静态消费者；0 个组合声明 | LFAA 扩展 |
| [packages/sdk/server](../packages/sdk/server) | — | placeholder | SDK 服务端承载适配 | 占位不可执行 | DSH 同名目录 |
| [packages/session-query/session-log-export](../packages/session-query/session-log-export) | lfaa-session-log-export | implemented | 账户会话日志导出 | [源码](../packages/session-query/session-log-export/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/session-query/session-query](../packages/session-query/session-query) | lfaa-session-query | implemented | 当前会话查询服务合同 | [源码](../packages/session-query/session-query/src/index.ts)；1 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/session-query/session-query-sqlite](../packages/session-query/session-query-sqlite) | lfaa-session-query-sqlite | implemented | 可重建 SQLite 会话查询索引 | [源码](../packages/session-query/session-query-sqlite/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/session-query/tool-session-query](../packages/session-query/tool-session-query) | lfaa-tool-session-query | implemented | 范围内会话查询工具，不扩大历史可见性 | [源码](../packages/session-query/tool-session-query/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/session/session-checkpoint-policy](../packages/session/session-checkpoint-policy) | lfaa-session-checkpoint-policy | implemented | 会话检查点提交策略 | [源码](../packages/session/session-checkpoint-policy/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/session/session-format](../packages/session/session-format) | lfaa-session-format | implemented | 会话事件和格式版本合同 | [源码](../packages/session/session-format/src/index.ts)；4 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/session/session-format-catalog](../packages/session/session-format-catalog) | lfaa-session-format-catalog | implemented | 会话格式/迁移目录 | [源码](../packages/session/session-format-catalog/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/session/session-format-v0-to-v1](../packages/session/session-format-v0-to-v1) | lfaa-session-format-v0-to-v1 | implemented | 会话格式 v0 到 v1 迁移 | [源码](../packages/session/session-format-v0-to-v1/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/session/session-format-v1-to-v2](../packages/session/session-format-v1-to-v2) | lfaa-session-format-v1-to-v2 | implemented | 会话格式 v1 到 v2 迁移 | [源码](../packages/session/session-format-v1-to-v2/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/session/session-format-v2-to-v3](../packages/session/session-format-v2-to-v3) | lfaa-session-format-v2-to-v3 | implemented | 会话格式 v2 到 v3 迁移 | [源码](../packages/session/session-format-v2-to-v3/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/session/session-format-v3-to-v4](../packages/session/session-format-v3-to-v4) | lfaa-session-format-v3-to-v4 | implemented | 会话格式 v3 到 v4 迁移 | [源码](../packages/session/session-format-v3-to-v4/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/session/session-log-deepseek](../packages/session/session-log-deepseek) | — | placeholder | DeepSeek 专属会话日志适配 | 占位不可执行 | DSH 同名目录 |
| [packages/session/session-persistence](../packages/session/session-persistence) | lfaa-session-persistence | implemented | 会话持久化服务接口 | [源码](../packages/session/session-persistence/src/index.ts)；1 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/session/session-persistence-jsonl](../packages/session/session-persistence-jsonl) | lfaa-session-persistence-jsonl | implemented | 受保护 JSONL 事件、哈希链及恢复权威 | [源码](../packages/session/session-persistence-jsonl/src/index.ts)；2 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/session/session-projection](../packages/session/session-projection) | lfaa-session-projection | implemented | 会话事件到读取投影的归约 | [源码](../packages/session/session-projection/src/index.ts)；1 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/session/session-projection-cache](../packages/session/session-projection-cache) | lfaa-session-projection-cache | implemented | 派生会话投影缓存 | [源码](../packages/session/session-projection-cache/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/session/session-stats](../packages/session/session-stats) | lfaa-session-stats | implemented | 从权威事件派生会话统计 | [源码](../packages/session/session-stats/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/session/session-telemetry](../packages/session/session-telemetry) | lfaa-session-telemetry | implemented | 会话公开指标及统计协议 | [源码](../packages/session/session-telemetry/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/session/session-telemetry-otel](../packages/session/session-telemetry-otel) | lfaa-session-telemetry-otel | implemented | 会话 OpenTelemetry 提供方 | [源码](../packages/session/session-telemetry-otel/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/session/session-title](../packages/session/session-title) | lfaa-session-title | implemented | 会话标题策略服务 | [源码](../packages/session/session-title/src/index.ts)；2 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/session/session-title-all-prompts-llm](../packages/session/session-title-all-prompts-llm) | lfaa-session-title-all-prompts-llm | implemented | 全提示上下文的模型标题提供方 | [源码](../packages/session/session-title-all-prompts-llm/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/session/session-title-first-prompt-llm](../packages/session/session-title-first-prompt-llm) | lfaa-session-title-first-prompt-llm | implemented | 首轮提示的模型标题提供方 | [源码](../packages/session/session-title-first-prompt-llm/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/session/session-title-llm](../packages/session/session-title-llm) | lfaa-session-title-llm | implemented | 通用模型标题生成适配 | [源码](../packages/session/session-title-llm/src/index.ts)；2 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/session/session-turn-outline](../packages/session/session-turn-outline) | lfaa-session-turn-outline | implemented | 会话回合大纲投影 | [源码](../packages/session/session-turn-outline/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/settings/settings](../packages/settings/settings) | lfaa-settings | implemented | 账户设置类型、默认值、校验、持久化和能力映射权威 | [源码](../packages/settings/settings/src/index.ts)；42 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/shell/bash-local](../packages/shell/bash-local) | lfaa-bash-local | implemented | 本机 Bash Shell 提供方 | [源码](../packages/shell/bash-local/src/index.ts)；1 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/shell/bash-sandbox](../packages/shell/bash-sandbox) | lfaa-bash-sandbox | implemented | 隔离 Bash Shell 提供方 | [源码](../packages/shell/bash-sandbox/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/shell/pwsh-local](../packages/shell/pwsh-local) | lfaa-pwsh-local | implemented | 本机 PowerShell 提供方 | [源码](../packages/shell/pwsh-local/src/index.ts)；1 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/shell/pwsh-sandbox](../packages/shell/pwsh-sandbox) | lfaa-pwsh-sandbox | implemented | 隔离 PowerShell 提供方 | [源码](../packages/shell/pwsh-sandbox/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/shell/shell](../packages/shell/shell) | lfaa-shell | implemented | Shell 服务、真实执行和取消合同 | [源码](../packages/shell/shell/src/index.ts)；6 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/shell/shell-env](../packages/shell/shell-env) | lfaa-shell-env | implemented | Shell 环境变量过滤及运行环境映射 | [源码](../packages/shell/shell-env/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/shell/tool-bash](../packages/shell/tool-bash) | — | placeholder | Bash 命令模型工具适配 | 占位不可执行 | DSH 同名目录 |
| [packages/shell/tool-bash-persistent](../packages/shell/tool-bash-persistent) | — | placeholder | 持久 Bash 会话模型工具适配 | 占位不可执行 | DSH 同名目录 |
| [packages/shell/tool-pwsh](../packages/shell/tool-pwsh) | — | placeholder | PowerShell 命令模型工具适配 | 占位不可执行 | DSH 同名目录 |
| [packages/shell/tool-pwsh-persistent](../packages/shell/tool-pwsh-persistent) | — | placeholder | 持久 PowerShell 会话模型工具适配 | 占位不可执行 | DSH 同名目录 |
| [packages/shell/tool-shell](../packages/shell/tool-shell) | lfaa-tool-shell | implemented | 目标节点与本机 Shell 的模型工具合同 | [源码](../packages/shell/tool-shell/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/skill/minecraft](../packages/skill/minecraft) | lfaa-skill-minecraft | implemented | Minecraft bundled SKILL.md 资源及独立按需 Provider | [源码](../packages/skill/minecraft/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/skill/rea](../packages/skill/rea) | lfaa-skill-rea | implemented | REA 逆向分析的 LFAA authored Skill 摘要与按需工作流正文 | [源码](../packages/skill/rea/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/skill/skill](../packages/skill/skill) | lfaa-skill | implemented | 统一 Skill Provider 注册、摘要合并和按需正文加载 | [源码](../packages/skill/skill/src/index.ts)；8 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/skill/skill-badge](../packages/skill/skill-badge) | — | placeholder | 内置 badge 方法资源和 Provider | 占位不可执行 | DSH 同名目录 |
| [packages/skill/skill-filesystem](../packages/skill/skill-filesystem) | lfaa-skill-filesystem | implemented | 账户/项目目录 Skill 来源发现、缓存与加载 | [源码](../packages/skill/skill-filesystem/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/skill/skill-office](../packages/skill/skill-office) | lfaa-skill-office | implemented | Office 文档方法资源及按需 Provider | [源码](../packages/skill/skill-office/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/skill/tool-skill](../packages/skill/tool-skill) | lfaa-tool-skill | implemented | 共享 Skill 发现/加载工具及旧写作调用名适配 | [源码](../packages/skill/tool-skill/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/skill/tool-workspace-dependencies](../packages/skill/tool-workspace-dependencies) | — | placeholder | 工作区依赖发现与配置工具 | 占位不可执行 | DSH 同名目录 |
| [packages/skill/writing](../packages/skill/writing) | lfaa-skill-writing | implemented | 内置写作方法正文、摘要及共享 Skill Provider | [源码](../packages/skill/writing/src/index.ts)；2 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/spill/spill](../packages/spill/spill) | lfaa-spill | implemented | 大工具结果留存与受限读取合同 | [源码](../packages/spill/spill/src/index.ts)；2 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/spill/spill-local](../packages/spill/spill-local) | lfaa-spill-local | implemented | 本机大结果留存提供方 | [源码](../packages/spill/spill-local/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/spill/spill-policy](../packages/spill/spill-policy) | lfaa-spill-policy | implemented | 结果留存阈值、预算与清理策略 | [源码](../packages/spill/spill-policy/src/index.ts)；0 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/ssh/fs-ssh](../packages/ssh/fs-ssh) | lfaa-fs-ssh | implemented | SSH 目标文件访问适配 | [源码](../packages/ssh/fs-ssh/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/ssh/sandbox-ssh](../packages/ssh/sandbox-ssh) | lfaa-sandbox-ssh | implemented | SSH 目标隔离执行适配 | [源码](../packages/ssh/sandbox-ssh/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/ssh/ssh](../packages/ssh/ssh) | lfaa-ssh | implemented | SSH 连接与凭据/主机校验服务 | [源码](../packages/ssh/ssh/src/index.ts)；3 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/ssh/subprocess-ssh](../packages/ssh/subprocess-ssh) | lfaa-subprocess-ssh | implemented | SSH 远端进程执行适配 | [源码](../packages/ssh/subprocess-ssh/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/storage/storage](../packages/storage/storage) | lfaa-storage-hub | implemented | 存储 Hub、命名空间和后端登记 | [源码](../packages/storage/storage/src/index.ts)；2 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/storage/storage-domain](../packages/storage/storage-domain) | lfaa-storage-domain | implemented | 领域存储协调、配置事务及迁移 | [源码](../packages/storage/storage-domain/src/index.ts)；8 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/storage/storage-json](../packages/storage/storage-json) | lfaa-storage-json | implemented | 受控 JSON 配置存储提供方 | [源码](../packages/storage/storage-json/src/index.ts)；11 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/storage/storage-sqlite](../packages/storage/storage-sqlite) | lfaa-storage-sqlite | implemented | SQLite 连接、Schema、事务与持久化后端 | [源码](../packages/storage/storage-sqlite/src/index.ts)；22 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/subagent/subagent](../packages/subagent/subagent) | lfaa-subagent | implemented | 委派任务状态、驱动登记与结果合同 | [源码](../packages/subagent/subagent/src/index.ts)；4 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/subagent/subagent-acp](../packages/subagent/subagent-acp) | — | placeholder | ACP 外部 Agent 驱动 | 占位不可执行 | DSH 同名目录 |
| [packages/subagent/subagent-claude-code](../packages/subagent/subagent-claude-code) | lfaa-subagent-claude-code | implemented | Claude Code 外部 Agent 驱动 | [源码](../packages/subagent/subagent-claude-code/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/subagent/subagent-codex](../packages/subagent/subagent-codex) | lfaa-subagent-codex | implemented | Codex 外部 Agent 驱动 | [源码](../packages/subagent/subagent-codex/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/subagent/subagent-dsh-sdk](../packages/subagent/subagent-dsh-sdk) | — | placeholder | DSH SDK 外部 Agent 驱动 | 占位不可执行 | DSH 同名目录 |
| [packages/subagent/subagent-fork-in-process](../packages/subagent/subagent-fork-in-process) | — | placeholder | 进程内分支子 Agent 驱动 | 占位不可执行 | DSH 同名目录 |
| [packages/subagent/subagent-in-process-driver](../packages/subagent/subagent-in-process-driver) | lfaa-subagent-in-process-driver | implemented | 复用唯一 Agent Loop 的进程内驱动 | [源码](../packages/subagent/subagent-in-process-driver/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/subagent/subagent-spawn-in-process](../packages/subagent/subagent-spawn-in-process) | — | placeholder | 进程内新建子 Agent 驱动 | 占位不可执行 | DSH 同名目录 |
| [packages/subagent/tool-subagent](../packages/subagent/tool-subagent) | lfaa-tool-subagent | implemented | 模型委派工具和预算/范围适配 | [源码](../packages/subagent/tool-subagent/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/subagent/tool-subagent-control](../packages/subagent/tool-subagent-control) | lfaa-tool-subagent-control | implemented | 子任务查询/取消工具 | [源码](../packages/subagent/tool-subagent-control/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/subprocess/subprocess](../packages/subprocess/subprocess) | lfaa-subprocess | implemented | 受控进程执行和交互合同 | [源码](../packages/subprocess/subprocess/src/index.ts)；6 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/subprocess/subprocess-local](../packages/subprocess/subprocess-local) | lfaa-subprocess-local | implemented | 本机进程/PTY 执行、取消与进程树提供方 | [源码](../packages/subprocess/subprocess-local/src/index.ts)；1 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/subprocess/win32-process](../packages/subprocess/win32-process) | lfaa-win32-process | implemented | Windows 进程树与平台执行辅助 | [源码](../packages/subprocess/win32-process/src/index.ts)；1 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/telemetry/logger](../packages/telemetry/logger) | lfaa-telemetry-logger | implemented | 结构化日志与安全脱敏 | 仅组合/清单；未证实运行 | LFAA 扩展 |
| [packages/telemetry/otel](../packages/telemetry/otel) | — | placeholder | 通用 OpenTelemetry 输出提供方 | 占位不可执行 | DSH 同名目录 |
| [packages/terminal/terminal](../packages/terminal/terminal) | lfaa-terminal | implemented | 交互终端会话及事件合同 | [源码](../packages/terminal/terminal/src/index.ts)；1 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/terminal/terminal-bash](../packages/terminal/terminal-bash) | lfaa-terminal-bash | implemented | Bash 交互终端适配 | [源码](../packages/terminal/terminal-bash/src/index.ts)；3 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/terminal/tool-terminal](../packages/terminal/tool-terminal) | lfaa-tool-terminal | implemented | 模型终端会话工具与真实节点任务适配 | [源码](../packages/terminal/tool-terminal/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/test-support/agent-loop-testkit](../packages/test-support/agent-loop-testkit) | — | placeholder | 隔离 Agent 循环测试工具包 | 占位不可执行 | DSH 同名目录 |
| [packages/test-support/api](../packages/test-support/api) | lfaa-test-support-api | implemented | 认证 API 隔离回归支持 | 仅组合/清单；未证实运行 | LFAA 扩展 |
| [packages/test-support/client-runtime](../packages/test-support/client-runtime) | — | placeholder | 客户端运行时隔离测试支持 | 占位不可执行 | DSH 同名目录 |
| [packages/test-support/llm-mock-server](../packages/test-support/llm-mock-server) | — | placeholder | 隔离合成 Provider 服务 | 占位不可执行 | DSH 同名目录 |
| [packages/test-support/llm-replay](../packages/test-support/llm-replay) | — | placeholder | 模型协议录制回放测试支持 | 占位不可执行 | DSH 同名目录 |
| [packages/test-support/loader-smoke](../packages/test-support/loader-smoke) | — | placeholder | 插件加载/卸载冒烟测试支持 | 占位不可执行 | DSH 同名目录 |
| [packages/test-support/remote-mock](../packages/test-support/remote-mock) | — | placeholder | 远程协议替身测试支持 | 占位不可执行 | DSH 同名目录 |
| [packages/test-support/session-snapshot](../packages/test-support/session-snapshot) | — | placeholder | 会话快照测试支持 | 占位不可执行 | DSH 同名目录 |
| [packages/todo/tool-todo](../packages/todo/tool-todo) | — | placeholder | 待办目录和状态操作工具 | 占位不可执行 | DSH 同名目录 |
| [packages/typert/generator](../packages/typert/generator) | lfaa-typert-generator | implemented | 工程期类型化 Remote 描述/Schema 生成 | [源码](../packages/typert/generator/src/index.mjs)；0 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/typert/loader](../packages/typert/loader) | lfaa-typert-loader | implemented | 类型化 Remote 插件贡献加载/卸载 | [源码](../packages/typert/loader/src/index.ts)；1 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/typert/protocol](../packages/typert/protocol) | lfaa-typert-protocol | implemented | Remote 方法、调用上下文、错误和 JSON 验证合同 | [源码](../packages/typert/protocol/src/index.ts)；5 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/typert/registry](../packages/typert/registry) | lfaa-typert-registry | implemented | Remote 方法登记、授权校验与调用 | [源码](../packages/typert/registry/src/index.ts)；2 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/util/atomic-write](../packages/util/atomic-write) | — | placeholder | 通用原子文件提交辅助 | 占位不可执行 | DSH 同名目录 |
| [packages/util/brand](../packages/util/brand) | — | placeholder | 名义类型品牌辅助 | 占位不可执行 | DSH 同名目录 |
| [packages/util/chunked-list](../packages/util/chunked-list) | — | placeholder | 分块列表数据结构 | 占位不可执行 | DSH 同名目录 |
| [packages/util/code-language](../packages/util/code-language) | — | placeholder | 代码语言与扩展名纯映射 | 占位不可执行 | DSH 同名目录 |
| [packages/util/crypto](../packages/util/crypto) | — | placeholder | 通用摘要/加密基础辅助 | 占位不可执行 | DSH 同名目录 |
| [packages/util/deque](../packages/util/deque) | — | placeholder | 双端队列数据结构 | 占位不可执行 | DSH 同名目录 |
| [packages/util/home-paths](../packages/util/home-paths) | lfaa-home-paths | implemented | LFAA Home/Profile 路径解析权威 | [源码](../packages/util/home-paths/src/index.mjs)；16 个静态消费者；0 个组合声明 | DSH 同名目录 |
| [packages/util/http-proxy](../packages/util/http-proxy) | — | placeholder | HTTP 代理配置辅助 | 占位不可执行 | DSH 同名目录 |
| [packages/util/launch-environment](../packages/util/launch-environment) | lfaa-launch-environment | implemented | 启动环境、数据根和进程配置解析 | 仅组合/清单；未证实运行 | DSH 同名目录 |
| [packages/util/lazy-require](../packages/util/lazy-require) | — | placeholder | 延迟模块加载辅助 | 占位不可执行 | DSH 同名目录 |
| [packages/util/native-command](../packages/util/native-command) | — | placeholder | 原生命令参数和执行辅助 | 占位不可执行 | DSH 同名目录 |
| [packages/util/output-retention](../packages/util/output-retention) | — | placeholder | 有界输出保留辅助 | 占位不可执行 | DSH 同名目录 |
| [packages/util/package-manifest](../packages/util/package-manifest) | — | placeholder | 包清单读取和验证辅助 | 占位不可执行 | DSH 同名目录 |
| [packages/util/time](../packages/util/time) | — | placeholder | 时间值处理辅助 | 占位不可执行 | DSH 同名目录 |
| [packages/util/timeout](../packages/util/timeout) | — | placeholder | 有界超时/中止辅助 | 占位不可执行 | DSH 同名目录 |
| [packages/util/values](../packages/util/values) | lfaa-util-values | implemented | 跨运行时纯合同、枚举和共享设置定义 | 仅组合/清单；未证实运行 | DSH 同名目录 |
| [packages/util/workspace-path](../packages/util/workspace-path) | — | placeholder | 工作区相对路径处理辅助 | 占位不可执行 | DSH 同名目录 |
| [packages/video/ai-video](../packages/video/ai-video) | lfaa-video-ai-video | implemented | 账户视频创作项目、媒体、Provider 任务和恢复领域服务 | [源码](../packages/video/ai-video/src/index.ts)；2 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/video/tool-ai-video](../packages/video/tool-ai-video) | lfaa-video-tool-ai-video | implemented | AI 视频领域工具与原项目/生成服务适配 | [源码](../packages/video/tool-ai-video/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/web/tool-web](../packages/web/tool-web) | lfaa-tool-web | implemented | 模型网页搜索/抓取工具合同 | [源码](../packages/web/tool-web/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/web/web](../packages/web/web) | lfaa-web | implemented | 网页能力 Provider 登记和读取服务 | [源码](../packages/web/web/src/index.ts)；3 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/web/web-fetch-http](../packages/web/web-fetch-http) | lfaa-web-fetch-http | implemented | 受验证 HTTP 网页读取提供方 | [源码](../packages/web/web-fetch-http/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/web/web-search-deepseek](../packages/web/web-search-deepseek) | lfaa-web-search-deepseek | implemented | DeepSeek 搜索提供方 | [源码](../packages/web/web-search-deepseek/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/web/web-search-exa](../packages/web/web-search-exa) | — | placeholder | Exa 搜索提供方 | 占位不可执行 | DSH 同名目录 |
| [packages/web/web-search-perplexity](../packages/web/web-search-perplexity) | — | placeholder | Perplexity 搜索提供方 | 占位不可执行 | DSH 同名目录 |
| [packages/webhook/webhook](../packages/webhook/webhook) | — | placeholder | 外部事件验签、解析和触发合同 | 占位不可执行 | DSH 同名目录 |
| [packages/webhook/webhook-github](../packages/webhook/webhook-github) | — | placeholder | GitHub 事件来源适配 | 占位不可执行 | DSH 同名目录 |
| [packages/workflow/dag-engine](../packages/workflow/dag-engine) | lfaa-workflow-dag-engine | implemented | DAG 节点依赖调度、状态和取消 | [源码](../packages/workflow/dag-engine/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/workflow/minecraft-adapter](../packages/workflow/minecraft-adapter) | lfaa-workflow-minecraft-adapter | implemented | Minecraft 领域工作流节点适配 | [源码](../packages/workflow/minecraft-adapter/src/index.ts)；0 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/workflow/tool-ralph](../packages/workflow/tool-ralph) | — | placeholder | Ralph 迭代工作流工具适配 | 占位不可执行 | DSH 同名目录 |
| [packages/workflow/tool-workflow](../packages/workflow/tool-workflow) | lfaa-tool-workflow | implemented | 模型工作流发现、保存、运行和跟踪工具 | [源码](../packages/workflow/tool-workflow/src/index.ts)；0 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/workflow/workflow](../packages/workflow/workflow) | lfaa-workflow | implemented | 账户工作流定义、运行与节点结果服务 | [源码](../packages/workflow/workflow/src/index.ts)；4 个静态消费者；1 个组合声明 | DSH 同名目录 |
| [packages/workflow/workflow-ptc](../packages/workflow/workflow-ptc) | — | placeholder | PTC 执行工作流节点适配 | 占位不可执行 | DSH 同名目录 |
| [packages/workspace/agent-git](../packages/workspace/agent-git) | lfaa-workspace-agent-git | implemented | 账户隔离的本机 Git 仓库登记与 Agent Session 绑定 Owner | [源码](../packages/workspace/agent-git/src/index.ts)；3 个静态消费者；0 个组合声明 | LFAA 扩展 |
| [packages/workspace/data-directory](../packages/workspace/data-directory) | lfaa-workspace-data-directory | implemented | 配置数据目录与工作区资源协调 | [源码](../packages/workspace/data-directory/src/index.ts)；1 个静态消费者；1 个组合声明 | LFAA 扩展 |
| [packages/workspace/workspace](../packages/workspace/workspace) | lfaa-workspace-workspace | implemented | 账户项目、受管工作区、Worktree 与 Session 项目绑定 | [源码](../packages/workspace/workspace/src/index.ts)；5 个静态消费者；1 个组合声明 | DSH 同名目录 |
