# Session JSONL 持久化

`lfaa-session-persistence-jsonl` 为 Session Owner 保存账户隔离的 JSONL 事务日志。每笔追加事务写入前按当前序号与 SHA-256 链校验，提交后 fsync；Session Owner 是本包写入接口的唯一业务调用者。

`rewrite()` 仅供 Session Owner 在校验账户归属后重写单个会话日志。它验证原链、保留事务身份与顺序、写入受限临时文件、fsync 后原子替换日志，并重新计算完整性链。AI Work 个人记忆删除使用这一受限入口移除历史模型请求快照中的注入记忆正文；不修改普通用户/助手消息，也不重写其他会话。
