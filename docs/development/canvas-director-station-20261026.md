# LFAA Canvas 导演台（2026-10-26）

<a id="lfaa-canvas-director-station-20261026"></a>

## 用户问题与目标

用户希望在 LFAA 中实现参考图所示的 LibTV/即梦导演台。当前通用画布的“导演台”节点只保存镜头节点引用；AI 漫剧的白模导演台属于 `aivideo` 项目，数据格式和 Owner 不同。本任务升级通用画布的现有节点：点击“进入导演台”后打开沉浸式 3D 场景编辑器，能添加白模角色与道具、选择对象并编辑变换、调整拍摄相机与场景灯光、查看相机预览，并把场景数据保存到当前画布项目。

## 目标运行入口与 Owner

- **运行入口：** Web/Electron 共用的 `/apps/<appId>/canvas[/:projectId]`，由 `packages/client/ui-layout/Workbench.tsx` 装配。
- **画布交互与数据转换：** `packages/client/ui-workspace`，复用现有 `director-desk` 节点、Canvas 保存状态、显式保存按钮、409 并发冲突处理和认证 API。
- **项目数据与账户/App 隔离：** `packages/canvas/canvas` 按当前账户和 App 持久化现有 Canvas 项目 JSON；场景随节点 `data.desk` 保存，不另建项目存储或服务。
- **共享 3D 绘制：** `packages/client/ui-primitives` 使用已登记的 Three.js 依赖提供共享场景组件；页面不得自行创建另一套 renderer。主题表面和 CSS 材质归 `packages/client/ui-theme`。
- **权限与认证：** 保存沿用 Canvas 认证 API 与现有账户隔离。此任务不新增权限策略或后台执行能力。

## 设置、数据及范围

- 读取现有 `canvas.snapToGrid`（默认 `false`），在 3D 场景拖动物体时按偏好吸附；`canvas` 其他默认值仍由 Settings Owner 提供。
- 工作台主题、强调色、字体/字号、对比度、壁纸/遮罩/模糊与减少动态效果继续沿用 Appearance 共享映射；不新增或修改账户设置。
- 导演台项目数据存入现有节点 `data.desk`，保留 `shotNodeIds`，并以有界 JSON 保存场景物体、相机和环境参数；用户通过现有保存操作写入当前画布项目。
- 白模由本地基础几何构成，不表示接入外部模型资产。场景编辑为 3D 浏览器绘制；无 WebGL 时须给出真实不可用状态并保留表单编辑能力。
- **允许：** 相关 Canvas 节点数据转换、共享 3D 场景组件、Canvas 工作区编辑入口和样式、直接相关 README/架构事实、任务合同与索引。
- **禁止：** 修改 AI 漫剧 Owner 或复制其存储；伪造生成能力/外部资产/动画/成片输出；新增第二份项目存储、权限机制、用户设置或未接入 Provider；写入正式用户项目进行验收。

## 可观察验收条件

1. 导演台节点可进入编辑器；能添加白模角色和场景块，选中并调整名称、位置、尺寸和朝向。
2. 主 3D 视口显示透视地面网格与场景物体；相机小窗使用项目相机参数显示同一场景，物体/镜头控制可用。
3. 可更改环境预设和主光强度；所有项目级场景状态写入原 `data.desk`，不改变原镜头引用。
4. 显式保存后状态复用现有画布保存合同；界面响应式适配桌面、窄分栏、手机及短屏，主题来自 Settings 令牌。
5. Three.js 仅由 `ui-primitives` 场景组件使用；renderer、动画帧、观察器和输入事件在卸载时完整清理。空闲状态不持续动画渲染。

## 实施批次

- **批次 A：** 完成共享 3D 场景组件及可访问的导演台编辑器；接入现有节点数据与 Canvas 保存流程，提供白模库、对象检查器、相机小窗和灯光/环境调节；按容器宽高布局。

## 验收记录

- 初始工作区为 `main`，存在多项用户既有未提交修改（包括 Canvas 工作区、架构/任务文档与测试）；开始时均原样保留，本合同及后续差异只记录本任务新增修改。
- **入口/Owner/设置基线：** 见上文；当前画布 Canvas 的显式保存会校验 `updatedAt`，冲突时不覆盖其他修改。画布设置默认：`snapToGrid=false`、`gridStyle=dots`、`showMiniMap=true`；主题从当前工作台 Appearance 读取。
- **批次 A 源码：** 已实现 `CanvasDirectorDeskEditor`，通过现有导演台节点打开；支持程序化白模角色/场景方块、对象列表/选择、名称与变换编辑、导演相机位置/朝向/焦距、环境/主光/网格设置和同场景相机预览。场景有界规范化为最多 32 个对象并保留原 `shotNodeIds`，场景数据仍归当前节点 `data.desk.scene`。
- **性能/清理：** `DirectorDeskStage` 仅在视口/数据/输入/主题/可见性变化时调度动画帧，休眠页面停止渲染；使用 ResizeObserver 与 MutationObserver 并在卸载时撤销，清理几何体/材质/renderer 并释放 WebGL context。白模数量限制 32。正式 Web 产物把 Three.js 场景延迟加载为 `DirectorDeskStage` chunk（536.44 kB，gzip 136.16 kB）；构建仍提示该 chunk 超过 500 kB 警告线。未测 GPU 帧时间、显存峰值或低端硬件表现。
- **批次 A 源码/构建：** `pnpm run typecheck` 通过；`lfaa-client-ui-primitives` 与 `lfaa-client-ui-workspace` 构建通过；`pnpm run build:web` 通过（Vite 转换 3876 个模块）；`node scripts/runtime-build-state.mjs web` 和 `host` 均返回 `[]`；`git diff --check` 通过。未新增或运行测试。
- **批次 A 内置浏览器：** 正式源码 Web 服务 `http://127.0.0.1:3000` 重启后，实页路由 `http://127.0.0.1:3000/apps/steamcmd/canvas`。1280×720 下可见已有保存的白模及同场镜头预览，状态仍为“已保存”；浏览器 console error 为空。680×720 下素材栏折叠为顶端横排，视口/属性并排，文档宽度仍为 680px。390×560 下编辑器自身 `scrollHeight=962px`、`clientHeight=560px`、无横向溢出；滚动 402px 后顶端保存栏仍固定可见并可操作。截图由内置浏览器逐视口捕获。
- **数据写入边界：** 为交互验收，在本轮新建的临时空白验收页中添加并移除了临时导演台节点、角色与方块，修改临时角色名后移除对象，未点保存，随后关闭该临时页；正式保存的用户场景只读进入并查看，未修改或保存。设置未更改，视口测试结束后恢复默认尺寸。
- **未测范围：** GPU 帧时间/低端硬件、Electron/WebView、真实移动设备、真实外部模型资产、骨骼动画、生成 Provider、视频合成/导出未接入或未实测。
