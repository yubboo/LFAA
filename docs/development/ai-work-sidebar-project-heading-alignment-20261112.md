# LFAA AI Work 侧栏项目标题对齐（2026-11-12）

<a id="lfaa-workspace-sidebar-project-heading-alignment-20261112"></a>

## 用户目标与验收范围

- 用户截图指出 `/work` 左侧“项目”标题没有与“置顶 / 最近”对齐。
- 修复三个分区标题的文字起点，使“项目”与其同级标题横向对齐；保留项目行整行悬停/焦点背景、折叠行为及右侧计数、菜单、新建按钮。
- 入口与 UI Owner：Web/Desktop 共用 Client `/work`；会话分区交互由 `packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 提供，相关局部样式由 `packages/client/ui-workspace/src/css/secondary-navigation.css` 持有。Workspace/Session 数据与操作继续使用原领域 Owner。
- 设置：沿用 `general.navigationLayout`、Workbench 已保存栏宽，以及 Appearance 的主题/颜色、字体/字号、对比度和减少动态效果映射；不新增、不修改设置，不写入用户偏好。
- 性能、安全、维护边界：只调整现有 CSS 子盒子的水平内边距；不新增订阅、请求、事件、动画或数据状态，不改变认证、授权、参数校验、账户/App 隔离及 Workspace/Session 数据。

## UI 技能审查

- Taste Skill app-screen：保留工作界面现有安静、重复的分区样式，仅修正同级标签的网格起点。
- Impeccable layout：按现有结构检查父工具栏与子按钮的空间职责，采用同级标题相同的累计左间距，避免改动行背景或按钮分布。
- Audit Skills：当前技能覆盖 Java/.NET/PHP，不覆盖本次 TypeScript/CSS；不声明专项扫描结论，仅保持本次纯样式改动不触及安全/数据 Owner。
- UI Motion：本次没有新增动效；原有折叠反馈和减少动态效果规则不变。
- UI/UX Pro Max：紧凑标签应保持单行、可读且适应可用宽度；语义 UX 搜索命中 Compact Label Overflow，React 技术栈搜索两次均无匹配，CSS 实现采用已有通用样式规则。
- Baseline UI：复用现有控件、主题令牌和间距语义；不加动画、装饰或新变量。

## 实施与验收记录

状态：完成。

### 预期文件

- `packages/client/ui-workspace/src/css/secondary-navigation.css`：仅修正项目分区标题的水平起点。
- `docs/PROMPTS.md`：登记任务索引。
- 本合同：记录目标、边界与实际验证证据。

### 验收条件

1. `/work` 中“置顶”、“项目”、“最近”的文字起点相同；依据同一实页中三个标题的 DOM 矩形位置核对。
2. 桌面与相关窄分栏/短屏均无横向溢出，计数、折叠箭头、项目操作按钮可达，项目整行背景覆盖范围与点击行为不变。
3. 运行直接相关的 Workspace 包构建、Client 类型/ Web 构建（若并行工作造成失败，记录具体错误与边界），并在 ChatGPT 内置浏览器使用当前源码 `/work` 实页验收；不操作项目、会话或用户设置。
4. 检查样式改动没有引入订阅、请求、主线程工作或无界数据增长；帧时间未实测时如实记录。

### 实施与验证记录

#### 实施

- `.module-sidebar__category-toggle` 的左内边距为 9px；项目标题父级 `.module-sidebar__project-toolbar` 另有 4px 左内边距，原项目按钮再加 9px，累计为 13px。将项目按钮左内边距改为 5px 后，累计 4px + 5px = 9px，与“置顶 / 最近”相同；按钮右侧 9px、工具栏整行背景及操作列不变。
- Workspace 包构建 `pnpm.cmd --filter lfaa-client-ui-workspace run build` 通过，输出位于仓库根 `dist/packages/`。
- Client 类型检查 `pnpm.cmd exec tsc --noEmit -p tsconfig.client.json` 通过。
- Web 构建 `pnpm.cmd run build:web` 通过，输出位于仓库根 `dist/apps/web/`。按用户同意使用正式菜单安全重启当前 Web；Control Plane/Harness 与 Web 均再次构建成功，服务就绪于 `http://127.0.0.1:3000`。重启后 `node scripts/runtime-build-state.mjs web` 和 `control-plane` 均返回 `[]`，`/api/health` 返回 HTTP 200。
- Impeccable 样式检测 `impeccable.cmd detect --json packages/client/ui-workspace/src/css/secondary-navigation.css` 无发现；`git diff --check` 通过。没有找到覆盖这三个分区标题起点的现有定向回归，没有新增测试；未测帧时间，改动仅为静态 CSS，无新增请求、订阅、事件或主线程工作。

#### 内置浏览器实页

- 目标路由：`http://127.0.0.1:3000/work`。ChatGPT 内置浏览器桌面视口 1280×720 与窄栏视口 517×720 均可见真实侧栏。三个标题文字的 DOM 左起点在两个视口中都为 82px；桌面文档宽度为 1280px，窄栏文档宽度为 517px；窄栏会话列表宽 320px、内容 `scrollWidth/clientWidth` 均为 310px。侧栏计数与右侧按钮仍可见，无横向溢出。
- 实页截图已在内置浏览器验收中捕获并目视检查。检查期间仅展开/收起现有导航以显示侧栏，缩放/视口测试后恢复为桌面 1280×720、左侧栏收起、右栏展开；置顶/项目/最近分区均保持收起。未创建会话、展开项目或修改项目、会话、设置及权限数据。
- 517×720 首次打开侧栏时显示现有移动端 Git 摘要页，其读取返回 `Failed to fetch`；随后返回“项目与会话”列表，标题对齐及宽度测量正常。未重试或更改该摘要数据；它属于独立 Git 摘要读取，不由本次 CSS 修正处理。
- 页面验收后的共享工作区构建状态再次核对：`node scripts/runtime-build-state.mjs web` 与 `control-plane` 当前均返回 `[]`，`http://127.0.0.1:3000/api/health` 返回 HTTP 200。实页验收时三个标题的 DOM 起点一致，且本任务 CSS 此后未再变更。
