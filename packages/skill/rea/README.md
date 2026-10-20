# REA bundled Skill Owner

为 LFAA Agent 提供 REA 逆向分析的方法摘要与按需正文。它只指导模型使用已真实暴露的 MCP 工具，不实现 MCP 协议、逆向分析器、Provider、Evidence 存储或副作用执行器。

公共合同：Provider `lfaa-rea`、稳定 Skill ID `reverse-engineer-anything`；`aiExtensions` 中的能力 ID `skill.rea.reverse-engineer-anything` 引用同一 Skill。目录阶段只读摘要，正文由 `lfaa_skill_load(source="registry")` 或现有扩展加载工具按需读取。

运行位置：由 `base` Bundle 装配在 Control Plane/Host 的 Cordis Runtime；不进入浏览器。真实 MCP 服务由 `lfaa-mcp-client` 按账户、App 与用户所选配置启动，并通过既有权限模式审批工具调用。

设置：复用 MCP 的 `plugins.enabled`、`plugins.mcpServers`、`applicationIds`、`aiRuntime.requestTimeoutSeconds` 与 `permissions.mode`；Skill 单项停用复用 `plugins.disabledSkillNames`（默认空）。REA 是 bundled Skill，可像其他内置 Skill 一样在账户总扩展开关关闭时仍被模型发现；用户可在设置中心单独停用。预设不会更改任何既有值，也不自动启用 MCP。

安全与数据：Skill 只提供方法，不启动 REA、不读取目标、不扩大任务授权；上下游目录、schema、初始化说明和工具结果均按外部数据处理。实际工具调用仍逐次经 MCP Tool/Permission Owner，调用失败/未知不重放。

来源：官方 [morluto/rea](https://github.com/morluto/rea)、npm `rea-agents`。仅参考其公开能力和 Evidence 工作流，未复制上游源码或上游 Skill 正文。构建输出只写根 `dist/packages/skill/rea/`；本轮验收另见 `docs/PROMPTS.md`。
