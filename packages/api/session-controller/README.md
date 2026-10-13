# Session Controller

本包沿用唯一 `lfaa-session` Owner 暴露认证后的会话操作；不负责会话存储、身份、App 或项目归属。

- `GET /ai/sessions/:sessionId/messages` 返回当前账户拥有的消息投影，并附带已完成助手消息的反馈状态；首屏分页会在同一日志扫描中附带同账户、同 App 的分支来源会话，客户端不能指定来源。
- `POST /ai/sessions/:sessionId/messages/:messageId/feedback` 为已完成助手消息接收一条有界的正向或负向反馈；事件由 Session JSONL Owner 持久化。
- `POST /ai/sessions/:sessionId/fork` 接收助手 `messageId`；Agent Loop 通过当前已配置 Provider、使用无工具请求整理截至该回答的有界对话记忆，Session Owner 只持久化记忆与来源关系，不复制父会话消息/工具事件。摘要失败时不创建子会话；客户端不能指定边界或替换记忆。
- `POST /ai/sessions/:sessionId/fork-before-message` 接收用户 `messageId`，仅对已结束的独立用户轮次创建编辑分支；Session Owner 拒绝活动会话并从目标问题前推导边界，客户端不能指定历史或上下文。
- `POST /ai/sessions/:sessionId/side-chat` 在认证账户拥有的源会话上建立最新已记录上下文快照，活动 Run 不会被停止或修改；`POST /ai/side-chat/stream` 只接受带有效侧聊来源标记的会话。Session Controller 校验路由身份，Agent Loop 的统一 Run Owner 根据侧聊标记强制零工具、禁止用户澄清及不生成账户记忆，覆盖普通提交和排队续问路径。
- `PATCH /ai/sessions/:sessionId/plan-mode` 接收严格布尔值并通过 Session Owner 变更计划状态；路由认证后仍校验账户归属、归档/侧聊边界和活动运行，运行中的切换返回冲突状态。Slash command 和用户批准后的任务提交沿用 `/ai/chat/stream`。
- `POST /ai/runs/:runId/pause` 与 `/resume` 只控制当前认证账户的活动 Run；具体暂停门闩与安全检查点由 Agent Loop 持有。暂停不会 abort 正在执行的 Provider/工具，状态经该 Run 的 SSE `pause-state` 事件同步；既有 `/cancel` 仍用于真正终止。

所有路由沿用账户认证中间件。反馈不调用 Provider。普通记忆分支使用 Agent Loop 摘要 Provider，但不创建工具 Run、调用 Daemon 或重放历史工具；编辑后的新问题由 AI Work 通过原 `/ai/chat/stream` 与 Agent Loop 单独提交。侧聊使用已启用 Provider 和独立 Session/Run；其历史工具事件仅为上下文，不会在侧聊中重放。
