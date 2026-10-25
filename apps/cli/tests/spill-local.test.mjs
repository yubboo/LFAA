/** 功能：回归本机溢出存储的权限、路径隔离与会话清理。作用：验证 spill-local 不读取任意本机路径。关联文件：packages/spill/spill-local/src/index.ts。 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLocalSpillStore } from "lfaa-spill-local/src/index.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

test("本机溢出存储限制路径并按会话创建和回收文件", async () => {
  const tempRoot = resolve(root, "dist/.tmp");
  mkdirSync(tempRoot, { recursive: true });
  const fixture = mkdtempSync(join(tempRoot, "lfaa-spill-local-"));
  const storageRoot = join(fixture, "private-store");
  const store = createLocalSpillStore(storageRoot);
  const sessionA = "session/alpha:private";
  const sessionB = "session/beta:private";
  try {
    const refA = await store.spill({ sessionId: sessionA, content: "alpha result" });
    const refB = await store.spill({ sessionId: sessionB, content: "beta result" });
    const otherStore = createLocalSpillStore(storageRoot);
    const concurrentRefs = await Promise.all(Array.from({ length: 8 }, (_, index) =>
      store.spill({ sessionId: sessionA, content: `parallel result ${index}` })
    ));
    const largeContent = `${"alpha🙂".repeat(50_000)}END`;
    const largeRef = await store.spill({ sessionId: sessionA, content: largeContent });
    const sessionDirectories = () => readdirSync(storageRoot, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name);
    const directories = sessionDirectories();
    assert.equal(directories.length, 2);
    assert.deepEqual(directories.map(directory => readdirSync(join(storageRoot, directory)).length).sort((a, b) => a - b), [1, 10]);
    assert.match(refA.location, /^[0-9a-f-]{36}$/u);
    assert.equal(isAbsolute(refA.location), false);
    assert.equal(await store.load(refA), "alpha result");
    for (const ref of concurrentRefs) assert.match(await store.load(ref), /^parallel result \d+$/u);
    assert.equal(await store.load(refB), "beta result");
    const expectedRange = Array.from(largeContent).slice(100_000, 100_128).join("");
    assert.deepEqual(await store.readRange(largeRef, { offset: 100_000, limit: 128 }), { text: expectedRange, totalCharacters: Array.from(largeContent).length });
    await assert.rejects(store.readRange(largeRef, { offset: 0, limit: 16_385 }), /单次读取上限/u);
    assert.equal(refA.location.includes(sessionA), false);
    await assert.rejects(otherStore.load(refA), /只允许读取当前存储实例/);
    await assert.rejects(otherStore.readRange(largeRef, { offset: 0, limit: 8 }), /只允许读取当前存储实例/);

    const outside = join(fixture, "outside.txt");
    writeFileSync(outside, "outside data", "utf8");
    await assert.rejects(store.load({ ...refA, location: outside }), /只允许读取当前存储实例/);

    await store.dropSession(sessionA);
    assert.equal(sessionDirectories().length, 1);
    assert.equal(await store.load(refB), "beta result");
    await assert.rejects(store.load(refA));
    await assert.rejects(store.readRange(largeRef, { offset: 0, limit: 8 }));
  } finally {
    await store.dropSession(sessionA);
    await store.dropSession(sessionB);
    assert.equal(dirname(fixture), tempRoot);
    rmSync(fixture, { recursive: true, force: true });
  }
});
