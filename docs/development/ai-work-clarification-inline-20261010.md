# AI Work 澄清问题内嵌合同

## 目标与可观察行为

- `/tasks` 中的 `lfaa_ask_user` 澄清卡显示在提出该问题的助手消息内，等待用户选择、输入或跳过。
- 用户回答只返回当前 Run 的问题工具；对话列表不新增普通用户气泡，后续模型上下文也不把澄清答案改写为 `role:user`。
- 等待回答时，同一张卡在原助手消息下提供问题选项、补充输入和跳过操作。
- 回答或跳过后，卡片在原助手消息下收起为可点击的“澄清记录”；默认不占用大块聊天空间，点击后能查看原问题和对应答案/跳过状态。答案只出现在这条记录里，不另发用户气泡或重复回答文本。
- 原有活动记录与工具协议仍由 Session Owner 持久化。
- 消息滚动器只负责视口、自动跟随和锚点位置；本轮不改变滚动行为。查阅实现确认它没有写消息正文或重排消息的路径。

## Owner、入口与设置

- 运行入口：`apps/web` 的 `/tasks` AI Work 主聊天。
- 交互展示：`packages/client/ui-chat/src/AiWorkChat.tsx`；样式：同包 `ai-work-chat.css`。
- 当前 Run 的提问与回答：`packages/core/agent-loop`；账户/Run 校验与恢复：`packages/core/session`；请求协议类型：`packages/client/connection/src/api.ts`。
- 设置中心现有 `general.questionNotifications` 只控制通知栏/系统通知，不决定是否显示会话问题卡。问题卡继续读取用户主题、字体和字号令牌；审批仍使用既有权限模式。本次无新增设置，也不更改用户偏好。

## 根因与协议决定

- `answerAiRunQuestion()` 原本将澄清答案写成 `user/message` 并发出 SSE `input` 事件；Client 又将其追加到消息数组，因此它成为普通用户气泡。
- `historyForTurn()` 再把 `lfaa_ask_user` 工具结果合成为 `role:user`，改变了会话角色语义。当前 Run 的 Agent Loop 已通过原工具的 `role:tool` 结果继续，不需要额外的用户轮次。
- 修复后不追加普通会话消息；当前回答仍以原工具结果回到模型。后续上下文只保留已配对且完整的 `lfaa_ask_user` assistant tool-call/tool-result，跳过其他历史工具大结果。

## 允许修改与边界

- 允许修改 Agent Loop、Session、Client Connection、Client UI Chat、对应回归测试、相关 README、`docs/系统总体架构.md`、本任务登记及本合同。
- 保留工作树已有的全部并行改动；不重置、还原或整理无关文件。
- 不改消息滚动算法、SSE 生命周期、审批规则、Agent 规划策略、Provider、任何业务包的 Owner 或权限策略；不增加依赖/设置；不重启运行中的服务。

## 验收

1. Agent 回归确认提交问题答案后不新增 `user/message`，模型仍收到本轮澄清 `role:tool` 结果。
2. Session 回归确认新一轮历史保留有效澄清 assistant-tool/tool-result 配对，且不存在将答案合成为 `role:user` 的条目；其他历史工具结果不扩散。
3. Client 回归确认等待中的问题卡嵌在对应助手消息内且可交互；回答后同一消息仅显示默认折叠的可点击记录，展开后显示原问题及用户答案/跳过状态；等待和已回答问题都不显示为独立用户气泡或输入框上方全局提问栏。
4. 运行直接相关回归、包构建、类型检查、Web 构建、工作区检查与 `git diff --check`；记录未实测的真实 Provider/浏览器交互。

## 设置和数据边界

- 读取 `general.questionNotifications` 仅用于通知行为，使用既有外观令牌和权限设置；不新增或写死产品设置。
- Session JSONL 仍是消息/活动/工具上下文的唯一持久化 Owner；Agent Loop 只维护活动 Run 和等待信号。

## 本轮验证结果

- `apps/cli/tests/agent-runtime.test.mjs` 与 `apps/cli/tests/client-performance.test.mjs`：24/24 通过，含无普通用户消息、下一轮保留工具配对、答案在助手活动中显示、问题卡内嵌与原流式渲染回归。
- 本次折叠记录调整后，`apps/cli/tests/client-performance.test.mjs`：23/23 通过；`lfaa-client-ui-chat` 包构建通过。新 Web 产物确认包含澄清记录文案和对应 CSS。
- `lfaa-session`、`lfaa-agent-loop`、`lfaa-client-connection`、`lfaa-client-ui-chat`、`lfaa-api-session-controller` 包构建通过。
- 本次调整后 `pnpm run typecheck`、`pnpm run check:workspace`（178 包）、`pnpm run build:web`、`git diff --check` 通过；Web 产物输出在根 `dist/apps/web/`。
- 未连接真实 Provider 或在浏览器发起会话；真实澄清卡片交互/滚动观感未实测。只重建了源码和静态产物，没有重启运行中的服务；运行中页面何时加载新版本尚未核实。
