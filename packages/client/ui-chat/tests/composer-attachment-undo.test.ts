// 验证输入区附件插入历史：Ctrl+Z 只撤最近一次插入、草稿被改动后交回原生撤销、手动移除同步裁剪历史。
import assert from "node:assert/strict";
import test from "node:test";
import {
  dropAttachmentFromHistory,
  pushInsertBatch,
  takeUndoBatch,
  type AttachmentInsertBatch,
} from "../client/composer/composer-attachment-undo";

test("插入历史：没有新增附件时不入栈", () => {
  const history: AttachmentInsertBatch[] = [];
  pushInsertBatch(history, [], "");
  assert.equal(history.length, 0);
});

test("撤回：草稿未变时移除最近一批附件，并逐批撤销", () => {
  const history: AttachmentInsertBatch[] = [];
  pushInsertBatch(history, ["img-1"], "");
  pushInsertBatch(history, ["img-2", "img-3"], "@");

  assert.deepEqual(takeUndoBatch(history, "@"), ["img-2", "img-3"]);
  assert.deepEqual(takeUndoBatch(history, ""), ["img-1"]);
  assert.equal(takeUndoBatch(history, ""), null);
});

test("撤回：草稿在插入后改动过就交回浏览器原生撤销", () => {
  const history: AttachmentInsertBatch[] = [];
  pushInsertBatch(history, ["img-1"], "在项目里");
  assert.equal(takeUndoBatch(history, "在项目里补一句"), null);
  assert.equal(history.length, 1, "未接管撤销时历史必须保留");
});

test("手动移除附件：只裁掉同 id，不清空其它批次", () => {
  const history: AttachmentInsertBatch[] = [];
  pushInsertBatch(history, ["img-1", "img-2"], "");
  pushInsertBatch(history, ["img-3"], "");

  dropAttachmentFromHistory(history, "img-2");
  assert.deepEqual(history[0]?.ids, ["img-1"]);

  dropAttachmentFromHistory(history, "img-1");
  assert.deepEqual(history.map((batch) => batch.ids), [["img-3"]]);

  dropAttachmentFromHistory(history, "img-3");
  assert.equal(history.length, 0);
});