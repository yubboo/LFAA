# LFAA AI Work 左侧会话分区折叠与项目会话分批显示（2026-10-27）

## 用户目标

左侧“置顶 / 项目 / 最近”是展开与收起分区；点击项目文件夹行只展开或收起该项目会话，不创建新会话或切换当前会话。分区和项目行的整行灰色背景都是展开热区；更多、编辑和新对话等独立按钮仍精确执行各自操作。项目会话先显示 5 条，每次点击“展开显示”再增加最多 5 条。置顶与最近分区也能独立折叠，最近分区仍保留未置顶的项目会话。左侧顶栏新会话入口明确显示“新对话”。

## 2026-10-28 持久化补修

- 用户复验指出侧栏区域开合未持久化。入口仍为 `/work`，唯一展示状态 Owner 为 `ApplicationSidebar`；本机持久化 Owner 为 `packages/client/store/src/ai-work-sidebar.ts`，使用共享浏览器存储与运行时 schema 校验。
- 保存置顶/项目/最近三个分区开合、每个置顶/项目分组折叠状态、每个分组的已展开会话数量；按认证账户 `userId` 与当前 `appId` 隔离，仅保存有界 UI 偏好，不保存会话/项目数据，也不新增设置中心控件或服务端写入。
- 初次使用默认置顶展开、项目与最近收起，项目分页从 5 条开始。有效偏好在刷新/重开后恢复。项目偏好清理仅在当前账户会话和当前账户/App 项目清单都加载成功后执行，避免空的初始化快照覆盖旧值；错误或拒绝浏览器存储时回退默认值且不阻断侧栏。
- 持久化容量：最多 400 个项目分组偏好，每组显示量限制为 5–200；损坏数据或超界状态按共享存储规则丢弃。
- 设置盘点：无现有“记住侧栏分区开合”设置，此项是浏览器端 UI 恢复状态，不是用户可配置行为；不修改 Settings。
- 本批验证：`pnpm.cmd exec node --import tsx --test apps/cli/tests/client-persistence.test.mjs` 8/8 通过；Client Store、UI Workspace 包构建、`pnpm.cmd exec tsc --noEmit -p tsconfig.client.json`、`pnpm.cmd run build:web` 与 `git diff --check` 通过；`node scripts/runtime-build-state.mjs web` 返回 `[]`，构建产物仅写仓库根 `dist/`。
- 首次正式 Web 启动验收曾受 Session 日志完整性保护阻断，未绕过校验或改动会话数据。2026-10-28 后续重新构建 Host/Web 后，正式启动成功；见下方补验记录。
- 验收范围无帧时间变化，未测帧时间。未改变 Settings、会话、项目、权限或其他账户数据。

## 2026-10-28 中间工作区状态持久化补修

- 用户指出中间区域收起/展开状态也没有持久化。状态 Owner 是 `ApplicationWorkspace` 中的 Workbench Chrome；既有 `lfaa.module-workbench.chrome.v2` 已保存左右侧栏等布局状态，但漏掉 `centerCollapsed`。
- 将中间区状态纳入同一份 Chrome 布局对象，复用已有浏览器本地存储写入与读取；整页刷新后恢复。拖动中的 `centerCollapsePreview` 仍是临时预览，不写入存储；已有账户/工作模式切换重置行为不变。
- 设置盘点：这是布局恢复状态，没有对应设置中心选项；不新增配置控件或服务端写入。会话、项目、标签实例与权限数据均不变。
- 验收：UI Workspace 包构建、Client 类型检查、Web 构建和 Control Plane 构建均通过；`node scripts/runtime-build-state.mjs web` 返回 `[]`，`git diff --check` 通过，构建产物位于仓库根 `dist/`。
- ChatGPT 内置浏览器在 `/work`、1280×720 实测：双击工作区标签收起中间聊天区，刷新后仍保持收起；点击聊天标签展开中间区，再刷新仍保持展开。截图分别显示刷新后的收起和展开状态；最终保留展开状态，与验收前一致。未测窄屏及帧时间。
- 正式入口 `pnpm.cmd lfaa web --no-local-daemon` 已启动 `http://127.0.0.1:3000`；启动器按此前授权自动重启了占用当前 LFAA 数据目录的旧 Web 进程。启动和页面加载成功；本批未新增或修改会话、项目、权限及设置数据。

## 入口、Owner 与边界

- 运行入口：`/work` 的 AI Work 左侧导航。
- 展示与临时折叠状态由 `packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 的 `ApplicationSidebar` 持有；会话及置顶数据继续分别来自既有 Session 与本地置顶 ID Owner，项目清单继续来自 Workspace Owner。
- 项目行点击只控制对应分组的展开状态；新会话仍通过既有 `onNewSession(projectId)` 写入真实项目归属。点击具体会话仍沿既有 `onSelectSession` 打开。各区共享当前账户的现有会话快照，不新增请求、持久化格式或目录推断。
- 显示量只在 Client 内存状态，按项目分组分开累计；每个会话清单使用当前最多 200 条会话边界。数据源变化或账户/App 变化时清理已不存在分组的临时状态，避免状态随历史项目累积。
- 设置中心：无项目折叠或每批显示数量的现有控制项。本次不新增设置；使用 Appearance 的现有颜色/字体映射与减少动态效果设置。`general.navigationLayout`、已保存栏宽、权限模式与项目/会话数据均不改变。

## 验收条件

1. 置顶、项目、最近标题分别可用鼠标和键盘开合，`aria-expanded` 与可见状态同步；默认置顶展开、项目与最近收起，最近计数及全局最近入口仍可见并能展开列表。
2. 项目行只折叠/展开其子会话；它不调用 `onNewSession`、`onSelectSession`。项目新建按钮明确调用 `onNewSession(projectId)`，独立编辑入口仍可用。
3. 每个项目分组初始最多显示 5 条；连续点击“展开显示”分别增加最多 5 条，完整显示后按钮消失。置顶项目分组与项目分组各自累计，不互相影响。
4. 分区和项目行的整行悬停/键盘焦点背景填满到右侧操作区；点击行内空白可开合，更多、编辑和新对话/创建项目按钮继续执行各自操作且不触发行折叠；顶部入口可见“新对话”。
5. 滚动列表在无溢出与有溢出时保持相同 `clientWidth`，为滚动条保留稳定槽位；窄分栏和短屏仍可操作，无横向溢出。
6. 深色/浅色主题沿用 Appearance 令牌；减少动态效果偏好生效。没有新增订阅、网络请求、轮询、定时器或无界列表。
7. 运行 Workspace 包直接构建、Client 类型检查、Web 构建及 `/work` 内置浏览器实际交互验收；记录视口、分区开合、项目展开、每次显示数量、滚动槽位与未测边界。

## 实施与验收记录

状态：原侧栏交互已完成；侧栏与中间工作区持久化均已接入。Client 类型检查、Workspace/Web/Control Plane 构建与 `/work` 内置浏览器刷新验收通过。前一轮记录的测试结果仍保留；本次新增中间区改动未运行测试。

### 本次文件

- `packages/client/ui-workspace/src/ApplicationWorkspace.tsx`：左侧置顶/项目/最近折叠，项目会话分组及 5 条分页状态，项目新建独立入口，Recent 快捷入口展开列表。
- `packages/client/ui-workspace/src/css/secondary-navigation.css`：分区与项目行开合、会话“展开显示”按钮、窄栏主题令牌和减少动态效果样式。
- `packages/client/ui-workspace/README.md`：记录侧栏交互和数据边界。
- `docs/PROMPTS.md` 与本合同：任务索引、设置、性能边界及验证记录。

### 实施结果

- 项目分区标题和项目会话行都由整行承载展开热区与悬停/键盘焦点底色；行内按钮各自处理菜单、编辑、创建项目或新对话，不会误触发父行折叠。
- 左侧顶栏新会话按钮以可见文字“新对话”呈现，项目内入口也使用“新对话”措辞。
- `.module-sidebar__session-list` 使用 `scrollbar-gutter: stable`，有无垂直溢出时为内容保留同样的滚动槽宽度。
- 每项目首次显示 5 条；浏览器实测点击一次后从 5 条增至 10 条，剩余数从 22 条降至 17 条。
- 未增加设置、订阅、计时器或请求；分页继续受现有最多 200 条会话边界约束。无帧时间采样，本次不声称已完成动画/帧时性能测量。

### 验证记录

- `pnpm.cmd --filter lfaa-client-ui-workspace run build`：当前工作区通过，能力包产物位于根 `dist/packages/`。
- `pnpm.cmd run build:control-plane`、`pnpm.cmd run build:web` 和 `pnpm.cmd exec tsc --noEmit -p tsconfig.client.json`：通过；运行指纹检查返回 `[]`。
- 首次侧栏实现后 Client 类型检查与 Web 构建通过；共享工作区随后加入其他 Client 改动，本次最新 `pnpm.cmd run build:web` 未通过类型检查：`ApplicationWorkspace.tsx:861` 在声明前读取 `missingSessionDirectoryIds`、`ApplicationWorkspace.tsx:865` 有未使用变量，以及 `ApplicationWorkspace.tsx:2297` 传入的 Minecraft 画布属性不匹配。未改写这些并行功能。
- 本次构建后 `node scripts/runtime-build-state.mjs web` 返回 `["host"]`；不据此声称刚才失败的 `build:web` 已完成。没有重启 3000 端口服务，避免把未通过集成检查的产物替换到正在运行的页面。
- ChatGPT 内置浏览器实页：`http://127.0.0.1:3000/work`。既有侧栏交互记录为 1117×1244：项目分区空白处可开合，整行底色延伸至右侧操作区；行内菜单不触发父行折叠或新建会话；项目会话“展开显示”从 5 条增至 10 条。2026-10-28 本次在 1280×720 实测中间聊天区双击折叠及刷新恢复、点击聊天标签展开及刷新恢复；最终保留展开状态。截图在本轮内置浏览器验收会话中查看。
- 在 1117×1244、800×720 和 390×640 检查响应式布局。手机视口打开会话栏后宽 320px、内容宽 310px，文档总宽保持 390px；桌面窄列表内容宽 227px。31 条最近会话导致滚动时列表 `scrollHeight/clientHeight` 为 1635/1032；收起最近后为 1032/1032；两种状态下 `clientWidth` 都为 227px，确认滚动条出现不会再挤压内容。页面截图已通过内置浏览器验收捕获；没有单独写入截图文件。
- 验收临时展开状态已重置：最终 `/work` 页面回到置顶展开、项目与最近收起，默认项目重新显示首批 5 条。未创建会话、未更改项目/设置/权限或已保存栏宽。
- 未测项：真实低端设备帧率、屏幕阅读器实机表现，以及共享 Client 类型错误修复后的最终整合版本；不影响当前运行页面对目标交互和布局的实测结论。

