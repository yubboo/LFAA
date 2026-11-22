// 验证模式预设：会话插件必须是全局清单的子集，未知模式回退标准模式。
import assert from "node:assert/strict";
import test from "node:test";
import { GLOBAL_MODULES, PRESETS, isSessionModule, resolveLegacySessionModules, resolvePreset } from "../src/presets";

test("每个预设的会话插件都来自全局清单", () => {
  const global = new Set(GLOBAL_MODULES);
  for (const preset of PRESETS) {
    assert.equal(preset.sessionModules.length === 0, preset.unavailable === true, preset.id);
    for (const moduleName of preset.sessionModules) {
      assert.ok(global.has(moduleName), `${preset.id} 引用了不存在的全局插件：${moduleName}`);
    }
  }
});

test("预设 id 唯一且包含标准模式", () => {
  const ids = PRESETS.map((preset) => preset.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes("standard"));
});

test("未知模式回退到标准模式", () => {
  assert.equal(resolvePreset(undefined).id, "standard");
  assert.equal(resolvePreset("nope").id, "standard");
  assert.equal(resolvePreset("minimal").id, "minimal");
});

test("会话归属判定与预设一致", () => {
  const minimal = resolvePreset("minimal");
  assert.equal(isSessionModule("@lfaa/tools", minimal), true);
  assert.equal(isSessionModule("@lfaa/browser", minimal), false);
});

test("合包后旧模块名会迁移到新模块名并去重", () => {
  const legacy = ["@lfaa/agent", "@lfaa/llm", "@lfaa/tool-web", "@lfaa/web-fetch-http", "@lfaa/tools"];
  assert.deepEqual(resolveLegacySessionModules("custom", legacy), [
    "@lfaa/agent",
    "@lfaa/llm",
    "@lfaa/web",
    "@lfaa/tools",
  ]);
});

test("生成工具兼容旧标准与创造会话，保持极简和自定义组合的限制", () => {
  for (const id of ["standard", "creative"] as const) {
    const current = resolvePreset(id).sessionModules;
    const previous = current.filter((module) => module !== "@lfaa/tool-media");
    assert.ok(current.includes("@lfaa/tool-media"));
    assert.deepEqual(resolveLegacySessionModules(id, previous), current);
    assert.deepEqual(resolveLegacySessionModules(id, previous.slice(1)), previous.slice(1));
  }
  const minimal = resolvePreset("minimal").sessionModules;
  assert.deepEqual(resolveLegacySessionModules("minimal", minimal), minimal);
  assert.ok(!minimal.includes("@lfaa/tool-media"));
});
