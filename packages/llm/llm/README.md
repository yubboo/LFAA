# LFAA LLM

`lfaa-llm` 是唯一 Provider 请求 Owner。Bundle 登记 `lfaaLlm` Cordis 服务；AI 主回答、自动摘要、分支记忆和回复后记忆都注入该服务，不直接选择协议实现。插件可按 Provider ID 登记 `AiCompletionAdapter`；重复 ID 明确失败，注册返回 Fiber 持有的 disposer，卸载后请求回到原有 OpenAI-compatible 实现。原 `core/agent-loop/src/runtime.ts` 已迁入 `src/completion.ts`，不保留第二份执行逻辑。

读取 Settings 的当前模型地址、凭据与能力目录；支持 SSE delta、SSE message 与 JSON message，限制响应大小、超时与输出。隐藏推理、密钥和错误响应正文不发给客户端。空响应提供格式/结束原因诊断；可恢复且尚无可展示输出或工具调用的错误才允许 Agent Loop 按 `aiRuntime.requestRetries`、`retryDelaySeconds` 重试，仍计入请求预算；不重放工具或更换模型。

构建输出为根 `dist/packages/llm/llm/`。真实用户 Provider 兼容性仍需单独验收。

参照 DSH `llm-pi-ai/replay` 保留 Chat Completions 实际返回的 `reasoning_content`，以账户、Provider、模型三项来源绑定的 `providerReplay` 交给 Agent/Session Owner。发给同来源 Provider 时才转换成原生字段，不推断其他协议或思考参数；请求观察者、正文回调和进度通知均不接收隐藏文本。私有协议仅由现有 Session 受保护记录保存，跨模型/账户不回传。旧会话没有记录的隐藏内容无法重建，不编造替代值。

SSE 必须收到 `[DONE]` 或正常 `finish_reason` 才能完成；只有 EOF 的半截正文/工具选择失败并禁止派发，有可见输出/工具选择时不自动重试。无换行的末尾 `[DONE]`、正常 finish_reason 和 JSON message 仍兼容。HTTP 400 只报告参数/协议拒绝，不依据“请求带 tools”就断言模型不支持工具，也不回显 Provider 错误正文。

Chat Completions usage 保留 DeepSeek `prompt_cache_hit_tokens`，兼容 `prompt_tokens_details.cached_tokens`，并在 Provider 只返回 `prompt_cache_miss_tokens` 时用已返回的输入总量减去 miss 数得到 hit 数；显式的 `0` 是真实冷缓存，缺字段或无效计数为未知。DeepSeek 上下文缓存由 Provider 默认自动处理，支持缓存的会话无需单独开关；LFAA 保持系统提示前缀稳定、把动态运行上下文放在后段，不注入缓存控制字段，也不伪造命中率。会话内前缀复用程度和命中仍由 Provider 决定并以其 usage 为准。

视觉模型的 Chat Completions 图片内容放在 `user` 消息。Agent Loop 的工具结果仍保留原 `tool_call_id` 与文本 observation；本 Owner 在 Provider 请求序列化时把工具图片附为紧随工具结果的临时 `user` 视觉消息，并标记为不可信外部资料。原始 Agent Loop 历史不改写，Session/request snapshot 由 Agent Loop 持久化投影剥除 Base64；普通用户图片附件保持原位。该协议适配不证明当前所选模型或兼容 Provider 一定支持视觉输入，能力仍以 Provider/model 实测为准。

远程图片 Provider 通过固定的 OpenAI Images 与火山方舟 Seedream 端点执行。没有参考图时走各自生成 API；有项目本机角色/场景参考图时，OpenAI 走 Images Edit multipart、Ark 走官方 Base64 `image` 字段，文件数量和字节数有界。调用方可传入 AbortSignal；请求超时和 Agent 主动取消分别报告，取消监听随请求完成撤销，不切换模型或端点。LFAA 的本地模型目录、Hub 下载、适配器注册和模型进程归 `packages/llm/llm-local-runtime`，MOSS-Image / MiniMax-H3 原生组件加载归各自系列适配器；本包继续独立拥有远程 Provider 请求协议。

Claude Agent SDK 的受管 Host relay 也由本包持有 Anthropic Messages 传输：固定 `https://api.anthropic.com/v1/messages`、`POST`、`anthropic-version: 2023-06-01`、8 MiB 请求体上限及 `redirect: "error"`；按请求 AbortSignal 取消，返回原始响应流供 SDK relay 按 SSE 转发。SDK 子进程收到的是 relay token，不是这里的账户 API Key。此接口只固定 Provider 目的端并保护凭据，不负责 OS egress allowlist、WFP 或 AppContainer 网络授权。

Agent Plan Seedream 图像请求使用套餐专属 `/api/plan/v3/images/generations`，仅供设置目录中 `taskType=image-generation` 的 Agent Plan 模型选择；Coding Plan 不会进入图像 API。方舟异步视频 Owner 同时接受按量 `/api/v3/contents/generations/tasks` 与 Agent Plan `/api/plan/v3/contents/generations/tasks`，创建、查询、取消必须从账户 Owner 解析并保持同一 providerId。不会把 Agent Plan ID 误发给普通按量端点；真实任务仍以 Plan 当前档位权限和 Provider 返回为准。

异步视频任务由本模块唯一 Provider Owner 调用火山方舟 `contents/generations/tasks` 创建、查询和取消排队任务。只向固定官方 API 发送用户选定的账户密钥/目录模型和 Settings 参数；参考图作为有界 data URL 与任务提示一起发送。任务输出 URL 必须符合已登记的 Ark 北京 TOS 主机，下载时拒绝重定向、限制 MP4 内容类型/ftyp 文件头、超时和 128 MiB 文件大小；仅返回二进制，不将临时 URL传给 Client。OpenAI 视频生成不在可用范围（其 Videos API 已下线）；真实 Provider 任务、额度、模型能力和账户权限需现场单独验收。
