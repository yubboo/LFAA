## v0.0.96 Workspace 领域聚合当前事实

当前 Node workspace 增加为 10 个，其中新增的 `@lfaa/workspace` 是有真实 Consumer 的 Workspace Feature Composition，不是规划占位。

```text
@lfaa/app-shell
└─ product Shell / Chrome / Composer / Settings
   └─ consumes @lfaa/workspace public API

@lfaa/workspace
├─ chat/      Chat 线性投影
├─ work/      Work / Infinite Canvas 产品投影、布局持久化
└─ shared/    Chat/Work 共用 Session Controller / contract
```

`@lfaa/ui` 继续是 UI Kit / Interaction Engine；InfiniteCanvas 的高频 Pointer/Zoom/Drag 属于 UI Kit，Work 的 workspaceId 布局事实属于 Workspace。`@lfaa/agent-runtime` 仍是 Chat/Work 唯一 Run Protocol；本轮没有建立第二套 Runtime。

**防过度拆包：** 同一领域默认在一个父 package 下按子目录分层。只有真实的独立生命周期/部署、跨领域复用或多个 Consumer 才升格独立 package。没有 Consumer 的 `project/canvas/workflow/task/asset/model/tool/storage` 只保留规划，不建空目录。

## v0.0.95 / #21.24 模块内职责分层 + Work Canvas Owner

- `@lfaa/app-shell`：LFAA 产品 UI 唯一 Owner；Workbench 模块按需采用 `view / logic / styles / contracts / index.ts`。
- `@lfaa/ui`：UI Kit / Design System / Shared Interaction Engine；只提供通用 UI 积木与交互算法，不拥有 Provider/Config/Session 产品真值。
- `workbench/center/conversation/work-canvas/`：Work Canvas 产品视觉布局 Owner；`logic` 负责 workspace-scoped node positions / viewport 持久化，`view` 只投影 `InfiniteCanvas`。
- `workbench/session/logic`：只负责 Chat/Work Run、Runtime event、permission、surface 和 `lastRunInput`，不拥有 Canvas 几何。
- `apps/web/src`：浏览器运行时；`apps/web/dev`：Vite dev-server/Node Host runtime；二者按运行环境隔离。
- 本轮 Reasoning/Particle/Resize/Snap/Provider/Agent Runtime 行为冻结。

状态：`pending-user-acceptance`。

## v0.0.94 / #21.23 Workbench 全域模块 Owner

- `AgentWorkbench.tsx`：Composition Root，只总装配。
- `workbench/shell/`：Theme、Chrome、LayoutMode、左右/底部面板装配、快捷键、Overlay。
- `workbench/left/`：左侧栏与 ProfileBar；局部 brand menu 自己拥有。
- `workbench/center/header/`：中央 Header。
- `workbench/center/conversation/`：Chat Timeline / Work Canvas。
- `workbench/center/composer/`：draft、submit、Add/Permission 菜单协调。
- `workbench/center/composer/runtime-control/`：模型快切、reasoning preview/commit queue、boost。
- `workbench/right/`：右侧资源栏。
- `workbench/terminal/`：底部终端。
- `workbench/settings/`：Settings Surface、AI/Plugin snapshot/controller/view model。
- `workbench/session/`：Chat/Work surface、permission、Run event subscription/startRun。
- `workbench/shared/`：仅 Workbench 内真正跨模块的 Icon/Button 等小 Primitive。

每个 UI 模块只拥有自己的 CSS Module；共享动态算法继续来自 `@lfaa/ui`。本版状态 `pending-user-acceptance`，只做等价模块迁移。

## v0.0.93 / #21.22 Workbench 父子模块

- **父模块：** `packages/app-shell/src/AgentWorkbench.tsx` 只做 Composition Root。
- **四个大模块：** `left/LeftSidebarRegion`、`center/CenterWorkspaceRegion`、`right/RightSidebarRegion`、`terminal/BottomTerminalRegion`。
- **Center 子模块：** `CenterHeader`、`ConversationRegion`、`ComposerRegion`。
- **Composer 子模块：** `RuntimeControl`；模型/reasoning/强力推理的后续修改不得顺带编辑 Left/Right/Terminal/Conversation。
- **共享 Primitive：** Slider/Effect/Resize/Overlay 继续只归 `@lfaa/ui`。
- **状态：** pending-user-acceptance；v0.0.93 只做等价迁移和边界门禁，不做视觉重构。

## v0.0.91 UI Effect Renderer / Release Archive 职责收敛

`packages/ui/src/ui-effects` 现在明确拆成 Registry/Host 与 Canvas Renderer：`UiEffectHost` 不做逐帧动画，`ParticleStreamCanvas` 是当前 reasoning-overdrive 的唯一绘制实现。`packages/app-shell` 只拥有 boost/variant 业务投影与 reasoning setting 串行保存。

发布工具新增 `scripts/release-archive.mjs`，负责 ZIP UTF-8 entry 字节规范；Sync 继续只负责稳定工作区来源校验与镜像同步，不承担归档生成。

## v0.0.90 推理控制职责收敛

- `packages/app-shell/src/reasoning-control.ts`：纯函数把当前模型 `reasoningEffort.options` 一对一投影为 Runtime steps；不固定档位、不排序、不补齐、不过滤 `none/off`，不拥有 Provider 真值。
- `packages/ui/src/ui-controls/DiscreteSlider.tsx`：共享任意 step 数量的连续拖拽/白色 Thumb/键盘/settle，不包含模型语义。
- `packages/ui/src/ui-effects/`：共享流星粒子、standard/extreme Palette 与稳定挂载 Host；只接收“当前是否最高官方档”的视觉 variant。
- `packages/agent-runtime`：`AgentExecutionHints.reasoningBoost` 与 `AgentModelBinding.settings` 分离，每个真实 Provider 档位都可独立开/关。
- `apps/web/dev/bridges/agent`：开发态只解释 `reasoningBoost` Hint；绝不把它伪装成 Provider 未声明的 reasoning setting。

## v0.0.88 UI / Runtime 新模块

- `packages/ui/src/ui-motion`：AnimatedDisclosure。
- `packages/ui/src/ui-shortcuts`：useShortcut。
- `packages/ui/src/ui-resize`：阻尼 Resize 原语。
- `apps/web/dev/bridges/agent`：Web 开发态 Agent Runtime Adapter。

## v0.0.87 UI：ui-xxx 共享模块与插件贡献 seam

`packages/ui` 继续是图形 UI 唯一主域。新增共享能力固定进入 `src/ui-overlay / ui-controls / ui-effects / ui-extension`；既有 `layout/workbench/features` 不迁移。`ui-overlay/ui-controls` 属于稳定 UI Kernel/SDK；`ui-effects/ui-extension` 提供 Registry seam，让具有独立生命周期的 Effect/Renderer/Panel/Action 后续通过 Plugin/App Pack 注册。

`packages/app-shell` 只消费公共 UI API：模型推理 Slider 不再持有 Pointer Capture 算法，强力推理不再持有粒子 CSS。普通插件不得深链 App Shell 或直接操作 DOM。

## v0.0.86 App Shell / UI：统一 Runtime Control / Dismissible Layer

`packages/app-shell` 继续只做运行时控制的 UI Projection；Active Model 与模型 settings 真值仍归 `@lfaa/config-system`。v0.0.86 删除模型/强度双 Popover，改为单一 Runtime Control Card。`useDismissibleLayer` 成为小型 Popover/Menu 的唯一 outside-dismiss Primitive（v0.0.87 起位于 `packages/ui/src/ui-overlay/`），业务模块禁止复制 document pointer/click 监听。强力推理只选择当前模型 Capability 的最高公开 reasoning 档，粒子效果属于 presentation，不进入模型业务协议。

## v0.0.85 App Shell / Config：ModelQuickSwitch 边界

`packages/app-shell` 拥有 Composer 的交互投影，但不拥有模型业务真值；可选模型来自 `AiAccountSnapshot.accounts[].modelCatalog`，当前模型来自 `activeModel`。`packages/config-system` 新增缓存目录快速激活方法；`apps/web` 只桥接该业务动作。思考强度来自当前模型官方 Capability 的 `reasoningEffort` select 字段，并随 `AgentModelBinding.settings` 进入 Runtime。

## v0.0.84 Web Host：Provider Network Adapter 边界

`apps/web/dev/bridges/ai/node-http-json.ts` 是 Web 开发宿主当前唯一 Provider HTTP JSON Adapter。它负责 Node 网络初始化、超时、TLS/代理兼容和脱敏错误分类；Provider URL/Header 仍由 `@lfaa/config-system` Provider plugin 决定，Secret 仍由 Credentials/Rust Broker 持有。Windows Setup 只负责启动期网络环境适配，不拥有 Provider 业务。

## v0.0.83 Config System：Account / Model Selection 边界收敛

`@lfaa/config-system` 明确分离两个事实：`AiAccountRecord` 负责“如何连接/认证某 Provider”，`AiActiveModelBinding` 负责“当前 Agent 真正使用哪个账户/模型”。账户内 `selectedModelId` 是该账户默认选择，不再承担全局当前模型职责。

账户同时保存最近一次已验证/官方来源的 `modelCatalog` 快照，Settings 重开可直接呈现模型与 Capability；重测负责刷新目录。`packages/app-shell` 只把 Config Snapshot 投影给 Chat/Work，不能自行从 accounts 推导当前模型。

## v0.0.80 真实模块骨架 / Plugin Profile P1

当前 workspace 不再预创建未来模块。9 个 Node 项目按 foundation/runtime/domain/presentation/composition/host-adapter/host 分层，1 个 Rust crate 作为当前唯一真实 Native Kernel 实现。新增模块必须有当前 Consumer。

Plugin 平台从 P0 Contract 进入 P1 Lifecycle：`plugin-sdk` 定义 Manifest/Capability/Credential requirement；`plugin-runtime` 拥有 Registry generation 与统一 PluginManager；`plugin-host-node` 拥有独立本地 Profile 与 pnpm 事务；`ui` 只呈现；`app-shell` 只做映射/装配；`apps/web` 提供同源本地 bridge。

`@lfaa/credentials` 是 Config 与未来 Plugin 共用的 Secret Service Definition，真实 Windows Provider 仍由 Rust Secret Broker 承担。

# LFAA 模块、计划与进度

## v0.0.78 Plugin Platform 基线

### Plugin SDK / Capability Contract

`packages/plugin-sdk` 现在拥有唯一的 `LfaaPluginManifest / LfaaCapabilityDescriptor / LfaaAppPackDescriptor / LfaaExternalAdapter` 公共协议。Capability 覆盖 Tool、Skill、Expert、Agent、Subagent Provider、Command、Workflow、MCP、Model Provider、Harness Adapter、Workbench Node、Artifact Renderer、UI Extension 与 App Pack。

统一采用 `Common Contract + namespaced extensions`：LFAA 公共层负责发现、权限、展示、组合；Codex / DeepSeek Harness / MCP / 未来生态的高级字段必须通过 `extensions` 无损保留。

### Plugin Runtime

`packages/plugin-runtime` 是 Plugin / Capability 注册事实的唯一 Owner，使用 generation snapshot：新资源先校验，再构建下一 generation，最后原子发布；运行中的 Run 固定启动时 generation。Registry 不执行 Tool，不拥有 OS 权限。

### App Pack

App Pack 是能力组合而不是第二套应用核心。游戏开服、写作、拆图、Minecraft 插件/Mod 等产品场景应通过 Manifest + Capability IDs + Skills/Experts/Workflow/Workbench Extensions 组合。

### Language Ownership

TypeScript 持续迭代产品/Agent 平面；Rust 只保留稳定 Native primitive 和安全边界；Python 仅未来 Optional Runtime。`language-ownership-check.mjs` 防止 apps/packages 混入 Rust/Python 产品实现，或 crates 反向承载 TS/Python Agent 业务。

### v0.0.78 Windows 依赖同步

稳定工作区 Sync 在“依赖声明未变化且目标 lockfile 不比来源更弱”时保留目标 `pnpm-lock.yaml`，避免版本包旧 lockfile 每次覆盖本机由 pnpm 生成的有效 lockfile。Setup 也不再因为 dependency-state 缓存缺失/指纹变化本身强制 `pnpm install`；只有真实缺包、解析失败或 lockfile 确实不完整才安装。


## v0.0.77 当前模块升级

### Agent Runtime / Workbench

`packages/agent-runtime` 成为 Chat / Work 共用的运行时公共契约层，当前已落 Model Binding、Capability Descriptor、Run Host、三档 Permission Profile、Codex / DeepSeek Harness 官方 Bridge Registry。后续真实 Tool Runtime、Session/Event、Harness Host Adapter 都必须接在这条脊柱上，禁止重新在 UI 里造第二套 Agent。

`packages/ui/src/features/workbench` 新增 Infinite Canvas；`packages/app-shell` 只负责 Surface 编排与 Projection。Config System 继续负责账号/认证/模型选择，不提升为执行 Runtime。

### Windows Runtime Scripts

`workspace-preflight.mjs` 是 Sync / GitHub 唯一静态预检入口。PowerShell 只负责调用、呈现和记录结果，不再各自复制一套 Gate 列表。


> 模块职责、模块 Plan、模块 Progress 统一维护在本文件。新增模块时新增一个长期章节，不再创建 `modules/plans/progress` 三套目录。

## project-foundation

> 迁移来源：`docs/modules/project-foundation/README.md`

### project-foundation

#### 作用

建立 LFAA 的仓库骨架、治理、规范、架构入口、文档体系与模块边界。

#### 状态

```text
deliverable
```

#### 不负责

不实现真实 Agent 业务、不实现配置 UI、不连接真实模型。

#### v0.0.2 优化

新增 `@/` / `@lfaa/*` 导入路径规范和自动检查，防止深层相对路径破坏模块边界。

> 迁移来源：`docs/plans/modules/project-foundation/PLAN.md`

### project-foundation PLAN

#### 状态

```text
deliverable
```

#### 目的

建立 LFAA v0.0.1 开发基础。

#### 范围

- 产品身份
- Monorepo
- 根目录当前规范
- 当前/历史架构隔离
- 命名规范
- 模块边界
- Plan/Progress
- Prompt
- Changelog
- Version
- Apps/Packages/Crates 骨架

#### 验收

- AI 进入根目录可找到开发入口；
- 当前和历史架构物理隔离；
- 主模块与下一步明确；
- 骨架模块有 README；
- Rust workspace 可独立检查；
- Governance check 可执行。

#### #16 横向加固范围

- LFAA 官方命名、作者署名、版权与第三方归属；
- 项目级 Skills / Experts / Plugins / Extensions / MCP；
- 性能、安全和质量门禁；
- 路径无关的依赖安装与开发检查菜单。

#### #21.17 Composer 底部安全间距

##### 任务原因

v0.0.48 输入框距离窗口底边过近，视觉重心偏低；现有 `.agent-composer-wrap` 仍使用固定 `.5rem` bottom padding，没有按 Desktop / Compact / Mobile 与安全区变化。

##### 实施顺序

1. 保留 v0.0.48 为历史版本；
2. 归档 #21.16 Active Log；
3. 新增单一 `--agent-composer-bottom-gap`；
4. Desktop / Compact / Mobile 只覆盖该 Token；
5. Composer Wrap 同时尊重 `safe-area-inset-bottom`；
6. UI contract 增加变量化底部间距防回归；
7. 同步 Prompt / Progress / Log / UI Standard / Test / Changelog / Release；
8. 执行治理、语法、版本、ZIP、PowerShell BOM 门禁。

##### 验收条件

- 全屏下 Composer 比 v0.0.48 上移且留白自然；
- 小窗口不会因过大的固定间距浪费高度；
- Mobile safe area 正常；
- 不改吸附、响应式模式、PTY 和基础设施。

#### #21.16 Hover / Click 左栏宽度统一

##### 任务原因

v0.0.47 正式左栏和 Hover Preview 使用两个宽度来源，用户实机发现两者宽度不一致。

##### 实施顺序

1. 保留 v0.0.47 为历史版本；
2. 归档 #21.15 Active Log / Prompt；
3. 从 ResizableWorkbench 回传真实 leftWidth；
4. App Shell 用一个 CSS 变量供 Hover Preview 使用；
5. 删除 Preview 独立 clamp 宽度；
6. 增加 UI contract 防回归；
7. 同步文档与发布记录；
8. 执行治理、语法、版本、ZIP、PowerShell BOM 门禁。

##### 验收条件

- Hover Preview == 点击展开宽度；
- resize 后仍一致；
- 响应式 clamp 后仍一致；
- 不改三向吸附、PTY 和基础设施。

#### #21.15 容器响应式与布局变量化

##### 任务原因

v0.0.46 使用固定 `280 / 360` 最小宽度与固定 `1240 / 760` viewport 断点。Windows 实机缩小浏览器后，左右栏仍会占用过多横向空间，中央区被挤窄；同时 TS 与 CSS 分别维护尺寸，后续维护容易漂移。

##### 本次范围

允许修改：

- `packages/ui/src/workbench/workbench-layout.config.ts`（新增）；
- `packages/ui/src/workbench/workbench-layout.types.ts`；
- `packages/ui/src/workbench/ResizableWorkbench.tsx`；
- `packages/ui/src/workbench/workbench.css`；
- `packages/ui/src/index.ts`；
- `packages/app-shell/src/AgentWorkbench.tsx`；
- `packages/app-shell/src/agent-workbench.css`；
- UI 静态契约门禁；
- Prompt / Plan / Progress / Development Log / UI Standard / Test / Code Map / Changelog / Release。

禁止修改：

- Sync / GitHub / Setup / Update 业务逻辑；
- PTY bridge 与 node-pty 协议；
- Config / Agent Runtime / Permission / Rust Native 边界。

##### 实施顺序

1. 保留 v0.0.46 为历史版本；
2. 归档 #21.14 Active Log / Prompt；
3. 新增单一布局变量与计算公式文件；
4. 使用 ResizeObserver 观察 Workbench 容器，而不是 window 固定断点；
5. 根据 left/right/center 实际需求自动选择 Desktop / Compact / Mobile；
6. Compact 右栏保持 Overlay、Mobile 双侧栏 Overlay；
7. 历史持久化 pane width 随当前容器重新 clamp；
8. CSS 改用变量 / rem / clamp / calc，删除旧固定 Drawer 尺寸；
9. 保持 min 吸附收起 + Pointer 不松手反向解锁语义；
10. 更新静态 UI 契约与全部当前事实源；
11. 执行治理、语法、版本、ZIP、PowerShell BOM 门禁。

##### 验收条件

- App Shell 不存在固定 LEFT/RIGHT/BOTTOM_LIMITS；
- 响应式由容器宽高计算；
- 1024 左右宽度能保持可用中央区，不被 280/360 固定侧栏挤坏；
- 760~950 左右进入左 Dock + 右 Overlay；
- 更窄容器进入双 Overlay；
- 侧栏 min 明显小于 v0.0.46，但内容仍可读；
- 三向吸附不回退；
- Windows 脚本与 PTY 业务逻辑不变。

#### #21.14 最小尺寸吸附收起语义修正

##### 任务原因

v0.0.45 把 min 以下设计成“弹性压缩区”，导致面板仍然处于展开状态时可以被压得过窄，右栏文字和快捷键出现截断。用户明确要求：**到最小可用尺寸就应该吸附收起，而不是继续以更窄尺寸展开。**

##### 本次范围

允许修改：

- `packages/app-shell/src/AgentWorkbench.tsx`；
- `packages/app-shell/src/agent-workbench.css`；
- `packages/ui/src/workbench/ResizableWorkbench.tsx`；
- `packages/ui/src/workbench/workbench.css`；
- UI 静态契约门禁；
- Prompt / Plan / Progress / Development Log / UI Standard / Test / Code Map / Changelog / Release。

禁止修改：

- Sync / GitHub / Setup / Update 业务逻辑；
- PTY bridge 与 node-pty 协议；
- Config / Agent Runtime / Permission / Rust Native 边界。

##### 实施顺序

1. 保留 v0.0.45 为历史版本；
2. 归档 #21.13 Active Log 与 Prompt；
3. 删除 min 以下弹性展开算法；
4. 到 min 即进入 snap capture / 收起预览；
5. Pointer 不松手时保留反向恢复能力；
6. 提高左 / 右 / Bottom 可用最小尺寸；
7. 调整 Desktop / Compact 断点以容纳新 min；
8. 更新 UI 静态门禁；
9. 同步当前事实源与发布记录；
10. 执行治理、语法、版本、ZIP、PowerShell BOM 门禁。

##### 验收条件

- 左栏 min 280、右栏 min 360、Bottom min 180；
- 展开态不得出现 min 以下尺寸；
- 到 min 即进入吸附收起预览；
- Pointer 不松手可反向拖过迟滞区，恢复到至少 min；
- Pointer Up 后正式 collapsed，separator 不能拖出；
- Desktop / Compact 断点为 1240 / 760；
- Windows 脚本和 PTY 业务逻辑不变。

#### #21.13 Web 响应式与弹性吸附重构（历史）

##### 任务原因

v0.0.44 在 Tooltip 单一来源上已修正，但用户 Windows 实机缩小浏览器后发现：右栏浮层仍可覆盖绝大多数主区、Header 控件在覆盖布局中不可见，且左右/底部吸附从 min 硬跳到 0，拖拽手感生硬。

##### 本次范围

允许修改：

- `packages/app-shell/src/AgentWorkbench.tsx`；
- `packages/app-shell/src/agent-workbench.css`；
- `packages/ui/src/workbench/ResizableWorkbench.tsx`；
- `packages/ui/src/workbench/workbench.css`；
- UI 静态契约门禁；
- Prompt / Plan / Progress / Development Log / UI Standard / Test / Code Map / Changelog / Release。

禁止修改：

- Sync / GitHub / Setup / Update 业务逻辑；
- PTY bridge 与 node-pty 协议；
- Config / Agent Runtime / Permission / Rust Native 边界。

##### 实施顺序

1. 保留 v0.0.44 为历史版本；
2. 归档 #21.12；
3. 增加 Desktop / Compact / Mobile LayoutMode；
4. Compact 右栏和 Mobile 双侧栏改为 Drawer；
5. 保证核心 Shell Actions 在小屏 Header 始终可见；
6. Tooltip 增加贴边方向；
7. 左 / 右 / 底部统一弹性磁区状态机；
8. Pointer 拖拽期间禁止 CSS transition；
9. 更新静态 UI 契约检查；
10. 同步所有当前事实源与发布记录；
11. 执行治理、语法、版本、ZIP、PowerShell BOM 门禁。

##### 验收条件

- 1180 / 760 两个响应式断点有明确模式；
- Compact 右 Drawer 不超过 420px / 56vw 上限；
- Mobile 主区全宽，Header 核心入口可用；
- 三向拖拽按住时均可从 snap capture 反向拖回 min；
- Pointer Up 后正式 collapsed，separator 不能拖出；
- 拖拽时不启用 transition 追鼠标；
- Tooltip 不贴边裁切；
- Windows 脚本和 PTY 业务逻辑不变。

#### #21.11 Web 工作台 Header 联动布局

##### 任务原因

v0.0.42 的 #21.10 已把 Shell Actions 移到中间区域左右上角，但按钮仍通过 `position:absolute` 漂在正文层，和用户提供的 Codex 参考中“按钮属于顶部工作区 Header”的结构不一致。

##### 本次范围

允许修改：

- `packages/app-shell/src/AgentWorkbench.tsx`；
- `packages/app-shell/src/agent-workbench.css`；
- #21 Active Prompt / Development Log / UI Layout / Web UI Test；
- Changelog / Release / 版本号。

禁止修改：

- Sync / GitHub / Setup / Update 业务逻辑；
- `ResizableWorkbench` 拖拽吸附算法；
- PTY 协议与 Vite node-pty bridge；
- Config / Agent Runtime / Permission / Rust Native 边界。

##### 实施顺序

1. 保留 v0.0.42 为旧版本；
2. 把 #21.10 当前日志归档；
3. 新建 Center Header 与 Right Shell Header；
4. 右栏开合时迁移终端/右栏按钮归属；
5. 保留左栏 Hover Preview / 快捷键 / 三向吸附；
6. 同步 Prompt / Progress / Log / UI Standard / Changelog / Release；
7. 执行治理、语法、版本、ZIP、PowerShell BOM 门禁。

##### 验收条件

- Shell Actions 不再使用正文 absolute 浮层；
- Center Header / Right Header 高度一致；
- 右栏展开与收起时按钮位置符合当前结构事实；
- Tooltip 与快捷键提示存在；
- v0.0.42 的 Sync / GitHub / Setup / Update 脚本字节不变；
- 旧 #21.10 有 Archive，新 #21.11 为 Active。

#### #4.3 / #20.4 Windows 脚本编码与开发规范执行闭环

##### 任务原因

v0.0.41 为 Windows PowerShell 脚本补中文结构化文件头时，保存过程把原本的 UTF-8 BOM 去掉，破坏了 Windows PowerShell 5.1 的脚本编码兼容性。这说明“代码可读性”规范与“可执行文件编码”规范之间缺少自动门禁。

##### 本次范围

允许修改：

- `scripts/windows/*.ps1` 的编码，不改变原有业务行为；
- Windows 脚本编码治理检查；
- DEVELOPMENT / AGENTS / Standards / Development Log / Prompt / Progress / Changelog / Release；
- 版本号与发布包。

禁止修改：

- Web UI 交互；
- 同步算法语义；
- GitHub Push 流程；
- Setup / Update 的业务逻辑；
- Protocol / DB Schema / 安全执行边界。

##### 实施顺序

1. 保留 v0.0.41 作为历史缺陷版本；
2. v0.0.42 从 v0.0.41 递增；
3. 恢复所有 Windows PowerShell 脚本 UTF-8 BOM；
4. 新增 `windows-script-encoding-check.mjs`；
5. 接入治理链路；
6. 更新 #4.3 与 #20.4 的当前/历史记录；
7. 做版本一致性、ZIP 根目录、中文路径、PowerShell BOM Round-trip 验证。

##### 验收条件

- 4 个 `scripts/windows/*.ps1` 均以 `EF BB BF` 开头；
- 去掉 BOM 后的脚本文本与 v0.0.41 业务逻辑一致（除本次允许的说明性注释变更）；
- `governance:check` 会在 BOM 缺失时失败；
- v0.0.42 的 CHANGELOG / Release / Prompt / Development Log / Progress 完整；
- ZIP 内项目根无额外嵌套目录；
- ZIP 解压后 PowerShell BOM 仍保留。

> 迁移来源：`docs/progress/modules/project-foundation/PROGRESS.md`

### 2026-09-18 / #21.17 Composer 底部安全间距

- 当前状态：pending-windows-visual-test
- 用户实机发现：v0.0.48 Composer 距离窗口底边过近，下方留白偏薄。
- 已完成：新增 `--agent-composer-bottom-gap` 单一布局 Token。
- 已完成：Desktop 使用 `clamp(1rem, 2.4vh, 1.75rem)`，Compact 使用更小的响应式间距，Mobile 使用 `.75rem`。
- 已完成：`.agent-composer-wrap` 使用 `max(var(--agent-composer-bottom-gap), env(safe-area-inset-bottom))`。
- 已完成：UI contract 增加 Composer bottom-gap 防回归检查。
- 不改：Hover/Click 宽度统一、三向吸附、响应式 Mode、PTY、Sync / GitHub / Setup / Update。
- 用户版本：v0.0.49
- 待完成：Windows Chrome / Edge 实机确认全屏、小窗、终端打开状态下底部留白自然。

#### 2026-09-18 / #21.16 Hover / Click 左栏宽度统一

- 当前状态：pending-windows-visual-test
- 用户实机发现：v0.0.47 Hover Preview 与点击正式展开宽度不同。
- 已完成：Preview 改为共享 ResizableWorkbench 当前真实 leftWidth。
- 已完成：新增 `onLeftWidthChange`，App Shell 使用 `--agent-left-preview-width` 单一变量。
- 已完成：删除 Preview 独立 CSS clamp 宽度。
- 已完成：UI contract 增加共享宽度防回归检查。
- 不改：三向吸附、响应式 Mode、PTY、Sync / GitHub / Setup / Update。
- 用户版本：v0.0.48
- 待完成：Windows Chrome / Edge 实机确认 Hover 与 Click 无宽度跳变。

#### 2026-09-18 / #21.15 容器响应式与布局变量化

- 当前状态：pending-windows-visual-test
- 用户实机发现：v0.0.46 固定左 280 / 右 360 和固定 1240 / 760 断点在小窗口下仍会把主区挤坏，与 ChatGPT / Codex 的自适应差距明显。
- 已完成：新增 `workbench-layout.config.ts`，集中管理 ratio / floor / ceiling / center / separator / snap hysteresis。
- 已完成：App Shell 删除固定 `LEFT_LIMITS / RIGHT_LIMITS / BOTTOM_LIMITS`。
- 已完成：使用 `ResizeObserver` 监听工作台容器尺寸，并通过 `resolveWorkbenchLayoutMetrics()` 自动选择 Desktop / Compact / Mobile。
- 已完成：Desktop 只有在容器实际能同时容纳 left + center + right 时才双 Dock。
- 已完成：Compact 为左 Dock + 右 Overlay；Mobile 为主区全宽 + 双 Overlay。
- 已完成：右 Overlay 宽度改为 CSS 变量 + `clamp()` / 百分比，不再使用 420px / 56vw / 88vw。
- 已完成：历史持久化 pane width 在容器缩小时重新 clamp 到当前动态 limits 与 center 保护上限。
- 已完成：动态 min 当前大致为左 196~232、右 228~288、Bottom 136~176，替代 v0.0.46 固定 280 / 360 / 180。
- 已完成：三向“到 min 吸附收起、Pointer 不松手反向解锁、松手才提交 collapsed”语义保留。
- 已完成：UI contract 改为检查容器响应式、变量化布局和旧固定断点/Drawer 禁止回归。
- 不改：Sync / GitHub / Setup / Update、PTY bridge、Agent Runtime。
- 用户版本：v0.0.47
- 待完成：Windows Chrome / Edge 1600 / 1280 / 1024 / 950 / 820 / 680 / 390 多尺寸实机视觉与手感确认。

### project-foundation PROGRESS

#### 2026-09-18 / #21.14 最小尺寸吸附收起语义修正

- 当前状态：pending-windows-visual-test
- 用户实机发现：v0.0.45 允许右栏在 min 以下继续作为展开布局存在，导致工具文字 / 快捷键被挤坏；吸附语义被错误实现成“吸附展开到超窄尺寸”。
- 已完成：删除 `elasticSize()` / `snapCommitThreshold()` 当前算法。
- 已完成：左 / 右 / Bottom 到达 min 即进入 snap capture / 收起预览。
- 已完成：Pointer 按住期间仍可反向拖过 `min + snapHysteresis`，恢复到至少 min 并继续拉伸。
- 已完成：左栏 min 提升到 280px，右栏 min 提升到 360px，Bottom min 提升到 180px。
- 已完成：Desktop / Compact 边界调整为 1240 / 760，避免更大的最小尺寸压坏中央区。
- 已完成：UI contract 改成“禁止 min 以下展开态”的新契约。
- 不改：Sync / GitHub / Setup / Update、PTY bridge、Agent Runtime。
- 用户版本：v0.0.46
- 待完成：Windows Chrome / Edge 实机确认吸附手感与最小宽度可读性。

#### 2026-09-18 / #21.13 响应式重构与弹性吸附

- 当前状态：pending-windows-visual-test
- 用户实机发现：v0.0.44 在窄窗口中右栏覆盖过宽、核心按钮可见性不足，页面布局会崩；三向吸附从 min 到 0 的过渡过硬。
- 已完成：新增 Desktop / Compact / Mobile 三档 LayoutMode（1180 / 760）。
- 已完成：Compact 右栏改 Drawer，Mobile 左右栏改 Drawer；核心 Header 按钮始终保留。
- 已完成：响应式 Drawer 从 48px Header 下方出现，移除旧版 88vw 覆盖方案。
- 已完成：Tooltip start/end 对齐，防止贴边裁切。
- 已完成：左右栏 / Bottom Terminal 统一 elasticSize + snapCommitThreshold。
- 已完成：Pointer 按住时进入 snap capture 后可反向拖回 min；只有 Pointer Up 才正式 collapsed。
- 已完成：拖拽期间彻底关闭 Workbench transition，正式展开/收起统一 ease-out。
- 已完成：UI contract 门禁加入响应式和弹性吸附静态契约。
- 不改：Sync / GitHub / Setup / Update、PTY bridge、Agent Runtime。
- 用户版本：v0.0.45
- 待完成：Windows Chrome / Edge 多尺寸实机视觉与手感确认。

#### 2026-09-18 / #21.11 Header 联动与按钮归属修正

- 当前状态：pending-test
- 用户实机发现：v0.0.42 的左右 Shell 按钮虽然位置接近目标，但仍漂在正文层，没有进入顶部工作区 Header。
- 已完成：Center Header 结构化为正常第一行；左栏按钮 + 标题 + 更多 / 分享进入中间 Header。
- 已完成：右栏展开时终端 / 右栏按钮进入 Right Shell Header；右栏收起时回到 Center Header。
- 已完成：新增自定义快捷键 Tooltip，保留 `Ctrl+B` / `Ctrl+J` / `Ctrl+Alt+B`。
- 保留：左栏 Hover Preview、三向吸附、真实 PTY、资源桥。
- 不改：Sync / GitHub / Setup / Update 业务逻辑。
- 用户版本：v0.0.43
- 待完成：Windows 浏览器实机视觉确认。

#### 2026-09-18 / #4.3 + #20.4 PowerShell 编码回归修复

- 当前状态：delivered
- 缺陷来源：v0.0.41 补中文注释时意外移除 Windows PowerShell 脚本 UTF-8 BOM
- 影响：Sync / GitHub / Setup / Update 四个 `.ps1` 都存在 Windows PowerShell 5.1 误解码风险
- 已完成：4 个 `.ps1` 恢复 UTF-8 BOM，且去除 BOM 后正文与 v0.0.41 完全一致
- 已完成：新增 Windows 脚本编码门禁，负向测试可正确阻止 BOM 缺失
- 已完成：新增发布版本一致性门禁，DEVELOPMENT / AGENTS 固化开发规范触发器
- 已完成：#20.3 归档、#20.4 Active、#4.3 delivered，Prompt / Changelog / Release / Standards 同步
- 验证：governance / import / dev-log / docs / comment / Windows encoding / release consistency 全部通过
- 验证：ZIP 无额外根目录，中文路径 UTF-8 标志正常，解压 Hash Round-trip 0 缺失 / 0 多余 / 0 不一致，PowerShell BOM 保留
- 配置系统业务实现：不改动
- 用户版本：v0.0.42

#### 2026-09-18 / #20.3 + #21.10 可读性与当前 UI 事实源同步

- 当前状态：pending-test
- #21 当前实现：中间主区左上角左栏按钮、右上角终端/右栏按钮、左栏 Hover 临时预览
- #20.3 已完成：结构化中文源码注释、CSS 盒子分区、项目结构地图、一级目录 README、comment-check 门禁
- 已修正文档漂移：UI Layout / Active Prompt / Development Log / Web UI Test 与代码重新一致
- 配置系统业务实现：未改动
- 用户版本：v0.0.41
- 待完成：Windows 浏览器实机视觉与交互验证

#### 2026-09-18 / #21.9 Web 常驻工作台 Chrome

- 当前状态：pending-test
- 已完成代码：Web 全宽 Workbench Chrome、左栏 / 终端 / 右栏常驻按钮、侧栏 Hover 壳层入口移除
- 保留：三向拖拽吸附、真实 PTY、GitHub 推送修复、中文路径保护
- 待完成：Windows 浏览器实机视觉位置与交互验证
- 用户版本：v0.0.38

#### 2026-09-18 / #19.10 Rustup Windows Target 缺失修复

- 当前状态：delivered
- 已完成：
  - 恢复 Get-WindowsRustupTarget
  - Windows x64 / ARM64 / x86 target 映射
  - 未知架构安全失败
  - Governance 防回归门禁
- #21 真实终端状态：pending-test
- 是否已交付：Setup 修复已交付（v0.0.35）

#### 2026-09-18 / #19.9 node-pty Smoke Check 引号兼容

- 当前状态：delivered
- 已完成：
  - node-pty 独立 Smoke Check 脚本
  - 移除 Windows Setup 内嵌 node -e 检查
  - PowerShell 5 参数引号兼容修复
- #21 真实终端状态：pending-test
- 是否已交付：Setup 修复已交付（v0.0.34）

#### 2026-09-18 / #19.8 node-pty 跨机器安装

- 当前状态：delivered
- 已完成：pnpm 精确 allowBuilds、严格门禁保留、Setup node-pty Smoke Check
- 解决：全新机器 ERR_PNPM_IGNORED_BUILDS
- 是否已交付：v0.0.33

#### 2026-09-18 / #21.7 侧栏 Hover 与真实终端

- 当前状态：pending-test
- 已完成代码：侧栏 Hover / 底部 Dock / xterm / node-pty PTY
- 待完成：Windows 实机 PTY 启动验证
- 用户版本：v0.0.32

#### 2026-09-18 / #21.6 三栏交互与终端停靠

- 当前状态：delivered
- 已完成：
  - 分隔条仅拖拽
  - 顶部淡入式左右栏 / 终端控制
  - 中间底部终端停靠区
  - 右栏终端入口联动
- 是否已交付：Web 工作台 UI 继续交付（v0.0.31)

#### 2026-09-18 / #19.7 Setup 主菜单循环

- 当前状态：delivered
- 已完成：
  - Setup 主菜单循环
  - 普通操作不再退出终端
  - 取消/错误返回菜单
  - Web Ctrl+C 返回菜单
- #21 Web 工作台：#21.5 Web 启动延迟修复
- 是否已交付：基础设施变更已交付（v0.0.30）

#### 2026-09-18 / #19.6 依赖模型简化

- 当前状态：delivered
- 已完成：
  - 工具链 / 项目依赖边界定稿
  - Setup 用户提示简化
  - Rust 安装路径收敛为官方 rustup-init
  - 移除 WinGet Rust 安装分支
  - 保留 Rust 官方 SHA-256 校验
  - 已有工具链直接复用
- #21 Web 工作台状态：in-progress
- 是否已交付：基础设施变更已交付（v0.0.29）

#### 2026-09-18 / #19.5 / #21.4

- Rust 工具链分层已调整；
- 项目 Rust 版本由 rust-toolchain.toml 锁定；
- Web 端口冲突处理已加入；
- Windows 实机待验证；
- #21 UI 仍为 in-progress。

#### 2026-09-18 / #21.2 黑白工作台重构

- 当前状态：in-progress
- UI 视觉：从水墨改为 Codex / ChatGPT 类黑白灰生产力工具风格
- 已实现：浅色 / 深色、本地主题偏好、动态侧栏最大宽度、松开吸附策略
- `.lfaa` Vite 热插拔桥接：保持现有协议
- 静态治理检查：PASS
- 变更 TS/TSX 语法检查：PASS
- 完整 Vite build：当前环境缺少可用 pnpm 11.17.0，待用户 Windows 实机验证
- 配置系统业务实现：未改动

#### 2026-09-18 / #19.4 Rust 安装诊断优化

- 当前状态：delivered
- Windows 实机：Cargo / rustc 已成功安装
- 已完成：
  - CARGO_HOME 检测
  - WinGet 返回码语义化
  - WinGet 后环境重新检测
  - 官方 rustup 英文日志保留说明
  - SHA-256 安全链保留
- #21 Web 工作台状态：in-progress
- 是否已交付：基础设施变更已交付（v0.0.25）

#### 2026-09-18 / #19.3 统一开发入口

- 当前状态：delivered
- 已完成：
  - Setup 统一 Web / Desktop / Build / Release 入口
  - 删除 LFAA-Web.bat
  - 删除 lfaa-web.ps1
  - Desktop 未实现功能真实门禁
  - Governance 禁止重复启动器
- #21 Web 工作台状态：in-progress
- 是否已交付：基础设施变更已交付（v0.0.24）

#### 2026-09-18 / #19.1 一键准备真实检测

- 当前状态：delivered
- 主任务：#19 一键准备与依赖检测
- 最新变更：#19.1
- 已完成：
  - Node 24.x 真实检测
  - pnpm 版本/路径真实检测
  - workspace / Node 依赖统计
  - Rust winget 回退
  - Rust 官方 rustup-init 回退
  - 官方 SHA-256 校验
  - 部分完成状态
- 配置系统业务实现：未改动
- 是否已交付：是（v0.0.22）
- 下一步：进入 `config-schema`

#### 2026-09-18 / #10.1 GitHub 推送确认优化

- 当前状态：delivered
- 主任务：#10 GitHub 推送确认交互
- 最新变更：#10.1
- 已完成：
  - 移除远程 Push 二次确认
  - 保留 origin 配置确认
  - DEVELOPMENT 同步
  - WORKSPACE_SYNC 同步
  - Development Log 留痕
- 配置系统业务实现：未改动
- 是否已交付：是（v0.0.21）
- 下一步：进入 `config-schema`

#### 2026-09-18 / #20.2 中文命名与 docs 整理

- 当前状态：delivered
- 主任务：#20 开发日志与文档规范
- 最新变更：#20.2
- 已完成：
  - Development Log 中文文件名
  - Prompt 中文编号文件名
  - docs/README 总入口
  - 主要分类 README 索引
  - Development / Runtime Log 分离
  - runtime 日志目录迁移
  - docs-check 自动检查
  - 历史 #20.0 / #20.1 保留
- 原历史文件：保留
- 配置系统业务实现：未改动
- 是否可交付：是
- 是否已交付：是（v0.0.20）
- 下一步：进入 `config-schema`

#### 2026-09-18 / #20.1 历史编号迁移

- 当前状态：delivered
- 主任务：#20 开发日志分层规范
- 最新变更：#20.1
- 问题：#20.0 只直接显示 #20，旧编号只有 legacy 指针
- 已完成：
  - #1 - #19 逐条迁入 Development Log
  - #2 保持 active
  - #1、#3 - #19 进入 archive
  - #20.0 历史快照保留
  - INDEX 全编号可搜索
  - 主编号连续性自动检查
- 原历史文件：全部保留
- 是否可交付：是
- 是否已交付：是（v0.0.19）
- 下一步：进入 `config-schema`

#### 2026-09-18 / #20 开发日志分层规范

- 当前状态：delivered
- 最新变更：#20.0
- 本次目标：当前/历史开发日志分层、命名、中文与读取顺序硬规则
- 已完成：
  - development active/archive
  - development INDEX
  - DEV_LOGS standard
  - AGENTS 读取顺序
  - DEVELOPMENT 重构
  - NAMING 文档规则
  - dev-log-check
  - legacy 历史入口
- 配置系统业务实现：未改动
- 是否可交付：是
- 是否已交付：是（v0.0.18）
- 下一步：进入 `config-schema`

#### 2026-09-18 / #19 一键准备与项目资源根收敛

- 当前状态：delivered
- 已完成：
  - Setup 1 改为一键准备
  - 缺少 Cargo 时支持 winget 安装 Rustup
  - Rust 依赖锁文件安全策略
  - 删除根 skills/plugins 双重目录
  - `.lfaa` 唯一资源根
  - Hot Plug Registry Generation 规范
- 配置系统业务实现：未改动
- 是否已交付：是（v0.0.17）
- 下一步：进入 `config-schema`

#### 2026-09-18 / #18 Setup 缺少 Cargo 容错修复

- 当前状态：delivered
- 问题：菜单 1 在 pnpm 成功后因 Cargo 缺失错误终止
- 已完成：
  - Node/Rust 工具链预检
  - 可用工具链独立安装
  - 缺失工具链安全跳过
  - 部分完成状态明确提示
  - 菜单 4 / 10 保持严格检查
- 配置系统业务实现：未改动
- 是否可交付：是
- 是否已交付：是（v0.0.16）
- 下一步：进入 `config-schema`

#### 2026-09-18 / #17 pnpm-only 一致性修复

- 当前状态：delivered
- 已完成：
  - 根 test 脚本改为 pnpm
  - `preinstall` pnpm-only 门禁
  - Governance 禁止 root scripts 使用 npm/npx/yarn/bun
  - DEVELOPMENT/AGENTS/README 统一 pnpm-only
  - Setup 环境页不再展示 npm
- 配置系统业务实现：未改动
- 是否可交付：是
- 是否已交付：是（v0.0.15）
- 下一步：进入 `config-schema`

#### 2026-09-18 / #16 项目治理与项目级资源边界加固

- 当前状态：delivered
- 已完成：归属、项目资源、安全、性能、质量门禁、Setup 菜单、pnpm lockfile
- 配置系统业务实现：未改动
- 是否已交付：是（v0.0.15）

#### 2026-09-17 / #1

- 当前状态：deliverable
- 本次目标：建立 LFAA v0.0.1 首包骨架
- 已完成：
  - 产品命名与定位
  - 根目录 AI 入口
  - 开发规范
  - 当前架构
  - 项目计划
  - 更新日志
  - Monorepo 目录
  - TS package 边界
  - Rust crate 边界
  - DSH Compatibility 边界
  - Prompt / Plan / Progress 制度
  - 版本规则
  - Governance check
- 进行中：无
- 待开发：
  - 真实 React/Electron 依赖初始化
  - 真实数据库初始化
  - CI 完整流水线
- 待测试：
  - 真实 Node/pnpm toolchain 初始化后的完整 build
- 测试结果：
  - 文档/目录治理检查可执行
  - Rust crates 包含基础单测
- 待优化：
  - 后续增加命名自动检查
  - 后续增加架构依赖 lint
- 阻塞项：无
- 是否可交付：是
- 是否已交付：是（作为 v0.0.1 架构骨架包）
- 下一步：进入 config-system


#### 2026-09-17 / #3

- 当前状态：delivered
- 本次目标：建立 TypeScript 导入路径与 Alias 基础规范
- 已完成：
  - 新增 `docs/standards/IMPORT_PATHS.md`
  - 定义 `./` / `@/` / `@lfaa/*` 三层导入规则
  - 禁止 `../../` 及更深相对导入
  - 禁止跨 Package 访问 `src/internal`
  - 为所有 TS workspace 增加本地 `tsconfig.json`
  - 新增 `scripts/import-path-check.mjs`
  - governance check 接入导入检查
  - 同步 DEVELOPMENT / ARCHITECTURE / MODULE_BOUNDARIES
- 进行中：无
- 待开发：真实 Vite/Electron/Node bundler 初始化时同步 runtime alias
- 待测试：真实构建工具引入后的运行时 alias 测试
- 测试结果：
  - Node import-path check 通过
  - Governance check 通过
- 待优化：未来接入 ESLint architecture/import rules
- 阻塞项：无
- 是否可交付：是
- 是否已交付：是
- 下一步：继续主模块 `config-system`


#### 2026-09-17 / #4

- 当前状态：delivered
- 本次目标：建立稳定工作区同步与 GitHub 一键推送机制
- 已完成：
  - `LFAA-Sync.bat`
  - `scripts/windows/lfaa-sync.ps1`
  - `LFAA-GitHub.bat`
  - `scripts/windows/lfaa-github.ps1`
  - 新增/修改/删除真实对比
  - 全路径彩色输出
  - `.git` 永久保护
  - 本地 Secret / 缓存保护
  - 删除差异确认机制
  - 同步后 SHA-256 镜像验证
  - `.lfaa-local/sync-logs` 留痕
  - GitHub Push 前 governance check
  - WORKSPACE_SYNC 开发规范
- 进行中：无
- 待开发：正式 Release Tag/发布脚本（后续独立任务）
- 待测试：Windows 实机首次同步与首次 GitHub 授权
- 测试结果：
  - 项目静态治理检查通过
  - 导入路径检查通过
  - ZIP 根目录结构检查通过
- 待优化：未来可增加 GUI 版同步报告
- 阻塞项：当前执行环境无 Windows PowerShell，需用户 Windows 实机验证 PowerShell UI/颜色
- 是否可交付：是
- 是否已交付：是
- 下一步：继续主模块 `config-system`


#### 2026-09-17 / #5

- 当前状态：delivered
- 本次目标：将稳定工作区同步日志迁移到 docs 可见目录
- 已完成：
  - 日志路径改为 `docs/logs/workspace-sync/`
  - 新增日志目录 README
  - 运行生成的 `*.log` 不参与镜像差异判断
  - 运行生成的 `*.log` 默认加入 `.gitignore`
  - 旧 `.lfaa-local` 不再作为同步日志目录
  - WORKSPACE_SYNC / DEVELOPMENT / Governance 同步更新
- 进行中：无
- 待开发：无
- 待测试：Windows 实机执行一次同步，确认日志真实生成到新目录
- 测试结果：静态路径与治理规则已更新
- 待优化：未来可增加日志归档/清理策略
- 阻塞项：无
- 是否可交付：是
- 是否已交付：是
- 下一步：继续主模块 `config-system`


#### 2026-09-18 / #6

- 当前状态：delivered
- 本次目标：修复 GitHub 一键推送脚本首次 `git init` 失败，并按同步脚本标准重构推送体验
- 问题根因：
  - PowerShell 函数参数使用 `$Args`，与自动变量冲突
  - 导致 `git init` 实际未接收到 `init`
- 已完成：
  - `Run-Git` 重构为 `Invoke-Git -GitArgs`
  - 首次 `.git` 初始化修复
  - Git 变化真实检测
  - 新增/修改/删除/重命名彩色列表
  - staged 文件再次确认
  - 首次 Commit 名称用户自定义
  - 后续 Commit 名称同样用户自定义
  - Commit 前确认
  - Push 前确认
  - Pull --rebase 失败保护
  - GitHub Push 本地日志
- 进行中：无
- 待测试：Windows 实机完成首次 GitHub Push
- 测试结果：
  - 静态逻辑检查完成
  - GitHub 仓库地址/权限已确认
  - 当前执行环境无 Windows PowerShell，无法替用户完成本机脚本实跑
- 待优化：后续可以增加 Release Tag 独立脚本
- 阻塞项：无
- 是否可交付：是
- 是否已交付：是
- 下一步：继续 `config-system`


#### 2026-09-18 / #7

- 当前状态：delivered
- 本次目标：修复首次 origin 检测和 Git 英文原始输出
- 已完成：
  - 先检测 `git remote`
  - 首次无 origin 自动新增
  - 已有 origin 才读取 URL
  - Git stdout/stderr 捕获
  - 默认中文控制台
  - 原始错误写入 Push 日志
  - 中文路径 `core.quotepath=false`
  - 兼容上一版残留的已初始化 `.git`
- 待测试：用户 Windows 实机完成首次 Push
- 是否可交付：是
- 是否已交付：是
- 下一步：继续 `config-system`


#### 2026-09-18 / #8

- 当前状态：delivered
- 本次目标：将 Git origin 改为首次用户配置、后续自动复用
- 已完成：
  - 移除脚本硬编码仓库地址
  - 首次无 origin 提示用户输入
  - 地址格式基础验证
  - 用户确认后保存
  - `.git/config` 作为唯一事实源
  - 后续自动读取 origin
  - Push 日志记录实际 origin
- 待测试：Windows 实机首次输入 origin 并推送
- 是否可交付：是
- 是否已交付：是
- 下一步：继续 `config-system`


#### 2026-09-18 / #9

- 当前状态：delivered
- 本次目标：明确同步/GitHub脚本的终端结束状态
- 已完成：
  - GitHub 成功结束显示“可关闭”
  - Sync 成功结束显示“可关闭”
  - 失败状态同样给出明确关闭提示
  - PowerShell 统一等待任意键
  - BAT 移除重复 pause
- 待测试：Windows 实机确认两套脚本结束提示与按键关闭体验
- 是否可交付：是
- 是否已交付：是
- 下一步：继续 `config-system`


#### 2026-09-18 / #10

- 当前状态：delivered
- 本次目标：移除 Git Commit 二次确认
- 已完成：
  - Commit 名称输入后直接创建本地 Commit
  - 删除重复 Commit 确认
  - 保留 Push 前确认
- 待测试：Windows 实机确认交互流程
- 是否可交付：是
- 是否已交付：是
- 下一步：继续 `config-system`


#### 2026-09-18 / #11

- 当前状态：delivered
- 本次目标：新增 Git Clone 后的一键源码更新工具
- 已完成：
  - `LFAA-Update.bat`
  - `scripts/windows/lfaa-update.ps1`
  - 自动定位 Git 工作区
  - origin 读取
  - 本地 dirty 检测
  - fetch
  - ahead / behind 判断
  - 远程文件差异展示
  - fast-forward only 拉取
  - 分叉保护
  - 更新后校验
  - source-update 日志
  - 可关闭终端提示
- 待测试：Windows 实机对有新远程 Commit 的仓库执行更新
- 是否可交付：是
- 是否已交付：是
- 下一步：继续 `config-system`


#### 2026-09-18 / #12

- 当前状态：delivered
- 本次目标：三个 Windows 工具菜单化，并增加安全/强制更新模式
- 已完成：
  - Update 数字菜单
  - GitHub 数字菜单
  - Sync 数字菜单
  - 安全拉取
  - 仅检查更新
  - 强制拉取
  - backup branch
  - stash -u 保护未提交文件
  - 查看 Git 状态
  - 修改 origin
  - 同步预览/配置
- 待测试：Windows 实机逐项测试三个菜单分支
- 是否可交付：是
- 是否已交付：是
- 下一步：继续 `config-system`


#### 2026-09-18 / #13

- 当前状态：delivered
- 本次目标：Update 脚本不依赖盘符和固定目录
- 已完成：
  - Git root 自动识别
  - 当前目录识别
  - 附近仓库扫描
  - 多仓库数字选择
  - 手工路径输入
  - Git 仓库真实性验证
- 待测试：Windows 不同盘符/不同目录名实机测试
- 是否可交付：是
- 是否已交付：是
- 下一步：继续 `config-system`


#### 2026-09-18 / #14

- 当前状态：delivered
- 本次目标：调整同步菜单操作顺序
- 已完成：
  - 1 = 执行同步
  - 2 = 预览差异
  - 3 = 同步配置
  - 0 = 退出
- 同步核心逻辑：未改动
- 是否可交付：是
- 是否已交付：是
- 下一步：继续 `config-system`


#### 2026-09-18 / #15

- 当前状态：delivered
- 本次目标：修复安全拉取在 0/0 状态误执行文件 diff
- 已完成：
  - 0/0 提前返回
  - 本地纯领先提前返回
  - 安全模式分叉提前停止
  - 明确 ref 文件比较
  - diff-tree fallback
  - 双重失败技术日志
- 待测试：Windows 实机再次执行“已是最新”的安全拉取
- 是否可交付：是
- 是否已交付：是
- 下一步：继续 `config-system`

## config-system

- 当前进度：#2.16 / v0.0.76 OpenAI ChatGPT 套餐 / Codex App Server 登录闭环，pending-user-acceptance；ChatGPT 托管认证归 Codex App Server，Config Core 通过 Managed Auth Port 编排。
- Secret 基线：v0.0.73 Rust Secret Broker 与官方模型能力成果保留；API Key / Token Plan 仍通过 Rust Secret Broker。
- UI 交互：#2.15 / v0.0.75 已由用户验收通过；视觉宽度到 min 后锁定，隐藏超拖达到阈值才 capture。

> 迁移来源：`docs/modules/config-system/README.md`

### config-system

> v0.0.73：Account/Provider 业务继续归 Config System；Secret OS 实现迁入 Rust Broker；模型能力只接受官方 API/官方文档事实。

#### 作用

LFAA 第一个正式业务模块。

负责：

- 通用 Settings；
- 模型管理；
- Provider Account 管理；
- Permission 默认设置；
- 配置持久化；
- 配置 UI；
- 配置 Schema / Migration；
- Secret reference，不保存 Secret 明文。

#### 不负责

- Agent Loop；
- Tool 执行；
- Knowledge；
- MCP；
- Plugin Marketplace；
- Coding Agent。

#### 当前状态

```text
implementing
```

#### #2.7 Web API-Key Account

- Account/Auth/Model 业务归 `config-system/src/settings/ai/core`；
- Web Host 通过 Port 提供 JSON 元数据、Credential Manager Secret、Provider HTTP；
- UI 只收 Secret 瞬时输入与业务结果，不直接 `fetch` Provider；
- OpenAI/DeepSeek/Kimi/Qwen/MiMo 使用官方模型目录 API；智谱使用官方文档 Catalog Adapter，不再允许任意手工模型 ID；ChatGPT subscription 待 Codex App Server。
- 选中模型的思考/推理/输出等设置由 Provider Capability 声明，并在 Account Core 保存前再次校验。

> 迁移来源：`docs/plans/modules/config-system/PLAN.md`

### config-system PLAN

#### 当前状态

```text
implementing
```

#### 目标版本

```text
v0.0.2+
```

#### 开发目的

建立 LFAA 第一个正式业务模块：配置系统。

#### 子模块与顺序

0. `web-workbench-shell`（用户要求的本地 UI 验证前置，不拥有 Config 事实状态）
1. `config-schema`
2. `config-storage`
3. `settings`
4. `model-management`
5. `account-management`
6. `permission-settings`
7. `config-ui`
8. tests
9. docs
10. delivery review

#### 负责

- App Settings
- Model Provider 配置
- Model 配置
- Account Metadata
- Credential Reference
- Permission Default
- Local/Remote mode 配置
- 配置迁移

#### 明确不负责

- 真实 Secret 明文保存
- Agent Loop
- Tool Runtime
- MCP
- Plugin Marketplace
- Knowledge UI

#### 依赖

- `@lfaa/domain`
- `@lfaa/protocol`
- 后续 SQLite Repository
- Secret 只存 `credential_ref`

#### 开发前置硬门禁

- 真实 TypeScript typecheck、测试和 build 不得使用成功占位命令；
- Node.js 依赖和 workspace 命令只允许 pnpm；
- Config Schema 必须版本化且只有一个事实源；
- Migration 必须事务化、可重复验证，并具有失败恢复方案；
- SQLite 写入必须定义原子性、并发和损坏恢复策略；
- API Key / Token 不得进入普通配置、日志、Trace、错误信息或模型上下文；
- 配置读写和迁移必须在进入实现前定义可量化性能预算。

#### 验收

- 配置有唯一 Schema；
- 配置可持久化；
- 配置迁移可测试；
- Model/Account/Permission 配置边界清晰；
- UI 与配置业务分离；
- Secret 不进入 SQLite 明文字段；
- 测试完成；
- 安全、性能和质量门禁通过。


#### UI 前置任务边界

`web-workbench-shell` 只负责提供：

- Vite 本地 Web 开发入口；
- 三栏工作台框架；
- Resizable / Collapse UI；
- `.lfaa` 开发期只读资源刷新。

它不实现 Config Schema / Storage，不改变 Config System 的状态 Owner。

> 迁移来源：`docs/progress/modules/config-system/PROGRESS.md`

### config-system PROGRESS

#### 2026-09-19 / #2.16 OpenAI ChatGPT 套餐 / Codex App Server 登录闭环

- 当前状态：pending-user-acceptance
- 用户版本：v0.0.76
- Core：新增通用 Managed Auth Host Port；Subscription 账户不写 Secret，`credentialRef = null`，API Key / Token Plan 继续复用 Rust Secret Broker。
- Host：新增 `codex-app-server.ts`，固定 `codex app-server` + stdio JSONL，完成 initialize/initialized、ChatGPT login、account/read、model/list；Windows 兼容 `codex.cmd`。
- Browser/UI：用户点击时同步预开登录窗，只接受 OpenAI/ChatGPT HTTPS 域名；Provider hostCapability + Host Snapshot 决定可用性，UI 无 Provider 网络业务分支。
- 安全：不读 Codex auth 文件、不保存 ChatGPT Token；删除 LFAA 项目账户不调用全局 logout。
- 验证：仓库 Node 70/70 + Config System 33/33 = 103/103 PASS；Config System TypeScript noEmit PASS；全部治理门禁 PASS；Web Host 改动 TS 语法检查 PASS；完整 pnpm Web build 留给 Node24 + pnpm11.17.0 + 依赖齐全环境。
- 下一步：用户 Windows 实机完成 ChatGPT 登录、模型目录、刷新/删除边界验收；通过后 #2.16 才转 delivered。

#### 2026-09-19 / #2.13 Rust Secret Broker 与官方模型能力配置

- 当前状态：pending-user-acceptance
- 用户版本：v0.0.75
- Secret：删除 C#/PowerShell Credential helper；Windows 通过 `crates/secret-store` Rust FFI 访问 Generic Credential，Web Host 只走二进制 stdin/stdout Broker 协议。
- Provider：OpenAI / DeepSeek / Kimi / 千问 / Xiaomi 动态调用官方模型目录 API；智谱无已确认统一账户模型列表 API，使用官方模型概览 Catalog Adapter。
- Capability：Provider 为已核对模型返回官方来源、上下文/输出限制与真实请求参数路径；UI 无厂商分支，Account Core 拒绝未声明字段/值。
- 验证：Config System 30/30、AI Web Host/Rust Secret 9/9、Config System TypeScript noEmit PASS；Windows/Cargo/真实 Key 动态验收由用户实机完成。
- 下一步：用户验收通过后继续 ChatGPT/Codex App Server 登录或 config-storage，按当前优先级选择。


#### 2026-09-19 / #2.10 UI Workspace 运行时导入解析修复

- 当前状态：pending-user-acceptance
- 用户版本：v0.0.70
- 根因：Settings 使用 `packages/ui` 的 tsconfig-only `@/workbench/*` alias，TypeScript 可解析但 Web Vite 宿主运行时不可解析。
- 修复：新增 `@lfaa/ui/workbench` 公共 Subpath Export；Settings 通过 package exports 复用 Workbench。
- 治理：packages 源码禁止 `@/` 私有 alias；新增 workspace runtime import resolution 检查与真实 importer resolver 回归。
- 边界：共享侧栏 resize/snap/release 业务语义不变；AI Account/Auth/Secret/Provider 与 Windows 工具链不改。
- 下一步：Windows 实机确认菜单 2 可启动且 Settings 左栏正常后，继续 ChatGPT/Codex App Server 登录子任务。


#### 2026-09-19 / #2.4 设置中心与个人中心交互重构

- 当前状态：pending-user-acceptance
- 用户版本：v0.0.64
- UI Owner：共享 Settings / Account Menu / Theme UI 全部归 `packages/ui`；App Shell 只负责交互状态与组装。
- 已完成：独立 Settings Surface、个人中心聚焦弹层、system/light/dark 三态主题、更新/主题底部并列、AI Provider 设置嵌入 Settings 分类。
- 未改动：Config Provider 业务、Secret/Storage、Windows 工具链、模型 Runtime。
- 验证：Settings/Profile/Theme 5/5、Config System 17/17、补充 TypeScript 与目录边界门禁 PASS。
- 下一步：用户验收 UI 后，在同一 Settings/Provider 架构上进入 Account/Auth/Secret/真实连接闭环。


#### 2026-09-19 / #2.3 配置系统目录边界与 AI Provider 插件体系

- 当前状态：superseded
- 用户版本：v0.0.63
- 目录 Owner：配置业务只归 `packages/config-system/src/settings/ai`；共享图形 UI 只归 `packages/ui/src/features/settings/ai`；App 只作为宿主。
- 已完成：无厂商分支的 Provider Plugin / Registry；OpenAI、DeepSeek、智谱 GLM、Kimi、千问/百炼、Xiaomi MiMo 六家首批配置插件；共享 AI 设置 UI 基线；App Shell 组装。
- 边界：Provider Endpoint / Auth 事实不得进入 UI / App；React / DOM 不得进入 Config System；模型推理 Runtime 不属于配置插件。
- 自动门禁：`folder-boundary-check` + `import-path-check`；新增 Provider 只允许新增子目录并注册，不允许向 Core 添加厂商条件分支。
- 验证：Config System 17/17 PASS；Config System TypeScript PASS；UI/App Shell 补充 TypeScript PASS；仓库 Node 治理链 PASS。当前容器不满足项目锁定 pnpm/Node 正式工具链，不冒充 Web build / release:full。
- 下一步：用户验收目录、Provider 卡片与共享设置页后，在同一结构上继续 Web Account/Auth/Secret/真实连接闭环。


#### 2026-09-19 / #2.2 Config Schema 基线

- 当前状态：pending-user-acceptance
- 用户版本：v0.0.51
- 已完成：`@lfaa/config-system`、Config Schema v1、默认配置、运行时校验、Secret 明文字段拒绝、专项静态门禁与 8 个单元测试。
- 状态 Owner：Config Schema 只归 `@lfaa/config-system`；UI / Storage 不得维护第二套结构。
- 未实现：Config Storage / SQLite / Drizzle / Migration 执行器 / Rust Secret Store / Config UI。
- 验证：TypeScript noEmit PASS；Schema unit 8/8 PASS；config-schema-check PASS；governance:check 的 10 个实际 Node 门禁逐项 PASS；100 Provider + 100 Account + 100 Model 校验 1000 次 P95 约 0.61ms。当前环境缺少可离线使用的 pnpm 11.17.0，因此未伪造 pnpm 包装命令结果。
- 下一步：用户验收通过后进入 `config-storage`。


#### 2026-09-18 / #20.3 + #21.10 UI 前置壳与代码可读性同步

- 当前状态：planned
- 配置系统业务实现：未改动
- Web 工作台当前壳层：主区左右上角 Shell Actions + 左栏 Hover 临时预览
- 项目可读性：已补项目结构地图、源码文件头、CSS 盒子注释和自动门禁
- 下一步：完成 #21 Windows 实机验证后继续 `config-schema`

#### 2026-09-18 / #21.9 Web 常驻工作台 Chrome

- 当前状态：planned
- 配置系统业务实现：未改动
- Web 工作台壳层改为常驻 Chrome 控制，不再依赖 Hover
- 下一步：#21.9 实机验证后继续 `config-schema`

#### 2026-09-18 / #21.7 真实终端与侧栏 Hover

- 当前状态：planned
- 配置系统业务实现：未改动
- Web 工作台正在进行真实终端实机验证
- 下一步：#21.7 验证通过后继续 `config-schema`

#### 2026-09-18 / #21.6 三栏交互与终端停靠

- 当前状态：planned
- 配置系统业务实现：未改动
- Web 工作台壳层交互已继续收敛
- 下一步：在稳定三栏壳层后继续接入 config-schema 与真实终端能力

#### 2026-09-18 / #21.5 Web 启动延迟修复

- 当前状态：planned
- 配置系统业务实现：未改动
- Web 本地开发入口延迟问题已修复
- Setup 普通操作改为返回主菜单
- 下一步：继续 Web 工作台实机交互验证，再进入 `config-schema`

#### 2026-09-18 / #21.3 最小宽度自动吸附

- 当前状态：planned
- 配置系统业务实现：未改动
- Web UI 前置壳：继续实机体验优化
- 已修复：侧栏到 min 即自动吸附，不再等待松手
- 下一步：完成 Web 工作台实机体验验证后进入 `config-schema`

#### 2026-09-18 / #19.3 / #21.1 统一开发入口

- 当前状态：planned
- 配置系统业务实现：未改动
- Web UI 前置验证入口已并入 `LFAA-Setup.bat → 2`
- Desktop 菜单预留但 Electron 尚未实现
- 下一步：先完成 Web 工作台实机验证，再进入 `config-schema`

#### 2026-09-18 / #2.1 UI 前置验证壳

- 当前状态：planned
- 开发顺序：先完成 #21 Web 工作台 UI，再进入 config-schema
- 配置系统业务实现：未改动
- UI 不拥有 Config 真值
- 下一步：完成 Vite 实机验证后进入 `config-schema`

#### 2026-09-18 / #20.2 docs 整理

- 当前状态：planned
- 配置系统业务实现：未改动
- 当前任务日志：`docs/logs/development/active/0002-配置系统.md`
- 下一步：正式进入 `config-schema`

#### 2026-09-18 / #20.1 历史日志补全

- 当前状态：planned
- #2 已进入 Development Log active
- 配置系统原 Progress / Prompt 全部保留
- 配置系统业务实现：未改动
- 下一步：正式进入 `config-schema`

#### 2026-09-18 / #20 开发日志规范

- 当前状态：planned
- 配置系统业务实现：未改动
- 开发前读取与变更追踪规则已完成
- 下一步：正式进入 `config-schema`

#### 2026-09-18 / #19 Bootstrap / Resource Root

- 当前状态：planned
- 配置系统业务实现：未改动
- 开发环境与项目资源边界已收敛
- 下一步：正式进入 `config-schema`

#### 2026-09-18 / #18 Setup bug fix

- 当前状态：planned
- 配置系统业务实现：未改动
- 基础设施：修复 Setup 菜单 1 缺少 Cargo 时错误终止
- 下一步：正式进入 `config-schema`

#### 2026-09-18 / #17 pnpm-only 一致性修复

- 当前状态：planned
- 配置系统业务实现：未改动
- 已完成：Node.js workspace 包管理器固定为 pnpm-only
- 测试：治理检查与 pnpm-only 门禁静态验证通过
- 下一步：锁定 Config System 真实 TypeScript 依赖并进入 `config-schema`

#### 2026-09-18 / #16 开发前置硬门禁

- 当前状态：planned
- 本次目标：在 Config Schema 开始前补齐全项目安全、性能、归属和项目资源边界
- 配置系统业务实现：未改动
- 已完成：归属、项目资源、安全、性能、质量门禁与依赖菜单横向加固
- 下一步：进入 `config-schema`

#### 2026-09-17 / #2

- 当前状态：planned
- 本次目标：建立配置系统计划与开发合同
- 已完成：
  - 模块范围定义
  - 子模块顺序定义
  - Active Prompt 建立
- 进行中：无
- 待开发：
  - config-schema
  - config-storage
  - settings
  - model-management
  - account-management
  - permission-settings
  - config-ui
- 待测试：全部
- 测试结果：尚未进入实现阶段
- 待优化：无
- 阻塞项：真实技术依赖版本尚未在 v0.0.1 锁定
- 是否可交付：否
- 是否已交付：否
- 下一步：按照 `docs/prompts/active/0002-配置系统.md` 开始 config-schema


#### 2026-09-17 / #3 基础设施前置优化

- 当前状态：planned
- 本次目标：在配置系统正式编码前统一 Import Path，避免后续产生深层相对路径
- 已完成：
  - `@/` 当前 workspace Alias 规范
  - `@lfaa/*` 跨 package 公共导入规范
  - 自动 Import Path 检查
- 进行中：无
- 待开发：配置系统业务内容保持原计划
- 待测试：配置系统进入真实实现后验证 bundler/runtime alias
- 测试结果：项目骨架静态导入检查通过
- 待优化：无
- 阻塞项：真实技术依赖版本仍需在正式实现阶段锁定
- 是否可交付：否
- 是否已交付：否
- 下一步：按照 `docs/prompts/active/0002-配置系统.md` 开始 `config-schema`


#### 2026-09-17 / #4 开发工作流前置优化

- 当前状态：planned
- 本次目标：配置系统正式开发前固定稳定工作区与版本同步机制
- 已完成：
  - 版本快照可完整同步到 `H:\lfaa\lfaa`
  - `.git` 与本地数据保护
  - GitHub 推送工具随版本包可恢复
- 进行中：无
- 待开发：配置系统业务保持原计划
- 是否可交付：否
- 是否已交付：否
- 下一步：进入 `config-schema`


#### 2026-09-17 / #5 开发留痕目录优化

- 当前状态：planned
- 本次目标：将同步日志统一纳入 docs 分类，避免隐藏目录分散开发留痕
- 已完成：`docs/logs/workspace-sync/` 规范
- 配置系统业务实现：未改动
- 下一步：进入 `config-schema`


#### 2026-09-18 / #6 GitHub 推送脚本修复

- 当前状态：planned
- 本次目标：修复开发基础设施，不修改配置系统业务
- 已完成：稳定工作区 GitHub 一键推送修复
- 配置系统业务实现：未改动
- 下一步：进入 `config-schema`


#### 2026-09-18 / #7 GitHub 基础设施修复

- 当前状态：planned
- 配置系统业务实现：未改动
- 基础设施：首次 origin 与中文 Git 输出已修复
- 下一步：进入 `config-schema`


#### 2026-09-18 / #8 Git origin 配置优化

- 当前状态：planned
- 配置系统业务实现：未改动
- 开发基础设施：Git origin 改为首次用户配置并持久化
- 下一步：进入 `config-schema`


#### 2026-09-18 / #9 终端交互优化

- 当前状态：planned
- 配置系统业务实现：未改动
- 基础设施：同步/GitHub脚本结束状态已明确
- 下一步：进入 `config-schema`


#### 2026-09-18 / #10 Git Commit 交互优化

- 当前状态：planned
- 配置系统业务实现：未改动
- 基础设施：移除 Commit 二次确认
- 下一步：进入 `config-schema`


#### 2026-09-18 / #11 Git 源码更新工具

- 当前状态：planned
- 配置系统业务实现：未改动
- 基础设施：新增 Clone 后一键安全更新源码脚本
- 下一步：进入 `config-schema`


#### 2026-09-18 / #12 Windows 工具菜单化

- 当前状态：planned
- 配置系统业务实现：未改动
- 基础设施：Sync / Push / Update 已统一改为菜单式启动
- 下一步：进入 `config-schema`


#### 2026-09-18 / #13 Git 路径无关优化

- 当前状态：planned
- 配置系统业务实现：未改动
- 基础设施：源码更新脚本已取消固定盘符/目录依赖
- 下一步：进入 `config-schema`


#### 2026-09-18 / #14 同步菜单顺序优化

- 当前状态：planned
- 配置系统业务实现：未改动
- 基础设施：同步菜单将“执行同步”调整为数字 1
- 下一步：进入 `config-schema`


#### 2026-09-18 / #15 Update bug fix

- 当前状态：planned
- 配置系统业务实现：未改动
- 基础设施：修复 Update 0/0 状态误执行远程 diff
- 下一步：进入 `config-schema`
#### 目录职责硬边界

配置设置业务只允许在 `packages/config-system` 内形成父子域；AI 配置固定为 `src/settings/ai/core` + `src/settings/ai/providers/<provider>`。React Feature UI 固定在 `packages/ui/src/features/settings/ai`。Web/Desktop/CLI 只做宿主 Adapter；不得拥有第二套 Provider / Account / Auth / Config 逻辑。

Provider 配置插件与模型推理 Runtime Adapter 分层：Config System 管配置期契约，模型运行域管推理执行。两者共享稳定 Provider ID / 公共协议时必须通过公共 Export，而不是跨目录深链。



### #2.9 / #2.10 UI 几何与运行时公共入口

Settings 作为 config-system 的图形入口，左侧导航几何统一复用 `@lfaa/ui/workbench` 公共 Subpath Export；配置业务仍归 config-system，UI 只负责导航/显示，不产生第二套业务或 resize 真值。可复用 UI package 禁止依赖仅由 tsconfig 声明的 `@/` 私有 alias。
