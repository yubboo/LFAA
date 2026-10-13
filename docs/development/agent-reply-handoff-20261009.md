# LFAA Agent 首次回复与推理前置阶段合同

## 目标、入口与 Owner

确保新任务在本地能力准备出错时仍能到达 Provider；若失败，用户能从会话活动中辨认失败阶段与错误。真实流式正文仍由 Provider 返回、Agent Loop 保存并通过 SSE 展示。

- Agent 生命周期、取消及 SSE 终态由 `packages/core/agent-loop/src/runs.ts` 与 `packages/api/session-controller/src/index.ts` 持有。
- Provider 请求、模型工具循环和最终回复由 `packages/core/agent-loop/src/execute-turn.ts` 持有；协议解析由 `packages/llm/llm/src/completion.ts` 持有；客户端 SSE 与增量渲染分别由 `packages/client/connection/src/api.ts`、`packages/client/ui-chat/src/AiWorkChat.tsx` 持有。
- 设置复用 `aiRuntime.requestTimeoutSeconds`、`aiRuntime.maxOutputTokens`、当前账户 Provider 与 `permissions.mode`；不新增设置、权限模式或额外授权规则。

## 现状证据

- 2026-10-09 16:42 的对应 JSONL 会话以空正文和 `assistant.status=error` 收尾；此前只有上下文/工具/Skill/Expert 初始化活动。没有 `step/start`、`request/header`、`assistant/response`，说明 Provider 尚未收到请求。
- 16:30 的相邻失败轮次具有同样形态。会话只保存最终错误状态，没有保存异常文本，因此不能回推当时的精确异常；之前把取消按钮防误触作为根因没有证据支持。
- 首次 Provider 请求前的 `refreshCapabilities()` 会同步等待 Skill 注册表扫描。Skill 目录摘要本身是可选上下文，已有模型可选调用的 `lfaa_skill_list` / `lfaa_skill_load` 工具；同步扫描异常或延迟不应阻断普通回复。

## 修改范围

- 移除每次 Provider 请求前的全量 Skill 目录扫描；模型根据用户目标自行决定是否调用 Skill 发现/加载工具。保留配置、模型选择、工具范围和 Skill 正文按需读取行为。
- Skill 目录扫描改由模型调用现有 Skill 工具按需发现；观察性质的推理前/后钩子与 MCP 清理错误均不得覆盖或阻断模型回复，并通过 unavailable 活动留痕。
- 对未到达 Provider 的准备错误写入 `模型请求尚未发出` 活动；Provider 或 Agent 阶段错误也写入明确活动，并仅向结构化日志记录错误阶段和错误类型。会话活动继续携带原本会显示在聊天错误提示中的错误文本。
- 保留此前 Run ID/停止控件交接保护，但不把它宣称为这次卡住的原因或修复。
- 不改变 SSE 格式、模型请求重试、权限规则、工具执行或 Minecraft 生命周期。

## 验收

- 完整隔离 Web Profile Harness 验证模型先看到 Skill 工具、按需列出目录并加载正文；Skill 目录不再预先注入首个模型请求。
- Harness 注入 Skill 目录、推理前/后观察钩子异常时，普通 Provider 回复仍完整结束；注入其他推理前异常时，空回复状态带有 `模型请求尚未发出` 活动和可核对错误。
- Harness 验证 Provider delta 经 Agent Run 订阅交付，最终助手正文与状态正确；运行 Agent/客户端定向回归、相关类型检查、构建、`check:workspace` 和差异检查。
- 无真实 Provider、用户浏览器人工交互或桌面设备验收时，报告中必须如实区分隔离 Harness 与真实运行证据。

## 设置中心与验证记录

- 本次未新增或变更设置；继续读取当前 Provider、`aiRuntime` 与 `permissions.mode`。没有引入新的授权模式或审批硬规则。
- 验证：`pnpm --dir apps/cli test -- tests/harness-runtime-wiring.test.mjs tests/ai-run-stop-guard.test.mjs` 通过（2/2；完整隔离 Harness 覆盖 Skill 按需发现、推理前/后钩子失效后继续回答、准备错误留痕、流式 delta 与最终正文）；`pnpm typecheck`、`pnpm check:workspace`、`pnpm run build`、定向 `git diff --check` 均通过。
- 构建产物全部位于根目录 `dist/`。Web 构建仍报告既有 C++ 语法资源块约 501 kB 的大小警告。
- 未实测真实 Provider、实际 LFAA 浏览器交互或桌面运行，因此不声称用户界面上的这次真实 Provider 运行已经复测成功。新活动记录与失败阶段日志会为下一次实际运行提供精确证据。
