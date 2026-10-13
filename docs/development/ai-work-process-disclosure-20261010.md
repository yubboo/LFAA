# AI Work 回复耗时与工作轨迹呈现合同

## 目标与可观察行为

- `/tasks` 的助手消息摘要位于回复内容之前，运行期间按本轮开始时间显示已处理时长和当前阶段。
- 运行期间工作轨迹默认展开，用户可实时查看已有 Session 活动中的操作名称、状态、说明和步骤耗时；本机/目标节点 Shell 调用在执行结果活动说明中提供有界、常见凭据样式脱敏的命令预览。
- Run 完成后摘要显示“已处理 <总时长>”，工作轨迹默认收起且可展开；最终助手回复仍保持可见。
- 轨迹只投影已有真实活动，不合成用户/助手消息，不展示隐藏推理或原始工具结果；Shell 预览只用于用户查看，不改变工具参数、执行位置和结果。
- 结束耗时以助手消息创建时间到最后持久化活动时间为准；进行中耗时以助手消息创建时间累计。每个活动步骤继续显示其自身持久化耗时。

## Owner、入口与设置

- 运行入口：`apps/web` 的 `/tasks`。
- 渲染 Owner：`packages/client/ui-chat/src/AiWorkChat.tsx` 与同包 `activity-duration.ts`、`ai-work-chat.css`。
- 消息与活动持久化 Owner：`packages/core/session`，本轮沿用现有 `createdAt` 和 `activity.detail`。
- Agent Loop Owner：`packages/core/agent-loop/src/execute-turn.ts` 只为本机/目标节点 Shell 活动添加有界命令预览；不改变模型决策、工具执行或授权。
- 沿用现有主题/外观设置映射（主题、强调色、字体/字号、壁纸遮罩/模糊及减少动态效果），不新增或重置设置。

## 允许修改与禁止范围

- 允许修改：聊天组件、活动摘要纯函数、聊天样式、Shell 命令预览、`docs/系统总体架构.md`、`apps/cli/tests/ai-work-activity-duration.test.mjs`、`apps/cli/tests/client-performance.test.mjs`、`apps/cli/tests/agent-runtime.test.mjs`、本合同和 `docs/PROMPTS.md`。
- 保留当前工作树中已有的消息分页、澄清卡片、流式渲染、SSE 与其他并行改动；不回退、不清理、不覆盖无关修改。
- 禁止改 Provider/Agent 工具决策、Session 存储格式、权限、Daemon/节点执行、滚动行为及真实服务生命周期；不展示 Shell stdout/stderr 或工具原始 JSON，不增加设置、依赖或光标动画。

## 验收

1. 定向回归确认进行中按整轮真实时间累计、结束摘要使用真实总时长、步骤仍保留单步耗时，且只有完成状态默认折叠。
2. Agent 回归确认 Shell 活动中的命令预览有界并对常见凭据格式脱敏，且命令/工具派发路径不变。
3. 聊天包构建、客户端/入口类型检查、Web 构建和 `git diff --check` 通过；构建输出仅落在仓库根 `dist/`。
4. 静态/构建通过不等于真实浏览器或 Provider 验收；真实视觉、帧时间及当前运行服务加载本轮源码未测时如实记录。

## 本轮验证结果

- `apps/cli/tests/agent-runtime.test.mjs`、`ai-work-activity-duration.test.mjs`、`client-performance.test.mjs` 串行运行：35/35 通过，覆盖 Shell 命令预览长度/脱敏、整轮与步骤耗时、运行/完成展开状态、回复流渲染和 SSE 恢复。
- `pnpm --filter lfaa-agent-loop run build`、`pnpm --filter lfaa-client-ui-chat run build`、`pnpm run build:control-plane`、`pnpm run build:web`：通过；构建产物位于根 `dist/`。
- `pnpm run typecheck`：客户端与 Host TypeScript 检查通过。
- `pnpm run check:workspace`：178 个包检查通过。
- `git diff --check`：通过，无空白错误。
- 未做真实浏览器视觉/帧时间、Provider 实际对话或当前运行服务加载验收；未重启服务。
