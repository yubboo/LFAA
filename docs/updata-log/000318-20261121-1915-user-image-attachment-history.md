# 保留并展示用户消息中的图片附件

- 日期：2026-11-21 19:15 +0800
- 类型：Bug 修复

## 问题

图片模型请求能收到输入框里的图片，但直连生成流程只把文字保存成用户消息。生成后重新读取会话，用户气泡没有图片，因此用户看不到自己刚发送的参考图。

## 修复

生图接口在确认附件属于当前会话且确实是图片后，把原附件 ID 写入用户消息。会话记录保留轻量附件引用，聊天气泡使用现有会话附件 API 恢复并展示图片缩略图。附件暂时不可用时显示状态并允许重试。

## 验收

- 回归测试先复现旧行为中 `attachments` 缺失，再确认修复后引用 ID 与参考图请求都保留。
- 会话重新读取测试确认附件引用可持久化。
- 内置 Edge 在隔离测试环境中检查图片加载、深浅主题与控制台；1×1 测试图片已解码，控制台错误 0。
- 全量 check、lint、README 配对、类型检查、379 项测试、构建及 Loader 探测通过；没有调用真实媒体模型。

## 文件

- `docs/dev-log/000201-000400.md`
- `docs/updata-log/000318-20261121-1915-user-image-attachment-history.md`
- `packages/core/session/README.md`
- `packages/core/session/README.zh.md`
- `packages/core/session/README.i18n.yaml`
- `packages/core/session/src/types.ts`
- `packages/core/session/tests/session.test.ts`
- `packages/core/memory/README.md`
- `packages/core/memory/README.zh.md`
- `packages/core/memory/README.i18n.yaml`
- `packages/core/memory/src/types.ts`
- `packages/core/chat/README.md`
- `packages/core/chat/README.zh.md`
- `packages/core/chat/README.i18n.yaml`
- `packages/core/chat/client/chat-types.ts`
- `packages/core/chat/client/locales.data.ts`
- `packages/core/chat/client/components/ChatMessageList.tsx`
- `packages/core/chat/client/components/UserMessageAttachments.tsx`
- `packages/core/chat/client/components/UserMessageAttachments.module.css`
- `packages/core/chat/tests/user-message-attachments.test.tsx`
- `packages/media/tool-media/README.md`
- `packages/media/tool-media/README.zh.md`
- `packages/media/tool-media/README.i18n.yaml`
- `packages/media/tool-media/src/media-direct.ts`
- `packages/media/tool-media/tests/tool-media.test.ts`

Git 未提交或推送；原有工作区改动均保留。
