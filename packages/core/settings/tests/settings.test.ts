// 验证常规设置与编码设置的默认值、阈值归一化和持久化。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { CodingSettingsStore, GeneralSettingsStore } from "../src";

test("常规设置默认包含 3/5/8 阈值，并归一化非法输入", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-settings-"));
  try {
    const store = new GeneralSettingsStore(path.join(root, "general.json"));
    assert.deepEqual((await store.get()).repeatToolThresholds, [3, 5, 8]);
    const updated = await store.update({ repeatToolThresholds: [5, 3, 3, 1, 8, 99, 99, 2] });
    assert.deepEqual(updated.repeatToolThresholds, [2, 3, 5, 8, 99]);
    assert.deepEqual((await store.get()).repeatToolThresholds, [2, 3, 5, 8, 99]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("编码设置可读写", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-coding-settings-"));
  try {
    const store = new CodingSettingsStore(path.join(root, "coding.json"));
    const initial = await store.get();
    assert.ok(initial);
    const patched = await store.update({ git: { reviewDisplayMode: "separate" } });
    assert.equal(patched.git.reviewDisplayMode, "separate");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
