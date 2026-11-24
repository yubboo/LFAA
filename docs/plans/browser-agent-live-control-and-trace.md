# 浏览器子智能体丝滑操控与全过程可视化方案

- 状态：已实施
- 日期：2026-11-24
- 涉及包：`@lfaa/agent`、`@lfaa/subagent`、`@lfaa/browser`、`@lfaa/client-ui-browser`、`@lfaa/client-ui-chat`

## 1. 背景与实测根因

实测「做网站 + 内置浏览器验收」会话暴露 4 类核心痛点：

1. **无目标盲扫、耗时过长、意图误判**：浏览器子智能体沿用 40 步上限，频繁使用 `browser_evaluate` 改 `scrollTop` 逐屏盲扫，且先 `browser_screenshot` 再 `browser_visual_check` 双重截图；主 Agent 在用户仅要求「打开浏览器看效果」时仍误派浏览器子智能体从头跑验收。
2. **右侧浏览器不自动展开**：`chat-store.ts` 对非 `explicit` 浏览器动作受 `followAgentWorkbench` / `autopilotPausedForRun` 拦截，子智能体启动后右栏保持收起，用户看不到实时画面。
3. **无真人操控痕迹、视口闪屏**：`session-driver.ts` 直接调 Playwright 原生点击/滚动，页面内无虚拟光标、点击波纹、目标高亮或动作标签；且 `browser_evaluate` 暴力改 `scrollTop` 配合双引擎切回 iframe 导致画面跳帧与闪白。
4. **过程不透明**：`subagent-service.ts` 吞掉了子智能体的阶段思考与观察摘要；`Browser-Subagent-Card.tsx` 默认折叠全部截图证据，结论也等到整轮结束才出现，用户看不到「看了什么 → 哪里有问题 → 怎么改的」。

## 2. 改造范围与设计

### 2.1 意图硬分流（`@lfaa/agent`）
- 在 `packages/core/agent/src/context/agent-context.ts` 明确区分：
  - **纯预览意图**（「打开浏览器」「我要看效果」「预览一下」）：只调一次 `browser_present`，严禁派发 `invoke_subagent(mode=browser)`，展示后直接结束本轮。
  - **定向验收/排查意图**：派发浏览器子智能体时必须在 `prompt` 里给出 **3–5 条明确检查项**与结束条件，禁止泛泛「逐屏验收」。

### 2.2 浏览器子智能体定向瘦身（`@lfaa/subagent`）
- 浏览器模式默认步数上限由 `40` 收紧至 `15`（足够完成导航、快照、定点交互、2–3 次视觉抽检与控制台核查，彻底杜绝 43 步死循环）。
- 强化 `buildBrowserSubagentPrompt`：
  - 严禁用 `browser_evaluate` 改 `scrollTop` / `window.scrollTo` 逐屏盲扫，统一用 `browser_scroll` 平滑滚动 + `browser_snapshot` + `browser_click`/`browser_type` 真实操作。
  - 视觉核查直接调 `browser_visual_check`（其内部已自动截图），禁止先调 `browser_screenshot` 再调 `browser_visual_check` 双重截图。
  - 强制结构化回报：目标清单 → 实际交互与观察 → 发现的问题（定位与复现） → 结论（通过 / 需修复）。
- 在 `subagent-service.ts` 转发子智能体的**阶段思考/观察摘要**（如当前在核查什么、发现了什么），不再只推送冷冰冰的「思考中」。

### 2.3 真人级浏览器操控指示层与防闪屏（`@lfaa/browser`、`@lfaa/client-ui-browser`）
- 新增 `packages/core/browser/src/session/agent-overlay.ts`（独立小模块，单职责）：
  - 在 `fromAgent === true` 的 `click` / `hover` / `typeText` / `scroll` 前，向页面注入非侵入式只读覆盖层（`pointer-events: none; z-index: 2147483647`，带固定 ID `__lfaa_agent_overlay__`）：
    - 平滑移动的自定义虚拟光标（SVG 指针）
    - 目标元素柔和发光高亮框 + 动作气泡标签（如「点击 · 立即体验」「输入 · 搜索框」「向下滚动」）
    - 点击瞬间的扩散波纹动画
  - `scroll` 在 `fromAgent === true` 时优先执行短平滑滚动动画（并更新光标/滚动指示），消除生硬瞬移。
  - 页面内所有 `browser_visual_check` / `browser_screenshot` 截取干净画面时，保留或按需清晰呈现；且覆盖层自动在空闲 2.5s 后淡出，不污染业务 DOM 布局。
- `RightBrowserPane` / `browser-render-mode.ts`：只要当前会话由 Agent 操作过或正在运行浏览器任务，稳定保持 CDP 高清实时画面流，不因步骤间隙反复卸载重建 iframe 导致闪屏。

### 2.4 右侧浏览器自动展开（`@lfaa/client-ui-chat`）
- 在 `chat-store.ts`：新启动浏览器子智能体（首次进入浏览器自动化阶段）与 `browser_present` 一样视作高优先级展示信号，默认自动展开右侧浏览器舞台（尊重用户在同一次浏览器运行中手动点收起）。

### 2.5 思维链、截图缩略图与修正链可视化（`@lfaa/client-ui-chat`）
- `Browser-Subagent-Card.tsx`：
  - 顶部展示本轮验收目标摘要（截断自任务描述）与实时思考/观察进度行。
  - 步骤列表自动带出最新截图证据的**内嵌缩略图条**（默认可见，点击放大/切换），不再隐藏在不起眼的文字链接后。
  - 运行中实时更新阶段观察与发现，让用户全程看得见「看了哪一屏、点了什么、哪里通过、哪里报错」。

## 3. 验收标准

1. 单测与门禁：`pnpm check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm probe:boot`、`pnpm probe:loader` 全绿。
2. 真实端到端实测：启动本地 LFAA，通过真实页面与会话验证：
   - 浏览器自动化触发时右侧浏览器自动展开、画面无反复重建闪屏、可见虚拟光标/高亮/点击波纹；
   - 聊天卡片实时展示目标、阶段思考、步骤轨迹与内嵌截图缩略图；
   - 测试「帮我做一个单页网站并验收」与「帮我打开浏览器我要看效果」两种意图，确认前者定向高效闭环、后者仅 `browser_present` 不重跑验收。
