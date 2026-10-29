<a id="lfaa-ui-skills-and-minecraft-manual-20261029"></a>

# LFAA UI Skills 约定与 Minecraft 手动面板优化（2026-10-29）

## 用户问题、目标与入口

- 用户问题及影响：Minecraft 应用手动模式截图中的中间内容区卡片密度和层级不一致，区块视觉显得松散，缺少有意义的交互反馈。
- 当前行为/复现步骤：进入 Minecraft 应用的手动模式总览页，查看控制节点、实例、任务、版本、服务器状态、最近事件和快捷入口。当前卡片与下方状态区在网格、间距、视觉层次和动效上不一致。
- 期望结果：保留真实数据和现有功能，将总览整理成一致、易扫读且有 Minecraft 产品辨识度的工作面板；添加克制、可访问并尊重减少动态效果偏好的微交互。
- 运行入口：`/apps/minecraft/normal` 及该入口的总览子页；由 App 手动模式进入，不覆盖聊天、画布、其他 Minecraft 子页或共享四栏外壳。

## Owner、设置与数据边界

- 运行装配：`packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 根据当前 App 与手动模式动态加载 Minecraft 面板。
- UI Owner：`packages/client/ui-minecraft/src/MinecraftWorkspace.tsx` 持有页面结构与交互；`MinecraftWorkspace.css` 持有 Minecraft 手动面板的唯一局部样式。
- 状态/数据 Owner：Minecraft 总览、节点、实例、任务与部署状态经 `packages/client/connection` 读取 `packages/games/minecraft` 的认证 API；本任务不增加数据通道、不伪造状态，也不改变节点执行。
- 设置中心：沿用 `appearance`（主题/颜色/强调色/字体与字号/对比度/壁纸/遮罩/模糊/减少动态效果）、Minecraft 对应背景槽及现有全局卡片动效控制；以 Settings Owner、共享值和 Client 映射为准。实施前须实查字段默认值、持久化和映射；不新增设置、不改变账户偏好。
- 权限/数据：只读真实工作区数据；继续使用认证 API 和领域权限边界。不发送命令、不部署或启停 Minecraft 实例、不操作节点、不更改 EULA/许可、不修改真实用户设置。

## UI Skills 前置约定

- LFAA UI 开发必须先检查并读取 Taste Skill、Impeccable、Audit Skills、UI Motion、UI/UX Pro Max、Baseline UI 六项技能的当前 `SKILL.md`。缺少任一项时，先用 Codex skill-installer 从仓库源安装到当前用户的 Codex skills 目录；技能不可用时不得开始 UI 编码，并在合同中记录阻断。
- 本次实际技能：`design-taste-frontend`（`Leonxlnx/taste-skill`）、`impeccable`（`pbakaus/impeccable`）、`audit-skills`（`RuoJi6/audit-skills`）、`ui-motion`（`linyi-ui/ui-motion-skill`）、`ui-ux-pro-max`（`nextlevelbuilder/ui-ux-pro-max-skill`）、`baseline-ui`（`ibelick/ui-skills`）。技能仅作设计/审查参考，不替代 LFAA Owner、设置、权限、响应式、浏览器验收和构建规则。
- `audit-skills` 当前针对 Java/.NET/PHP。用于本次 UI 时只采用其适用的安全边界原则，不将其声明为对 TypeScript/CSS 的专项扫描结果；另按 LFAA UI Owner 检查确认本次未改认证、授权、输入校验或数据流。
- 详细安装来源、技能名和路径需同步到 `开发规范.md`；技能本体不复制进产品运行树或新增产品依赖。

## 已核实的设计方向与配置

- Taste Skill 的 `devtools` app-screen 抽取了 `data-terminal`、`achromatic-ledger`、`framed-sheet` 三个方向；选用 `data-terminal`，因为本页是长时间查看的服务器监控界面。产品辨识点选为真实 Daemon 心跳与运行状态。采用安静数据层级、数字对齐和强调色用于状态/焦点的思路；该方向给出的深色固定色板与外部字体不覆盖用户主题、颜色和字体偏好，不新增装饰性数据。
- Impeccable 0.1.18 上下文引擎下载失败，已按技能降级要求检查项目文档并直接读取页面源码、`operate`、`layout`、`animate`、`polish` 与 `craft-floor` 等指南。仓库未找到 `PRODUCT.md`/`DESIGN.md`，不伪造产品上下文。Operative 页面采用稳定布局、统一密度与有意义的反馈；不做页面载入编排或滚动装饰动效。
- UI/UX Pro Max 首次 UX 搜索结果与指标卡片不够贴合，按技能要求收窄后得到移动端触控目标、目标间距和响应式约束；React 栈搜索仅提供通用 React 组件建议，其中 RSC 安全版本条款不适用于 LFAA 当前 React 18 Client 页面。实施继续使用当前 React/CSS Grid/Ant Design，不新增依赖。
- Baseline UI 用于最后一轮间距、字号层级、可读性和组件一致性清理；保留 LFAA CSS 与主题令牌，不迁入 Tailwind 类或其动画依赖。
- UI Motion 的动作计划：仅给实际可交互的指标按钮和 Daemon 节点预览提供 hover/focus/pressed 反馈；经共享 `lfaa-card-motion` Owner 读取 `general.cardMotionEffect`，用户选择 `none`、`appearance.advanced.reducedMotion=on` 或系统减少动态效果时静态呈现。不为普通面板和实时数据更新播放入场/循环动画；不用计时器、观察器或额外动画运行时。

- 设置盘点：`general.cardMotionEffect` 默认 `fluid`，由 Settings Owner 按账户持久化、校验为共享 `UI_MOTION_EFFECT_OPTIONS` 的 `fluid`/`fade`/`lift`/`none`；`appearance.advanced.reducedMotion` 默认 `system`，可为 `system`/`on`/`off`。Workbench 将两者映射到 `data-card-motion-effect`/`data-reduced-motion`，`client/ui-theme` 的共享动效样式负责效果与停用规则。
- 同一区域现有 Appearance 默认：主题 `system`、强调色 `#3457d5`、Minecraft 背景槽 `none`、界面字号 14、代码字号 12、界面/正文/代码字体 `system`、对比度 60；全局遮罩 65%、模糊 14px，区域覆盖沿用 `resolveWorkbenchAreaEffects`。这些值及账户已存偏好由设置中心读取/保存；本次只消费共享 CSS 令牌，不更改默认或账户值。

## 修改范围与验收

- 允许修改：本任务合同、`docs/PROMPTS.md`、根 `AGENTS.md`、`开发规范.md`、`packages/client/ui-minecraft/src/MinecraftWorkspace.tsx`、`MinecraftWorkspace.css` 及其 `README.md`；如检查证明确有必要，可纳入直接相关的共享卡片动效 Owner，但须先扩展本节并说明调用关系。
- 禁止改变：Minecraft 数据和 API 合同、权限/认证、运行实例与节点行为、其他 App 的共享工作台几何、设置中心字段/默认值/持久化、用户现有外观偏好；不引入新 UI/动画依赖，不把外部技能建议直接复制成 LFAA 实现。
- 可观察验收：桌面中间内容网格对齐且卡片统一；小宽度/窄分栏能合理重排且无横向溢出；真实零/非零/加载/错误状态仍准确；主要导航按钮行为与现有一致；hover/focus/press 提供轻量反馈并符合键盘/触屏及减少动态效果；相邻 Minecraft 视图与共享头部保持原行为。
- 分批验收：B1 统一总览分区与卡片网格；本批完成后先运行直接相关检查并用当前 Web 源码在内置浏览器实测。B2 在 B1 页面基线上添加动效与状态反馈；本批再运行相关检查并实测同一路由。每批记录实际路由、宽×高、交互、截图与未测边界。
- 构建/回归：运行 `lfaa-client-ui-minecraft` 直接构建、Client 类型检查、必要的 Minecraft UI 定向回归与 Web 正式构建；检查 Web 指纹和 `git diff --check`。运行前确认脚本真实存在；构建输出只写仓库根 `dist/`。
- 页面验收：先核验源码与关键 Web 构建指纹，再从当前 checkout 启动正式 Web 服务，在 ChatGPT 内置浏览器检查实际手动模式路由。至少检查常用桌面视口及一个窄分栏/短屏视口；不触发真实写入、任务、命令、外观保存或实例控制。

## 实施与验收记录

- 计划方向与技能建议：已在上方记录并应用的技能建议；保留真实状态和 LFAA 用户外观设置。
- 设置盘点：已核对现有默认值、Settings Owner 校验/账户持久化与 Workbench/CSS 映射；无新增设置项。
- 本机安装：`taste-skill` 已从 `Leonxlnx/taste-skill` 安装；缺失的 `impeccable`、`audit-skills` 已安装；旧版 `ui-motion`、`ui-ux-pro-max` 已归档保留并更新为用户指定仓库版本；`baseline-ui` 已存在且与指定仓库技能文件一致。
- **B1（统一视觉层级）：** `MinecraftWorkspace.tsx` 给四项管理摘要加入有名称的 `group` 语义；`MinecraftWorkspace.css` 统一卡片内边距、表面、圆角、最小高度、文本层级与数字对齐，提升同步元信息可读性，并让设置壁纸时的摘要网格使用现有遮罩/模糊令牌。保留既有两列/单列容器断点、真实数据和点击导航。
- **B1 检查：** Minecraft 包构建、`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm run build:web`、`git diff --check` 通过。B1 后已在 ChatGPT 内置浏览器打开当前源码页面并查看截图/AX 结构；页面实际 URL 重定向为 `/games/minecraft`，顶部显示“手动”模式。版本公告遮罩覆盖中间部分；没有关闭公告，因为关闭会按账户/版本写入本地确认状态。AX 树仍确认摘要、状态/事件/快捷入口和真实节点数据存在。
- **B2（共享反馈动效）：** 四项摘要按钮与 Daemon 节点预览行注册 `lfaa-card-motion`，沿用 `ui-theme` 的卡片动效；移除摘要卡本地 transform 动画，补充按压表面反馈。没有添加列表入场、计时器、观察器或 JS 动画；`none` 与减少动态效果仍由共享 Owner 停用变换/过渡。
- **B2 浏览器/设置：** 运行入口 `pnpm run dev:frontend` 来自当前 checkout，报告 `http://127.0.0.1:5173/`；内置浏览器实际地址 `http://127.0.0.1:5173/games/minecraft`，手动模式选中。桌面 `1280×720`：摘要区宽 748px、2 列，每张卡 `368×103px`；窄分栏 `820×900`：工作区宽 362px、摘要卡 1 列、313px；短屏 `390×600`：工作区宽 318px、摘要卡 1 列、294px。三处根页面均无水平溢出。卡片文字对比度实测标签/说明 9.64:1、数值 14.94:1；当前 `general.cardMotionEffect=fluid`、`appearance.advanced.reducedMotion=system`，系统未请求减少动态效果；DOM 上摘要与节点按钮都消费共享 motion class，计算过渡来自 `ui-theme`。
- **截图/交互边界：** 内置浏览器已捕获 `1280×720`、`820×900`、`390×600` 页面截图，截图留在本轮 CUA 观察记录中。版本公告仍遮挡中心内容；没有触发公告确认写入，所以不能实测摘要 hover/焦点操作、节点/实例/任务导航、页面滚动后的完整可见区域或浮层与主内容交叠。Vite 会话日志有一次 WebSocket 代理 `ECONNABORTED`，之后页面仍显示后续状态同步且浏览器 Console error 为 0；未确认该代理中断的原因。未做真机/物理设备、帧时间/CPU profile、壁纸启用和其他主题实测。偏好、Minecraft 任务/实例/节点数据均未写入。
- **正式服务边界：** 根 `dist/apps/web` 已在构建后更新。端口 3000 上已有 PID 5004 服务，经先前检查不能确认属于当前 checkout；未复用、停止或以生产 CLI 启动第二个同用户数据服务，以免触碰未知工作区或现有数据锁。真实浏览器当前使用从本 checkout 启动的 Vite 前端 `5173`，API 代理仍连既有服务。它完成当前源码实页检查，但不是生产 CLI 菜单运行；该项在环境解除占用归属不明后补验。
- **技能静态检查：** Taste `lint.mjs --app` 最终 `0 FAIL / 6 WARN`。外观设置壁纸遮罩渐变已加行内理由注释；其余 warning 来自该旧页面既有 eyebrow、静态阴影、两个设置驱动的 backdrop blur、控制台代码字体及 10 处长破折号，不涉及本轮新规则/动画。Impeccable 0.1.18 上下文引擎下载仍受环境阻断；手册、页面上下文与参考指南已读取并人工应用，`impeccable.cmd context` 未成功执行。
- **安全/性能：** `audit-skills` 的明确覆盖仅为 Java/.NET/PHP，未对 TSX/CSS 声称专项安全扫描。人工边界检查确认本轮 TSX 仅改 aria/class、CSS/README/文档；未改 API、认证、授权、校验、数据读取和写入。实现没有新增订阅/请求/主线程计算/动态数据或动画循环；帧时/内存未测，不能据此声称流畅实测。
- **最终构建：** `pnpm --filter lfaa-client-ui-minecraft run build`、`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm run build:web` 与 `git diff --check` 通过；Vite 转换 3901 个模块，产物在根 `dist/`。Taste lint 结果见上项。用户预先存在的 `packages/client/ui-workspace/src/css/center-workspace.css` 改动与 `docs/development/center-workspace-topbar-inset-20261029.md` 未触碰。
