# 无限画布重塑方案（infinite-canvas-redesign）

## 1. 目标与范围

将初版无限画布（`@lfaa/client-ui-canvas` + `@lfaa/canvas`）升级为沉浸式创作画布，严格还原负责人提供的参考设计，并打通 LFAA 既有的**项目创建**、**统一资料库存储（`E:\lfaa\data`）**与**全屏 AI 对话抽屉**。

## 2. 调研与参考

- **本仓库基座**：
  - `packages/client/ui-canvas/client/canvas/*`：现有基于 `@xyflow/react` 的节点画布、5 类节点（`prompt` / `asset` / `previs` / `image` / `video`）、3D 预演器与持久化 hook `useCanvasDocument`。
  - `packages/media/canvas/src/canvas-store.ts` & `canvas-service.ts`：现有画布存在 `~/.lfaa/canvas/`，与资料库目录分离。
  - `packages/media/tool-media/src/media-http.ts`：资料库媒体扫描 `<root>/.lfaa-media/{images,videos,audio}` 及 sidecar `.json`。
  - `packages/ui/layout/contract/index.ts` & `packages/client/ui-workspace/client/index.tsx`：左二栏通过 `projectProvider` 暴露项目列表与 `ProjectDialog` 创建弹窗；工作台通过 `rightPanelMaximized` 标识全屏态。

## 3. 核心设计

### 3.1 统一资产存储到资料库目录（`E:\lfaa\data`）
- `CanvasService` 通过可选注入 `memory` 读取当前资料库存储目录（如 `E:\lfaa\data`）：
  - 图片资产统一写入 `<dataDir>/.lfaa-media/images/<id>.<ext>` + `<file>.json` sidecar 元数据；
  - 视频资产统一写入 `<dataDir>/.lfaa-media/videos/<id>.<ext>` + `<file>.json` sidecar 元数据；
  - 画布 `assets/<id>.json` 记录 `filePath`，`asset()` 优先读取该统一路径，历史无 `filePath` 记录平滑回退旧目录；
  - `handlers.ts` 的 `resolveMediaAllowedRoots()` 纳入 `context.memory.getStorageDir()`，使资料库「图像 / 视频」与画布左侧「资产库」抽屉完全同源互通。
- 新增 `POST /api/canvas/projects/:pid/boards/:bid/assets` 支持 `{ libraryPath }` 直接将资料库已有图片/视频绑定为画布节点，无需重复上传。

### 3.2 沉浸式画布壳层与多卡片模板弹窗
- 移除老式顶部横条与默认左下角 Controls，全部使用双主题语义变量的悬浮玻璃胶囊：
  - **左上角浮层**：`< 项目名 / 画布名`（点击返回画布列表、切换项目或调用左二栏同款「新建项目」弹窗；支持就地重命名画布）。
  - **右上角浮层**：节点快速搜索 + 自动保存状态指示。
  - **左侧中部竖排悬浮胶囊**：
    1. 高亮圆形 `+`（添加节点弹出菜单）
    2. 文件夹（统一资产库抽屉：按图片/视频筛选，一键拖入或插入画布）
    3. 播放（运行当前选中或可运行节点）
    4. 时钟（运行历史抽屉）
    5. 剪刀（快速打开/创建 3D 预演）
  - **空画布中央引导区**（无节点时展示）：
    - `▶ 右键新建节点开启创作` + 画布空白处右键弹出新建节点菜单；
    - 5 张主分类模板卡片：**模型提示词**、**剧本和角色**、**商业广告**、**游戏二创**、**原创创作**；
    - 点击任意主卡片，在其上下平滑展开多张子模板卡片（带缩略图标识、名称与信息按钮 `i`），点击任意子卡片一键生成对应多节点 + 贝塞尔连线工作流。
  - **左下角可折叠小地图（MiniMap）** + **底部居中悬浮控制胶囊**（选择/抓手切换、`- 100% +` 缩放、适应画布、小地图/网格切换、撤销/重做）。
  - **右下角「与 Agent 对话」胶囊**：
    - 仅在工作台最大化/全屏（`rightPanelMaximized === true`）时出现；
    - 点击在全屏画布右侧滑出悬浮对话抽屉（不退出画布全屏，实时与 Agent 对话）。

### 3.3 节点卡片、流光连线与悬浮控制台
- 节点标题浮于卡片上方外侧（如 `T 文本1 ✎`、`▶ 视频1 ✎`、`🖼 图片1 ✎`、`✨ 提示词优化`）；
- 卡片左右边缘悬停/选中时显示圆形 `+` 快捷连接手柄，支持拖线或一键向下游新建节点；
- 连线：自定义发光贝塞尔曲线（未就绪为虚线，已连接/选中/运行态带高亮流光脉冲）；
- 选中节点时：
  - 上方浮出紧凑胶囊工具条（如文本节点 `A- / A+ / 编辑 / 下载 / 删除`，媒体节点 `上传 / 预览 / 下载 / 删除`）；
  - 下方浮出深色玻璃生成控制台（提示词输入 + 字数统计、模型选择、比例/时长/分辨率选择、圆形高亮运行按钮 `↑`）；
  - 空图片/视频节点中央内置「上传图片 / 上传视频」按钮。

### 3.4 新建项目与左二栏一致
- 在 `WorkbenchTabRenderContext` / `WorkbenchProjectProvider` 扩展 `openCreateProject?: () => void`、`rightPanelMaximized` 与 `renderFullscreenChatDrawer`，画布内点击「新建项目」直接打开左二栏同款 `ProjectDialog`，创建后自动绑定并进入画布。

### 3.5 画布空白处的鼠标菜单

- 左键双击打开「新建节点」，列出当前可用的文本、图片、视频、素材和 3D 预演，同时可从资料库选择或本地上传。右键打开「添加节点」，在相同节点项下提供适应画布、粘贴和上传。菜单内的新节点和导入素材均使用打开时的画布坐标。
- `Canvas-Viewport` 区分空白双击和节点事件，关闭默认双击缩放，保留滚轮缩放及右键拖动画布。`Canvas-Editor` 复用现有节点、上传、资产库和适应画布动作。`Canvas-Drawers` 与指针菜单共用节点选项，菜单用项目浮层令牌、遮罩、回焦与键盘导航。`Canvas-Templates` 和双语文案更新空画布提示。
- 2026-11-27 调研了当前右键菜单、`@xyflow/react@12.12.1` 的 Pane/ZoomPane 事件、[React Flow 视口 API](https://reactflow.dev/api-reference/types/react-flow-instance)、[W3C APG 菜单模式](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/)和 [Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API)。采用现有画布转换与导入能力，并按 W3C 处理键盘。共享 ContextMenu 依赖单个右键触发元素，复用其交互规范与主题令牌；现有两种鼠标入口需要共享同一个指针坐标菜单，因此沿用画布自身的菜单状态。无外部代码复制或新增依赖。
- 局部交互迭代，沿用现有画布方案和负责人本轮明确指定的双击、右键入口。现有节点契约和存储兼容。验收覆盖深浅主题、边缘防裁切、鼠标和键盘关闭、缩放坐标、节点双击与拖动、上传及剪贴板。回退时撤回指针菜单及两种触发的源码和文案，既有画布数据仍可读取。

### 3.6 左侧工具栏与基础媒体操作

- 2026-11-27 负责人指定现有左侧悬浮工具栏的位置，依次接入「节点列表、创作广场、资料库、添加节点、全部功能、剪辑器」。资料库复用当前应用的图片与视频数据。节点列表可搜索、定位节点，创作广场在空画布或已有画布都可应用现有工作流模板，添加节点复用现有五类节点。
- 「全部功能」按视频编辑、图片编辑和画布工具分组，可搜索已接入的动作。视频首批提供截帧和片段截取，图片首批提供裁剪、旋转和宫格切分，画布工具保留运行历史和白模预演入口。剪辑器聚焦单个视频，提供预览、设定起止点、截帧和导出片段。处理结果作为新素材加入当前画布，使用现有素材接口。
- 文件范围限 `packages/client/ui-canvas`（`canvas/Canvas-Tool*`、`canvas/Canvas-Drawers*`、`canvas/Canvas-Editor.tsx`、`canvas/Canvas-Media*`、双语文案与说明），用原生模态管理焦点，按已有弹窗规范使用双主题样式。前端使用既有画布契约和 Host API。高阶生成、重绘、智能分离等动作依赖单独可用的模型或者媒体能力，按实际接入进度进入目录。
- 2026-11-27 查阅 LFAA `123766a8` 的模板、视口定位、资料库与素材上传能力、`previs/stage-export.ts` 的浏览器录制和现有 FFmpeg 连接器。对照 [React Flow 12 视口 API](https://reactflow.dev/api-reference/types/react-flow-instance)、[MDN Canvas drawImage](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage)、[MDN 录制 API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) 与 [FFmpeg 文档](https://ffmpeg.org/ffmpeg-all.html)。候选一是采用宿主 FFmpeg 精确处理，当前系统找不到 FFmpeg，可执行文件管理与剪辑契约另需分阶段接入。候选二是适配现有浏览器导出方式，采用 Canvas 做静态变换、媒体流录制做基础视频片段。浏览器不支持录制时提供截帧功能并明确反馈。无外部源码复制或额外运行时依赖，素材继续按既有 MIME 和尺寸门禁处理。
- 验收覆盖六个入口、深浅主题及窄栏、资料库导入、模板添加、模态关闭回焦、图像坐标及视频起止点。回滚时撤回工具栏与媒体操作界面，原画布与导出文件继续由现有存储读取。

### 3.7 瘦身工具栏与扩充全部功能

- 负责人指出工具条过宽且悬停生硬，目录条目太少。收窄现有六项工具条和抽屉锚点，保留可读文字和触控尺寸。悬停仅提升图标与底板，点击有轻量按压反馈，减少动态效果模式保留静态反馈。功能目录按媒体类型排成三列，随视口收为两列或一列，搜索继续匹配操作名和类别。
- 扩充可直接处理当前画布素材的操作。视频新增画面裁切、长边缩放、按时间采样取帧、分离音视频。图片新增同比缩放、文字标注、九宫格排版。处理结果继续通过现有素材接口写入当前画布，音频用浏览器下载，因为现有画布素材契约只接收图片和视频。去字幕、片段重拍、语义抠像等仍需对应模型或专用处理链路。
- 2026-11-27 核对当前 `Canvas-Media-Editor`、画布上传限制、已装依赖和项目 FFmpeg 连接器。查阅 [MDN Canvas drawImage](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage)、[Canvas 录制流](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream)、[MediaStream 轨道组合](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream/MediaStream) 和 [减少动效](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)。比较直接适配浏览器 Canvas 与接入宿主 FFmpeg。当前采用浏览器原生能力和既有媒体录制，避免引入系统安装、许可与原生分发工作。截取按浏览器播放状态处理，不作为帧精确转码。无新增依赖或外部源码复制。
- 变更位于 `packages/client/ui-canvas/client/canvas/` 的工具目录、样式、媒体编辑与处理函数和双语文案。验收检查输入范围、采样边界、结果宽高比、双主题及窄屏悬停状态。回滚通过撤回新增目录项和对应处理文件，已生成的素材仍由现有画布接口读取。

### 3.8 空画布模板与双击提示

- 按负责人圈出的空画布区域调整。五类模板在宽画布呈单行薄叠层卡片，窄画布自动换行。沿用 LFAA 的类别、图标、主题色和展开交互。用「双击画布」「创建节点」两段文字夹住指针图标，周围由现有 React Flow 网格提供局部点阵高亮。
- 2026-11-27 查阅 `123766a8` 的 `Canvas-Templates`、`Canvas-Viewport`、`@xyflow/react@12.12.1` 的 Background 和 `@tabler/icons-react@3.52.0` 图标。直接适配现有模板与网格，使用负责人截图确认层次与入口位置，未复制参考图素材或引入依赖。提示和卡片间隙透传画布事件，双击继续使用既有节点菜单。
- 改动集中在空画布组件、双语文案、网格表现和截图夹具。验证深浅主题、窄屏、展开模板及双击菜单。回滚时可撤回呈现与截图变更，已有项目和画布文件继续使用原契约。
