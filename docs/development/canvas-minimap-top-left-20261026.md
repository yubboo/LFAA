<a id="lfaa-canvas-minimap-top-left-20261026"></a>

# LFAA-CANVAS-MINIMAP-TOP-LEFT-20261026：无限画布工具区与小鱼助手面板

## 用户目标

用户希望把无限画布右下角的小地图移到左上角，并参考即梦 AI 画布：画布保持主区域，右下角提供“小鱼助手 / 与 AI 对话”入口，打开后真实 AI 对话出现在右侧，分隔条可拖拽、吸附收起；最新反馈要求右栏最多占工作区 40%，使画布一直宽于对话区。现有聊天框只有说明和跳转按钮，缺少正文与输入能力。

## Owner、入口与设置

- 运行入口：Web/Desktop 共用 Client 的 `/apps/workspace/canvas`。
- 位置和显示 Owner：`packages/client/ui-workspace/src/CanvasWorkspace.tsx`，由 React Flow `MiniMap` 提供。
- 小鱼会话、流式运行、权限、草稿与 Agent 能力 Owner：`packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 装配 `packages/client/ui-chat/src/AiWorkChat.tsx`；画布路由复用该唯一会话运行时，不复制聊天/流式实现。
- 外观 Owner：`packages/client/ui-workspace/src/canvas-workspace.css`；顶部栏、左侧工具轨、画布/右侧面板与拖拽分隔条均在此处布局。
- 设置中心已存在 `UserSettings.canvas.showMiniMap`（默认 `true`），由 Settings Owner 校验、按账户持久化并映射到 `canvasSettings.showMiniMap`；本轮只调整位置，不添加配置、不改变用户保存值。
- 设置中心已存在 `UserSettings.canvas.agentPanelDefaultOpen`（默认 `false`），由 Settings Owner 校验和按账户持久化；沿用它控制进入画布时是否默认展开真实助手面板。分隔条宽度仅在当前页面实例内调整，不新增持久化设置。
- 颜色继续使用 Appearance/Workbench 共享主题令牌；项目/画布数据与权限链不变。

## 修改范围与可验收目标

- 小地图显示时固定出现在画布左上区域，和顶部栏、工具轨保持清晰间距，不遮挡两者。
- 继续响应 `canvas.showMiniMap`：关闭后小地图仍隐藏；不写入或重置设置。
- 保留窄容器和短屏下现有小地图隐藏行为；中等及桌面容器不出现新增横向/纵向溢出。
- “与 AI 对话”入口打开后显示已有真实聊天正文、输入区和流式过程；继续使用工作区的同一账户、会话、Provider、已登记能力、授权模式及 Agent 执行链，不显示伪造消息。
- 桌面默认面板宽度沿用 DockKit 右栏初始规则（22%，240–340px）；画布和面板由 `ResizableWorkbench` 作为同级区域排布并同步分配空间，右栏最大占工作区 40%，使画布始终宽于对话区。分隔条直接复用统一的吸附收起、反向拖回、键盘调整与 Pointer 清理行为。面板宽度不读写 localStorage；关窗后会话实例保留，防止关闭面板导致正在进行的流被卸载。
- 窄分栏/手机以可读面板呈现，短屏可达关闭与输入操作；所有外观继续遵守 Appearance 主题、字体、遮罩/模糊和减少动态效果设置。
- 不改变画布节点/素材数据、生成任务或真实偏好；不改聊天 Owner 的流式实现，不创建第二会话或 iframe。
- 直接回归、ui-workspace 类型/构建、Web 构建通过，产物只写入根 `dist/`。
- 批次一（已完成）：小地图左上位置与设置说明；定向回归、类型/构建和实页证据见下文。
- 批次二（进行中）：嵌入真实助手并加入右下角入口、右侧拖拽面板；批次完成后先跑直接相关检查，再用当前源码 Web 的 ChatGPT 内置浏览器在 `/apps/workspace/canvas` 检查桌面和窄屏/短屏开合、拖拽、输入与主题；记录视口、交互、截图和未测边界。不得为验收改变账户偏好或执行真实模型请求/工具。

## 实施与验证记录

- `CanvasWorkspace` 给 React Flow `MiniMap` 指定 `top-left`；工作区 CSS 将面板放在左 72px、上 72px，中等窄栏再下移至 100px，避开工具轨与可能换行的顶栏。≤640px 宽和 ≤640px 高继续隐藏。
- 设置中心沿用现有 `canvas.showMiniMap`；只更新位置说明，未修改、读取或保存用户偏好。
- 定向源码回归 `client-canvas-minimap-position.test.mjs`：1/1 通过；`pnpm run typecheck` 通过；`pnpm --filter lfaa-client-ui-workspace run build`、`pnpm run build:web`、`pnpm run build:control-plane` 均通过，构建产物位于仓库根 `dist/`；`node scripts/runtime-build-state.mjs web` 返回 `[]`；`git diff --check` 通过。
- 正式 Web 通过当前 checkout 的 `pnpm run lfaa -- web --no-local-daemon` 启动；预检按数据目录归属重启了旧 PID 32456。路由 `http://127.0.0.1:3000/apps/workspace/canvas` 返回 200，`/api/health` 为 `status=ok`、`persistence=ready`。
- ChatGPT 内置浏览器桌面视口 1312×1244：改动前小地图矩形约 `(1096, 1078, 201×151)`；改后左上为 `(87, 87, 201×151)`，顶栏 `(12, 10, 1288×34)`、工具轨 `(12, 414, 48×415)`，小地图与两者均无重叠。当前页面截图在本轮内置浏览器验收输出中。
- 内置浏览器窄容器 680×720：小地图位于 `(87, 115)`，顶栏底部 44px、工具轨左缘 12px；与两者无重叠，页面 `scrollWidth` 未超过视口宽度；截图在本轮浏览器验收输出中。
- 边界检查：640×720 时小地图按既有规则隐藏；1312×620 短屏时小地图同样隐藏；两者无页面横向溢出。验收没有改变设置或画布数据；测试后已调用浏览器视口 `reset()` 清除临时覆盖。
- 只读检查 `/settings?section=canvas`：小地图说明显示“画布左上角”，开关仍为“显示”；没有点击开关或写入偏好。最终恢复到 `/apps/workspace/canvas` 默认视口 1312×1244，小地图仍在左上角。
- 验收时点击顶栏设置入口曾导航到 `settings?section=%5Bobject%20Object%5D`；随后直达受支持的 `section=canvas` 页面完成只读核对。该导航表现是独立问题，不属于本轮位置修改。
- 本次变更是静态定位，没有新增动画、计时器、订阅或渲染循环；未测帧时间与真实平板/手机设备。源码/构建、内置浏览器实页检查结果分别记录如上。

### 批次二：画布右侧真实小鱼助手（复用 DockKit 分栏）

- 目标：通过画布右下入口打开由 ApplicationWorkspace 唯一装配的 AiWorkChat；画布中心区和助手右栏由 `ResizableWorkbench` 同级排布，右栏最大占工作区 40%，直接复用共享拖拽、吸附收起、反向拖回、键盘调整与拖动清理；默认宽度使用 DockKit 22% 初始规则；窄布局按真实容器 Dock/Overlay 响应；关闭时保留聊天组件，避免打断运行中的回复。
- 源码/回归/构建：右栏最大宽度设为实际工作区 40%，默认宽度仍使用 DockKit 22% 规则；启用 `persistState={false}` 保持宽度为页面实例状态。画布助手定向回归 2/2、DockKit 响应式与吸附回归 28/28、TypeScript、Web 构建通过；控制端构建通过，`node scripts/runtime-build-state.mjs web` 返回 `[]`，产物位于根 `dist/`。
- ChatGPT 内置浏览器路由 `http://127.0.0.1:3000/apps/workspace/canvas`：桌面 1280×900 默认对话栏 282px；实拖至上限后右栏 511px、中心画布 768px，继续右拖松手后 `data-right-collapsed=true`、画布恢复约 1279px；重新打开恢复拖动宽度且历史聊天仍在。浏览器错误日志为空。
- 响应式实测：620×720 窄容器下中心 371px、对话栏 248px，文档无横向溢出；1280×580 短屏下中心 1023px、对话栏 256px，输入区可见、文档无溢出；临时视口覆盖已 `reset()`，恢复内置浏览器默认视口 1759×1244。最终页面对话栏拖至约 40%（703px），中心画布 1055px。
- 首次页面载入会自动初始化默认工作区/默认画布；服务日志记录到既有初始化请求以及默认画布创建和随后的保存请求。本轮没有通过画布节点或正文控件编辑内容，没有发送聊天消息或模型请求；未删除该默认项目。最终构建后的再次载入只记录工作区初始化请求，未再写入画布项目。
- 会话 UI 已确认复用 ApplicationWorkspace 唯一装配的 AiWorkChat 和既有会话；本轮没有发送模型请求，未实测真实 Provider 的流式回复、拖动帧时间或物理手机/平板。
