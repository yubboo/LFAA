/**
 * 功能：回归"图片单独发送 / 图片+文字一起发送"的端到端接线合同。
 * 作用：用源码合同锁定三处必经环节，防止再次出现"界面有附件、请求里没有"的静默丢失。
 * 关联文件：packages/client/connection/src/api.ts、ui-chat/src/AiWorkChat.tsx、agent-loop/src/execute-turn.ts、runs.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../../../" + path, import.meta.url), "utf8");
const mustInclude = (source, snippet, message) => assert.ok(source.includes(snippet), message ?? ("缺少片段：" + snippet));

test("连接层必须把 attachmentIds 写进请求体（否则附件被静默丢弃）", () => {
  const source = read("packages/client/connection/src/api.ts");
  mustInclude(source, "attachmentIds?: string[];", "输入类型必须声明 attachmentIds");
  mustInclude(source, "input.attachmentIds?.length ? { attachmentIds: input.attachmentIds }", "请求体必须显式转发");
});

test("聊天界面：只带附件也能发送，且把 attachmentIds 传给连接层", () => {
  const source = read("packages/client/ui-chat/src/AiWorkChat.tsx");
  mustInclude(source, "const typed = value.trim();");
  mustInclude(source, "if (!typed && pendingAttachments.length === 0) return;", "空消息不发送");
  mustInclude(source, 'const content = typed || "请看附件。";', "仅附件时使用中性正文");
  mustInclude(source, "attachmentIds: sendingAttachments.map(item => item.id)", "发送时必须带上附件 ID");
  mustInclude(source, "(!draft.trim() && pendingAttachments.length === 0)", "有附件时发送按钮必须可用");
});

test("Agent 循环：有 attachmentIds 时解析为图片消息，且不写入会话历史", () => {
  const turn = read("packages/core/agent-loop/src/execute-turn.ts");
  mustInclude(turn, "if (attachmentIds?.length)");
  mustInclude(turn, "resolveTurnAttachmentMessages({ store: attachments, userId, ids: attachmentIds })");
  mustInclude(turn, "attachmentTurnMessages = resolved.messages", "图片只进入本次请求视图（不写入会话历史）");
  mustInclude(turn, "options.deltaToUser !== false && attachmentTurnMessages.length ? [...messages, ...attachmentTurnMessages] : messages", "附件只随用户可见主请求发送；压缩摘要请求不携带图片");
  const runs = read("packages/core/agent-loop/src/runs.ts");
  mustInclude(runs, "body.attachmentIds?.length ? { attachmentIds: body.attachmentIds }", "Run 必须转交附件 ID");
  mustInclude(runs, "attachmentStore ? { attachments: attachmentStore }", "Run 必须转交附件存储");
});
