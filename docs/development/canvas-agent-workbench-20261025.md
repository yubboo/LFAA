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

## 13. 实施记录（2026-10-25 完成）

### 13.1 批次结果

- A（canvas-core）：`packages/canvas/canvas` 增加音频素材（MP3/WAV/OGG 文件头、32 MiB）、`data.assetId/assetIds/references` 引用校验、内部 `commitAsset`/`updateNodeData`；新增 `packages/canvas/canvas-generation`（`lfaaCanvasGeneration`）与画布生成 4 条认证路由，复用 `lfaa-llm`、`lfaa-settings`、`lfaa-credentials`；图片生成与视频任务编排真实落素材，本机模型/画质增强显式 501，未配置 400，Provider 失败 422。
- B（canvas-ui）：新增 `CanvasHome`，重写 `CanvasWorkspace`、`CanvasNodeCards`、`CanvasAssetPanel`、`CanvasProjectTransfer` 与两份 CSS；实现生成|画布、左侧工具轨、12 类节点、@ 素材引用、生成工作台、资产/对话抽屉、导入导出、409、撤销重做、小地图、窄屏与短屏。缺失的 `CanvasHome` 构建阻断已消除。
- C（canvas-agent）：新增 `packages/canvas/tool-canvas` 的 10 个 `canvas_*` 工具（真实 Owner 读写、409 透传、生成服务可选装配、生成结果必须已落盘）；小鱼人格正文 1.2.0 增加画布领域；`expert.canvas-director` 登记在 `domain-experts`；多 Agent 复用既有 subagent。
- D（canvas-settings）：`UserSettings.canvas` 与 `SettingsCategory "canvas"`、严格 schema/默认值/旧账户补值/原子持久化、设置页“画布”分区、菜单与 Agent 分类；生成模型继续复用现有图片/视频生成设置。
- E（Lead）：bundle 装配、包职责注解、工作区同步、集成修复（`tool-canvas` 的 `exactOptionalPropertyTypes` 类型、新节点 2×2 级联避免缩放后重叠）、构建与浏览器验收、本文档与架构/索引更新。

### 13.2 设置中心配置

新增并使用：`canvas.defaultMode`（默认 `generate`）、`canvas.gridStyle`（默认 `dots`）、`canvas.snapToGrid`（默认 `false`）、`canvas.showMiniMap`（默认 `true`）、`canvas.agentPanelDefaultOpen`（默认 `false`）。生成使用既有 `imageGenerationMode/AccountId/ModelId/LocalModelId`、`videoGeneration*`、`requestTimeoutSeconds`；继续消费 Appearance 主题/强调色/字体/对比度/减少动态效果与背景，不复制第二套模型配置，不重置既有偏好。

### 13.3 实际验证

| 检查 | 命令/方式 | 结果 |
|---|---|---|
| 定向回归 | `cd apps/cli; node --import tsx --import ./register-package-loader.mjs --import ./tests/isolated-test-environment.mjs --test tests/canvas-owner.test.mjs tests/canvas-generation.test.mjs tests/canvas-tools.test.mjs tests/canvas-settings.test.mjs tests/xiaoyu-persona-core.test.mjs tests/agent-settings-tools.test.mjs tests/settings-contract.test.mjs` | 26 pass / 0 fail |
| 类型检查 | `pnpm run typecheck` | exit 0 |
| 工作区 Gate | `pnpm run sync:workspace`、`pnpm run check:workspace` | 219 个包通过 |
| 构建 | `pnpm run build:control-plane`、`pnpm run build:web` | exit 0；Web 产物含 CanvasHome/CanvasWorkspace 新 chunk |
| 浏览器实页 | 隔离 `LFAA_HOME/LFAA_DATA_DIR=dist/.tmp/canvas2-acceptance/`、`http://127.0.0.1:3001`、Chrome + playwright-core（1440×900 深/浅色、1024×560、390×844） | 登录、/canvas 首页生成|画布切换、打开/创建项目、9 节点保存+刷新回读（API 200）、初始视口节点全部在可视区、生成面板回填节点提示词、未配置生成显示服务端真实错误与设置入口、Agent 对话抽屉 360×724 可见、资产抽屉、设置“画布”分区保存后首页模式即变、窄屏两行工具栏+折叠生成条+无横向溢出、短屏折叠面板 |
| 差异检查 | `git diff --check` | 通过 |

浏览器截图与脚本：`dist/.tmp/canvas2-acceptance/shots3/`、`accept3.mjs`（临时验收证据，不属于产品运行树）。

### 13.4 未验证与明确边界

- 真实 Provider 图片/视频计费调用未执行（隔离 Home 无生成账户；回归用注入假函数）；真实 Agent/模型在会话中选择 `canvas_*` 工具的端到端循环未执行。
- Electron 安装包/桌面 WebView 未在本轮重建与实机验收；帧时间/大画布性能未测。
- `AiWorkChat` 未内嵌到画布（其 props 依赖完整会话状态），画布对话抽屉是真实 `/work` 入口 + 画布上下文说明；不伪造对话。
- 画质增强/超分、真全景球面渲染、视频成片合成/智能剪辑导出没有既有媒体 Owner，界面禁用并注明“未接入”；即梦 CLI、本地语音、第三方 API 专用适配器仍未接入。
- Appearance 只实测深色与浅色（跟随系统）；自定义壁纸/插件画布归属、不同字号组合未在画布工作区逐一实页复验。

## 14. 图二参考的工作区视觉精简（2026-10-25）

### 14.1 目标与批次边界

用户提供 `codex-clipboard-520f87d4-c551-46ae-be8e-a0d66537280f.png` 为当前界面、`codex-clipboard-6662819b-4e75-4aca-97ed-decf80df29f2.png` 为参考，要求将画布工作区收敛为参考图的沉浸式布局。当前图未能辨认出红色标框，本批按两图差异覆盖工作区壳层：紧凑顶部操作区、图标工具轨、全屏点阵画布及低干扰空态。

- **入口与唯一 UI Owner：** `/apps/<app>/canvas[/:projectId]`，`packages/client/ui-layout/src/Workbench.tsx` 装配；共享实现位于 `packages/client/ui-workspace/src/CanvasWorkspace.tsx` 与 `canvas-workspace.css`，供 Web/Desktop 共用。
- **数据与 API Owner：** 画布项目、节点、连线、视口、素材仍由 `packages/canvas/canvas` 持有；认证协议仍由 `packages/api/canvas-controller` 提供。本批不创建、重命名、导入、保存或删除项目，不改数据合同。
- **权限：** 所有现有动作保留原调用链和 Permission Owner；验收只观察页面、切换临时显示模式和打开/关闭非写入菜单，不触发生成或持久化操作。
- **设置中心配置：** 沿用 `canvas.defaultMode/gridStyle/snapToGrid/showMiniMap/agentPanelDefaultOpen` 与既有 Appearance 主题、强调色、字体、字号、对比度、壁纸/遮罩/模糊和减少动态效果。主题继续跟随设置中心，不写入或重置账户偏好；不新增配置字段。
- **实现边界：** 使用已登记图标包并在 `lfaa-client-ui-workspace` 直接声明；工具保留可访问名称与 tooltip。移除重复展示的独立标题编辑框时，重命名继续通过“更多”菜单的现有操作提供。Undo/redo/save/chat/settings/project/app navigation/import/export 等真实功能不得删除或伪装；参考图中的会员、头像、搜索/历史入口不属于本 App 已接入能力，不新增假控件。
- **性能与响应式：** 保持单一 ReactFlow/Background/状态订阅；不新增轮询或观察器。基于画布容器断点检查宽屏、窄屏和短屏，确保工具滚动、主操作可达且无横向溢出。

### 14.2 验收条件

1. 顶栏更紧凑，项目名称只在项目切换控件中呈现；必要操作可从现有菜单或图标按钮到达并保留原事件。
2. 左侧工具轨只呈现图标，鼠标提示、键盘焦点和辅助技术名称仍能识别每项功能；使用已有图标库而非文本字符伪图标。
3. 空画布提示降为低干扰的中央单行提示，双击创建、工具栏添加和可见的新建入口仍可用；画布继续使用设置指定的点阵/网格。
4. 当前主题、强调色、字体字号、模糊/遮罩和减少动态效果均来自设置中心；浅/深主题均可读，不改用户偏好。
5. 内置浏览器实页检查目标 App 路由的桌面视口、窄屏及短屏；记录截图、真实交互结果、直接相关回归/构建结果和未测边界。

### 14.3 实施与验收记录

#### 实施结果

- `CanvasWorkspace.tsx` 使用 `@ant-design/icons` 的工具图标与顶部操作图标；顶栏删除重复标题输入，将返回本 App、画布首页、App 切换和重命名留在“更多”菜单。项目切换、保存状态、生成/画布、撤销/重做、对话、设置、导入/导出等真实操作均保留。
- 桌面左轨改为垂直居中图标浮岛；窄屏变为底部横向可滚动工具轨。空画布提示收敛为中央“ 双击画布 / 创建节点 ”短提示；React Flow 点阵改用画布主题令牌，24% 正文色混合透明度，浅色/深色随设置中心主题变化。
- 新增 `@ant-design/icons@5.6.1` 为 `lfaa-client-ui-workspace` 直接依赖，锁文件已同步。设置仍使用既有 `canvas.defaultMode/gridStyle/snapToGrid/showMiniMap/agentPanelDefaultOpen` 与 Appearance 主题、强调色、字体字号、对比度、壁纸/遮罩/模糊和减少动态效果；不改账户偏好。本账户当前为浅色 Appearance，因此本批实页只在浅色下验收；暗色由相同共享令牌控制，未在本批切换账户主题复验。

#### 实际验证

| 检查 | 命令/方式 | 结果 |
|---|---|---|
| 类型 | `pnpm run typecheck` | Client 与 Host 均 exit 0 |
| 包构建 | `pnpm --filter lfaa-client-ui-workspace build` | 通过；输出在根 `dist/packages/` |
| 入口构建 | `pnpm run build:control-plane`、最终 `pnpm run build:web` | 均通过；产物在根 `dist/apps/control-plane/`、`dist/apps/web/`。Web 首次构建的资源历史临时文件 rename 曾报 ENOENT；确认无活跃 Vite 构建后重跑通过，最终构建通过 |
| 工作区 Gate | `pnpm run sync:workspace`、`pnpm run check:workspace` | sync 在写 `docs/harness-packages.json` 时返回 Node `UNKNOWN`；只读 check 报既有 `docs/PROMPTS.md` 链接 `#lfaa-compact-application-center-anchor-20261025` 锚点缺失。本批画布合同锚点未报错；未改动该无关任务合同 |
| 内置浏览器实页 | 当前仓库 Web 服务 `http://127.0.0.1:3000/canvas` 与 `http://127.0.0.1:3000/apps/steamcmd/canvas`；桌面 1440×900、窄屏 390×845、窄短屏 390×420 | `/canvas` 最初显示 Web/控制端构建指纹过期保护页；核验 3000 监听进程归属为本仓库 LFAA Web 后重启。重启后 `/canvas` 正常呈现画布首页；子路由短暂显示读取项目态，随后显示“未命名画布/已保存”和完整编辑器，无内部错误横幅。桌面中央空态与网格、窄版工具轨、顶栏均可见；“生成/画布”切换隐藏/显示生成面板；“更多”菜单可见返回、首页、App 切换、重命名、设置及编辑/导入导出入口。短屏实测 `document.scrollWidth=380 <= clientWidth=390`，工具轨自身横向滚动；浏览器 Console error 0。未生成节点、保存或更改账户设置；Provider 尚未配置，未触发生成请求 |
| 差异 | `git diff --check` | 通过 |

浏览器截图在 Codex 内置浏览器以 inline 图像捕获，CUA 未提供本地保存路径。截图状态为设置中心浅色主题、`/apps/steamcmd/canvas`、Canvas 模式；用户提供的两张源图路径见下方 design QA。当前服务由本 checkout `pnpm run lfaa -- web --no-local-daemon` 启动，构建指纹 `node scripts/runtime-build-state.mjs web` 返回 `[]`。帧时间、大画布负载、桌面 WebView、深色主题本批复验与真实 Provider 生成未测。

## 15. 画布首页参考布局与对话抽屉高度修复（2026-10-25）

### 15.1 目标与边界

用户提供 `codex-clipboard-09e1a5ff-f297-4123-9ff8-c00209c5ba8b.png` 为 LFAA `/canvas` 当前页，`codex-clipboard-8347853a-7f65-4c63-a7c8-a85624de8319.png` 为视觉参考；并报告“画布对话”打开后在内容下方留下整块空白。

- **入口与唯一 UI Owner：** `/canvas` 由 `packages/client/ui-layout/src/Workbench.tsx` 装配，首页 Owner 为 `packages/client/ui-workspace/src/CanvasHome.tsx` 与 `canvas-home.css`；App 画布对话面板 Owner 为 `CanvasWorkspace.tsx` 与 `canvas-workspace.css`。
- **数据与 API Owner：** 最近项目由 Canvas 项目 API 按账户读取；App 卡片由已登记的应用列表驱动；导入、新建和导航复用既有 Canvas/Workbench 公开调用。此批不改变 Canvas 数据合同。
- **权限与副作用：** 新建、导入、对话、设置仍调用各自已登记的现有 Owner。浏览器验收只切换显示模式/筛选、开关面板和菜单，不创建、导入、删除项目，不触发生成或复制到系统剪贴板。
- **设置中心配置：** `canvas.defaultMode`、搜索项目/App 的本地筛选与既有 Appearance 主题、强调色、字号、壁纸/遮罩/模糊和减少动态效果；不新增设置，不写入或重置用户偏好。首页背景与容器须保留共享工作台的 Appearance 壁纸能力。
- **参考图映射：** 仅复用图二的顶部搜索、品牌/操作区、欢迎区和侧栏信息层级；只展示 LFAA 已接入的返回、设置、生成/空白画布、导入、App 入口、项目搜索/列表。不得仿造购买、会员、速记持久化、助手、自动整理或不存在的缩略图功能，也不复制 Magine 品牌或背景素材。
- **性能与响应式：** 复用现有一次性账户项目读取和 `useMemo` 筛选；不新增请求/订阅/轮询。宽视口使用双栏，窄容器折成单栏；抽屉按真实内容高度显示并限制最大高度，短屏内部可滚动，页面不横向溢出。

### 15.2 分批验收条件

1. **批次 A：** “画布对话”抽屉不再沿用资产库的全高 bottom 锚点；桌面与窄屏均贴近顶部对话操作区按内容收缩，超过可用高度时只在抽屉内部滚动；关闭/打开小鱼对话等现有操作保留。
2. **批次 B：** `/canvas` 按图二重组顶栏搜索、欢迎区和右侧项目/App 区；搜索同时过滤项目与 App；真实新建空白画布、提示词生成、JSON 导入、项目/App 导航继续使用现有 Owner；Theme 与壁纸继续读设置中心。
3. 每批修改后均完成相应 Client/Host 类型检查与 Web 构建，重启当前 checkout 的 Web 服务，并在内置浏览器按实际路由与代表性视口验收。合同记录真实视口、关键交互和截图情况；不把未测深色、Provider 或帧时间标为通过。

### 15.3 实施记录

#### 批次 A：对话抽屉内容高度

- 修改 `packages/client/ui-workspace/src/canvas-workspace.css`，只对 `.lfaa-cnv-drawer.lfaa-cnv-chat` 清除资产库抽屉继承的 `bottom` 锚点；抽屉按内容高度收缩并限制最大高度，窄屏和短屏保留内部滚动。资产库仍保留原全高抽屉布局。
- `pnpm run typecheck`、`pnpm run build:web`：通过；Web 输出仅写入根 `dist/apps/web/`。按正式入口重启本仓库 Web 服务后，内置浏览器 `http://127.0.0.1:3000/apps/steamcmd/canvas` 验收对话开关与按钮可见。
- 桌面视口 1355×925 CSS px：抽屉 420×225 px；窄屏 390×845 CSS px：抽屉 354×243 px；文档 `scrollWidth=380 <= clientWidth=390`。抽屉不再占据大部分工作区，按钮、项目摘要和说明均完整显示。两次视口截图均由 CUA inline 捕获，无本地截图文件路径。
- 只切换了临时视口和非持久化抽屉开关；项目仍为“已保存”，未写入 Canvas 项目或用户设置。帧时间和不同长说明文本仍未测。

#### 批次 B：`/canvas` 首页布局

##### 实施结果

- `CanvasHome.tsx` 将首屏调整为品牌/搜索/返回与设置、欢迎区和主入口、右侧最近项目与 App 入口。列表数据继续来自账户项目 API 和已登记 App 目录；搜索用同一关键字过滤两类入口。新建空白画布、JSON 导入、项目/App 导航继续调用原有 Owner。
- 提示词创作面板默认收起，以“通过提示词创作”展开；展开后保留图片/视频、比例、时长、目标 App、画布/生成模式和原有创建流程。打开面板时读取 `canvas.defaultMode`，不改变设置中心值。此设计减少首屏表单密度，保留生成入口。
- `canvas-home.css` 让首页背景透明，继续显示 Workbench Appearance 配置的主题与壁纸；卡片表面、遮罩透明度、模糊、强调色、字体字号和减少动态效果读取共享令牌。不复制目标图中的 Magine 品牌或壁纸，不覆盖当前浅色偏好。新增 CSS 变量均在定义旁附中文用途/颜色/透明度注释。
- `canvas-workspace.css` 仅修正对话抽屉高度，资产库仍保留原布局。工作区节点、设置和数据合同不变。

##### 构建与内置浏览器实页

| 检查 | 命令/路由/视口 | 实际结果 |
|---|---|---|
| Client/Host 类型检查 | `pnpm run typecheck` | exit 0 |
| Web 构建 | `pnpm run build:web` | exit 0；构建产物写入根 `dist/packages/` 与 `dist/apps/web/`；Vite 对既有大 chunk 输出体积提醒，未阻断构建 |
| 最终实页启动 | 当前 checkout `pnpm run lfaa -- web --no-local-daemon`；`http://127.0.0.1:3000/canvas` | 正式 Web 服务报告 ready；停旧进程、完成新构建后重启，实际请求加载新版；项目列表从同步态完成后显示账户真实的 3 个项目 |
| 宽屏参考尺寸 | 内置浏览器 `/canvas`，2048×996 CSS px | 欢迎标题约 x=392,y=264；最近项目面板约 x=1377,y=148；透明首页底色保留 Appearance 背景。最近项目/App 入口和三项主操作可见，创建面板未展开 |
| 常用桌面 | 内置浏览器 `/canvas`，1440×900 CSS px | 首屏布局完整；项目 3 项/App 6 项。SteamCMD 卡片打开 `/apps/steamcmd/canvas`，再回到 `/canvas` 成功 |
| 搜索与创作入口 | `/canvas`，1440×900 | 搜索 `SteamCMD` 后项目与 App 各筛为 1 项；清空后恢复为 3/6。打开提示词创作面板默认为“生成”，可切到“画布”再切回并收起；未创建或保存项目 |
| 手机与短屏 | `/canvas`，390×845、390×420 CSS px | 两种尺寸均 `document.scrollWidth=380 <= clientWidth=390`；主内容区 `scrollWidth=clientWidth=360`，纵向内容可滚动。手机打开生成面板实测宽 334px、内部无横向溢出，目标 App 与创建操作可见 |
| 对话抽屉 | `/apps/steamcmd/canvas`，1440×900 与 390×845 CSS px | 打开后桌面 420×225px，手机 354×243px；`scrollHeight=clientHeight`，按钮/上下文完整且页面无横向溢出。关闭后返回 `/canvas` |
| Console | 内置浏览器开发日志 | 页面 Console errors 为 `[]` |
| 差异格式 | `git diff --check` | 通过 |

CUA 截图均 inline 捕获，没有可引用的本地截图路径。验收只做筛选、切换临时模式/视口、页面导航和抽屉开关；未触发新建、导入、生成、设置保存或剪贴板写入。

##### 设置与未测边界

- 本批读取 `canvas.defaultMode`，沿用 Appearance 的主题/强调色/字体/字号/对比度/壁纸/遮罩/模糊/减少动态效果。实页检查时 `data-theme=light`；依据用户选择保持浅色且不改账户偏好。深色令牌路径未在本批切换主题实页复验。
- 未打开本地文件选择器或执行 JSON 导入；未创建空白/提示词项目、未提交 Provider 请求（当前生成 Provider 未配置）；未测大项目列表、帧时间、Electron/WebView 和真实设备。构建提示中的大 chunk 优化不属于本批界面范围。
