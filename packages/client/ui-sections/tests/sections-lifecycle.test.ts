// 验证自定义分区包 Host 服务生命周期、CRUD/重名校验、级联清理以及 Client 插件注册与卸载。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { sectionsPlugin } from "@lfaa/sections";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return {
        format: "module",
        shortCircuit: true,
        source: "export default new Proxy({}, { get: (_, k) => String(k) });",
      };
    }
    return nextLoad(url, context);
  },
});

test("Host sectionsPlugin 支持分区增删改、重名校验与删除通知", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-sec-test-"));
  const storeFilePath = path.join(tempRoot, "sections.json");
  const removedIds: string[] = [];

  const ctx = new Context();
  const fiber = ctx.plugin(sectionsPlugin, { storeFilePath });
  await fiber;

  const off = ctx.sections.onSectionRemoved((id) => {
    removedIds.push(id);
  });

  try {
    const created = await ctx.sections.createSection({ name: "鱼" });
    assert.equal(created.name, "鱼");

    await assert.rejects(() => ctx.sections.createSection({ name: " 鱼 " }), /已存在/);
    await assert.rejects(() => ctx.sections.createSection({ name: "   " }), /请输入分区名称/);

    const second = await ctx.sections.createSection({ name: "开发组" });
    await assert.rejects(() => ctx.sections.updateSection(second.id, { name: "鱼" }), /已存在/);

    const renamed = await ctx.sections.updateSection(created.id, { name: "核心鱼" });
    assert.equal(renamed?.name, "核心鱼");

    const listed = await ctx.sections.listSections();
    assert.equal(listed.length, 2);

    const removed = await ctx.sections.removeSection(created.id);
    assert.equal(removed, true);
    assert.deepEqual(removedIds, [created.id]);
    assert.equal((await ctx.sections.listSections()).length, 1);
  } finally {
    off();
    await fiber.dispose();
    await fs.rm(tempRoot, { recursive: true, force: true });
    assert.equal((ctx as { sections?: unknown }).sections, undefined);
  }
});

test("Client sectionsClientPlugin 在工作台注册并在 dispose 时清理", async () => {
  const { WorkbenchClientService } = await import("@lfaa/ui-layout/client");
  const { sectionsClientPlugin } = await import("../client/index");

  const ctx = new Context();
  const service = new WorkbenchClientService(ctx);

  const sectionsFiber = ctx.plugin(sectionsClientPlugin);
  await sectionsFiber;

  const loaded = service.getSnapshot();
  assert.ok(loaded.sectionProvider, "应注册 sectionProvider");

  await sectionsFiber.dispose();

  const unloaded = service.getSnapshot();
  assert.equal(unloaded.sectionProvider, null);
});

test("SectionStore 从本地缓存首屏秒开并在远端一致时静默无感校验", async () => {
  const { SectionStore } = await import("../client/store/section-store");
  const cached = [{ id: "sec-1", name: "鱼", createdAt: 1000 }];
  const mem = new Map<string, string>([["lfaa:cache-sections", JSON.stringify(cached)]]);
  const prevWindow = (globalThis as { window?: unknown }).window;
  const prevFetch = globalThis.fetch;

  (globalThis as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => { mem.set(k, v); },
    },
  };
  globalThis.fetch = (async () => new Response(JSON.stringify({ sections: cached }), { status: 200 })) as typeof fetch;

  try {
    const store = new SectionStore();
    assert.equal(store.getSections().length, 1);
    assert.equal(store.getSections()[0]?.name, "鱼");

    let emitCount = 0;
    const unsub = store.subscribe(() => { emitCount += 1; });
    await store.refreshSections();
    assert.equal(emitCount, 0, "分区列表一致时不应闪烁重绘");
    unsub();
    store.dispose();
  } finally {
    globalThis.fetch = prevFetch;
    if (prevWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window: unknown }).window = prevWindow;
    }
  }
});
