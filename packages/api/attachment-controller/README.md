# 附件 API

认证路由：`GET /api/attachments`（当前账户清单）、`POST /api/attachments`（上传，JSON base64）、`GET /api/attachments/:id`（元数据）。

- 只调用 `ctx.lfaaAttachments`，不自己写文件、不建第二套存储。
- 解析阶段就拒绝非白名单类型、非法 base64、超过 8 MiB 或空内容，避免把大对象交给 Owner。
- 只返回附件元数据，不回传字节；图片进入模型请求由 Agent 循环按需读取。
- 账户隔离由存储提供方保证（路径由账户哈希决定，ID 只收 UUID）。
