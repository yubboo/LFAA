## v0.0.96 Workspace / App Shell / UI Kit 当前边界

- `@lfaa/workspace` 拥有 Chat 与 Work 两种产品 Surface：`chat/` 负责线性消息投影，`work/` 负责无限画布产品投影和低频布局持久化；`shared/` 负责二者共用 Session。
- `@lfaa/app-shell` 拥有 Shell、Left/Right、Center Chrome、Composer/RuntimeControl、Terminal、Settings，并通过 `@lfaa/workspace` 公共入口装配 Chat/Work。
- `@lfaa/ui` 继续只拥有通用 Slider、InfiniteCanvas、Effect、Resize、Motion 等 Primitive。Workspace 不能复制这些算法，UI Kit 也不能拥有 Project/Run/Provider 产品真值。
- Center 的父子顺序现在是 `Header → Workspace(Chat|Work) → Composer`；原 `center/conversation` 与 `workbench/session` Owner 已移除，避免一个 Conversation 模块同时承担 Chat 与 Work。
- v0.0.95 Infinite Canvas 的 workspaceId 节点 x/y + viewport 持久化、selected/dragging 置顶、edge behind nodes 语义保持不变。

## v0.0.95 产品 UI / UI Kit / Work Canvas 当前边界

- 产品界面（Left/Conversation/Composer/RuntimeControl/Settings）归 `@lfaa/app-shell`；每个模块的 View 与局部 CSS Module 共属该产品模块。
- `@lfaa/ui` 是共享 UI Kit，不是产品页面仓库。它可以用 TS/TSX 实现 Slider、Pointer、Canvas、ARIA 等通用交互，但不能知道 DeepSeek、强力推理、用户消息等 LFAA 业务语义。
- 产品模块样式进入本模块 `styles/*.module.css`；全局 CSS 只允许 reset / font / root token / document 基础规则，禁止跨模块业务 selector。
- Work Surface 使用 `WorkCanvasRegion → @lfaa/ui InfiniteCanvas`。InfiniteCanvas 保持高频 pan/zoom/node drag；App Shell Work Canvas Controller 只接收低频 commit 并保存节点坐标与 viewport。
- 选中/拖动节点视觉上必须位于普通节点之前，edge 始终位于节点之后；节点自由重叠，不自动重排。

本轮不改变 Reasoning Slider、强力推理粒子、Resize/Snap 视觉和行为。

## v0.0.94 Workbench 局部样式与父子 UI 边界

v0.0.94 把 Workbench UI 从“区域实现 + 全局大 CSS”迁移为模块局部样式：Left、Center Header、Conversation、Composer、AddCapability、Permission、RuntimeControl、Right、Terminal、Settings、Shell/Overlay 都有自己的 `*.module.css`。`agent-workbench.css` 只保留 reset；模块 CSS 禁止 `:global(.agent-*)` 和兄弟 class 匹配。

TS/TSX 继续拥有动态行为：状态、Capability、拖拽/阻尼/坐标、Canvas Effect 及共享 Resize/Slider 算法不转移到 CSS。父模块需要视觉变体时通过明确 Prop / `data-*` contract 传递，而不是越级选择子模块内部 class。本版冻结 v0.0.93 的用户可见视觉与交互，不在模块化任务里顺手修 Reasoning 视觉。

## v0.0.93 Workbench 父子 UI 边界

Workbench UI 按区域建立长期父子关系：

```text
Shell
├─ Left Sidebar
├─ Center
│  ├─ Header
│  ├─ Conversation / Work Surface
│  └─ Composer
│     └─ Runtime Control
├─ Right Sidebar
└─ Bottom Terminal
```

本版只移动代码归属，不修改现有 className/CSS 视觉合同。Chat Timeline 与 Composer 的左右基准、左右栏/终端 Resize/Snap、Runtime Control 的 v0.0.91 交互均保持原语义。以后任何视觉/交互修复默认只进入对应子模块；需要修改共享 Slider/Effect/Resize 时必须在 Prompt 中显式声明。

## v0.0.91 Reasoning Canvas 粒子与无闪烁提交

- 强力推理视觉由 `UiEffectHost → ParticleStreamCanvas` 渲染：Effect DOM 常驻为一个 Canvas，粒子运动使用 Canvas 2D + `requestAnimationFrame`，CSS 只负责 Canvas 的绝对定位/尺寸，不再承担粒子 keyframe 动画。
- `active` 必须严格绑定 `boostActive`：普通 reasoning 档点击闪电后立即启动粒子，关闭后取消 rAF 并清屏；最高官方 reasoning 档的 auto boost 仍可默认启动，但不会改 Provider 档位。
- Canvas 每帧直接读取父 Slider 的 `--lfaa-slider-visual-progress / --lfaa-slider-progress`，只绘制已填充区域；连续 Pointer 像素位置不进入 React State。
- standard 为粉色系；extreme 用淡粉→粉→紫→深紫的水平 Canvas Gradient。颜色来源仍是 `--lfaa-reasoning-*-color-*` Token，后续设置中心只覆盖 Token。
- Reasoning PointerUp 后仅做一次 commit；保存用串行队列，不再触发 `modelControlBusy`，因此 Slider 不会因 `.is-disabled{opacity:.45}` 在松手时闪一下。

## v0.0.90 Chat 对齐 / Provider 动态推理档位 / 稳定粒子交互

- Chat Timeline 与 Composer 共用 `--agent-page-gutter + --agent-composer-max`：用户消息右边缘对齐 Composer 右边缘，AI/错误消息左边缘对齐 Composer 左边缘。
- Runtime reasoning Slider 的 steps 直接来自当前模型 Capability 的 `reasoningEffort.options`：数量、顺序、label、value 一对一。Provider 返回 5/3/1 档就显示 5/3/1 档；没有该能力就不显示 Slider。
- UI 不全局过滤 `none/off/disabled`。如果当前模型官方 Capability 明确提供“关闭思考”，就显示；如果没有提供，LFAA 不自己生成。
- “强力推理”是独立 Agent Run Hint，不改变当前 Provider reasoning option；任意真实档位都可开/关。最高官方档只使用 extreme 粒子视觉并作为 auto Hint 位置，不重命名 Provider label。
- `DiscreteSlider` 负责白色 Thumb、`grab/grabbing`、连续 Pointer 跟手与离散 commit；Pointer Move 连续位置只写 `--lfaa-slider-visual-progress`，避免每像素触发业务 React 重渲染。
- `UiEffectHost` 稳定常驻，通过 `data-active/data-variant` 切换；普通档粉色流星，最高官方档为淡粉→粉→紫→深紫。Palette 与 Slider Accent 使用变量，供未来设置中心覆盖。
- Runtime Card 本体禁止 `translateZ(0) + will-change: transform` 这类整卡强制合成；只对粒子等真正动画子层做 compositor hint，降低 Windows/Edge 整卡闪白风险。

## v0.0.88 UI Motion / Shortcut / Resize 共享边界

共享交互继续统一放在 `packages/ui/src/ui-xxx`：`ui-motion` 负责稳定展开收起，`ui-shortcuts` 负责页面快捷键，`ui-resize` 负责阻尼 resize 运动学，`ui-overlay` 负责 outside-dismiss 与 layer tokens。业务组件只组合这些 Primitive。`Popover flicker / layout flash` 继续作为禁止回归项。

## UI 共享模块与插件贡献边界（v0.0.87）

共享 UI 新能力统一放在 `packages/ui/src/ui-xxx/`：

```text
ui-overlay/    outside dismiss / Escape / 后续 focus/portal
ui-controls/   Slider、Menu、Tooltip 等可复用交互控件
ui-effects/    声明式特效与 Effect Registry
ui-extension/  effect/slot/renderer/panel/action contribution Registry
```

既有 `layout/workbench/features` 保持不动。基础 Primitive/Control 是 UI Kernel，不做成可卸载插件；具有独立生命周期的 Effect Pack、Renderer、Panel 等可走插件 Contribution。业务 Feature 只能通过 Registry / 公共组件调用，不直接 import 可卸载插件，更不能直接修改 `document/body`。

Effect/Extension 必须支持 owner-scoped cleanup + generation。卸载插件后新 generation 不再暴露其 contribution；运行中的旧 generation 按运行时策略完成，不做中途硬拔。特效必须优先 `transform/opacity`，支持 `prefers-reduced-motion`，并在卸载/隐藏时释放资源。

## v0.0.80：设置中心「插件与能力」

Settings 新增 Plugin Manager Surface：输入 registry 包名、绝对路径、Git 地址或 tarball 后必须先“检查”，显示包身份、Plugin API、能力数、系统权限与 credential requirement；确认后才允许安装。安装完成默认禁用，用户再显式“立即启用”。已安装插件支持启用/禁用/移除。

UI 不运行 pnpm、不 import 第三方插件代码、不读取 Secret。宿主未连接时明确显示不可用，禁止伪造成功。遇到 pnpm build-script 阻止时，界面只提供“允许这些精确包并重试”，不提供全局放开脚本。

## v0.0.78：Codex 风格 Chat / Work 交互收敛

- 左上角 `LFAA` 是 Chat / Work 的唯一模式切换入口；中间 Header 不再复制第二套 Chat / Work 开关。
- Chat 空状态与 Work 模式标题在中间工作区居中表达；Work 仍是同一 Agent Runtime 的 Infinite Canvas Projection，不是第二套智能。
- Composer 权限不再使用原生 `<select>`。三档权限使用 Codex 风格解释型 Popover：`请求审批 / 替我审批 / 完全权限`，每项同时显示真实语义说明。
- `+`、权限、模型入口必须可点击；模型按钮打开 AI 设置，`+` 菜单只暴露 Runtime/Capability Registry 可以承接的入口，禁止用静态假能力冒充已经接通。
- 模型标签继续来自 Config System 当前 `selectedModelId`；Runtime 未连接时仍明确显示并禁止伪造模型回复。
- v0.0.78 的视觉原则是继承既有 LFAA token / Codex 式低噪声控件，不再使用开发占位式 Select、重复切换器和过量卡片。

## v0.0.77：Chat / Work 双核心入口与 Infinite Canvas

- 左侧主导航以“聊天 / 工作”为两个第一等入口，不再把工作台等同于聊天页。
- Chat 与 Work 只改变交互表现，不改变 `AgentRunRequest`、模型、权限 Profile、能力目录或 Runtime。
- Work 中心区使用 `packages/ui/src/features/workbench/InfiniteCanvas.tsx`；支持 pan、zoom、reset、节点拖拽与连线。
- Canvas 节点只投影 Runtime 实体，不能在 React local state 中保存唯一业务事实。
- Composer 共用三档权限：请求审批 / 替我审批 / 完全权限；模型标签来自 Config System 当前 `selectedModelId`。
- Runtime Host 缺失时发送按钮必须禁用并显示“Runtime 未连接”；禁止用静态字符串冒充模型回复。

## ChatGPT 套餐登录 UI（v0.0.76）

OpenAI `ChatGPT 套餐` 是 Host 托管认证，不是 API Key 表单的变体。UI 只根据 Provider Auth Method 的 `hostCapability` 与 Host Snapshot 决定是否可用，不允许写 `if (provider === "openai")` 之类厂商业务分支。

```text
Provider 声明 hostCapability
→ App Shell 读取 hostCapabilities["codex-app-server"]
→ UI 显示「登录 ChatGPT 并保存账户」
→ Web Host/Codex App Server 完成登录与 model/list
→ UI 展示 Probe / Model Capability
```

Subscription 不显示 Secret 输入，不保存 Token。删除项目账户的文案必须明确“只解除 LFAA 关联，不退出其他 Codex 客户端”。API Key / Token Plan 保持原有 Secret + 测试连接 + 选模 + 保存流程。

## Settings / Workbench 共享左栏宽度（v0.0.71）

主工作台与独立 Settings Surface 不仅复用同一 `ResizableWorkbench` 算法，还必须共享同一个 `leftPaneWidth` 状态。App Shell 是该宽度唯一事实源：

```text
工作台 resize → leftPaneWidth → Settings
Settings resize → leftPaneWidth → 返回工作台
```

禁止 Settings 再维护第二套 `leftWidth` state 或把 `lfaa.settings.layout.*` 当作宽度事实源。响应式 min/max clamp、snap、hysteresis 与 release 动画继续由 `ResizableWorkbench` 统一执行。

## Workbench Snap Release 动效（v0.0.66）

工作台侧栏 / Bottom Dock 的 resize 保持“普通拖拽直接跟手、到 min 进入 snap capture、Pointer 未松手可反向拉出”的状态机。反向退出 snap capture 时仅启用约 150ms 的 `snap-release` 过渡，随后立即恢复无 transition 的 Pointer 跟手；不得把 transition 长期挂在 resize 状态。

# LFAA UI 当前规范

> 本文件只描述当前 UI 事实与交互约束；历史 UI 变化看 `DEVELOPMENT_LOG.md` / `PROMPTS.md` / `CHANGELOG.md`。
> 迁移来源：`docs/standards/UI_LAYOUT.md`。

## LFAA 工作台 UI 规范

### 1. 当前原则：主区优先，不用固定断点硬挤三栏

v0.0.47 起，Workbench 不再以 `window.innerWidth < 1240 / 760` 决定布局，也不再把左栏 / 右栏写死成 280 / 360px。

响应式事实源：

```text
agent-workbench-stage 实际尺寸
→ ResizeObserver
→ resolveWorkbenchLayoutMetrics(width, height)
→ 计算 pane limits / center protection / snap hysteresis
→ 选择 Desktop / Compact / Mobile
```

这样浏览器小窗、桌面宿主、未来 Electron 内容区、DevTools 占宽都以“真正可用内容宽度”为准。

### 2. 单一几何配置源

文件：

```text
packages/ui/src/workbench/workbench-layout.config.ts
```

统一定义：

```text
left.min / initial / max
right.min / initial / max
bottom.min / initial / max
center.comfortable
separator
snapHysteresis
mobileGuard
```

每个尺寸规则由：

```text
ratio + floor + ceiling
```

组成。

解释：

- `ratio`：随容器变化；
- `floor`：防止过窄；
- `ceiling`：防止过宽；
- 最终 Pointer 几何使用 CSS px，因为 `clientX/clientY/getBoundingClientRect()` 本身就是 CSS px；
- 业务层禁止再复制一套固定侧栏宽度。

### 3. 当前参考尺寸

这只是公式输出示例，不是固定断点：

| 容器宽度 | Mode | 左栏 initial | 右栏 initial | 中央区保护 |
|---:|---|---:|---:|---:|
| 1600 | Desktop | ~288 | ~360 | ~720 |
| 1280 | Desktop | ~243 | ~307 | ~640 |
| 1100 | Desktop | ~216 | ~264 | ~550 |
| 1024 | Desktop | ~216 | ~252 | ~512 |
| 950 | Compact | ~216 | Overlay | ~475 |
| 820 | Compact | ~216 | Overlay | ~440 |
| 680 | Compact | ~216 | Overlay | ~422 |
| <680 左右 | Mobile | Overlay | Overlay | 主区全宽 |

当前动态 min 大致：

```text
左栏：196 ~ 232
右栏：228 ~ 288
Bottom：136 ~ 176（跟容器高度变化）
```

以后调整应修改布局 Token / 比例，不应在多个组件里逐个改 px。

### 4. 三种布局模式

#### Desktop：双 Dock

只有容器实际能容纳：

```text
left.initial + center.comfortable + right.initial + separators
```

才进入 Desktop。

```text
┌────左 Dock────┬────────────Center────────────┬──右 Dock──┐
│ 导航 / 项目    │ Header / Conversation        │ Tools     │
│               │ Composer                     │ Resources │
│               ├───────────────────────────────┴───────────┤
│               │                 Bottom Terminal            │
└───────────────┴─────────────────────────────────────────────┘
```

#### Compact：单 Dock + Overlay

容器放不下双 Dock，但仍能放下左栏 + 可用 Center：

```text
┌──左 Dock──┬──────────────────Center──────────────────┐
│           │ Header                                  │
│           │ Conversation             ┌─Right Overlay┐│
│           │ Composer                 │ Tools         ││
│           │                          └───────────────┘│
└───────────┴───────────────────────────────────────────┘
```

规则：

- 右栏不参与 Center 宽度计算；
- 右栏 Overlay 从 Header 下方出现；
- 终端 / 右栏关闭入口始终留在 Center Header；
- Overlay 使用 `clamp()` + 百分比，不得使用近乎全屏的固定 vw。

#### Mobile：双 Overlay

容器连左 Dock + Center 都无法舒适容纳时：

```text
┌──────────────────Center 全宽──────────────────┐
│ Header                                        │
│ Conversation                                  │
│ Composer                                      │
│ 左 / 右 Overlay 由按钮显式打开               │
└───────────────────────────────────────────────┘
```

规则：

- 左右 separator 隐藏；
- 左右栏都不参与 Center 宽度；
- 默认进入时收起左右栏与 Bottom；
- 核心 Shell Actions 必须保留；
- 触摸设备不能依赖 Hover 作为唯一入口；
- 禁止整页横向滚动。

### 5. Header 层级

```text
CenterWorkspace
├─ var(--agent-shell-header-h)
├─ Conversation
└─ Composer

RightSidebar / Desktop
├─ var(--agent-shell-header-h)
└─ Right Body

RightSidebar / Compact / Mobile
└─ Right Body
```

Shell Actions 属于 Header，不允许 absolute 漂在正文上。

### 6. Shell 控制与 Tooltip

快捷键：

```text
Ctrl+B       左栏
Ctrl+J       Bottom Terminal
Ctrl+Alt+B   右栏
```

要求：

- 使用自定义 `.agent-shell-tooltip`；
- 禁止同一按钮再加原生 `title`；
- Tooltip `pointer-events:none`；
- 左侧按钮 start 对齐；
- 右侧按钮 end 对齐；
- Mobile 可隐藏 Tooltip，但按钮必须可点击并保留 `aria-label`。

### 7. 左栏 Hover Preview

Desktop / Compact 正式收起左栏后：

```text
Hover / Focus 左栏按钮
→ Preview 临时淡入
→ 不改变 leftCollapsed
→ 离开后短延迟淡出
```

正式开合仍由 Click / `Ctrl+B`。

Mobile 禁用 Hover Preview。

### 8. 三向 Resize 与“吸附收起”

左栏、右栏、Bottom 统一语义。

#### Pointer 按住

```text
正常 Resize
→ 到当前动态 min
→ snap preview 吸到 0
```

如果仍然按住：

```text
snap preview
→ 反向拖动
→ 超过 min + snapHysteresis
→ 恢复到 min
→ 继续向外 Resize
```

#### Pointer Up

只有松手时仍 snapped 才正式 collapsed。

正式 collapsed 后：

- separator 不能重新拖出；
- 必须用 Header 按钮 / 快捷键恢复。

### 9. 动画与拖拽手感

普通 Resize：

- `requestAnimationFrame` 合并 pointermove；
- 直接写 CSS 变量；
- `transition:none`；
- 不允许 transition 追逐鼠标。

进入 snap preview：

- 允许约 180ms 短磁吸；
- pane opacity / translate 与 Grid 同步；
- 不显示 min 以下残缺内容。

正式按钮开合：

- 使用约 240ms ease-out；
- 视觉过渡与布局过渡同步。

### 10. 持久化尺寸与小窗保护

localStorage 中保存的 pane width 不是绝对真值。

容器变小时必须：

```text
stored width
→ clamp(current min, current max)
→ clamp(dynamic max based on center protection)
```

Compact / Mobile Overlay 不应错误参与另一侧 Dock 的 dynamic max。

### 11. CSS 变量要求

App Shell 主要布局变量：

```text
--agent-shell-header-h
--agent-control-size
--agent-page-gutter
--agent-content-max
--agent-composer-max
--agent-composer-bottom-gap
--agent-left-preview-width
```

Workbench 主要布局变量：

```text
--lfaa-left-size
--lfaa-right-size
--lfaa-left-column
--lfaa-right-column
--lfaa-bottom-row
--lfaa-handle-width
--lfaa-overlay-left-width
--lfaa-overlay-right-width
--lfaa-mobile-pane-width
```

新增尺寸前先判断是否应该成为变量；不要在多处复制相同 px 常量。

### 12. 代码归属

```text
packages/ui/src/workbench/workbench-layout.config.ts
→ 响应式比例 / floor / ceiling / Mode 计算

packages/ui/src/workbench/ResizableWorkbench.tsx
→ Pointer / Resize / Snap / 几何状态 / 持久化宽度 clamp

packages/ui/src/workbench/workbench.css
→ Dock / Overlay / Grid / separator / snap 视觉

packages/app-shell/src/AgentWorkbench.tsx
→ Shell 状态 / ResizeObserver / Header 按钮归属 / Hover Preview

packages/app-shell/src/agent-workbench.css
→ Header / 内容 / Tooltip / Composer / 侧栏内容视觉
```

### 13. 实机响应式验收

至少验证工作台容器接近：

```text
1600x900
1280x800
1100x800
1024x768
950x800
820x900
760x900
680x800
640x800
390x844
```

每个尺寸检查：

- Center 是否仍可用；
- Mode 是否合理；
- 左右入口是否可见；
- Overlay 是否不会把主区挤窄；
- Composer 是否溢出；
- 三向 snap 是否保持；
- 无整页横向滚动。

### 11. Hover Preview 宽度单一事实源（v0.0.48）

左栏 Hover Preview 不允许维护独立宽度。必须使用正式 Dock 当前真实 `leftWidth`：`ResizableWorkbench → onLeftWidthChange → --agent-left-preview-width → Preview`。因此默认、用户 resize、响应式 clamp 后 Hover 与 Click 都必须一致。

### 14. Composer 底部安全间距（v0.0.49）

Composer 必须保持正常 Grid 文档流，不使用 absolute / transform 假移动。底部视觉留白使用单一 Token：

```text
--agent-composer-bottom-gap
```

当前规则：

```text
Desktop → clamp(1rem, 2.4vh, 1.75rem)
Compact → clamp(.875rem, 1.8vh, 1.375rem)
Mobile  → .75rem
```

最终 padding 必须同时尊重设备安全区：

```css
max(var(--agent-composer-bottom-gap), env(safe-area-inset-bottom))
```

以后若调整 Composer 垂直位置，只修改该 Token；禁止在 `.agent-composer`、`.agent-composer-wrap` 或不同断点中再复制第二套 bottom margin / padding。
## 15. Settings / 个人中心交互（v0.0.64）

设置不属于工作台 Center 内容。共享交互固定为：

```text
左下角用户按钮
→ UserMenu（背景 blur + dim，菜单保持清晰）
→ 设置
→ 独立 Settings Surface
   ├─ 左侧：返回应用 / 搜索 / 分类导航
   └─ 右侧：当前设置内容
```

主题偏好固定为 `system / light / dark` 三态；`system` 必须监听系统 `prefers-color-scheme` 变化。左下角 Footer 的小工具顺序固定为“更新 → 主题”，用户按钮保持独立主入口。

AI Provider UI 只能作为 Settings 的“AI 服务”分类内容存在；Provider 业务仍归 Config System，不允许 Settings UI 直接发厂商请求。



## Composer ModelQuickSwitch（v0.0.85）

- 模型日常切换属于 Composer 原地交互，不属于 Settings 页面导航。
- `modelCatalog` 为空时模型按钮才作为首次配置入口；已有模型后点击必须打开本地 Popover。
- 模型列表、当前 Active Model、思考强度均来自 Config System Snapshot/官方 Capability；UI 不维护第二份模型真值。
- 思考强度只有当前模型声明 `reasoningEffort` select Capability 时显示；切换后的 settings 必须进入下一次 Agent Run。
- `管理模型` 保留为 Popover 次级入口，负责新增账户、认证、刷新目录和高级参数。

## Composer Runtime Control（v0.0.86）

模型与推理强度是一个整体 Runtime Control，不再拆成两个相邻 Popover。Composer 只显示一个紧凑入口；打开后同一张稳定悬浮卡片包含：

- 左：强力推理。含义是选择当前模型 Capability 公开的最高 reasoning 档，可能增加模型用量；不得构造厂商未声明的“超频参数”。
- 中：当前强度 + 当前模型。点击打开卡片内部模型列表，不跳 Settings。
- 右：重置。恢复该模型声明的 defaultValue；无 defaultValue 时按中间档规则回退。
- 下：reasoning slider。必须支持 pointer 点击、拖拽、方向键、Home/End；拖动时只更新 UI preview，Pointer Up 后才提交 Config System，避免连续写 Host。
- 强力推理效果：允许粒子/流星视觉，但只能使用 transform/opacity 等 compositor-friendly 动画；`prefers-reduced-motion` 必须停用。

### Popover flicker / layout flash 禁止项

`Popover flicker / layout flash` 指点击或切换浮层时，局部区域瞬间闪白、闪黑、跳位或尺寸抖动。LFAA 把它视为 UI 回归，不接受“功能能点”作为通过。

防线：

1. 一个视觉整体只保留一个稳定 shell，禁止通过两个互斥 Popover 反复 mount/unmount 模拟同一控件。
2. 浮层必须脱离文档流；Runtime Control 使用 absolute positioning + `contain: layout paint`，不得推动 Composer 重新布局。
3. outside dismiss 统一使用 `@lfaa/ui/useDismissibleLayer` 的 pointerdown capture；禁止每个组件自写 click/focus 竞态。
4. 模型列表打开只改变卡片内部 panel；模型切换后 Runtime Control 本体保持挂载。
5. 视觉动画优先 transform/opacity；需要布局属性动画时必须证明不会造成闪烁。

### Dismissible Layer

小型 Popover / Menu 默认复用 `useDismissibleLayer`：点击 layer 外任意位置或按 Escape 即关闭。当前应用于 LFAA 模式菜单、Composer 添加菜单、权限菜单、模型 Runtime Control。个人中心/主题这类全屏聚焦 Overlay 可以继续使用显式 Backdrop，但不能再复制 document outside-click 逻辑。

### 权限卡

三档权限仍为“请求审批 / 替我审批 / 完全权限”，但卡片必须紧凑，默认宽度上限 22rem；完全权限保留风险色。权限选择同样支持点击空白处关闭。

