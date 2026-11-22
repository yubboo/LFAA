// 验证合包后的插件 module 名迁移：旧会话模块名与旧 profile 记录都要映射到新包名。
import assert from "node:assert/strict";
import test from "node:test";
import type { PluginRecord } from "../src/index";
import { MODULE_ALIASES, normalizeModuleName, normalizeRecord } from "../src/index";
import { normalizeRecords } from "../src/manager/record-hygiene";

const legacyRecord: PluginRecord = {
  id: "tool-web",
  moduleName: "@lfaa/tool-web",
  kind: "builtin",
  source: "builtin-catalog",
  enabled: true,
  status: "running",
  installedAt: 1,
  updatedAt: 1,
  manifest: {
    id: "tool-web",
    name: "网页读取",
    version: "0.1.0",
    description: "old",
    entryType: "builtin-local",
    compatibleLfaa: ">=0.1.0",
    capabilities: { tools: [], skills: [], views: [] },
  },
};

test("旧模块名迁移到合包后的新名字，未知名字保持不变", () => {
  assert.equal(MODULE_ALIASES["@lfaa/tool-web"], "@lfaa/web");
  assert.equal(normalizeModuleName("@lfaa/tool-web"), "@lfaa/web");
  assert.equal(normalizeModuleName("@lfaa/command-compact"), "@lfaa/compaction");
  assert.equal(normalizeModuleName("@lfaa/third-party"), "@lfaa/third-party");
});

test("旧插件记录迁移 moduleName / id / manifest.id，新记录原样返回", () => {
  const migrated = normalizeRecord(legacyRecord);
  assert.equal(migrated.moduleName, "@lfaa/web");
  assert.equal(migrated.id, "web");
  assert.equal(migrated.manifest.id, "web");

  const current = { ...legacyRecord, id: "web", moduleName: "@lfaa/web", manifest: { ...legacyRecord.manifest, id: "web" } };
  assert.equal(normalizeRecord(current), current);
});

test("多条旧记录并入同一包时按 id 合并，启用状态取并集", () => {
  const first: PluginRecord = {
    ...legacyRecord,
    id: "compaction-basic",
    moduleName: "@lfaa/compaction-basic",
    enabled: false,
    manifest: { ...legacyRecord.manifest, id: "compaction-basic" },
  };
  const second: PluginRecord = {
    ...legacyRecord,
    id: "tool-result-pruner",
    moduleName: "@lfaa/tool-result-pruner",
    enabled: true,
    manifest: { ...legacyRecord.manifest, id: "tool-result-pruner" },
  };
  const { records, changed } = normalizeRecords([first, second]);
  assert.equal(changed, true);
  assert.equal(records.length, 1);
  assert.equal(records[0]?.id, "compaction");
  assert.equal(records[0]?.enabled, true);
});