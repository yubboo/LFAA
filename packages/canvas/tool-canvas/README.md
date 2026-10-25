# `lfaa-canvas-tool-canvas`

把系统级无限画布接入 LFAA 已有的大模型 Agent Loop：小鱼、子 Agent 与「画布导演」专家按模型决策读写**当前账户**的真实画布项目，而不是靠关键词或写死流程。画布是所有 App 共用的系统能力，但项目数据仍按「账户 + App 作用域」隔离。

## 目的与非职责

- **目的：** 提供 `canvas_list_projects`、`canvas_read_project`、`canvas_create_project`、`canvas_add_node`、`canvas_update_node`、`canvas_remove_node`、`canvas_connect_nodes`、`canvas_disconnect_nodes`、`canvas_list_assets`、`canvas_generate_image` 十个核心管理工具，让模型依据当前用户目标规划画布节点、连线与真实生成。
- **不负责：** 画布项目 JSON、素材二进制、账户/App 隔离、并发版本、节点数量与素材大小边界（归 `lfaa-canvas`）；图片/视频生成编排与 Provider 调用（归 `packages/canvas/canvas-generation` 的 `lfaaCanvasGeneration`，A 任务实现）；审批与权限模式（归统一 Permission Owner）；画布 UI 与客户端 API（归 `packages/client/**` 与 `packages/api/canvas-controller`）。
- 本包不写第二套 Provider 协议、不持有文件路径、不伪造生成结果，也不新增身份、会话或权限模式。

## 权威归属

- 工具 ID、模型调用名、参数合同和中文能力描述由本包唯一持有；工具通过 `lfaa-tools` 的 `makeTool` 登记，执行时调用 `lfaa-canvas` 的 Cordis 服务 `lfaaCanvas`。
- 画布数据事实（`lfaa-canvas-project` v2、节点/连线/视口/素材、`expectedUpdatedAt` 并发语义、`CANVAS_LIMITS` 边界）来自 `lfaa-canvas`，本包不复制这些默认值，只引用其导出常量。
- 节点类型集合按本轮合同 5.2 收敛为 `text/note/image/video/audio/generation/subject/timeline/director-toolbox/director-desk/script/asset/upload`；每个类型只校验已知字段的类型与长度，保留客户端扩展字段，并保持节点 data ≤64 KiB、文本 ≤20,000 字符。
- 生成工具只调用画布生成 Owner（`lfaaCanvasGeneration.generateImage`）；未装配、模型账户/密钥未配置或生成失败时工具返回真实原因，不返回成功占位。

## 公共合同

- Cordis 插件：`name = "lfaaCanvasToolCanvas"`，`inject = ["lfaaCanvas", "lfaaTools"]`，`apply(ctx)` 通过 `ctx.lfaaTools.registerTool(ctx, tool)` 登记；注册随插件卸载撤销。
- 生成服务 `lfaaCanvasGeneration` 通过 `ctx.get("lfaaCanvasGeneration")` 读取，属于可选依赖：服务未装配时 `canvas_generate_image` 明确报“尚未装配”；装配后按 `lfaa-canvas-generation` 的公开合同调用 `generateImage(userId, applicationId, projectId, input)`，只返回 Owner 真实落盘的 `project` 与 `asset`。
- 所有工具声明 `coreManaged: true`、`applicationIds = APPLICATION_IDS`；参数中的 `applicationId` 必须来自 `APPLICATION_IDS`，写工具必须携带最近读取或写入返回的 `expectedUpdatedAt`。
- 返回值只包含 Owner 的真实项目摘要、节点、连线、素材元数据与最新 `updatedAt`；不返回本机文件路径、素材二进制或 Provider 临时 URL。

## 运行位置与装配

- Control Plane（Node）的 Cordis 插件，由 `packages/bundle/base/cordis.patch.yml` 按 `lfaa-canvas-tool-canvas` 包名装配，依赖 `lfaaCanvas` 与 `lfaaTools` 已就绪；不进入浏览器入口。
- Bundle 装配行由 Lead 本轮按合同统一接入。**当前状态：源码实现完成，工具注册由本包回归在真实 Cordis Context + 真实 `lfaa-canvas` Owner 上验证；正式 Bundle 装配与实页 Agent 验收由 Lead 完成，未装配前不得宣称用户可用。**

## 设置与权限

- 不新增设置项：工具读取的生成模型/账户/密钥由 `lfaa-settings` 的既有 `imageGeneration*`/`videoGeneration*` 与 `lfaa-credentials` 提供（生成 Owner 读取，本包不复制）。
- 不新增权限模式：写节点/连线、删除节点、图片生成分别声明 `risk` 与 `approval` 范围，由统一 Permission Owner 在请求审批/替我审批/完全访问三种模式下处理。
- 画布不新增 ApplicationId；`applicationId` 只指定目标 App 作用域，账户隔离仍由 `lfaa-canvas` 的目录结构与认证上下文保证。

## 数据与副作用

- 每次写操作先读取当前项目并校验 `expectedUpdatedAt`，再整体提交；Owner 抛出的并发冲突统一转成可读的「HTTP 409 冲突」错误，模型需重新读取后再试，不重放未知结果。
- 删除节点会同步删除挂在该节点上的连线，避免项目文档引用不存在的端点；调用返回真实删除数量。
- 节点素材引用（`data.assetId`、`data.assetIds[]`（≤20）、`data.references[].assetId`（≤64）、`subject.assetIds`、`timeline.clips[].assetId`、`generation.assetId`）必须在当前项目素材中真实存在；媒体节点名称取 Owner 保存的真实素材名。
- 节点 `type` 与 `data` 的形状、文本长度、节点数据 64 KiB 上限在工具 `parse` 阶段校验；素材存在性、生成节点状态与媒体类型匹配在读取真实项目后的 `execute` 阶段校验，两层都拒绝时不会写入。
- 生成节点的 `running/succeeded/failed` 只能由生成 Owner 在真实结果后写入；工具不能把节点标记成假成功。`canvas_generate_image` 成功后只报告 Owner 返回且已出现在项目素材清单中的 `assetId`。
- 读取使用有界分页：节点默认 5 条、最多 20 条并按 JSON 字符预算继续分页；连线默认 50 条、最多 100 条；素材默认 20 条、最多 50 条；项目列表受 Owner 每 App 100 项目上限约束。

## 生命周期与预算

- 工具注册使用 `ctx.effect`，插件卸载后旧工具拒绝继续执行。
- 工具遵循调用方 `AbortSignal`：每个执行入口先检查取消；不创建计时器、订阅或后台轮询。
- 单个工具返回数据以分页与字符预算为界，不把整份项目（最多 200 节点 / 400 连线 / 100 素材 / 512 MiB 项目素材）一次塞进模型上下文。

## 验收与状态

- 包构建：`cd packages/canvas/tool-canvas && node ../../../scripts/build-harness.mjs package`（输出根 `dist/packages/canvas/tool-canvas/`）。
- 定向回归：`cd apps/cli && node --import tsx --import ./register-package-loader.mjs --import ./tests/isolated-test-environment.mjs --test tests/canvas-tools.test.mjs tests/xiaoyu-persona-core.test.mjs`，覆盖十个工具注册名、参数校验拒绝、真实 Owner CRUD/409/跨 App 隔离/素材引用、生成能力未装配时的明确失败与假生成服务的调用/结果透传/失败传播，以及人格正文画布领域与画布导演专家。
- 尚需 Lead 串行完成的验证：`pnpm install`（本包为新工作区包，需要包级依赖链接）、Bundle 装配、`typecheck`/`build`、真实浏览器与真实 Provider 验收。构建成功不代表浏览器或 Provider 已验收。
