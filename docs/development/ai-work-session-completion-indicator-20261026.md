<a id="lfaa-ai-work-session-completion-indicator-20261026"></a>

# LFAA-AI-WORK-SESSION-COMPLETION-INDICATOR-20261026：会话列表完成提醒

## 用户问题与目标

用户希望 `/work` 左侧会话列表能像参考图一样，在有已完成工作提醒的会话旁显示主题强调色小圆点或清晰图标，避免完成结果不易察觉。指示必须来自真实完成通知，不按会话更新时间或标题推测任务状态。

## Owner、入口与设置

- 运行入口：Web 与 Desktop 共用 Client 的 `/work` AI Work 工作区。
- 会话行渲染 Owner：`packages/client/ui-workspace/src/ApplicationWorkspace.tsx`；现有左栏样式 Owner：`packages/client/ui-workspace/src/css/secondary-navigation.css`。
- 完成与已读事实继续由 `packages/client/ui-layout/src/Workbench.tsx` 中已有 `AiWorkNotification` 状态持有；通知由 `packages/client/ui-chat/src/AiWorkChat.tsx` 在真实 Agent Run 完成后发出，`kind="complete"`、`sessionId`、`read` 是显示依据。Client 不新建或持久化会话状态。
- 设置盘点：通知仍由 `general.notificationPopupsEnabled`（默认 `true`）和 `general.completionNotification`（默认 `unfocused`，可为 `always`/`unfocused`/`never`）门控；强调色继续由 Appearance `appearance.accentColor`（默认 `#3457d5`，分色主题时使用当前模式色）映射至 `--settings-accent`。设置读取/校验/保存 Owner 不变，不新增设置、不改偏好。
- 权限、会话内容和 Agent 执行均不改变；标记只消费当前工作台已有的通知事实。

## 范围与验收条件

- 在确有未读 `complete` 通知的对应会话行尾显示小圆点，并用 `--settings-accent` 着色；失败、审批、提问、已读、其他会话及没有真实通知时不显示。
- 点击对应会话后，将该会话现有通知标记为已读，完成点随之消失；打开现有通知中心的已读流程保持原样。
- 桌面/窄分栏行布局不溢出；状态对辅助技术可辨识，圆点本身不截获鼠标/键盘操作。
- 直接回归覆盖通知匹配/过滤、读取后清除和行标记语义；Client 类型检查、Workspace 包与 Web 构建通过，构建输出只写入根 `dist/`。
- 在当前源码正式 Web 的 `/work` 页面实测桌面和窄分栏；用一条短真实回复观察完成通知圆点，并点开会话确认圆点消失。记录视口、交互、截图证据与未测边界，不改用户偏好。

## 修改边界

只允许调整工作区会话行、Workbench 的通知已读回调装配、对应长期回归、受影响包 README、此合同及 `docs/PROMPTS.md` 索引。不得扩展为新的 Session API、状态轮询/订阅、通知持久化、样式主题设置或执行行为。

## 实施与验证记录

- `ApplicationWorkspace` 按 `session.appId` + `session.id` 匹配通知并执行已读回调。跨 App 会话列表不再拿当前工作区 App 与通知做比较；根因已由实页复现并修复。
- 桌面实页：ChatGPT 内置浏览器 `http://127.0.0.1:3000/work`，截图视口 1312×1244；真实短回复“圆点验收通过。”完成后，对应会话行显示 `--settings-accent` 蓝点。截图在本轮浏览器验收输出中，圆点与会话行上下文可见。
- 已读交互：点击带有“有未读的回复完成提醒”辅助标签的会话行，`session.appId`/`session.id` 范围内通知变为已读，圆点数量从 1 变为 0。
- 窄分栏实页：将同一路由临时设为 1000×720；左二会话行宽约 104px，标题正常省略，行 `scrollWidth` 与 `clientWidth` 均为 103px，右侧操作区保持完整。700×600 时界面切换为窄屏布局并收起会话侧栏。临时视口在结束前已重置；当前检查不表示已在真实手机设备上验收。
- 真实 provider 验收使用两次极短回复，第一次暴露跨 App 状态匹配问题；修复后的第二次产生 6 个输出 token、未调用工具，验收到圆点出现和点开消失。对应临时验收会话已归档。未改通知、主题或权限设置。
- 直接回归：`client-session-completion-indicator.test.mjs` 2/2 通过；`pnpm run typecheck` 通过；`pnpm run build:web` 通过，输出在仓库根 `dist/apps/web`；`git diff --check` 通过。实页加载前按保护提示重启了本任务启动的 LFAA Web，并确认 `/api/health` 状态 `ok`。
- 范围外未测：真实手机/平板设备、桌面 Electron；此次窄屏测试由内置浏览器临时视口完成。
