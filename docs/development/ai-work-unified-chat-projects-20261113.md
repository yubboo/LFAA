# LFAA-AI-WORK-UNIFIED-CHAT-PROJECTS-20261113

## 用户目标

将 `/work` 作为唯一通用聊天入口。用户从 Minecraft、AI 漫剧、写作等 App 打开聊天时进入同一通用会话；小鱼依据用户目标选择当前 Runtime 已登记的领域工具。领域 App 的画布、手动编辑器和数据仍归原 Owner。AI Work 项目就是用户可选的真实本机项目文件夹：新会话可继续使用“默认工作区”，也可由用户选择或让小鱼按用户目标命名并创建项目文件夹；创建后当前会话归入项目，项目文件工具在该项目目录内工作，后续会话可从项目列表查看。

## Owner、设置、数据与权限

- Web/Desktop 共享聊天、路由与会话选择：`packages/client/ui-layout`、`packages/client/ui-workspace`、`packages/client/ui-chat`；会话事实和项目归属：`packages/core/session`。
- 领域工具发现与统一执行：`packages/core/tools`、`packages/core/agent-loop`；实际业务数据仍由已登记工具的领域 Owner 持有。
- 项目目录/应用关联：`packages/workspace/workspace`；本机真实文件夹：`packages/host/project-files`；认证项目 API：`packages/api/workspace-controller`。
- 复用当前模型、项目选择、默认工作区和 `permissions.mode` 配置，不新增设置、不改变用户偏好；工具可见范围、认证、参数校验和三种权限模式不绕过现有 Permission Owner。

## 允许范围与禁止范围

- 允许：将 App 的聊天别名收敛至 `/work`；使通用 Work 能发现当前 Runtime 已登记的领域工具，同时保留扩展开关与工具 Owner 校验；添加一个使用现有 Workspace/Project Files/Session Owner 的项目创建并绑定工具；补充直接回归和必要 README/索引。
- 允许：为兼容已有画布，在同一 `/work` 会话中保留随当前画布或项目传入的领域上下文。
- 追加边界：`/work` 不显示画布模式切换或画布项目按钮；系统级画布从 `/canvas` 进入，并按所选 App 加载其登记节点目录。通用 Work 会话仍可从 App 画布侧栏复用，但这不把画布嵌入通用 Work。
- 禁止：另建聊天、Session、项目目录或权限系统；复制、搬迁、批量改写或删除已有会话/项目；把领域编辑器迁入通用聊天；使用关键词流程替代模型选择工具；引入假项目或假执行结果。

## 可观察验收

1. 从 App 的聊天入口进入 `/work`，新建聊天与会话历史均使用 `appId=workspace`；通用 Work 不呈现画布切换或画布项目入口。系统级 `/canvas` 仍可选择 App 并打开该 App 画布，画布侧聊天引用同一通用会话。
2. `workspace` 的工具目录包含实际已登记且可用的领域工具（包括 AI Video）；未装配/未登记工具不可伪装成可用，扩展开关、角色过滤和统一 Permission Owner 保持有效。单一 App 工具在其所属业务上下文执行。
3. 用户可通过现有 UI 选择已有项目。小鱼在确有长期项目需要时，可使用模型命名的专用工具创建真实文件夹，登记成 Workspace 项目并将当前空闲或活动中的通用会话归入该项目；创建失败不得回报成功。没有创建时，默认工作区关联行为保持不变。
4. 运行项目/Session/工具范围相关定向回归、受影响包构建和 Web 构建；用 ChatGPT 内置浏览器对 `/work` 及一个 App 入口做桌面和相关窄视口实页检查。真实 Provider 生成、桌面安装包、长时帧时间未实际执行时如实标为未测。

## 实施记录

- 状态：统一聊天与可选工作区项目已实现；AI 漫剧单次视频测试因领域项目清单错误未提交 Provider 任务。
- 实现：App 的 `/ai-work` 聊天别名统一进入 `/work`；通用会话按 `appId=workspace` 加载，画布侧聊天复用该会话。Run 可发现当前运行时实际登记的领域工具，单 App 工具仍以其所属 App 上下文执行并通过原 Permission Owner。
- 画布边界：通用 Work 的画布模式选择与“选择工作区画布项目”按钮已收起；App 画布聊天仍保留与当前 App 画布项目关联的入口。Canvas Runtime 和节点菜单继续读取 `CANVAS_NODE_KINDS_BY_APPLICATION`，AI 漫剧领域节点保持可用。Minecraft/Steam 的专属游戏配置、脚本节点尚未实现。
- 项目：增加由模型按需调用的 `workspace_create_project`，在默认工作区旁创建真实文件夹、登记 Workspace 项目并绑定当前活动会话；成功后刷新项目和会话侧栏。用户也可继续从项目栏选择已有工程；不需要持久工程时，新会话保留在默认工作区。
- 代码与合同文件：`packages/util/values/src/application-id.ts`；`packages/client/ui-workspace/src/ApplicationWorkspace.tsx`；`packages/client/ui-chat/src/AiWorkChat.tsx`；`packages/core/tools/src/business-tools.ts`、`project-tools.ts`、`tool-contract.ts`、`packages/core/tools/package.json`；`packages/core/agent-loop/src/execute-turn.ts`；`packages/core/session/src/sessions.ts`；`packages/workspace/workspace/src/index.ts`；`packages/api/workspace-controller/src/index.ts`；对应包 README；`docs/系统总体架构.md`、`docs/PROMPTS.md`、本合同；`apps/cli/tests/ai-work-unified-chat-projects.test.mjs`。保留这些文件中与本任务无关的既有工作区改动。
- 验证：`apps/cli/tests/ai-work-unified-chat-projects.test.mjs` 3/3 通过；CLI typecheck、Client TypeScript 检查、core/tools、core/agent-loop、ui-workspace、Web 和 Control Plane 构建通过；`git diff --check` 通过。`package-owner-lazy-capabilities.test.mjs` 4/5 通过，唯一未通过项在真实 Agent fixture 发出工具前因 OpenAI Provider 无法连接而中断。
- 实页：官方 Web 服务 `http://127.0.0.1:3000/work`；旧入口 `/apps/aivideo/ai-work` 实际导航到 `/work`。桌面 1623×1244 下会话明确归在“默认工作区”；430×840 下聊天、输入框可用，项目栏可打开查看 2 个项目并可关闭返回聊天。验收后恢复默认视口、项目栏和工具栏显示状态。
- 真实视频测试：Admin 在通用 Work 中一次提交任务意图；运行时确实发现漫剧工具并读取到 `doubao-seedance-2.0` 与 1 秒配置，但新建/列出漫剧项目均返回“AI 漫剧项目清单缺失”，`GET /api/ai-video/canvases` 同时返回 500。工具在 Provider 创建任务前失败，所以没有视频任务或成片；未重试、未生成图片。测试后设置中心时长已保存恢复为原值 5 秒，视频模型选择未变。漫剧项目存储错误需要作为独立 Owner 缺陷继续排查。
- 本次复用了现有模型选择、默认/选中 Workspace 项目、`permissions.mode`，以及用于单次验证的 `videoGenerationModelId` / `videoGenerationDurationSeconds`；未新增设置项。旧 App 专属历史会话未批量迁移或删除，Web/Desktop 之外的安装包和完整设备矩阵未验。

## 画布边界增补（2026-11-13）

- 修改：`/work` 不再把 `workspace` 解释成可切换 Canvas 的 App；聊天输入区不再传入画布打开动作；通用欢迎文案改为引导长期任务关联项目文件夹。App 画布侧聊天仍绑定当前 App 的画布项目入口。架构文档明确 `/canvas` 是系统级入口，画布节点按所选 App 的登记目录呈现。
- 现有节点范围：AI 漫剧画布已展示剧本、镜头、角色/场景、时间线、导演台、资产库等领域工具；Minecraft/SteamCMD 当前节点目录只有文本和备注，游戏配置/脚本节点尚未接入，不宣称已实现。
- 验证：`client-app-workspace-four-column.test.mjs` 相关两项通过；ui-chat、ui-workspace 包构建和正式 Web 构建通过；`git diff --check` 通过。该文件全量运行时 8 个其他现有源码断言未匹配当前工作区实现，未作为本次画布断言失败。
- 内置浏览器：`/work` 管理员桌面视口 1623×1244 下没有画布模式切换或画布项目按钮，欢迎文案与项目文件夹目标一致；`/canvas` 可见 6 个 App 画布入口。打开现有 AI 漫剧画布路由后，工具轨显示剧本、镜头、角色/场景、漫剧时间线、导演台和资产库，但 Canvas 项目读取返回“服务器内部错误”，没有载入项目内容；与先前一秒视频测试发现的 AI 漫剧项目清单/API 500 问题相符，未创建或修改画布项目。窄视口、本机视频模型和桌面安装包未在本次复验。
- 本轮没有新增或修改设置中心配置；沿用现有 Canvas 节点目录、App 选择、外观设置及权限模式。

## App 与通用 Work 会话联动增补（2026-11-13）

- 用户从 App 聊天入口进入 `/work` 时，路由归一必须携带来源 App；Minecraft/Minecraft Canvas 截图显示旧链路只保留 `appId=workspace`，Composer 的项目归属无法代表当前领域 App。
- 通用会话仍统一使用 `appId=workspace`、Workspace 项目文件夹和同一聊天历史；新增独立 `contextApplicationId` 会话上下文，支持通用态/领域 App 切换、会话历史恢复与 Session Owner 持久化。
- 每次 Run 把当前领域上下文传给 Agent；系统提示清楚说明这是用户当前工作领域的目标背景，不是权限/授权，也不强制某个工具或固定流程。能力目录与执行继续遵循统一 Agent Loop 和 Permission Owner。
- UI 在 Composer 明示当前领域 App 并可切换；从 App 手动模式进入时预选该 App；从 App Canvas 侧聊进入时使用当前 Canvas App；新会话与既有会话都能继续在默认 Workspace 或用户选定项目文件夹工作。
- 验收需覆盖来源 App 路由、刷新与会话重开后的领域上下文、领域切换后 Run 提示上下文、工具权限范围保持不变；沿用模型、项目和 `permissions.mode` 配置，不新增设置项。
