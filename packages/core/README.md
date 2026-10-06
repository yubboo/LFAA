# LFAA Core 核心包

LFAA Core 负责模型侧 Agent Run 生命周期、账户级个性化记忆、会话投影、工具目录、能力作用域、模型账户解析、工具 schema 呈现和系统提示词组装。各包将 DSH Core 职责适配到 LFAA 现有设置、会话、认证、权限、领域服务和 Daemon Owner。

| 包 | LFAA 职责 |
|---|---|
| `agent` | 扩展目录和 Agent 元数据 |
| `agent-default-model` | 通过设置中心解析当前模型 |
| `agent-loop` | 驱动模型任务、流式响应、取消、引导输入和委派 |
| `agent-tool-presentation` | 将登记工具呈现为 Provider 原生函数 |
| `conversation-memory` | 保存账户隔离、有界的 AI Work 长期偏好；生成资格由设置中心控制 |
| `scope` | 按 App 与子 Agent 允许集过滤模型可见能力 |
| `session` | 持久化账户隔离的消息、活动与模型历史 |
| `system-prompt` | 按序组装 LFAA 系统消息 |
| `tools` | 通过现有 Owner 登记并执行真实工具 |

LFAA 建立经过核验的隔离 Runtime 前，PTC 执行仍不可用。Core 作用域过滤只影响模型可见选择；实际工具执行继续服从所属 API、权限和领域校验。
