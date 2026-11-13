# LFAA AI Work 跨模型缓存前缀优化

<a id="lfaa-ai-work-prompt-cache-universal-20261112"></a>
<a id="lfaa-ai-work-deepseek-cache-prefix-20261112"></a>

## 目标、Owner 与设置

- 目标：缓存友好请求前缀是 LFAA 系统级能力，所有模型路由共用且不由模型选择开关；稳定 system prompt 与易变运行上下文分离。会话缓存统计跨 Provider/模型累计，切换模型不得清空、屏蔽或重置已有统计。
- Provider 返回的 `cacheReadTokens / promptTokens` 是实际命中观测，不是缓存能力的启用条件。缺字段只表示本次命中数据未知；它不能否定系统级请求结构，也不能抹掉其他请求已有的缓存读取数。
- Owner：`packages/core/system-prompt` 持有稳定 LFAA 指令；Agent Loop 提供当前实际运行上下文；`packages/llm/llm` 统一构造所有模型共享的消息顺序并适配 Provider 请求；Session 持有用户可见对话与私有 request/context 事实；Client 汇总展示会话级缓存数据。
- 不新增设置、不修改偏好、不把缓存功能绑定到特定 Provider/模型、不向 DSH 写入、不发送未经当前路由合同支持的缓存参数。

## 排查结论与边界

- 现有系统提示按稳定顺序组合：LFAA 核心、权限、App、扩展指引、Agent 指引、人格尾段，末尾再拼每轮可能变化的 Git/工作区/写作/记忆运行上下文。此处一旦变化，后面的对话历史也无法作为相同前缀复用，可能解释低比例；当前截图没有单请求快照，不能认定这是 5.5% 的唯一原因。
- Pi 的策略是按 Provider 协议使用显式缓存能力，例如 Anthropic 的 cache-control 边界或受支持 OpenAI 路由的缓存键/保留参数；不是所有模型通用的消息重排。
- DSH 的 DeepSeek 适配器以 `https://api.deepseek.com/anthropic` 为默认根，`deepseek-flash` 声明 `systemPromptUpdate: in-history` 后才追加新 system 快照。LFAA 设置中心的 DeepSeek 默认 `chatUrl` 是 `https://api.deepseek.com/chat/completions`，自定义端点仍由账户配置决定。官方文档允许 Chat Completions 在对话中插入 system 消息，但没有定义后置消息必定替代首条提示；DSH 公开讨论也报告其 Messages 路由的替代语义可能不稳定。因此不能把 DSH 的模型声明直接移植到 LFAA 默认路由。
- 通用方案不依赖后置 system 覆盖：`packages/llm/llm` 保持全路由共享的 system prompt；Agent Loop 的易变运行上下文作为有明确边界的 JSON 背景段放在当前 user 消息内。权限、App 指引、工具选择、Agent/人格指令仍留在 system 层；消息只在已存在的当前用户输入上增加上下文，不创建第二个用户气泡或持久对话消息。
- 缓存友好请求结构与会话统计均由系统统一维护，切换模型不会关闭这项能力或清空累计值。Provider 可以返回不同粒度的命中数据；缺失计数保持未知并展示覆盖范围，不把它当成零命中或缓存关闭。
- 5.5% 仍然是准确的 Provider 命中输入占比；缓存命中可降低输入费用，不会减少 Provider 报告的 prompt token 或上下文占用。

## 验收

- 定向回归验证不同 Provider/模型使用相同 system/context 构造；多模型会话汇总跨模型累计完整缓存数据，部分数据保留已报告缓存读取量与覆盖数；动态上下文计入模型 Token 估算与压缩，同时不写入可见聊天历史或规范对话消息；附件、工具往返、摘要请求、请求取消和 compaction 语义保持。
- 运行相关 LLM/System Prompt/Agent Loop/Session 回归、受影响包构建、必要类型检查及 `git diff --check`；产物只能写入根 `dist/`。
- 真实缓存读取数只通过 Provider response usage 验证。若未使用真实账户发起请求，则记录该限制；不得用 fixtures 冒充命中。

## 本轮实施与验证

- 当前源码已具备所有路由共享的稳定请求结构与运行上下文边界；本轮继续修正多模型会话汇总和无记录空态，确保模型切换只影响真实请求路由，不影响系统级缓存能力或既有累计值。
- 设置：不新增、不读取或修改与缓存无关的设置；沿用当前模型路由及已有用量事实。
- 回归：`pnpm --filter @yubboo/lfaa run test -- tests/ai-work-usage-summary.test.mjs tests/system-prompt-cache-prefix.test.mjs` 通过 11/11；其中覆盖两种不同 Provider/模型路由生成相同 system/context 消息结构、跨模型完整用量聚合、部分缓存读取量与覆盖范围保留，以及空态不误报 Provider 故障。
- 扩展相关回归：LLM、Session 用量/性能、Agent Workbench Context 和附件用例均通过；合计 47 项中 46 项通过。`tests/agent-context-spill.test.mjs` 单独复跑仍失败：`execute-turn` 的合成 Provider 用例没有在后续消息中收到预期的 spill 原文片段。失败发生在本轮未改动的 Agent Loop spill 路径；未改当前工作区已有的 Agent Loop 变更，故该 spill 语义不能记为通过。
- 构建与静态检查：`pnpm --filter lfaa-client-ui-chat run build`、`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm run build:web` 和 `git diff --check` 通过；正式 Web 启动后 `node scripts/runtime-build-state.mjs web` 返回 `[]`，`/api/health` 返回 HTTP 200。构建输出均位于根 `dist/`。
- 页面：ChatGPT 内置浏览器实际访问 `http://127.0.0.1:3000/work`。桌面视口 1280×720 与窄屏 390×844 均可见已保存的真实会话用量；窄屏页面保留聊天内容、回复区和底部汇总条。最新查看的会话显示 `5.2K tok · 缓存命中 86.4%`。最终 Web 重建包含随后到达的旁路工作区源文件更新并通过 `runtime-build-state`；最后一次启动后健康接口 HTTP 200。内置浏览器没有在最后一次重启后再次刷新：前两次页面重载/服务重启自动触发了两次现有会话标题生成路由，该路径调用当前模型并记录真实 usage；为避免再触发标题请求，没有第三次重载。缓存专项没有发送聊天消息，也没有为验证缓存命中率额外请求模型。
- 边界：不同模型的统计聚合、未知计数的覆盖展示和请求消息结构由定向回归验证；本轮未实际切换用户模型，也未向多个真实 Provider 发请求，因此没有新增真实跨 Provider usage 样本。缓存命中仍只按 Provider 实际返回的 usage 记录，不从请求结构推断命中率。
- 设置：没有新增或修改设置中心配置；现有 `aiRuntime.showContextUsage` 用户偏好保持不变。

## 2026-11-13 公共请求与缓存 usage 修正

- 用户截图中 Ark Agent Plan 的 `doubao-seed-2.0-mini` 与 `glm-5.3-flash` 显示“Provider 未返回缓存读取计数”。源码确认所有通用 Chat Completions 流式请求此前都没有发送 `stream_options.include_usage`。方舟 Chat API 默认不会在流式响应中返回 usage；隐式缓存可能已经工作，但 LFAA 无法读取 `prompt_tokens_details.cached_tokens`，因此显示未知。
- LLM Owner 现在对所有通用 Chat Completions 路由统一发送 `stream_options: { include_usage: true }`；此参数只请求真实 usage，不按 Provider/模型 ID 开关缓存，也不创建缓存或伪造命中。缓存是否启用仍由支持该能力的 Provider 自动处理。
- 将运行时 Git/工作区/写作/记忆以及经 Settings 校验的当前路由事实统一放到当前 user 请求末端，稳定 system 和此前历史前缀保持不变。上下文仍进入 Provider 请求、token 估算与压缩；压缩同步回规范历史前剥除临时前缀。模型路由变化不会再改写 system prompt。
- 工具往返时请求可能以 `tool` 消息结尾；此时运行上下文追加为请求末尾的临时 user 消息，不回头改写已进入历史前缀的旧 user 消息。压缩同步会移除这条临时上下文。
- LLM Owner 统一归一化 Chat、Responses 和 Messages 常见输入/输出及缓存读取字段，Ark 既有用量辅助函数改为委托该单一解析 Owner；缺字段仍保留未知。
- 真实 Provider 计数、实际缓存命中率与账单节省仍需后续真实账户请求验证；测试夹具只验证请求结构和字段解析，不能作为命中证据。
- 本轮复归：`corepack pnpm --filter @yubboo/lfaa run test -- tests/llm-completion.test.mjs tests/system-prompt-cache-prefix.test.mjs` 通过 28/28，含工具往返时动态上下文追加到请求末尾、压缩后剥除且不改写已缓存历史的回归。
- 本轮构建与类型：`corepack pnpm --filter lfaa-llm run build` 通过，输出位于根 `dist/packages/`；`corepack pnpm --filter @yubboo/lfaa run typecheck` 通过。System Prompt、Agent Loop 与 Ark LLM 包构建在本轮前序实现后通过；最终差异检查待本条记录更新后复跑。
- 未调用真实 Provider、未重启 Web/Daemon；当前实现和请求统计仍未获得本轮真实账单/命中样本。
