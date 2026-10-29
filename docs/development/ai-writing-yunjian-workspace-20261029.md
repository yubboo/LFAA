<a id="lfaa-ai-writing-yunjian-workspace-20261029"></a>

## LFAA-AI-WRITING-YUNJIAN-WORKSPACE-20261029：AI 写作工作区视觉优化与专属预设

### 用户目标与材料边界

依据用户提供的“云涧山居”提示词提炼松影、山雾、暖纸和编辑感，用于完善 AI 写作 App，并增加一个名为“云涧书境”的可选外观预设。用户确认预设只影响 AI 写作工作区，并明确要求加入 Three.js。附件是审美参考；不移植酒店预订、营销页、全屏视差或附件指定的过期 Three.js 版本。

### 入口、Owner 与设置

- 运行入口：Web 与 Desktop 共用 Client 写作应用，当前内置浏览器实际位于 `/apps/writing/ai-work`，编辑器位于 `/apps/writing/normal`；预设入口为设置中心 `/settings?section=appearance` 的“预设”页签。写作背景槽位由 Workbench 在聊天、画布和手动模式共用。
- 写作 UI Owner：`packages/client/ui-writing/src/normal/WritingWorkspace.tsx` 与同目录 CSS；工作区装配与模式由 `packages/client/ui-workspace` 负责。
- 写作内容、作品目录、章节与修订由 `packages/document/writing` 经认证 Client Connection 管理；本任务不改变内容服务、AI 写入、权限或作品数据。
- 三维渲染 Owner：`packages/client/ui-primitives`；Three.js `0.186.1` 与类型已由该包持有。本任务沿用依赖和单画布渲染，不增加另一套 renderer。
- 外观纯数据由 `packages/util/values` 管理；预设交互由 `packages/client/ui-settings` 提交到现有 Settings Owner。
- 相关既有配置：`appearance.backgrounds.writing`（新账户默认为 `none`，现有壁纸 ID 由共享目录管理）；`appearance.areaEffects.writing.overlay/blur`（均可为空并继承全局 `appearance.overlay=65`、`appearance.blur=14px`）；`appearance.advanced.writingLightRaysEnabled`（默认开启）；`appearance.advanced.reducedMotion`（默认 `system`）。Workbench 将主题、强调色、字体/字号、对比度与写作区域效果映射为共享样式令牌。
- 预设只更新写作区域背景、写作区域遮罩/模糊和写作光线开关；不得改变全局主题、强调色、字体、字号、其他区域、常规布局、权限、通知或作品数据。页面继续读取既有共享外观令牌与系统减少动态偏好，不新增账户字段或持久化通道。

### 设计与技能记录

- `design-taste-frontend`：读取 app-screen 规则；采用 `true-black-flat`、seed `6864787` 的安静编辑器方向，正文和作品目录是主角，避免营销页式多层卡片和自动内容进场。
- `impeccable`：读取现有页面上下文并在首次 UI 源码修改前读取 Craft Floor；保留既有写作行为；实现后对改动 UI 目标运行 detector，并以真实浏览器而非 detector 结果判断质量。
- `ui-motion`：读取 foundations、anti-cheap 与 Jelly Toggle 参考。只为用户请求的轻雾场景及灯光开关提供短促状态反馈；不加滚动/整页入场。减少动态效果时停止 Three.js 连续循环并保留静态画面。
- `ui-ux-pro-max`：检查减少动态、触控目标及 React 性能建议；搜索到的单列营销落地页模板与编辑器不符，未采用。避免无证据的全量 memo。
- `baseline-ui`：用于检查层级、间距、文字、响应式边界和可读性。
- `frontend-design`：按用户此前明确同意的选择用于本轮视觉方向和页面实现。
- `audit-skills`：读取并核对适用范围；该技能面向 Java/.NET/PHP，本轮 TypeScript/React/CSS 不在其专项支持范围内，因此不声称完成该技能的语言专项审计。仍按 LFAA 规则检查认证 Settings 写入路径、设置白名单、数据 Owner 和输入边界。
- 使用原仓库 Three.js `0.186.1`；附件中的营销实现版本不覆盖当前依赖合同。

### 允许范围与验收条件

1. 在共享内置背景目录登记一张本地原创“云涧书境”写作背景，并由 Settings Owner 白名单校验；不引入远程图像请求。
2. 在外观预设页增加清楚标注“仅写作工作区”的预设卡片；应用操作经现有设置保存接口，仅提交上述三个写作区域设置字段，并保留用户其他外观偏好。
3. 精炼写作目录、工具栏、正文纸面、空状态及响应式布局；正文仍使用外观设置的内容字体、界面字号、主题、对比度与工作区容器尺寸。
4. 由 `ui-primitives` 的现有 LightRays 单画布使用 Three.js 渲染，并保留主题色、CSS 后备、WebGL 上下文恢复、隐藏/离屏暂停、像素预算、系统及账户减少动态规则和完整 GPU 资源释放。
5. 分用户可见批次完成直接构建/回归和 ChatGPT 内置浏览器实页检查。覆盖 `/settings?section=appearance`、`/apps/writing/ai-work` 与 `/apps/writing/normal`，桌面、窄分栏、窄屏/短屏；观察预设作用范围、聊天模式栏/输入可达性、当前作品选择、正文编辑/保存和页面控件可达性。验收不应用预设、不改用户设置、对话或作品内容。
6. 记录源码/构建证据与浏览器实测、视口、截图、动效帧时间或未测范围；对照并更新本合同状态与每个变更文件职责。

### 批次计划

- **批次 1（设置预设）**：本地壁纸登记、写作专属预设纯映射、设置中心卡片与按域持久化。先跑相关包回归/构建，再在内置浏览器检查预设显示、写作范围说明与不操作时无偏好变化。
- **批次 2（写作工作区）**：编辑器层级/响应式样式和共享 LightRays 的 Three.js 渲染改造。先跑相关包回归/构建，再在内置浏览器检查编辑器、空状态、已有作品状态与响应式边界。

### 实施与验证记录

- 状态：批次 1、批次 2 已完成源码接入、相关构建和回归；设置预设已在内置浏览器实显。手动编辑器的真实页面验收受当前账户路由/偏好保存合同限制，未标记为通过。
- 开始前工作树有其他任务的未提交修改；本任务只在此合同列出的相关 Owner 范围内继续，不回退或清理其文件。
- 批次 1 登记本地生成壁纸与“云涧书境”写作专属预设卡片。`applyWritingWorkspacePresetAppearance()` 的长期回归确认仅覆盖写作背景、写作区域遮罩/模糊和光线开关；其他 Appearance 设置保持原值。设置页截图在 ChatGPT 内置浏览器 `/settings?section=appearance`、1324×924，卡片、范围标签和“应用到写作”按钮均可见；未点击应用，用户设置未被更改。资源 HTTP HEAD 返回 200，Content-Length 为 2,350,743 字节。
- 批次 2 将现有 LightRays 单画布改由已安装的 Three.js 0.186.1 驱动，加入受主题色约束的低透明雾层；保留 1.25M 像素预算、减少动态/页面隐藏/离屏时暂停、上下文恢复和卸载释放。写作正文列宽按 74ch 收敛，工具栏和正文依写作工作区容器宽高响应，开关增加短促触感反馈。无新设置字段或额外动画循环。
- 构建/静态验证：`pnpm run build:control-plane`（为使根 `dist/apps/control-plane` 支持当前源码数据库版本 76 而重建，成功）；`pnpm run build:web` 成功，输出仅在根 `dist/apps/web/`；`pnpm run typecheck` 成功；相关四个测试文件 11 项全部通过。构建输出 Three.js 模块 526.97 kB（gzip 131.77 kB），由懒加载的 WritingWorkspace chunk 引用；帧时间未做实测。
- 内置浏览器：批次 1 的设置卡片完成实页检查；写作 AI Work 路由 `/apps/writing/ai-work` 可打开。无法直接验收 `/apps/writing/normal`：直接访问会因缺少应用入口 History 标记回退到 `/work`；从聊天模式切到手动模式会调用 `handleOpenApplication()` 并持久化 `selectedApp/selectedMode`。为遵守“验收不得改变用户偏好”，未点击切换或应用预设。故实际编辑、保存、窄分栏和短屏视口以及 Three.js 浏览器帧表现未测，只由构建和回归覆盖；源码中的容器查询不等同于实际窄视口验收。WebGL 运行时 shader 编译未在写作手动页面实测。
- 启动时发现根 `dist/apps/control-plane` 曾落后于当前源码：产物支持数据库版本 75，而当前工作树已支持 76。重建控制端后正式 Web 服务正常启动；未触发数据库迁移或修改作品内容。
- Impeccable 全目标 detector 报告的唯一 `side-tab` 位于既有账户管理员卡片样式，`git diff` 确认该规则不属于本次修改；聚焦写作编辑器与 LightRays 文件复检结果为 `[]`。未扩大范围修改无关设置区。
- 变更文件职责见最终答复；内置浏览器截图用于实显核验，未保存含聊天内容的截图副本。
