// 验证输入区草稿记忆的分区键、空草稿清理与切换分区后的恢复。
import assert from "node:assert/strict";
import test from "node:test";
import {
  clearComposerDraft,
  composerDraftScope,
  isComposerDraftEmpty,
  readComposerDraft,
  readComposerDraftSync,
  writeComposerDraft,
} from "../client/composer/composer-draft-memory";

test("草稿分区：已打开会话按会话，新会话按项目，无项目落到全局", () => {
  assert.equal(composerDraftScope({ sessionId: "s1", projectId: "p1" }), "session:s1");
  assert.equal(composerDraftScope({ projectId: "p1" }), "new:p1");
  assert.equal(composerDraftScope({}), "new:global");
});

test("草稿记忆：文字与图片附件按分区保存，清空后不再恢复", async () => {
  const scope = composerDraftScope({ projectId: "p1" });
  await writeComposerDraft(scope, {
    text: "还没发出去的内容",
    attachments: [{ id: "img-1", kind: "file", label: "截图.png", detail: "图片 · 32 KB" }],
  });
  assert.equal(readComposerDraftSync(scope)?.text, "还没发出去的内容");
  const restored = await readComposerDraft(scope);
  assert.equal(restored?.attachments[0]?.label, "截图.png");

  await writeComposerDraft(scope, { text: "  ", attachments: [] });
  assert.equal(isComposerDraftEmpty({ text: "  ", attachments: [] }), true);
  assert.equal(readComposerDraftSync(scope), null);
  assert.equal(await readComposerDraft(scope), null);

  await clearComposerDraft(scope);
});

test("草稿记忆：不同项目互不串内容", async () => {
  const projectA = composerDraftScope({ projectId: "a" });
  const projectB = composerDraftScope({ projectId: "b" });
  await writeComposerDraft(projectA, { text: "A 的草稿", attachments: [] });
  await writeComposerDraft(projectB, { text: "B 的草稿", attachments: [] });
  assert.equal(readComposerDraftSync(projectA)?.text, "A 的草稿");
  assert.equal(readComposerDraftSync(projectB)?.text, "B 的草稿");
  await clearComposerDraft(projectA);
  await clearComposerDraft(projectB);
});