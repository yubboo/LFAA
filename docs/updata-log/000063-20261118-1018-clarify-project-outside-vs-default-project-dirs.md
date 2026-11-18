# Update Log 000063 — 清晰区分「项目外聊天（~/.lfaa）」与「默认新建项目目录（文档/lfaa）」

- **编号**：000063
- **时间**：2026-11-18 10:18:39 +08:00
- **对应 Dev Log**：[000063-20261118-1018-clarify-project-outside-vs-default-project-dirs.md](file:///e:/lfaa/docs/dev-log/000063-20261118-1018-clarify-project-outside-vs-default-project-dirs.md)

---

## 更新与修复

1. **三类存储位置职责清晰分离**
   - **项目外聊天 & 应用数据目录（~/.lfaa）**：未绑定项目直接发起的新聊天及全部历史对话记录（`~/.lfaa\sessions`，含项目内和项目外聊天），均存放在本机用户 `.lfaa` 目录，类似于 `.codex`。
   - **默认新建项目目录（<系统文档>/lfaa）**：仅填写项目名创建新项目、不添加源文件夹时，自动在此目录下新建同名项目目录（仅存项目文件，不存聊天会话），且支持在「设置 → 常规」独立修改。
   - **资料库目录（data/）**：在「设置 → 存储」统一展示「应用数据文件夹（~/.lfaa）」「历史会话目录（~/.lfaa/sessions）」与「可迁移资料库目录（agent-outputs / user-assets / long-term-memory.json）」。
