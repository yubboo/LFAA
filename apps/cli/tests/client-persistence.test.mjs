/**
 * 功能：回归验证浏览器端共享持久化底座。
 * 作用：覆盖版本/作用域键、运行时编解码、异常降级及防抖写入生命周期。
 * 关联文件：packages/client/store/src/browser-persistence.ts、ai-work-drafts.ts、scroll-restoration.ts。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  createBrowserPersistence,
  createClientPersistenceKey,
  createDebouncedPersistenceWriter,
  createJsonPersistenceCodec,
  stringPersistenceCodec
} from "../../../packages/client/store/src/browser-persistence.ts";
import { readAiWorkDraft, writeAiWorkDraft } from "../../../packages/client/store/src/ai-work-drafts.ts";
import { createScrollRestorationKey } from "../../../packages/client/store/src/scroll-restoration.ts";

function createMemoryStorage() {
  const values = new Map();
  let writes = 0;
  return {
    values,
    get writes() { return writes; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { writes += 1; values.set(key, value); },
    removeItem(key) { values.delete(key); }
  };
}

test("共享键构造保持现有草稿/滚动键并隔离编码后的作用域", () => {
  assert.equal(createClientPersistenceKey("ai-work-draft", 1, ["user:a", "writing"]), "lfaa.ai-work-draft.v1:user%3Aa:writing");
  assert.equal(createScrollRestorationKey("user:a", "active-ai-session", "minecraft"), "lfaa.ui-scroll-position.v1:user%3Aa:active-ai-session:minecraft");
  assert.notEqual(
    createClientPersistenceKey("ai-work-draft", 1, ["user:a", "writing"]),
    createClientPersistenceKey("ai-work-draft", 1, ["user", "a:writing"])
  );
  assert.notEqual(createClientPersistenceKey("ai-work-draft", 1), createClientPersistenceKey("ai-work-draft", 2));
});

test("AI Work 草稿兼容旧键，按账户和应用隔离并在清空后删除", () => {
  const storage = createMemoryStorage();
  const legacyKey = "lfaa.ai-work-draft.v1:user%3Aa:writing";
  storage.setItem(legacyKey, "刷新前的章节草稿");

  assert.equal(readAiWorkDraft("user:a", "writing", storage), "刷新前的章节草稿");
  writeAiWorkDraft("user:a", "minecraft", "部署问题", storage);
  writeAiWorkDraft("user:b", "writing", "另一账户的草稿", storage);
  assert.equal(readAiWorkDraft("user:a", "minecraft", storage), "部署问题");
  assert.equal(readAiWorkDraft("user:b", "writing", storage), "另一账户的草稿");

  writeAiWorkDraft("user:a", "writing", "", storage);
  assert.equal(readAiWorkDraft("user:a", "writing", storage), "");
  assert.equal(readAiWorkDraft("user:b", "writing", storage), "另一账户的草稿");
});

test("共享 JSON codec 校验运行时类型并跳过相同值写入", () => {
  const storage = createMemoryStorage();
  const codec = createJsonPersistenceCodec((value) =>
    typeof value === "object" && value !== null && "count" in value && typeof value.count === "number"
  );
  const persistence = createBrowserPersistence({ key: "test.state.v1", codec, storage });

  assert.equal(persistence.read(), undefined);
  assert.equal(persistence.write({ count: "错误类型" }), false);
  assert.equal(persistence.write({ count: 3 }), true);
  const writesAfterFirstSave = storage.writes;
  assert.equal(persistence.write({ count: 3 }), true);
  assert.equal(storage.writes, writesAfterFirstSave);
  assert.deepEqual(persistence.read(), { count: 3 });

  storage.values.set("test.state.v1", JSON.stringify({ count: "旧格式" }));
  assert.equal(persistence.read(), undefined);
  assert.equal(storage.values.has("test.state.v1"), false);
});

test("浏览器存储拒绝访问时安全降级，不抛入 AI Work 交互", () => {
  const deniedStorage = {
    getItem() { throw new Error("测试存储访问被拒绝"); },
    setItem() { throw new Error("测试存储访问被拒绝"); },
    removeItem() { throw new Error("测试存储访问被拒绝"); }
  };
  const persistence = createBrowserPersistence({ key: "test.denied.v1", codec: stringPersistenceCodec, storage: deniedStorage });

  assert.equal(persistence.read(), undefined);
  assert.equal(persistence.write("草稿"), false);
  assert.equal(persistence.remove(), false);
  assert.equal(readAiWorkDraft("user:a", "writing", deniedStorage), "");
  assert.doesNotThrow(() => writeAiWorkDraft("user:a", "writing", "草稿", deniedStorage));
  assert.equal(readAiWorkDraft("", "writing", deniedStorage), "");
});

test("防抖写入只冲刷末值，空草稿删除，pagehide 与 dispose 负责冲刷和清理", () => {
  const storage = createMemoryStorage();
  const persistence = createBrowserPersistence({ key: "test.draft.v1", codec: stringPersistenceCodec, storage });
  const pageHideListeners = new Set();
  const writer = createDebouncedPersistenceWriter(persistence, {
    delayMs: 60_000,
    removeWhen: (value) => value.length === 0,
    subscribePageHide: (flush) => {
      pageHideListeners.add(flush);
      return () => pageHideListeners.delete(flush);
    }
  });

  writer.bindPageLifecycle();
  assert.equal(pageHideListeners.size, 1);
  writer.schedule("中间值");
  writer.schedule("最后输入");
  assert.equal(persistence.read(), undefined);
  for (const flush of pageHideListeners) flush();
  assert.equal(persistence.read(), "最后输入");

  writer.schedule("");
  assert.equal(persistence.read(), undefined);
  writer.schedule("卸载前冲刷");
  writer.dispose();
  assert.equal(persistence.read(), "卸载前冲刷");
  assert.equal(pageHideListeners.size, 0);

  writer.schedule("dispose 后忽略");
  assert.equal(persistence.read(), "卸载前冲刷");
});
