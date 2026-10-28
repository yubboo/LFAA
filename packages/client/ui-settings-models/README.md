# 设置页模型选项

本包为 Settings 与 AI Work 提供共享的模型/思考档位选项映射。Provider 模型名称、调用 ID 和能力来自 `lfaa-client-connection` 暴露的官方目录；本包只格式化显示标签，不创建别名、不推测能力，也不改写 `id` 或 `name`。

`aiModelPickerCatalog(accounts)` 汇总当前认证用户可见的全部账户模型目录，按 Settings Owner 有效账户顺序排列，并排除目录明确标记的非聊天模型及不支持当前套餐档位的模型；`effectiveAiAccount()` 使用相同的个人 Plan 覆盖/系统回退顺序。`modelParameterSummary()` 与 `modelCatalogCapabilitySummary()` 只显示已返回的上下文、输出上限、任务类型、输入模态、目录来源/备注和可信思考字段，缺失值标明未提供。`modelOptionLabel(providerId, model)` 显示 Provider 返回的原始 `name` 与 `id`，以中点分隔；`modelOptionVersionTag(model)` 只返回 Provider 目录提供的独立版本标签，不将其混入模型名称或请求 ID；`modelSelectorDisplayLabel(model)` 供折叠模型按钮显示原始名称和独立版本标签；`reasoningOptions` 只映射目录声明且标记为可信的思考能力。模型账户、目录持久化、默认思考值、请求参数与 Provider 认证分别归 Connection、Settings Service 和 LLM Owner。本包不持有设置、凭据、模型目录或用户数据，也不发起 Provider 请求。

消费者：`packages/client/ui-settings/SettingsPage.tsx` 与 `packages/client/ui-chat/AiWorkChat.tsx`。运行位置：共享 Client（Web/Desktop）。构建输出：仓库根 `dist/packages/client/ui-settings-models/`。直接回归与构建状态记录在 `docs/PROMPTS.md` 对应任务合同中。
