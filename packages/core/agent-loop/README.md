# LFAA Agent Loop

`lfaa-agent-loop` 负责 AI Work 的模型与工具循环。对话记忆仍由 `lfaa-conversation-memory` 持有；循环只检查账户设置，把符合条件的根轮次输入发送给已选 Provider，并通过记忆 Owner 保存已校验结果。

助手消息、主 Provider 用量和 `done` 事件提交后，才开始记忆提取。提取作为有界后台后处理运行：最多同时处理 4 个账户，每个账户最多 1 个任务；请求不带工具，输出上限为 512 token，超时为 30 秒。同账户已有新轮次或本地并发上限已满时跳过提取，并在活动记录中说明原因。成功提取记为触发该流程的助手消息上的独立 Provider 用量记录。提取错误不会改变已经完成的回答。

发送前，循环会对当前用户消息和最终回答中的常见凭据、个人标识模式做本地启发式过滤；该过滤无法识别所有敏感表达，不处理工具参数、工具结果或较早的 Session 历史。Session Owner 会从持久化的模型快照中移除注入的记忆区块。

用户提问能力由 `lfaa-user-questions` 插件提供。Agent Loop 注册 `agent-run` 回答者，将问题限定到当前账户、App 与 Run，再复用 Run 已有的等待、取消和 Session 答案记录；回答服务不另建问题持久化或交互界面。插件卸载时撤销回答者并取消其未完成请求。

带 `session/side-chat` 来源标记的侧边聊天由 `startAiRun` 统一识别，强制空工具范围、关闭用户澄清、关闭账户记忆写入，并跳过 MCP 发现；这些限制同样覆盖 `appendAiRunInput` 创建的排队续问。侧聊 Session 的来源验证由 `lfaa-session` 提供，HTTP 路由校验由 Session Controller 执行。

计划协作模式复用同一 Session 和 Agent Loop。模型可根据自然语言判断是否进入 `/plan` 计划讨论；讨论阶段只允许实际风险为 `read` 的普通工具，电脑操控与领域子 Agent 也在派发边界拒绝。模式转换优先于同一 Provider 响应里的其他工具调用，未执行调用记为 `not_started`。用户明确批准后退出计划模式，后续工具仍通过原权限模式和审批流程。
