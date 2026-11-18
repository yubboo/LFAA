# Update Log 000061 — 历史会话固定存放在本机 `~/.lfaa/sessions`，不再跟随项目迁移

- **编号**：000061
- **时间**：2026-11-18 09:52:03 +08:00
- **对应 Dev Log**：[000061-20261118-0952-fixed-local-sessions-dir.md](file:///e:/lfaa/docs/dev-log/000061-20261118-0952-fixed-local-sessions-dir.md)

---

## 更新内容

1. **历史会话固定本机存储（`.lfaa/sessions`）**
   - 对话历史会话统一固定保存在当前操作系统用户的 `.lfaa/sessions` 目录（不跟随项目目录变化，切换/迁移资料库位置时也不会把聊天记录搬入项目 `data/`）。
   - 此前迁移进 `data/chat-sessions` 的会话文件已自动无损归位回 `.lfaa/sessions`。

2. **设置中心 → 存储清晰区分两类路径**
   - 页面明确展示「当前资料库目录（可迁移：`agent-outputs` / `user-assets` / `long-term-memory.json`）」与「历史会话目录（固定随本机用户，不跟随项目：`~/.lfaa/sessions`）」。
