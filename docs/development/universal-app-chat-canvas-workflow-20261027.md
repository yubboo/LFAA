# LFAA 通用 App 聊天、画布与工作流（2026-10-27）

<a id="lfaa-universal-app-chat-canvas-workflow-20261027"></a>

## 目标与 Owner

- 用户目标：对话与画布是系统核心能力；App 在此基础上扩展各自领域界面、节点、工具与工作流，小鱼 Agent 与领域 Agent/子 Agent 按用户目标协作。另在 AI Work 欢迎页提供美观、真实且可点击的系统/App 推荐问题；聊天和画布成为各 App 共用的基础工作模式；一键进入或离开画布；复用现有画布整体模板，支持 Agent 按用户一句话读写当前 App 的画布节点/连线和已注册工作流，并由各 App 注册自己的 Agent/节点能力。
- 入口：AI Work `/work` 与 App AI Work `/apps/<app>/ai-work` 归一至共享聊天；通用画布 `/apps/<app>/canvas[/:projectId]`；漫剧仍保留其领域项目入口。
- UI Owner：欢迎页和聊天由 `packages/client/ui-chat`；App 装配、模式切换和当前工作台视图由 `packages/client/ui-workspace` / `ui-layout`；共享画布外壳由 `packages/client/ui-workspace/CanvasWorkspace.tsx`；共享工作流图由 `packages/client/ui-workflow`。
- 数据/执行 Owner：通用画布项目/节点/连线/素材由 `packages/canvas/canvas`；工作流定义、节点注册、引擎和运行记录由 `packages/workflow/workflow`；画布 Agent 工具由 `packages/canvas/tool-canvas`；工作流 Agent 工具由 `packages/workflow/tool-workflow`；Minecraft 节点继续由 Minecraft Adapter；其他 App Agent 节点只调用当前 App 已登记的 `AiBusinessTool`；漫剧领域数据与生成继续由 `packages/video/ai-video` 和 `packages/video/tool-ai-video`。
- 图数据边界：Canvas Project 连线只是项目画布关系，不等同于可执行 DAG。工作流图只由 Workflow Owner 保存和运行；本改动不得把工作流定义写进 Canvas Project 或把漫剧项目改成通用工作流。

## 设置、权限与装配

- 不新增设置。欢迎推荐读取 `aiRuntime.promptSuggestions`（默认开启）；画布默认呈现、网格、吸附、小地图、对话面板使用既有 `canvas.defaultMode/gridStyle/snapToGrid/showMiniMap/agentPanelDefaultOpen`；所有页面继续消费 Appearance 主题、强调色、字体字号、对比度、背景/遮罩/模糊和减少动态效果映射。
- 新一轮 Agent 请求只携带当前 App、画布项目 ID/标题/更新时间和当前工作流 ID/标题/更新时间等最小临时定位信息；不写入消息历史、Session 或权限范围。Agent 仍须读取工具真实状态后操作。
- 节点和连线修改、工作流保存/运行沿用统一 Permission Owner 的请求审批、替我审批和完全访问；工具、节点适配器与 UI 不另设审批策略。账户、App、项目/工作流 ID 与版本冲突校验继续由对应 Owner 执行。
- 每个 App 的可执行节点只能来自当前已注册节点提供方，并调用该 App 现有 Agent/领域工具。没有真实注册能力的节点不可用，不提供成功假结果。Minecraft 现有专用节点与 EULA/工具范围处理保持原 Owner 行为；漫剧工具仍限定在 AI 漫剧 App。

## 分批实现与验收

### 批次 A：AI Work 欢迎页

- 参考附件中的品牌/标题/简介居中展示，推荐问题靠左位于对话输入框上方；不挪动现有底部输入框。
- 用正确 App 的真实提示词问题填充推荐项，点击沿用现有 Agent 消息链路；设置关闭时不显示。问句覆盖系统使用、Minecraft 命令/服务端操作、漫剧创作等真实已接入主题。
- 使用共享主题令牌，适配桌面、窄分栏、手机与短屏；不新增 CSS 变量或动效。

### 批次 B：聊天与画布模式联动及 Agent 上下文

- 聊天页提供“画布”入口，画布顶部提供返回“聊天”的切换；使用当前会话/App 作用域，避免落到固定 workspace。
- 画布模式沿用现有 `CanvasWorkspace` 外壳、工具轨、项目切换、主题与设置映射；不展示原聊天页的底部输入区。复用 Canvas 内已有 AI 对话面板作为可选侧栏，仍使用真实 `AiWorkChat`。
- Canvas 会话的 App ID 与当前 Canvas route 一致；给 Agent 一次性当前项目上下文，使一句自然语言任务能调用真实 `canvas_*` 工具读/增/改/删节点及连接/断开连线。完成后依据 Owner 实际结果更新 UI/工作流图，不把工具文案或提示词当执行结果。
- 画布状态和当前项目引用不写入 Session；新增项目/切换项目继续使用 Canvas Owner 原有保存/并发语义。

### 批次 C：复用画布模板呈现 App 工作流

- 在通用画布外壳内接入已登记的通用工作流编辑器；保留“生成/画布”现有操作，并提供可识别的工作流切换入口。
- 节点菜单来自 Workflow Owner 针对当前 App 返回的实际节点目录；可编辑图只保存到 Workflow Owner。Agent 对工作流的 CRUD/执行继续走真实 `lfaa_workflow_*` 工具。
- 为当前已接入但缺少工作流 Agent 节点的 App 注册按 App 分离的 Agent 节点，节点可用工具从原 `AiBusinessTool` 目录按 App/权限模式取值；Minecraft 使用既有专用节点。节点不可跨 App 复用，不能绕过 Permission Owner。
- 工作流的保存、运行与状态查看分别反映实际 API 返回；非终态运行状态更新使用单请求、可见页面内的有界刷新，并在切换/卸载后取消计时器与请求。

## 禁止范围

- 不重置或修改用户设置、Provider、密钥、账户权限、App 数据和已保存 Canvas/Workflow。
- 不新增第二套 Agent/Workflow/Canvas/审批/凭据/生成 Owner；不把漫剧专属领域数据挪入通用工作流。
- 不伪造 App 节点、Agent 工具、生成成功或工作流运行结果；不把一般 Canvas 连线描述为可执行。
- 不覆盖工作树中已有的其他任务修改；不清理既有改动、临时用户数据或构建产物。

## 验收要求

- 每批分别运行该批直接相关的回归/类型/构建；在 ChatGPT 内置浏览器对当前构建实页检查桌面与窄分栏/短屏，记录路由、视口、操作、截图证据及未测项。Canvas 操作使用隔离验收账户/数据，不触发生成或更改账户偏好。
- 聊天→画布→聊天保留正确 App 作用域、会话状态和 Composer 原位置；Canvas 侧栏可真实发送一条低风险只读问句。
- 一次性上下文能让模型识别当前画布项目和已注册 App 工作流；低风险读、节点/连线写操作各自继续由当前工具与 Permission Owner 完成。本轮若没有真实 Provider 可用，只验收传递合同与既有工具/Owner 回归，不声称模型端到端通过。
- App 节点清单按 App 隔离；当前 App 的新增 Agent 节点通过其真实已登记业务工具执行。执行不可用、插件未登记或版本冲突必须可读失败，旧定义安全保留。
- 变更包 README/架构文档仅在职责和能力事实发生变化时更新；合同逐批记录修改文件、已使用设置、验证命令和结果、运行性能证据及仍未实测项。

## 实施记录

### 2026-10-27 实施与实页验收

- 完成聊天/画布工作模式切换，画布模式复用既有 `CanvasWorkspace` 全屏模板并隐藏主聊天输入框；Canvas 内保留可选的小鱼对话侧栏。实页 `/work` → `/apps/workspace/canvas`，ChatGPT 内置浏览器 1280×720，切换后确认画布路由、画布工具栏、工作流/自由画布分区和 AI 对话入口可见；展开 AI 对话后复用当前小鱼会话与输入框。当前 Workspace 有两个空白画布项目，验收仅通过 GET 读取；没有创建、保存或改动用户画布/工作流。
- 内置浏览器只读核对六个 App 的工作流节点目录：共享基础节点为 `core.result` 与 `core.text-input`；每个 App 的 Agent 节点分别登记为 `workspace.agent`、`minecraft.agent`、`connectivity.agent`、`writing.agent`、`steamcmd.agent`、`aivideo.agent`。画布节点目录由 `CANVAS_NODE_KINDS_BY_APPLICATION` 按 App 约束，后端工具执行再次校验当前 App 与真实 Owner。Minecraft 和 AI 漫剧数据仍由各自领域适配器/Owner 处理。
- 当前 Workspace 尚无工作流，因此没有进行创建、节点写入、连线写入或执行验收；Agent 通过话语写入画布后的刷新/冲突处理已按真实工具活动合同接入，但本轮没有对用户数据触发写操作，也没有声称模型端到端写入通过。`/apps/workspace/canvas` 控制台没有错误，只有 React Flow attribution 提示。窄屏/短屏实页视口未能设置，故响应式窄视口仍待内置浏览器复验。
- 使用现有 `aiRuntime.promptSuggestions`、Canvas 设置 `canvas.defaultMode/gridStyle/snapToGrid/showMiniMap/agentPanelDefaultOpen` 与 Appearance 主题映射；未新增或修改设置。工作区/数据/权限按当前 `applicationId`、Canvas/Workflow Owner 及统一 Permission Owner 处理。
- 构建、类型检查与静态边界检查结果见下方最终验证记录；截图由内置浏览器验收过程保留在本轮工具记录，未另写入仓库文件。

### 最终验证与限制

- `pnpm.cmd exec tsc --noEmit -p tsconfig.client.json`、`pnpm.cmd exec tsc --noEmit -p tsconfig.host.json`、`pnpm.cmd --filter lfaa-client-ui-workflow run build`、`pnpm.cmd run build:web`、`node scripts/package-responsibilities.mjs`、`git diff --check` 均通过；`node scripts/runtime-build-state.mjs web` 与 `host` 均返回 `[]`。本轮未运行测试。
- 构建后在 ChatGPT 内置浏览器打开 `http://127.0.0.1:3000/apps/workspace/canvas`，1280×720 检查共享画布模板、隐藏主聊天输入框、聊天/画布模式切换和“与 AI 对话”入口；切回聊天仍显示原会话，未发送消息或创建会话。Console error 为 0。初次复验时旧浏览器标签遇到连接拒绝；确认 3000 端口为当前 checkout 的正式 Web 入口后，新开内置浏览器标签完成复验。
- `node scripts/check-workspace.mjs` 仍报 7 条仓库文档引用问题：两张旧临时截图链接及五个旧任务合同锚点缺失，均不属于本任务文件。`packages/workflow/workflow` 当前无 Workspace 工作流，未创建工作流、节点/连线或触发执行；无隔离测试数据，因此 Agent 一句话实际写入、刷新与冲突处理尚未端到端操作。真实窄屏/短屏视口未验，全新欢迎页状态未在正式服务中单独创建会话检查。
