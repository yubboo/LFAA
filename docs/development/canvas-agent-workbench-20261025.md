# LFAA 系统级画布 2.0（即梦式画布 + Agent 协作，2026-10-25 第三轮）

日期：2026-10-25
状态：实施中
前序：[`docs/development/infinite-canvas-20261025.md`](infinite-canvas-20261025.md)（MVP 第一轮）、上一轮临时合同 `dist/.tmp/canvas/CONTRACT2.md`（系统级共享画布 v2，工作树内未提交）。本轮在 v2 数据/API 基础上继续，不推倒重来。

## 1. 用户问题与目标

用户认为当前 `/canvas`（图四）不符合预期，要求把画布做成 LFAA 系统核心能力，而不是独立应用：

- 无限画布节点编排、拖拽、连线、工程导入导出；图片/视频等素材节点与 @ 素材引用；图像、视频、全景、画质增强等生成工作流；可配置的大模型与 AI 助手；Electron Windows 桌面端；即梦 CLI、本地语音与第三方 API 接入。
- 节点/面板能力：文本、视频、图片、音频、时间线、主体、导演工具箱、导演台、资产库、上传、剧本生成、智能剪辑。
- 交互参考即梦 AI（生成/画布切换，图一红框）、libtv、Magine：深色沉浸无限画布、左侧竖向工具轨、点阵网格、浮层工具条、空态“双击画布 / 创建节点”。
- Agent：小鱼 agent、画布 agent（以及后续我的世界专属 agent）都要能使用画布；多 agent 协作干活，画布与系统深度绑定。

本轮交付“系统级画布 2.0”可验收批次；不把未接入能力做成按钮或假结果。

## 2. 本轮交付批次

- **A 数据与生成（canvas-core）**：画布 Owner 增加音频素材、生成节点数据引用校验；新增 canvas 生成编排 Owner（复用既有 LLM/设置/凭据 Owner），提供真实图片生成与视频任务 API；全景按 2:1 图像生成并在文案上如实标注，画质增强没有既有 Owner，保持“未接入”说明与不可用状态。
- **B 客户端视觉与交互（canvas-ui）**：补齐缺失的 `CanvasHome.tsx`（当前 Workbench 已注册但文件不存在，构建会失败），重做 `/canvas` 首页与 `/apps/<app>/canvas[/:projectId]` 工作区为即梦式沉浸画布：生成/画布切换、左侧工具轨（文本/图片/视频/音频/时间线/主体/导演工具箱/导演台/资产库/上传）、节点卡片与连线、@ 素材引用、生成节点真实调用、资产库、导入导出、响应式与主题。
- **C Agent 与人格（canvas-agent）**：新增 `packages/canvas/tool-canvas` 画布工具包，让小鱼直接读写画布；人格正文登记画布领域；新增“画布导演”专家，支持多 Agent 协作；工具结果必须来自 Canvas Owner 真实返回。
- **D 设置中心（canvas-settings）**：新增 `canvas` 设置类与“画布”设置分区（默认模式、网格、吸附、小地图、Agent 面板默认展开），含共享类型/默认值、服务端校验与持久化、设置页控件、映射与回归；生成模型继续复用既有图片/视频生成设置，不复制第二套模型配置。
- **E 装配与验收（Lead）**：bundle 装配、工作区同步、包职责登记、类型/构建、隔离服务 + 真实浏览器 Playwright 验收、文档记录。

## 3. 本轮明确不实现（不得伪装）

- 即梦 CLI、本地语音、第三方 API 的专用适配器（没有已核实 Owner/许可边界前不写死流程）。
- 画质增强/超分（没有既有增强 Owner）、真正的全景球面渲染、视频成片合成/智能剪辑导出（没有已核实的媒体处理 Owner）；界面必须如实显示“未接入”原因，不显示假成功。
- Electron 安装包重构建、macOS/Linux 包、正式发布、真实 Provider 计费验收（可做配置核对与构建检查，必须标注未实测）。
- 我的世界专属 Agent 的新建身份：继续复用现有 expert.minecraft-hosting 与 subagent 机制，不新增第二套 Agent 身份。

## 4. Owner、数据与权限边界

| 事项 | 唯一 Owner | 说明 |
|---|---|---|
| 画布项目/节点/连线/视口/素材 | `packages/canvas/canvas`（`lfaaCanvas`） | 账户 + App 双隔离；`formatVersion 2`；原子写、409 并发、素材魔数/MIME、符号链接拒绝保持不变 |
| 认证 API | `packages/api/canvas-controller` | 只做协议适配、Joi 校验、错误映射；不持有文件 |
| 画布生成编排 | 新增 `packages/canvas/canvas-generation`（`lfaaCanvasGeneration`） | 复用 `lfaa-llm` 的 `generateProviderImage`/Ark 视频任务、`lfaa-settings` 的 `imageGeneration*`/`videoGeneration*`、`lfaa-credentials`；不新写 Provider 协议，不写死成功结果 |
| 画布 UI | `packages/client/ui-workspace` 的 Canvas* 文件 | 共享 Web/Electron；只做展示与交互 |
| 客户端 API | `packages/client/connection/src/api.ts` canvas 段 | 类型与请求函数 |
| 路由/外壳 | `packages/client/ui-layout/src/Workbench.tsx` canvas 段 | `/canvas`、`/apps/<app>/canvas` |
| Agent 工具 | 新增 `packages/canvas/tool-canvas` | 通过 `lfaa-tools` `makeTool`；权限/审批沿用 `permissions.mode`，不新增第二套权限 |
| 人格/专家 | `packages/preset/persona`、`packages/preset/agent-preset` | 只登记已真实接通的画布工具 |
| 设置 | `packages/util/values/src/settings-contract.ts` + `packages/settings/settings` + `packages/client/ui-settings` | 服务端权威校验与持久化 |

权限：只使用设置中心三种权限模式（请求审批/替我审批/完全访问）；画布 API 与工具不另设确认或白名单。认证、账户/App 隔离与参数校验留在服务端 Owner。

## 5. 数据与 API 合同

### 5.1 素材类型

在现有 PNG/JPEG/WebP/MP4/WebM 基础上增加音频：`audio/mpeg`、`audio/wav`、`audio/ogg`（文件头 MP3 ID3/帧同步、RIFF WAVE、OggS），单文件上限 32 MiB。节点 `data.assetId`、`data.assetIds[]`、`data.references[].assetId` 必须引用项目内已有素材；越界、跨项目、非字符串一律 400。

### 5.2 节点类型与数据（客户端注册，服务端只校验类型模式与有界 JSON）

- `text`、`note`：`data.text`
- `image`、`video`、`audio`：`data.assetId`、`data.assetName`
- `generation`：`data.generation = { kind: "image"|"video", prompt, status: "idle"|"running"|"succeeded"|"failed", assetId?, error?, aspectRatio?, durationSeconds?, taskId?, startedAt?, finishedAt? }`
- `subject`：`data.subject = { name, kind: "character"|"location"|"prop", description, assetIds: string[] }`
- `timeline`：`data.timeline = { clips: Array<{ nodeId, assetId?, startSeconds, durationSeconds, title }>, durationSeconds }`
- `director-toolbox`：`data.preset = { name, promptSuffix, aspectRatio? }`
- `director-desk`：`data.desk = { shotNodeIds: string[] }`
- `script`：`data.script = { title, body, status: "draft"|"ready" }`
- `asset`（资产库引用）、`upload`（上传占位/结果）可复用 image/video/audio 数据形状。
- 所有节点数据 ≤64 KiB；文本 ≤20,000 字符；数量/坐标/尺寸沿用 `CANVAS_LIMITS`。

### 5.3 生成 API（全部 requireAuthentication，错误映射 401/400/404/409/422/501）

- `POST /apps/:applicationId/canvas/projects/:projectId/generate/image`
  body: `{ expectedUpdatedAt, nodeId?, prompt, aspectRatio?: "1:1"|"4:3"|"3:4"|"16:9"|"9:16"|"2:1", referenceAssetIds?: string[] }`
  → `{ project, asset: { assetId, name, mimeType, bytes } }`；服务端校验模型账户/模型/密钥、提示词与参考图；成功后把结果原子写入项目素材并在 `nodeId` 存在时更新该节点 `data.generation`（status=succeeded、assetId）。失败不写任何可见结果，返回真实原因。2:1 仅表示全景比例图像，界面文案不得写“真全景渲染”。
- `POST .../generate/video` body `{ expectedUpdatedAt, nodeId?, prompt, durationSeconds?, aspectRatio?, referenceAssetIds? }` → 启动/提交 Ark 任务，节点 status=running、taskId 写入 `data.generation`；可用时返回 `{ project }`。
- `POST .../generation/:nodeId/refresh`、`POST .../generation/:nodeId/cancel`：刷新/取消；成功完成后才落素材并置 succeeded；失败置 failed + 真实 error。
- 生成编排必须从 `lfaa-settings` 读取 `imageGenerationMode/AccountId/ModelId/LocalModelId`、`videoGeneration*` 与超时；账户必须属于当前用户且有密钥。未配置时返回 400 可读中文原因，前端引导到设置中心。
- 视频/本机模型适配如复用条件不满足，接口可显式 501“本轮未接通”，但 UI 不得显示成功，也不得写死演示结果。

### 5.4 现状修复

- `CanvasNodeCards.tsx` 调用 `canvasAssetUrl(applicationId, projectId, assetId)` 参数错误必须随 UI 重做修复。
- `CanvasHome.tsx/.css` 缺失必须补齐；`ui-workspace/src/client/index.ts` 已注册，不得再引用不存在的模块。

## 6. 客户端 UI 合同（即梦式）

- `/canvas` 首页：深色沉浸背景（主题可切换浅色）、品牌/欢迎语“你好，今天想要创作什么？”、顶部/中部 **生成 | 画布** 分段切换（对应图一红框）、提示词输入 + @ 素材引用、真实最近项目（跨 App 显示 App 标签）、App 快捷入口、空态与错误态；生成模式创建项目并写入生成节点后进入工作区，画布模式创建空白画布；不伪造项目/生成结果。
- `/apps/<app>/canvas[/:projectId]` 工作区：
  - 全幅画布 + 点阵网格 + 平移缩放 + Shift 框选 + Ctrl/⌘ 多选 + 连线 + Delete + 撤销/重做 + 小地图（受设置控制）+ 底部缩放条；
  - 左侧浮层工具轨：文本/图片/视频/音频/时间线/主体/导演工具箱/导演台/资产库/上传；
  - 顶部浮层：返回本 App / 画布首页、项目名切换、保存状态、**生成 | 画布** 切换、对话抽屉开关、设置入口；
  - 生成模式：生成工作台（类型、提示词、@ 参考、比例/时长、真实生成/重生成按钮、账户/模型未配置真实引导）；
  - 对话抽屉：优先复用 `ui-chat` 现有 `AiWorkChat`；若其 props/会话机制不可嵌入，则提供真实会话入口与画布上下文说明，禁止伪造对话与结果；
  - 右侧资产库抽屉：图片/视频/音频缩略、上传、插入画布、@ 复制、删除引用检查；
  - 节点卡片：文本/备注/图片/视频/音频/生成/主体/时间线/导演工具箱/导演台/剧本/资产，编辑内容随项目保存；
  - 工程导入/导出、Ctrl+S、409 冲突提示、离开未保存拦截保持；所有请求带 applicationId；
  - 响应式：≥1440、1024、768、390 宽与 ≤480 高可操作；CSS Grid/Flex；禁止 inline-block 承担布局；新增 CSS 变量必须带中文注释；尊重 reduced motion 与外观主题/强调色/字体。
- 所有视觉效果用设置中心外观令牌；不写死主题色。深色画布表面使用主题变量派生，浅色主题必须可读。

## 7. Agent 合同

- 工具（`packages/canvas/tool-canvas`，全部 `coreManaged: true`，权限沿用现有模式）：
  `canvas_list_projects`、`canvas_read_project`、`canvas_create_project`、`canvas_add_node`、`canvas_update_node`、`canvas_remove_node`、`canvas_connect_nodes`、`canvas_disconnect_nodes`、`canvas_list_assets`、`canvas_generate_image`。
  必须显式传 `applicationId`（来自 `APPLICATION_IDS`）与 `projectId/expectedUpdatedAt`，返回真实项目摘要/节点/素材；生成工具只调用 canvas-generation，不伪造成功。
- 人格：在 `packages/preset/persona` 真实领域地图加入“画布”（工具名 + 能力边界），版本号递增；更新 `apps/cli/tests/xiaoyu-persona-core.test.mjs`。画布是系统能力，多个 App 共用，不新增 ApplicationId。
- 专家：在 `packages/preset/agent-preset/src/builtin-catalog.ts` 增加“画布导演”专家（真实工具清单 + 工作方法：先读项目→规划节点→执行生成→回报真实结果），供小鱼和子 Agent 调用；多 Agent 协作复用既有 subagent 工具，不新建身份/权限。

## 8. 设置中心合同

新增 `UserSettings.canvas` 与 `SettingsCategory "canvas"`：

```ts
interface CanvasSettings {
  defaultMode: "generate" | "canvas";   // 打开画布默认模式，默认 "generate"
  gridStyle: "dots" | "lines" | "none"; // 画布网格，默认 "dots"
  snapToGrid: boolean;                  // 拖动吸附，默认 false
  showMiniMap: boolean;                 // 小地图，默认 true
  agentPanelDefaultOpen: boolean;       // 打开工作区默认展开对话面板，默认 false
}
```

- 共享类型/默认值在 `settings-contract.ts`；Settings Owner 补值/校验/持久化；设置页“画布”分区提供控件与保存；导航/搜索目录登记；生成模型不新增重复配置，继续使用既有图片/视频生成设置。
- 画布 UI 必须读取这些设置并即时生效；不得在组件里写死默认行为绕过设置。
- 回归：默认值、非法值拒绝、保存/回读、旧设置补值兼容。

## 9. 性能、安全、可维护性

- 节点卡片 memo；拖拽/缩放/保存状态不重渲染全画布；资产缩略图懒加载；无隐藏页轮询，视频任务刷新只在面板可见且单请求进行中；卸载清理计时器/监听器/请求。
- 所有写操作经 Owner 认证与账户/App 隔离；生成账户必须属于当前用户；参考图仅限本项目素材；不泄露密钥。
- 复用现有 `ui-chat`、`lfaa-tools`、`lfaa-llm`、`lfaa-settings`、`lfaa-credentials`，不新建第二套会话/身份/权限/Provider 协议。

## 10. 验证计划

1. 回归：`apps/cli/tests/canvas-owner.test.mjs`（扩展音频/引用/App 隔离）、新增 `canvas-generation` 校验与失败回归、新增 `canvas-tools.test.mjs`、新增 canvas 设置回归、更新人格回归。
2. 包构建：`lfaa-canvas`、`lfaa-api-canvas-controller`、`lfaa-canvas-generation`、`lfaa-canvas-tool-canvas`、`lfaa-client-ui-workspace`、`lfaa-client-ui-settings`、`lfaa-settings`。
3. 全仓：`pnpm run typecheck`、`pnpm run sync:workspace` + `check:workspace`、`pnpm run build:web`、`pnpm run build`（Lead 串行执行）。
4. 浏览器实页：以当前源码构建后在隔离数据（`dist/.tmp/canvas2-acceptance/`）启动正式 Web（127.0.0.1:3001），用本机 Chrome + playwright-core 截图/交互：/canvas 首页生成/画布切换、新建画布、工具轨、添加节点、连线、保存回读、@ 素材、生成未配置真实提示、设置中心画布分区、1440×900 与 390×844/短屏。
5. 不声称未运行的真实 Provider、Electron 安装包、桌面 WebView、帧时间通过。

## 11. 预期文件清单

新增：`packages/canvas/canvas-generation/**`、`packages/canvas/tool-canvas/**`、`packages/client/ui-workspace/src/CanvasHome.tsx`、`canvas-home.css`、`apps/cli/tests/{canvas-generation,canvas-tools,canvas-settings}.test.mjs`、本文档。
修改：`packages/canvas/canvas/src/index.ts`(+README)、`packages/api/canvas-controller/src/index.ts`(+README)、Canvas UI/CSS、`packages/client/connection/src/api.ts`、`packages/client/ui-layout/src/Workbench.tsx`、`packages/client/ui-workspace/src/client/index.ts`、`packages/preset/persona/**`、`packages/preset/agent-preset/src/builtin-catalog.ts`、`packages/util/values/src/settings-contract.ts`、`packages/settings/settings/**`、`packages/client/ui-settings/**`、`packages/bundle/web-app/{cordis.patch.yml,package.json}`、`scripts/package-responsibilities.mjs`、`docs/PROMPTS.md`、`docs/系统总体架构.md`（如能力事实变化）、`tsconfig.client.json`/`tsconfig.host.json`/`docs/harness-packages.*`（生成物）。

## 12. 工作树约定

- 工作树已有大量未提交改动（含画布 v2、附件、人格、测试等），不得回退、清理或覆盖无关改动。
- 构建/同步/启动服务由 Lead 串行执行；teammate 只跑自己包的构建与定向 node 测试，避免并发写 `dist/` 和 `dist/apps/web`。
