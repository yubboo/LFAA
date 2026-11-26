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

test("媒体、MCP 与连接器工具兼容旧预设，保留极简和自定义组合的限制", () => {
  const autoModules = ["@lfaa/tool-media", "@lfaa/mcp", "@lfaa/connectors"];
  for (const id of ["standard", "creative"] as const) {
    const current = resolvePreset(id).sessionModules;
    const previous = current.filter((module) => !autoModules.includes(module));
    for (const moduleName of autoModules) assert.ok(current.includes(moduleName), `${id} 缺少 ${moduleName}`);
    assert.deepEqual(resolveLegacySessionModules(id, [...previous, "@lfaa/tool-media"]), current);
    assert.deepEqual(resolveLegacySessionModules(id, previous), current);
    // 用户主动去掉的模块不复活，但连接类模块始终补齐，保证已连接的 MCP / CLI 工具在旧会话可用。
    const trimmed = resolveLegacySessionModules(id, previous.slice(1));
    assert.ok(!trimmed.includes(previous[0] ?? ""), "去掉的内置模块不应被加回来");
    assert.ok(trimmed.includes("@lfaa/connectors"), "旧会话必须补齐连接器模块");
    assert.ok(trimmed.includes("@lfaa/mcp"), "旧会话必须补齐 MCP 模块");
  }
  const minimal = resolvePreset("minimal").sessionModules;
  assert.deepEqual(resolveLegacySessionModules("minimal", minimal), minimal);
  assert.ok(!minimal.includes("@lfaa/tool-media"));
  assert.ok(!minimal.includes("@lfaa/connectors"));
});

test("历史版本的默认清单会补齐连接器与 MCP，不因缺少后加模块而漏授权", () => {
  const current = resolvePreset("standard").sessionModules;
  // 连接器与 crew 上线之前的默认清单：没有 @lfaa/connectors、@lfaa/crew、@lfaa/mcp。
  const historical = current.filter((name) => name !== "@lfaa/connectors" && name !== "@lfaa/crew" && name !== "@lfaa/mcp");
  const resolved = resolveLegacySessionModules("standard", historical);
  assert.ok(resolved.includes("@lfaa/connectors"));
  assert.ok(resolved.includes("@lfaa/mcp"));
  assert.ok(!resolved.includes("@lfaa/crew"), "不应擅自补回 crew");
});
