# Session Title LLM

本包把有界用户输入包装为标题总结提示，并将模型输出归一化为最多 36 UTF-8 字节；用户首条消息作为不可信资料，不作为标题模型的执行指令。Provider 调用通过 `TitleCompleter` 注入，本包不读取凭据、设置或 Session 数据。

上游由首条输入适配器调用。构建写入仓库根 `dist/packages/session/session-title-llm/`。
