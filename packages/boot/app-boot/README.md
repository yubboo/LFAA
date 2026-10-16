# LFAA 共享启动与装配

AI Host 的 loadInstruction 仅转发同一 AiExtensionRegistry 的按需正文读取；listInstructionExtensions 只给摘要，getSystemInstructions 只提供主 Agent 核心指引。领域内容不再按 App 自动注入。专家角色由原 Agent Loop 显式选择并继承原权限/预算；Host 不另建内容库、Agent 或注册表。
