// 验证插件清单投影：包元数据读取、Loader 条目相位、静态装配顺序与只读接口返回。
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readPackageMeta } from "../src/catalog/package-meta";
import { buildInventory, type LoaderEntryLike } from "../src/inventory/plugin-inventory";
import { createPluginsHttpHandler } from "../src/routes/plugin-routes";
import type { PluginsService } from "../src/index";

function withPackage(run: (dir: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "lfaa-meta-"));
  try {
    const pkg = join(root, "node_modules", "demo-pkg");
    mkdirSync(join(pkg, "locale"), { recursive: true });
    writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "demo-pkg", description: "fallback text" }));
    writeFileSync(join(pkg, "locale", "zh.json"), JSON.stringify({ meta: { title: "演示插件", description: "演示用描述。" } }));
    writeFileSync(join(pkg, "locale", "en.json"), JSON.stringify({ meta: { title: "Demo plugin", description: "Demo description." } }));
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("包元数据优先读 locale 双语 meta", () => {
  withPackage((root) => {
    const meta = readPackageMeta("demo-pkg", { baseUrl: join(root, "app.js") });
    assert.ok(meta);
    assert.equal(meta.title.zh, "演示插件");
    assert.equal(meta.title.en, "Demo plugin");
    assert.equal(meta.description.zh, "演示用描述。");
    assert.equal(meta.source, "locale");
  });
});

test("缺少 locale 时回落 package.json 描述并标记来源", () => {
  const root = mkdtempSync(join(tmpdir(), "lfaa-meta-"));
  try {
    const pkg = join(root, "node_modules", "bare-pkg");
    mkdirSync(pkg, { recursive: true });
    writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "bare-pkg", description: "只有包描述" }));
    const meta = readPackageMeta("bare-pkg", { baseUrl: join(root, "app.js") });
    assert.ok(meta);
    assert.equal(meta.title.zh, "bare-pkg");
    assert.equal(meta.description.zh, "只有包描述");
    assert.equal(meta.source, "package");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("解析不到包目录时返回 null", () => {
  assert.equal(readPackageMeta("@lfaa/not-installed", {}), null);
});

function entry(id: string, name: string, options: Partial<LoaderEntryLike> = {}): LoaderEntryLike {
  return { id, options: { name }, disabled: false, ...options };
}

test("清单先列静态装配模块，再列 Loader 条目并跳过分组", async () => {
  const snapshot = await buildInventory({
    profile: "web",
    staticModules: ["@lfaa/tools", "@lfaa/chat"],
    entries: [
      entry("group", "unused", { options: { name: "unused", group: true } }),
      entry("ext-1", "some-external"),
      entry("off-1", "@lfaa/browser", { disabled: true }),
    ],
    presets: [],
    activePreset: "standard",
    metaOf: () => null,
    managementAvailable: true,
  });
  assert.deepEqual(snapshot.entries.map((row) => row.moduleName), ["@lfaa/tools", "@lfaa/chat", "some-external", "@lfaa/browser"]);
  assert.equal(snapshot.entries[0]?.provided, true);
  assert.equal(snapshot.entries[0]?.fiberPhase, "active");
  assert.equal(snapshot.entries[3]?.enabled, false);
  assert.equal(snapshot.entries[2]?.kind, "external");
});

test("启动失败的条目带诊断，相位映射为 failed", async () => {
  const snapshot = await buildInventory({
    profile: "web",
    staticModules: [],
    entries: [{
      id: "broken",
      options: { name: "broken-pkg" },
      disabled: false,
      fiber: { state: 3, await: async () => { throw new Error("import 失败"); } },
    }],
    presets: [],
    activePreset: "standard",
    metaOf: () => null,
    managementAvailable: false,
  });
  assert.equal(snapshot.entries[0]?.fiberPhase, "failed");
  assert.equal(snapshot.entries[0]?.diagnostic, "import 失败");
});

test("GET /api/plugins/inventory 返回只读快照", async () => {
  const snapshot = { profile: "web", entries: [], presets: [], activePreset: "standard", managementAvailable: true };
  const service = { listInventory: async () => snapshot } as unknown as PluginsService;
  const handler = createPluginsHttpHandler(service);
  const captured = { statusCode: 0, body: "" };
  const res = {
    setHeader() {},
    end(chunk?: string) { if (chunk !== undefined) captured.body += chunk; return res; },
  } as unknown as ServerResponse;
  Object.defineProperty(res, "statusCode", { get: () => captured.statusCode, set: (value: number) => { captured.statusCode = value; } });
  const req = { url: "/api/plugins/inventory", method: "GET", headers: {} } as unknown as IncomingMessage;
  assert.equal(await handler(req, res), true);
  assert.equal(captured.statusCode, 200);
  assert.match(captured.body, /"managementAvailable":true/u);
});
