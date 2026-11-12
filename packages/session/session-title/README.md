# Session Title

本包是会话标题的本地文本归一化 Owner，负责移除控制字符、压成单行并按 UTF-8 字节边界截断；`compactSessionTitleFromPrompt()` 为新聊天提供短回退标题。它不访问 Session、账户、设置或模型，也不持久化标题。

上游由 `lfaa-session` 调用，模型适配由 `lfaa-session-title-llm` 调用。构建写入仓库根 `dist/packages/session/session-title/`。
