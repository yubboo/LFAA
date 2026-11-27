# 无限画布插件首版开发方案

状态：**首版已接入，仓库验收门禁有遗留（A1）**。2026-11-27，负责人确认首版范围并批准本文实施。首版新增 `@lfaa/canvas` 和 `@lfaa/client-ui-canvas`。实测结果见 [DEV-000660](../dev-log/000601-000800.md#dev-000660无限画布与白模预演)。

## 目标与使用流程

首版服务于图像分镜和视频镜头的制作。用同一角色参考素材贯穿多个镜头，再用独立的白模与相机决定每个镜头的构图、走位和运镜。

1. 在当前项目从右侧菜单栏「＋」打开起始页，选择「无限画布」。从该入口创建或重开此项目的画布。复用工作台的关闭、展开和最大化；窄屏在现有工作台容器中编辑。
2. 拖入角色参考图，添加提示词和白模节点。白模编辑使用地面、人物和基础道具，支持对象选择、移动、旋转，调整相机视角，并给人物位置和相机打关键帧。时间轴可拖动和播放。输出当前静帧或短片，回到节点后可预览、复用。
3. 将角色参考和白模静帧连到生图节点，生成分镜。选定的图像版本可连到视频的首帧或尾帧。支持运动参考的模型可直接使用白模短片。可预览和下载每次生成结果，在节点里切换版本后选择要接入下游的版本。
4. 修改第二个镜头的机位后，只渲染并生成指定镜头。另一镜头保留已选素材。改变节点输入时提示结果需要更新，点击运行才提交生成。关闭或刷新后可重新打开画布，看到连线、场景、结果和任务真实状态。

首版范围限于本地项目、内置简模、基础关键帧、图片和短视频生成。完整建模、自动图转 3D、剪辑时间线、多人协作、ComfyUI 工作流导入和 Agent 整图自动执行另行定义。

## 节点与执行契约

| 节点 | 输入 | 输出 |
| --- | --- | --- |
| 提示词 | 文本，可独立编辑 | 文本 |
| 参考素材 | 项目画布已导入的图片或短片 | 对应类型的素材版本 |
| 3D 白模 | 人物、道具、机位、画幅、时长、关键帧 | 构图静帧、预演短片，可独立生成新版本 |
| 生图 | 提示词、角色参考、构图参考、模型及尺寸等支持的参数 | 图片结果版本 |
| 生视频 | 提示词和模型参数，按模式接受首尾帧或参考素材 | 视频结果版本 |

- 画布文档记录 `schemaVersion`、`projectId`、`canvasId`、`revision`、视口、节点、连线与选定产物。连线保存起止节点和端口，使用媒体的连线需指向具体产物版本。生成记录保存提交时解析出的素材版本、模型、实际参数、状态和本地产物。项目隔离与修订校验由宿主执行，跨项目引用、类型不匹配、自环、多余输入和循环依赖须被拒绝。并发保存冲突时保留本地编辑并提示重新载入，覆盖需要显式操作。
- `GET/POST /api/canvas/projects/:projectId/boards` 列出或创建项目画布。`GET/PUT /api/canvas/projects/:projectId/boards/:canvasId` 读取或按修订保存。该画布下的 `assets` 子路径负责导入和授权读取，`runs` 子路径负责投递及查询。仅通过宿主已登记的项目解析访问权，素材以受控 ID 寻址。生成结果沿用 LFAA 媒体落盘及受权预览方式。浏览器端存储可恢复界面焦点，画布内容以 Host 持久化为准。
- 按节点运行且先校验所需输入，未生成的上游由用户显式运行。运行请求含唯一请求 ID，用于防止重复点击、网络重试导致重复提交。宿主先保存运行快照，再发请求；视频收到厂商任务 ID 即持久化，刷新和重启后通过已有查询链路恢复。同一提交在厂商是否接收尚不确定时显示待核对状态，禁止自动重发。终态和产物登记须能幂等恢复；旧任务返回只更新对应运行记录，不能覆盖新版本的已选结果。
- 生图的角色参考和构图参考分别记录来源，由适配器映射到模型支持的参考输入。通用多图接口只有参考顺序和文字说明时，不把它展示成独立的硬约束。方舟视频将首尾帧与全模态参考设为不同模式，宿主拒绝混用。模型不支持的参数不提交，预演短片格式无法用于所选模型时提前说明。

## 预计文件与实施顺序

| 阶段 | 文件 | 改动 |
| --- | --- | --- |
| 1 | `packages/media/canvas/contract/index.ts`、`src/index.ts`、`src/canvas-service.ts`、`src/canvas-store.ts`、`src/graph.ts` | 定义文档、端口、运行与素材契约；默认导出 Cordis 插件；隔离项目数据、修订校验和原子写入。 |
| 1 | `packages/bundle/web/src/index.ts`、`packages/bundle/web/package.json`、`packages/host/web-server/src/runtime.ts` 及 `src/handlers/` 新建画布路由文件 | 由 bundle 装配，通过 Host 的现有项目解析与本机 API 鉴权挂载画布接口。插件卸载后不再接收新请求。 |
| 2 | `packages/client/ui-canvas/client/index.tsx`、`locales.ts`、`canvas/`、`api/` | 通过 Cordis 注册画布入口和渲染器。实现项目画布列表、节点、连线、运行状态、结果预览、保存恢复。 |
| 2 | `packages/ui/layout/contract/index.ts`、`packages/ui/layout/client/workbench-service.ts`、`packages/client/ui-chat/client/workbench/`、`apps/web/src/main.tsx` 和相关包清单 | 复用右栏新建起始页与标签框架，新增有 disposer 的通用工作台标签贡献；UI 插件注册入口，聊天工作台消费贡献，装配入口仅挂载客户端插件。 |
| 3 | `packages/client/ui-canvas/client/previs/`、`packages/media/canvas/contract/`、`packages/media/canvas/src/canvas-service.ts` | 懒加载 Three.js 白模编辑器。序列化场景和轨迹，导出 PNG 静帧和经过实测的短片格式，持久化为项目资产。预演关闭时释放 WebGL、录制和对象 URL。 |
| 4 | `packages/media/canvas/src/canvas-runner.ts`、`packages/media/tool-media/src/`、`packages/core/llm/src/media/media.ts` 和 `media-video.ts` | 公开可复用的媒体执行入口；将画布的输入快照映射到现有生图和方舟图生视频／视频参考能力，复用产物写入和视频任务查询。 |
| 5 | 两个新包的双语 README 和配对记录、相关包 README、`scripts/ui-shot-tasks.ts`、仓库地图、dev-log 和 updata-log | 补齐装配与使用说明，记录最终依赖版本、真实变更路径、验收和回滚证据。 |

## 验收与回滚

- 契约测试覆盖有效 DAG、拒绝错误端口和循环、跨项目素材权限、同时保存的修订冲突、相同请求只投递一次，以及重启后以已有视频任务 ID 恢复查询。适配器测试分别验证角色参考与构图参考的映射、首尾帧角色、运动参考和不支持时的错误。
- 内置浏览器在浅色、深色和窄屏实测右侧入口、拖拽与连线、保存恢复。使用同一角色参考为两镜头走真实模型链路，检查白模人物走位、机位、静帧、短片是否可用，一镜走首尾帧、一镜走白模运动参考。重跑第二镜后第一镜选定版本保持可用，检查控制台、任务恢复及保存冲突反馈。模型联通和页面交互分别记录证据。
- 完成后更新截图任务，运行 `pnpm ui:shot --only=infinite-canvas`、`pnpm verify:web` 和仓库规定的完整构建门禁。构建宿主后重启本地 `pnpm lfaa web`，在 5173 上验证真实入口。
- 风险集中在 WebGL／录制兼容、模型支持差异和反复生成的费用。先在 Windows Edge 验证 PNG 和方舟接受的短片 MIME，再接下游生成。页面按模型能力提示，模型费用仅在显式运行时发生。最终依赖版本、增量体积与锁文件审计结果在开工后记录。
- 回滚时撤销本轮 UI 注册和 Host bundle 装配，当前工作台仍可打开既有标签。已保存的画布和媒体文件保留，后续重新装配可恢复。

## 调研与参考

查阅日期：2026-11-27。检索关键词：右栏新建标签、媒体参考图、视频任务恢复、节点连线、白模预演、WebGL 录制、模型首尾帧。

- LFAA `df47dbe0` 与当前工作树已核对 [右工作台起始页](../../packages/client/ui-chat/client/workbench/Right-Workbench-Start.tsx)、[素材浏览器半包](../../packages/client/ui-tool-media/README.zh.md)、[媒体适配](../../packages/core/llm/src/media/media.ts) 和 [后台进程任务](../../packages/core/jobs/README.zh.md)。直接复用右栏框架、主题控件、素材及媒体适配能力。后台任务包管理 Shell 进程，画布运行记录需单独承载快照和厂商任务恢复。当前锁文件未发现画布或 3D 渲染依赖。
- DeepSeek Harness 本地基座 `4b399c39` 的 `packages/workflow/workflow-ptc/README.zh.md` 是 Agent 程序化工具任务协议，参考任务与产物状态分离；其运行时不提供可视媒体节点、3D 预演或匹配的项目契约。
- 图编辑候选一为 [React Flow](https://reactflow.dev/api-reference/react-flow) 的 `@xyflow/react` 12.x，候选二为 [Rete v2](https://retejs.org/docs/concepts/engine/)。选择 React Flow 的受控节点、端口、视口与连线行为，执行交给 LFAA Host。Rete 的渲染插件与数据流引擎更适合需要一并引入执行框架的场景。两者有 MIT 组件；React Flow 12.x 列在[安全政策](https://github.com/xyflow/xyflow/security)明确支持范围内。参考 [ComfyUI Workflow JSON v1.0](https://docs.comfy.org/specs/workflow_json) 的版本化文档和显式端口，不引入其运行时或产品界面。
- 预演在 [Three.js r187（7e89746）](https://github.com/mrdoob/three.js/releases/tag/r187) 与手写 2D 透视／录制之间比较。Three.js 现成相机、场景、几何和动画接口直接满足空间编辑，手写投影叠加会增加交互和画幅适配成本。Three.js 使用 [MIT 许可证](https://github.com/mrdoob/three.js/blob/dev/LICENSE)，上游持续发布。查看了[上游安全页](https://github.com/mrdoob/three.js/security)，公开页当时无已发布公告，仍需对最终版本和传递依赖执行审计。React Flow 与 Three.js 均限浏览器包，懒加载 3D，CSS Modules 接入主题令牌。录像参考浏览器的 [Canvas captureStream](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream) 和 [MediaRecorder 格式检测](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static)。
- [火山方舟创建视频任务 API](https://docs.volcengine.com/docs/ark/create-video-generation-task-api?lang=zh)（API v3）定义首帧、尾帧、图像和视频参考角色，明确首尾帧与全模态参考模式互斥。适配按文档与真实可用模型验证。
- 本机公开模型档案未列出可用 Seedance 2.x，补用已配置的万相 3.0 验证相同的画布输入。根据[百炼万相 3.0 视频生成协议](https://help.aliyun.com/zh/model-studio/wan3-video-generation-api-reference)和 [Token Plan 模型清单](https://help.aliyun.com/en/model-studio/token-plan-video-generation)，万相的参考输入使用 `input.media` 传送相同用途的素材，首尾帧与全模态参考同样互斥。真实模型调用与适配器测试分别记录。
- 产品参考为 [LibTV](https://www.liblib.tv/) 的画布与 [3D-BOX](https://www.liblib.tv/3d-box)、[Updream 2026-08-18 白模预演公告](https://www.bilibili.com/opus/1237442539704811557)、[即梦 AI](https://jimeng.jianying.com/) 的首尾帧机制，以及[豆包工作画布 2026-10-09 报道](https://feng.ifeng.com/c/8x5EOjB2JaG)的素材与结果同屏。仅借鉴交互方向，界面沿用 LFAA 的 Shell、主题与组件，素材使用自有内置简模。
