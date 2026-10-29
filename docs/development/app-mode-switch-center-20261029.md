# LFAA-APP-MODE-SWITCH-CENTER-20261029

<a id="lfaa-app-mode-switch-center-20261029"></a>

## 用户问题与目标

用户提供 `/apps/aivideo/normal` 截图，指出顶部栏红框中的“聊天 / 画布 / 手动”模式组目前偏右，希望它固定在工作区中间位置。该顶栏由业务 App 共用，因此修复覆盖所有显示 App 模式组的共享工作区，不只针对 AI 漫剧。

## 运行入口、Owner 与边界

- 运行入口：Web 与 Web/Desktop 共用 Client 的 `/apps/:appId/ai-work`、`/apps/:appId/canvas` 和领域手动路由；本轮重点验收 `/apps/aivideo/normal`。
- 唯一 UI Owner：`packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 装配共享标题栏；`packages/client/ui-workspace/src/css/center-workspace.css` 维护中心列顶栏布局。模式状态仍来自现有 `ApplicationMode` 与路由，不新增第二份状态。
- 包职责：`lfaa-client-ui-workspace` 是共享 Client 的消费者与展示/交互 Owner；AI Video 项目、媒体与生成能力仍归 `packages/video/ai-video` 等既有领域 Owner。此次不触及领域服务、数据、认证、授权或执行链。
- 当前已有工作树在 `center-workspace.css` 存在未提交调整。本任务必须在保留这些改动的基础上作最小追加，不回退或覆盖已有工作。

## 设置与数据盘点

- 顶栏模式居中没有设置项，不应新增设置或把布局位置做成用户偏好。
- `general.navigationLayout` 默认 `three-column`，由 Settings Owner 校验、持久化并映射到 Workbench 容器宽度；顶部左右轨道尺寸可能随布局变化。
- `general.showServiceStatus` 默认 `true`，`general.showBottomPanelControl` 默认 `true`，两者由 Settings Owner 持久化并决定右侧顶栏控件；它们不能改变模式组的中心锚点。
- `canvas.defaultMode` 默认 `generate`，`canvas.agentPanelDefaultOpen` 默认 `false`，由 Settings Owner 管理画布行为；本轮不修改其值或切换语义。
- 主题、强调色、字体与字号、对比度、壁纸、遮罩、模糊及减少动态效果继续使用当前 Appearance 共享映射与 `ui-theme` CSS 令牌。本轮不新增 CSS 自定义属性，不硬编码颜色，不重置用户偏好。

## 技能前置与设计约束

- 已读取 Taste Skill 与 `references/app-screens.md`：这是现有应用顶栏精修，保留产品外观与真实内容；导航要易扫读，窄屏避免拥挤和横向溢出。
- 已读取 Impeccable：现有 UI 精修应保持结构和行为，仅修布局。其 `context` 命令未返回内容，仓库也没有 `PRODUCT.md`/`DESIGN.md`，因此不臆造产品设计文档；按技能要求在 UI 编辑前读取 `craft-floor.md`。
- 已读取 Audit Skills：该技能专项覆盖 Java、.NET、PHP；本次 TypeScript/React/CSS 不属于其专项审计覆盖，仍按 LFAA 规则保持认证、权限和数据边界不变，不声称完成专项安全审计。
- 已读取 UI Motion：本需求不要求增加动效；保留现有状态反馈与减少动态效果映射，不增加持续动画。
- 已读取 UI/UX Pro Max：UX 搜索提示避免响应式横向溢出；React 栈两次针对布局查询均无命中，采用现有 CSS Grid 与容器断点作为通用回退，不复制上游示例或增加依赖。
- 已读取 Baseline UI：沿用 Ant Design `Segmented`、现有尺寸与主题令牌，不迁移 Tailwind、不引入新交互原语。键盘与可访问名称保持现有组件合同。

## 允许范围与验收

- 允许：把模式组从右侧操作组的布局职责中分离，放到顶栏独立的中间槽；左右两侧宽度变化时中点不偏移；窄分栏根据真实 `.module-center` 宽度仍保持水平居中且无覆盖、横向溢出。
- 保持：聊天/画布/手动各自当前选中态、URL 跳转、键盘与焦点行为、标题和右侧控制、正文留白、Dock 几何及相邻已完成区域。
- 禁止：改路由/默认模式/项目数据/权限；写死遮罩、主题或字号；因空间不足隐藏任一业务模式；将模式组并入其他区域的布局 Owner。
- 可观察验收：在 `/apps/aivideo/normal` 中模式组几何中心与顶栏可用宽度中心一致；聊天↔画布↔手动切换仍正确；桌面和窄分栏/短屏下两侧标题与操作可见可达，页面无水平溢出；至少复查旁边的聊天/画布标题栏行为。
- 验证计划：直接相关回归、客户端类型检查、`lfaa-client-ui-workspace` 构建、正式 Web 构建与运行指纹、`git diff --check`；ChatGPT 内置浏览器需由当前 checkout 正式服务加载 `/apps/aivideo/normal`，记录桌面与窄容器尺寸、切换结果和截图。构建不能替代实页验收；帧时间、设备和桌面壳加载需如实区分。

## 分批记录

### B1：共享模式组中心锚点

- 状态：实现与本地 Web 实页布局验收通过。聊天、画布、手动三个路由均能切换，窄分栏下模式组仍可见、居中且未与左右栏重叠。
- 改动：模式 Segmented 从右侧操作盒移入独立中间槽；顶栏 Grid 用中心列锚定，`.module-center` 宽度不超过 420px 时标题/操作保留首行、模式组单独居中到下一行。没有引入计时器、观察器、订阅、请求或持续动画。
- 设置：复用 `general.navigationLayout`、`general.showServiceStatus`、`general.showBottomPanelControl`、`canvas.defaultMode`、`canvas.agentPanelDefaultOpen` 及 Appearance 共享主题令牌；没有新增或改写设置中心配置。模式组位置固定，不增加偏好项。
- 直接回归通过：`node --import tsx --import ./apps/cli/register-package-loader.mjs --import ./apps/cli/tests/isolated-test-environment.mjs --test --test-name-pattern="App 模式组固定在顶栏中心列" ./apps/cli/tests/client-app-workspace-four-column.test.mjs`（1 项通过）。
- 类型与构建通过：`pnpm.cmd exec tsc --noEmit -p tsconfig.client.json`、`pnpm.cmd --dir packages/client/ui-workspace build`、`pnpm.cmd run build:control-plane`、`pnpm.cmd run build:web`；最后一轮通过 `scripts/install-dependencies.ps1` 的完整 Web 安全重启入口重建 Host/Web 并启动服务。`node scripts/runtime-build-state.mjs web` 最终为空数组，正式运行树无过期项；`git diff --check` 通过。构建输出留在根 `dist/`。
- 更广的回归命令 `pnpm.cmd --dir apps/cli test -- tests/client-app-workspace-four-column.test.mjs tests/client-workbench-responsive.test.mjs` 有 33 项通过、12 项失败；失败中包含依赖工作树既有未提交布局修改的旧断言（例如被移除的顶栏 inset 规则）。未把这组失败报告成通过；本轮新增的定向回归单独通过。
- 内置浏览器：`http://127.0.0.1:3000/apps/aivideo/normal`；视口 1280×720，桌面中心列约 836px；窄分栏把右侧面板从约 359px 临时拉宽到约 779px（中心列约 416px）和约 879px（中心列约 316px）。两种窄度下模式组都居中且不重叠；约 316px 时触发独占第二行。之后恢复原宽度到约 359px。实页逐项切换聊天、画布、手动并回到手动页。桌面、窄分栏与模式切换截图由内置浏览器在本轮捕获。
- 页面限制：AI 漫剧页的 `GET /api/ai-video/canvases` 返回 500，页面显示“服务器内部错误”，所以项目数据、项目创建与镜头操作未能实测；控制端健康状态正常。此 API 与本轮 CSS/布局代码无关，未改其领域 Owner。
- 未测：低于 720px 的短屏、真实手机/平板/桌面壳、设备端验收、帧时间。改动不增加动效或运行工作量，因此没有帧时间测量。

### 变更文件职责

- `packages/client/ui-workspace/src/ApplicationWorkspace.tsx`：共享顶栏装配独立模式中间槽；保留原有模式状态、选项与路由回调。
- `packages/client/ui-workspace/src/css/center-workspace.css`：三列中心锚定和 420px 容器断点；原工作区的既有未提交样式保留。
- `apps/cli/tests/client-app-workspace-four-column.test.mjs`：覆盖中心槽、左右列和极窄容器独占居中行。
- `docs/PROMPTS.md`：登记并更新本轮合同状态。
- `docs/development/app-mode-switch-center-20261029.md`：Owner、设置边界、实施、验证和未测边界。
- `packages/document/writing/src/local-files.ts`：Control Plane 完整构建暴露 `projectLocation` 返回类型漏列 `writingRoot`；只补齐现有返回值的 TypeScript 类型，不改变 Writing 行为或数据。
