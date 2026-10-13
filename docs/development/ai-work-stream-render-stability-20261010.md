# AI Work 流式回复渲染稳定性合同

## 目标与可观察行为

- 用户发送消息后，中间聊天区持续显示 Provider 已交付的回复文本，不等待页面刷新。
- 文本生成过程中保持一个稳定、无光标的纯文本渲染节点；不在每个增量帧重解析整段累计 Markdown。
- 回复完成、失败或中断后使用既有 `AiMarkdown` 渲染完整 Markdown。
- 不改 SSE 生命周期、Agent 工具循环、权限和会话消息 Owner。

## Owner、入口与设置

- 运行入口：`apps/web` 提供的 `/tasks` AI Work 页面。
- 渲染 Owner：`packages/client/ui-chat/src/AiWorkChat.tsx`；最终 Markdown 由同包 `AiMarkdown.tsx` 承担。
- 文本传输 Owner：`packages/client/connection/src/api.ts`，本任务只核对其增量已按帧合并，不修改传输合同。
- 相关设置：外观高级设置中的 `aiWorkOutputFocusBlurEnabled`、`aiWorkOutputFocusBlurIdleSeconds`、`aiWorkOutputFocusBlurPercent` 和 `reducedMotion`；主题、颜色、字体与字号沿用工作台映射。本任务不增加设置，也不更改既有偏好。

## 根因依据与边界

- `streamAiChatAt` 使用 `createStreamDeltas` 按浏览器帧合并 Provider 文本。
- 主聊天 `onDelta` 对每个合并帧更新累计消息正文；当前渲染分支立即调用 `AiMarkdown`，其实现每次遍历全部行并重新构建块和行内 Markdown 节点。未闭合的段落、围栏代码块和其他块标记可随增量改变块类型。
- 因此高频累计解析及块结构变化是当前渲染抖动的直接可见风险；是否在真实机器造成超过 50ms 的长任务须由运行测量确认，本合同不把静态推断冒充帧时间证据。

## 允许修改与禁止范围

- 允许修改：`packages/client/ui-chat/src/AiWorkChat.tsx`、`packages/client/ui-chat/src/ai-work-chat.css`、`packages/client/README.md`、`apps/cli/tests/client-performance.test.mjs`、本任务登记和合同。
- 保留现有本地未提交改动；不覆盖停止保护、消息分页、设置对账或 SSE 相关实现。
- 不增加依赖、不新增设置、不加入光标动画、不改 Agent 或 Provider 行为，不重启正在运行的 Control Plane。

## 验收

1. 回归锁定 streaming 期纯文本和非 streaming 期 Markdown 的渲染分支，并确认不重新引入 CSS 光标。
2. 构建 `lfaa-client-ui-chat`，运行目标客户端类型检查、相关回归和 `git diff --check`。
3. 若无法安全使用当前登录态触发真实 Provider 请求，则注明浏览器真实流式外观、帧时长和 50ms 长任务未测；静态、构建及回归证据不替代它们。

## 本轮验证结果

- `apps/cli/tests/client-performance.test.mjs`：22/22 通过。
- `pnpm --filter lfaa-client-ui-chat build`：通过，产物写入根 `dist/packages/`。
- `pnpm run typecheck`：客户端与 Host 类型检查通过。
- `pnpm run check:workspace`：178 个包通过。
- `pnpm run build:web`：通过；Vite 报告仓库现有大块体积警告（`cpp` chunk 约 501 kB），与本次修改无关。
- Web 哈希产物检查：包含稳定流式文本类与保留换行规则，不含旧流式光标伪元素。
- `git diff --check`：本轮已跟踪改动通过。根 `package.json` 未提供 `workspace-preflight` 脚本。
- 未发起真实 Provider 对话；真实浏览器流式帧时间、50ms 长任务与运行中服务实际加载本次代码均未验。本次未重启 Control Plane。
