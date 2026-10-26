# 外部子 Agent 流式文本合同（2026-10-27）

## 审计发现

LFAA 主 Agent 的 Provider 文本已通过 Agent Loop delta 事件进入认证 Run SSE；Claude Agent SDK 子 Agent 之前只读取最终 `result`，SDK 的中间文本没有传回父 Run。本轮把外部 SDK 的安全文本增量接入同一 Run 通道，最终子任务结果仍经工具 observation 回到主模型。

## Owner 与数据流

1. `lfaa-subagent-claude-code` 开启 SDK `includePartialMessages`，只接受 `parent_tool_use_id === null` 的 `content_block_delta/text_delta`，过滤 thinking、工具参数和嵌套子 Agent 文本，并在转发前脱敏当前 API Key。
2. SDK driver 以 2048 字符或 72ms 为界合批，计时器在结束/取消路径中清理；`lfaa-tool-subagent` 通过 `AiBusinessToolContext.onSubagentTextDelta` 把片段返回给父 Agent Loop。
3. Agent Loop 只发布 `subagent-delta` 内存事件，包含父 `messageId`、当前 `activityId` 和短文本片段。此事件不追加到模型 messages、Session JSONL、Activity 持久化或 tool observation。
4. Client Connection 校验事件属于当前 Run 且片段不超过 2048 字符。聊天活动详情最多保留 8 个预览、每项 4096 字符，在 Run 终态或会话切换时清空；重新订阅不重放断线期间的临时增量。

无需新增设置。界面沿用 AI Work 既有代码字体/字号、主题颜色令牌；没有更改用户偏好或 Permission Owner。预览只在展开的工具活动中显示，最终回答和工具 observation 仍是完成任务的权威结果。

## 本轮验证

- `lfaa-tools`、`lfaa-subagent`、`lfaa-subagent-claude-code`、`lfaa-tool-subagent`、`lfaa-agent-loop`、`lfaa-client-connection`、`lfaa-client-ui-chat` 能力包构建成功，写入根 `dist/packages/`。
- Host 与 Client `tsc --noEmit` 检查通过；`pnpm run build:web` 成功，Web 文件写入根 `dist/apps/web/`。
- `subagent-claude-sdk-permissions.test.mjs` 9/9 通过，覆盖 partial event 开关、顶层文本过滤、Key 脱敏及隐藏 thinking/工具/嵌套内容排除。
- `subagent-agent-loop-permission-bridge.test.mjs` 1/1 通过，确认外部子 Agent 文本沿父 Run 瞬时事件传递，且批准/拒绝仍由原 Permission Owner 和 dispatch 决定。
- 后续 Token 用量批次：`subagent-claude-sdk-permissions.test.mjs` 与 `subagent-agent-loop-permission-bridge.test.mjs` 共 10/10；覆盖 SDK `modelUsage` 字段换算、Session 累计和父消息 usage 投影隔离。Host/Client `pnpm run typecheck`、7 个直接 Owner 包构建和 `git diff --check` 通过。测试未启动真实 Anthropic 账户/Provider，不证明实际账单费用或真实缓存 token。
- `git diff --check` 通过。
- 内置浏览器 `/work` 目视验收未通过：当前 3000 服务返回项目的“需要重新启动”503 页面。为避开该端口和用户数据，隔离 Control Plane 使用 `dist/.tmp` 数据、端口 3010 启动，但 `/api/health` 不响应；启动器的 Vite 就绪门槛因此没有放行前端。本轮没有检查桌面/窄视口交互，也没有保存页面截图。隔离进程已停止，未触碰 3000 上的服务。

## 后续边界

SDK result 的 `modelUsage` 已在锁定 SDK 结果模拟回归中转换为按模型 token，并通过 `purpose=subagent` 计入现有 Session 汇总；合成 Agent Loop 回归确认它不覆盖父助手消息的主 Provider 用量。真实 Anthropic Provider usage、token streaming、浏览器目视/窄视口验收和跨平台取消仍需验收。SDK `costUSD` 是估算值，不保存为实际费用。子 Agent 文本预览是可丢失的活动增量，不是可恢复历史；如果未来需要断线恢复预览，应另行评估有界 checkpoint，而不能把增量改写为 Session 正文。网络出口仍没有域名级 allowlist，见 [Agent 网络 egress 合同](agent-network-egress-contract-20261027.md)。

本轮临时服务数据留在 `dist/.tmp/agent-subagent-stream-acceptance-20261027/`；执行环境拒绝了清理命令，不能据此声称临时数据已删除。
