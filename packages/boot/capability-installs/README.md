# LFAA 通用能力安装路由

`lfaa-capability-installs` 提供跨类型的能力安装适配器登记和 AI Core Tools。它只负责发现、检查、路由到类型 Owner、核验状态及呈现支持范围；来源内容、业务数据、权限与运行事实仍归各领域 Owner。

模型根据用户目标自主规划，不要求用户提供内部工具名或调用顺序。用户明确提供 GitHub 插件地址时，工具合同让模型跳过候选搜索和通用目录查询，默认使用当前 App 直接调用 Plugin Owner；若该 App 已有同源记录，先使用清单状态避免重复安装或隐式更新。安装/启用仍遵守现有检查凭证、管理员权限、审批与 Owner 回读。

适配器按类型登记，必须声明可用 App、类型专属 `targetSchema`/目标校验，并实现真实的搜索、来源检查、安装、Owner 状态回读核验和清单读取。类型目标（例如 Minecraft 实例 ID 或 Skill 所属项目）随检查传给 Owner 并绑定到凭证；安装只能使用这次检查的目标。检查还必须返回领域 Owner 固定的 `resolvedRef`（提交、内容摘要或等价不可变版本）与 JSON 检查详情；安装只能接收这次检查得到的固定版本和详情。通用路由为检查生成 15 分钟有效、按用户/类型/App/目标绑定且只能消费一次的凭证，并限制凭证数量与检查详情体积；安装开始前消费凭证，结果未知时必须重新检查，不能重放旧安装操作。安装工具返回 Owner 回读状态：`ready` 表示 Owner 确认能力可由目标 Runtime 使用，`installed` 表示记录存在但尚未确认就绪，`incompatible` 表示记录存在但运行适配不兼容，`unknown` 表示无法确认。`unknown` 状态会提示先查询清单，不把安装动作当成成功，也不直接重放安装。启停与移除按类型作为可选生命周期操作。

每个 Owner 还须提供 `revalidateTarget`，安装前根据当前会话/实例重新确认凭证目标仍有效且未变化。检查的可读摘要、来源、固定版本和 Owner 目标摘要会显示在危险操作审批范围里；检查返回的目标摘要不会向模型泄漏服务端内部路径。

未登记的 Prompts、Tools、MCP 安装路由、Minecraft 插件或模组类型会被明确报告为通用自然语言安装未接入，不会落入通用插件目录或伪报安装成功。项目 Skill 适配器由 lfaa-capability-skill 提供：只安装固定 GitHub 快照中的单个 UTF-8 文本 Skill，经 Daemon 项目文件 Owner 写入当前选择的项目并由核心再次回读发现状态，不运行仓库脚本。MCP 现有的账户设置与 Agent 连接 Runtime 仍由原 Owner 提供，本目录暂未管理其服务发现和新增。未来适配器仍需由对应领域 Owner 提供真实检查、固定版本、安装与状态核验，不可只实现通用接口包装。

当前已注册 plugin（lfaa-plugin-manager）和 skill（lfaa-capability-skill）适配器。Skill 更新、覆盖、启停和删除尚不支持；二进制 Skill 资源及 Prompt、Tool、MCP、Minecraft 插件/模组适配仍待对应领域 Owner 实现。所有类型都须先提供真实检查、固定版本、安装与状态核验，再接入对应 App、Settings 与 Agent Runtime。
