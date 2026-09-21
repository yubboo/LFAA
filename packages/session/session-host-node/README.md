# @lfaa/session-host-node

Node 端 Project + Session 持久化 Provider。v2 Index 保存项目、活动项目、置顶、展开和最近会话；每个 Session 独立 JSON 保存 mode/messages/Run Timeline/workContext。写操作串行并原子替换，v1 Index 自动迁移；未来切换 SQLite 时上层继续消费 `@lfaa/session` 契约。
