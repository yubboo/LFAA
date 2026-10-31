# LFAA 右侧栏标题与收起按钮合并（2026-10-31）

<a id="lfaa-workspace-context-panel-header-20261031"></a>

## 用户目标与可观察结果

- 在 Minecraft 控制台右侧栏，把“应用工具”标题和“收起上下文栏”按钮放入最顶部的 `shell-actions` 标题栏（视口 y=0–48，与工作区顶栏对齐）；右栏正文从 y=48 的“节点文件”开始。移除其下方重复的应用工具介绍区。
- “应用工具”在右栏只保留一个标题；右侧栏的节点文件、当前应用、服务状态、Minecraft 运行环境/服务器信息、快捷命令和运行指标继续可用。
- 展开时能从标题行收起；收起后仍由现有工作区入口重新展开；现有快捷键继续控制同一栏位。

## 运行入口、Owner 与设置

- 实际入口：`/games/minecraft/instance/:instanceId/terminal`，内置浏览器当前目标实例路由由用户环境状态提供。
- 唯一布局与交互 Owner：`packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 和所属 `css/right-menu.css`；Minecraft 指标/服务器信息内容仍归 Minecraft UI Owner，不改领域数据或权限。
- 相关设置：`settings.shortcuts.toggleContextPanel`（Settings 中“切换工具与资源栏”，默认 `Ctrl+Alt+B`，账户设置保存与快捷键校验仍归 Settings Owner）；上下文栏开合沿 Workbench 现有 `localStorage` Chrome 状态偏好，不重置偏好；默认桌面展开、紧凑/手机收起。外观沿 Appearance 主题、强调色、字体/字号、对比度、背景/遮罩/模糊与减少动态效果映射。`settings.general.showServiceStatus` 默认开启并继续控制工作区服务连接状态指示；本次只移除重复的小标题状态标记，不影响下方真实服务状态区域，不新增或更改配置。
- 本任务不读写实例、节点或账户业务数据，不触发实例启停，不增加订阅、请求、轮询、计时器、观察器或事件。

## 范围与验收条件

- 只修改普通应用右侧上下文栏的控制位置与重复介绍区，不改其它栏位、导航、快捷键、状态来源或内容 Owner；写作作品信息侧栏与 AI Work 工具页签保留自身既有标题/关闭结构。
- 桌面、窄分栏和手机宽度下，“应用工具”和图标按钮同处右侧栏最顶部标题行；标题行位于 y=0–48，正文首项“节点文件”位于 y=48。图标可聚焦、可点击且有无障碍名称及快捷键提示；窄栏标签可滚动，按钮不被挤出或遮挡。
- 收起/展开状态与快捷键保持一致；唯一“应用工具”标题可见；重复的副标题/连接状态介绍块不再出现；服务状态信息及其余右栏功能仍可用。
- Web UI 变更按单批执行相关回归/类型/构建，并在 ChatGPT 内置浏览器实际页面核对桌面与相关窄栏/短屏布局，记录路由、视口和交互结果。验收不得更改用户偏好或启停服务器。

## UI 技能与设置核查

- 沿用本轮已读取的 Taste Skill、Impeccable、Audit Skills、UI Motion、UI/UX Pro Max、Baseline UI；按当前 Workbench 密集操作侧栏维持已有层级与容器滚动，不增加装饰和动效。Audit Skills 的专项代码覆盖不包括 TypeScript/TSX/CSS，本轮只执行其适用的安全边界检查。
- 设置盘点未发现该按钮位置、右栏标题或介绍文案的设置项；保留现有快捷键、栏位偏好、Appearance 和服务状态设置，不新增配置。

## 实施与验收记录

- 当前阶段：完成。正式 Web 服务与构建指纹核对通过，目标路由已在 ChatGPT 内置浏览器完成桌面、窄分栏和手机宽度验收；收起/展开往返后保留原本展开状态。
- 位置纠正：上一版曾把标题行放在正文起点 y=48，未按用户箭头放进最上方空栏。本次已将整行移入右栏 `shell-actions` 顶栏，实测 y=0；正文仍从 y=48 开始，首项为“节点文件”。
- 变更文件：`packages/client/ui-workspace/src/ApplicationWorkspace.tsx`（普通应用右栏标题行与按钮位置、删除重复介绍区）、`packages/client/ui-workspace/src/css/right-menu.css`（标题行按钮布局/焦点样式）、`packages/client/ui-workspace/README.md`（包 UI 合同）、本合同与 `docs/PROMPTS.md`（任务过程和索引）。
- 构建与检查：`pnpm run typecheck` 通过；`pnpm run build:harness` 成功，225 个能力包输出到根 `dist/packages`；`pnpm run build:control-plane` 通过；`pnpm run build:web` 通过，Vite 转换 3,948 个模块并输出到根 `dist/apps/web`；`node scripts/runtime-build-state.mjs web` 最终返回 `[]`；最终 `git diff --check` 通过。Vite 有既有大 chunk 警告。此前一次 Web 类型检查遇到并行 Minecraft 遥测源码的错误；该源码随后稳定，最终独立类型检查和标准 Web 构建均通过，本任务未修改 Minecraft 遥测文件。
- ChatGPT 内置浏览器实页：路由 `/games/minecraft/instance/bd7c58bb-a1e1-4d20-b7f6-d66f23841e2d/terminal`。`1280×720` 桌面：顶栏与标题行 `top=0,height=48`，正文 `top=48,width=360`，首项“节点文件”；`900×640` 窄分栏：顶栏 `top=0,height=48`，正文 `top=48,width≈359`；`390×640` 手机：顶栏 `top=0,height=48`，正文 `top=48,width=330`。三种视口文档宽度均与视口相等（1280/900/390），无横向溢出；“应用工具”在右栏仅出现一次，“手动操作与管理”重复区不存在；服务状态仍显示“服务运行正常”，Java 和服务器状态等内容保留。桌面页收起后“展开上下文栏”可见，点击重新展开后回到原状态。现有快捷键标签仍为 `Control+Alt+B`（提示 `Ctrl+Alt+B`）。验收截图已在本轮内置浏览器工具中捕获，未另存到仓库。
- 设置与边界：继续读取现有 `settings.shortcuts.toggleContextPanel`、Workbench 栏位偏好、Appearance 映射及 `settings.general.showServiceStatus`；未新增或重置设置。未添加请求、轮询、计时器或订阅；未运行自动化测试；未启动/停止 Minecraft 实例或修改业务数据。此前配置锁 PID `20412` 已由用户关闭；最终验收使用的正式 Web 服务由项目启动链运行。
