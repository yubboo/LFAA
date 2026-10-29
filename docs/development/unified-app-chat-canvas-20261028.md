# 统一 App 聊天与画布工作区（2026-10-28）

<a id="lfaa-unified-app-chat-canvas-20261028"></a>

## 用户目标

- 通用工作台提供全局开发聊天与系统画布；每个业务 App 另有独立绑定的聊天、共享画布、领域手动面板三种工作方式。聊天 UI 与 Agent Runtime 共用，画布 UI 与节点运行时共用，只有手动业务面板和节点目录按 App 不同。所有模式使用同一 Workbench 四栏外壳、标题栏和聊天/画布视觉系统。
- 画布复用一套系统级 UI/交互运行时，并按 App 登记真实节点。用户可在聊天中让 Agent 操作当前画布；工具仍从当前 App 的真实目录发现并由领域 Owner 执行。
- AI 漫剧保留领域手动工作台中的剧本、档案、媒体剪辑/导出和 3D 导演台；重复的手动画布入口收敛到系统共享 Canvas。共享 Canvas 的 AI 漫剧节点必须复用 AI Video Owner 和现有生成工具，不因收敛入口丢失任何领域功能或项目数据。

## 现状与范围

- `ApplicationWorkspace` 已将 App ID 传给 App 聊天，Agent Loop 按 `body.appId` 提供工具；全局 `/work` 仍是通用 `workspace` 范围。
- 现有系统画布 Owner 是 `packages/canvas/canvas`；AI 漫剧项目、分镜及素材 Owner 是 `packages/video/ai-video`。AI 漫剧 `/normal` 与 `/canvas` 曾分别呈现手动 React Flow 和共享 Canvas；它们访问同一 AI Video 项目 Owner，但视觉入口与聊天上下文不一致。
- 交付目标是 AI 漫剧沿用共用四栏、聊天和唯一共享画布核心，同时保留 `/normal` 的手动业务面板。AI Video 现有项目和生成能力继续由 AI Video Owner 持有，通过画布适配呈现；系统 Canvas 不复制漫剧领域事实，不迁移或清理用户文件。媒体剪辑/导出和完整 3D 导演台继续由手动面板提供。其它 App 的手动管理界面也继续保留。
- 画布路由嵌入 `ApplicationWorkspace` 的标准四栏布局；Canvas 只负责画布，App 工作区外层持有唯一聊天右栏，模式切换由共用标题栏管理，不在 Canvas 内再嵌一套聊天 dock。聊天上下文只展示当前应用实际提供的项目定位；`WorkspaceProjectPicker` 仅用于其 API 明确支持的 workspace/Minecraft 项目目录。
- 节点目录按 App 隔离，节点执行交回现有领域 Owner/Tools/统一 Permission Owner；自由画布连线不变成可执行 Workflow。Minecraft 的运行环境、核心下载、许可同意和启动能力只能复用其现有领域合同，不能由通用画布伪造或绕过权限。

## Owner、设置与权限

- 路由/模式栏：`packages/client/ui-layout` 与 `packages/client/ui-workspace/ApplicationWorkspace.tsx`。
- 共享画布 UI：`packages/client/ui-workspace/CanvasWorkspace.tsx`、节点卡片与 Canvas Client Connection。
- 通用画布项目/节点/素材：`packages/canvas/canvas` 与认证 Canvas Controller；AI 漫剧项目、媒体、镜头生成任务：`packages/video/ai-video` 与 `packages/api/ai-video-controller`；AI 工具：`packages/video/tool-ai-video`。
- 当前聊天 `appId` 是领域工具范围；画布工具、领域工具写入沿用唯一 Permission Owner。认证、参数校验、账户/App 隔离、并发冲突与真实执行状态继续由现有 Owner 负责。
- 设置：沿用设置中心 `canvas`（`defaultMode`、`gridStyle`、`snapToGrid`、`showMiniMap`、`agentPanelDefaultOpen`）及 Appearance 共享映射；AI 漫剧图像/视频 Provider、模型、生成参数继续读取现有 AI/模型设置和 Credentials，不新增或重置用户偏好。

## 允许与禁止范围

- 允许：统一三模式路由和切换；通过 App 适配把现有 AI 漫剧数据映射到共享画布合同；为所需节点补齐共享 Canvas UI 表达；保持旧 AI 漫剧项目格式可读、可继续编辑；更新受影响包 README、架构文档和本合同。
- 禁止：建立第二套聊天/Agent/权限、复制 AI 漫剧项目或媒体权威、删除或批量迁移真实用户项目、将画布连线当作 Workflow、为 Minecraft 新建绕开既有工具/服务的执行器、添加虚假能力或成功状态、改变已有用户设置。

## 可观察验收

1. 通用工作台采用聊天/画布两种全局能力；每个业务 App 的入口默认进入 App 聊天，模式栏呈现聊天/画布/手动三种模式。AI 漫剧 `/normal` 保持完整手动工作台，不重定向到画布。
2. AI 漫剧已有项目可在统一画布入口加载、编辑、保存并再次读取；剧本、角色/场景、镜头及位置/连线、媒体素材、时间线、导演台和镜头图片/视频任务都有真实 Owner 回执。不得只做按钮隐藏或静态卡片。
3. 在画布中打开聊天时，Agent `appId`、当前 Canvas project ID 与账户一致；聊天上下文显示同一项目而不冒出“默认工作区”；Agent 创建/更新节点后 UI 重新读取同一项目；其它 App 的项目和工具不可见/不可执行。
4. Chat/Canvas/Manual 共用 Workbench 四栏布局和标题栏，Canvas 路由不绕过 Workbench；漫剧共享画布提供唯一镜头关系编辑面板，媒体剪辑/导出和 3D 导演台继续从手动模式可达。
5. 既有 App 节点目录保持按 App 校验；新增/修改样式使用 Appearance/Canvas 设置，覆盖桌面、窄分栏、手机和短屏。既有数据文件不迁移、不删除。
6. 分批运行直接类型/回归/构建检查并在 ChatGPT 内置浏览器实页验收；记录路由、视口、交互、截图与未测边界。源码/构建、真实 Provider、浏览器、Daemon/桌面与帧时间分别报告。

## 分批实施与证据

1. 聊天项目定位：AI Video 工作区报告当前选中项目 ID/标题/版本；Agent Run 只在 `appId` 匹配时收到该短期提示，正文仍由领域 Owner 工具读取。完成；App Chat 不再给 AI 漫剧错误展示通用 workspace 项目选择器。
2. 共享 Canvas 数据适配：把 AI Video 项目、节点、素材、并发保存、生成任务映射到唯一共享 Canvas UI，同时保留 AI Video Owner、旧格式与项目 ID；连接画布聊天时把同一项目定位给 App-scoped Agent。完成并已构建。
3. App 模式与旧路由：Chat/Canvas/Manual 共用四栏外壳与标题栏；Canvas 外层右栏复用同一个 App Chat。AI 漫剧 `/normal` 保留领域手动功能，镜头关系编辑交给共享 Canvas；应用入口默认打开 App Chat。完成并已实页确认模式与项目切换。
4. 节点目录、Owner README 与剩余 App 边界：本轮完成 AI 漫剧节点/Owner 文档边界核对；其它 App 节点登记与运行验收仍按各自迁移状态推进，不把 Minecraft 许可、核心下载或启动能力伪装成通用画布执行器。

### 本轮已完成批次：聊天项目定位

- `AiVideoCanvasWorkspace` 在当前项目变化时只上报 AI Video Owner 的 `applicationId/projectId/title/updatedAt`。`ApplicationWorkspace` 按账户暂存此定位，切换到 AI 漫剧聊天时将它随本轮 `workspaceView` 发送。
- API 对字段做严格结构校验；Agent Loop 再按本轮 `appId` 裁剪不匹配的项目定位。系统提示明确该 ID 只用于选择领域 Owner 工具，不代表项目存在、工具能力或权限。未附加项目正文，也未把提示写入会话。
- 验证：`pnpm.cmd --dir apps/cli test -- tests/agent-workbench-context.test.mjs`（4/4 通过）；`pnpm.cmd --dir apps/cli typecheck`（通过）；`pnpm.cmd exec tsc --noEmit -p tsconfig.client.json`（通过）；真实 Provider 请求未发起。

### 本轮已完成批次：统一 Canvas 右栏及漫剧手动编辑收敛

- `ApplicationWorkspace` 将 `/apps/<app>/canvas` 放回共用四栏 Workbench，模式切换留在统一标题栏；Canvas 内层移除会造成空白的第二聊天 Dock，App Chat 由外层右栏唯一装配，继续读取 `canvas.agentPanelDefaultOpen`。无会话标题时 App 聊天页标题显示应用名；全局 `workspace` 仍显示“小鱼智能体”。
- AI 漫剧聊天只使用 AI Video 项目定位，不再沿用通用工作区项目选择器。手动页选中的 AI Video 项目定位也可作为从 App Chat 初次打开 Canvas 的回退项目；已有 Canvas 选择优先。聊天与共享 Canvas 使用同一 App/项目上下文；画布工具仍通过 AI Video Owner，项目正文没有复制进会话。
- `/apps/aivideo/normal` 的镜头编辑不再重复渲染一套 React Flow 空间画布，改为镜头清单、单镜头编辑与共享画布关系摘要/跳转。剧本、角色与场景档案、镜头图像/视频生成、媒体和时间线、导出、白模导演台均保留。
- 验证命令：`pnpm.cmd exec tsc --noEmit -p tsconfig.client.json`、`pnpm.cmd --dir packages/client/ui-workspace build`、`pnpm.cmd run build:web` 均通过；Web 构建 3903 modules，输出在根 `dist/apps/web` 与 `dist/packages`。构建报告 `cpp` 与 `DirectorDeskStage` chunk 超过 500 KiB；这不是运行时帧率证据。
- ChatGPT 内置浏览器实页：正式 Web 地址 `http://127.0.0.1:3000`。在 `1048×922` 与 `720×640` 检查三模式；720 宽度无文档横向溢出，收起右侧工具后手动页宽度恢复，镜头列表空态在窄容器中可读并可滚动。漫剧 Chat 标题/上下文显示 `AI 漫剧 / 漫剧项目 1`。手动→Chat→Canvas 往返后 Canvas URL 为 `/apps/aivideo/canvas/8b6eb40a-7cc5-4033-ba96-bc4f67effd4c`；Canvas 聊天栏显示实际欢迎内容，不再出现空白面板。镜头编辑、媒体/时间线、白模导演台在原项目均可达；项目当时为 0 个镜头/素材，验收未写入用户项目。截图证据为本轮内置浏览器实页截图输出。
- 性能证据：静态检查未引入新的订阅、轮询或无界数据增长；本轮未测真实帧时间。未覆盖手机设备、真实 Provider 生成、Daemon/桌面加载。视口工具已调用 reset；当前工具复位后的页面尺寸为 `720×640`。
- 最终产物与重启复核：补齐受影响包 README 后重新运行 `pnpm.cmd --dir packages/client/ui-workspace build` 与 `pnpm.cmd run build:web`；后者再次通过客户端 TypeScript 检查并构建 3903 个模块。`node scripts/runtime-build-state.mjs web` 返回 `[]`，`git diff --check` 通过。构建期间运行中的 Web 按版本保护显示了“需要重新启动”，按源码入口重启后在 ChatGPT 内置浏览器重新加载原 Canvas 项目 URL，确认画布与聊天恢复，不再停留在黑屏/重启提示。`720×640` 下右侧 AI 漫剧聊天可展开，显示当前应用和 `漫剧项目 1`；左侧同一项目显示剧本、时间线、导演台节点，页面可见内容没有被黑屏遮挡。验收仅切换了聊天侧栏，没有发送提示或修改项目/设置。Web 服务保留运行，供用户检查。

本合同仅将本轮已验收批次标为完成；其它 App 的专属手动面板、领域节点和 Provider/执行器能力仍依各 Owner 的实际登记与验收状态报告。

## 2026-10-28 最新工作模式确认

- 全局通用工作台是跨 App 的开发聊天与通用画布；业务 App 各自拥有 App-scoped 聊天、共享画布中的领域节点目录、以及 App 专属手动面板。
- AI 漫剧使用 `/apps/aivideo/ai-work`、`/apps/aivideo/canvas[/:projectId]` 与 `/apps/aivideo/normal` 三种模式。聊天与 Canvas 的外观和运行时保持共用；只有手动工作台及节点目录按领域不同。Chat/Canvas/Manual 共用 Workbench 四栏外壳和标题栏；Canvas 右栏复用唯一 App Chat，不在 Canvas 内再挂第二个聊天 Dock。
- 本轮采用最新三模式目标；前一批仅隐藏/归一漫剧手动入口的变更不视为功能完成，必须恢复可达并补齐统一画布的节点入口。不得迁移、复制或删除 AI Video/Canvas 项目、媒体、节点或设置；唯一 Owner 与认证/权限合同不变。黑屏及切换验收继续记录于 [画布顶栏与 AI 漫剧模式复测合同](canvas-toolbar-deduplication-20261028.md)。

## 2026-10-29 四栏共享样式与 Chat/Canvas 连续性复测

- 样式与上下文归属核对：全局 `/work` 与业务 App 共用 `ApplicationWorkspace` 和 `ResizableWorkbench` 四栏外壳。此前 Canvas 路由在装配时把外层 App ID 固定映射成 `workspace`，导致左侧项目/会话导航属于通用工作区，而 Canvas 与右侧聊天另用 URL 中的真实 App ID，形成串域。现已改为把 Canvas 路由的真实 App ID 传给统一工作区。另一个重复表面是 Canvas 内的 App Chat 自建外框，已改回标准 `module-context` 右栏壳；Canvas 专属 CSS 只调整正文的全高与溢出。领域手动面板和 Canvas 节点仍由各自 Owner 提供。
- Chat/Canvas 根因：`ApplicationWorkspace` 中两段重复 effect 在进入 Canvas 时都重设聊天面板默认开合，覆盖了刚才的用户操作。删除重复复位后，Chat→Canvas 由模式切换事件显式展开同 App 聊天；直接进入 Canvas 则使用设置中心 `canvas.agentPanelDefaultOpen`。Canvas 内手动收起只作用于当前画布视图，不改写设置中心偏好；本地 App 状态缓存按用户切换清理，并限制最多 32 个 App 项。
- 实页验收：ChatGPT 内置浏览器正式服务 `http://127.0.0.1:3000`，视口 `720×640`。AI 漫剧通过应用导航进入 `/apps/aivideo/ai-work`，切到 `/apps/aivideo/canvas` 后左侧项目/会话标题为“AI 漫剧”，画布显示“剧本 / 漫剧时间线 / 导演台”，右栏显示“AI 漫剧 / 当前项目对话”，输入上下文为“AI 漫剧 / 漫剧项目 1”。写作空间通过 `/work` 的应用与能力入口进入 `/apps/writing/ai-work` 与 `/apps/writing/canvas`；同一外壳显示写作聊天和“剧本 / 文本”领域节点。联机管理也从应用入口进入 Chat/Canvas，显示同一外壳、App 项目上下文和文本节点。Minecraft 从“游戏服务 → 进入 Minecraft → 聊天 → 画布”进入；首轮发现 Canvas 运行时报 `MinecraftWorkflowCanvas.js` 未装配，已在 Minecraft Client 模块入口登记该模块。重建后 `/apps/minecraft/canvas` 正常呈现共享自由画布与 Minecraft 聊天；“更多画布操作 → 工作流”也能装配 Minecraft 工作流画布，并显示真实空工作流状态。Minecraft 画布标题和聊天栏已显示“Minecraft 服务端”。四个 App 的 Chat/Canvas 外层结构相同，领域节点与助手上下文按 App 改变。未发送消息、创建工作流或修改项目/设置；浏览器只覆盖 `720×640`，没有重新覆盖桌面视口、真实 Provider/Daemon 执行、设备或帧时间。
- 本批使用现有 Canvas 设置 `canvas.agentPanelDefaultOpen`；未新增设置项或修改用户偏好。`pnpm.cmd exec tsc --noEmit -p tsconfig.client.json`、`pnpm.cmd --dir packages/client/ui-workspace build`、`pnpm.cmd --dir packages/client/ui-layout build`、`pnpm.cmd --dir packages/client/ui-minecraft build` 与 `pnpm.cmd run build:web` 均通过；Web 构建转换 3903 个模块，产物只写入根 `dist/apps/web` 和 `dist/packages`。`node scripts/runtime-build-state.mjs web` 返回 `[]`，`git diff --check` 通过。构建提示 `cpp` 与 `DirectorDeskStage` chunk 超过 500 KiB，不构成帧时间证据；未运行测试套件。
