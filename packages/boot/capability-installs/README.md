# LFAA 通用能力安装路由

`lfaa-capability-installs` 提供跨类型的能力安装适配器登记和 AI Core Tools。它只负责发现、检查、路由到类型 Owner、核验状态及呈现支持范围；来源内容、业务数据、权限与运行事实仍归各领域 Owner。

模型根据用户目标自主规划，不要求用户提供内部工具名或调用顺序。先查能力目录与当前安装清单，再按意图选择 Skill、MCP 或插件；GitHub URL、包名本身不能改变能力类型。明确来源直接按用户选定类型检查；模糊目标才搜索候选。安装/启用仍遵守现有一次性检查凭证、permissions.mode、Permission Owner 与领域 Owner 回读。为减少“一句话安装 Skill”的多轮往返，另提供 `capability_install_skill`：它在一次工具调用内完成“定位固定来源 → 检查 → 安装 → Owner 回读”，多候选、来源歧义或缺少来源时只返回候选且不安装；它复用同一能力与 Owner 回读逻辑，不是第二条权限路径，审批仍由统一 Permission Owner 按其危险操作范围决定。

适配器按类型登记，必须声明可用 App、类型专属 `targetSchema`/目标校验，并实现真实的搜索、来源检查、安装、Owner 状态回读核验和清单读取。类型目标（例如 Minecraft 实例 ID 或 Skill 所属项目）随检查传给 Owner 并绑定到凭证；安装只能使用这次检查的目标。检查还必须返回领域 Owner 固定的 `resolvedRef`（提交、内容摘要或等价不可变版本）与 JSON 检查详情；安装只能接收这次检查得到的固定版本和详情。通用路由为检查生成 15 分钟有效、按用户/类型/App/目标绑定且只能消费一次的凭证，并限制凭证数量与检查详情体积；安装开始前消费凭证，结果未知时必须重新检查，不能重放旧安装操作。安装工具返回 Owner 回读状态：`ready` 表示 Owner 确认能力可由目标 Runtime 使用，`installed` 表示记录存在但尚未确认就绪，`incompatible` 表示记录存在但运行适配不兼容，`unknown` 表示无法确认。`unknown` 状态会提示先查询清单，不把安装动作当成成功，也不直接重放安装。启停与移除按类型作为可选生命周期操作。

每个 Owner 还须提供 `revalidateTarget`，安装前根据当前会话/实例重新确认凭证目标仍有效且未变化。检查的可读摘要、来源、固定版本和 Owner 目标摘要会显示在危险操作审批范围里；检查返回的目标摘要不会向模型泄漏服务端内部路径。

未登记的 Prompts、Tools、Minecraft 插件或模组类型会被明确报告为未接入，不会落入通用插件目录或伪报安装成功。共享账户 Skill 适配器由 `lfaa-capability-skill` 提供：固定 GitHub commit/archive，按 Agent Skills frontmatter 与名称验证，交由 Knowledge Library Owner 保存到当前账户；安装凭证绑定发起操作的账户与 App，Skill 可由同账户所有项目和 App 的 Skill Registry 发现并按需加载。安装不写入项目 `.agents/skills/`，不运行来源脚本；文件数与总大小有界，资源清单和正文由 Skill Owner 回读核验。MCP 安装由 `lfaa-capability-mcp` 提供：自然语言检索官方 Registry v0.1，支持 npm/PyPI/NuGet 固定版本 stdio 包、无认证 Streamable HTTP 远端及用户明确提交的本机 command/argv；统一 Permission Owner 决定是否可执行，绝不解析 Shell 字符串；Settings 与 MCP Runtime Owner 回读并核对真实工具合同，Agent Loop 下一模型回合刷新工具。远程生产 Host 拒绝启动本机 stdio。格式不兼容、缺密钥输入或 Owner 无法回读时报告真实阻塞，不伪造完成。

当前已注册 plugin、skill 和 MCP 适配器。账户 Skill 支持安装、列出和精确删除；更新、覆盖与启停尚不支持。MCP Registry v0.1 是预览 API；Cargo、OCI、MCPB、SSE、OAuth/认证 Header、通用密钥设置 Owner 尚未接入，npm/PyPI/NuGet 下载字节摘要不能在首次运行前验证。Prompt、Tool、Minecraft 插件/模组安装尚未接入。以上限制不得隐藏；未支持能力明确说明原因。
