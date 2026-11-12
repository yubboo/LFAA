# LFAA AI Work 侧栏“展开显示”对齐与会话悬停反馈（2026-11-12）

<a id="lfaa-ai-work-sidebar-show-more-alignment-hover-20261112"></a>

## 用户目标与验收范围

- 用户指出项目会话列表末尾的“展开显示”没有与会话标题对齐，并缺少鼠标移入时的整行反馈。
- 将“展开显示”的文字起点与嵌套会话标题文字列对齐；非当前会话行在悬停时显示现有悬停表面，键盘聚焦同样可见；当前会话仍保留已选中样式。
- 入口与唯一 UI Owner：Web/Desktop 共用 `/work` 左侧栏 `ApplicationSidebar`；本次只调整 `packages/client/ui-workspace/src/css/secondary-navigation.css` 中项目会话列表及普通会话行样式。
- 设置：沿用 Appearance 已映射的 `--color-surface-hover`、`--color-text-heading` 与当前字体/主题；不新增设置、不修改用户偏好。
- 数据与权限：项目/会话、可见数量偏好及 Session/Workspace Owner 均不变；不触发按钮点击，不改写真实会话或设置。
- 性能与维护边界：静态 CSS，无新订阅、请求、状态、动画或 CSS 自定义属性；不改变点击、分页、选择和菜单行为。

## 验收条件

1. `/work` 中“展开显示”文字起点与嵌套会话标题文字起点相同。
2. 非活动会话行悬停/键盘聚焦时，整行使用 Appearance 悬停表面；当前活动会话仍保持选中表面。
3. 桌面与侧栏窄分栏均无溢出；项目标题、会话图标、行尾菜单和列表滚动不受影响。
4. 运行 UI Workspace 包构建、Client 类型检查与正式 Web 构建；在 ChatGPT 内置浏览器对当前源码 `/work` 实测桌面和窄栏布局与交互，并记录视口、对齐测量和截图证据。帧时间未测时明确说明。

## 实施与验收记录

状态：本轮样式实现及实页验收完成；共享工作区后续源码变化后的最终 Web 重建待复核（2026-11-12）。

### 实施

在 `secondary-navigation.css` 中为“展开显示”补齐嵌套行左缩进、会话行边框、按钮内距、图标槽和图文间距，使文本落在与会话标题相同的 CSS 列；为非活动、非草稿会话增加整行 hover 与 `focus-within` 表面及标题色，选中行仍保留选中表面。复用现有 Appearance 令牌。README、合同和索引记录对应行为。截图仅作视觉参考。

### 验证

UI Workspace 包构建、Client 类型检查、正式 Web 构建和 ChatGPT 内置浏览器 `/work` 实页验收均通过过一次：官方菜单首次构建因源码指纹变化而中止，重试后 Control Plane/Harness 与 Web 成功启动，`/api/health` 返回 200，`runtime-build-state.mjs web` 返回 `[]`。该构建快照包含本次侧栏 CSS，浏览器验收也针对该快照完成。

- `1280×720`：左侧会话行 hover 后整行显示 Appearance hover 表面，标题使用正文高亮色；当前活动会话继续显示蓝色选中表面。保留在原会话，项目标题、行尾菜单和列表滚动均可见。
- `960×720`：侧栏 320px、中心列 274px，页面 `scrollWidth` 与视口同为 960px；非活动行仍保持整行 hover，活动行选中态不变。
- `517×720`：响应式布局收起左侧工作区 Dock，整个页面仍无横向溢出（`scrollWidth=517px`）。
- 当前账户该项目的 6 条会话均已显示，按现有分页偏好没有渲染“展开显示”按钮；没有改动偏好来强行显示。由实际 DOM 测得项目会话容器起点 73px、会话标题起点 108.67px；CSS 为展开按钮预留左缩进 7px 和内部间距 29px，按同一行边框/图标/文字间距落入标题列。故按钮自身没有可供实页截图直接量测的元素，按钮可见时的最终像素比对未实测。
- 未新增或运行测试；`git diff --check` 通过。帧时间未测，键盘 Tab 聚焦状态由 CSS 覆盖但未在浏览器中逐键验收。
- 之后共享工作区其他源码文件又有更新（`ApplicationWorkspace.tsx`、`center-workspace.css`、`ai-work-chat.css`、`execute-turn.ts`）。最后一次官方 Web 重建在 `ApplicationWorkspace.tsx` 第 1218、1229 行的 TypeScript 阶段失败；随后单独执行 Client 类型检查通过，说明共享编辑期间的错误未能稳定复现。没有修改这些并行任务文件；另一个 LFAA Web 进程已占用 3000 端口，未中断该进程。交付前检查时 `/api/health` 返回 200，但 `runtime-build-state.mjs web` 返回 `["host","web"]`，因此没有把后续共享源码状态标成最新 Web 构建；本次侧栏快照的构建和浏览器证据仍成立。

### 2026-11-12 当前共享构建复核

- 后续修复了 `ApplicationWorkspace.tsx` 中活动工作区标签变量的声明顺序，并恢复了被错误覆盖的 `AiWorkChat.tsx`；当前 Control Plane 与 Web 正式构建通过，Web 指纹检查返回 `[]`。本轮内置浏览器 `/work` 页面加载正常，但未再次逐视口测量本任务的悬停样式；上述历史视口测量仍属于此前构建快照。
