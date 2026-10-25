# 本机附件存储

按账户把附件写进 `LFAA Data/users/<账户哈希>/attachments/`，实现 `attachment` 合同的 `AttachmentStore`。

- 账户隔离：根目录由账户哈希决定，调用方不能传路径；ID 必须是 UUID，拒绝路径成分。
- 有界：单文件 8 MiB（合同白名单），清单最多 200 条。
- 原子写入：临时文件 + rename，写后立即回读摘要；摘要不一致拒绝登记。
- 读取重验：元数据与账户匹配、内容摘要一致才返回字节。
- 不注册工具、不写设置、不把图片字节写入会话或日志。

构建输出：根 `dist/packages/attachment/attachment-local/`。直接回归：`apps/cli/tests/attachment-local.test.mjs`。
