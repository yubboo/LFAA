/**
 * 功能：回归画布设置中心合同。
 * 作用：验证共享默认值、非法值拒绝、账户隔离保存/回读、旧数据补值，以及 HTTP/Agent 分类目录的接线。
 * 关联文件：packages/util/values/src/settings-contract.ts、settings/settings/src/{validation,service,agent-settings}.ts、ui-settings/src/SettingsPage.tsx。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isolateData } from "./isolated-data.mjs";

isolateData(test, "canvas-settings");
await import("lfaa-session-persistence-jsonl/src/repository.js");
const { database } = await import("lfaa-storage-sqlite/src/database.js");
const { configuration } = await import("lfaa-storage-domain/src/configuration.js");
const { retireLegacyFileTables } = await import("lfaa-storage-domain/src/migration.js");
retireLegacyFileTables();
const { getUserSettings, saveUserSettings, defaultSettings } = await import("lfaa-settings/src/service.js");
const { DEFAULT_USER_SETTINGS, CANVAS_DEFAULT_MODE_IDS, CANVAS_GRID_STYLE_IDS } = await import("lfaa-util-values/src/settings-contract.js");
const { settingsSchemas, validateSettingsInput } = await import("lfaa-settings/src/validation.js");
const { SETTINGS_CENTER_MENUS } = await import("lfaa-util-values/src/settings-menu-catalog.js");
const { listAgentSettings, updateAgentSetting } = await import("lfaa-settings/src/agent-settings.js");

// 合同第 8 节规定的画布默认值；生成模型继续复用 aiRuntime，不在此出现。
const CANVAS_DEFAULTS = Object.freeze({ defaultMode: "generate", gridStyle: "dots", snapToGrid: false, showMiniMap: true, agentPanelDefaultOpen: false });
const primaryUserId = "canvas-settings-primary";
const secondaryUserId = "canvas-settings-secondary";
const legacyUserId = "canvas-settings-legacy";
for (const [uid, id] of [[1, primaryUserId], [2, secondaryUserId], [3, legacyUserId]]) {
  database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role) VALUES(?,?,?,'fixture','fixture','member')").run(id, uid, id);
}

const readSource = path => readFileSync(new URL("../../../" + path, import.meta.url), "utf8");

test("画布设置共享默认值、严格 schema 与设置目录登记一致", () => {
  assert.deepEqual(DEFAULT_USER_SETTINGS.canvas, CANVAS_DEFAULTS, "共享默认值必须与合同一致");
  assert.deepEqual(defaultSettings.canvas, CANVAS_DEFAULTS, "Settings Owner 使用同一份共享默认值");
  assert.deepEqual(CANVAS_DEFAULT_MODE_IDS, ["generate", "canvas"]);
  assert.deepEqual(CANVAS_GRID_STYLE_IDS, ["dots", "lines", "none"]);
  assert.equal(settingsSchemas.canvas.validate(CANVAS_DEFAULTS, { convert: false }).error, undefined, "默认值必须通过 Strict 校验");
  assert.deepEqual(getUserSettings(primaryUserId).canvas, CANVAS_DEFAULTS, "没有保存记录的账户读取默认值");

  const menu = SETTINGS_CENTER_MENUS.find(item => item.id === "canvas");
  assert.ok(menu, "设置菜单目录必须登记画布分区");
  assert.equal(menu.settingsCategory, "canvas");
  assert.equal(menu.access, "settings", "画布偏好由 Settings Owner 保存，不需要专属工具");
  const directory = listAgentSettings(primaryUserId, { category: "canvas", limit: 50 });
  assert.deepEqual(directory.entries.map(entry => entry.path).sort(), [
    "canvas.agentPanelDefaultOpen", "canvas.defaultMode", "canvas.gridStyle", "canvas.showMiniMap", "canvas.snapToGrid"
  ], "Agent 设置目录按 Settings Owner 生成画布叶字段");
  assert.equal(directory.entries.find(entry => entry.path === "canvas.defaultMode").allowedValues.join(","), "generate,canvas");
  assert.equal(directory.categories.find(item => item.id === "canvas").label, "画布");
});

test("非法画布设置被拒绝且不落盘", () => {
  const invalidValues = [
    { ...CANVAS_DEFAULTS, defaultMode: "edit" },
    { ...CANVAS_DEFAULTS, gridStyle: "stars" },
    { ...CANVAS_DEFAULTS, snapToGrid: "false" },
    { ...CANVAS_DEFAULTS, showMiniMap: 1 },
    { ...CANVAS_DEFAULTS, agentPanelDefaultOpen: null },
    { ...CANVAS_DEFAULTS, unknownField: true }
  ];
  for (const value of invalidValues) {
    assert.ok(settingsSchemas.canvas.validate(value, { convert: false }).error, "非法值必须被 schema 拒绝：" + JSON.stringify(value));
  }
  assert.throws(() => saveUserSettings(primaryUserId, "canvas", { ...CANVAS_DEFAULTS, gridStyle: "stars" }), /格式/);
  assert.throws(() => saveUserSettings(primaryUserId, "canvas", { ...CANVAS_DEFAULTS, snapToGrid: "yes" }), /格式/);
  assert.deepEqual(getUserSettings(primaryUserId).canvas, CANVAS_DEFAULTS, "失败保存不能改动已保存值");
  assert.throws(() => validateSettingsInput("__proto__", {}), /分类/);
});

test("画布设置按账户保存、回读，旧客户端遗漏字段不覆盖已保存选择", () => {
  const saved = { defaultMode: "canvas", gridStyle: "lines", snapToGrid: true, showMiniMap: false, agentPanelDefaultOpen: true };
  saveUserSettings(primaryUserId, "canvas", saved);
  assert.deepEqual(getUserSettings(primaryUserId).canvas, saved, "保存后按账户回读同一份画布设置");
  assert.deepEqual(getUserSettings(secondaryUserId).canvas, CANVAS_DEFAULTS, "画布设置不跨账户泄漏");
  const stored = configuration.get("user_settings", row => row.user_id === primaryUserId && row.category === "canvas");
  assert.deepEqual(JSON.parse(stored.value_json), saved, "Settings Owner 持久化归一化后的画布设置");

  // 旧客户端只认识部分字段时，Settings Owner 合并当前值，避免把吸附/小地图/面板偏好重置为默认。
  saveUserSettings(primaryUserId, "canvas", { defaultMode: "generate", gridStyle: "dots" });
  assert.deepEqual(getUserSettings(primaryUserId).canvas, { defaultMode: "generate", gridStyle: "dots", snapToGrid: true, showMiniMap: false, agentPanelDefaultOpen: true });

  const agentUpdate = updateAgentSetting(primaryUserId, "canvas.snapToGrid", false);
  assert.equal(agentUpdate.changed, true);
  assert.equal(getUserSettings(primaryUserId).canvas.snapToGrid, false, "Agent 单字段写入复用 Settings Owner 校验与持久化");
  assert.throws(() => updateAgentSetting(primaryUserId, "canvas.gridStyle", "stars"), /格式/);
});

test("旧账户缺字段或缺少分类记录时按共享默认值补值", () => {
  configuration.save("user_settings", { user_id: legacyUserId, category: "canvas", value_json: JSON.stringify({ defaultMode: "canvas", showMiniMap: false }) });
  assert.deepEqual(getUserSettings(legacyUserId).canvas, { defaultMode: "canvas", gridStyle: "dots", snapToGrid: false, showMiniMap: false, agentPanelDefaultOpen: false }, "旧记录保留已有选择并补齐新字段默认值");
  configuration.save("user_settings", { user_id: legacyUserId, category: "canvas", value_json: JSON.stringify({ gridStyle: "unknown" }) });
  assert.deepEqual(getUserSettings(legacyUserId).canvas, CANVAS_DEFAULTS, "损坏的旧枚举值回落到默认值而不是抛错");
});

test("HTTP 设置分类与 Agent 工具分类登记画布", () => {
  const controller = readSource("packages/api/settings-controller/src/index.ts");
  assert.match(controller, /canvasSettingsSchema/, "HTTP 设置控制器必须重导出画布 schema");
  assert.match(controller, /canvas:\s*canvasSettingsSchema/, "PUT /settings/canvas 必须有分类 schema 映射");
  const routeContracts = readSource("packages/api/remotes/src/route-contracts.ts");
  assert.match(routeContracts, /canvasSettingsSchema/, "共享 HTTP 合同必须导出画布 schema");
  const tools = readSource("packages/core/tools/src/settings-tools.ts");
  assert.match(tools, /"canvas"/, "Agent 设置工具的分类白名单必须登记画布");
});
