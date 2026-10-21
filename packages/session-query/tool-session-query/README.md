# LFAA Session Query

`lfaa-tool-session-query` 登记 session_search、session_trace、session_event_search、session_event_trace、session_event_read 和 session_storage_info 六项工具。调用者来自真实运行上下文 sessionId，模型不能指定或冒领发起会话；存储位置工具只返回当前会话 JSONL 路径元数据，不扫描或读取日志。

唯一 Session Owner 校验账户、App 与项目 ID/节点/目录；无项目绑定时只允许自身会话。搜索最多选择当前 App 的 200 个活动与 200 个归档头，结果和事件按页返回。消息 trace 返回授权范围内的用户/助手正文；事件查询只给结构状态、工具名和用量等白名单，不提供内部请求、隐藏推理、工具参数或结果。

复用 JSONL Owner 的异步单次哈希链校验与有界工作集，不恢复整批 Kernel；每页仍扫描完整日志，持久索引与 compaction 未实现。没有新存储或设置。

构建输出为根 `dist/packages/session-query/tool-session-query/`。
