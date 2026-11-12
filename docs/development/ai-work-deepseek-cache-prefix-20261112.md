# LFAA AI Work 跨模型缓存前缀优化

<a id="lfaa-ai-work-deepseek-cache-prefix-20261112"></a>

## 目标、Owner 与设置

- 目标：为所有当前及未来模型路由提供同一套缓存友好的请求前缀组装；稳定 system prompt 与易变运行上下文分离，不按 Provider/模型 ID 选择功能分支。
- 截图中的 5.5% 按 `cacheReadTokens / promptTokens` 计算，是 Provider 报告的输入缓存读取比例；缓存命中降低 DeepSeek 对命中输入的计费，不减少发送/上下文中的 prompt token 数。
- Owner：`packages/core/system-prompt` 持有稳定 LFAA 指令；Agent Loop 提供当前实际运行上下文；`packages/llm/llm` 统一构造所有模型共享的消息顺序并适配 Provider 请求；Session 持有用户可见对话与私有 request/context 事实。
- 不新增设置、不修改偏好、不把缓存功能绑定到特定 Provider/模型、不向 DSH 写入、不发送未经当前路由合同支持的缓存参数。

## 排查结论与边界

- 现有系统提示按稳定顺序组合：LFAA 核心、权限、App、扩展指引、Agent 指引、人格尾段，末尾再拼每轮可能变化的 Git/工作区/写作/记忆运行上下文。此处一旦变化，后面的对话历史也无法作为相同前缀复用，可能解释低比例；当前截图没有单请求快照，不能认定这是 5.5% 的唯一原因。
- Pi 的策略是按 Provider 协议使用显式缓存能力，例如 Anthropic 的 cache-control 边界或受支持 OpenAI 路由的缓存键/保留参数；不是所有模型通用的消息重排。
- DSH 的 DeepSeek 适配器以 `https://api.deepseek.com/anthropic` 为默认根，`deepseek-flash` 声明 `systemPromptUpdate: in-history` 后才追加新 system 快照。LFAA 设置中心的 DeepSeek 默认 `chatUrl` 是 `https://api.deepseek.com/chat/completions`，自定义端点仍由账户配置决定。官方文档允许 Chat Completions 在对话中插入 system 消息，但没有定义后置消息必定替代首条提示；DSH 公开讨论也报告其 Messages 路由的替代语义可能不稳定。因此不能把 DSH 的模型声明直接移植到 LFAA 默认路由。
- 本轮通用方案不依赖后置 system 覆盖：`packages/llm/llm` 保持全 Provider 共享的 system prompt；Agent Loop 的易变运行上下文作为有明确边界的 JSON 背景段放在当前 user 消息内。权限、App 指引、工具选择、Agent/人格指令仍留在 system 层；消息只在已存在的当前用户输入上增加上下文，不创建第二个用户气泡或持久对话消息。
- 新结构由所有当前模型共用，模型切换后新模型的缓存可能冷启动；同模型后续请求仍使用同一请求组装规则。各 Provider 的缓存命中仍可能受缓存容量、最小前缀、驻留时长和 best-effort 调度影响，LFAA 无法保证任意 Provider 的 100% 命中。
- 5.5% 仍然是准确的 Provider 命中输入占比；缓存命中可降低输入费用，不会减少 Provider 报告的 prompt token 或上下文占用。

## 验收

- 定向回归验证不同 Provider/模型使用相同 system/context 构造；动态上下文计入模型 Token 估算与压缩，同时不写入可见聊天历史或规范对话消息；附件、工具往返、摘要请求、请求取消和 compaction 语义保持。
- 运行相关 LLM/System Prompt/Agent Loop/Session 回归、受影响包构建、必要类型检查及 `git diff --check`；产物只能写入根 `dist/`。
- 真实缓存读取数只通过 Provider response usage 验证。若未使用真实账户发起请求，则记录该限制；不得用 fixtures 冒充命中。

## 本轮实施与验证

- 实现待开始。
