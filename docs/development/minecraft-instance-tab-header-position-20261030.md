# Minecraft 实例页切换 tab 时标题区位置跳动（2026-10-30）

<a id="lfaa-minecraft-instance-tab-header-position-20261030"></a>

## 用户问题与目标

- 用户提供实例配置页截图，指出在同一组实例 tab 间切换时，顶部大标题区应保持位置稳定；切到“服务器配置”和“世界备份”时标题区会移动，而“实例概览/控制台”相对正常。
- 实际入口：`/games/minecraft/instance/:instanceId/{overview,configuration,terminal,backup}`；截图当前路径为 `/games/minecraft/instance/45f694c3-fbf3-447c-a848-80c6a5c5724c/configuration`。
- 目标结果：切换四个 tab 后，共享标题区和 tab 导航的水平/垂直锚点保持稳定；标题、说明和操作可按页面真实变化，但不能使上方公共框架跳位。桌面、窄分栏、手机和短屏布局均可读且可滚动。

## 入口、Owner、设置与数据边界

- UI 入口由共享 Workbench 将实例路由解析后装配到 `packages/client/ui-minecraft/src/MinecraftWorkspace.tsx`；实例页布局与样式的唯一 Owner 是 `packages/client/ui-minecraft`。共享路由/Workbench 只负责承载与导航，不在本任务复制滚动或布局规则。
- 复用既有 Minecraft 实例快照和 tab 路由。验收只读页面、tab 导航和几何信息；禁止触发实例启停/重启、控制台 PTY 输入、配置保存、世界备份或其他数据写入。
- 设置中心：不新增或修改设置；继续遵循已映射的主题、强调色、字体/字号、对比度、壁纸/遮罩/模糊、`general.cardMotionEffect` 与 `appearance.advanced.reducedMotion`。不引入新动效或固定主题值。
- 安全与权限：不改认证、服务端权限、节点范围、Minecraft 状态门禁、API 或 Daemon 合同。
- 允许改动：上述 Minecraft UI Owner 的最小结构/CSS、能捕捉标题区坐标偏移的长期回归、任务合同与索引；不改其他同时在研的 Minecraft 文件管理/布局任务内容。

## UI 技能与排查流程

- 已按 LFAA 前置硬规则读取 Taste App Screens、Impeccable、Audit Skills、UI Motion、UI/UX Pro Max、Baseline UI；采用“保留既有产品外观与真实交互、优先修复布局稳定性、按容器响应式验证”的建议，不重新设计页面、不加动画。Audit Skills 明确不覆盖 TypeScript/React/CSS 安全扫描。
- 用户选择启用可选 `diagnosing-bugs`；用户最新截图明确指出标题区高度与 controls 行布局不统一，并示意将 controls 移至标题右侧。按此方向建立页头左右结构、描述占位高度和响应式断点回归；不再把问题归因于滚动位置。

## 可观察验收

1. 在同一真实实例路由依次切换“实例概览、服务器配置、控制台、世界备份”，共享标题区与 tab 导航的 `getBoundingClientRect()` 相对位置不因 tab 变化而漂移；控制台页只验证静态已停止状态，不附着终端。
2. 对页头左右两盒布局、实例说明固定一行占位、桌面右侧 controls 与窄容器上下排列运行包内回归；同一实现通过。保留实例标识、当前身份、读取缓存和导航数据，不创建假能力。
3. 当前源码工作区的直接回归、Minecraft UI 包构建、Client 类型检查和 Web 构建通过；产物仅写根 `dist/`。
4. 使用从当前 checkout 启动的 Web 服务，在 ChatGPT 内置浏览器检查实际实例路由；覆盖桌面、窄分栏和手机/短屏代表尺寸，记录视口、四个 tab 的坐标和截图证据。若服务启动需影响未知/正在工作的服务，先核实归属，不结束未知进程。
5. 记录源代码/构建与真实浏览器结果的差异；不测帧时间时明确列为未测。保持 Settings/Appearance 用户偏好和实例数据不变。

## 实施与验收记录

- 状态：完成；按用户布局示意将标题/说明放入左盒、状态/操作放入右盒，并在同一页头父盒中统一实例 tab 的高度。
- 根因：概览/控制台没有说明文字，配置/备份有说明；旧页头的 flex 控件在 800px 容器断点下纵向排列，说明文字会把右侧按钮及 tab 推下去。首次实页检查还发现 Ant Design 注入的 `.ant-typography` 样式覆盖了同特异度的单行限高；最终选择器明确限定实例页头、copy 与描述槽，确保一行裁切生效。窄视口实际检查确认 560px 堆叠阈值过早，因此仅把该页头自身的上下排列阈值收至容器宽度 420px。
- 实现：共享页头作为父盒，左侧子盒放标题和固定 22px 单行说明槽，右侧子盒放状态与操作。内容容器宽于 420px 时左右并排；420px 及以下上下排列。每个实例 tab 均预留同高说明槽，控制台没有说明时隐藏占位文字。保持控制台工作区满高行为，不再重置页面滚动位置。
- 设置与数据边界：不新增或修改设置、API、权限与实例数据；沿用现有 Appearance 颜色、字体、字号及容器令牌。验收只导航 tab；没有启停实例、输入终端、保存配置或创建备份。
- 回归/构建：`pnpm --filter lfaa-client-ui-minecraft test` 通过，4/4；`pnpm --filter lfaa-client-ui-minecraft run build` 通过；`pnpm run build:web` 通过（含客户端 TypeScript 检查与 Vite 生产构建）；正式 Harness 菜单完整 Web 模式通过 `pnpm run build:control-plane` 与 Web 重建并启动；`node scripts/runtime-build-state.mjs web` 和 `node scripts/runtime-build-state.mjs host` 均返回 `[]`。Vite 保留既有单块大于 500kB 的提示，本任务未改动代码分块策略。
- 内置浏览器实页：路由 `/games/minecraft/instance/45f694c3-fbf3-447c-a848-80c6a5c5724c/{overview,configuration,terminal,backup}`。桌面视口 1280×720、页头 x=100/y=70/w=877/h=70，tab y=163/h=39；实例概览、服务器配置、控制台、世界备份的页头与 tab 坐标一致。控制台只读显示实例已停止，没有附着终端。窄分栏视口 900×720、页头宽 518px，左右列分别 309px/191px、y=64/h=70、tab y=152，盒子无交叠；四个 tab 相同。手机/短屏视口 760×640、页头宽 394px，上下排列为 h=120，控件 y=148，tab y=196；四个 tab 相同且文档无横向溢出。响应式视口覆盖均已恢复默认值。上述截图由本轮 ChatGPT 内置浏览器验收时捕获；没有把临时截图写入源码仓库。
- 其他边界：没有改外观/通知设置或偏好，没有触发实例数据写入；没有测真实帧时间、物理手机/平板设备。
- 本轮触及文件：`packages/client/ui-minecraft/src/MinecraftWorkspace.tsx`（实例页头左右父子盒与统一说明槽）；`packages/client/ui-minecraft/src/MinecraftWorkspace.css`（专属页头网格、描述单行样式及 420px 容器断点）；`packages/client/ui-minecraft/tests/instance-header-layout.test.mjs`（四项长期布局回归）；`packages/client/ui-minecraft/README.md`（实例页头与响应式契约）；本合同和 `docs/PROMPTS.md`（根因、任务索引与验收证据）。
